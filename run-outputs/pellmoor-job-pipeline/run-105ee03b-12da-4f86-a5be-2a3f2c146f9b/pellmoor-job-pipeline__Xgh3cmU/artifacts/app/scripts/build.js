import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const appDir = dirname(__dirname);

const buildDir = join(appDir, 'public');
const entryPoint = join(appDir, 'frontend', 'index.ts');

// Ensure public directory exists
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

const commonOptions = {
  bundle: true,
  minify: true,
  sourcemap: false,
  logLevel: 'info',
};

// Build JavaScript
esbuild
  .build({
    ...commonOptions,
    entryPoints: [entryPoint],
    outfile: join(buildDir, 'index.js'),
    target: 'es2020',
  })
  .catch(() => process.exit(1));
