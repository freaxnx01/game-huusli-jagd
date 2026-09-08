// Boot: menu → game screen. Until src/engine/game.js lands this drives the stub
// state; Task 4 swaps stubLegal/stubReduce/stubNetWorth for the engine and adds
// the real CPU loop and clock.

import { onLangChange } from './i18n.js';
import { renderMenu } from './ui/menu.js';
import { render } from './ui/render.js';
import { stubLegal, stubNetWorth, stubReduce, stubState } from './ui/stub.js';

const CPU_DELAY_MS = 900;
const root = document.getElementById('app');
let game = null;
let cpuTimer = 0;

function showMenu() {
  clearTimeout(cpuTimer);
  game = null;
  renderMenu(root, { onStart: startGame });
}

function startGame(setup) {
  game = { state: stubState(setup) };
  draw();
}

// The seat this screen controls: the current player when local (hotseat), else
// the first local seat (solo, while a CPU is thinking).
function youFor(state) {
  const current = state.players[state.turn.player];
  if (current.kind === 'local') return state.turn.player;
  return state.players.findIndex((p) => p.kind === 'local');
}

function draw() {
  const { state } = game;
  render(root, state, { you: youFor(state), legal: stubLegal(state), dispatch, netWorth: stubNetWorth });
  scheduleCpu();
}

function scheduleCpu() {
  clearTimeout(cpuTimer);
  const { state } = game;
  if (state.turn.phase === 'over' || state.players[state.turn.player].kind !== 'cpu') return;
  cpuTimer = setTimeout(() => {
    const legal = stubLegal(game.state);
    dispatch(legal.find((a) => a.type === 'END_TURN') ?? legal[0]);
  }, CPU_DELAY_MS);
}

function dispatch(action) {
  if (action.type === 'NEW_GAME') return showMenu();
  game.state = stubReduce(game.state, action);
  draw();
}

onLangChange(() => (game ? draw() : showMenu()));
showMenu();
