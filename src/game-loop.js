// Authoritative game loop around the pure engine: holds the single state, applies
// actions through reduce(), lets CPU seats act on their own with a short delay and
// turns the 30-minute clock into TIME_UP. Every state change is reported through
// onChange(state), so a screen can render it and a network host can broadcast it.
// dispatch(action) is the one entry point for local, CPU and (later) remote seats.

import { isOver, reduce } from './engine/game.js';
import { chooseAction } from './ai/cpu.js';

const CPU_ACTION_DELAY_MS = 600;
const CPU_ROLL_DELAY_MS = 1200;
const CLOCK_TICK_MS = 1000;
const ILLEGAL = /^illegal action/;

function cpuDelay(state) {
  if (document.hidden) return 0;
  return state.turn.phase === 'roll' ? CPU_ROLL_DELAY_MS : CPU_ACTION_DELAY_MS;
}

function isCpuTurn(state) {
  return !isOver(state) && state.players[state.turn.player].kind === 'cpu';
}

function timeIsUp(state, now = Date.now()) {
  return !isOver(state) && !state.finalRound && now >= state.startedAt + state.timeLimitMs;
}

// Returns the next state, or null when the engine rejected the action as illegal.
// Any other exception is a bug and propagates.
function apply(state, action) {
  try {
    return reduce(state, action);
  } catch (err) {
    if (!ILLEGAL.test(err.message)) throw err;
    console.error(err.message);
    return null;
  }
}

export function createGameLoop(initial, { onChange }) {
  let state = initial;
  let cpuTimer = 0;
  let running = true;

  function dispatch(action) {
    if (!running) return;
    const next = apply(state, action);
    if (!next) return;
    state = next;
    onChange(state);
    scheduleCpu();
  }

  function scheduleCpu() {
    clearTimeout(cpuTimer);
    if (!isCpuTurn(state)) return;
    cpuTimer = setTimeout(() => dispatch(chooseAction(state, state.turn.player)), cpuDelay(state));
  }

  const clock = setInterval(() => {
    if (timeIsUp(state)) dispatch({ type: 'TIME_UP' });
    if (isOver(state) || state.finalRound) clearInterval(clock);
  }, CLOCK_TICK_MS);

  function stop() {
    running = false;
    clearTimeout(cpuTimer);
    clearInterval(clock);
  }

  onChange(state);
  scheduleCpu();
  return { dispatch, stop, get state() { return state; } };
}
