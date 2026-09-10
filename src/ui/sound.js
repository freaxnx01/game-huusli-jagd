// Synthesizes short cues with Web Audio — no assets, no build step. The AudioContext is
// created lazily on the first user gesture (browsers block audio before that) and every
// call is guarded so a missing/blocked context degrades to silence, never a thrown error.
// Mute is persisted in localStorage, following the try/catch shape of scene.js's "hj.view".
// There is exactly one layer per page (getSound): mute is page-global anyway, and browsers
// cap a page at a handful of AudioContexts — one per game screen would run out.

const STORAGE_KEY = 'hj.sound';

function storedMuted() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === '1' ? true : v === '0' ? false : null;
  } catch {
    return null;
  }
}

function storeMuted(muted) {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch {
    // no storage: the choice lives for this page only
  }
}

// cue -> { type: 'tone' | 'noise', freq, dur, gain }
const VOICES = {
  dice: { type: 'noise', dur: 0.15, gain: 0.2 },
  cash: { type: 'tone', freq: 880, dur: 0.12, gain: 0.2 },
  pay: { type: 'tone', freq: 220, dur: 0.18, gain: 0.2 },
  salary: { type: 'tone', freq: 660, dur: 0.14, gain: 0.2 },
  build: { type: 'tone', freq: 180, dur: 0.1, gain: 0.22 },
  hotel: { type: 'tone', freq: 260, dur: 0.22, gain: 0.22 },
  paper: { type: 'noise', dur: 0.08, gain: 0.12 },
  card: { type: 'tone', freq: 520, dur: 0.1, gain: 0.18 },
  jail: { type: 'tone', freq: 140, dur: 0.3, gain: 0.25 },
  unlock: { type: 'tone', freq: 700, dur: 0.14, gain: 0.18 },
  bust: { type: 'tone', freq: 400, dur: 0.4, gain: 0.22 },
  alarm: { type: 'tone', freq: 1000, dur: 0.2, gain: 0.2 },
  fanfare: { type: 'tone', freq: 784, dur: 0.35, gain: 0.25 },
};

function voice(ctx, spec) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(spec.gain, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + spec.dur);
  gain.connect(ctx.destination);

  if (spec.type === 'noise') {
    const frames = Math.max(1, Math.floor(ctx.sampleRate * spec.dur));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    source.connect(filter).connect(gain);
    source.start();
    source.stop(ctx.currentTime + spec.dur);
    return;
  }

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = spec.freq;
  osc.connect(gain);
  osc.start();
  osc.stop(ctx.currentTime + spec.dur);
}

function createSound() {
  let muted = storedMuted() ?? false;
  let ctx = null;
  const listeners = new Set();
  const pending = new Set();

  function unlock() {
    // both listeners go, not just the one that fired — the gesture we waited for is past
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    if (ctx) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ctx = new Ctx();
      ctx.resume?.();
    } catch {
      ctx = null;
    }
  }
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  return {
    play(cue) {
      if (muted || !ctx) return;
      try {
        const spec = VOICES[cue];
        if (!spec) return;
        voice(ctx, spec);
      } catch {
        // synthesis failed: stay silent rather than break rendering
      }
    },
    // A burst plays spaced ~120 ms apart; the handles are kept so cancel() can drop cues
    // whose screen went away before they were due.
    playCues(cues) {
      cues.forEach((cue, i) => {
        if (!i) return this.play(cue);
        const id = setTimeout(() => {
          pending.delete(id);
          this.play(cue);
        }, i * 120);
        pending.add(id);
      });
    },
    cancel() {
      pending.forEach(clearTimeout);
      pending.clear();
    },
    muted() {
      return muted;
    },
    setMuted(on) {
      muted = !!on;
      storeMuted(muted);
      listeners.forEach((fn) => fn(muted));
    },
    toggle() {
      this.setMuted(!muted);
    },
    // returns an unsubscribe: the layer outlives the screens that label themselves from it
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

let instance = null;

export function getSound() {
  if (!instance) instance = createSound();
  return instance;
}
