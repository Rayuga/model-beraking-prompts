const http = require('node:http');
const fs = require('node:fs');
const mode = process.env.MOCK_MODE || 'inert';
if (!['inert', 'client-library'].includes(mode)) throw new Error('Unknown fixture mode');
const page = fs.readFileSync('/fixture/index.html', 'utf8').replace('__FIXTURE_MODE__', mode);
http.createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const json = (status, value) => { res.writeHead(status, {'content-type':'application/json','cache-control':'no-store'}); res.end(JSON.stringify(value)); };
  if (path === '/api/health') return json(200, {ok:true});
  if (path === '/api/snippets' && req.method === 'GET') return json(200, []);
  if (path.startsWith('/api/snippets/') && req.method === 'GET') return json(404, {error:'No snippet has been saved on this server.'});
  if (path === '/api/snippets' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    return req.on('end', () => {
      try { return json(201, {...JSON.parse(body), revision:1}); }
      catch { return json(400, {error:'Invalid JSON'}); }
    });
  }
  if (path === '/') { res.writeHead(200, {'content-type':'text/html','cache-control':'no-store'}); return res.end(page); }
  res.writeHead(404);res.end('Not found');
}).listen(3000, '0.0.0.0', () => console.log('QC fixture '+mode+' listening on3000; no server storage'));
