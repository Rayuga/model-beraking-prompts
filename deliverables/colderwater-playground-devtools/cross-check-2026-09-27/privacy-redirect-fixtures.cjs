const http = require('node:http');
const doc = '<!doctype html><html><body><label>Code editor<textarea aria-label="Code editor"></textarea></label><button id="run">Run</button><iframe title="Live preview"></iframe><pre role="log"></pre><script>document.querySelector("#run").onclick=()=>{const f=document.querySelector("iframe"),c=document.querySelector("textarea").value;new Function("document","console",c)(f.contentDocument,{log:(...x)=>document.querySelector("[role=log]").textContent+=x.join(" ")+"\\n"});};</script></body></html>';
const paths = ['/app.db', '/server.js', '/package.json'];
const bodies = {
  '/app.db': Buffer.concat([Buffer.from('SQLite format 3\0'), Buffer.alloc(1008)]),
  '/server.js': "const http=require('node:http');http.createServer((req,res)=>res.end('synthetic')).listen(3000);",
  '/package.json': JSON.stringify({name:'synthetic-private-runtime',scripts:{start:'node server.js'},dependencies:{express:'5.1.0'}})
};
let externalHits = 0;
for (const [port,mode] of [[3201,'same-origin-safe'],[3202,'same-origin-leak'],[3203,'off-origin-safe'],[3204,'redirect-loop'],[3205,'transport-failure'],[3206,'direct-leak'],[3207,'redirect-hop-limit']]) {
  http.createServer((req,res)=>{
    const path = new URL(req.url,'http://localhost').pathname;
    if(path==='/'){res.setHeader('Content-Type','text/html');return res.end(doc);}
    if(path==='/observations'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({externalHits}));}
    if(mode==='transport-failure' && path==='/server.js')return req.socket.destroy();
    if(paths.includes(path)){
      if(mode==='same-origin-safe'){res.writeHead(302,{Location:'/safe-fallback'});return res.end('');}
      if(mode==='same-origin-leak'){res.writeHead(307,{Location:'/runtime'+path});return res.end('');}
      if(mode==='off-origin-safe'){res.writeHead(302,{Location:'http://localhost:3299/public-help'});return res.end('');}
      if(mode==='redirect-loop'){res.writeHead(302,{Location:'/redirect'+path});return res.end('');}
      if(mode==='redirect-hop-limit'){res.writeHead(302,{Location:'/hop/1'+path});return res.end('');}
      if(mode==='direct-leak'){res.writeHead(200,{'Content-Type':'text/plain'});return res.end(bodies[path]);}
      res.writeHead(404);return res.end('Not public');
    }
    if(path==='/safe-fallback'){res.setHeader('Content-Type','text/html');return res.end(doc);}
    if(mode==='same-origin-leak' && path.startsWith('/runtime')){res.setHeader('Content-Type','text/plain');return res.end(bodies[path.slice(8)]);}
    if(mode==='redirect-loop' && path.startsWith('/redirect')){res.writeHead(302,{Location:path.slice(9)});return res.end('');}
    if(mode==='redirect-hop-limit' && path.startsWith('/hop/')){const m=path.match(/^\/hop\/(\d+)(\/.*)$/);res.writeHead(302,{Location:'/hop/'+(Number(m[1])+1)+m[2]});return res.end('');}
    res.writeHead(404);res.end('Not found');
  }).listen(port,'127.0.0.1');
}
http.createServer((req,res)=>{externalHits++;res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body>Public help</body></html>');}).listen(3299,'127.0.0.1');
console.log('Synthetic redirect fixtures ready');
