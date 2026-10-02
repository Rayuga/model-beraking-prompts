'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {GoldenBrowser,exactList}=require('./workflow_core.cjs');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const record=(title,filename,code)=>({title,filename,code});
const feedbackSnapshot=async browser=>({status:await browser.status(),alerts:await browser.page.locator('[role="alert"]:visible').allInnerTexts(),console_rows:await browser.page.getByRole('log').locator('.entry').allInnerTexts()});
const newFeedback=(before,after)=>({status:after.status===before.status?'':after.status,alerts:after.alerts.filter(text=>!before.alerts.includes(text)),console_rows:after.console_rows.slice(before.console_rows.length)});
const feedbackText=feedback=>[feedback.status,...feedback.alerts,...feedback.console_rows].join('\n');

async function runLibraryScenario(id,d,l,inputs,emit,state){
  if(id==='S23')return require('./stale_flow.cjs').runStale(d,l,inputs,emit,state);
  const p=d.page,say=(key,pass,evidence)=>emit(id+'.'+key,Boolean(pass),evidence);
  const create=async(title,filename,code)=>(await d.create(record(title,filename,code))).record;
  const update=async(current,code,file=current.filename,title=current.title)=>{await d.load(current);await d.title().fill(title);await d.enter(code,file);return d.save();};
  const rename=async(current,title)=>{await d.load(current);d.dialogPolicy.prompt=title;const observed=await d.captureMutation('rename',()=>p.getByRole('button',{name:'Rename',exact:true}).click(),['PUT','PATCH']);return{...observed,record:observed.data};};
  const duplicate=async(current,title)=>{await d.load(current);d.dialogPolicy.prompt=title;const observed=await d.captureMutation('duplicate',()=>p.getByRole('button',{name:'Duplicate',exact:true}).click(),['POST']);return{...observed,record:observed.data};};
  const remove=async current=>{await d.load(current);d.dialogPolicy.accept=true;const observed=await d.captureMutation('delete',()=>p.getByRole('button',{name:'Delete',exact:true}).click(),['DELETE']);assert(observed.ok,JSON.stringify(observed));return observed;};
  const fresh=async current=>(await d.library()).find(row=>row.id===current.id);
  const useful=result=>typeof result.data?.error==='string'&&result.data.error.length>0;
  const revisioned=(operation,current,fields={})=>({...operation,body:{...operation.body,title:current.title,filename:current.filename,code:current.code,revision:current.revision,...fields}});
  const deleteFor=(observed,control,current,revision)=>{assert(observed.operation.url.endsWith('/'+control.id));return{...observed.operation,url:observed.operation.url.slice(0,-String(control.id).length)+current.id,body:{...observed.operation.body,revision}};};
  const upload=async(name,code)=>l.action('import','Import actual in-memory source file',()=>p.locator('input[type="file"]').setInputFiles({name,mimeType:'text/plain',buffer:Buffer.from(code)}));
  const clearDialogs=()=>l.report.dialogs.length;

  if(id==='S21'){
    const alpha=await create('QC Save Alpha','qc-alpha.js',"console.log('alpha-body');"),beta=await create('QC Save Alpha','qc-beta.html','<!doctype html><html><body><p>beta-body</p></body></html>');
    await d.load(alpha);await d.load(beta);const before=await d.library();state.basicSave={alpha,beta,before};
    say('saved_record_fidelity',alpha.id!==beta.id&&same(await fresh(alpha),alpha)&&same(await fresh(beta),beta),{alpha,beta,current_update_control_pending_S23:true});
    await d.reload();await d.load(alpha);await d.load(beta);exactList(await d.library(),before);say('saved_records_browser_reload',true,{alpha,beta,full_list_exact:true});
  }else if(id==='S22'){
    if(inputs.phase==='pre'){
      state.restart_examples=await require('./restart_examples.cjs').prepareExamples(d);
      let primary=null,second=null,records=null;const setupErrors=[];
      const exactFields=(saved,title,filename,code)=>assert.deepEqual(record(saved.title,saved.filename,saved.code),record(title,filename,code));
      try{primary=await create('QC Restart Primary','qc-restart.js',"console.log('restart-original');");exactFields(primary,'QC Restart Primary','qc-restart.js',"console.log('restart-original');");}catch(error){setupErrors.push({stage:'save Primary',error:String(error)});}
      try{second=await create('QC Restart Second','qc-second.css','body { color: rgb(23, 45, 67); }');exactFields(second,'QC Restart Second','qc-second.css','body { color: rgb(23, 45, 67); }');}catch(error){setupErrors.push({stage:'save CSS Second',error:String(error)});}
      if(primary){try{const updated=(await update(primary,"console.log('restart-before-restart');")).record;assert(updated.id===primary.id&&updated.revision>primary.revision);exactFields(updated,primary.title,primary.filename,"console.log('restart-before-restart');");primary=updated;}catch(error){setupErrors.push({stage:'update Primary',error:String(error)});}}
      try{records=await d.library();}catch(error){setupErrors.push({stage:'record library',error:String(error)});}
      for(const [name,saved]of [['Primary',primary],['CSS Second',second]])if(saved){try{await d.load(saved);}catch(error){setupErrors.push({stage:'load '+name,error:String(error)});}}
      state.restart={primary,second,records,library_url:d.libraryUrl,setup_errors:setupErrors};
      return {restart_ready:true};
    }
    const examples=await require('./restart_examples.cjs').compareExamples(d,state.restart_examples,inputs.actual_restart);
    say('restart_example_inventory',examples.pass,examples.evidence);
    const before=state.restart;assert(before&&inputs.actual_restart?.succeeded&&inputs.actual_restart.actual_calls===1,'One actual canonical process restart is required');d.libraryUrl=before.library_url;
    let afterRestart=[];const durabilityErrors=[...(before.setup_errors??[])];
    try{afterRestart=await d.library();assert(Array.isArray(before.records),'Complete pre-restart record inventory missing');exactList(afterRestart,before.records);}catch(error){durabilityErrors.push({stage:'restart library readback',error:String(error)});}
    for(const [name,saved]of [['Primary',before.primary],['CSS Second',before.second]]){
      try{assert(saved,'Required saved-record control missing');await d.load(saved);}catch(error){durabilityErrors.push({stage:'restart load '+name,error:String(error)});}
    }
    say('process_restart_durability',durabilityErrors.length===0,{before,after_restart:afterRestart,actual_restart:inputs.actual_restart,errors:durabilityErrors,recorded_before_later_write:true});
    try{
    let writeBase=before.primary?afterRestart.find(row=>row.id===before.primary.id):null,fallback=false;
    if(writeBase){try{await d.load(writeBase);}catch{writeBase=null;}}
    if(!writeBase){fallback=true;writeBase=await create('QC Restart Write Control','qc-restart-write.js',"console.log('restart-write-control');");}
    const beforeWrite=await d.library();
    const updated=(await update(writeBase,"console.log('restart-after-save');")).record;assert(updated.id===writeBase.id&&updated.revision>writeBase.revision);assert.deepEqual(record(updated.title,updated.filename,updated.code),record(writeBase.title,writeBase.filename,"console.log('restart-after-save');"));
    const afterWrite=await d.library();exactList(afterWrite,beforeWrite.map(row=>row.id===updated.id?updated:row));await d.load(updated);
    say('process_restart_write',true,{before:writeBase,updated,after_write:afterWrite,actual_restart:inputs.actual_restart,fallback_used:fallback,unrelated_exact:true});
    }catch(error){say('process_restart_write',false,{actual_restart:inputs.actual_restart,error:String(error)});}
  }else if(id==='S24'){
    const source=await create('  QC Rename Source  ','qc-rename-a.js',"console.log('rename-source');"),sibling=await create('QC Rename Sibling','qc-rename-b.js',"console.log('rename-sibling');");
    const renamed=await rename(source,'  QC Rename Source Renamed  ');assert(renamed.ok);await d.reload();await d.load(renamed.record);const current=await fresh(renamed.record);
    say('title_trimming',source.title==='QC Rename Source'&&current.title==='QC Rename Source Renamed',{created:source,renamed:current});
    say('rename_title_only',current.id===source.id&&current.filename===source.filename&&current.code===source.code&&same(await fresh(sibling),sibling),{before:source,after:current,sibling_unchanged:true});
    const before=await d.library(),collision=await rename(current,sibling.title);let after=await d.library();const uiNoMutation=same(after,before),padded=await d.replay(revisioned(renamed.operation,current,{title:'  '+sibling.title+'  '}));after=await d.library();
    say('title_collision_refusal',!collision.ok&&useful(collision)&&uiNoMutation&&!padded.ok&&useful(padded)&&same(after,before),{ui:collision,padded,records_unchanged:same(after,before)});
    const empty=[];for(const title of ['','   ']){const rejected=await d.replay(revisioned(renamed.operation,current,{title}));empty.push({title,rejected,unchanged:same(await d.library(),before)});}
    say('title_empty_rejected',empty.every(row=>!row.rejected.ok&&useful(row.rejected)&&row.unchanged),{attempts:empty});
    const lower=await create('qc rename sibling','qc-rename-case.js',"console.log('case-sibling');");await d.load(sibling);await d.load(lower);
    const recovered=await rename(current,'QC Rename Recovered');assert(recovered.ok);
    say('title_case_sensitive',lower.id!==sibling.id&&same(await fresh(sibling),sibling)&&same(await fresh(lower),lower),{upper:sibling,lower,recovered:recovered.record});
  }else if(id==='S25'){
    const base=await create('QC Stale Rename Base','qc-stale-rename.js',"console.log('stale-rename-original');"),newer=await rename(base,'QC Stale Rename Current');assert(newer.ok);const current=newer.record;
    const stale=await d.replay(revisioned(newer.operation,base,{title:'QC Stale Rename Rejected'}));const unchanged=same(await fresh(current),current);await d.reload();const recovered=await rename(current,'QC Stale Rename Recovered');assert(recovered.ok);
    say('stale_rename_refusal',!stale.ok&&useful(stale)&&unchanged&&recovered.record.id===base.id&&recovered.record.revision>current.revision&&recovered.record.code===base.code,{base,current,stale,unchanged,recovered:recovered.record});
  }else if(id==='S26'){
    const original=await create('QC Duplicate Original','qc-dup.js',"console.log('original-copy-source');"),copied=await duplicate(original,'QC Duplicate Copy');assert(copied.ok);const copy=copied.record;
    say('duplicate_initial_fidelity',copy.id!==original.id&&copy.filename===original.filename&&copy.code===original.code&&copy.title==='QC Duplicate Copy',{original,copy});
    const editedOriginal=(await update(original,"console.log('original-edited-independently');")).record;await d.reload();await d.load(copy);const copyUnaffected=same(await fresh(copy),copy);
    const editedCopy=(await update(copy,"console.log('copy-edited-source');")).record;await d.reload();await d.load(editedOriginal);await d.load(editedCopy);
    say('duplicate_edit_independence',copyUnaffected&&same(await fresh(editedOriginal),editedOriginal)&&same(await fresh(editedCopy),editedCopy),{edited_original:editedOriginal,edited_copy:editedCopy,copy_unaffected_by_original_edit:copyUnaffected});
    const before=await d.library(),refused=await d.replay({...copied.operation,body:{...copied.operation.body,title:copy.title}}),unchanged=same(await d.library(),before);const extra=await duplicate(editedOriginal,'QC Duplicate Extra');
    say('duplicate_collision_refusal',!refused.ok&&useful(refused)&&unchanged&&extra.ok,{refused,unchanged,extra:extra.record});
  }else if(id==='S27'){
    const target=await create('QC Delete Target','qc-delete.js',"console.log('delete-original');"),sibling=await create('QC Delete Sibling','qc-sibling.js',"console.log('keep-sibling');"),before=await d.library();
    await d.load(target);const dialogStart=clearDialogs();d.dialogPolicy.accept=false;await l.action('delete_cancel','Request deletion and cancel offered confirmation',()=>p.getByRole('button',{name:'Delete',exact:true}).click());d.dialogPolicy.accept=true;
    await d.reload();const afterCancel=await d.library(),cancelDialogs=l.report.dialogs.slice(dialogStart);say('delete_confirmation_cancel',cancelDialogs.some(row=>row.type==='confirm'&&!row.accepted)&&same(before,afterCancel),{dialogs:cancelDialogs,full_list_unchanged:same(before,afterCancel)});
    const deleted=await remove(target),expected=before.filter(row=>row.id!==target.id);exactList(await d.library(),expected);await d.reload();exactList(await d.library(),expected);await d.load(sibling);
    say('delete_confirmed_selected_only',true,{deleted:deleted.operation,target_id:target.id,sibling,only_target_removed:true});
  }else if(id==='S28'){
    const target=await create('QC Stale Delete Target','qc-stale-delete.js',"console.log('stale-delete-original');"),sibling=await create('QC Stale Delete Sibling','qc-stale-sibling.js',"console.log('stale-delete-keep');"),control=await create('QC Stale Delete Control','qc-stale-control.js',"console.log('current-delete-control');");
    const controlDelete=await remove(control),current=(await update(target,"console.log('stale-delete-newer-work');")).record,before=await d.library();
    const refused=await d.replay(deleteFor(controlDelete,control,current,target.revision)),unchanged=same(await d.library(),before);await d.reload();await d.load(current);
    const recovered=await d.replay(deleteFor(controlDelete,control,current,current.revision));assert(recovered.ok);await d.reload();exactList(await d.library(),before.filter(row=>row.id!==current.id));await d.load(sibling);
    say('stale_delete_refusal',!refused.ok&&useful(refused)&&unchanged&&recovered.ok,{old:target,current,refused,unchanged,recovered,confirmation_not_graded:true});
  }else if(id==='S29'){
    const target=await create('QC Removed Identity','qc-removed.js',"console.log('removed-original');"),sibling=await create('QC Removed Identity Sibling','qc-removed-sibling.js',"console.log('removed-keep');"),updated=await update(target,"console.log('removed-update-control');"),current=updated.record;
    const before=await d.library();await remove(current);const remaining=before.filter(row=>row.id!==current.id);exactList(await d.library(),remaining);
    const refused=await d.replay(revisioned(updated.operation,current,{title:'QC Removed Identity Attempt',code:"console.log('must-not-recreate');"}));const unchanged=same(await d.library(),remaining);await d.reload();exactList(await d.library(),remaining);
    const recovered=(await update(sibling,"console.log('removed-sibling-still-editable');")).record;await d.reload();await d.load(recovered);
    say('deleted_identity_update_refusal',!refused.ok&&useful(refused)&&unchanged&&recovered.id===sibling.id&&recovered.revision>sibling.revision,{deleted:current,refused,remaining_unchanged:unchanged,sibling_recovered:recovered});
  }else if(id==='S30'){
    const base=await create('QC Dirty Base','qc-dirty.js',"console.log('dirty-original');"),destination=await create('QC Dirty Destination','qc-destination.js',"console.log('dirty-destination');");
    const dirty=record('QC Dirty Unsaved','qc-dirty-unsaved.js',"console.log('dirty-unsaved');"),identity=[];
    const dirtyText=async()=>p.locator('.editor > .paneheading').innerText();
    for(const field of ['code','title','filename']){await d.load(base);if(field==='code')await d.enter(dirty.code,base.filename);if(field==='title')await d.title().fill(dirty.title);if(field==='filename')await d.filename().fill(dirty.filename);const heading=await dirtyText();identity.push({field,heading,dirty:/dirty|unsaved|\*/i.test(heading)});}
    say('dirty_workspace_identity',identity.every(row=>row.dirty),{base,observations:identity});
    const option=await p.getByRole('combobox',{name:'Starter example',exact:true}).locator('option').evaluateAll(options=>options.find(option=>option.value)?.value);assert(option);
    const actions={saved:()=>d.load(destination),example:()=>p.getByRole('combobox',{name:'Starter example',exact:true}).selectOption(option),new:()=>d.newDraft(),import:()=>upload('cw-dirty-import.js',"console.log('dirty-import-destination');")};
    const observations=[];
    for(const[name,action]of Object.entries(actions)){
      await d.load(base);await d.title().fill(dirty.title);await d.enter(dirty.code,dirty.filename);const before=await d.fields();d.dialogPolicy.accept=false;const start=clearDialogs();
      // Loading a canceled destination intentionally cannot assert destination fields.
      const trigger=name==='saved'?()=>p.locator('.snippetlist button').filter({hasText:destination.title}).click():action;
      await trigger();const afterCancel=await d.fields(),dialogs=l.report.dialogs.slice(start);d.dialogPolicy.accept=true;await trigger();const accepted=await d.fields();
      const arrived=name==='saved'?same(accepted,record(destination.title,destination.filename,destination.code)):name==='example'?accepted.filename===option:name==='import'?accepted.filename==='cw-dirty-import.js'&&accepted.code==="console.log('dirty-import-destination');":!same(accepted,before)&&!((await dirtyText()).includes('revision '+base.revision));
      observations.push({name,before,after_cancel:afterCancel,dialogs,accepted,arrived,protected:dialogs.some(row=>row.type==='confirm'&&!row.accepted)&&same(before,afterCancel)});
    }
    const lone=[];for(const field of ['title','filename']){await d.load(base);if(field==='title')await d.title().fill('QC Dirty Title Only');else await d.filename().fill('qc-dirty-filename-only.js');const before=await d.fields(),start=clearDialogs();d.dialogPolicy.accept=false;await d.newDraft();d.dialogPolicy.accept=true;lone.push({field,before,after:await d.fields(),dialogs:l.report.dialogs.slice(start)});}
    await d.load(base);const savedUnchanged=same(await fresh(base),base);if(savedUnchanged)state.cleanDirtyBase=base;
    say('dirty_transition_protection',observations.every(row=>row.protected)&&lone.every(row=>same(row.before,row.after)&&row.dialogs.some(dialog=>dialog.type==='confirm'&&!dialog.accepted)),{observations,lone_field_cycles:lone});
    say('dirty_transition_acceptance',observations.every(row=>row.arrived)&&savedUnchanged,{destinations:observations.map(row=>({name:row.name,arrived:row.arrived,fields:row.accepted})),saved_base_unchanged:savedUnchanged});
  }else if(id==='S31'){
    const base=state.cleanDirtyBase&&same(await fresh(state.cleanDirtyBase),state.cleanDirtyBase)?state.cleanDirtyBase:await create('QC Native Leave','qc-native-leave.js',"console.log('native-leave-original');");await d.load(base);const cleanStart=clearDialogs();await d.reload();const cleanDialogs=l.report.dialogs.slice(cleanStart);await d.load(base);await d.disableAutoIfAvailable();
    await d.editor().click();await p.keyboard.press('End');await p.keyboard.type(' // dirty native keyboard');const dirty=await d.fields();d.dialogPolicy.accept=false;const start=clearDialogs();let canceledError=null;
    try{await l.action('native_reload_cancel','Request native reload and dismiss',()=>p.reload({timeout:1500,waitUntil:'domcontentloaded'}));}catch(error){canceledError=String(error);}
    d.dialogPolicy.accept=true;const retained=await d.fields(),cancelDialogs=l.report.dialogs.slice(start);const acceptedStart=clearDialogs();await d.reload();const acceptedDialogs=l.report.dialogs.slice(acceptedStart);await d.load(base);
    say('native_dirty_leave_protection',!cleanDialogs.some(row=>row.type==='beforeunload')&&cancelDialogs.some(row=>row.type==='beforeunload'&&!row.accepted)&&same(dirty,retained)&&acceptedDialogs.some(row=>row.type==='beforeunload'&&row.accepted)&&same(await fresh(base),base),{cleanDialogs,dirty,retained,cancelDialogs,canceledError,acceptedDialogs,saved_unchanged:true});
  }else if(id==='S32'){
    await d.newDraft();const code="console.log('export-me-body');";await d.enter(code,'export-me.js');const pending=p.waitForEvent('download');pending.catch(()=>{});await l.action('export','Export through app control',()=>p.getByRole('button',{name:'Export file',exact:true}).click());const download=await pending,downloadPath=await download.path(),text=fs.readFileSync(downloadPath,'utf8');
    say('export_exact_source_file',download.suggestedFilename()==='export-me.js'&&text===code,{actual_filename:download.suggestedFilename(),source:text});
  }else if(id==='S33'){
    const previous=await d.fields(),reuse=state.currentLastGood?.completed&&await d.body()===state.currentLastGood.body;await d.newDraft();
    if(reuse)await d.enter(previous.code,previous.filename);else await d.run("document.body.innerHTML='<p>import-good-preview</p>';console.log('import-good-log');",'import-control.js');
    await d.title().fill('QC Import Preview Control');await d.save();const control=await d.body();
    const code="document.body.innerHTML='<p>import-executed-marker</p>';\nconsole.log('import-executed-log');";await upload('import-me.js',code);const imported=await d.fields();await l.wait(p,2100,'Imported source must remain unexecuted with Auto-run off');const beforeRun={body:await d.body(),logs:await d.logs()};await d.run();const executed={body:await d.body(),logs:await d.logs()};
    say('import_off_no_execution',beforeRun.body===control&&!beforeRun.logs.includes('import-executed-log')&&executed.body.includes('import-executed-marker')&&executed.logs.includes('import-executed-log'),{control,before_run:beforeRun,executed});
    await d.title().fill('QC Imported File');const saved=await d.save();await d.reload();await d.load(saved.record);const beforeInvalid=await d.fields(),feedbackBefore=await feedbackSnapshot(d);await upload('notes.txt','unrelated text');const feedbackAfter=await feedbackSnapshot(d),invalidFeedback=newFeedback(feedbackBefore,feedbackAfter),afterInvalid=await d.fields();
    say('import_unsupported_extension',same(beforeInvalid,afterInvalid)&&/supported|extension|\.js|\.html|\.css/i.test(feedbackText(invalidFeedback)),{before:beforeInvalid,after:afterInvalid,feedback_before:feedbackBefore,feedback_after:feedbackAfter,new_feedback:invalidFeedback});
    let current=await fresh(saved.record);const observations=[];
    // Observe an actual successful update shape before the direct validation probes.
    const updateControl=await update(current,current.code);current=updateControl.record;
    for(const filename of ['unsupported.txt','nested/demo.js']){const before=await d.library(),response=await d.replay(revisioned(updateControl.operation,current,{filename}));const after=await d.library();observations.push({filename,response,unchanged:same(before,after)});current=after.find(row=>row.id===current.id);}
    const extension=observations.find(row=>row.filename==='unsupported.txt'),single=observations.find(row=>row.filename==='nested/demo.js');
    // Both split and former joined evidence names are recorded until final mapping.
    say('saved_filename_validation',observations.every(row=>!row.response.ok&&useful(row.response)&&row.unchanged),{observations});
    say('saved_filename_extension_rejection',!extension.response.ok&&useful(extension.response)&&extension.unchanged,extension);
    say('saved_filename_path_rejection',!single.response.ok&&useful(single.response)&&single.unchanged,single);
    await d.load(current);await upload('import-me.JS',code);const uppercaseImport=await d.fields(),importCase=uppercaseImport.filename==='import-me.JS'&&uppercaseImport.code===code;
    // Restore the independently saved target before testing uppercase saving.
    await d.load(current);await d.enter("console.log('import-edited-body');",'import-me.JS');const upperSaved=await d.save();await d.reload();await d.load(upperSaved.record);
    say('source_file_extension_case',importCase&&upperSaved.record.filename==='import-me.JS',{uppercase_import:uppercaseImport,uppercase_saved:upperSaved.record});
    const lowerSaved=(await update(upperSaved.record,"console.log('import-edited-body');",'import-me.js')).record;await d.reload();await d.load(lowerSaved);
    say('supported_file_import',imported.filename==='import-me.js'&&imported.code===code&&lowerSaved.code==="console.log('import-edited-body');",{imported,initial_saved:saved.record,edited_saved:lowerSaved});
  }else throw Error('Unsupported library scenario '+id);
}
module.exports={runLibraryScenario};
