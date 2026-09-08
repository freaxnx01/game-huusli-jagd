// Boot: menu → game screen (solo / hotseat), or menu → lobby → online game. Every
// screen is an object { stop, redraw }; the current one is stopped when the next takes
// over. The game loop (local) or the session (online) reports state changes, and every
// change is rendered here. Debug query parameters: ?rounds=N (round limit) and
// ?minutes=N (clock).

import { isOver, legalActions, netWorth, newGame } from './engine/game.js';
import { createGameLoop } from './game-loop.js';
import { onLangChange, t } from './i18n.js';
import { guestSession, hostSession } from './net/session.js';
import { confirmDialog } from './ui/dialogs.js';
import { renderGuestLobby, renderHostLobby } from './ui/lobby.js';
import { renderMenu } from './ui/menu.js';
import { render } from './ui/render.js';

const DEFAULT_ROUNDS = 25;
const DEFAULT_MINUTES = 30;
const root = document.getElementById('app');
let screen = null;

function debugNumber(name, fallback) {
  const value = Number(new URLSearchParams(location.search).get(name));
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function gameOptions() {
  return { maxRounds: debugNumber('rounds', DEFAULT_ROUNDS), timeLimitMs: debugNumber('minutes', DEFAULT_MINUTES) * 60 * 1000 };
}

function show(next) {
  screen?.stop();
  screen = next;
}

function draw(state, game) {
  render(root, state, { you: game.you, legal: legalActions(state), dispatch: game.dispatch, netWorth, onLeave: game.onLeave });
}

// ---------- menu ----------

function showMenu(notice = '') {
  show({
    stop() {},
    redraw: () => renderMenu(root, { onStart: startGame, onHost: hostGame, onJoin: joinGame, notice }),
  });
  screen.redraw();
}

// ---------- solo / hotseat ----------

function startGame({ edition, mode, players }) {
  let loop = null;
  const game = {
    // Solo: this screen is the one human seat. Hotseat: everyone, so the seat on turn
    // always sees its own buttons.
    you: mode === 'solo' ? players.findIndex((p) => p.kind === 'local') : null,
    stop: () => loop?.stop(),
    redraw: () => draw(loop.state, game),
    dispatch(action) {
      if (action.type === 'NEW_GAME') return showMenu();
      loop.dispatch(action);
    },
  };
  show(game);
  const state = newGame({ edition, players, seed: Date.now() >>> 0, startedAt: Date.now(), ...gameOptions() });
  loop = createGameLoop(state, { onChange: (s) => draw(s, game) });
}

// ---------- online ----------

// Leaving a running online game asks first; from the end screen it just leaves.
async function leaveOnline(session, confirmKey) {
  const running = session.state && !isOver(session.state);
  if (running && !(await confirmDialog(t(confirmKey)))) return;
  showMenu();
}

function hostGame({ edition, name }) {
  let lobby = null;
  const session = hostSession({
    edition,
    name,
    guestName: t('lobby.guest'),
    options: gameOptions(),
    onLobby: (seats) => lobby?.update(seats),
    onState: (state) => draw(state, game),
    onFailed: () => lobby?.fail(t('lobby.err.connectFailed')),
  });
  const game = {
    you: session.you,
    stop() {
      lobby?.destroy();
      session.leave();
    },
    redraw: () => (session.state ? draw(session.state, game) : lobby.refresh()),
    dispatch(action) {
      if (action.type === 'NEW_GAME') return leaveOnline(session, 'game.leaveConfirmHost');
      session.dispatch(action);
    },
    onLeave: () => leaveOnline(session, 'game.leaveConfirmHost'),
  };
  show(game);
  lobby = renderHostLobby(root, {
    edition,
    session,
    onStart(cpus) {
      lobby.destroy();
      lobby = null;
      session.start(cpus);
    },
    onCancel: () => showMenu(),
  });
}

function joinGame({ name, custom }) {
  let lobby = null;
  const session = guestSession({
    name,
    custom,
    onLobby: (info) => lobby?.update(info),
    onState(state) {
      lobby?.destroy();
      lobby = null;
      draw(state, game);
    },
    onDropped: (reason) => showMenu(t(`net.${reason}`)),
  });
  const game = {
    get you() { return session.you; },
    stop() {
      lobby?.destroy();
      session.leave();
    },
    redraw: () => (session.state ? draw(session.state, game) : lobby.refresh()),
    dispatch(action) {
      if (action.type === 'NEW_GAME') return leaveOnline(session, 'game.leaveConfirm');
      session.dispatch(action);
    },
    onLeave: () => leaveOnline(session, 'game.leaveConfirm'),
  };
  show(game);
  lobby = renderGuestLobby(root, { session, onCancel: () => showMenu() });
}

onLangChange(() => screen.redraw());
showMenu();
