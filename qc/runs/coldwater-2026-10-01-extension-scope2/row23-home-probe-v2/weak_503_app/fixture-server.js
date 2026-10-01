console.log(JSON.stringify({cmdline:process.argv.join(' '),env:Object.fromEntries(['HOME','PORT','DB_PATH','PATH','NODE_PATH'].map(k=>[k,process.env[k]]))}));
require('node:http').createServer((q,s)=>{s.statusCode=503;s.end('Unavailable')}).listen(3000,'0.0.0.0');
