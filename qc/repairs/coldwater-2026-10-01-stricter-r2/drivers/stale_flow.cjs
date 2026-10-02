'use strict';
const assert=require('node:assert/strict');
const {GoldenBrowser}=require('./workflow_core.cjs');
const {capture}=require('./lifecycle_flow.cjs');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const feedback=async d=>({status:await d.status(),alerts:await d.page.locator('[role="alert"]:visible').allInnerTexts(),console_rows:await d.page.getByRole('log').locator('.entry').allInnerTexts()});
const delta=(a,b)=>[a.status===b.status?'':b.status,...b.alerts.filter(x=>!a.alerts.includes(x)),...b.console_rows.slice(a.console_rows.length)].join('\n');
async function runStale(d,l,inputs,emit,state={}){
 const base=(await d.create({title:'QC Concurrent Save',filename:'qc-concurrent.js',code:"console.log('base-version');"})).record;
 const context=await d.page.context().browser().newContext({viewport:{width:1440,height:1000}}),other=new GoldenBrowser(await context.newPage(),l,d.url),cycles=[];
 const publish=()=>{
  const both=cycles.length===2;
  emit('S23.stale_save_server_refusal',both&&cycles.every(x=>x.refusal_pass),{cycles,observed_before_later_save:true});
  emit('S23.stale_save_draft_preservation',both&&cycles.every(x=>x.preservation_pass),{cycles,observed_before_deliberate_reload:true});
 };
 try{
  await other.open();await other.disableAutoIfAvailable();other.libraryUrl=d.libraryUrl;
  for(const[index,stale,winner]of [[0,other,d],[1,d,other]]){
   const row={trial:index+1,roles_reversed:index===1};cycles.push(row);
   const dirty=index===0?{title:'QC Concurrent Save Draft',filename:'qc-concurrent-draft.js',code:"console.log('stale-overwrite');"}:{title:'QC Reverse Draft',filename:'qc-reverse-draft.js',code:"console.log('reverse-unsaved');"};
   row.recorded_dirty=dirty;
   const setup=await capture(async()=>{
    const current=(await d.library()).find(x=>x.id===base.id);assert(current,'Concurrent identity absent');row.baseline=current;
    await stale.reload();await stale.disableAutoIfAvailable();await stale.load(current);await stale.title().fill(dirty.title);await stale.enter(dirty.code,dirty.filename);row.pre_attempt_dirty=await stale.fields();
    await winner.reload();await winner.disableAutoIfAvailable();await winner.load(current);
    await winner.title().fill(index===0?'QC Concurrent Save Updated':'QC Reverse Winner');
    await winner.enter(index===0?'<!doctype html><html><body>first-editor-won</body></html>':'<!doctype html><html><body>second-editor-won</body></html>',index===0?'qc-concurrent.html':'qc-reverse-winner.html');
    const newer=await winner.save(),fresh=(await d.library()).find(x=>x.id===base.id);row.newer=newer;row.winner_fresh=fresh;
    assert(newer.record.id===current.id&&newer.record.revision>current.revision&&same(fresh,newer.record));return newer;
   });row.setup=setup;
   if(index===0&&setup.ok&&state.basicSave)emit('S21.saved_record_fidelity',true,{alpha:state.basicSave.alpha,beta:state.basicSave.beta,current_update:{old:row.baseline,newer:setup.value.record,same_identity:true},current_update_control_pending_S23:false});
   row.refusal_pass=false;row.preservation_pass=false;
   if(setup.ok){
    row.feedback_before=await feedback(stale);
    row.attempt=await capture(async()=>{
     const button=stale.page.getByRole('button',{name:'Save',exact:true});
     if(await button.isEnabled())return stale.captureMutation('stale_save',()=>button.click(),['PUT','PATCH']);
     return stale.replay({...setup.value.operation,body:{...setup.value.operation.body,...dirty,revision:row.baseline.revision}});
    });
    row.feedback_after=await feedback(stale);row.fresh_feedback=delta(row.feedback_before,row.feedback_after);row.retained=await stale.fields();row.after_attempt=(await d.library()).find(x=>x.id===base.id);
    row.refusal_pass=Boolean(row.attempt.ok&&!row.attempt.value.ok&&row.attempt.value.data?.error&&same(row.after_attempt,setup.value.record));
    row.preservation_pass=same(row.retained,dirty)&&/conflict|changed|another|reload[^\n]*revision|revision[^\n]*(?:stale|mismatch|out.of.date)/i.test(row.fresh_feedback);
   }
   // Write the established pre-reload fields before executing later recovery.
   publish();
   row.recovery=await capture(async()=>{
    const current=(await d.library()).find(x=>x.id===base.id);assert(current,'Current identity absent for reapply');
    await stale.reload();await stale.disableAutoIfAvailable();await stale.load(current);await stale.title().fill(dirty.title);await stale.enter(dirty.code,dirty.filename);
    const saved=await stale.save();await stale.reload();await stale.load(saved.record);const fields=await stale.fields(),fresh=(await d.library()).find(x=>x.id===base.id);
    assert(saved.record.id===current.id&&saved.record.revision>current.revision&&same(fields,dirty)&&same(fresh,saved.record));
    return {before:current,saved,fields,fresh,used_recorded_pre_attempt_draft:true};
   });
  }
  publish();emit('S23.stale_save_reapply',cycles.length===2&&cycles.every(x=>x.recovery.ok),{cycles,earlier_verdicts_not_inherited:true});
 }finally{await context.close();}
}
module.exports={runStale};
