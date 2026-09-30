'use strict';

// Reference-proof infrastructure only. Importing this module opens no browser,
// contacts no server, and writes no files. Scenario definitions arrive at freeze.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');

const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const now = () => Number(process.hrtime.bigint()) / 1e6;
const normalizedRecords = records => [...records].sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, {numeric:true}));
const exactList = (actual, expected) => assert.deepEqual(normalizedRecords(actual), normalizedRecords(expected));

class ObservationLedger {
  constructor(binding = {}) {
    this.started = now();
    this.report = {
      schema_version:1, scope:'Continuous local reference browser proof; no LLM/provider/platform execution',
      started_at:new Date().toISOString(), binding, actions:[], explicit_waits:[], observations:[],
      network:[], dialogs:[], browser_errors:[], status:'not completed', criterion_verdicts_produced:false,
    };
    this.currentObservation = null;
  }
  relative() { return now() - this.started; }
  async action(kind, label, fn) {
    const row = {index:this.report.actions.length, observation:this.currentObservation, kind, label, started_ms:this.relative()};
    this.report.actions.push(row);
    try { const value = await fn(); row.completed=true; return value; }
    catch (error) { row.completed=false; row.error=String(error); throw error; }
    finally { row.finished_ms=this.relative(); row.duration_ms=row.finished_ms-row.started_ms; }
  }
  async wait(page, duration, purpose) {
    assert(Number.isFinite(duration) && duration >= 0 && duration <= 15000, 'Only bounded explicit behavioral waits are accepted');
    const row={observation:this.currentObservation,purpose,requested_ms:duration,started_ms:this.relative()};
    this.report.explicit_waits.push(row);
    await page.waitForTimeout(duration);
    row.finished_ms=this.relative();row.observed_ms=row.finished_ms-row.started_ms;
  }
  async observe(definition, fn) {
    assert(definition && typeof definition.id==='string' && definition.id, 'Observation needs a stable ID');
    assert(!this.report.observations.some(row=>row.id===definition.id), 'Duplicate observation ID');
    const row={...definition,started_ms:this.relative(),action_start:this.report.actions.length,status:'running'};
    this.report.observations.push(row);this.currentObservation=row.id;
    try { row.evidence=await fn();row.status='observed pass'; }
    catch(error) { row.status='observation failed';row.error=String(error);row.error_stack=error.stack; }
    finally {row.finished_ms=this.relative();row.duration_ms=row.finished_ms-row.started_ms;row.action_end=this.report.actions.length;this.currentObservation=null;}
    // Failure is recorded, not thrown across independent observation branches.
    return row;
  }
  unavailable(definition, reason) {
    assert(reason,'An unavailable observation needs an actual reason');
    this.report.observations.push({...definition,status:'tool observation unavailable',reason,started_ms:this.relative(),finished_ms:this.relative()});
  }
  finish(expectedObservationIds = []) {
    const actual = this.report.observations.map(row=>row.id);
    this.report.expected_observation_ids=expectedObservationIds;
    this.report.missing_observations=expectedObservationIds.filter(id=>!actual.includes(id));
    this.report.finished_at=new Date().toISOString();this.report.wall_ms=this.relative();
    this.report.action_counts=Object.fromEntries([...new Set(this.report.actions.map(row=>row.kind))].map(kind=>[kind,this.report.actions.filter(row=>row.kind===kind).length]));
    this.report.status=this.report.missing_observations.length?'incomplete':'completed';
    this.report.all_observations_passed=this.report.status==='completed'&&this.report.observations.length>0&&this.report.observations.every(row=>row.status==='observed pass');
    this.report.timing_note='Observation durations include their nested actions/waits. Do not add both. Browser time is not LLM judge overhead.';
    return this.report;
  }
  write(file) { fs.writeFileSync(file, JSON.stringify(this.report,null,2)+'\n'); }
}

class GoldenBrowser {
  constructor(page, ledger, url) {
    const parsed = new URL(url);
    assert(['localhost','127.0.0.1','[::1]'].includes(parsed.hostname), 'Local disposable app only');
    assert(parsed.port!=='3420', 'The user preview port is explicitly excluded');
    this.page=page;this.ledger=ledger;this.url=parsed.toString();this.origin=parsed.origin;
    this.dialogPolicy={accept:true,prompt:''};this.listCandidates=new Map();this.libraryUrl=null;this.discoveryEnabled=true;
    page.setDefaultTimeout(10000);
    page.on('pageerror', error=>ledger.report.browser_errors.push({at_ms:ledger.relative(),error:String(error)}));
    page.on('dialog', async dialog=>{
      const policy={...this.dialogPolicy};
      ledger.report.dialogs.push({at_ms:ledger.relative(),type:dialog.type(),message:dialog.message(),accepted:policy.accept});
      try {await (policy.accept?dialog.accept(dialog.type()==='prompt'?policy.prompt:undefined):dialog.dismiss());}
      catch(error){ledger.report.browser_errors.push({at_ms:ledger.relative(),error:'Dialog transport: '+String(error)});}
    });
    const requestTimes=new WeakMap();
    page.on('request',request=>requestTimes.set(request,ledger.relative()));
    page.on('response',async response=>{
      const request=response.request(),entry={method:request.method(),url:request.url(),status:response.status(),started_ms:requestTimes.get(request)??null,finished_ms:ledger.relative()};
      if(entry.started_ms!==null)entry.duration_ms=entry.finished_ms-entry.started_ms;
      ledger.report.network.push(entry);
      // List discovery is limited to normal app JSON reads and is switched off
      // before boundary/privacy probing. No probe-response bodies are inspected.
      if(!this.discoveryEnabled || request.method()!=='GET' || new URL(response.url()).origin!==this.origin || !response.headers()['content-type']?.includes('application/json'))return;
      try {
        const data=await response.json();
        if(Array.isArray(data)&&data.every(row=>row&&'id'in row&&'title'in row&&'filename'in row&&'code'in row&&'revision'in row))this.listCandidates.set(response.url(),data);
      } catch {}
    });
  }
  editor(){return this.page.getByRole('textbox',{name:'Code editor',exact:true});}
  title(){return this.page.getByRole('textbox',{name:'Snippet title',exact:true});}
  filename(){return this.page.getByRole('textbox',{name:'Filename',exact:true});}
  preview(){return this.page.frameLocator('iframe[title="Live preview"]');}
  async source(){return (await this.editor().locator('.cm-line').allTextContents()).join('\n');}
  async fields(){return {title:await this.title().inputValue(),filename:await this.filename().inputValue(),code:await this.source()};}
  async logs(){return this.page.getByRole('log').innerText();}
  async status(){return this.page.getByRole('status').innerText();}
  async body(){return this.preview().locator('body').innerText();}
  async completed(){await this.page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent.startsWith('Complete'),null,{timeout:10000});}
  async open(){
    await this.ledger.action('navigate','Open disposable workspace',()=>this.page.goto(this.url));
    await this.editor().waitFor();await this.page.waitForFunction(()=>document.querySelector('[aria-label="Code editor"]')?.textContent.trim().length>0);
  }
  async disableAutoIfAvailable(){
    const control=this.page.getByRole('checkbox',{name:'Auto-run',exact:true});
    if(await control.count()){await this.ledger.action('auto_run_toggle','Disable available Auto-run',()=>control.uncheck());return {available:true,checked:await control.isChecked()};}
    return {available:false};
  }
  async enter(code, filename){
    await this.ledger.action('edit_filename','Enter filename',()=>this.filename().fill(filename));
    await this.ledger.action('edit_source','Enter exact authored source',async()=>{
      await this.editor().click();await this.page.keyboard.press('Control+A');await this.page.keyboard.insertText(code);assert.equal(await this.source(),code);
    });
  }
  async run(code,filename,wait=true){
    if(code!==undefined)await this.enter(code,filename);
    const actionAt=this.ledger.relative();
    await this.ledger.action('manual_run','Activate actual Run',()=>this.page.getByRole('button',{name:/^Run(?:\s|$)/}).click());
    if(wait)await this.completed();
    return {action_at_ms:actionAt,observed_at_ms:this.ledger.relative(),status:await this.status()};
  }
  async newDraft(){await this.ledger.action('new_draft','Create independent new draft',()=>this.page.getByRole('button',{name:'New',exact:true}).click());}
  async captureMutation(kind, trigger, methods=['POST','PUT','DELETE']){
    const pending=this.page.waitForResponse(response=>new URL(response.url()).origin===this.origin&&methods.includes(response.request().method()));
    // Attach the rejection handler immediately; a trigger failure must not leave
    // an unhandled promise rejection from a pending response waiter.
    pending.catch(()=>{});
    await this.ledger.action(kind,kind,trigger);
    const response=await pending,request=response.request();
    let data;try{data=await response.json();}catch{data=null;}
    let body=request.postData();try{body=JSON.parse(body);}catch{}
    return {ok:response.ok(),status:response.status(),data,operation:{method:request.method(),url:request.url(),body,content_type:request.headers()['content-type']??null}};
  }
  async save(){
    const observed=await this.captureMutation('save',()=>this.page.getByRole('button',{name:'Save',exact:true}).click(),['POST','PUT']);
    assert(observed.ok,JSON.stringify(observed.data));assert(observed.data&&'id'in observed.data,'Saved record response absent');
    await this.page.getByRole('status').filter({hasText:/Saved.*revision/}).waitFor();
    const compatible=[...this.listCandidates].filter(([url,rows])=>rows.some(row=>row.id===observed.data.id)||url===observed.operation.url);
    if(compatible.length===1)this.libraryUrl=compatible[0][0];
    return {record:observed.data,operation:observed.operation};
  }
  async create(record){
    await this.newDraft();await this.ledger.action('edit_title','Enter independent saved title',()=>this.title().fill(record.title));
    await this.enter(record.code,record.filename);return this.save();
  }
  async load(record){
    await this.ledger.action('load','Load exact saved record',()=>this.page.locator('.snippetlist button').filter({hasText:record.title}).filter({has:this.page.getByText(record.filename,{exact:true})}).click());
    assert.deepEqual(await this.fields(),{title:record.title,filename:record.filename,code:record.code});
    assert((await this.page.locator('.editor > .paneheading').innerText()).includes('revision '+record.revision));
  }
  stopListDiscovery(){this.discoveryEnabled=false;}
  async library(){
    assert(this.libraryUrl,'No real library read route has been observed; do not guess one');
    return this.ledger.action('read_library','Fresh read of observed public library URL',()=>this.page.evaluate(async url=>{
      const response=await fetch(url);if(!response.ok)throw Error('Observed library read failed: '+response.status);return response.json();
    },this.libraryUrl));
  }
  async replay(operation){
    assert(operation&&new URL(operation.url).origin===this.origin,'Replay must use an observed same-origin operation');
    return this.ledger.action('api_replay','Replay otherwise-valid observed write shape',()=>this.page.evaluate(async operation=>{
      const headers=operation.content_type?{'Content-Type':operation.content_type}:{};
      const response=await fetch(operation.url,{method:operation.method,headers,body:typeof operation.body==='string'?operation.body:JSON.stringify(operation.body)});
      let data;try{data=await response.json();}catch{data=null;}
      return {ok:response.ok,status:response.status,data};
    },operation));
  }
  async reload(){await this.ledger.action('reload','Reload workspace',()=>this.page.reload());await this.editor().waitFor();}
}

module.exports={ObservationLedger,GoldenBrowser,exactList,normalizedRecords,digest,now};
