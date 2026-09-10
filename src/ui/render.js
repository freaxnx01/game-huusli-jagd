// Composes the game screen: header (round, clock, view toggle), isometric stage with
// board and pieces, player panel, action bar, log, deed popup and chooser. The
// skeleton and board are built once per (edition, language); every later render
// only patches pieces and re-renders the small 2D parts.
//
// render(root, state, { you, legal, dispatch, netWorth })
//   you       index of the seat this screen controls, or null (hotseat: everyone)
//   legal     Action[] from legalActions(state) for state.turn.player
//   dispatch  (action) => void; also receives the UI-level { type: 'NEW_GAME' }
//   netWorth  (state, playerIndex) => number
//   onLeave   optional () => void; when given, a "leave" button appears in the top bar

import { EDITIONS } from '../engine/editions.js';
import { lang, t } from '../i18n.js';
import { VERSION } from '../../version.js';
import { createActions } from './actions.js';
import { createBoard } from './board.js';
import { cuesFor, highestSeq } from './cues.js';
import { createDeed, openChooser, renderEnd } from './dialogs.js';
import { el, esc } from './dom.js';
import { langSwitcher } from './lang.js';
import { renderLog } from './log.js';
import { renderClock, renderPanel, renderRound } from './panel.js';
import { createScene } from './scene.js';
import { createSound } from './sound.js';

const instances = new WeakMap();

export function render(root, state, opts) {
  if (state.turn.phase === 'over') {
    instances.delete(root);
    renderEnd(root, state, opts);
    return;
  }
  const key = `${state.edition}|${lang()}`;
  const previous = instances.get(root);
  let inst = previous;
  if (!inst || inst.key !== key || !inst.el.isConnected) {
    inst = mount(root, state, key, previous?.startedAt ?? Date.now());
    instances.set(root, inst);
  }
  inst.state = state;
  inst.opts = opts;
  inst.update();
}

function skeleton(state) {
  return `<header class="topbar">
    <div class="brand"><span class="logo">${esc(t('app.title'))}</span><span class="edition">${esc(EDITIONS[state.edition].name)}</span></div>
    <div class="status"><span class="round"></span><span class="clock"></span></div>
    <div class="tools"><button class="btn small view-toggle" type="button"></button><button class="btn small leave" type="button" hidden>${esc(t('game.leave'))}</button></div>
  </header>
  <main class="game-main">
    <section class="stage-wrap"><div class="stage"></div><div class="deed-host"></div></section>
    <aside class="side"></aside>
    <section class="actions"></section>
    <section class="log-wrap"><ol class="log" aria-live="polite"></ol></section>
  </main>
  <footer class="foot"><span class="version">v${esc(VERSION)}</span></footer>`;
}

function mount(root, state, key, startedAt) {
  root.innerHTML = '';
  const game = el('div', 'game', skeleton(state));
  game.dataset.screen = 'game';
  game.tabIndex = -1;
  root.appendChild(game);
  const inst = { key, el: game, startedAt, state, opts: null, update };

  const scene = createScene(game.querySelector('.stage'));
  const deed = createDeed(game.querySelector('.deed-host'), { onClose: () => { pinned = null; } });
  let pinned = null;

  const sound = createSound();
  inst.sound = sound;
  let seq = highestSeq(state);

  const board = createBoard({
    boardEl: scene.boardEl,
    piecesEl: scene.piecesEl,
    edition: state.edition,
    editionName: EDITIONS[state.edition].name,
    onSquare(index, how) {
      if (how === 'hover' && pinned == null) deed.show(index, inst.state, board.squares);
      if (how === 'leave' && pinned == null) deed.hide();
      if (how !== 'tap') return;
      pinned = pinned === index ? null : index;
      if (pinned == null) deed.hide();
      else deed.show(index, inst.state, board.squares);
    },
  });

  const actions = createActions(game.querySelector('.actions'), {
    onAction: (action) => inst.opts.dispatch(action),
    onChoose: (type, squares) => openChooser({
      type,
      squares,
      state: inst.state,
      board: board.squares,
      onPick: (square) => inst.opts.dispatch({ type, square }),
    }),
  });

  const toggle = game.querySelector('.view-toggle');
  const labelToggle = () => {
    toggle.textContent = t(scene.view() === 'iso' ? 'game.viewFlat' : 'game.viewIso');
    toggle.setAttribute('aria-pressed', String(scene.view() === 'flat'));
  };
  toggle.addEventListener('click', scene.toggle);
  scene.onChange(labelToggle);
  labelToggle();
  const leave = game.querySelector('.leave');
  leave.addEventListener('click', () => inst.opts.onLeave?.());
  game.querySelector('.tools').appendChild(langSwitcher());
  // The pinned deed is the nearer "close me" target, so Escape only reaches the leave
  // path when nothing is pinned. A merely-hovered deed doesn't count as "open" here —
  // it's not something the player deliberately opened, so it shouldn't cost them an
  // Escape press. We still hide it before leaving: the confirm dialog is modal and the
  // pointer may still rest over the board while it's up, so the stray card shouldn't
  // linger underneath it. The chooser and confirm dialogs are <dialog>s on
  // document.body (ui/dialogs.js), so their own Escape never bubbles here.
  game.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (pinned != null) {
      pinned = null;
      deed.hide();
      return;
    }
    deed.hide();
    inst.opts.onLeave?.();
  });

  const roundEl = game.querySelector('.round');
  const clockEl = game.querySelector('.clock');
  const sideEl = game.querySelector('.side');
  const logEl = game.querySelector('.log');
  const tick = setInterval(() => {
    if (!game.isConnected) return clearInterval(tick);
    renderClock(clockEl, inst.state, inst.startedAt);
  }, 1000);

  function update() {
    const { state: current, opts } = inst;
    leave.hidden = !opts.onLeave;
    board.update(current);
    const { cues, seq: next } = cuesFor(seq, current);
    seq = next;
    cues.forEach((cue, i) => (i ? setTimeout(() => sound.play(cue), i * 120) : sound.play(cue)));
    renderRound(roundEl, current);
    renderClock(clockEl, current, inst.startedAt);
    renderPanel(sideEl, current, board.squares, { you: opts.you, netWorth: opts.netWorth });
    actions.update(current, board.squares, { you: opts.you, legal: opts.legal });
    renderLog(logEl, current, board.squares);
    if (deed.current() != null) deed.show(deed.current(), current, board.squares);
  }

  // Give the screen focus so Escape works immediately on a fresh mount, without
  // requiring the player to first tab/click into a square or button.
  game.focus({ preventScroll: true });

  return inst;
}
