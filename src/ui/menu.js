// Start menu: edition picker, solo / hotseat / online modes. Calls
// onStart({ edition, mode, players }) with players as the engine expects them.

import { EDITION_IDS, EDITIONS } from '../engine/editions.js';
import { t } from '../i18n.js';
import { VERSION } from '../../version.js';
import { el, esc } from './dom.js';
import { langSwitcher } from './lang.js';

const STORAGE_KEY = 'hj.menu';
const MODES = ['solo', 'hotseat', 'online'];
const LEVELS = ['gmuetlich', 'gwieft'];
const CPU_NAMES = ['Sepp', 'Heidi', 'Ueli', 'Vreni'];
const MAX_SEATS = 4;

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // no storage: nothing to remember
  }
}

function radios(name, values, current, label) {
  return values
    .map((v) => `<label class="pill"><input type="radio" name="${name}" value="${v}"${v === current ? ' checked' : ''}><span>${esc(label(v))}</span></label>`)
    .join('');
}

function editionCards(current) {
  return EDITION_IDS.map((id) => {
    const e = EDITIONS[id];
    return `<label class="edition-card">
      <input type="radio" name="edition" value="${id}"${id === current ? ' checked' : ''}>
      <span class="city">${esc(e.name)}</span>
      <span class="sample">${esc(e.streets[3][2])} · ${esc(e.transport[0])}</span>
    </label>`;
  }).join('');
}

function nameInputs(prefs) {
  return Array.from({ length: MAX_SEATS }, (_, i) => {
    const value = prefs.names?.[i] ?? '';
    return `<label class="name-row"${i >= prefs.seats ? ' hidden' : ''}><span>${i + 1}</span><input name="name${i}" maxlength="16" placeholder="${esc(t('menu.playerN', { n: i + 1 }))}" value="${esc(value)}"></label>`;
  }).join('');
}

function html(prefs) {
  return `<header class="menu-head">
    <div class="lang-slot"></div>
    <h1>${esc(t('app.title'))}</h1>
    <p class="tagline">${esc(t('app.tagline'))}</p>
  </header>
  <h2>${esc(t('menu.edition'))}</h2>
  <div class="editions">${editionCards(prefs.edition)}</div>
  <h2>${esc(t('menu.mode'))}</h2>
  <div class="tabs" role="tablist">${MODES.map((m) => `<button type="button" class="tab" role="tab" data-mode="${m}" aria-selected="${m === prefs.mode}">${esc(t(`menu.mode.${m}`))}</button>`).join('')}</div>
  <form class="mode" data-mode="solo"${prefs.mode === 'solo' ? '' : ' hidden'}>
    <label class="field"><span>${esc(t('menu.yourName'))}</span><input name="name" maxlength="16" required value="${esc(prefs.name)}" placeholder="${esc(t('menu.playerN', { n: 1 }))}"></label>
    <fieldset><legend>${esc(t('menu.cpus'))}</legend>${radios('cpus', [1, 2, 3], prefs.cpus, String)}</fieldset>
    <fieldset><legend>${esc(t('menu.level'))}</legend>${radios('level', LEVELS, prefs.level, (v) => t(`menu.level.${v}`))}</fieldset>
    <button class="btn primary big" type="submit">${esc(t('menu.start'))}</button>
  </form>
  <form class="mode" data-mode="hotseat"${prefs.mode === 'hotseat' ? '' : ' hidden'}>
    <fieldset><legend>${esc(t('menu.players'))}</legend>${radios('seats', [2, 3, 4], prefs.seats, String)}</fieldset>
    <div class="names">${nameInputs(prefs)}</div>
    <button class="btn primary big" type="submit">${esc(t('menu.start'))}</button>
  </form>
  <div class="mode online" data-mode="online"${prefs.mode === 'online' ? '' : ' hidden'}>
    <div class="online-buttons">
      <button type="button" class="btn big" data-online="host">${esc(t('menu.host'))}</button>
      <button type="button" class="btn big" data-online="join">${esc(t('menu.join'))}</button>
    </div>
    <div class="placeholder" hidden><p class="which"></p><p>${esc(t('menu.onlineSoon'))}</p></div>
  </div>
  <footer class="foot"><span class="version">v${esc(VERSION)}</span></footer>`;
}

function cpuSeats(count, level, humanName) {
  return CPU_NAMES.filter((n) => n !== humanName)
    .slice(0, count)
    .map((name) => ({ name, kind: 'cpu', level }));
}

export function renderMenu(root, { onStart }) {
  const prefs = { edition: 'zuerich', mode: 'solo', name: '', cpus: 3, level: 'gwieft', seats: 2, names: [], ...loadPrefs() };
  root.innerHTML = '';
  const menu = el('section', 'menu', html(prefs));
  menu.dataset.screen = 'menu';
  root.appendChild(menu);
  menu.querySelector('.lang-slot').appendChild(langSwitcher());

  const edition = () => menu.querySelector('input[name=edition]:checked').value;

  menu.querySelector('.tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    prefs.mode = tab.dataset.mode;
    menu.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b === tab)));
    menu.querySelectorAll('.mode').forEach((m) => { m.hidden = m.dataset.mode !== prefs.mode; });
    savePrefs(prefs);
  });

  const solo = menu.querySelector('form[data-mode=solo]');
  solo.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(solo);
    const name = data.get('name').trim() || t('menu.playerN', { n: 1 });
    Object.assign(prefs, { edition: edition(), name, cpus: +data.get('cpus'), level: data.get('level') });
    savePrefs(prefs);
    onStart({ edition: prefs.edition, mode: 'solo', players: [{ name, kind: 'local' }, ...cpuSeats(prefs.cpus, prefs.level, name)] });
  });

  const hotseat = menu.querySelector('form[data-mode=hotseat]');
  hotseat.addEventListener('change', (e) => {
    if (e.target.name !== 'seats') return;
    prefs.seats = +e.target.value;
    hotseat.querySelectorAll('.name-row').forEach((row, i) => { row.hidden = i >= prefs.seats; });
  });
  hotseat.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(hotseat);
    prefs.names = Array.from({ length: MAX_SEATS }, (_, i) => data.get(`name${i}`).trim());
    prefs.edition = edition();
    savePrefs(prefs);
    const players = prefs.names.slice(0, prefs.seats).map((n, i) => ({ name: n || t('menu.playerN', { n: i + 1 }), kind: 'local' }));
    onStart({ edition: prefs.edition, mode: 'hotseat', players });
  });

  const online = menu.querySelector('.mode.online');
  online.addEventListener('click', (e) => {
    const button = e.target.closest('button[data-online]');
    if (!button) return;
    const box = online.querySelector('.placeholder');
    box.querySelector('.which').textContent = t(button.dataset.online === 'host' ? 'menu.onlineHost' : 'menu.onlineJoin');
    box.hidden = false;
  });
}
