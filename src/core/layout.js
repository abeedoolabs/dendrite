import { DendriteNode } from './node.js';

export const DEFAULT_CONFIG = {
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
    primary: '#7c5cff',
    secondary: '#2de2e6',
    bg: '#060812',
    text: '#e8eefc',
    muted: '#a9b6d8',
    stroke: 'rgba(255,255,255,0.1)'
  }
};

export function subtreeSize(items) {
  let total = 0;
  for (const item of items) {
    const kids = (typeof item === 'string') ? [] : (item.children || []);
    total += Math.max(1, subtreeSize(kids));
  }
  return Math.max(total, items.length);
}

export function layoutChildren(nodes, parent, children, isRight, centerY, config) {
  const { xOffset, ySpacing, colors } = config;
  const x = parent.x + (isRight ? 1 : -1) * xOffset;

  const totalSlots = subtreeSize(children);
  let yPos = centerY - (totalSlots - 1) * ySpacing / 2;

  for (const item of children) {
    const label = typeof item === 'string' ? item : (item.label || item.name || '');
    const kids = typeof item === 'string' ? [] : (item.children || []);
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

export function normalizeData(data) {
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
    return { label: '~/mind', children: roots };
  }

  return data;
}

export function buildTree(data, width, height, config) {
  const nodes = [];
  const cx = width / 2;
  const cy = height / 2;

  if (data) {
    data = normalizeData(data);
    const rootLabel = data.label || data.name || '~/mind';
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
    const root = new DendriteNode(cx, cy, config.colors.text, null, '~/mind');
    nodes.push(root);
    const defaultRight = ['projects', 'writing', 'math', 'climbing', 'music', 'ideas'];
    const defaultLeft = ['svelte', 'radish', 'ghost', 'quines', 'trees', 'tools'];
    layoutChildren(nodes, root, defaultRight, true, cy, config);
    layoutChildren(nodes, root, defaultLeft, false, cy, config);
  }

  return nodes;
}

export function exportTree(nodes) {
  const root = nodes.find(n => n.isRoot);
  if (!root) return null;

  function serialize(node) {
    const obj = { label: node.label };
    if (node.children.length) {
      obj.children = node.children.map(serialize);
    }
    return obj;
  }

  const rightKids = root.children.filter(c => c.isRight);
  const leftKids = root.children.filter(c => !c.isRight);

  return {
    label: root.label,
    right: rightKids.map(serialize),
    left: leftKids.map(serialize)
  };
}
