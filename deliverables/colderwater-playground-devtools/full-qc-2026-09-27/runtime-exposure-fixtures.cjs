const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const dir='/tmp/cw-exposure-synthetic-20260927';fs.mkdirSync(dir,{recursive:true});
const doc='<!doctype html><html><head><title>Synthetic boundary fixture</title></head><body><label>Code editor<textarea aria-label="Code editor"></textarea></label><button id="run">Run</button><iframe title="Live preview"></iframe><pre role="log"></pre><script>document.querySelector("#run").onclick=()=>{const f=document.querySelector("iframe"),c=document.querySelector("textarea").value;new Function("document","console",c)(f.contentDocument,{log:(...x)=>document.querySelector("[role=log]").textContent+=x.join(" ")+"\\n"});};</script></body></html>';
fs.writeFileSync(path.join(dir,'index.html'),doc);
fs.writeFileSync(path.join(dir,'server.js'),"const http = require('node:http');\nhttp.createServer((req,res)=>res.end('synthetic only')).listen(3000);\n");
fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({name:'synthetic-runtime-only',version:'1.0.0',scripts:{start:'node server.js'},dependencies:{express:'5.1.0'}}));
fs.writeFileSync(path.join(dir,'app.db'),Buffer.concat([Buffer.from('SQLite format 3\0'),Buffer.alloc(1008)]));
for(const [port,mode]of[[3101,'whole-static'],[3102,'spa-200'],[3103,'denial'],[3104,'wrong-mime-leak'],[3105,'decoy']]){
 http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){res.setHeader('Content-Type','text/html');return res.end(doc);}
  if(!['/app.db','/server.js','/package.json'].includes(pathname)){res.writeHead(404);return res.end('Not found');}
  if(mode==='spa-200'){res.setHeader('Content-Type','application/octet-stream');return res.end(doc);}
  if(mode==='denial'){res.writeHead(403,{'Content-Type':'application/javascript'});return res.end(JSON.stringify({error:'not public',name:'Public denial',version:'1'}));}
  if(mode==='decoy'){res.setHeader('Content-Type','application/javascript');return res.end(pathname==='/server.js'?"// const http=require('node:http');http.createServer(()=>{}).listen(3000);\nconst example=\"require('node:http');http.createServer(()=>{}).listen(3000)\";":JSON.stringify({name:'Public badge',version:'2',message:'not a dependency manifest'}));}
  const file=path.join(dir,pathname.slice(1));res.setHeader('Content-Type',mode==='wrong-mime-leak'?'text/html':pathname.endsWith('.js')?'application/javascript':pathname.endsWith('.json')?'application/json':'application/octet-stream');res.end(fs.readFileSync(file));
 }).listen(port,'0.0.0.0',()=>console.log(mode+' '+port));
}
