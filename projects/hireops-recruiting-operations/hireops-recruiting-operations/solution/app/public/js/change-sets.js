'use strict';
window.renderChangeSets = function(boot, H) {
  const {el, money, api, refresh} = H;
  const canWrite = boot.user && boot.user.role === 'finance_controller';
  const page = el('section', {class:'page', 'data-workspace':'changes'}, [
    el('h1', {text:'Coordinated Changes'}),
    el('p', {class:'muted', text:'Review several compensation changes together. Previewing reserves nothing; commit posts every member together or none.'})]);
  const message = el('p', {role:'status', 'aria-live':'polite'});
  const history = el('section', {class:'panel'}, [el('h2', {text:'Saved previews and original receipts'})]);
  const value = (label, content) => el('div', {class:'kv'}, [el('span', {class:'k',text:label}), el('strong', {class:'v',text:String(content)})]);
  function summary(row) {
    const data = row.receipt || row.preview;
    const box = el('article', {class:'entity', 'data-change-set':row.id}, [
      el('h3', {text:`${row.operation_key}  /  ${row.state}`}),
      value('Change set',row.id), value('Actor',data.actor_name || row.actor_id)]);
    for (const r of data.requisitions) box.append(value(`Headroom  /  ${r.req_id}`,`${money(r.before_headroom_cents)}  ->  ${money(r.after_headroom_cents)}`));
    for (const c of data.changes) {
      const comp = c.proposed || c.after.composition;
      box.append(el('section', {class:'sub'}, [
        el('h4', {text:`${c.candidate || c.before.candidate}  /  ${c.old_offer_id}${c.new_offer_id ? '  ->  '+c.new_offer_id : ''}`}),
        value('Requisition',`${c.source_req_id}  ->  ${c.destination_req_id}`),
        value('Old / new run-rate',`${money(c.before.composition.committed_run_rate_cents)}  ->  ${money(comp.committed_run_rate_cents)}`),
        value('Signing adjustment',money(c.signing_adjustment_cents)),
        value('Replacement equity',`${comp.equity_units} units  /  fair ${money(comp.equity_fair_cents)}  /  strike ${money(comp.equity_strike_cents)}`),
        value('Original grant/start instant',c.before.start_date),
      ]));
    }
    if (canWrite && row.actor_id === boot.user.id) {
      const error = el('p', {class:'error',role:'alert'});
      const button = el('button', {type:'button',class:'action',text:row.state === 'COMMITTED' ? 'Retrieve original receipt' : 'Commit reviewed change'});
      button.addEventListener('click', async () => {
        button.disabled=true; error.textContent=''; message.textContent='Committing this saved operation...';
        const result=await api('POST','/api/change-sets/'+encodeURIComponent(row.id)+'/commit',{});
        button.disabled=false;
        if (!result.ok) { error.textContent=result.data?.error || 'Unable to confirm; retry this same operation.'; message.textContent='Nothing confirmed. Your editor values are retained.'; return; }
        box.replaceWith(summary(result.data)); message.textContent='Committed. This is the original stored receipt; retrying does not post again.'; await refresh();
      });
      box.append(button,error);
    }
    return box;
  }
  if (canWrite) {
    const current=(boot.offers || []).filter(o=>o.status==='COMMITTED');
    const form=el('form',{class:'panel', 'aria-label':'Coordinated change editor'});
    const key=el('input',{type:'text',required:'',value:'change-1'});
    form.append(el('h2',{text:'Prepare a compensation change'}),el('label',{class:'field'},[el('span',{text:'Operation key'}),key]));
    const container=el('div',{class:'changeset-members'}), rows=[];
    const terms=[['base_salary_cents','Base salary'],['signing_bonus_cents','Signing bonus'],['relocation_cents','Relocation'],['equity_units','Equity units'],['equity_fair_cents','Equity fair value'],['equity_strike_cents','Equity strike price']];
    const dollars=n=>{const v=BigInt(n || 0);return `${v/100n}.${String(v%100n).padStart(2,'0')}`;};
    function exact(text,isUnits) {
      if (!(isUnits ? /^\d+$/ : /^\d+(?:\.\d{1,2})?$/).test(text)) throw new Error('Use nonnegative whole shares or money with at most two decimal places.');
      const [a,b='']=text.split('.');const v=isUnits ? BigInt(a) : BigInt(a)*100n+BigInt(b.padEnd(2,'0'));
      if (v>BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('An input exceeds the exact integer range.');return Number(v);
    }
    function addRow() {
      if (rows.length>=4) return;
      const n=rows.length+1, node=el('fieldset',{class:'sub'}), fields={};
      node.append(el('legend',{text:`Member ${n}`}));
      const source=el('select',{'aria-label':`Member ${n} source offer`},current.map(o=>el('option',{value:o.id,text:`${o.id}  /  ${o.candidate}`})));
      if (current.length) source.value=current[(n-1)%current.length].id;
      const dest=el('select',{'aria-label':`Member ${n} destination requisition`},(boot.requisitions || []).map(r=>el('option',{value:r.id,text:`${r.id}  /  ${r.title}`})));
      node.append(el('label',{class:'field'},[el('span',{text:`Member ${n} source offer`}),source]),el('label',{class:'field'},[el('span',{text:`Member ${n} destination requisition`}),dest]));
      const grid=el('div',{class:'form-grid'});
      for (const [name,label] of terms) {
        const input=el('input',{type:'text',inputmode:'decimal',required:''}); fields[name]=input;
        grid.append(el('label',{class:'field'},[el('span',{text:`Member ${n} ${label}${name==='equity_units' ? '' : ' (dollars)'}`}),input]));
      }
      function fill() { const o=current.find(o=>o.id===source.value);if (!o) return;dest.value=o.req_id;for (const [name] of terms) fields[name].value=name==='equity_units' ? String(o.composition[name]) : dollars(o.composition[name]); }
      source.addEventListener('change',fill);fill();node.append(grid);container.append(node);
      rows.push({node,read:()=>({offer_id:source.value,destination_req_id:dest.value,...Object.fromEntries(terms.map(([name])=>[name,exact(fields[name].value,name==='equity_units')]))})});
    }
    addRow();addRow();
    const add=el('button',{type:'button',class:'secondary',text:'Add member',onclick:addRow});
    const remove=el('button',{type:'button',class:'secondary',text:'Remove last member',onclick:()=>{if(rows.length>2) rows.pop().node.remove();}});
    const submit=el('button',{type:'submit',class:'action',text:'Preview coordinated change'});
    const error=el('p',{class:'error',role:'alert'}),preview=el('section',{'aria-label':'Current preview'});
    form.append(container,el('div',{class:'actionbar'},[add,remove,submit]),error);
    form.addEventListener('submit',async e=>{
      e.preventDefault();error.textContent='';let body;
      try {body={operation_key:key.value,members:rows.map(r=>r.read())};}catch(err){error.textContent=err.message;return;}
      submit.disabled=true;message.textContent='Calculating the saved preview...';
      const result=await api('POST','/api/change-sets/preview',body);submit.disabled=false;
      if(!result.ok){error.textContent=result.data?.error || 'Preview could not be saved.';message.textContent='Editor retained. Correct the request or use a new operation key.';return;}
      preview.replaceChildren(summary(result.data));message.textContent='Preview saved. Review the effects before committing; budgets are not reserved.';
    });
    page.append(form,message,preview);
  }
  const reload=el('button',{class:'secondary',type:'button',text:'Reload current offers and history',onclick:()=>refresh()});
  page.append(reload,history);
  for (const row of boot.change_sets || []) history.append(summary(row));
  if (!(boot.change_sets || []).length) history.append(el('p',{text:'No coordinated changes have been prepared.'}));
  return page;
};
