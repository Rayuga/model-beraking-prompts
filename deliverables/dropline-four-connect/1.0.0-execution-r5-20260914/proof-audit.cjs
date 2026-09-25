const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
function validate(root){
 const seen=new Set();let count=0;
 function walk(n,parent,column){
  count++;const key=n.path.join(',');assert(!seen.has(key));seen.add(key);
  assert.equal(n.board.length,42);assert.equal(n.status,'active');assert.equal(n.outcome,'unknown');assert.equal(n.distance,null);
  assert.equal(n.player,n.path.length%2?'Yellow':'Red');assert.equal(n.remainingDepth,4-n.path.length);
  assert.equal(n.reason,n.path.length===4?'horizon':'searched');
  if(parent){
   assert.deepEqual(n.path,[...parent.path,column]);const board=[...parent.board];let row=5;
   while(row>=0&&board[row*7+column-1])row--;assert(row>=0);board[row*7+column-1]=parent.player;assert.deepEqual(n.board,board);
  }else{assert.deepEqual(n.path,[]);assert(n.board.every(c=>c===''));}
  assert.deepEqual(n.children.map(c=>c.column),n.path.length===4?[]:[1,2,3,4,5,6,7]);
  for(const c of n.children){assert.equal(c.outcome,'unknown');assert.equal(c.distance,null);walk(c.proof,n,c.column);}
 }
 walk(root);assert.equal(count,2801);return count;
}
let browser;const results=[];
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});const p=await browser.newPage({viewport:{width:1280,height:800}});
 await p.goto('http://localhost:3000');await p.locator('#email').fill('avery@dropline.test');await p.locator('#password').fill('password123');await p.locator('#login-form button[type=submit]').click();await p.locator('#app-view').waitFor({state:'visible'});
 await p.locator('#match-archive button').first().click();await p.locator('#replay-step').focus();await p.keyboard.press('Home');await p.locator('#analysis-new-name').fill('Full proof fidelity');
 const creation=p.waitForResponse(r=>r.url().endsWith('/api/analysis')&&r.request().method()==='POST');await p.locator('#analysis-create').click();const s=(await(await creation).json()).study;await p.waitForFunction(()=>!document.querySelector('#analysis-close').disabled);
 await p.locator('#tactics-depth').selectOption('4');const request=p.waitForResponse(r=>r.url().endsWith('/tactics'));await p.locator('#tactics-run').click();const report=await(await request).json();assert.equal(validate(report.proof),2801);results.push({name:'All 2801 nodes: paths, players, outcomes, depth, gravity and exact board transitions',passed:true});
 await p.waitForFunction(()=>!document.querySelector('#tactics-run').disabled&&document.querySelector('#tactics-tree > details'));
 for(const [path,cells] of [[[4,4,2,3],[[38,'Red'],[36,'Red'],[31,'Yellow'],[37,'Yellow']]],[[3,3,6,5],[[37,'Red'],[40,'Red'],[30,'Yellow'],[39,'Yellow']]]]){
  let item=p.locator('#tactics-tree > details');
  for(const column of path){item=item.locator(':scope > details').nth(column-1);await item.locator(':scope > summary').click();}
  await item.locator(':scope > button').click();const labels=await p.locator('#tactics-board [role=gridcell]').evaluateAll(ns=>ns.map(n=>n.getAttribute('aria-label')));assert.equal(labels.length,42);
  const expected=Array(42).fill('empty');for(const [i,c] of cells)expected[i]=c;labels.forEach((l,i)=>assert(l.endsWith(expected[i])));
  assert.match(await p.locator('#tactics-position').innerText(),/Red perspective/);assert.equal(await p.locator('#analysis-tree [aria-current]').getAttribute('data-node'),s.rootId);
 }
 results.push({name:'Both actual UI proof paths show all 42 correct cells and preserve saved root',passed:true});
 const mutations=[['missing reply',r=>r.children.pop()],['wrong column order',r=>r.children.reverse()],['duplicate path',r=>r.children[1].proof.path=[1]],['wrong player',r=>r.children[0].proof.player='Red'],['forged intermediate win',r=>r.children[0].proof.outcome='win'],['wrong derived board',r=>r.children[0].proof.board[0]='Red'],['fabricated distance',r=>r.children[0].proof.distance=1]];
 for(const[name,mutate]of mutations){const bad=structuredClone(report.proof);mutate(bad);assert.throws(()=>validate(bad));results.push({name:'Rejects '+name,passed:true});}
 await browser.close();
})().catch(async e=>{results.push({passed:false,error:String(e),stack:e.stack});if(browser)await browser.close();process.exitCode=1;}).finally(()=>{fs.writeFileSync('/evidence/proof-audit.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));});
