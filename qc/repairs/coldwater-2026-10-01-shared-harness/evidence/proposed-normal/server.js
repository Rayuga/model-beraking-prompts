const http=require('node:http'),fs=require('node:fs');
let memory='empty';

http.createServer((q,s)=>{if(q.url==='/set')memory='volatile-marker';s.end(JSON.stringify({pid:process.pid,memory,durable:fs.readFileSync("/tmp/harness-proposal-controls/proposed-normal/durable.txt",'utf8')}));}).listen(3000,'0.0.0.0');
