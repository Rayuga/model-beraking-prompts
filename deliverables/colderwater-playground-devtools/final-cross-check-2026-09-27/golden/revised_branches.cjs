const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const fixtures=JSON.parse(fs.readFileSync('/evidence/revised_fixture_inputs.json'));
async function main(){
  const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  let promptAnswer='';
  const report={checks:[],writes:[],browserErrors:[],exact_pending_html:fixtures.pending_html};
  page.on('dialog',d=>d.accept(d.type()==='prompt'?promptAnswer:undefined));
  page.on('pageerror',e=>report.browserErrors.push(String(e)));
  page.on('request',r=>{if(['POST','PUT','DELETE'].includes(r.method()))report.writes.push({method:r.method(),url:r.url(),body:r.postData()});});
  const editor=()=>page.getByRole('textbox',{name:'Code editor',exact:true});
  const editorText=async()=> (await editor().locator('.cm-line').allTextContents()).join('\n');
  const title=()=>page.getByRole('textbox',{name:'Snippet title',exact:true});
  const file=()=>page.getByRole('textbox',{name:'Filename',exact:true});
  const preview=()=>page.frameLocator('iframe[title="Live preview"]');
  const body=()=>preview().locator('body').innerText();
  const logs=()=>page.getByRole('log').innerText();
  const status=()=>page.getByRole('status').innerText();
  const complete=()=>page.waitForFunction(()=>document.querySelector('[role=status]')?.textContent.startsWith('Complete'));
  const clear=()=>page.getByRole('button',{name:'Clear console',exact:true}).click();
  const all=()=>page.evaluate(async()=>await(await fetch('/api/snippets')).json());
  async function enter(code,filename='probe.js'){
    await file().fill(filename);await editor().click();await page.keyboard.press('Control+A');await page.keyboard.insertText(code);assert.equal(await editorText(),code);
  }
  async function run(code,filename='probe.js',wait=true){
    await enter(code,filename);const started=Date.now();await page.getByRole('button',{name:/^Run /}).click();if(wait)await complete();return started;
  }
  async function save(){
    const pending=page.waitForResponse(r=>/\/api\/snippets(?:\/\d+)?$/.test(r.url())&&['POST','PUT'].includes(r.request().method()));
    await page.getByRole('button',{name:'Save',exact:true}).click();const response=await pending;const record=await response.json();assert(response.ok(),JSON.stringify(record));await page.getByRole('status').filter({hasText:/Saved.*revision/}).waitFor();return record;
  }
  async function create(name,filename,code){await page.getByRole('button',{name:'New',exact:true}).click();await title().fill(name);await enter(code,filename);return save();}
  async function select(name,expectedCode){await page.getByRole('combobox',{name:'Starter example',exact:true}).selectOption(name);await page.waitForFunction(name=>document.querySelector('input[aria-label="Filename"]').value===name,name);if(expectedCode!==undefined)await page.waitForFunction(code=>Array.from(document.querySelectorAll('[aria-label="Code editor"] .cm-line'),line=>line.textContent).join('\n')===code,expectedCode);}
  async function load(record){await page.locator('.snippetlist button').filter({hasText:record.title}).click();assert.equal(await title().inputValue(),record.title);assert.equal(await file().inputValue(),record.filename);assert.equal(await editorText(),record.code);}
  async function test(name,fn){if(process.env.CW_EXAMPLE_ONLY==='1'&&!name.startsWith('edited_example_'))return;const start=Date.now();try{report.checks.push({name,passed:true,...await fn(),duration_ms:Date.now()-start});}catch(error){report.checks.push({name,passed:false,error:String(error),duration_ms:Date.now()-start});}}
  async function overlay(html){
    return page.evaluate(html=>{
      document.querySelector('#cw-local-retained-preview-overlay')?.remove();
      const frame=document.querySelector('iframe[title="Live preview"]'),r=frame.getBoundingClientRect();
      const element=document.createElement('div');element.id='cw-local-retained-preview-overlay';element.setAttribute('aria-label','Retained last successful preview local test overlay');
      Object.assign(element.style,{position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',zIndex:'100000',background:'white',color:'black',font:'16px Times New Roman',padding:'8px',boxSizing:'border-box',overflow:'auto',pointerEvents:'auto'});
      element.innerHTML=html;element.querySelectorAll('script').forEach(e=>e.remove());document.body.append(element);return element.textContent;
    },html);
  }
  const removeOverlay=()=>page.evaluate(()=>document.querySelector('#cw-local-retained-preview-overlay')?.remove());
  try{
    await page.goto('http://localhost:3000');await editor().waitFor();await complete();await page.getByRole('checkbox',{name:'Auto-run',exact:true}).uncheck();
    await test('edited_example_saved_copy_leaves_builtin_original_exact',async()=>{
      await select('hello.js');const original={filename:await file().inputValue(),code:await editorText()};
      await page.getByRole('button',{name:/^Run /}).click();await complete();assert((await body()).includes('12 squared is 144'));
      const source="document.body.innerHTML='<p>example-final-authored-marker</p>';console.log('example-final-authored-marker');";
      await run(source,'example-edited.js');assert((await body()).includes('example-final-authored-marker'));assert((await logs()).includes('example-final-authored-marker'));
      await select('hello.js',original.code);const editedSource=original.code+'\n// saved-example-final-cross-check';await enter(editedSource,original.filename);
      await title().fill('QC Example Saved Copy');const record=await save();assert.equal(record.filename,original.filename);assert.equal(record.code,editedSource);
      await page.reload();await select('hello.js',original.code);assert.equal(await file().inputValue(),original.filename);assert.equal(await editorText(),original.code);
      await load(record);assert.deepEqual((await all()).find(row=>row.id===record.id),record);
      return{original_example:original,saved_record:record,original_unchanged_after_reload:true};
    });
    await test('positive_padded_unique_create_and_rename_trim_exactly',async()=>{
      assert(fixtures.criteria.cw_title_change_uniqueness.description.includes('  QC Rename Source  '));
      const first=await create('  QC Rename Source  ','qc-rename-a.js',"console.log('rename-source');");assert.equal(first.title,'QC Rename Source');
      const sibling=await create('QC Rename Sibling','qc-rename-b.js',"console.log('rename-sibling');");
      await page.reload();await load(first);assert.deepEqual((await all()).find(row=>row.id===first.id),first);
      promptAnswer='  QC Rename Source Renamed  ';const pending=page.waitForResponse(r=>r.url().endsWith('/api/snippets/'+first.id)&&r.request().method()==='PUT');
      await page.getByRole('button',{name:'Rename',exact:true}).click();const response=await pending;assert(response.ok());const renamed=await response.json();
      await page.getByRole('status').filter({hasText:'Renamed to'}).waitFor();assert.equal(renamed.title,'QC Rename Source Renamed');assert.equal(renamed.id,first.id);assert.equal(renamed.filename,first.filename);assert.equal(renamed.code,first.code);assert.equal(renamed.revision,first.revision+1);
      await page.reload();await load(renamed);const records=await all();assert.deepEqual(records.find(row=>row.id===sibling.id),sibling);assert.deepEqual(records.find(row=>row.id===first.id),renamed);
      return{padded_create:'  QC Rename Source  ',created:first,padded_rename:promptAnswer,renamed,sibling_unchanged:true};
    });
    await test('completed_delayed_click_key_input_then_stop_remains_inactive',async()=>{
      await clear();await run(fixtures.completed_html,'interaction.html');assert((await body()).includes('completed-interaction-ready'));assert((await logs()).includes('completed-interaction-ready-log'));
      const completedAt=Date.now();await page.waitForTimeout(6100);const clickAt=Date.now();await preview().getByRole('button',{name:'Try later action'}).click();await complete();
      assert((await logs()).includes('completed-interaction-click'));await preview().getByRole('textbox',{name:'Later interaction input'}).click();await complete();
      const focusedAt=Date.now();await page.waitForTimeout(6100);const keyAt=Date.now();await preview().getByRole('textbox',{name:'Later interaction input'}).press('a');await complete();
      const count=text=>Object.fromEntries(['click','key','input'].map(kind=>[kind,(text.match(new RegExp('completed-interaction-'+kind,'g'))||[]).length]));
      const before=count(await logs());assert(before.click>0&&before.key>0&&before.input>0);
      await page.getByRole('button',{name:'Stop',exact:true}).click();assert(/cancel|stop/i.test(await status()));
      await preview().getByRole('button',{name:'Try later action'}).click();await preview().getByRole('textbox',{name:'Later interaction input'}).press('b');await page.waitForTimeout(250);
      const after=count(await logs());assert.deepEqual(after,before);
      await run("document.body.innerHTML='<p>completed-stop-recovered</p>';console.log('completed-stop-recovered-log');");assert((await body()).includes('completed-stop-recovered'));assert((await logs()).includes('completed-stop-recovered-log'));
      return{wait_before_click_ms:clickAt-completedAt,wait_before_key_ms:keyAt-focusedAt,before_stop_counts:before,after_stopped_input_counts:after,recovery:true};
    });
    async function pendingBranch(masked){
      await clear();await run(fixtures.pending_html,'pending-interaction.html');assert((await body()).includes('interaction-good'));assert((await logs()).includes('interaction-initial-ready'));
      await preview().getByRole('button',{name:'Commit change',exact:true}).click();await complete();assert.equal(await preview().locator('#interaction-state').innerText(),'interaction-committed');assert((await logs()).includes('interaction-committed-log'));
      const committedHTML=await preview().locator('body').innerHTML();const secondBounds=await preview().getByRole('button',{name:'Still waiting',exact:true}).boundingBox();
      const started=Date.now();await preview().getByRole('button',{name:'Start work',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[role=log]').textContent.includes('interaction-started'));
      assert(/Waiting|Running/.test(await status()));
      if(masked){assert((await overlay(committedHTML)).includes('interaction-committed'));await page.screenshot({path:'/evidence/pending-static-lastgood-overlay.png',fullPage:true});}
      await page.waitForTimeout(Math.max(0,started+2100-Date.now()));const secondAt=Date.now();
      if(masked){await page.mouse.click(secondBounds.x+secondBounds.width/2,secondBounds.y+secondBounds.height/2);assert(!(await logs()).includes('interaction-still-waiting'));assert(await page.locator('#cw-local-retained-preview-overlay').isVisible());}
      else{await preview().getByRole('button',{name:'Still waiting',exact:true}).click();assert((await logs()).includes('interaction-still-waiting'));}
      await page.waitForFunction(()=>/time limit/i.test(document.querySelector('[role=log]').textContent));const stoppedAt=Date.now();assert(stoppedAt-started<8000);
      if(masked)await removeOverlay();assert.equal(await preview().locator('#interaction-state').innerText(),'interaction-committed');
      await page.waitForTimeout(Math.max(0,started+6700-Date.now()));assert(!(await logs()).includes('interaction-late'));assert.equal(await preview().locator('#interaction-state').innerText(),'interaction-committed');
      await run("document.body.innerHTML='<p>interaction-budget-recovered</p>';console.log('interaction-budget-recovered-log');");assert((await body()).includes('interaction-budget-recovered'));assert((await logs()).includes('interaction-budget-recovered-log'));
      return{last_good:'interaction-committed',second_input_at_ms:secondAt-started,timeout_at_ms:stoppedAt-started,pending_candidate_visible:!masked,second_input_dispatched_to_handler:!masked,static_overlay_blocked_input:masked,no_late_callback:true,rollback_to_latest_successful_interaction:true,recovery:true};
    }
    await test('new_committed_interaction_rollback_and_pending_second_click',()=>pendingBranch(false));
    await test('valid_alternative_static_lastgood_overlay_blocks_second_pending_input',()=>pendingBranch(true));
    await test('valid_alternative_shared_original_deadline_with_hidden_candidate',async()=>{
      await clear();await run("document.body.innerHTML='<p>recovery-marker-Q7</p>';\nconsole.log('recovery-marker-Q7-log');");assert((await body()).includes('recovery-marker-Q7'));assert((await logs()).includes('recovery-marker-Q7-log'));
      const good=await preview().locator('body').innerHTML();
      const started=await run("document.body.innerHTML='<p>failed-loop-candidate</p>';\nsetTimeout(() => { console.log('late-callback-entered'); while (true) {} }, 4000);",'shared-budget.js',false);
      assert(/Waiting|Running/.test(await status()));assert((await overlay(good)).includes('recovery-marker-Q7'));
      await page.waitForFunction(()=>/time limit/i.test(document.querySelector('[role=log]').textContent));const elapsed=Date.now()-started;assert(elapsed<8000);assert((await logs()).includes('late-callback-entered'));await removeOverlay();assert((await body()).includes('recovery-marker-Q7'));assert(!(await body()).includes('failed-loop-candidate'));
      await run("document.body.innerHTML='<p>shared-deadline-recovered</p>';console.log('shared-deadline-recovered-log');");assert((await body()).includes('shared-deadline-recovered'));assert((await logs()).includes('shared-deadline-recovered-log'));
      return{elapsed_ms:elapsed,pending_candidate_masked:true,last_good_remained_visible:true,original_four_second_callback_delay:true,recovery:true};
    });
    assert.deepEqual(report.browserErrors,[]);report.passed=report.checks.length>0&&report.checks.every(row=>row.passed);
    console.log(JSON.stringify(report));
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
