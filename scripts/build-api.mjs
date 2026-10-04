import { build } from '../web/node_modules/esbuild/lib/main.js';
await build({ entryPoints: ['src/deployment.ts'], outfile: '.server/deployment.mjs',
  bundle: true, platform: 'node', format: 'esm', target: 'node24', packages: 'external' });
