const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files=[];
function walk(dir){for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);if(fs.statSync(p).isDirectory())walk(p);else files.push(p);}}
walk('/keyboard-build/src');walk('/keyboard-build/public');
for(const p of ['package.json','package-lock.json','vite.config.mjs','index.html'])files.push('/keyboard-build/'+p);
const report={node:process.version,vite:require('/keyboard-build/node_modules/vite/package.json').version,typescript:require('/keyboard-build/node_modules/typescript/package.json').version,command:'npm ci --ignore-scripts --no-audit --no-fund && npm run build',inputsAndOutputs:Object.fromEntries(files.map(p=>[path.relative('/keyboard-build',p),hash(p)]))};
fs.writeFileSync('/work/keyboard-built-inputs.json',JSON.stringify(report,null,2)+'\n');
