// Player panel (name, cash, token, property chips, badges), round counter and the
// 30-minute countdown. Pure rendering from state.

import { chf, t } from '../i18n.js';
import { TOKENS, squareColor } from './board.js';
import { esc } from './dom.js';

const DEFAULT_LIMIT = 30 * 60 * 1000;

function badge(kind) {
  return `<span class="badge ${kind}">${esc(t(`panel.${kind}`))}</span>`;
}

function chip(square, prop) {
  const level = prop.houses >= 4 ? 'H' : prop.houses || '';
  const title = `${square.name}${prop.mortgaged ? ` – ${t('deed.mortgaged')}` : ''}`;
  return `<span class="chip${prop.mortgaged ? ' mortgaged' : ''}" style="--c:${squareColor(square)}" title="${esc(title)}">${level}</span>`;
}

function chips(state, board, playerIndex) {
  return Object.entries(state.props)
    .filter(([, prop]) => prop.owner === playerIndex)
    .map(([sq, prop]) => chip(board[+sq], prop))
    .join('');
}

function playerHtml(state, board, i, { you, netWorth }) {
  const p = state.players[i];
  const classes = ['player', `p${i}`];
  if (i === state.turn.player) classes.push('current');
  if (i === you) classes.push('you');
  if (p.bankrupt || p.left) classes.push('out');
  const tags = [];
  if (i === you) tags.push(`<span class="tag">${esc(t('panel.you'))}</span>`);
  if (p.kind === 'cpu') tags.push(`<span class="tag">${esc(t('panel.cpu'))}${p.level ? ` · ${esc(t(`menu.level.${p.level}`))}` : ''}</span>`);
  if (p.kind === 'remote') tags.push(`<span class="tag">${esc(t('panel.remote'))}</span>`);
  if (p.inJail) tags.push(badge('jail'));
  if (p.bankrupt) tags.push(badge('bankrupt'));
  if (p.left) tags.push(badge('left'));
  return `<li class="${classes.join(' ')}" style="--pc:var(--p${i})">
    <span class="tok">${TOKENS[i % TOKENS.length]}</span>
    <div class="who"><b class="pname">${esc(p.name)}</b>${tags.join('')}</div>
    <div class="money"><span class="cash">${esc(chf(p.cash))}</span><span class="nw">${esc(t('end.netWorth'))} ${esc(chf(netWorth(state, i)))}</span></div>
    <div class="chips">${chips(state, board, i)}</div>
  </li>`;
}

export function renderPanel(el, state, board, opts) {
  el.innerHTML = `<ul class="players">${state.players.map((_, i) => playerHtml(state, board, i, opts)).join('')}</ul>`;
}

export function renderRound(el, state) {
  const final = state.finalRound || state.round >= state.maxRounds;
  el.innerHTML = `<span class="round-n">${esc(t('game.round', { n: state.round, max: state.maxRounds }))}</span>${final ? `<span class="final">${esc(t('game.finalRound'))}</span>` : ''}`;
}

export function remainingMs(state, startedAt, now = Date.now()) {
  const limit = state.timeLimitMs ?? DEFAULT_LIMIT;
  return Math.max(0, (state.startedAt ?? startedAt) + limit - now);
}

export function renderClock(el, state, startedAt, now = Date.now()) {
  const ms = remainingMs(state, startedAt, now);
  const total = Math.ceil(ms / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  el.textContent = `${mm}:${ss}`;
  el.classList.toggle('urgent', ms > 0 && ms < 3 * 60 * 1000);
  el.classList.toggle('done', ms === 0);
}
