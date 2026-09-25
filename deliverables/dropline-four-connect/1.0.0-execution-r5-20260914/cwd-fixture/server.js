const http=require('node:http'),fs=require('node:fs');
const file=process.env.DB_PATH;
if(!fs.existsSync(file))fs.writeFileSync(file,'0');
http.createServer((req,res)=>{
 if(req.url==='/api/health'){res.end('ok');return;}
 if(req.url==='/increment'){fs.writeFileSync(file,String(Number(fs.readFileSync(file,'utf8'))+1));}
 try{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({cwd:process.cwd(),counter:Number(fs.readFileSync(file,'utf8')),page:fs.readFileSync('public/index.html','utf8').trim()}));}
 catch(e){res.statusCode=500;res.end(String(e));}
}).listen(3000,'0.0.0.0');
