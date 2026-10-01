'use strict';

const http = require('node:http');
const { Worker } = require('node:worker_threads');

// The listener stays independent of synchronous SQLite initialization and work.
// Both threads belong to the same Node process and share its shutdown lifecycle.
function start(entry) {
  let worker;
  let failure = null;
  let finish;
  const ready = new Promise(resolve => { finish = resolve; });
  const unavailable = res => {
    if (res.destroyed || res.writableEnded) return;
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'The workspace database is unavailable. Please try again.' }));
  };
  const server = http.createServer(async (req, res) => {
    const pathname = req.url.split('?')[0];
    if ((req.method === 'GET' || req.method === 'HEAD') && ['/api/health', '/health'].includes(pathname)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, service: 'hireops' }));
      return;
    }
    const port = await ready;
    if (res.destroyed || req.destroyed) return;
    if (failure || !port) return unavailable(res);
    const upstream = http.request({
      hostname: '127.0.0.1', port, method: req.method, path: req.url, headers: req.headers,
    }, response => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
      response.on('error', () => res.destroy());
    });
    upstream.on('error', () => {
      if (res.headersSent) res.destroy();
      else unavailable(res);
    });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
    req.pipe(upstream);
  });
  server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => {
    console.log(`[hireops] listening on ${server.address().port}`);
    worker = new Worker(entry, { env: { ...process.env, PORT: '0' } });
    worker.once('message', message => finish(message.port));
    worker.once('error', error => {
      failure = error;
      console.error('[hireops] workspace startup failed:', error.message);
      finish(null);
    });
    worker.once('exit', code => {
      failure = failure || new Error(`Workspace worker exited (${code})`);
      finish(null);
    });
  });
  server.on('close', () => { if (worker) worker.terminate(); });
  return server;
}

module.exports = { start };
