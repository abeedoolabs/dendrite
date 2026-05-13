import { build } from 'esbuild';

// ESM bundle
await build({
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/dendrite.esm.js',
});

// Standalone IIFE (for script tags / CDN)
await build({
  entryPoints: ['src/standalone.js'],
  bundle: true,
  format: 'iife',
  minify: true,
  outfile: 'dist/dendrite.min.js',
});

console.log('Built dist/dendrite.esm.js and dist/dendrite.min.js');
