export class InteractionManager {
  constructor(element, opts) {
    this.el = element;
    this.nodes = opts.nodes;
    this.config = opts.config;
    this.getWidth = opts.getWidth;
    this.getHeight = opts.getHeight;
    this.hitTestBody = opts.hitTestBody;   // (node, mx, my) => bool
    this.hitTestPlus = opts.hitTestPlus;   // (node, mx, my) => bool
    this.onUpdate = opts.onUpdate || (() => {});
    this.onNodeCreated = opts.onNodeCreated || (() => {});
    this.onStartEdit = opts.onStartEdit || (() => {});

    this.mouse = { x: 0, y: 0 };
    this.dragging = null;
    this.dragOffX = 0;
    this.dragOffY = 0;
    this.creating = null;

    this._bindEvents();
  }

  _getPos(e) {
    const rect = this.el.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    if (!src) return;
    this.mouse.x = src.clientX - rect.left;
    this.mouse.y = src.clientY - rect.top;
  }

  _bindEvents() {
    this.el.addEventListener('mousemove', e => {
      this._getPos(e);
      if (this.dragging) {
        const nx = this.mouse.x - this.dragOffX;
        const ny = this.mouse.y - this.dragOffY;
        this.dragging.move(nx - this.dragging.x, ny - this.dragging.y);

        if (this.dragging.parent && this.dragging.parent.isRoot) {
          const center = this.getWidth() / 2;
          if (this.dragging.isRight && this.dragging.x < center) {
            this.dragging.setDirection(false, this.config.colors);
          } else if (!this.dragging.isRight && this.dragging.x > center) {
            this.dragging.setDirection(true, this.config.colors);
          }
        }
        this.onUpdate();
      }
    });

    this.el.addEventListener('mousedown', e => {
      this._getPos(e);

      // Plus buttons first
      for (let i = this.nodes.length - 1; i >= 0; i--) {
        const n = this.nodes[i];
        if (!n.isRoot && this.hitTestPlus(n, this.mouse.x, this.mouse.y)) {
          this.creating = { parent: n };
          return;
        }
      }

      // Node drag
      for (let i = this.nodes.length - 1; i >= 0; i--) {
        const n = this.nodes[i];
        if (this.hitTestBody(n, this.mouse.x, this.mouse.y)) {
          this.dragging = n;
          this.dragOffX = this.mouse.x - n.x;
          this.dragOffY = this.mouse.y - n.y;
          return;
        }
      }
    });

    this.el.addEventListener('mouseup', e => {
      this._getPos(e);

      if (this.creating) {
        const parent = this.creating.parent;
        const isRight = this.mouse.x > this.getWidth() / 2;
        const color = isRight ? this.config.colors.primary : this.config.colors.secondary;

        const { DendriteNode } = require('./node.js');
        const n = new DendriteNode(this.mouse.x, this.mouse.y, color, parent, '');
        n.isRight = isRight;
        parent.children.push(n);
        this.nodes.push(n);
        this.creating = null;
        this.onNodeCreated(n);
        this.onStartEdit(n);
        return;
      }

      this.dragging = null;
      this.onUpdate();
    });

    this.el.addEventListener('dblclick', e => {
      this._getPos(e);
      for (let i = this.nodes.length - 1; i >= 0; i--) {
        const n = this.nodes[i];
        if (!n.isRoot && this.hitTestBody(n, this.mouse.x, this.mouse.y)) {
          this.onStartEdit(n);
          return;
        }
      }
    });

    // Touch
    this.el.addEventListener('touchstart', e => {
      e.preventDefault();
      this._getPos(e);
      this.el.dispatchEvent(new MouseEvent('mousedown', { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }));
    });
    this.el.addEventListener('touchmove', e => {
      e.preventDefault();
      this.el.dispatchEvent(new MouseEvent('mousemove', { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }));
    });
    this.el.addEventListener('touchend', e => {
      e.preventDefault();
      this.el.dispatchEvent(new MouseEvent('mouseup', {}));
    });
  }

  destroy() {
    // Could store and remove listeners, but for now the element removal handles it
  }
}
