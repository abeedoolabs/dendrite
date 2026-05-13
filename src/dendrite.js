import { DendriteNode } from './core/node.js';
import { buildTree, exportTree, DEFAULT_CONFIG } from './core/layout.js';
import { CanvasRenderer } from './renderers/canvas.js';
import { SvgRenderer } from './renderers/svg.js';

export class Dendrite {
  constructor(container, options = {}) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    this.container = container;

    // Merge config
    this.config = {
      ...DEFAULT_CONFIG,
      height: options.height || DEFAULT_CONFIG.height,
      colors: { ...DEFAULT_CONFIG.colors, ...(options.colors || {}) }
    };

    // Build tree from data
    const rect = container.getBoundingClientRect();
    this.nodes = buildTree(options.data || null, rect.width, this.config.height, this.config);

    // Create renderer
    const rendererType = options.renderer || 'svg';
    if (rendererType === 'canvas') {
      this.renderer = new CanvasRenderer(container, this.nodes, this.config);
    } else {
      this.renderer = new SvgRenderer(container, this.nodes, this.config);
    }

    // Bind interaction
    this._bindInteraction();
  }

  _bindInteraction() {
    const el = this.renderer.element;
    const r = this.renderer;
    let dragging = null;
    let dragOffX = 0, dragOffY = 0;

    const getPos = (e) => {
      const rect = el.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      if (!src) return { x: 0, y: 0 };
      return { x: src.clientX - rect.left, y: src.clientY - rect.top };
    };

    el.addEventListener('mousemove', e => {
      const pos = getPos(e);
      r.setMouse(pos.x, pos.y);

      if (dragging) {
        const nx = pos.x - dragOffX;
        const ny = pos.y - dragOffY;
        dragging.move(nx - dragging.x, ny - dragging.y);

        // Flip direction at center
        if (dragging.parent && dragging.parent.isRoot) {
          const center = r.width / 2;
          if (dragging.isRight && dragging.x < center) {
            dragging.setDirection(false, this.config.colors);
          } else if (!dragging.isRight && dragging.x > center) {
            dragging.setDirection(true, this.config.colors);
          }
        }
        r.updateNode(dragging);
      }
    });

    el.addEventListener('mousedown', e => {
      const pos = getPos(e);

      // Plus buttons (SVG handles its own plus clicks, but canvas needs this)
      if (!(r instanceof SvgRenderer)) {
        for (let i = this.nodes.length - 1; i >= 0; i--) {
          const n = this.nodes[i];
          if (!n.isRoot && r.hitTestPlus(n, pos.x, pos.y)) {
            r.setCreating({ parent: n });
            return;
          }
        }
      }

      // Node drag
      for (let i = this.nodes.length - 1; i >= 0; i--) {
        const n = this.nodes[i];
        if (r.hitTestBody(n, pos.x, pos.y)) {
          dragging = n;
          dragOffX = pos.x - n.x;
          dragOffY = pos.y - n.y;
          return;
        }
      }
    });

    el.addEventListener('mouseup', e => {
      const pos = getPos(e);
      const creating = r.creating;

      if (creating) {
        const parent = creating.parent;
        const isRight = pos.x > r.width / 2;
        const color = isRight ? this.config.colors.primary : this.config.colors.secondary;
        const n = new DendriteNode(pos.x, pos.y, color, parent, '');
        n.isRight = isRight;
        parent.children.push(n);
        this.nodes.push(n);
        r.setCreating(null);
        r.addNode(n);
        r.startEditing(n);
        return;
      }

      dragging = null;
    });

    el.addEventListener('dblclick', e => {
      const pos = getPos(e);
      for (let i = this.nodes.length - 1; i >= 0; i--) {
        const n = this.nodes[i];
        if (!n.isRoot && r.hitTestBody(n, pos.x, pos.y)) {
          r.startEditing(n);
          return;
        }
      }
    });

    // Touch
    el.addEventListener('touchstart', e => {
      e.preventDefault();
      el.dispatchEvent(new MouseEvent('mousedown', { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }));
    });
    el.addEventListener('touchmove', e => {
      e.preventDefault();
      el.dispatchEvent(new MouseEvent('mousemove', { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }));
    });
    el.addEventListener('touchend', e => {
      e.preventDefault();
      el.dispatchEvent(new MouseEvent('mouseup', {}));
    });
  }

  setData(data) {
    const rect = this.container.getBoundingClientRect();
    this.nodes.length = 0;
    const newNodes = buildTree(data, rect.width, this.config.height, this.config);
    this.nodes.push(...newNodes);
    this.renderer.destroy();

    const rendererType = this.renderer instanceof CanvasRenderer ? 'canvas' : 'svg';
    if (rendererType === 'canvas') {
      this.renderer = new CanvasRenderer(this.container, this.nodes, this.config);
    } else {
      this.renderer = new SvgRenderer(this.container, this.nodes, this.config);
    }
  }

  getData() {
    return exportTree(this.nodes);
  }

  destroy() {
    this.renderer.destroy();
  }
}
