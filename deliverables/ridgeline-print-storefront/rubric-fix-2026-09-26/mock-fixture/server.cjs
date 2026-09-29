const http = require('node:http');
const fs = require('node:fs');
const seed = JSON.parse(fs.readFileSync('/inputs/seed_data.json', 'utf8'));
const html = fs.readFileSync('/fixture/index.html');
function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:3000');
  if (url.pathname === '/api/health') return json(res, 200, { ok: true });
  if (url.pathname === '/api/prints') return json(res, 200, { variants: seed.variants });
  if (url.pathname === '/api/orders' && req.method === 'POST') {
    req.resume();
    req.on('end', () => json(res, 200, { accepted: true }));
    return;
  }
  if (url.pathname.startsWith('/api/orders/')) return json(res, 404, { error: 'No persisted order exists.' });
  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
    return res.end(html);
  }
  return json(res, 404, { error: 'Not found' });
}).listen(3000, '0.0.0.0');
