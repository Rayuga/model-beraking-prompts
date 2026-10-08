'use strict';
// Bounded product-history observation; no database reads or task edits.
const fs=require('fs'),assert=require('assert/strict'),{spawn}=require('child_process');
const out='/evidence/audit-history-probe-offer';fs.mkdirSync(out,{recursive:true});const base='http://127.0.0.1:3062';let child,cookie,logs='';const sleep=n=>new Promise(r=>setTimeout(r,n));
async function api(url,body){const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(r.status,200);return {data:await r.json(),cookie:r.headers.get('set-cookie')};}
(async()=>{try{
 child=spawn('node',['/solution/app/server.js'],{env:{...process.env,PORT:'3062',DB_PATH:'/tmp/audit-history-probe.db'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await sleep(50);}
 const credentials={email:'rafael.costa@hireops.example',password:'Hireops!2026'};cookie=(await api('/api/auth/login',credentials)).cookie.split(';')[0];
 await api('/api/requisitions',{id:'HISTORY-ANCHOR',title:'Persistent audit anchor',dept:'Operations',budget_cents:10000});
 await api('/api/offers',{id:'HISTORY-OFFER',req_id:'HISTORY-ANCHOR',candidate:'Persistent hire',start_date:'2024-01-01',base_salary_cents:1000,signing_bonus_cents:0,relocation_cents:0,equity_units:0,equity_fair_cents:0,equity_strike_cents:0});
 cookie=(await api('/api/auth/login',{email:'yuki.tanaka@hireops.example',password:'Hireops!2026'})).cookie.split(';')[0];await api('/api/offers/HISTORY-OFFER/approve',{});
 const before=(await api('/api/bootstrap')).data;const line=before.audit.find(r=>r.subject==='HISTORY-OFFER'&&r.action==='OFFER_APPROVED');assert.ok(line);
 for(let i=0;i<101;i++)await Promise.all(Array.from({length:50},()=>api('/api/auth/login',credentials)));
 const after=(await api('/api/bootstrap')).data;
 const result={scope:'Finite golden product API observation, not configured judge score',extra_logins:5050,original_audit_line:line,anchor_record_retained:after.offers.some(r=>r.id==='HISTORY-OFFER'&&r.status==='COMMITTED'),original_audit_line_still_in_normal_audit_feed:after.audit.some(r=>r.id===line.id),audit_feed_rows:after.audit.length};
 fs.writeFileSync(out+'/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }catch(e){console.error(e.stack);process.exitCode=1;}finally{if(child)child.kill();fs.writeFileSync(out+'/server.log',logs);}})();
