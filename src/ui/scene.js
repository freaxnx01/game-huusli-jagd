// The isometric "travel case" scene: perspective stage, tilted scene, red case with
// folded-down sides, the board grid and the pieces layer. Flat/iso view is persisted
// in localStorage ("hj.view"); portrait phones default to flat.

const STORAGE_KEY = 'hj.view';
const VIEWS = ['iso', 'flat'];

function storedView() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return VIEWS.includes(v) ? v : null;
  } catch {
    return null;
  }
}

function storeView(view) {
  try {
    localStorage.setItem(STORAGE_KEY, view);
  } catch {
    // no storage: the choice lives for this page only
  }
}

function defaultView() {
  return matchMedia('(orientation: portrait) and (max-width: 640px)').matches ? 'flat' : 'iso';
}

export function createScene(stageEl) {
  stageEl.className = 'stage';
  stageEl.innerHTML = '<div class="scene"><div class="shadow"></div><div class="case"></div><div class="board"></div><div class="pieces"></div></div>';
  const listeners = new Set();
  let view = storedView() ?? defaultView();

  function apply() {
    stageEl.classList.toggle('iso', view === 'iso');
    stageEl.classList.toggle('flat', view === 'flat');
  }

  function setView(next) {
    if (!VIEWS.includes(next) || next === view) return;
    view = next;
    storeView(next);
    apply();
    listeners.forEach((fn) => fn(next));
  }

  apply();
  return {
    boardEl: stageEl.querySelector('.board'),
    piecesEl: stageEl.querySelector('.pieces'),
    view: () => view,
    setView,
    toggle: () => setView(view === 'iso' ? 'flat' : 'iso'),
    onChange: (fn) => listeners.add(fn),
  };
}
