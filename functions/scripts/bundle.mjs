// Bundle the function (including the @ping/shared workspace) into deploy/,
// with a package.json that lists only real npm dependencies for Cloud Build.
import { build } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
mkdirSync(new URL('../deploy', import.meta.url), { recursive: true });
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: 'deploy/index.js',
  external: Object.keys(pkg.dependencies),
});
writeFileSync(
  new URL('../deploy/package.json', import.meta.url),
  JSON.stringify({ name: 'ping-api', private: true, type: 'module', main: 'index.js', engines: pkg.engines, dependencies: pkg.dependencies }, null, 2) + '\n',
);
// Optional runtime settings (e.g. GEMINI_MODEL=...) – Firebase reads .env from the source dir.
if (existsSync(new URL('../.env', import.meta.url))) copyFileSync(new URL('../.env', import.meta.url), new URL('../deploy/.env', import.meta.url));
console.log('functions/deploy ready');
