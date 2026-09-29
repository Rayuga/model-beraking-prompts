// Deliberately benign generated fixtures; none of these files contains private data.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = '/tmp/cw-privacy-benign-project';
fs.mkdirSync(path.join(root, '.git'), {recursive:true});
for (const [name, text] of Object.entries({
  '.git/config':'benign generated repository metadata fixture\n',
  'app.db-wal':'benign generated database sidecar fixture\n',
  'package-lock.json':'{"name":"benign-generated-project","lockfileVersion":3}\n',
  'app.db':'benign generated database fixture\n',
  'server.js':'// benign generated server entry fixture\n',
  'package.json':'{"name":"benign-generated-project"}\n'
})) fs.writeFileSync(path.join(root,name), text);
const oldOnly = new Set(['/app.db','/server.js','/package.json']);
const client = `
document.querySelector('#asset-proof').textContent = 'Browser implementation asset loaded';
window.addEventListener('message', e => {
  if (e.source === document.querySelector('iframe').contentWindow && e.data && e.data.kind === 'fixture-console')
    document.querySelector('[role=log]').textContent += e.data.text + '\\n';
});
document.querySelector('#run').addEventListener('click', () => {
  const source=document.querySelector('textarea').value;
  document.querySelector('[role=log]').textContent='';
  const bootstrap='console.log=(...args)=>parent.postMessage({kind:"fixture-console",text:args.join(" ")},"*");';
  document.querySelector('iframe').srcdoc = '<!doctype html><html><body><script>'+bootstrap+source+'<'+ '/script></body></html>';
});
`;
function workspace(asset='/public/workspace.js') {
  return '<!doctype html><html><head><title>Benign privacy-control playground</title></head><body><h1>Privacy control playground</h1><p id="asset-proof"></p><label>Code editor<textarea aria-label="Code editor"></textarea></label><button id="run">Run</button><iframe title="Live preview" sandbox="allow-scripts"></iframe><pre role="log"></pre><script src="'+asset+'"></script></body></html>';
}
function start(port, mode) {
  return http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    const pathname=url.pathname;
    const asset=mode==='asset-overlap'?'/server.js':'/public/workspace.js';
    if (pathname===asset) {res.writeHead(200,{'Content-Type':'text/javascript'});res.end(client);return;}
    if (pathname==='/') {res.writeHead(200,{'Content-Type':'text/html'});res.end(workspace(asset));return;}
    if (mode==='deny-attachment') {res.writeHead(403,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="benign-denial"'});res.end('benign denial fixture');return;}
    if (mode==='no-content') {res.writeHead(204);res.end();return;}
    if (mode==='spa') {res.writeHead(200,{'Content-Type':'text/html'});res.end(workspace(asset));return;}
    if (mode==='redirect') {res.writeHead(302,{'Location':'/'});res.end();return;}
    if (mode==='old-only-deny' && !oldOnly.has(pathname)) {
      const file=path.join(root,pathname.replace(/^\//,''));
      if (file.startsWith(root+path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="benign-'+path.basename(file)+'"'});
        fs.createReadStream(file).pipe(res);return;
      }
    }
    res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not available');
  }).listen(port,'0.0.0.0');
}
for (const [port,mode] of [[3201,'old-only-deny'],[3202,'deny'],[3203,'spa'],[3204,'asset-overlap'],[3205,'redirect'],[3206,'deny-attachment'],[3207,'no-content']]) start(port,mode);
console.log('Benign privacy fixtures ready');
