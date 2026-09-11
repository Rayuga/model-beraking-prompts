import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { DEFAULT_USER_ID } from './ids.js';
import { handleError } from './errors.js';
import routes from './routes.js';
import './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const distDir = path.resolve(__dirname, '../public');
const manifestPath = path.resolve(__dirname, '../APP_MANIFEST.md');

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/APP_MANIFEST.md', (_req, res) => {
  if (!fs.existsSync(manifestPath)) return res.status(404).type('text').send('Manifest not found');
  return res.type('text/markdown').sendFile(manifestPath);
});

app.use('/api', routes);

app.use((error, _req, res, _next) => {
  if (error) return handleError(res, error);
  return res.status(500).json({ error: 'Internal server error' });
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res) => {
    if (req.path.startsWith('/api') || req.path === '/health' || req.path === '/APP_MANIFEST.md') {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`TorqueBay Enterprise listening on http://localhost:${port}`);
  console.log(`Open http://localhost:${port} in your browser.`);
  console.log(`Leave this terminal running. Default user: Nora Adler (${DEFAULT_USER_ID})`);
});

server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use.`);
    console.error(`If the app is already running, open http://localhost:${port}`);
    console.error(`Otherwise free it with: lsof -nP -iTCP:${port} -sTCP:LISTEN`);
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});
