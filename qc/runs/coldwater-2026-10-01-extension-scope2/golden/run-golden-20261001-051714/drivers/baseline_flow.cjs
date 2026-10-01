'use strict';
const assert=require('node:assert/strict');
const {exactList}=require('./workflow_core.cjs');

// Intentionally parameterized: these provisional plumbing observations are not
// bound to any rewritten criterion until the parent freezes the shared fixtures.
async function runBaseline(driver,ledger,fixtures){
  assert(fixtures&&fixtures.run&&fixtures.primary&&fixtures.second,'Explicit fixture manifest required');
  const state={};
  await ledger.observe({id:'baseline.manual_run',criterion_ids:[],provisional:true},async()=>{
    await driver.open();await driver.completed();const automatic=await driver.disableAutoIfAvailable();
    const clock=await driver.run(fixtures.run.code,fixtures.run.filename);
    const body=await driver.body(),logs=await driver.logs();
    assert(body.includes(fixtures.run.preview_marker));assert(logs.includes(fixtures.run.console_marker));
    return{automatic,clock,preview_marker:fixtures.run.preview_marker,console_marker:fixtures.run.console_marker};
  });
  await ledger.observe({id:'baseline.two_independent_saves',criterion_ids:[],provisional:true},async()=>{
    state.primary=await driver.create(fixtures.primary);state.second=await driver.create(fixtures.second);
    assert.notEqual(state.primary.record.id,state.second.record.id);
    await driver.load(state.primary.record);await driver.load(state.second.record);
    state.before=await driver.library();
    assert.deepEqual(state.before.find(row=>row.id===state.primary.record.id),state.primary.record);
    assert.deepEqual(state.before.find(row=>row.id===state.second.record.id),state.second.record);
    return {primary:state.primary,second:state.second,full_list:state.before};
  });
  await ledger.observe({id:'baseline.reload_exact_reads',criterion_ids:[],provisional:true},async()=>{
    assert(state.before,'Successful record setup unavailable');
    await driver.reload();await driver.load(state.primary.record);await driver.load(state.second.record);exactList(await driver.library(),state.before);
    return{primary_id:state.primary.record.id,second_id:state.second.record.id,exact_fields_and_full_list:true};
  });
  return state;
}

module.exports={runBaseline};
