require('node:http').createServer((q,s)=>{s.statusCode=503;s.end('Unavailable')}).listen(3000,'0.0.0.0');
