const fs = require('node:fs');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const results = {kind:'Isolated diagnostic browser checks; no LLM judge or replacement benchmark score',cases:[],errors:[]};
const base='http://127.0.0.1:3000';
let browser;
function save(){fs.writeFileSync('/evidence/browser-results.json',JSON.stringify(results,null,2));}
async function waitReady(){for(let i=0;i<100;i++){try{const r=await fetch(base+'/api/health');if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Server did not become healthy');}
async function run(kind){
 const log=fs.openSync('/evidence/'+kind+'-server.log','w');
 const server=spawn('node',['serve.js'],{cwd:'/evidence/'+kind,env:{...process.env,DB_PATH:'/tmp/'+kind+'-'+Date.now()+'.db'},stdio:['ignore',log,log]});
 const ctx=await browser.newContext({viewport:{width:1280,height:800}});
 const page=await ctx.newPage();page.setDefaultTimeout(10000);
 page.on('pageerror',e=>results.errors.push({kind,type:'pageerror',message:e.message}));
 page.on('response',r=>{if(r.status()>=400)results.errors.push({kind,type:'http',status:r.status(),url:r.url()});});
 async function ready(){await page.waitForFunction(()=>!document.querySelector('#createGameButton').disabled);}
 async function readGame(id,seat='A'){const r=await ctx.request.get(base+'/api/games/'+id+'?seat='+seat);assert.equal(r.status(),200);return (await r.json()).game;}
 async function changeSeat(s){const res=page.waitForResponse(r=>r.url().includes('/api/bootstrap?')&&r.request().method()==='GET');await page.locator('.seat-button[data-seat="'+s+'"]').click();await res;await ready();}
 async function selectCard(code){await page.locator('#handArea .card-button[data-card="'+code+'"]').click();}
 async function action(button){const w=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/actions'));await page.locator(button).click();const r=await w;assert.equal(r.status(),200,await r.text());await ready();}
 try{
  await waitReady();await page.goto(base);await ready();
  const initialMembers=await page.locator('#memberA option').count();
  results.cases.push({kind,check:'Fresh seed database initial browser load',passed:initialMembers>0,memberOptions:initialMembers,note:initialMembers?'':'Independent original defect: auto-opening historical G-1181 returns HTTP500 before selector population; not patched.'});
  await page.screenshot({path:'/evidence/'+kind+'-fresh-seed.png',fullPage:true});
  if(!initialMembers){
   const setup=await ctx.request.post(base+'/api/games',{data:{actionId:'diagnostic-bootstrap-'+kind,kind:'practice',practiceKey:'pegging',memberA:'M-014',memberB:'M-021',seat:'A',startScores:{A:0,B:0}}});
   assert.equal(setup.status(),200,await setup.text());const seeded=(await setup.json()).gameId;
   await page.evaluate(id=>localStorage.setItem('gambit-gameId',id),seeded);await page.reload();await ready();
   results.cases.push({kind,check:'Explicit diagnostic setup to isolate browser timing',note:'Created one valid resumable game by public API and selected it in browser storage. This bypasses the separately recorded seed-history HTTP500; it does not repair or erase that defect.',gameId:seeded});
  }
  await page.locator('#gameKind').selectOption('practice');await page.locator('#practiceKey').selectOption('pegging');
  const w=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/games');
  await page.locator('#createGameButton').click();const created=await w;assert.equal(created.status(),200);const id=(await created.json()).gameId;await ready();
  await page.locator('#handArea .card-button').first().waitFor();
  const cardCount=await page.locator('#handArea .card-button').count();
  const disabled=await page.locator('#handArea .card-button:disabled').count();
  results.cases.push({kind,check:'Create practice game and inspect initial cards',cardCount,disabled,gameId:id});save();
  await page.screenshot({path:'/evidence/'+kind+'-created.png',fullPage:true});
  if(kind==='original'){assert.equal(cardCount,6);assert.equal(disabled,6);results.cases.push({kind,check:'Reproduced original shared-gate blocker',passed:true});return;}
  assert.equal(cardCount,6);assert.equal(disabled,0);
  let g=await readGame(id);assert.equal(g.scores.A,0);assert.equal(g.scores.B,0);
  const chosen=g.hands.A.slice(-2);for(const c of chosen)await selectCard(c);await action('#discardButton');
  g=await readGame(id);assert.equal(g.discards.A.length,2);assert.deepEqual([...g.discards.A].sort(),[...chosen].sort());
  results.cases.push({kind,check:'UI selects two cards, accepts discard, fresh read retains it',passed:true,discard:chosen});save();
  await page.reload();await ready();g=await readGame(id);assert.equal(g.discards.A.length,2);
  results.cases.push({kind,check:'Reload retains first discard',passed:true});
  await changeSeat('B');g=await readGame(id,'B');for(const c of g.hands.B.slice(-2))await selectCard(c);await action('#discardButton');g=await readGame(id,'B');assert.equal(g.phase,'pegging');assert.equal(g.discards.B.length,2);
  results.cases.push({kind,check:'Second-seat UI discard starts pegging',passed:true,turn:g.turn});
  const lead=g.turn;await changeSeat(lead);g=await readGame(id,lead);const card=g.hands[lead][0];await selectCard(card);await action('#playButton');const played=await readGame(id,lead);assert(played.pegging.pile.some(x=>x.card===card));
  results.cases.push({kind,check:'Legal card played through UI and persisted',passed:true,card,count:played.pegging.count});
  await page.reload();await ready();const reloaded=await readGame(id,lead);assert.equal(reloaded.pegging.count,played.pegging.count);assert.deepEqual(reloaded.pegging.pile,played.pegging.pile);assert.equal(reloaded.revision,played.revision);
  results.cases.push({kind,check:'Reload retains played card, count, revision',passed:true});
  await page.screenshot({path:'/evidence/'+kind+'-played.png',fullPage:true});
 }catch(e){results.cases.push({kind,check:'Remaining model-app failure',passed:false,error:e.stack});}
 finally{save();await ctx.close();server.kill('SIGTERM');await new Promise(r=>server.once('exit',r));fs.closeSync(log);}
}
(async()=>{browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});try{await run('original');await run('patched');await run('patched-complete');await run('patched-revision');}finally{save();await browser.close();}console.log(JSON.stringify(results,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
