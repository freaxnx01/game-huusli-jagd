// The 7 × 7 board grid (24 perimeter squares + centre) and the pieces layer on top of
// it: house/hotel cubes, standee tokens and dice. Built once per edition, then
// patched in place on every render.

import { boardFor } from '../engine/editions.js';
import { has, t } from '../i18n.js';
import { el, esc, keyed } from './dom.js';

const TRACKS = [1.35, 1, 1, 1, 1, 1, 1.35];
const TRACK_SUM = TRACKS.reduce((a, b) => a + b, 0);
const TRACK_START = TRACKS.map((_, i) => TRACKS.slice(0, i).reduce((a, b) => a + b, 0));
const CORNERS = new Set(['go', 'jail', 'parking', 'gotojail']);

export const TOKENS = ['🚌', '🐕', '🚁', '🚣'];

const PIPS = {
  1: [[50, 50]],
  2: [[27, 27], [73, 73]],
  3: [[27, 27], [50, 50], [73, 73]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
  6: [[27, 25], [27, 50], [27, 75], [73, 25], [73, 50], [73, 75]],
};

// Counter-clockwise from LOS in the bottom-right corner; 1-based grid lines.
export function gridPos(i) {
  if (i <= 6) return { row: 7, col: 7 - i };
  if (i <= 12) return { row: 13 - i, col: 1 };
  if (i <= 18) return { row: 1, col: i - 11 };
  return { row: i - 17, col: 7 };
}

// Cell rectangle in percent of the board, derived from the grid tracks so pieces
// can be placed without reading layout.
export function cellRect(i) {
  const { row, col } = gridPos(i);
  const pct = (v) => (v / TRACK_SUM) * 100;
  return {
    left: pct(TRACK_START[col - 1]),
    top: pct(TRACK_START[row - 1]),
    width: pct(TRACKS[col - 1]),
    height: pct(TRACKS[row - 1]),
  };
}

export function squareColor(square) {
  if (square.type === 'street') return `var(--tier-${square.color})`;
  if (square.type === 'transport') return 'var(--transport)';
  if (square.type === 'utility') return 'var(--utility)';
  if (square.type === 'card') return 'var(--card)';
  return 'var(--tax)';
}

function squareEl(square) {
  const { row, col } = gridPos(square.index);
  const corner = CORNERS.has(square.type);
  const node = el('div', `sq ${square.type}${corner ? ' corner' : ''}`);
  node.dataset.square = square.index;
  node.style.gridRow = row;
  node.style.gridColumn = col;
  node.tabIndex = 0;
  const parts = [];
  if (!corner) parts.push(`<div class="bar" style="background:${squareColor(square)}"><span class="owner" hidden></span></div>`);
  parts.push(`<div class="name${square.name.length >= 14 ? ' long' : ''}">${esc(square.name)}</div>`);
  if (square.price) parts.push(`<div class="price">${square.price}</div>`);
  else if (has(`sq.${square.type}`)) parts.push(`<div class="sub">${esc(t(`sq.${square.type}`))}</div>`);
  node.innerHTML = parts.join('');
  return node;
}

function centreEl(editionName) {
  return el('div', 'centre', `<div class="logo">${esc(t('app.title'))}</div><div class="edition-name">${esc(editionName)}</div>`);
}

function cube(kind) {
  return el('div', `cube ${kind}`, '<i class="top"></i><i class="front"></i><i class="side"></i>');
}

function pipImage(value) {
  return PIPS[value].map(([x, y]) => `radial-gradient(circle at ${x}% ${y}%, #1b2620 2.2px, transparent 2.8px)`).join(',');
}

function pieceItems(state) {
  const items = [];
  for (const [sq, prop] of Object.entries(state.props)) {
    if (!prop.houses) continue;
    if (prop.houses >= 4) items.push({ key: `hotel${sq}`, kind: 'hotel', square: +sq, k: 0 });
    else for (let k = 0; k < prop.houses; k++) items.push({ key: `house${sq}-${k}`, kind: 'house', square: +sq, k });
  }
  state.players.forEach((p, i) => {
    if (!p.left) items.push({ key: `token${i}`, kind: 'token', player: i, square: p.pos, bankrupt: p.bankrupt });
  });
  (state.turn.dice ?? []).forEach((value, n) => items.push({ key: `die${n}`, kind: 'die', n, value }));
  return items;
}

function createPiece(item) {
  if (item.kind === 'token') {
    const node = el('div', `token p${item.player}`, `<i class="base"></i><div class="standee">${TOKENS[item.player % TOKENS.length]}</div>`);
    node.style.setProperty('--pc', `var(--p${item.player})`);
    return node;
  }
  const node = cube(item.kind);
  if (item.kind === 'die') {
    node.classList.add(`die${item.n}`);
    node.firstChild.addEventListener('animationend', () => node.classList.remove('rolling'));
  }
  return node;
}

function place(node, left, top) {
  node.style.left = `${left}%`;
  node.style.top = `${top}%`;
}

function updatePiece(node, item) {
  if (item.kind === 'die') {
    place(node, 39 + item.n * 12, 55 - item.n * 5);
    if (node.dataset.value === String(item.value)) return;
    node.dataset.value = item.value;
    node.firstChild.style.backgroundImage = pipImage(item.value);
    node.classList.add('rolling');
    return;
  }
  const rect = cellRect(item.square);
  if (item.kind === 'token') {
    const col = item.player % 2;
    const row = Math.floor(item.player / 2);
    place(node, rect.left + rect.width * (0.3 + col * 0.4), rect.top + rect.height * (0.7 + row * 0.25));
    node.classList.toggle('bankrupt', item.bankrupt);
    return;
  }
  node.style.left = `calc(${rect.left + rect.width * 0.08}% + ${item.k * 12}px)`;
  node.style.top = `${rect.top + rect.height * 0.55}%`;
}

// onSquare(index | null, how) with how ∈ 'hover' | 'leave' | 'tap'
export function createBoard({ boardEl, piecesEl, edition, editionName, onSquare }) {
  const squares = boardFor(edition);
  boardEl.innerHTML = '';
  boardEl.dataset.edition = edition;
  const cells = squares.map(squareEl);
  cells.forEach((c) => boardEl.appendChild(c));
  boardEl.appendChild(centreEl(editionName));
  const owners = cells.map((c) => c.querySelector('.owner'));
  piecesEl.innerHTML = '';
  const syncPieces = keyed(piecesEl);

  const squareOf = (target) => target.closest('.sq')?.dataset.square;
  boardEl.addEventListener('pointerover', (e) => {
    const sq = squareOf(e.target);
    if (e.pointerType === 'mouse' && sq != null) onSquare(+sq, 'hover');
  });
  boardEl.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') onSquare(null, 'leave');
  });
  boardEl.addEventListener('click', (e) => {
    const sq = squareOf(e.target);
    if (sq != null) onSquare(+sq, 'tap');
  });
  boardEl.addEventListener('keydown', (e) => {
    const sq = squareOf(e.target);
    if (sq == null || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    onSquare(+sq, 'tap');
  });

  function update(state) {
    const here = state.players[state.turn.player]?.pos;
    squares.forEach((square, i) => {
      const prop = state.props[i];
      cells[i].classList.toggle('offer', state.turn.offer === i);
      cells[i].classList.toggle('here', here === i);
      cells[i].classList.toggle('mortgaged', Boolean(prop?.mortgaged));
      if (!owners[i]) return;
      owners[i].hidden = !prop;
      owners[i].className = prop ? `owner p${prop.owner}` : 'owner';
    });
    syncPieces(pieceItems(state), createPiece, updatePiece);
  }

  return { squares, update };
}
