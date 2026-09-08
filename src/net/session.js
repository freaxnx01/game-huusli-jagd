// Online sessions on top of the transport (webrtc.js), following docs/ai-notes/p2p-protocol.md.
//
// hostSession  owns the lobby seats and, once started, the authoritative game loop. Every
//              state change is reported locally through onState and broadcast as {t:'state'}.
//              Guest proposals ({t:'act'}) are accepted only for the seat on turn and only
//              when they match an entry of legalActions(state).
// guestSession renders whatever the host sends and proposes actions; it never applies one.
//
// Neither side trusts the peer: every inbound message is shape-checked before use.

import { legalActions, newGame } from '../engine/game.js';
import { createGameLoop } from '../game-loop.js';
import { createGuest, createHost } from './webrtc.js';

const MAX_SEATS = 4;
const HOST_SEAT = 0;
const NAME_MAX = 18;

// ---------- validation helpers ----------

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

function cleanName(value, fallback) {
  const name = typeof value === 'string' ? value.trim().slice(0, NAME_MAX) : '';
  return name || fallback;
}

function sameAction(a, b) {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}

// Returns the matching entry of legalActions(state) or null. The legal entry, not the
// guest's object, is what gets dispatched.
function matchLegal(state, action) {
  if (!isPlainObject(action) || typeof action.type !== 'string') return null;
  return legalActions(state).find((legal) => sameAction(legal, action)) ?? null;
}

function looksLikeState(v) {
  return isPlainObject(v) && Array.isArray(v.players) && isPlainObject(v.turn)
    && Number.isInteger(v.turn.player) && typeof v.turn.phase === 'string' && typeof v.edition === 'string';
}

function looksLikeLobby(v) {
  return Array.isArray(v.names) && v.names.every((n) => typeof n === 'string')
    && Number.isInteger(v.you) && v.you >= 0 && v.you < v.names.length;
}

function uniqueName(name, taken) {
  const lower = new Set(taken.map((n) => n.toLowerCase()));
  if (!lower.has(name.toLowerCase())) return name;
  let n = 2;
  while (lower.has(`${name} ${n}`.toLowerCase())) n += 1;
  return `${name} ${n}`.slice(0, NAME_MAX);
}

// ---------- host ----------

/**
 * hostSession({ edition, name, guestName, options, onLobby, onState, onFailed })
 *   guestName  fallback for guests who sent no name
 *   options    extra newGame options (maxRounds, timeLimitMs)
 *   onLobby(seats)   seats = [{ name, kind }] in seat order, host first
 *   onState(state)   after every accepted action (also fires locally on start)
 *   onFailed(error)  a pending offer/answer failed before the channel opened
 */
export function hostSession({ edition, name, guestName, options = {}, onLobby, onState, onFailed }) {
  const host = createHost({ maxGuests: MAX_SEATS - 1 });
  const seats = [{ name, kind: 'local', guestId: null }];
  let loop = null;
  let announced = false;
  let closed = false;

  const seatOf = (guestId) => seats.findIndex((s) => s.guestId === guestId);
  const lobbyView = () => seats.map(({ name: n, kind }) => ({ name: n, kind }));

  function sendLobby() {
    const names = seats.map((s) => s.name);
    seats.forEach((seat, i) => {
      if (seat.guestId !== null) host.send(seat.guestId, { t: 'lobby', names, you: i });
    });
    onLobby(lobbyView());
  }

  function reject(guestId) {
    host.send(guestId, { t: 'full' });
    host.close(guestId);
  }

  function hello(guestId, msg) {
    if (loop || seats.length >= MAX_SEATS) return reject(guestId);
    const wanted = cleanName(msg.name, guestName);
    const taken = seats.map((s) => s.name);
    const seatName = msg.custom === true ? wanted : uniqueName(wanted, taken);
    seats.push({ name: seatName, kind: 'remote', guestId });
    sendLobby();
  }

  function removeSeat(seat) {
    seats.splice(seat, 1);
    sendLobby();
  }

  function seatLeft(seat) {
    seats[seat].guestId = null;
    const { players, turn } = loop.state;
    const active = !players[seat].bankrupt && !players[seat].left && turn.phase !== 'over';
    if (active) loop.dispatch({ type: 'LEAVE', player: seat });
  }

  function guestGone(guestId) {
    const seat = seatOf(guestId);
    if (seat < 0) return;
    if (loop) seatLeft(seat);
    else removeSeat(seat);
  }

  function act(seat, msg) {
    if (!loop) return;
    const state = loop.state;
    if (state.turn.player !== seat) return console.debug('[net] act out of turn from seat', seat);
    const action = matchLegal(state, msg.action);
    if (!action) return console.warn('[net] illegal act from seat', seat, msg.action);
    loop.dispatch(action);
  }

  function onMessage({ guestId, msg }) {
    const seat = seatOf(guestId);
    if (seat < 0) {
      if (msg.t === 'hello') hello(guestId, msg);
      return;
    }
    if (msg.t === 'leave') {
      host.close(guestId);
      guestGone(guestId);
    } else if (msg.t === 'act') {
      act(seat, msg);
    }
  }

  function onChange(state) {
    onState(state);
    host.broadcast({ t: announced ? 'state' : 'start', state });
    announced = true;
  }

  host.on('message', onMessage);
  host.on('disconnected', ({ guestId }) => guestGone(guestId));
  host.on('pendingFailed', ({ error }) => onFailed(error));

  return {
    makeOfferCode: () => host.makeOfferCode(),
    acceptAnswer: (code) => host.acceptAnswer(code),
    seats: lobbyView,
    get state() { return loop?.state ?? null; },
    you: HOST_SEAT,

    /** Start with the connected seats plus `cpus` = [{ name, level }], clipped to 4 seats. */
    start(cpus) {
      if (loop || closed) return;
      const players = [
        ...lobbyView(),
        ...cpus.slice(0, MAX_SEATS - seats.length).map(({ name: n, level }) => ({ name: n, kind: 'cpu', level })),
      ];
      const state = newGame({ edition, players, seed: Date.now() >>> 0, startedAt: Date.now(), ...options });
      loop = createGameLoop(state, { onChange });
    },

    /** Local (host seat) action; ignored when it is not the host's turn. */
    dispatch(action) {
      if (loop && loop.state.turn.player === HOST_SEAT) loop.dispatch(action);
    },

    /** End the lobby or the game for everyone. Idempotent. */
    leave() {
      if (closed) return;
      closed = true;
      loop?.stop();
      host.broadcast({ t: 'bye' });
      host.closeAll();
    },
  };
}

// ---------- guest ----------

/**
 * guestSession({ name, custom, onLobby, onState, onDropped })
 *   custom            true when the user typed the name (the host keeps it on collision)
 *   onLobby({ names, you })
 *   onState(state)    every snapshot from the host, first one is the game start
 *   onDropped(reason) 'full' | 'bye' | 'failed' | 'closed' — the session is closed by then
 */
export function guestSession({ name, custom, onLobby, onState, onDropped }) {
  const guest = createGuest();
  let seat = null;
  let state = null;
  let closed = false;

  function drop(reason) {
    if (closed) return;
    closed = true;
    guest.close();
    onDropped(reason);
  }

  const HANDLERS = {
    lobby(msg) {
      if (!looksLikeLobby(msg)) return;
      seat = msg.you;
      onLobby({ names: msg.names, you: seat });
    },
    start(msg) {
      HANDLERS.state(msg);
    },
    state(msg) {
      if (seat === null || !looksLikeState(msg.state)) return;
      state = msg.state;
      onState(state);
    },
    full: () => drop('full'),
    bye: () => drop('bye'),
  };

  guest.on('connected', () => guest.send({ t: 'hello', name, custom }));
  guest.on('message', ({ msg }) => HANDLERS[msg.t]?.(msg));
  guest.on('disconnected', ({ reason }) => drop(reason));

  return {
    answerOffer: (code) => guest.answerOffer(code),
    get state() { return state; },
    get you() { return seat; },

    /** Propose an action to the host; ignored when it is not our turn. */
    dispatch(action) {
      if (state && state.turn.player === seat) guest.send({ t: 'act', action });
    },

    /** Tell the host we are gone and close. Idempotent. */
    leave() {
      if (closed) return;
      closed = true;
      guest.send({ t: 'leave' });
      guest.close();
    },
  };
}
