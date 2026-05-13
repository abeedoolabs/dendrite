import { DendriteNode } from '../core/node.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function bezierPath(x1, y1, x2, y2, ctrlDist, dir) {
  const cx1 = x1 + ctrlDist * dir;
  const cx2 = x2 - ctrlDist * dir;
  return `M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`;
}

export class SvgRenderer {
  constructor(container, nodes, config) {
    this.config = config;
    this.nodes = nodes;
    this.container = container;

    this.svg = svgEl('svg', {
      width: '100%',
      height: config.height,
      style: 'display:block;cursor:grab;'
    });
    container.appendChild(this.svg);
    container.style.position = 'relative';

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      .dendrite-node { cursor: grab; }
      .dendrite-node:active { cursor: grabbing; }
      .dendrite-node-body { transition: opacity 0.15s; opacity: 0.75; }
      .dendrite-node:hover .dendrite-node-body { opacity: 1; }
      .dendrite-node:hover .dendrite-node-border { opacity: 1; }
      .dendrite-node-border { opacity: 0; transition: opacity 0.15s; }
      .dendrite-plus { opacity: 0; transition: opacity 0.15s; cursor: pointer; }
      .dendrite-node:hover .dendrite-plus { opacity: 1; }
      .dendrite-plus:hover circle { fill-opacity: 1; }
      .dendrite-branch { fill: none; stroke-width: 1.5; opacity: 0.35; }
    `;
    container.appendChild(style);

    // Element maps
    this.nodeGroups = new Map();   // node -> <g>
    this.branchPaths = new Map();  // node -> <path>

    // Layers
    this.branchLayer = svgEl('g', { class: 'dendrite-branches' });
    this.nodeLayer = svgEl('g', { class: 'dendrite-nodes' });
    this.previewLayer = svgEl('g', { class: 'dendrite-preview' });
    this.svg.appendChild(this.branchLayer);
    this.svg.appendChild(this.nodeLayer);
    this.svg.appendChild(this.previewLayer);

    // Preview path for creating
    this.previewPath = svgEl('path', { class: 'dendrite-branch', stroke: 'white', d: '' });
    this.previewPath.style.display = 'none';
    this.previewLayer.appendChild(this.previewPath);

    // Interaction state
    this.mouse = { x: 0, y: 0 };
    this.creating = null;
    this.editing = null;

    this._buildAll();
  }

  get width() { return this.svg.getBoundingClientRect().width; }
  get height() { return this.config.height; }
  get element() { return this.svg; }

  resize() {
    // SVG is width:100%, auto-resizes
  }

  _buildAll() {
    this.branchLayer.innerHTML = '';
    this.nodeLayer.innerHTML = '';
    this.nodeGroups.clear();
    this.branchPaths.clear();

    for (const node of this.nodes) {
      if (node.parent) this._createBranch(node);
      this._createNodeGroup(node);
    }
  }

  _createBranch(node) {
    const path = svgEl('path', {
      class: 'dendrite-branch',
      stroke: node.color,
      d: this._branchPathD(node)
    });
    this.branchLayer.appendChild(path);
    this.branchPaths.set(node, path);
  }

  _branchPathD(node) {
    const p = node.parent;
    const dir = node.isRight ? 1 : -1;
    const { rootR, nodeW, ctrlDist } = this.config;
    const startX = p.isRoot ? p.x + dir * rootR : p.x + dir * nodeW / 2;
    const endX = node.x - dir * nodeW / 2;
    return bezierPath(startX, p.y, endX, node.y, ctrlDist, dir);
  }

  _createNodeGroup(node) {
    const { nodeW, nodeH, nodeR, rootR, plusR, spacing, colors } = this.config;
    const g = svgEl('g', { class: 'dendrite-node' });

    if (node.isRoot) {
      const circle = svgEl('circle', {
        cx: node.x, cy: node.y, r: rootR,
        fill: colors.text, 'fill-opacity': 0.15
      });
      const text = svgEl('text', {
        x: node.x, y: node.y,
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        fill: colors.text, 'fill-opacity': 0.4,
        'font-family': 'ui-monospace, monospace', 'font-size': 11, 'font-weight': 'bold'
      });
      text.textContent = node.label;
      g.appendChild(circle);
      g.appendChild(text);
    } else {
      // Body rect
      const rect = svgEl('rect', {
        class: 'dendrite-node-body',
        x: node.x - nodeW / 2, y: node.y - nodeH / 2,
        width: nodeW, height: nodeH, rx: nodeR,
        fill: node.color
      });
      // Hover border
      const border = svgEl('rect', {
        class: 'dendrite-node-border',
        x: node.x - nodeW / 2, y: node.y - nodeH / 2,
        width: nodeW, height: nodeH, rx: nodeR,
        fill: 'none', stroke: 'rgba(255,255,255,0.2)', 'stroke-width': 1
      });
      // Label
      const text = svgEl('text', {
        x: node.x, y: node.y,
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        fill: colors.text,
        'font-family': 'ui-monospace, monospace', 'font-size': 12
      });
      text.textContent = node.label;

      // Plus button
      const plusX = node.isRight ? node.x + nodeW / 2 + spacing + plusR : node.x - nodeW / 2 - spacing - plusR;
      const plusG = svgEl('g', { class: 'dendrite-plus' });
      const plusCircle = svgEl('circle', {
        cx: plusX, cy: node.y, r: plusR,
        fill: 'rgba(255,255,255,0.04)', stroke: colors.stroke, 'stroke-width': 1,
        'fill-opacity': 0.5
      });
      const plusH = svgEl('line', {
        x1: plusX - 4, y1: node.y, x2: plusX + 4, y2: node.y,
        stroke: colors.muted, 'stroke-width': 1.5
      });
      const plusV = svgEl('line', {
        x1: plusX, y1: node.y - 4, x2: plusX, y2: node.y + 4,
        stroke: colors.muted, 'stroke-width': 1.5
      });
      plusG.append(plusCircle, plusH, plusV);

      // Plus button click handler
      plusG.addEventListener('mousedown', e => {
        e.stopPropagation();
        this.setCreating({ parent: node });
      });

      g.append(rect, border, text, plusG);
    }

    this.nodeLayer.appendChild(g);
    this.nodeGroups.set(node, g);
  }

  updateNode(node) {
    const g = this.nodeGroups.get(node);
    if (!g) return;
    const { nodeW, nodeH, nodeR, rootR, plusR, spacing, colors } = this.config;

    if (node.isRoot) {
      const circle = g.querySelector('circle');
      const text = g.querySelector('text');
      circle.setAttribute('cx', node.x);
      circle.setAttribute('cy', node.y);
      text.setAttribute('x', node.x);
      text.setAttribute('y', node.y);
      text.textContent = node.label;
    } else {
      const rect = g.querySelector('.dendrite-node-body');
      const border = g.querySelector('.dendrite-node-border');
      const text = g.querySelector('text');
      rect.setAttribute('x', node.x - nodeW / 2);
      rect.setAttribute('y', node.y - nodeH / 2);
      rect.setAttribute('fill', node.color);
      border.setAttribute('x', node.x - nodeW / 2);
      border.setAttribute('y', node.y - nodeH / 2);
      text.setAttribute('x', node.x);
      text.setAttribute('y', node.y);
      text.textContent = node.label;

      // Update plus position
      const plusG = g.querySelector('.dendrite-plus');
      if (plusG) {
        const plusX = node.isRight ? node.x + nodeW / 2 + spacing + plusR : node.x - nodeW / 2 - spacing - plusR;
        const pc = plusG.querySelector('circle');
        const lines = plusG.querySelectorAll('line');
        pc.setAttribute('cx', plusX);
        pc.setAttribute('cy', node.y);
        lines[0].setAttribute('x1', plusX - 4); lines[0].setAttribute('y1', node.y);
        lines[0].setAttribute('x2', plusX + 4); lines[0].setAttribute('y2', node.y);
        lines[1].setAttribute('x1', plusX); lines[1].setAttribute('y1', node.y - 4);
        lines[1].setAttribute('x2', plusX); lines[1].setAttribute('y2', node.y + 4);
      }
    }

    // Update branch
    const path = this.branchPaths.get(node);
    if (path) {
      path.setAttribute('d', this._branchPathD(node));
      path.setAttribute('stroke', node.color);
    }

    // Update children branches (they reference this node as parent)
    for (const child of node.children) {
      this.updateNode(child);
    }
  }

  addNode(node) {
    if (node.parent) this._createBranch(node);
    this._createNodeGroup(node);
  }

  setCreating(val) {
    this.creating = val;
    if (val) {
      this.previewPath.style.display = '';
      this.previewPath.setAttribute('stroke', val.parent.color);
    } else {
      this.previewPath.style.display = 'none';
    }
  }

  setMouse(mx, my) {
    this.mouse.x = mx;
    this.mouse.y = my;
    if (this.creating) {
      const p = this.creating.parent;
      const dir = mx > p.x ? 1 : -1;
      const { rootR, nodeW, ctrlDist } = this.config;
      const startX = p.isRoot ? p.x + dir * rootR : p.x + dir * nodeW / 2;
      this.previewPath.setAttribute('d', bezierPath(startX, p.y, mx, my, ctrlDist, dir));
    }
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
    if (node.isRoot) return false;
    const { nodeW, spacing, plusR } = this.config;
    const px = node.isRight ? node.x + nodeW / 2 + spacing + plusR : node.x - nodeW / 2 - spacing - plusR;
    const dx = mx - px, dy = my - node.y;
    return dx * dx + dy * dy < (plusR + 2) * (plusR + 2);
  }

  startEditing(node) {
    this.editing = node;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = node.label;
    input.style.cssText = `
      position: absolute; z-index: 10;
      background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
      border-radius: 4px; color: ${this.config.colors.text}; text-align: center;
      font: 12px ui-monospace, monospace; padding: 4px 6px;
      outline: none; width: ${this.config.nodeW + 10}px;
      left: ${node.x - (this.config.nodeW + 10) / 2}px;
      top: ${node.y - 12}px;
    `;

    const finish = () => {
      node.label = input.value;
      this.updateNode(node);
      input.remove();
      this.editing = null;
    };

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') finish();
      if (e.key === 'Escape') { input.remove(); this.editing = null; }
    });
    input.addEventListener('blur', finish);

    this.container.appendChild(input);
    input.focus();
    input.select();
  }

  destroy() {
    this.svg.remove();
  }
}
