const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');

async function main() {
  await esbuild.build({
    entryPoints: [path.join(root, 'src', 'app.ts')],
    bundle: true,
    outfile: path.join(publicDir, 'app.js'),
    platform: 'browser',
    format: 'iife',
    globalName: 'PellmoorApp',
    target: ['es2020'],
    sourcemap: true,
    minify: false,
  });
  fs.copyFileSync(path.join(root, 'src', 'styles.css'), path.join(publicDir, 'styles.css'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
