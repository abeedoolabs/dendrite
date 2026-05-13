// src/core/node.js
var DendriteNode = class {
  constructor(x, y, color, parent, label) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.parent = parent;
    this.children = [];
    this.label = label || "";
    this.isRight = true;
    this.isRoot = parent === null;
  }
  move(dx, dy) {
    this.x += dx;
    this.y += dy;
    this.children.forEach((c) => c.move(dx, dy));
  }
  flipDirection(colors) {
    this.isRight = !this.isRight;
    this.color = this.isRight ? colors.primary : colors.secondary;
    this.children.forEach((c) => c.flipDirection(colors));
  }
  setDirection(isRight, colors) {
    if (this.isRight !== isRight) {
      if (this.parent) {
        const dx = this.x - this.parent.x;
        this.x = this.parent.x - dx;
        const shift = -2 * dx;
        this.children.forEach((c) => c._shiftX(shift));
      }
      this.isRight = isRight;
      this.color = isRight ? colors.primary : colors.secondary;
    }
    this.children.forEach((c) => c.setDirection(isRight, colors));
  }
  _shiftX(dx) {
    this.x += dx;
    this.children.forEach((c) => c._shiftX(dx));
  }
};

// src/core/layout.js
var DEFAULT_CONFIG = {
  xOffset: 160,
  ySpacing: 45,
  nodeW: 90,
  nodeH: 28,
  nodeR: 6,
  rootR: 24,
  plusR: 11,
  spacing: 10,
  ctrlDist: 60,
  height: 500,
  colors: {
    primary: "#7c5cff",
    secondary: "#2de2e6",
    bg: "#060812",
    text: "#e8eefc",
    muted: "#a9b6d8",
    stroke: "rgba(255,255,255,0.1)"
  }
};
function subtreeSize(items) {
  let total = 0;
  for (const item of items) {
    const kids = typeof item === "string" ? [] : item.children || [];
    total += Math.max(1, subtreeSize(kids));
  }
  return Math.max(total, items.length);
}
function layoutChildren(nodes, parent, children, isRight, centerY, config) {
  const { xOffset, ySpacing, colors } = config;
  const x = parent.x + (isRight ? 1 : -1) * xOffset;
  const totalSlots = subtreeSize(children);
  let yPos = centerY - (totalSlots - 1) * ySpacing / 2;
  for (const item of children) {
    const label = typeof item === "string" ? item : item.label || item.name || "";
    const kids = typeof item === "string" ? [] : item.children || [];
    const slots = Math.max(1, subtreeSize(kids));
    const nodeY = yPos + (slots - 1) * ySpacing / 2;
    const color = isRight ? colors.primary : colors.secondary;
    const n = new DendriteNode(x, nodeY, color, parent, label);
    n.isRight = isRight;
    parent.children.push(n);
    nodes.push(n);
    if (kids.length) {
      layoutChildren(nodes, n, kids, isRight, nodeY, config);
    }
    yPos += slots * ySpacing;
  }
}
function normalizeData(data) {
  if (data.left || data.right || data.children) return data;
  if (Array.isArray(data)) {
    const map = {};
    const roots = [];
    for (const item of data) {
      map[item.id] = { label: item.label || item.name || item.id, children: [] };
    }
    for (const item of data) {
      if (item.parentId && map[item.parentId]) {
        map[item.parentId].children.push(map[item.id]);
      } else {
        roots.push(map[item.id]);
      }
    }
    if (roots.length === 1) return roots[0];
    return { label: "~/mind", children: roots };
  }
  return data;
}
function buildTree(data, width, height, config) {
  const nodes = [];
  const cx = width / 2;
  const cy = height / 2;
  if (data) {
    data = normalizeData(data);
    const rootLabel = data.label || data.name || "~/mind";
    const root = new DendriteNode(cx, cy, config.colors.text, null, rootLabel);
    nodes.push(root);
    const left = data.left || [];
    const right = data.right || [];
    const children = data.children || [];
    if (left.length || right.length) {
      if (right.length) layoutChildren(nodes, root, right, true, cy, config);
      if (left.length) layoutChildren(nodes, root, left, false, cy, config);
    } else if (children.length) {
      const mid = Math.ceil(children.length / 2);
      layoutChildren(nodes, root, children.slice(0, mid), true, cy, config);
      layoutChildren(nodes, root, children.slice(mid), false, cy, config);
    }
  } else {
    const root = new DendriteNode(cx, cy, config.colors.text, null, "~/mind");
    nodes.push(root);
    const defaultRight = ["projects", "writing", "math", "climbing", "music", "ideas"];
    const defaultLeft = ["svelte", "radish", "ghost", "quines", "trees", "tools"];
    layoutChildren(nodes, root, defaultRight, true, cy, config);
    layoutChildren(nodes, root, defaultLeft, false, cy, config);
  }
  return nodes;
}
function exportTree(nodes) {
  const root = nodes.find((n) => n.isRoot);
  if (!root) return null;
  function serialize(node) {
    const obj = { label: node.label };
    if (node.children.length) {
      obj.children = node.children.map(serialize);
    }
    return obj;
  }
  const rightKids = root.children.filter((c) => c.isRight);
  const leftKids = root.children.filter((c) => !c.isRight);
  return {
    label: root.label,
    right: rightKids.map(serialize),
    left: leftKids.map(serialize)
  };
}

// src/renderers/canvas.js
var CanvasRenderer = class {
  constructor(container, nodes, config) {
    this.config = config;
    this.nodes = nodes;
    this.container = container;
    this.canvas = document.createElement("canvas");
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.cursor = "grab";
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.dpr = window.devicePixelRatio || 1;
    this.mouse = { x: 0, y: 0 };
    this.creating = null;
    this.input = document.createElement("input");
    this.input.type = "text";
    this.input.style.cssText = `
      position: absolute; display: none; z-index: 10;
      background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
      border-radius: 4px; color: ${config.colors.text}; text-align: center;
      font: 12px ui-monospace, monospace; padding: 4px 6px;
      outline: none; width: ${config.nodeW + 10}px;
    `;
    container.style.position = "relative";
    container.appendChild(this.input);
    this.editing = null;
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.stopEditing();
      if (e.key === "Escape") {
        this.editing = null;
        this.input.style.display = "none";
      }
    });
    this.input.addEventListener("blur", () => this.stopEditing());
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this._animate();
  }
  get width() {
    return this.canvas.width / this.dpr;
  }
  get height() {
    return this.canvas.height / this.dpr;
  }
  get element() {
    return this.canvas;
  }
  resize() {
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = this.config.height * this.dpr;
    this.canvas.style.height = this.config.height + "px";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
  startEditing(node) {
    this.editing = node;
    this.input.style.display = "block";
    this.input.style.left = node.x - (this.config.nodeW + 10) / 2 + "px";
    this.input.style.top = node.y - 12 + "px";
    this.input.value = node.label;
    this.input.focus();
    this.input.select();
  }
  stopEditing() {
    if (!this.editing) return;
    this.editing.label = this.input.value;
    this.editing = null;
    this.input.style.display = "none";
  }
  hitTestBody(node, mx, my) {
    if (node.isRoot) {
      const dx = mx - node.x, dy = my - node.y;
      return dx * dx + dy * dy < this.config.rootR * this.config.rootR;
    }
    const hw = this.config.nodeW / 2, hh = this.config.nodeH / 2;
    return mx >= node.x - hw && mx <= node.x + hw && my >= node.y - hh && my <= node.y + hh;
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
  setCreating(val) {
    this.creating = val;
  }
  setMouse(mx, my) {
    this.mouse.x = mx;
    this.mouse.y = my;
  }
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
    for (const node of this.nodes) {
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
        ctx.fillStyle = colors.text;
        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.arc(node.x, node.y, rootR, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.4;
        ctx.font = "bold 11px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node.label, node.x, node.y);
        ctx.globalAlpha = 1;
        continue;
      }
      const hovered = this.hitTestBody(node, this.mouse.x, this.mouse.y);
      ctx.fillStyle = node.color;
      ctx.globalAlpha = hovered ? 1 : 0.75;
      ctx.beginPath();
      ctx.roundRect(node.x - nodeW / 2, node.y - nodeH / 2, nodeW, nodeH, nodeR);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (hovered) {
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(node.x - nodeW / 2, node.y - nodeH / 2, nodeW, nodeH, nodeR);
        ctx.stroke();
      }
      ctx.fillStyle = colors.text;
      ctx.font = "12px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.label, node.x, node.y);
      if ((hovered || this.hitTestPlus(node, this.mouse.x, this.mouse.y)) && !this._dragging) {
        const pp = this._plusPos(node);
        const ph = this.hitTestPlus(node, this.mouse.x, this.mouse.y);
        ctx.fillStyle = ph ? node.color : "rgba(255,255,255,0.04)";
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
};

// src/renderers/svg.js
var SVG_NS = "http://www.w3.org/2000/svg";
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
var SvgRenderer = class {
  constructor(container, nodes, config) {
    this.config = config;
    this.nodes = nodes;
    this.container = container;
    this.svg = svgEl("svg", {
      width: "100%",
      height: config.height,
      style: "display:block;cursor:grab;"
    });
    container.appendChild(this.svg);
    container.style.position = "relative";
    const style = document.createElement("style");
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
    this.nodeGroups = /* @__PURE__ */ new Map();
    this.branchPaths = /* @__PURE__ */ new Map();
    this.branchLayer = svgEl("g", { class: "dendrite-branches" });
    this.nodeLayer = svgEl("g", { class: "dendrite-nodes" });
    this.previewLayer = svgEl("g", { class: "dendrite-preview" });
    this.svg.appendChild(this.branchLayer);
    this.svg.appendChild(this.nodeLayer);
    this.svg.appendChild(this.previewLayer);
    this.previewPath = svgEl("path", { class: "dendrite-branch", stroke: "white", d: "" });
    this.previewPath.style.display = "none";
    this.previewLayer.appendChild(this.previewPath);
    this.mouse = { x: 0, y: 0 };
    this.creating = null;
    this.editing = null;
    this._buildAll();
  }
  get width() {
    return this.svg.getBoundingClientRect().width;
  }
  get height() {
    return this.config.height;
  }
  get element() {
    return this.svg;
  }
  resize() {
  }
  _buildAll() {
    this.branchLayer.innerHTML = "";
    this.nodeLayer.innerHTML = "";
    this.nodeGroups.clear();
    this.branchPaths.clear();
    for (const node of this.nodes) {
      if (node.parent) this._createBranch(node);
      this._createNodeGroup(node);
    }
  }
  _createBranch(node) {
    const path = svgEl("path", {
      class: "dendrite-branch",
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
    const g = svgEl("g", { class: "dendrite-node" });
    if (node.isRoot) {
      const circle = svgEl("circle", {
        cx: node.x,
        cy: node.y,
        r: rootR,
        fill: colors.text,
        "fill-opacity": 0.15
      });
      const text = svgEl("text", {
        x: node.x,
        y: node.y,
        "text-anchor": "middle",
        "dominant-baseline": "central",
        fill: colors.text,
        "fill-opacity": 0.4,
        "font-family": "ui-monospace, monospace",
        "font-size": 11,
        "font-weight": "bold"
      });
      text.textContent = node.label;
      g.appendChild(circle);
      g.appendChild(text);
    } else {
      const rect = svgEl("rect", {
        class: "dendrite-node-body",
        x: node.x - nodeW / 2,
        y: node.y - nodeH / 2,
        width: nodeW,
        height: nodeH,
        rx: nodeR,
        fill: node.color
      });
      const border = svgEl("rect", {
        class: "dendrite-node-border",
        x: node.x - nodeW / 2,
        y: node.y - nodeH / 2,
        width: nodeW,
        height: nodeH,
        rx: nodeR,
        fill: "none",
        stroke: "rgba(255,255,255,0.2)",
        "stroke-width": 1
      });
      const text = svgEl("text", {
        x: node.x,
        y: node.y,
        "text-anchor": "middle",
        "dominant-baseline": "central",
        fill: colors.text,
        "font-family": "ui-monospace, monospace",
        "font-size": 12
      });
      text.textContent = node.label;
      const plusX = node.isRight ? node.x + nodeW / 2 + spacing + plusR : node.x - nodeW / 2 - spacing - plusR;
      const plusG = svgEl("g", { class: "dendrite-plus" });
      const plusCircle = svgEl("circle", {
        cx: plusX,
        cy: node.y,
        r: plusR,
        fill: "rgba(255,255,255,0.04)",
        stroke: colors.stroke,
        "stroke-width": 1,
        "fill-opacity": 0.5
      });
      const plusH = svgEl("line", {
        x1: plusX - 4,
        y1: node.y,
        x2: plusX + 4,
        y2: node.y,
        stroke: colors.muted,
        "stroke-width": 1.5
      });
      const plusV = svgEl("line", {
        x1: plusX,
        y1: node.y - 4,
        x2: plusX,
        y2: node.y + 4,
        stroke: colors.muted,
        "stroke-width": 1.5
      });
      plusG.append(plusCircle, plusH, plusV);
      plusG.addEventListener("mousedown", (e) => {
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
      const circle = g.querySelector("circle");
      const text = g.querySelector("text");
      circle.setAttribute("cx", node.x);
      circle.setAttribute("cy", node.y);
      text.setAttribute("x", node.x);
      text.setAttribute("y", node.y);
      text.textContent = node.label;
    } else {
      const rect = g.querySelector(".dendrite-node-body");
      const border = g.querySelector(".dendrite-node-border");
      const text = g.querySelector("text");
      rect.setAttribute("x", node.x - nodeW / 2);
      rect.setAttribute("y", node.y - nodeH / 2);
      rect.setAttribute("fill", node.color);
      border.setAttribute("x", node.x - nodeW / 2);
      border.setAttribute("y", node.y - nodeH / 2);
      text.setAttribute("x", node.x);
      text.setAttribute("y", node.y);
      text.textContent = node.label;
      const plusG = g.querySelector(".dendrite-plus");
      if (plusG) {
        const plusX = node.isRight ? node.x + nodeW / 2 + spacing + plusR : node.x - nodeW / 2 - spacing - plusR;
        const pc = plusG.querySelector("circle");
        const lines = plusG.querySelectorAll("line");
        pc.setAttribute("cx", plusX);
        pc.setAttribute("cy", node.y);
        lines[0].setAttribute("x1", plusX - 4);
        lines[0].setAttribute("y1", node.y);
        lines[0].setAttribute("x2", plusX + 4);
        lines[0].setAttribute("y2", node.y);
        lines[1].setAttribute("x1", plusX);
        lines[1].setAttribute("y1", node.y - 4);
        lines[1].setAttribute("x2", plusX);
        lines[1].setAttribute("y2", node.y + 4);
      }
    }
    const path = this.branchPaths.get(node);
    if (path) {
      path.setAttribute("d", this._branchPathD(node));
      path.setAttribute("stroke", node.color);
    }
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
      this.previewPath.style.display = "";
      this.previewPath.setAttribute("stroke", val.parent.color);
    } else {
      this.previewPath.style.display = "none";
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
      this.previewPath.setAttribute("d", bezierPath(startX, p.y, mx, my, ctrlDist, dir));
    }
  }
  hitTestBody(node, mx, my) {
    if (node.isRoot) {
      const dx = mx - node.x, dy = my - node.y;
      return dx * dx + dy * dy < this.config.rootR * this.config.rootR;
    }
    const hw = this.config.nodeW / 2, hh = this.config.nodeH / 2;
    return mx >= node.x - hw && mx <= node.x + hw && my >= node.y - hh && my <= node.y + hh;
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
    const input = document.createElement("input");
    input.type = "text";
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
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") finish();
      if (e.key === "Escape") {
        input.remove();
        this.editing = null;
      }
    });
    input.addEventListener("blur", finish);
    this.container.appendChild(input);
    input.focus();
    input.select();
  }
  destroy() {
    this.svg.remove();
  }
};

// src/dendrite.js
var Dendrite = class {
  constructor(container, options = {}) {
    if (typeof container === "string") {
      container = document.querySelector(container);
    }
    this.container = container;
    this.config = {
      ...DEFAULT_CONFIG,
      height: options.height || DEFAULT_CONFIG.height,
      colors: { ...DEFAULT_CONFIG.colors, ...options.colors || {} }
    };
    const rect = container.getBoundingClientRect();
    this.nodes = buildTree(options.data || null, rect.width, this.config.height, this.config);
    const rendererType = options.renderer || "svg";
    if (rendererType === "canvas") {
      this.renderer = new CanvasRenderer(container, this.nodes, this.config);
    } else {
      this.renderer = new SvgRenderer(container, this.nodes, this.config);
    }
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
    el.addEventListener("mousemove", (e) => {
      const pos = getPos(e);
      r.setMouse(pos.x, pos.y);
      if (dragging) {
        const nx = pos.x - dragOffX;
        const ny = pos.y - dragOffY;
        dragging.move(nx - dragging.x, ny - dragging.y);
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
    el.addEventListener("mousedown", (e) => {
      const pos = getPos(e);
      if (!(r instanceof SvgRenderer)) {
        for (let i = this.nodes.length - 1; i >= 0; i--) {
          const n = this.nodes[i];
          if (!n.isRoot && r.hitTestPlus(n, pos.x, pos.y)) {
            r.setCreating({ parent: n });
            return;
          }
        }
      }
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
    el.addEventListener("mouseup", (e) => {
      const pos = getPos(e);
      const creating = r.creating;
      if (creating) {
        const parent = creating.parent;
        const isRight = pos.x > r.width / 2;
        const color = isRight ? this.config.colors.primary : this.config.colors.secondary;
        const n = new DendriteNode(pos.x, pos.y, color, parent, "");
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
    el.addEventListener("dblclick", (e) => {
      const pos = getPos(e);
      for (let i = this.nodes.length - 1; i >= 0; i--) {
        const n = this.nodes[i];
        if (!n.isRoot && r.hitTestBody(n, pos.x, pos.y)) {
          r.startEditing(n);
          return;
        }
      }
    });
    el.addEventListener("touchstart", (e) => {
      e.preventDefault();
      el.dispatchEvent(new MouseEvent("mousedown", { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }));
    });
    el.addEventListener("touchmove", (e) => {
      e.preventDefault();
      el.dispatchEvent(new MouseEvent("mousemove", { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }));
    });
    el.addEventListener("touchend", (e) => {
      e.preventDefault();
      el.dispatchEvent(new MouseEvent("mouseup", {}));
    });
  }
  setData(data) {
    const rect = this.container.getBoundingClientRect();
    this.nodes.length = 0;
    const newNodes = buildTree(data, rect.width, this.config.height, this.config);
    this.nodes.push(...newNodes);
    this.renderer.destroy();
    const rendererType = this.renderer instanceof CanvasRenderer ? "canvas" : "svg";
    if (rendererType === "canvas") {
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
};
export {
  CanvasRenderer,
  DEFAULT_CONFIG,
  Dendrite,
  DendriteNode,
  SvgRenderer,
  buildTree,
  exportTree,
  normalizeData
};
