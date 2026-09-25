const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

async function build() {
  const isProd = process.env.NODE_ENV === 'production';
  const publicDir = path.join(__dirname, 'public');
  
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Build TypeScript bundle
  console.log('Building browser TypeScript bundle with esbuild...');
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'frontend/src/index.ts')],
    bundle: true,
    outfile: path.join(publicDir, 'bundle.js'),
    sourcemap: true,
    minify: isProd,
    target: ['es2022'],
    platform: 'browser',
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    },
  });

  // 2. Copy and bundle CSS
  console.log('Copying and building CSS styles...');
  const mainCssSrc = path.join(__dirname, 'frontend/src/styles/main.css');
  if (fs.existsSync(mainCssSrc)) {
    const cssContent = fs.readFileSync(mainCssSrc, 'utf8');
    fs.writeFileSync(path.join(publicDir, 'styles.css'), cssContent, 'utf8');
    fs.writeFileSync(path.join(publicDir, 'bundle.css'), cssContent, 'utf8');
  }

  console.log('Build completed successfully.');
}

if (require.main === module) {
  build().catch((err) => {
    console.error('Build failed:', err);
    process.exit(1);
  });
}

module.exports = { build };
