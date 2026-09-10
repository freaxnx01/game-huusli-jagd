// Renders state.log through the i18n templates, one line per entry type.

import { chf, has, t } from '../i18n.js';
import { esc } from './dom.js';

function lookup(key, fallback) {
  return has(key) ? t(key) : fallback;
}

export function logText(entry, state, board) {
  const name = (i) => state.players[i]?.name ?? '?';
  const square = (i) => board[i]?.name ?? '?';
  const toName = (i) => (i == null ? t('deed.bank') : name(i));
  const p = { name: name(entry.p) };
  switch (entry.t) {
    case 'roll':
      return t('log.roll', { ...p, d1: entry.dice[0], d2: entry.dice[1] });
    case 'move':
      return t(entry.passedGo ? 'log.movePassedGo' : 'log.move', { ...p, square: square(entry.to) });
    case 'buy':
    case 'pass':
    case 'sell':
    case 'mortgage':
    case 'unmortgage':
      return t(`log.${entry.t}`, { ...p, square: square(entry.square) });
    case 'rent':
      return t('log.rent', { ...p, to: toName(entry.to), square: square(entry.square), amount: chf(entry.amount) });
    case 'tax':
    case 'debt':
      return t(`log.${entry.t}`, { ...p, amount: chf(entry.amount) });
    case 'salary':
    case 'turn':
    case 'left':
      return t(`log.${entry.t}`, p);
    case 'card':
      return t('log.card', { ...p, card: lookup(`card.${entry.card}`, entry.card) });
    case 'build':
      return t('log.build', { ...p, square: square(entry.square), houses: t(`houses.${entry.houses}`) });
    case 'jail':
      return t('log.jail', { ...p, why: lookup(`jail.why.${entry.why}`, entry.why) });
    case 'jailOut':
      return t('log.jailOut', { ...p, how: lookup(`jail.how.${entry.how}`, entry.how) });
    case 'bankrupt':
      return t('log.bankrupt', { ...p, to: toName(entry.to) });
    case 'round':
      return t('log.round', { n: entry.round });
    case 'timeUp':
      return t('log.timeUp');
    case 'over':
      return t('log.over', { name: name(entry.winner) });
    default:
      return entry.t;
  }
}

export function renderLog(el, state, board) {
  el.innerHTML = state.log
    .map((entry) => {
      const dot = entry.p != null ? `<i class="dot p${entry.p}"></i>` : '';
      return `<li class="log-${entry.t}">${dot}${esc(logText(entry, state, board))}</li>`;
    })
    .join('');
  el.scrollTop = el.scrollHeight;
}
