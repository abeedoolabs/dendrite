# @abeedoo/dendrite

Interactive mind map visualization with Canvas and SVG renderers. Zero dependencies.

**[Live Demo](https://dendrite.abeedoo.com)** · **[npm](https://www.npmjs.com/package/@abeedoo/dendrite)** · **[GitHub](https://github.com/abeedoolabs/dendrite)**

Originally built with [Processing.js](https://github.com/meecect/dendriteJS) (2012), rewritten as a modern ES module with dual renderers.

## Install

```bash
npm install @abeedoo/dendrite
```

Or use a script tag:

```html
<script src="https://unpkg.com/@abeedoo/dendrite"></script>
```

## Quick Start

### Script tag (zero config)

```html
<div class="dendrite-svg" data-dendrite='{
  "label": "my project",
  "right": ["frontend", "backend", "docs"],
  "left": ["tests", "deploy", "monitoring"]
}'></div>

<script src="https://unpkg.com/@abeedoo/dendrite"></script>
```

The standalone build auto-discovers elements with `class="dendrite-svg"` or `data-dendrite` and initializes them.

### ES module

```js
import { Dendrite } from '@abeedoo/dendrite';

const map = new Dendrite('#my-container', {
  renderer: 'svg',  // or 'canvas'
  data: {
    label: 'root',
    right: [
      { label: 'code', children: ['frontend', 'backend'] },
      'docs'
    ],
    left: ['tests', 'deploy']
  }
});
```

### Svelte

```svelte
<script>
  import { DendriteMap } from '@abeedoo/dendrite/svelte';

  let data = {
    label: 'project',
    right: ['ui', 'api'],
    left: ['tests', 'infra']
  };
</script>

<DendriteMap {data} renderer="svg" height={500} />
```

## Data Formats

### Nested with explicit sides

```js
{
  label: 'root',
  right: [
    { label: 'parent', children: ['child1', 'child2'] },
    'leaf node'
  ],
  left: ['node a', 'node b']
}
```

### Nested with auto-split

```js
{
  label: 'root',
  children: ['a', 'b', 'c', 'd']  // first half right, second half left
}
```

### Flat adjacency list

```js
[
  { id: 'root', label: 'projects' },
  { id: 'web', parentId: 'root', label: 'web app' },
  { id: 'api', parentId: 'root', label: 'api' },
  { id: 'auth', parentId: 'api', label: 'auth service' }
]
```

String items in children arrays become leaf nodes.

## API

### `new Dendrite(container, options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `renderer` | `'svg'` \| `'canvas'` | `'svg'` | Rendering engine |
| `data` | `object` \| `array` | demo data | Tree data (any format above) |
| `height` | `number` | `500` | Canvas/SVG height in pixels |
| `colors` | `object` | theme defaults | Override colors (see below) |

### Methods

```js
map.getData()    // export tree as JSON (nested left/right format)
map.setData(d)   // reinitialize with new data
map.destroy()    // cleanup and remove elements
```

### Colors

```js
new Dendrite('#el', {
  colors: {
    primary: '#7c5cff',    // right-side nodes
    secondary: '#2de2e6',  // left-side nodes
    bg: '#060812',         // background (canvas only)
    text: '#e8eefc',       // labels
    muted: '#a9b6d8',      // secondary text
    stroke: 'rgba(255,255,255,0.1)' // borders
  }
});
```

## Interaction

- **Drag** nodes to reposition — children follow
- **Hover** a node to reveal the **+** button
- **Click + and drag** to create a child node (live bezier preview)
- **Double-click** a node to rename it inline
- Nodes **flip direction** (and color) when dragged across the center line

## Renderers

### SVG (default)

- Real DOM elements — text is selectable, accessible
- CSS hover transitions and `:hover` states for free
- Native inline editing via `<foreignObject>`
- No DPR scaling needed
- Best for most use cases

### Canvas

- `requestAnimationFrame` render loop
- Manual DPR scaling for crisp rendering
- Better for very large trees (500+ nodes)
- Overlay `<input>` for editing

## Build

```bash
npm install
npm run build   # outputs dist/dendrite.esm.js + dist/dendrite.min.js
```

## License

MIT — [Clifford Meece](https://cliffordmeece.com)
