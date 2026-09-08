import { LANGS, lang, setLang, t } from '../i18n.js';
import { el } from './dom.js';

// <select> bound to the i18n language; the caller re-renders on change.
export function langSwitcher() {
  const select = el('select', 'lang-select');
  select.setAttribute('aria-label', 'Language');
  for (const id of LANGS) {
    const option = el('option', '', t(`lang.${id}`));
    option.value = id;
    option.selected = id === lang();
    select.appendChild(option);
  }
  select.addEventListener('change', () => setLang(select.value));
  return select;
}
