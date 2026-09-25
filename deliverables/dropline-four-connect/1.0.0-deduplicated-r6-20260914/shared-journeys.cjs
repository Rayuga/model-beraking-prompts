const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const results = [];
const started = Date.now();
let browser, p, token;
const base = 'http://127.0.0.1:3000';
async function read(path) {
  const r = await fetch(base + path, {headers: {Authorization: 'Bearer ' + token}});
  assert.equal(r.status, 200);
  return r.json();
}
const game = () => read('/api/game');
const study = async id => (await read('/api/analysis/' + id)).study;
async function click(selector, ending) {
  const next = p.waitForResponse(r => r.url().endsWith(ending) && r.request().method() === 'POST');
  await p.locator(selector).click();
  const r = await next;
  assert.equal(r.status(), 200, await r.text());
  const data = await r.json();
  if (ending === '/tactics') await p.waitForFunction(() => !document.querySelector('#tactics-run').disabled && document.querySelector('#tactics-results tbody tr'));
  await p.waitForFunction(() => !document.querySelector('#new-game').disabled && (!document.querySelector('#analysis-detail') || document.querySelector('#analysis-detail').hidden || !document.querySelector('#analysis-close').disabled));
  return data;
}
const gameAction = kind => click('#' + ({new:'new-game'}[kind] || kind), '/api/game/' + kind);
const drop = col => click('button[aria-label="Drop in column ' + col + '"]', '/api/game/move');
const practice = col => click('#analysis-columns button:nth-child(' + col + ')', '/actions');
async function open(id) {
  await p.locator('[data-study="' + id + '"]').click();
  await p.waitForFunction(id => document.querySelector('#analysis-tree [aria-current]') && document.querySelector('#analysis-list [data-study="' + id + '"]') && !document.querySelector('#analysis-close').disabled, id);
  await p.waitForFunction(id => document.querySelector('#transplant-study').value === id && document.querySelector('#transplant-target option'), id);
}
async function fork(step, name) {
  await p.locator('#match-archive button').first().click();
  await p.locator('#replay-step').focus();
  await p.keyboard.press('Home');
  for (let i = 0; i < step; i++) await p.keyboard.press('ArrowRight');
  await p.locator('#analysis-new-name').fill(name);
  const data = await click('#analysis-create', '/api/analysis');
  await p.waitForFunction(id => document.querySelector('#transplant-study').value === id && document.querySelector('#transplant-target option'), data.study.id);
  return data.study;
}
async function select(id) { return (await click('[data-node="' + id + '"]', '/actions')).study; }
async function preview(source, branch, dest) {
  await open(source.id);
  await p.locator('#transplant-source').selectOption(branch);
  await p.locator('#transplant-study').selectOption(dest.id);
  await p.waitForFunction(id => document.querySelector('#transplant-target').value === id, dest.rootId);
  const plan = await click('#transplant-preview', '/transplant/preview');
  await p.waitForFunction(() => !document.querySelector('#transplant-commit').disabled);
  return plan;
}
async function check(name, fn) {
  const start = Date.now();
  await fn();
  results.push({name, passed:true, elapsed_ms:Date.now()-start});
  console.log('PASS ' + name);
}
(async () => {
  browser = await chromium.launch({headless:true, executablePath:'/usr/local/bin/chromium', args:['--no-sandbox']});
  p = await browser.newPage({viewport:{width:1280,height:800}});
  await p.goto(base);
  await p.locator('#email').fill('avery@dropline.test');
  await p.locator('#password').fill('password123');
  const login = p.waitForResponse(r => r.url().endsWith('/api/login'));
  await p.locator('#login-form button[type=submit]').click();
  token = (await (await login).json()).token;
  await p.locator('#app-view').waitFor({state:'visible'});
  await check('one UI Red-win journey retains five independent criteria checkpoints', async () => {
    await gameAction('new'); await drop(4); await gameAction('undo');
    assert(await p.locator('#redo').isEnabled());
    const resetRedoBefore = await game(); await gameAction('new');
    const resetRedoAfter = await game();
    assert.equal(resetRedoAfter.game.revision, resetRedoBefore.game.revision+1);
    assert.equal(resetRedoAfter.game.moveHistory.length,0);
    assert(await p.locator('#redo').isDisabled());
    await gameAction('new');
    const before = await game();
    const emptyNames = await p.locator('#board [role=gridcell]').evaluateAll(es => es.map(e=>e.getAttribute('aria-label')));
    assert.equal(emptyNames.length,42);
    emptyNames.forEach((name,i)=>{
      assert.match(name.toLowerCase(),new RegExp('row '+(Math.floor(i/7)+1)+', column '+(i%7+1)+', empty'));
    });
    for (const c of [1,7,2,7,3,6,4]) await drop(c);
    const won = await game();
    assert.equal(won.game.scores.Red, before.game.scores.Red+1);
    assert.equal(won.archiveTotal, before.archiveTotal+1);
    assert.equal(won.game.moveHistory.length, 7);
    assert.equal(won.game.winningCells.length, 4);
    assert.deepEqual([...won.game.winningCells].sort((a,b)=>a-b),[35,36,37,38]);
    const winningNames=await p.locator('#board [role=gridcell]').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')));
    winningNames.forEach((name,i)=>{
      assert.equal(/winning/i.test(name),[35,36,37,38].includes(i));
      assert.match(name.toLowerCase(),new RegExp('row '+(Math.floor(i/7)+1)+', column '+(i%7+1)+', '+(won.game.board[i]||'empty').toLowerCase()));
    });
    await p.locator('#match-archive button').first().click();
    await p.locator('#replay-step').focus();
    await p.keyboard.press('Home');
    assert.equal(await p.locator('#replay-board [role=gridcell]').count(), 42);
    await p.locator('#replay-next').click();
    assert.equal(await p.locator('#replay-step').inputValue(), '1');
    await p.locator('#replay-step').focus(); await p.keyboard.press('End');
    assert.deepEqual(await game(), won);
    await gameAction('undo');
    const undone = await game();
    assert.equal(undone.game.status, 'active');
    assert.equal(undone.game.moveHistory.length, 6);
    assert.equal(undone.game.winningCells.length, 0);
    assert.deepEqual(undone.game.scores, before.game.scores);
    assert.equal(undone.archiveTotal, before.archiveTotal);
    await p.reload(); await p.locator('#app-view').waitFor({state:'visible'});
    assert.deepEqual(await game(), undone);
    await gameAction('redo');
    const restored = await game();
    assert.deepEqual(restored.game.board, won.game.board);
    assert.deepEqual(restored.game.winningCells, won.game.winningCells);
    assert.deepEqual(restored.game.scores, won.game.scores);
    const archiveRecords = entries => entries.map(({id, ...entry}) => entry);
    assert.deepEqual(archiveRecords(restored.archive), archiveRecords(won.archive));
    assert.equal(restored.archiveTotal, won.archiveTotal);
    assert(await p.locator('#redo').isDisabled());
    await p.reload(); await p.locator('#app-view').waitFor({state:'visible'});
    assert.deepEqual(await game(), restored);
    await gameAction('new');
    const reset = await game();
    assert.deepEqual(reset.archive, restored.archive);
    assert.equal(reset.game.board.filter(Boolean).length, 0);
    assert.equal(reset.game.revision,restored.game.revision+1);
    assert.equal(reset.game.moveHistory.length,0);
    assert.equal(reset.game.winningCells.length,0);
    assert.deepEqual(reset.game.scores,restored.game.scores);
    assert(await p.locator('#redo').isDisabled());
    assert(await p.locator('#undo').isDisabled());
    await drop(7); const single=await game();
    assert.equal(single.game.board[41],'Red');
    assert.equal(single.game.moveHistory.length,1);
    await p.reload(); await p.locator('#app-view').waitFor({state:'visible'});
    assert.deepEqual(await game(),single);
    await gameAction('new'); const verticalBase=await game();
    for(const c of [1,2,1,2,1,2,1])await drop(c);
    const vertical=await game();
    assert.deepEqual([...vertical.game.winningCells].sort((a,b)=>a-b),[14,21,28,35]);
    assert.equal(vertical.game.scores.Red,verticalBase.game.scores.Red+1);
    await gameAction('new'); const yellowBase=await game();
    for(const c of [7,1,7,1,6,1,6,1])await drop(c);
    const yellow=await game();
    assert.deepEqual([...yellow.game.winningCells].sort((a,b)=>a-b),[14,21,28,35]);
    assert.equal(yellow.game.scores.Yellow,yellowBase.game.scores.Yellow+1);
    await gameAction('new');
    for(const c of [1,7,2,7,3,6,4])await drop(c);
  });
  await check('shared sibling, nested and comparison journey preserves five nodes and independent observations',async()=>{
    let s=await fork(6,'Shared branch journey');
    const baseGame=await game();
    s=(await practice(4)).study; const a=s.selectedId;
    await click('#analysis-undo','/actions');
    s=(await practice(5)).study; const b=s.selectedId;
    assert.equal(s.nodes.length,3);
    await select(a); assert.match(await p.locator('#analysis-status').innerText(),/Red wins/);
    await select(b);
    for(const target of [a,b]){
      await select(s.rootId);await p.locator('#analysis-child').selectOption(target);
      const redone=(await click('#analysis-redo','/actions')).study;
      assert.equal(redone.selectedId,target);
    }
    await select(s.rootId);s=(await practice(5)).study;
    assert.equal(s.selectedId,b);assert.equal(s.nodes.length,3);
    s=(await practice(1)).study; const c=s.selectedId;
    await click('#analysis-undo','/actions');s=(await practice(2)).study; const d=s.selectedId;
    assert.equal(s.nodes.length,5);
    for(const id of [c,d])assert.equal(s.nodes.find(n=>n.id===id).parentId,b);
    const nodeC=s.nodes.find(n=>n.id===c),nodeD=s.nodes.find(n=>n.id===d);
    assert.equal(nodeC.board[28],'Yellow');assert.equal(nodeC.board[29],'');
    assert.equal(nodeD.board[29],'Yellow');assert.equal(nodeD.board[28],'');
    await select(c);await select(d);
    await p.locator('#analysis-rename-name').fill('Shared branch renamed');
    s=(await click('#analysis-rename button','/actions')).study;
    await p.reload();await p.locator('#app-view').waitFor({state:'visible'});await open(s.id);
    assert.deepEqual(await study(s.id),s);
    assert.equal(s.name,'Shared branch renamed');assert.equal(s.selectedId,d);
    async function compare(left,right){
      await p.locator('#analysis-left').selectOption(left);await p.locator('#analysis-right').selectOption(right);
      const wait=p.waitForResponse(r=>r.url().includes('/compare?'));
      await p.locator('#analysis-compare').click();const response=await wait;
      assert.equal(response.status(),200);await p.locator('#analysis-comparison').waitFor({state:'visible'});
      return response.json();
    }
    const comparison=await compare(a,c);assert.equal(comparison.commonPrefix,6);
    assert.deepEqual([...comparison.differentCells].sort((x,y)=>x-y),[28,38,39]);
    assert.equal(await p.locator('#analysis-left-board [role=gridcell]').count(),42);
    assert.equal(await p.locator('#analysis-right-board [role=gridcell]').count(),42);
    const reversed=await compare(c,a);assert.deepEqual(reversed.left,comparison.right);assert.deepEqual(reversed.right,comparison.left);
    const identical=await compare(c,c);assert.equal(identical.commonPrefix,8);assert.deepEqual(identical.differentCells,[]);
    assert.deepEqual(await study(s.id),s);assert.deepEqual(await game(),baseGame);
  });
  await check('one UI fixture supports preview, first commit and recursive merge without cursor mismatch', async () => {
    let src = await fork(0, 'Shared journey source');
    src = (await practice(1)).study; const branch = src.selectedId;
    await practice(2); await click('#analysis-undo', '/actions'); await practice(3); src = (await practice(4)).study;
    let dst = await fork(1, 'Shared journey destination');
    await practice(1); dst = (await practice(2)).study;
    const competitive = await game();
    const plan = await preview(src, branch, dst);
    assert.equal(plan.added, 2); assert.equal(plan.reused, 2);
    assert.deepEqual(plan.mappings.map(m => m.path), [[1],[1,2],[1,3],[1,3,4]]);
    assert.deepEqual(await study(src.id), src); assert.deepEqual(await study(dst.id), dst);
    const committed = await click('#transplant-commit', '/transplant/commit');
    assert.equal(committed.study.revision, dst.revision+1);
    assert.equal(committed.study.selectedId, dst.selectedId);
    assert.equal(committed.study.nodes.length, dst.nodes.length+2);
    for (const n of dst.nodes) assert.deepEqual(committed.study.nodes.find(x => x.id===n.id), n);
    assert.equal(committed.mapping.length, 4);
    await open(dst.id); await select(dst.rootId); dst = (await practice(6)).study;
    const outside = dst.selectedId;
    const merged = await preview(src, branch, dst);
    assert.equal(merged.added, 0); assert.equal(merged.reused, 4);
    const again = await click('#transplant-commit', '/transplant/commit');
    assert.equal(again.study.revision, dst.revision+1);
    assert.equal(again.study.selectedId, outside);
    assert.deepEqual(again.study.nodes, dst.nodes);
    assert.deepEqual(await study(src.id), src);
    assert.deepEqual(await game(), competitive);
  });
  await check('one UI fork fixture yields three identical depth-three samples and report invalidation', async () => {
    let s = await fork(0, 'Shared tactical fork');
    for (const c of [2,7,3,7]) s = (await practice(c)).study;
    const before = await game();
    await p.locator('#tactics-depth').selectOption('1');
    const shallow = await click('#tactics-run', '/tactics');
    assert(shallow.proof.children.every(c => c.outcome==='unknown'));
    await p.locator('#tactics-depth').selectOption('3');
    const first = await click('#tactics-run', '/tactics');
    assert.equal(first.proof.children[3].outcome, 'win');
    assert.equal(first.proof.children[3].distance, 3);
    const root = p.locator('#tactics-tree > details');
    await root.locator(':scope > details').nth(3).locator(':scope > summary').click();
    await root.locator(':scope > details').nth(3).locator(':scope > details').nth(6).waitFor({state:'attached'});
    assert.equal(await root.locator(':scope > details').nth(3).locator(':scope > details').count(), 7);
    assert.deepEqual(await click('#tactics-run', '/tactics'), first);
    await p.reload(); await p.locator('#app-view').waitFor({state:'visible'}); await open(s.id);
    await p.locator('#tactics-depth').selectOption('3');
    assert.deepEqual(await click('#tactics-run', '/tactics'), first);
    assert.deepEqual(await study(s.id), s); assert.deepEqual(await game(), before);
    await click('#analysis-undo', '/actions');
    assert.equal(await p.locator('#tactics-results tbody tr').count(), 0);
  });
  await browser.close();
})().catch(async error => {
  console.error(error);
  results.push({passed:false, error:String(error), stack:error.stack});
  if (browser) await browser.close();
  process.exitCode=1;
}).finally(() => fs.writeFileSync('/evidence/shared-journeys.json', JSON.stringify({kind:'Unpaid local browser regression; not a judge timing measurement or score', elapsed_ms:Date.now()-started, results}, null, 2)));
