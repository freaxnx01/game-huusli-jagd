// Hüüsli-Jagd — P2P transport (manual WebRTC, copy-paste offer/answer codes, STUN only).
//
// Lifted from the Tschau Sepp implementation. This module knows nothing about the DOM
// or the game: it moves JSON objects between one host and up to `maxGuests` guests.
// Signalling is done by hand — the host makes an offer code, the guest pastes it and
// returns an answer code, the host pastes that back. One RTCPeerConnection and one
// data channel per guest.
//
// Pure helpers (encodeDescription / decodeDescription / parseMessage) never touch
// RTCPeerConnection, so they can be imported and tested in Node.

const PREFIX_DEFLATE = 'HJ1';
const PREFIX_PLAIN = 'HJ0';
const CHANNEL_LABEL = 'hj';
const ICE_GATHER_CAP_MS = 3500;
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// ---------- codes ----------

function b64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

function b64d(str) {
  const s = atob(str);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

async function deflate(text) {
  const cs = new CompressionStream('deflate-raw');
  const buf = await new Response(new Blob([text]).stream().pipeThrough(cs)).arrayBuffer();
  return new Uint8Array(buf);
}

async function inflate(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  return new Response(new Blob([bytes]).stream().pipeThrough(ds)).text();
}

/** Encode an RTCSessionDescription(-like) `{type, sdp}` as a paste-able code. */
export async function encodeDescription(desc) {
  const raw = JSON.stringify({ t: desc.type, s: desc.sdp });
  try {
    return `${PREFIX_DEFLATE}.${b64(await deflate(raw))}`;
  } catch {
    return `${PREFIX_PLAIN}.${b64(new TextEncoder().encode(raw))}`;
  }
}

/** Decode a code produced by encodeDescription. Throws Error('bad code') on garbage. */
export async function decodeDescription(code) {
  const clean = String(code ?? '').replace(/\s+/g, '');
  const m = clean.match(/^(HJ[01])\.([A-Za-z0-9+/=]+)$/);
  if (!m) throw new Error('bad code');
  let parsed;
  try {
    const bytes = b64d(m[2]);
    const raw = m[1] === PREFIX_DEFLATE ? await inflate(bytes) : new TextDecoder().decode(bytes);
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('bad code');
  }
  if (!isPlainObject(parsed) || typeof parsed.s !== 'string' || (parsed.t !== 'offer' && parsed.t !== 'answer')) {
    throw new Error('bad code');
  }
  return { type: parsed.t, sdp: parsed.s };
}

// ---------- messages ----------

function isPlainObject(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * Parse a raw data-channel payload. Returns the message object if it is JSON for a
 * plain object with a non-empty string `t` field, otherwise null. Never throws.
 */
export function parseMessage(raw) {
  if (typeof raw !== 'string') return null;
  let v;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isPlainObject(v) || typeof v.t !== 'string' || v.t === '') return null;
  return v;
}

function debugDrop(why, raw) {
  if (typeof console !== 'undefined' && console.debug) console.debug('[net] dropped message:', why, raw);
}

// ---------- shared plumbing ----------

function emitter() {
  const handlers = new Map();
  let muted = false;
  return {
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event).add(fn);
      return () => handlers.get(event)?.delete(fn);
    },
    off(event, fn) {
      handlers.get(event)?.delete(fn);
    },
    emit(event, payload) {
      if (muted) return;
      for (const fn of [...(handlers.get(event) ?? [])]) {
        try {
          fn(payload);
        } catch (e) {
          if (typeof console !== 'undefined') console.error('[net] listener error', e);
        }
      }
    },
    mute() {
      muted = true;
      handlers.clear();
    },
  };
}

function newPeerConnection() {
  if (typeof RTCPeerConnection === 'undefined') throw new Error('WebRTC is not available here');
  return new RTCPeerConnection({ iceServers: ICE_SERVERS });
}

function iceDone(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const timer = setTimeout(resolve, ICE_GATHER_CAP_MS);
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

function sendOn(ch, msg) {
  try {
    if (ch && ch.readyState === 'open') {
      ch.send(JSON.stringify(msg));
      return true;
    }
  } catch {
    /* channel went away between the check and the send */
  }
  return false;
}

function teardown(conn) {
  if (!conn) return;
  const { pc, ch } = conn;
  conn.pc = null;
  conn.ch = null;
  try {
    if (ch) {
      ch.onopen = ch.onmessage = ch.onclose = ch.onerror = null;
      ch.close();
    }
  } catch { /* already closed */ }
  try {
    if (pc) {
      pc.onconnectionstatechange = pc.ondatachannel = null;
      pc.close();
    }
  } catch { /* already closed */ }
}

const DEAD_STATES = new Set(['failed', 'closed', 'disconnected']);

// ---------- host ----------

/**
 * Host side. Events: 'connected' {guestId}, 'message' {guestId, msg},
 * 'disconnected' {guestId}, 'pendingFailed' {error}.
 * guestId is a small integer (1, 2, 3, ...) assigned in connection order.
 */
export function createHost({ maxGuests = 3 } = {}) {
  const em = emitter();
  const guests = new Map();     // guestId -> {pc, ch, guestId}
  let pending = null;           // offer made, answer not yet accepted
  const connecting = new Set(); // answer accepted, channel not yet open
  let nextId = 1;
  let closed = false;

  function slotsLeft() {
    return maxGuests - guests.size - connecting.size;
  }

  function dropGuest(guestId) {
    const conn = guests.get(guestId);
    if (!conn) return;
    guests.delete(guestId);
    teardown(conn);
    em.emit('disconnected', { guestId });
  }

  function failPending(conn, error) {
    if (pending === conn) pending = null;
    connecting.delete(conn);
    teardown(conn);
    em.emit('pendingFailed', { error });
  }

  function promote(conn) {
    if (pending === conn) pending = null;
    connecting.delete(conn);
    if (closed || slotsLeft() <= 0) {
      teardown(conn);
      return;
    }
    const guestId = nextId++;
    conn.guestId = guestId;
    guests.set(guestId, conn);
    em.emit('connected', { guestId });
  }

  function wire(conn) {
    const { pc, ch } = conn;
    pc.onconnectionstatechange = () => {
      if (conn.pc !== pc || !DEAD_STATES.has(pc.connectionState)) return;
      if (conn.guestId != null) dropGuest(conn.guestId);
      else failPending(conn, new Error(`connection ${pc.connectionState}`));
    };
    ch.onopen = () => {
      if (conn.ch === ch) promote(conn);
    };
    ch.onmessage = (e) => {
      if (conn.ch !== ch || conn.guestId == null) return;
      const msg = parseMessage(e.data);
      if (!msg) return debugDrop('invalid', e.data);
      em.emit('message', { guestId: conn.guestId, msg });
    };
    ch.onclose = () => {
      if (conn.ch !== ch) return;
      if (conn.guestId != null) dropGuest(conn.guestId);
      else failPending(conn, new Error('channel closed'));
    };
  }

  return {
    on: em.on,
    off: em.off,

    guests() {
      return [...guests.keys()];
    },

    /** Create a fresh offer and return its code. Replaces an un-answered pending offer. */
    async makeOfferCode() {
      if (closed) throw new Error('host is closed');
      if (slotsLeft() <= 0) throw new Error('lobby is full');
      if (pending) {
        const old = pending;
        pending = null;
        teardown(old);
      }
      const pc = newPeerConnection();
      const conn = { pc, ch: pc.createDataChannel(CHANNEL_LABEL), guestId: null };
      pending = conn;
      wire(conn);
      try {
        await pc.setLocalDescription(await pc.createOffer());
        await iceDone(pc);
        if (pending !== conn) throw new Error('offer replaced');
        return await encodeDescription(pc.localDescription);
      } catch (e) {
        if (pending === conn) pending = null;
        teardown(conn);
        throw e;
      }
    },

    /** Paste the guest's answer code for the current pending offer. */
    async acceptAnswer(code) {
      const desc = await decodeDescription(code);
      if (desc.type !== 'answer') throw new Error('not an answer code');
      if (!pending) throw new Error('no pending offer');
      const conn = pending;
      pending = null;
      connecting.add(conn);
      try {
        await conn.pc.setRemoteDescription(desc);
      } catch (e) {
        connecting.delete(conn);
        teardown(conn);
        throw new Error(`answer rejected: ${e && e.message ? e.message : e}`);
      }
    },

    send(guestId, msg) {
      return sendOn(guests.get(guestId)?.ch, msg);
    },

    broadcast(msg) {
      for (const conn of guests.values()) sendOn(conn.ch, msg);
    },

    /** Drop one guest locally. Does not emit 'disconnected' (the caller already knows). */
    close(guestId) {
      const conn = guests.get(guestId);
      if (!conn) return;
      guests.delete(guestId);
      teardown(conn);
    },

    /** Tear everything down. Idempotent; no events fire afterwards. */
    closeAll() {
      if (closed) return;
      closed = true;
      em.mute();
      const all = [pending, ...connecting, ...guests.values()].filter(Boolean);
      pending = null;
      connecting.clear();
      guests.clear();
      for (const conn of all) teardown(conn);
    },
  };
}

// ---------- guest ----------

/**
 * Guest side. Events: 'connected' {}, 'message' {msg}, 'disconnected' {reason}.
 * reason is 'failed' (ICE/connection failed) or 'closed' (host closed the channel).
 */
export function createGuest() {
  const em = emitter();
  let conn = null;
  let closed = false;

  function drop(reason) {
    const c = conn;
    conn = null;
    teardown(c);
    em.emit('disconnected', { reason });
  }

  return {
    on: em.on,
    off: em.off,

    /** Paste the host's offer code; returns the answer code to send back. */
    async answerOffer(code) {
      const desc = await decodeDescription(code);
      if (desc.type !== 'offer') throw new Error('not an offer code');
      if (closed) throw new Error('guest is closed');
      if (conn) {
        const old = conn;
        conn = null;
        teardown(old);
      }
      const pc = newPeerConnection();
      const c = (conn = { pc, ch: null });
      pc.onconnectionstatechange = () => {
        if (conn !== c || c.pc !== pc) return;
        if (DEAD_STATES.has(pc.connectionState)) drop('failed');
      };
      pc.ondatachannel = (e) => {
        if (conn !== c) return;
        const ch = (c.ch = e.channel);
        ch.onopen = () => {
          if (c.ch === ch) em.emit('connected', {});
        };
        ch.onmessage = (ev) => {
          if (c.ch !== ch) return;
          const msg = parseMessage(ev.data);
          if (!msg) return debugDrop('invalid', ev.data);
          em.emit('message', { msg });
        };
        ch.onclose = () => {
          if (c.ch === ch) drop('closed');
        };
      };
      try {
        await pc.setRemoteDescription(desc);
        await pc.setLocalDescription(await pc.createAnswer());
        await iceDone(pc);
        if (conn !== c) throw new Error('answer superseded');
        return await encodeDescription(pc.localDescription);
      } catch (e) {
        if (conn === c) conn = null;
        teardown(c);
        throw e;
      }
    },

    send(msg) {
      return sendOn(conn?.ch, msg);
    },

    /** Tear down. Idempotent; no events fire afterwards. */
    close() {
      if (closed) return;
      closed = true;
      em.mute();
      const c = conn;
      conn = null;
      teardown(c);
    },
  };
}
