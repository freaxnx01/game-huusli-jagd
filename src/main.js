// Boot: menu → game screen. The menu's choices become a real engine state, the game
// loop drives CPU seats and the clock, and every state change is rendered here.
// Debug query parameters: ?rounds=N (round limit) and ?minutes=N (clock).

import { legalActions, netWorth, newGame } from './engine/game.js';
import { createGameLoop } from './game-loop.js';
import { onLangChange } from './i18n.js';
import { renderMenu } from './ui/menu.js';
import { render } from './ui/render.js';

const DEFAULT_ROUNDS = 20;
const DEFAULT_MINUTES = 30;
const root = document.getElementById('app');
let loop = null;
let you = null;

function debugNumber(name, fallback) {
  const value = Number(new URLSearchParams(location.search).get(name));
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function showMenu() {
  loop?.stop();
  loop = null;
  renderMenu(root, { onStart: startGame });
}

function startGame({ edition, mode, players }) {
  const state = newGame({
    edition,
    players,
    seed: Date.now() >>> 0,
    maxRounds: debugNumber('rounds', DEFAULT_ROUNDS),
    timeLimitMs: debugNumber('minutes', DEFAULT_MINUTES) * 60 * 1000,
    startedAt: Date.now(),
  });
  // Solo: this screen is the one human seat. Hotseat: everyone, so the seat on turn
  // always sees its own buttons.
  you = mode === 'solo' ? players.findIndex((p) => p.kind === 'local') : null;
  loop = createGameLoop(state, { onChange: draw });
}

function draw(state) {
  render(root, state, { you, legal: legalActions(state), dispatch, netWorth });
}

function dispatch(action) {
  if (action.type === 'NEW_GAME') return showMenu();
  loop.dispatch(action);
}

onLangChange(() => (loop ? draw(loop.state) : showMenu()));
showMenu();
