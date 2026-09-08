// Online lobbies. The host makes one offer code per guest, pastes each answer code back
// and fills the remaining seats with CPUs; the guest pastes the offer, sends the answer
// code back and waits. Codes expire after ten minutes (with a visible countdown).
//
// Both screens keep a small view state, re-render it as a whole and get poked from
// outside through the returned handle: update(...) with lobby data from the session,
// fail(message) for a transport failure, refresh() after a language change, destroy().

import { EDITIONS } from '../engine/editions.js';
import { t } from '../i18n.js';
import { el, esc } from './dom.js';
import { langSwitcher } from './lang.js';
import { CPU_NAMES } from './menu.js';

const MAX_SEATS = 4;
const CODE_TTL_MS = 10 * 60 * 1000;
const COPIED_MS = 1600;
const TICK_MS = 1000;
const LEVELS = ['gmuetlich', 'gwieft'];

// ---------- shared pieces ----------

function countdown(expiresAt) {
  const total = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function head(title, edition) {
  const sub = edition ? `<p class="tagline">${esc(EDITIONS[edition].name)}</p>` : '';
  return `<header class="menu-head"><div class="lang-slot"></div><h1>${esc(title)}</h1>${sub}</header>`;
}

function seatRow(name, tag, index, extra = '') {
  return `<li class="seat" style="--pc:var(--p${index})"><i class="dot p${index}"></i><b>${esc(name)}</b><span class="tag">${esc(tag)}</span>${extra}</li>`;
}

function seatTag(seat, index, you) {
  if (index === you) return t('panel.you');
  return seat.kind === 'local' ? t('lobby.hostTag') : t('panel.remote');
}

function codeBox(code, expiresAt, copied) {
  return `<textarea class="code" readonly rows="4" aria-label="Code">${esc(code)}</textarea>
    <div class="code-tools">
      <button type="button" class="btn small copy">${esc(t(copied ? 'lobby.copied' : 'lobby.copy'))}</button>
      <span class="countdown">${esc(t('lobby.validFor', { time: countdown(expiresAt) }))}</span>
    </div>`;
}

function errorBox(error) {
  return error ? `<p class="error" role="alert">${esc(error)}</p>` : '';
}

async function copyToClipboard(text, textarea) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    textarea.select();
    return document.execCommand('copy');
  }
}

// Mounts a lobby section and returns helpers shared by both screens.
function screen(root, className) {
  root.innerHTML = '';
  const section = el('section', `menu lobby ${className}`);
  section.dataset.screen = 'lobby';
  root.appendChild(section);
  let ticker = 0;

  function paint(html) {
    section.innerHTML = html;
    section.querySelector('.lang-slot').appendChild(langSwitcher());
  }

  function tick(fn) {
    clearInterval(ticker);
    ticker = setInterval(() => {
      if (!section.isConnected) return clearInterval(ticker);
      fn();
    }, TICK_MS);
  }

  function updateCountdown(expiresAt) {
    const span = section.querySelector('.countdown');
    if (span) span.textContent = t('lobby.validFor', { time: countdown(expiresAt) });
  }

  return { section, paint, tick, updateCountdown, destroy: () => clearInterval(ticker) };
}

// ---------- host ----------

function nextCpuName(taken) {
  const lower = new Set(taken.map((n) => n.toLowerCase()));
  return CPU_NAMES.find((n) => !lower.has(n.toLowerCase())) ?? CPU_NAMES[taken.length % CPU_NAMES.length];
}

function hostHtml(view) {
  const total = view.seats.length + view.cpus.length;
  const rows = [
    ...view.seats.map((s, i) => seatRow(s.name, seatTag(s, i, 0), i)),
    ...view.cpus.map((c, i) => seatRow(c.name, `${t('panel.cpu')} · ${t(`menu.level.${c.level}`)}`, view.seats.length + i,
      `<button type="button" class="btn small remove-cpu" data-cpu="${i}" aria-label="${esc(t('lobby.removeCpu'))}">×</button>`)),
  ];
  const codeStep = view.code
    ? `<p class="step">${esc(t('lobby.step1'))}</p>${codeBox(view.code, view.expiresAt, view.copied)}
       <p class="step">${esc(t('lobby.step2'))}</p>
       <textarea class="code answer" rows="4" placeholder="${esc(t('lobby.answerPlaceholder'))}">${esc(view.answer)}</textarea>
       <button type="button" class="btn primary connect"${view.connecting ? ' disabled' : ''}>${esc(t(view.connecting ? 'lobby.connecting' : 'lobby.connect'))}</button>`
    : `<button type="button" class="btn make-code"${view.making || view.seats.length >= MAX_SEATS ? ' disabled' : ''}>${esc(t(view.making ? 'lobby.making' : 'lobby.makeCode'))}</button>`;
  return `${head(t('menu.host'), view.edition)}
    <h2>${esc(t('lobby.players', { n: total }))}</h2>
    <ul class="seats">${rows.join('')}</ul>
    <div class="cpu-add">
      <button type="button" class="btn small add-cpu"${total >= MAX_SEATS ? ' disabled' : ''}>${esc(t('lobby.addCpu'))}</button>
      <select class="cpu-level" aria-label="${esc(t('menu.level'))}">${LEVELS.map((l) => `<option value="${l}"${l === view.level ? ' selected' : ''}>${esc(t(`menu.level.${l}`))}</option>`).join('')}</select>
    </div>
    <h2>${esc(t('menu.mode.online'))}</h2>
    ${errorBox(view.error)}
    ${codeStep}
    <div class="lobby-actions">
      <button type="button" class="btn primary big start"${total >= 2 ? '' : ' disabled'}>${esc(t('lobby.start'))}</button>
      <button type="button" class="btn big cancel">${esc(t('lobby.cancel'))}</button>
    </div>`;
}

/**
 * renderHostLobby(root, { edition, session, onStart, onCancel })
 *   session  { makeOfferCode(), acceptAnswer(code), seats() }
 *   onStart(cpus) with cpus = [{ name, level }]
 */
export function renderHostLobby(root, { edition, session, onStart, onCancel }) {
  const ui = screen(root, 'host');
  const view = { edition, seats: session.seats(), cpus: [], level: 'gwieft', code: '', expiresAt: 0, answer: '', making: false, connecting: false, copied: false, error: '' };

  function render() {
    ui.paint(hostHtml(view));
  }

  function set(patch) {
    Object.assign(view, patch);
    render();
  }

  function expire() {
    if (!view.code || Date.now() < view.expiresAt) return ui.updateCountdown(view.expiresAt);
    set({ code: '', answer: '', connecting: false, error: t('lobby.err.expiredHost') });
  }

  async function makeCode() {
    set({ making: true, error: '' });
    try {
      const code = await session.makeOfferCode();
      set({ making: false, code, expiresAt: Date.now() + CODE_TTL_MS, answer: '', copied: false });
    } catch {
      set({ making: false, error: t('lobby.err.makeFailed') });
    }
  }

  async function connect() {
    set({ connecting: true, error: '' });
    try {
      await session.acceptAnswer(view.answer);
    } catch {
      set({ connecting: false, error: t('lobby.err.badAnswer') });
    }
  }

  async function copy() {
    if (!(await copyToClipboard(view.code, ui.section.querySelector('.code')))) return;
    set({ copied: true });
    setTimeout(() => view.copied && set({ copied: false }), COPIED_MS);
  }

  function addCpu() {
    const taken = [...view.seats.map((s) => s.name), ...view.cpus.map((c) => c.name)];
    set({ cpus: [...view.cpus, { name: nextCpuName(taken), level: view.level }] });
  }

  const CLICKS = {
    '.make-code': makeCode,
    '.connect': connect,
    '.copy': copy,
    '.add-cpu': addCpu,
    '.remove-cpu': (button) => set({ cpus: view.cpus.filter((_, i) => i !== +button.dataset.cpu) }),
    '.start': () => onStart(view.cpus),
    '.cancel': onCancel,
  };

  ui.section.addEventListener('click', (e) => {
    const selector = Object.keys(CLICKS).find((s) => e.target.closest(s));
    if (selector) CLICKS[selector](e.target.closest(selector));
  });
  ui.section.addEventListener('input', (e) => {
    if (e.target.matches('.answer')) view.answer = e.target.value;
  });
  ui.section.addEventListener('change', (e) => {
    if (e.target.matches('.cpu-level')) view.level = e.target.value;
  });

  ui.tick(expire);
  render();

  return {
    /** New seat list from the session: a guest connected or left. */
    update(seats) {
      const cpus = view.cpus.slice(0, Math.max(0, MAX_SEATS - seats.length));
      set({ seats, cpus, code: '', answer: '', connecting: false, error: '' });
    },
    fail(message) {
      set({ code: '', answer: '', connecting: false, making: false, error: message });
    },
    refresh: render,
    destroy: ui.destroy,
  };
}

// ---------- guest ----------

function guestHtml(view) {
  const body = {
    paste: () => `<p class="step">${esc(t('lobby.offerLabel'))}</p>
      <textarea class="code offer" rows="4" placeholder="${esc(t('lobby.offerPlaceholder'))}">${esc(view.offer)}</textarea>
      <button type="button" class="btn primary answer">${esc(t('lobby.answer'))}</button>`,
    answering: () => `<p class="step">${esc(t('lobby.answering'))}</p>`,
    answer: () => `<p class="step">${esc(t('lobby.sendBack'))}</p>${codeBox(view.code, view.expiresAt, view.copied)}
      <p class="hint">${esc(t('lobby.waitingConnect'))}</p>`,
    wait: () => `<p class="step joined">${esc(t('lobby.joined'))}</p><p class="hint">${esc(t('lobby.waitingHost'))}</p>
      <h2>${esc(t('lobby.players', { n: view.lobby.names.length }))}</h2>
      <ul class="seats">${view.lobby.names.map((name, i) => seatRow(name, i === view.lobby.you ? t('panel.you') : i === 0 ? t('lobby.hostTag') : t('panel.remote'), i)).join('')}</ul>`,
  };
  return `${head(t('menu.join'))}
    ${errorBox(view.error)}
    ${body[view.stage]()}
    <div class="lobby-actions"><button type="button" class="btn big cancel">${esc(t('lobby.cancel'))}</button></div>`;
}

/**
 * renderGuestLobby(root, { session, onCancel })
 *   session  { answerOffer(code) }
 */
export function renderGuestLobby(root, { session, onCancel }) {
  const ui = screen(root, 'guest');
  const view = { stage: 'paste', offer: '', code: '', expiresAt: 0, copied: false, error: '', lobby: null };

  function render() {
    ui.paint(guestHtml(view));
  }

  function set(patch) {
    Object.assign(view, patch);
    render();
  }

  function expire() {
    if (view.stage !== 'answer') return;
    if (Date.now() < view.expiresAt) return ui.updateCountdown(view.expiresAt);
    set({ stage: 'paste', code: '', error: t('lobby.err.expiredGuest') });
  }

  async function answer() {
    set({ stage: 'answering', error: '' });
    try {
      const code = await session.answerOffer(view.offer);
      set({ stage: 'answer', code, expiresAt: Date.now() + CODE_TTL_MS, copied: false });
    } catch {
      set({ stage: 'paste', error: t('lobby.err.badOffer') });
    }
  }

  async function copy() {
    if (!(await copyToClipboard(view.code, ui.section.querySelector('.code')))) return;
    set({ copied: true });
    setTimeout(() => view.copied && set({ copied: false }), COPIED_MS);
  }

  const CLICKS = { '.answer': answer, '.copy': copy, '.cancel': onCancel };

  ui.section.addEventListener('click', (e) => {
    const selector = Object.keys(CLICKS).find((s) => e.target.closest(s));
    if (selector) CLICKS[selector]();
  });
  ui.section.addEventListener('input', (e) => {
    if (e.target.matches('.offer')) view.offer = e.target.value;
  });

  ui.tick(expire);
  render();

  return {
    /** { names, you } from the host: we are in, or the seat list changed. */
    update(lobby) {
      set({ stage: 'wait', lobby, error: '' });
    },
    refresh: render,
    destroy: ui.destroy,
  };
}
