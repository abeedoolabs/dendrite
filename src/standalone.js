import { Dendrite } from './dendrite.js';

// Auto-discover and initialize
function init() {
  document.querySelectorAll('[data-dendrite],.dendrite-canvas,.dendrite-svg').forEach(el => {
    const container = el.tagName === 'CANVAS' || el.tagName === 'SVG'
      ? el.parentElement
      : el;

    let data = null;
    const attr = el.getAttribute('data-dendrite');
    if (attr) {
      try { data = JSON.parse(attr); } catch (e) { /* use default */ }
    }

    const renderer = el.classList.contains('dendrite-canvas') ? 'canvas' : 'svg';
    new Dendrite(container, { renderer, data });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Expose globally for script-tag users
window.Dendrite = Dendrite;
