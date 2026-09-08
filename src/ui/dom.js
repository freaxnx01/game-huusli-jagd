// Tiny DOM helpers shared by the UI modules.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

export function el(tag, className = '', html = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html) node.innerHTML = html;
  return node;
}

// Keeps container children in sync with a keyed item list; nodes are created once
// and updated in place, so CSS transitions and animations survive re-renders.
export function keyed(container) {
  const nodes = new Map();
  return function sync(items, create, update) {
    const keep = new Set();
    for (const item of items) {
      let node = nodes.get(item.key);
      if (!node) {
        node = create(item);
        nodes.set(item.key, node);
        container.appendChild(node);
      }
      update(node, item);
      keep.add(item.key);
    }
    for (const [key, node] of nodes) {
      if (keep.has(key)) continue;
      node.remove();
      nodes.delete(key);
    }
  };
}
