const A=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
(async()=>{
const root='http://127.0.0.1:3000';
async function request(path,body){const r=await fetch(root+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','Connection':'close'},...(body?{body:JSON.stringify(body)}:{})});A(r.ok,await r.clone().text());return r.json();}
const db=fs.readFileSync('/logs/verifier/app-db','utf8').trim();
A.equal(db,'/tmp/gambit-submission/gambit.db');A.equal(fs.existsSync('/app/gambit.db'),false);
A.match(fs.readFileSync('/app/APP_MANIFEST.md','utf8'),/DB_PATH/);
const fd=fs.openSync(db,'r'),head=Buffer.alloc(16);fs.readSync(fd,head,0,16,0);fs.closeSync(fd);A.equal(head.toString(),'SQLite format 3\0');
A.equal((await request('/api/health')).ok,true);
A.equal((await request('/api/score',{hand:['5S','5H','5D','JC'],cut:'5C',crib:false})).total,29);
const game=await request('/api/games',{practice:'pegging',start_scores:{a:0,b:0}});
await request('/api/games/'+game.id+'/discard',{seat:'a',cards:['4S','6D']});
const a=await request('/api/games/'+game.id+'?seat=a'),b=await request('/api/games/'+game.id+'?seat=b'),ladder=await request('/api/ladder');
for(let i=0;i<2;i++){execFileSync('bash',['/tests/app-lifecycle.sh','restart']);A.deepEqual(await request('/api/games/'+game.id+'?seat=a'),a);A.deepEqual(await request('/api/games/'+game.id+'?seat=b'),b);A.deepEqual(await request('/api/ladder'),ladder);}
const next=await request('/api/games/'+game.id+'/discard',{seat:'b',cards:['8C','KD']});A.equal(next.phase,'cut');
fs.writeFileSync('/evidence/readonly-fallback-results.json',JSON.stringify({passed:true,app_mount:'read-only',active_database:db,default_database_absent:true,sqlite_signature:true,bench_total:29,process_restarts:2,seat_state_and_ladder_preserved:true,legal_continuation:true},null,2));
console.log('PASS read-only app fallback, active SQLite path, two restarts and legal continuation');
})().catch(e=>{console.error(e);process.exitCode=1;});
