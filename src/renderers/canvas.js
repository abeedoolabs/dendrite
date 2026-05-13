import { DendriteNode } from '../core/node.js';

export class CanvasRenderer {
  constructor(container, nodes, config) {
    this.config = config;
    this.nodes = nodes;
    this.container = container;

    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.cursor = 'grab';
    container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;

    // Interaction state (shared with InteractionManager via reference)
    this.mouse = { x: 0, y: 0 };
    this.creating = null;

    // Inline edit input
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.style.cssText = `
      position: absolute; display: none; z-index: 10;
      background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
      border-radius: 4px; color: ${config.colors.text}; text-align: center;
      font: 12px ui-monospace, monospace; padding: 4px 6px;
      outline: none; width: ${config.nodeW + 10}px;
    `;
    container.style.position = 'relative';
    container.appendChild(this.input);

    this.editing = null;
    this.input.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.stopEditing();
      if (e.key === 'Escape') { this.editing = null; this.input.style.display = 'none'; }
    });
    this.input.addEventListener('blur', () => this.stopEditing());

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this._animate();
  }

  get width() { return this.canvas.width / this.dpr; }
  get height() { return this.canvas.height / this.dpr; }
  get element() { return this.canvas; }

  resize() {
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = this.config.height * this.dpr;
    this.canvas.style.height = this.config.height + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  startEditing(node) {
    this.editing = node;
    this.input.style.display = 'block';
    this.input.style.left = (node.x - (this.config.nodeW + 10) / 2) + 'px';
    this.input.style.top = (node.y - 12) + 'px';
    this.input.value = node.label;
    this.input.focus();
    this.input.select();
  }

  stopEditing() {
    if (!this.editing) return;
    this.editing.label = this.input.value;
    this.editing = null;
    this.input.style.display = 'none';
  }

  hitTestBody(node, mx, my) {
    if (node.isRoot) {
      const dx = mx - node.x, dy = my - node.y;
      return dx * dx + dy * dy < this.config.rootR * this.config.rootR;
    }
    const hw = this.config.nodeW / 2, hh = this.config.nodeH / 2;
    return mx >= node.x - hw && mx <= node.x + hw &&
           my >= node.y - hh && my <= node.y + hh;
  }

  hitTestPlus(node, mx, my) {
    const p = this._plusPos(node);
    if (!p) return false;
    const dx = mx - p.x, dy = my - p.y;
    return dx * dx + dy * dy < (this.config.plusR + 2) * (this.config.plusR + 2);
  }

  _plusPos(node) {
    if (node.isRoot) return null;
    const { nodeW, spacing, plusR } = this.config;
    const px = node.isRight ? node.x + nodeW / 2 + spacing + plusR : node.x - nodeW / 2 - spacing - plusR;
    return { x: px, y: node.y };
  }

  addNode(node) { /* canvas redraws every frame, no DOM to create */ }
  setCreating(val) { this.creating = val; }
  setMouse(mx, my) { this.mouse.x = mx; this.mouse.y = my; }

  _animate() {
    this._draw();
    requestAnimationFrame(() => this._animate());
  }

  _draw() {
    const { ctx } = this;
    const w = this.width, h = this.height;
    const { colors, rootR, nodeW, nodeH, nodeR, ctrlDist, plusR, spacing } = this.config;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    // Creating preview bezier
    if (this.creating) {
      const p = this.creating.parent;
      const dir = this.mouse.x > p.x ? 1 : -1;
      const startX = p.isRoot ? p.x + dir * rootR : p.x + dir * nodeW / 2;
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(startX, p.y);
      ctx.bezierCurveTo(startX + ctrlDist * dir, p.y, this.mouse.x - ctrlDist * dir, this.mouse.y, this.mouse.x, this.mouse.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Draw nodes
    for (const node of this.nodes) {
      // Branch
      if (node.parent) {
        const p = node.parent;
        const dir = node.isRight ? 1 : -1;
        const startX = p.isRoot ? p.x + dir * rootR : p.x + dir * nodeW / 2;
        const endX = node.x - dir * nodeW / 2;

        ctx.strokeStyle = node.color;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(startX, p.y);
        ctx.bezierCurveTo(startX + ctrlDist * dir, p.y, endX - ctrlDist * dir, node.y, endX, node.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      if (node.isRoot) {
        // Root circle
        ctx.fillStyle = colors.text;
        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.arc(node.x, node.y, rootR, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.4;
        ctx.font = 'bold 11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label, node.x, node.y);
        ctx.globalAlpha = 1;
        continue;
      }

      const hovered = this.hitTestBody(node, this.mouse.x, this.mouse.y);

      // Body
      ctx.fillStyle = node.color;
      ctx.globalAlpha = hovered ? 1 : 0.75;
      ctx.beginPath();
      ctx.roundRect(node.x - nodeW / 2, node.y - nodeH / 2, nodeW, nodeH, nodeR);
      ctx.fill();
      ctx.globalAlpha = 1;

      if (hovered) {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(node.x - nodeW / 2, node.y - nodeH / 2, nodeW, nodeH, nodeR);
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = colors.text;
      ctx.font = '12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, node.x, node.y);

      // Plus button
      if ((hovered || this.hitTestPlus(node, this.mouse.x, this.mouse.y)) && !this._dragging) {
        const pp = this._plusPos(node);
        const ph = this.hitTestPlus(node, this.mouse.x, this.mouse.y);
        ctx.fillStyle = ph ? node.color : 'rgba(255,255,255,0.04)';
        ctx.strokeStyle = ph ? node.color : colors.stroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pp.x, pp.y, plusR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = ph ? colors.bg : colors.muted;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(pp.x - 4, pp.y);
        ctx.lineTo(pp.x + 4, pp.y);
        ctx.moveTo(pp.x, pp.y - 4);
        ctx.lineTo(pp.x, pp.y + 4);
        ctx.stroke();
      }
    }
  }

  destroy() {
    this.input.remove();
    this.canvas.remove();
  }
}
