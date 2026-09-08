// Action bar: turn status line plus one button per legal action type. Square-typed
// actions (BUILD, SELL_HOUSE, MORTGAGE, UNMORTGAGE) open a chooser instead of
// dispatching directly.

import { chf, t } from '../i18n.js';
import { esc } from './dom.js';

const ORDER = ['ROLL', 'JAIL_PAY', 'JAIL_ROLL', 'BUY', 'PASS', 'BUILD', 'SELL_HOUSE', 'MORTGAGE', 'UNMORTGAGE', 'DECLARE_BANKRUPT', 'END_TURN'];
const SQUARE_ACTIONS = new Set(['BUILD', 'SELL_HOUSE', 'MORTGAGE', 'UNMORTGAGE']);
const PRIMARY = new Set(['ROLL', 'BUY', 'END_TURN', 'JAIL_PAY']);
const DANGER = new Set(['DECLARE_BANKRUPT']);

function squaresFor(legal, type) {
  return legal.filter((a) => a.type === type && a.square != null).map((a) => a.square);
}

function isMine(state, you) {
  return you == null || you === state.turn.player;
}

function statusHtml(state, board, you) {
  const current = state.players[state.turn.player];
  if (!isMine(state, you)) {
    const key = current.kind === 'cpu' ? 'game.cpuThinking' : 'game.waitingFor';
    return `<span class="who">${esc(t(key, { name: current.name }))}</span>`;
  }
  const details = [];
  const { turn } = state;
  if (turn.phase === 'buy' && turn.offer != null) {
    details.push(t('game.offer', { square: board[turn.offer].name, amount: chf(board[turn.offer].price) }));
  }
  if (turn.phase === 'debt' && turn.debt) details.push(t('game.debt', { amount: chf(turn.debt.amount) }));
  if (turn.phase === 'roll' && current.inJail) details.push(t('game.inJail'));
  const who = you == null ? t('game.turnOf', { name: current.name }) : t('game.yourTurn');
  return `<span class="who">${esc(who)}</span>${details.map((d) => `<span class="detail">${esc(d)}</span>`).join('')}`;
}

function buttonsHtml(legal) {
  const types = new Set(legal.map((a) => a.type));
  return ORDER.filter((type) => types.has(type))
    .map((type) => {
      const cls = PRIMARY.has(type) ? 'primary' : DANGER.has(type) ? 'danger' : '';
      return `<button class="btn ${cls}" data-type="${type}">${esc(t(`action.${type}`))}</button>`;
    })
    .join('');
}

// onAction(action) dispatches; onChoose(type, squares) opens the square chooser.
export function createActions(el, { onAction, onChoose }) {
  let legal = [];
  el.addEventListener('click', (e) => {
    const button = e.target.closest('button[data-type]');
    if (!button) return;
    const { type } = button.dataset;
    if (SQUARE_ACTIONS.has(type)) onChoose(type, squaresFor(legal, type));
    else onAction({ type });
  });

  function update(state, board, { you, legal: nextLegal }) {
    legal = isMine(state, you) ? nextLegal : [];
    el.innerHTML = `<div class="turn-status">${statusHtml(state, board, you)}</div><div class="buttons">${buttonsHtml(legal)}</div>`;
  }

  return { update };
}
