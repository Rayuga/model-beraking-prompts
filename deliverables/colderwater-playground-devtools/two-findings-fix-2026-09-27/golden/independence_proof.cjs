const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const phase=process.argv[2],variant=process.env.CW_CASE,logDir=process.env.CW_LOG_DIR;
const input=JSON.parse(fs.readFileSync(logDir+'/fixture-inputs.json'));
async function main(){
  const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(10000);
  const report={phase,variant,checks:[],writes:[],dialogs:[],browserErrors:[],run_button_clicks:0,duplicate_actions:0,delete_actions:0};
  let acceptDialog=true;
  page.on('dialog',async dialog=>{report.dialogs.push({type:dialog.type(),message:dialog.message(),accepted:acceptDialog});await(acceptDialog?dialog.accept():dialog.dismiss());});
  page.on('pageerror',error=>report.browserErrors.push(String(error)));
  page.on('request',request=>{if(['POST','PUT','DELETE'].includes(request.method()))report.writes.push({method:request.method(),url:request.url(),body:request.postData()});});
  const editor=()=>page.getByRole('textbox',{name:'Code editor',exact:true});
  const editorText=async()=> (await editor().locator('.cm-line').allTextContents()).join('\n');
  const title=()=>page.getByRole('textbox',{name:'Snippet title',exact:true});
  const filename=()=>page.getByRole('textbox',{name:'Filename',exact:true});
  const all=()=>page.evaluate(async()=>await(await fetch('/api/snippets')).json());
  const norm=records=>[...records].sort((a,b)=>a.id-b.id);
  const equalList=(actual,expected)=>assert.deepEqual(norm(actual),norm(expected));
  async function capabilityOverlay(mode){
    return page.evaluate(mode=>{
      const names=['Duplicate','Delete'];const found=[];
      const enforce=()=>{for(const name of names){const button=[...document.querySelectorAll('button')].find(element=>element.textContent.trim()===name);if(!button)continue;if(!found.includes(name))found.push(name);if(mode==='removed')button.remove();else if(!button.disabled)button.disabled=true;}};
      enforce();const observer=new MutationObserver(enforce);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']});window.__cwCapabilityObserver=observer;
      return {mode,changed:found,remaining:names.map(name=>{const button=[...document.querySelectorAll('button')].find(element=>element.textContent.trim()===name);return {name,present:!!button,disabled:button?.disabled??null};})};
    },mode);
  }
  async function open(){
    await page.goto('http://localhost:3000');await editor().waitFor();await page.waitForFunction(()=>document.querySelector('[aria-label="Code editor"]').textContent.trim().length>0);
    await page.evaluate(()=>{window.__cwObservedActionClicks={run:0,duplicate:0,delete:0};document.addEventListener('click',event=>{const text=event.target.closest('button')?.textContent.trim()||'';if(/^Run(?:\s|$)/.test(text))window.__cwObservedActionClicks.run++;if(text==='Duplicate')window.__cwObservedActionClicks.duplicate++;if(text==='Delete')window.__cwObservedActionClicks.delete++;},true);});
    const automatic=page.getByRole('checkbox',{name:'Auto-run',exact:true});if(await automatic.count())await automatic.uncheck();
    if(variant==='no-duplicate-delete')report.capability_overlay=await capabilityOverlay(phase==='prepare'?'removed':'disabled');
  }
  async function source(code,file){await filename().fill(file);await editor().click();await page.keyboard.press('Control+A');await page.keyboard.insertText(code);assert.equal(await editorText(),code);}
  async function save(){
    const pending=page.waitForResponse(response=>/\/api\/snippets(?:\/\d+)?$/.test(response.url())&&['POST','PUT'].includes(response.request().method()));
    await page.getByRole('button',{name:'Save',exact:true}).click();const response=await pending;const record=await response.json();assert(response.ok(),JSON.stringify(record));
    await page.getByRole('status').filter({hasText:/Saved.*revision/}).waitFor();
    return {record,request:{method:response.request().method(),url:response.url(),body:JSON.parse(response.request().postData()),contentType:response.request().headers()['content-type']}};
  }
  async function create(name,file,code){await page.getByRole('button',{name:'New',exact:true}).click();await title().fill(name);await source(code,file);return save();}
  async function load(record){await page.locator('.snippetlist button').filter({hasText:record.title}).filter({has:page.getByText(record.filename,{exact:true})}).click();assert.equal(await title().inputValue(),record.title);assert.equal(await filename().inputValue(),record.filename);assert.equal(await editorText(),record.code);assert((await page.locator('.editor > .paneheading').innerText()).includes('revision '+record.revision));}
  async function deleteUI(record){
    await load(record);const pending=page.waitForResponse(response=>response.request().method()==='DELETE');
    report.delete_actions++;await page.getByRole('button',{name:'Delete',exact:true}).click();const response=await pending;const result=await response.json();assert(response.ok(),JSON.stringify(result));
    await page.getByRole('status').filter({hasText:'Deleted'}).waitFor();
    return {method:response.request().method(),url:response.url(),body:JSON.parse(response.request().postData()),contentType:response.request().headers()['content-type'],control_id:record.id,status:response.status()};
  }
  async function replay(request){return page.evaluate(async operation=>{const response=await fetch(operation.url,{method:operation.method,headers:{'Content-Type':operation.contentType},body:JSON.stringify(operation.body)});return {ok:response.ok,status:response.status,data:await response.json()};},request);}
  function deletionFor(observed,record,revision){assert(observed.url.endsWith('/'+observed.control_id));return {method:observed.method,url:observed.url.slice(0,-String(observed.control_id).length)+record.id,contentType:observed.contentType,body:{...observed.body,revision}};}
  async function check(name,fn){report.checks.push({name,passed:true,...await fn()});}
  try{
    await open();
    if(phase==='prepare'){
      await check('independent_restart_controls_without_duplicate_delete_or_run',async()=>{
        const unrelated=(await create('CW gate independence-background','background.js',"console.log('independent-background');")).record;
        const initialPrimary=(await create('QC Restart Primary','qc-restart.js',"console.log('restart-original');")).record;
        const secondary=(await create('QC Restart Second','qc-second.js',"console.log('restart-second');")).record;
        assert.notEqual(initialPrimary.id,secondary.id);await load(initialPrimary);
        await source("console.log('restart-before-restart');",initialPrimary.filename);const primary=(await save()).record;assert.equal(primary.id,initialPrimary.id);assert.equal(primary.revision,initialPrimary.revision+1);
        const records=await all();equalList(records,[unrelated,primary,secondary]);await load(primary);await load(secondary);
        assert(!report.writes.some(row=>row.method==='DELETE'));assert.equal(report.duplicate_actions,0);assert.equal(report.delete_actions,0);assert.equal(report.run_button_clicks,0);
        const clicks=await page.evaluate(()=>window.__cwObservedActionClicks);assert.deepEqual(clicks,{run:0,duplicate:0,delete:0});
        fs.writeFileSync(logDir+'/before.json',JSON.stringify({unrelated,primary,secondary,records},null,2));
        return {records,independent_new_save_creations:3,pre_restart_update:primary,observed_action_clicks:clicks,forbidden_setup_operations:0,overlay:report.capability_overlay??null};
      });
    }else if(phase==='verify'){
      await check('actual_process_restart_exact_reads_and_postrestart_save',async()=>{
        const before=JSON.parse(fs.readFileSync(logDir+'/before.json'));equalList(await all(),before.records);
        await load(before.primary);await load(before.secondary);await load(before.unrelated);await load(before.primary);
        await source("console.log('restart-after-save');",before.primary.filename);const updated=(await save()).record;
        assert.equal(updated.id,before.primary.id);assert.equal(updated.revision,before.primary.revision+1);assert.equal(updated.code,"console.log('restart-after-save');");
        equalList(await all(),before.records.map(record=>record.id===updated.id?updated:record));
        assert(!report.writes.some(row=>row.method==='DELETE'));assert.equal(report.duplicate_actions,0);assert.equal(report.delete_actions,0);assert.equal(report.run_button_clicks,0);
        const clicks=await page.evaluate(()=>window.__cwObservedActionClicks);assert.deepEqual(clicks,{run:0,duplicate:0,delete:0});
        return {updated,secondary_unchanged:true,unrelated_unchanged:true,full_list_exact:true,run_not_used:true,observed_action_clicks:clicks,overlay:report.capability_overlay??null};
      });
    }else{
      await check('normal_delete_confirmation_cancel_and_confirm_only',async()=>{
        const target=(await create('QC Delete Target','qc-delete.js',"console.log('delete-original');")).record;
        const sibling=(await create('QC Delete Sibling','qc-sibling.js',"console.log('keep-sibling');")).record;
        const before=await all();await load(target);const writesBefore=report.writes.length;acceptDialog=false;
        await page.getByRole('button',{name:'Delete',exact:true}).click();acceptDialog=true;
        equalList(await all(),before);assert.equal(report.writes.length,writesBefore);assert.equal(report.dialogs.at(-1).accepted,false);
        await page.reload();equalList(await all(),before);await load(target);await load(sibling);const observed=await deleteUI(target);
        equalList(await all(),before.filter(record=>record.id!==target.id));await page.reload();equalList(await all(),before.filter(record=>record.id!==target.id));await load(sibling);
        return {target,sibling,observed_delete:observed,cancel_no_write:true,only_target_removed:true,stale_delete_not_part_of_this_group:true,deleted_update_not_part_of_this_group:true};
      });
      await check('stale_delete_preserves_newer_record_and_current_delete_recovers',async()=>{
        const target=(await create('QC Stale Delete Target','qc-stale-delete.js',"console.log('stale-delete-original');")).record;
        const sibling=(await create('QC Stale Delete Sibling','qc-stale-sibling.js',"console.log('stale-delete-keep');")).record;
        const control=(await create('QC Stale Delete Control','qc-stale-control.js',"console.log('current-delete-control');")).record;
        const beforeControl=await all();const observed=await deleteUI(control);equalList(await all(),beforeControl.filter(record=>record.id!==control.id));
        await load(target);await source("console.log('stale-delete-newer-work');",target.filename);const current=(await save()).record;assert(current.revision>target.revision);
        const beforeRefusal=await all();const refused=await replay(deletionFor(observed,current,target.revision));assert(!refused.ok);assert(/conflict|changed|revision/i.test(refused.data.error));equalList(await all(),beforeRefusal);
        await page.reload();await load(current);const recovered=await replay(deletionFor(observed,current,current.revision));assert(recovered.ok);equalList(await all(),beforeRefusal.filter(record=>record.id!==current.id));await page.reload();equalList(await all(),beforeRefusal.filter(record=>record.id!==current.id));await load(sibling);
        return {old:target,current,sibling,observed_delete:observed,refused,recovered,no_mutation_on_refusal:true,confirmation_behavior_not_graded:true};
      });
      await check('deleted_identity_update_cannot_recreate_record',async()=>{
        const target=(await create('QC Removed Identity','qc-removed.js',"console.log('removed-original');")).record;
        const sibling=(await create('QC Removed Identity Sibling','qc-removed-sibling.js',"console.log('removed-keep');")).record;
        await load(target);await source("console.log('removed-update-control');",target.filename);const update=await save();const current=update.record;
        const validOperation={...update.request,body:{...update.request.body,title:'QC Removed Identity Attempt',filename:'qc-removed.js',revision:current.revision,code:"console.log('must-not-recreate');"}};
        const beforeDelete=await all();const observed=await deleteUI(current);const remaining=beforeDelete.filter(record=>record.id!==current.id);equalList(await all(),remaining);
        const refused=await replay(validOperation);assert(!refused.ok);assert(typeof refused.data.error==='string'&&refused.data.error.length>0);equalList(await all(),remaining);await page.reload();equalList(await all(),remaining);await load(sibling);
        await source("console.log('removed-sibling-still-editable');",sibling.filename);const recovered=(await save()).record;assert.equal(recovered.id,sibling.id);assert.equal(recovered.revision,sibling.revision+1);await page.reload();await load(recovered);equalList(await all(),remaining.map(record=>record.id===sibling.id?recovered:record));
        return {deleted:current,sibling,observed_delete:observed,observed_successful_update:update.request,rejected_current_revision_update:validOperation,refused,sibling_recovered:recovered,no_recreation:true,confirmation_behavior_not_graded:true};
      });
    }
    assert.deepEqual(report.browserErrors,[]);report.passed=true;console.log(JSON.stringify(report));
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
