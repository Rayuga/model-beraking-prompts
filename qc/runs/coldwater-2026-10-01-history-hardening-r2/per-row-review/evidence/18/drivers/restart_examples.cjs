'use strict';
const assert=require('node:assert/strict');

// These selectors adapt the public S22 protocol to this reference app only.
// The product contract does not prescribe a select, example names or ordering.
async function inventory(driver){
  return driver.ledger.action('example_inventory','Record every built-in example choice, excluding saved records and placeholders',async()=>{
    const picker=driver.page.getByRole('combobox',{name:'Starter example',exact:true});
    await picker.waitFor({state:'visible'});
    const rows=await picker.locator('option').evaluateAll(options=>options.map((option,index)=>({index,label:option.textContent.trim(),value:option.value,disabled:option.disabled})).filter(row=>row.value!==''));
    assert(rows.length>0,'No built-in examples were exposed');
    const counts=new Map();
    for(const row of rows){
      // The golden exposes its filename as the option value. Do not count a
      // DOM position as identity or require a particular order after restart.
      const filename=/\.(?:js|html|css)$/i.test(row.value)?row.value:null;
      const key=JSON.stringify([row.label,filename]);
      counts.set(key,(counts.get(key)||0)+1);
    }
    return {count:rows.length,rows,multiplicities:[...counts].sort(([a],[b])=>a.localeCompare(b)),source:'rendered built-in example choices',saved_library_excluded:true};
  });
}

async function prepareExamples(driver){
  const result={inventory:null,positive_control:null,error:null};
  try{
    result.inventory=await inventory(driver);
    const choice=result.inventory.rows.find(row=>!row.disabled);assert(choice,'No selectable example control');
    // Start with different editor contents so this proves an actual selection
    // loads source, rather than mistaking the initial editor for a control.
    const marker='/* independent restart inventory load control */';
    await driver.newDraft();await driver.enter(marker,'qc-inventory-control.js');
    await driver.ledger.action('example_load_control','Choose an actual example and observe its loaded editable source',()=>driver.page.getByRole('combobox',{name:'Starter example',exact:true}).selectOption({index:choice.index}));
    await driver.page.waitForFunction(previous=>{
      const editor=document.querySelector('[aria-label="Code editor"]');
      const source=editor?[...editor.querySelectorAll('.cm-line')].map(line=>line.textContent).join('\n'):'';
      return source.length>0&&source!==previous;
    },marker,{timeout:10000});
    const loaded=await driver.fields(),editable=await driver.editor().getAttribute('contenteditable');
    assert(loaded.code.length>0&&loaded.code!==marker&&editable==='true','Example did not load editable source');
    result.positive_control={choice,loaded,editable:true,prior_source:marker,actual_selection:true};
  }catch(error){result.error=String(error);}
  return result;
}

async function compareExamples(driver,before,actualRestart){
  const evidence={before,after:null,actual_restart:actualRestart,order_required:false,error:null};
  try{
    assert(actualRestart?.succeeded&&actualRestart.actual_calls===1,'One actual completed restart is required');
    evidence.after=await inventory(driver);
    assert(before?.inventory&&before.positive_control&&!before.error,'A complete pre-restart inventory and actual example-load control are required');
    evidence.exact_multiplicities=JSON.stringify(evidence.after.multiplicities)===JSON.stringify(before.inventory.multiplicities);
    evidence.total_before=before.inventory.count;evidence.total_after=evidence.after.count;
    return {pass:evidence.exact_multiplicities,evidence};
  }catch(error){evidence.error=String(error);return {pass:false,evidence};}
}

module.exports={inventory,prepareExamples,compareExamples};
