import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import routes from './routes.js';
import { handleError } from './errors.js';
import { ingestWebhook } from './stripe.js';
import './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const distDir = path.resolve(__dirname, '../dist');

// /health responds immediately — never waits on any integration.
app.get('/health', (_req, res) => res.json({ ok: true }));

// Stripe webhook — UNAUTHENTICATED (verified by signature), raw body required so
// the HMAC is computed over the exact bytes. Mounted BEFORE express.json.
app.post('/api/stripe/webhook', express.raw({ type: '*/*', limit: '1mb' }), (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
  const sig = req.header('Stripe-Signature') || req.header('stripe-signature');
  try {
    return res.json(ingestWebhook(raw, sig));
  } catch (_err) {
    return res.status(400).json({ error: 'Webhook signature verification failed', code: 'WEBHOOK_SIGNATURE_INVALID' });
  }
});

app.use(express.json({ limit: '1mb' }));
app.use('/api', routes);

app.use((error, _req, res, _next) => {
  if (error) return handleError(res, error);
  return res.status(500).json({ error: 'Internal server error' });
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res) => {
    if (req.path.startsWith('/api') || req.path === '/health') return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`MedLedger listening on http://localhost:${port}`);
});
server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') { console.error(`Port ${port} is already in use.`); process.exit(1); }
  console.error(error);
  process.exit(1);
});
