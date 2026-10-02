const {spawn}=require('node:child_process');
const {once}=require('node:events');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const env={PATH:'/usr/local/bin:/usr/bin:/bin',NODE_PATH:'/usr/local/lib/node_modules',HOME:'/tmp',PORT:'3000',DB_PATH:'/tmp/row19-custom/app.db'};
const base='http://127.0.0.1:3000';
let child;
async function start(){
 child=spawn('/usr/local/bin/node',['/app/server.js'],{cwd:'/tmp',env,stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',b=>process.stdout.write(b)); child.stderr.on('data',b=>process.stdout.write(b));
 for(let n=0;n<100;n++){
   if(child.exitCode!==null) throw Error('control exited '+child.exitCode);
   try {const r=await fetch(base+'/api/snippets'); if(r.ok)return;}catch{}
   await new Promise(r=>setTimeout(r,100));
 }
 throw Error('control did not become ready');
}
async function stop(){ const p=child; child=null; p.kill('SIGTERM'); await once(p,'exit'); }
(async()=>{
 try {
  await start();
  const health=await fetch(base+'/api/health'); assert.equal(health.status,200);
  const page=await fetch(base+'/'); assert.equal(page.status,200);
  const empty=await (await fetch(base+'/api/snippets')).json(); assert.deepEqual(empty,[]);
  const create=await fetch(base+'/api/snippets',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:'Row19 retained record',filename:'row19.js',code:'console.log(19)'})});
  assert.equal(create.status,201); const saved=await create.json();
  assert.ok(fs.existsSync(env.DB_PATH)); assert.equal(fs.existsSync('/app/app.db'),false);
  await stop(); await start();
  const after=await (await fetch(base+'/api/snippets')).json(); assert.equal(after.length,1); assert.deepEqual(after[0],saved);
  const history=await (await fetch(base+'/api/snippets/'+saved.id+'/history')).json(); assert.equal(history.length,1); assert.equal(history[0].revision,1);
  console.log(JSON.stringify({control:'excluded copied node_modules only',cwd:'/tmp',DB_PATH:env.DB_PATH,health:health.status,page:page.status,initialRecords:empty.length,restartRecords:after.length,restartHistoryRows:history.length,defaultDatabaseAbsent:!fs.existsSync('/app/app.db'),result:'PASS'}));
 }finally{ if(child)await stop(); }
})().catch(e=>{console.error(e);process.exitCode=1});
