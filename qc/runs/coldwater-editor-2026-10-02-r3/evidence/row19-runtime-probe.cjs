'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {spawn, spawnSync} = require('node:child_process');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const source = '/frozen-solution';
const digest = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let child;
function command(name, args) {
  console.log('COMMAND', JSON.stringify([name, ...args]));
  const result = spawnSync(name, args, {cwd:'/tmp', encoding:'utf8'});
  if(result.stdout) console.log(result.stdout);
  if(result.stderr) console.log(result.stderr);
  console.log('EXIT',result.status);
  assert.equal(result.status,0);
}
async function stop() {
  if (!child) return;
  const old = child;
  child = null;
  if(old.exitCode !== null) return;
  old.kill('SIGTERM');
  const exited = new Promise(resolve => old.once('exit',resolve));
  await Promise.race([exited,delay(2000)]);
  if(old.exitCode === null && old.signalCode === null) {old.kill('SIGKILL'); await exited;}
  console.log('STOPPED',old.pid,old.exitCode,old.signalCode);
}
async function start(dbPath, entry='/app/server.js') {
  const args=['-i','PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    'NODE_PATH=/usr/local/lib/node_modules','HOME=/tmp','PORT=3000'];
  if(dbPath) args.push('DB_PATH='+dbPath);
  args.push('setpriv','--reuid=65534','--regid=65534','--clear-groups','node',entry);
  console.log('START',JSON.stringify({cwd:'/tmp',command:['env',...args]}));
  child=spawn('env',args,{cwd:'/tmp',stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',d=>process.stdout.write(d));
  child.stderr.on('data',d=>process.stdout.write(d));
  for(let i=0;i<50;i++) {
    assert.equal(child.exitCode,null,'app exited during startup');
    try {
      const h=await fetch('http://127.0.0.1:3000/api/health');
      const list=await fetch('http://127.0.0.1:3000/api/snippets');
      if(h.ok && list.ok) {console.log('READY',JSON.stringify({pid:child.pid,health:await h.json(),snippets:await list.json()})); return;}
    } catch {}
    await delay(100);
  }
  throw new Error('startup timeout');
}
async function request(route, method='GET', body) {
  const r=await fetch('http://127.0.0.1:3000'+route,{method,headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  assert.ok(r.ok,route+' '+r.status);
  return r.json();
}
(async()=>{
  console.log('PROVENANCE',JSON.stringify({node:process.version,solve:digest(source+'/solve.sh'),server:digest(source+'/app/server.js')}));
  const sh=fs.readFileSync(source+'/solve.sh');
  assert.ok(sh.toString().startsWith('#!/bin/bash\n'));
  assert.equal(sh.includes(13),false);
  command('bash',['-n',source+'/solve.sh']);
  command('bash',[source+'/solve.sh']);
  command('bash',[source+'/solve.sh']);
  assert.equal(digest('/app/server.js'),digest(source+'/app/server.js'));
  assert.equal(fs.existsSync('/tests'),false);
  assert.equal(fs.existsSync('/logs/verifier'),false);
  assert.equal(fs.existsSync('/solution'),false);
  command('chown',['-R','65534:65534','/app']);
  await start();
  const page=await fetch('http://127.0.0.1:3000/');
  assert.equal(page.status,200);
  const html=await page.text();
  for(const url of [...html.matchAll(/(?:src|href)="([^\"]+)"/g)].map(m=>m[1])) {
    const asset=await fetch('http://127.0.0.1:3000'+url);
    assert.equal(asset.status,200);
    assert.ok((await asset.arrayBuffer()).byteLength>0);
    console.log('ASSET_OK',url);
  }
  assert.ok(fs.existsSync('/app/app.db'));
  assert.deepEqual(await request('/api/snippets'),[]);
  const defaultRecord=await request('/api/snippets','POST',{title:'Row19 default',filename:'default.js',code:'console.log(19)'});
  await stop();
  await start();
  assert.equal((await request('/api/snippets')).length,1);
  assert.equal((await request('/api/snippets/'+defaultRecord.id)).code,'console.log(19)');
  assert.equal((await request('/api/snippets/'+defaultRecord.id+'/history')).length,1);
  await stop();
  const db='/tmp/row19-custom.db';
  await start(db);
  assert.deepEqual(await request('/api/snippets'),[]);
  const custom=await request('/api/snippets','POST',{title:'Row19 custom',filename:'custom.js',code:'console.log(190)'});
  const updated=await request('/api/snippets/'+custom.id,'PUT',{...custom,code:'console.log(191)'});
  assert.equal(updated.revision,2);
  await stop();
  command('cp',['-a','/app','/tmp/row19-app-copy']);
  for(let i=0;i<2;i++) {
    await start(db,'/tmp/row19-app-copy/server.js');
    const list=await request('/api/snippets');
    assert.equal(list.length,1);
    assert.equal(list[0].title,'Row19 custom');
    assert.equal(list[0].code,'console.log(191)');
    const history=await request('/api/snippets/'+custom.id+'/history');
    assert.deepEqual(history.map(r=>r.revision),[2,1]);
    await stop();
  }
  console.log('RESULT',JSON.stringify({bashSyntax:true,LF:true,repeatedInstall:true,installedBytesMatch:true,
    forbiddenPathsUntouched:true,outsideWorkingDirectory:true,unprivilegedLaunch:true,rootAndBuiltAssets:true,
    defaultDatabase:true,DB_PATHIsolation:true,alternateWritableCopy:true,processRestartPersistence:true,idempotentSchemaAndHistory:true}));
})().catch(async error=>{console.error(error);await stop();process.exitCode=1;});
