from pathlib import Path

HERE=Path(__file__).resolve().parent
source=(HERE/'review.cjs').read_text(encoding='utf-8').split('async function main(){')[0]
body=r'''
async function main(){
  await call('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'review-inflight-check',version:'1'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  await call('tools/call',{name:'browser_navigate',arguments:{url:'http://localhost:3000'}});
  const loaded=await call('tools/call',{name:'browser_run_code_unsafe',arguments:{filename:'/opt/common-ground-verifier/browser-evidence.js'}});assert(!loaded.result?.isError);
  await step('setup',`browser.__recoverySmoke={ruth:page,exchanges:{},writes:[],pageErrors:[]};return await signin(page,'ruth');`);
  await step('prepare-conflicts',`
    watch(page);h.b=await (await browser.newContext()).newPage();await signin(h.b,'ruth');
    await createForm(page,'In-flight review');h.created=await save(page,'race-create');h.id=h.created.response.body.ballot.id;
    await edit(page,h.id,{title:'My reviewed title',description:'My context',method:'approval',max_selections:2,choices:['Morning','Evening']});
    await edit(h.b,h.id,{title:'Other title',description:'Other context',method:'single',max_selections:1,choices:['First','Second']});await save(h.b,'race-remote');
    await save(page,'race-refusal');await preview(page);
    for(const field of ['title','description','voting'])await page.locator('input[name="review-'+field+'"][value="yours"]').check();
    await e.arm(page,'race-held',{match:isStaff,mode:'hold'});await page.getByRole('button',{name:'Save reviewed draft',exact:true}).click();
    for(let i=0;i<100&&e.peek('race-held').state!=='response-held';i++)await page.waitForTimeout(30);
    return e.peek('race-held');`);
  const controls=await step('controls-while-held',`
    const pick=page.locator('input[name="review-title"][value="latest"]');const choiceDisabled=await pick.isDisabled();
    if(!choiceDisabled)await pick.check();
    return {choiceDisabled,saveDisabled:await page.locator('#save-draft-review').isDisabled(),discardDisabled:await page.locator('#discard-draft-review').isDisabled(),writes:h.writes.length};`);
  retain('control-observation',controls);
  // Leaving via Escape is ordinary browser interaction, with no DOM/state edits.
  const staleReply=await step('old-reply-new-form',`
    await page.keyboard.press('Escape');await createForm(page,'New independent work');
    e.release('race-held','deliver');await e.collect('race-held');await page.waitForLoadState('networkidle');
    return {open:await page.locator('#ballot-dialog').isVisible(),title:await page.locator('#ballot-title').inputValue(),errors:h.pageErrors};`);
  retain('late-observation',staleReply);
  results.push({name:'changing conflict choices cannot enable a second in-flight save',passed:controls.saveDisabled,evidence:controls});
  results.push({name:'discard does not claim an in-flight submission was never sent',passed:controls.discardDisabled,evidence:controls});
  results.push({name:'late reviewed-save result leaves a newer form intact',passed:staleReply.open&&staleReply.title==='New independent work',evidence:staleReply});
  results.push({name:'in-flight review has no browser errors',passed:staleReply.errors.length===0});
  for(const row of results)console.log(row.passed?'PASS':'FAIL',row.name);
  assert(results.every(r=>r.passed));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{
  fs.writeFileSync('/results/review-race-results.json',redact({passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results,stderr}));child.kill();
});
'''
(HERE/'review-race.cjs').write_text(source+body,encoding='utf-8',newline='\n')
