// Title-deed popup, the build/mortgage square chooser and the end screen.

import { chf, t } from '../i18n.js';
import { TOKENS, squareColor } from './board.js';
import { el, esc } from './dom.js';

const RENT_ROWS = ['deed.rent', 'deed.house1', 'deed.house2', 'deed.house3', 'deed.hotel'];

function ownerLine(square, state) {
  const prop = state.props[square.index];
  if (!prop) return `<div class="do">${esc(t('deed.owner'))}: ${esc(t('deed.bank'))}</div>`;
  const name = state.players[prop.owner]?.name ?? '?';
  const flag = prop.mortgaged ? ` · <em>${esc(t('deed.mortgaged'))}</em>` : '';
  return `<div class="do"><i class="dot p${prop.owner}"></i>${esc(t('deed.owner'))}: ${esc(name)}${flag}</div>`;
}

function streetLines(square) {
  const rows = square.rent.map((r, i) => `<div>${esc(t(RENT_ROWS[i]))}<b>${r}</b></div>`);
  rows.splice(1, 0, `<div class="sub">${esc(t('deed.rentSet'))}<b>${square.rent[0] * 2}</b></div>`);
  rows.push(`<div>${esc(t('deed.houseCost'))}<b>${square.houseCost}</b></div>`);
  rows.push(`<div>${esc(t('deed.mortgage'))}<b>${square.price / 2}</b></div>`);
  return rows.join('');
}

function deedHtml(square, state) {
  if (!square.price) {
    return `<div class="dh corner">${esc(square.name)}</div><p class="dd">${esc(t(`deed.${square.type}`))}</p>`;
  }
  const lines = square.type === 'street'
    ? streetLines(square)
    : `<div class="dd">${esc(t(square.type === 'transport' ? 'deed.transportRent' : 'deed.utilityRent'))}</div><div>${esc(t('deed.mortgage'))}<b>${square.price / 2}</b></div>`;
  return `<div class="dh" style="background:${squareColor(square)}">${esc(square.name)}</div>
    <div class="dl">${lines}</div>
    <div class="dt">${esc(t('deed.title'))} · ${esc(chf(square.price))}</div>
    ${ownerLine(square, state)}`;
}

// Popup card facing the viewer, rendered into host (a 2D layer over the stage).
export function createDeed(host, { onClose }) {
  const card = el('div', 'deed');
  card.hidden = true;
  card.setAttribute('role', 'dialog');
  host.appendChild(card);
  let current = null;

  function show(index, state, board) {
    current = index;
    card.innerHTML = `${deedHtml(board[index], state)}<button class="close" aria-label="×">×</button>`;
    card.hidden = false;
  }

  function hide() {
    current = null;
    card.hidden = true;
  }

  card.addEventListener('click', (e) => {
    if (!e.target.closest('.close')) return;
    hide();
    onClose();
  });

  return { show, hide, current: () => current };
}

function amountFor(type, square) {
  if (type === 'BUILD') return -square.houseCost;
  if (type === 'SELL_HOUSE') return square.houseCost / 2;
  if (type === 'MORTGAGE') return square.price / 2;
  return -Math.ceil(square.price * 0.55);
}

function chooserItem(type, square, prop) {
  const amount = amountFor(type, square);
  const level = prop.houses ? `<small>${esc(t(`houses.${prop.houses}`))}</small>` : '';
  return `<li><button data-square="${square.index}">
    <i class="dot" style="background:${squareColor(square)}"></i>
    <span class="nm">${esc(square.name)}${level}</span>
    <span class="amt ${amount < 0 ? 'minus' : 'plus'}">${amount < 0 ? '−' : '+'}${esc(chf(Math.abs(amount)))}</span>
  </button></li>`;
}

// Modal list of the player's eligible squares for a square-typed action.
export function openChooser({ type, squares, state, board, onPick }) {
  const dialog = el('dialog', 'chooser');
  dialog.innerHTML = `<h2>${esc(t(`chooser.${type}`))}</h2>
    <ul>${squares.map((i) => chooserItem(type, board[i], state.props[i])).join('')}</ul>
    <button class="btn cancel">${esc(t('chooser.cancel'))}</button>`;
  dialog.addEventListener('click', (e) => {
    const pick = e.target.closest('button[data-square]');
    if (pick) {
      dialog.close();
      onPick(+pick.dataset.square);
    } else if (e.target.closest('.cancel') || e.target === dialog) {
      dialog.close();
    }
  });
  dialog.addEventListener('close', () => dialog.remove());
  document.body.appendChild(dialog);
  dialog.showModal();
}

// Yes/no question as a modal; resolves true only when "yes" is clicked.
export function confirmDialog(message) {
  return new Promise((resolve) => {
    const dialog = el('dialog', 'chooser confirm');
    dialog.innerHTML = `<p>${esc(message)}</p>
      <div class="confirm-buttons">
        <button class="btn danger" data-answer="yes">${esc(t('confirm.yes'))}</button>
        <button class="btn" data-answer="no">${esc(t('confirm.no'))}</button>
      </div>`;
    // Removing an open modal closes it; no reliance on the (async) close event.
    function finish(answer) {
      dialog.remove();
      resolve(answer);
    }
    dialog.addEventListener('click', (e) => {
      const button = e.target.closest('button[data-answer]');
      if (button) finish(button.dataset.answer === 'yes');
      else if (e.target === dialog) finish(false);
    });
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      finish(false);
    });
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

function rankingHtml(state, netWorth) {
  const order = state.players.map((_, i) => i).sort((a, b) => netWorth(state, b) - netWorth(state, a) || state.players[b].cash - state.players[a].cash || a - b);
  return order
    .map((i, rank) => {
      const p = state.players[i];
      const out = p.bankrupt || p.left;
      return `<li class="${out ? 'out' : ''}${i === state.winner ? ' winner' : ''}" style="--pc:var(--p${i})">
        <span class="rank">${rank + 1}</span>
        <span class="tok">${TOKENS[i % TOKENS.length]}</span>
        <b class="pname">${esc(p.name)}</b>
        <span class="nw">${esc(chf(netWorth(state, i)))}</span>
        <span class="cash">${esc(t('end.cash'))} ${esc(chf(p.cash))}</span>
      </li>`;
    })
    .join('');
}

// End screen: ranking by netWorth(state, i). "Nomol spile" dispatches { type: 'NEW_GAME' }.
export function renderEnd(root, state, { netWorth, dispatch }) {
  const winner = state.winner != null ? state.players[state.winner] : null;
  root.innerHTML = `<section class="end" data-screen="end">
    <h1>${esc(t('end.title'))}</h1>
    ${winner ? `<p class="winner-line">${esc(t('end.winner', { name: winner.name }))}</p>` : ''}
    <div class="rank-head"><span></span><span></span><span></span><span>${esc(t('end.netWorth'))}</span><span></span></div>
    <ol class="ranking">${rankingHtml(state, netWorth)}</ol>
    <button class="btn primary again">${esc(t('end.again'))}</button>
  </section>`;
  root.querySelector('.again').addEventListener('click', () => dispatch({ type: 'NEW_GAME' }));
}
