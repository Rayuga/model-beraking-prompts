(() => {
  let outcomeData=null, worksheetId=null, releasePlan=null;
  window.resetOutcomeTools=()=>{
    outcomeData=null;worksheetId=null;releasePlan=null;
    for (const name of ["outcome-rows","worksheet-rows","release-selection","release-preview"]) $(name).innerHTML="";
    $("commit-release").disabled=true;
  };
  const openers=new Map();
  const show=(name)=>{openers.set(name,document.activeElement);$(name).showModal();};
  for (const name of ["outcome-dialog","weight-dialog","exception-dialog","worksheet-dialog","release-batch-dialog"]) $(name).addEventListener("close",()=>{
    const opener=openers.get(name);
    if (opener?.isConnected && opener.getClientRects().length) opener.focus();
    else document.querySelector('.tab[data-view="gradebook"]').focus();
  });
  window.renderOutcomeTools=()=>{
    const instructor=state.user?.role==="instructor", student=state.user?.role==="student";
    $("open-outcomes").classList.toggle("hidden",!instructor && !student);
    $("open-release-batch").classList.toggle("hidden",!instructor);
    $("outcome-admin").classList.toggle("hidden",!instructor);
    document.querySelector(".outcome-tools").classList.toggle("hidden",!instructor && !student);
  };
  async function loadOutcomes() {outcomeData=await api("/api/outcomes");renderLedger();}
  function renderLedger() {
    const term=$("outcome-search").value.toLowerCase();
    const rows=outcomeData.rows.filter(r=>(r.student.name+" "+r.student.email).toLowerCase().includes(term));
    $("outcome-rows").innerHTML=rows.length ? rows.map(row=>`<article class="outcome-person panel"><header class="panel-heading"><div><h3>${escapeHtml(row.student.name)}</h3><p class="muted">${escapeHtml(row.student.email)}</p></div><div class="score"><strong>${row.final_percentage===null?"Pending":row.final_percentage.toFixed(2)+"%"}</strong><span>${row.included_weight}% included weight</span></div></header><div class="outcome-grid">${row.cells.map(cell=>{const a=outcomeData.assessments.find(a=>a.id===cell.assessment_id);return `<section class="outcome-cell"><h4>${escapeHtml(a.title)}</h4>${status(cell.state)}<p>${cell.awarded===null?"Score not available":`${cell.awarded} / ${cell.maximum}`} · ${cell.weight}% weight</p>${cell.reason?`<p class="muted">${escapeHtml(cell.reason)}</p>`:""}</section>`;}).join("")}</div></article>`).join("") : emptyState("No matching student","Try another name or email.");
  }
  $("open-outcomes").addEventListener("click",async()=>{try{$("outcome-search").value="";$("outcome-error").textContent="";await loadOutcomes();show("outcome-dialog");}catch(e){notify(e.message,"error");}});
  $("outcome-search").addEventListener("input",renderLedger);
  $("edit-weights").addEventListener("click",()=>{
    $("weight-error").textContent="";
    $("weight-rows").innerHTML=outcomeData.assessments.map(a=>`<label>${escapeHtml(a.title)} (%)<input data-weight="${escapeHtml(a.id)}" type="number" min="0" max="100" step="0.01" value="${a.weight}" required /></label>`).join("");
    weightTotal();show("weight-dialog");
  });
  function weightTotal() {const total=[...$("weight-rows").querySelectorAll("input")].reduce((s,e)=>s+Number(e.value),0);$("weight-total").textContent=`Total: ${total.toFixed(2)}% of 100%`;}
  $("weight-form").addEventListener("input",weightTotal);
  async function formWrite(event,errorId,key,path,payload,done) {
    event.preventDefault();const button=event.submitter;button.disabled=true;$(errorId).textContent="";
    try {const result=await mutate(key,path,"PUT",payload);if(!result)return;await loadWorkspace();await done(result);notify("Changes saved.");} catch(e){$(errorId).textContent=e.message;}finally{button.disabled=false;}
  }
  $("weight-form").addEventListener("submit",event=>formWrite(event,"weight-error","weights","/api/outcome-weights",{weights:[...$("weight-rows").querySelectorAll("input")].map(e=>({assessment_id:e.dataset.weight,weight:e.value}))},async()=>{await loadOutcomes();$("weight-dialog").close();}));
  $("edit-exception").addEventListener("click",()=>{
    const form=$("exception-form");form.reset();$("exception-error").textContent="";
    form.elements.student_id.innerHTML=outcomeData.rows.map(r=>`<option value="${r.student.id}">${escapeHtml(r.student.name)}</option>`).join("");
    form.elements.assessment_id.innerHTML=outcomeData.assessments.map(a=>`<option value="${a.id}">${escapeHtml(a.title)}</option>`).join("");show("exception-dialog");
  });
  $("exception-form").addEventListener("submit",event=>{const f=new FormData(event.currentTarget);return formWrite(event,"exception-error","exception","/api/outcome-exceptions",{student_id:f.get("student_id"),assessment_id:f.get("assessment_id"),excused:f.get("excused")==="true",reason:f.get("reason")},async()=>{await loadOutcomes();$("exception-dialog").close();});});
  document.addEventListener("click",event=>{
    const button=event.target.closest("[data-worksheet]");if(!button)return;
    const attempt=state.attempts.find(a=>a.id===button.dataset.worksheet);if(!attempt)return;worksheetId=attempt.id;
    $("worksheet-title").textContent=`Grading worksheet · ${attempt.student.name}`;$("worksheet-error").textContent="";
    $("worksheet-rows").innerHTML=attempt.items.flatMap(item=>item.rubric.map(c=>{const grade=attempt.grades?.find(g=>g.criterion_id===c.id);return `<fieldset class="worksheet-row question" data-criterion="${c.id}"><legend>${escapeHtml(c.label)} · maximum ${c.max_points}</legend><label class="selection-label"><input type="checkbox" data-include checked /> Include this row</label><div class="form-grid"><label>Score<input data-worksheet-score type="number" step="0.01" min="0" max="${c.max_points}" value="${grade?.score ?? ""}" required /></label><label>Feedback<textarea data-worksheet-feedback rows="2">${escapeHtml(grade?.feedback || "")}</textarea></label></div></fieldset>`;})).join("");show("worksheet-dialog");
  });
  $("worksheet-rows").addEventListener("change",event=>{if(!event.target.matches("[data-include]"))return;const row=event.target.closest("fieldset");row.querySelector("[data-worksheet-score]").disabled=!event.target.checked;row.querySelector("textarea").disabled=!event.target.checked;});
  $("worksheet-form").addEventListener("submit",event=>formWrite(event,"worksheet-error","worksheet:"+worksheetId,"/api/grading-worksheet/"+worksheetId,{grades:[...$("worksheet-rows").querySelectorAll("fieldset")].filter(r=>r.querySelector("[data-include]").checked).map(r=>({criterion_id:r.dataset.criterion,score:r.querySelector("[data-worksheet-score]").value,feedback:r.querySelector("textarea").value}))},async()=>{$("worksheet-dialog").close();}));
  function invalidatePlan() {releasePlan=null;$("commit-release").disabled=true;$("release-preview").innerHTML="";}
  $("open-release-batch").addEventListener("click",async()=>{
    try{await loadWorkspace();invalidatePlan();$("release-batch-error").textContent="";
      const candidates=state.attempts.filter(a=>a.status!=="in_progress" && a.feedback_status!=="released");
      $("release-selection").innerHTML=candidates.length?candidates.map(a=>`<label class="selection-label question"><input type="checkbox" data-release-choice="${a.id}" ${a.status!=="graded"?"disabled":""} /><span><strong>${escapeHtml(a.student.name)}</strong> · ${escapeHtml(a.assessment_title)}<small>${a.status==="graded"?`Ready · ${a.total_score} / ${maxPoints(a)}`:"Complete grading first"}</small></span></label>`).join(""):emptyState("Nothing ready to release","Complete grading to prepare a release batch.");show("release-batch-dialog");
    }catch(e){notify(e.message,"error");}
  });
  $("release-selection").addEventListener("change",invalidatePlan);
  $("preview-release").addEventListener("click",async event=>{
    const button=event.currentTarget;button.disabled=true;invalidatePlan();$("release-batch-error").textContent="";
    try {releasePlan=await api("/api/release-plans",{method:"POST",body:JSON.stringify({attempt_ids:[...$("release-selection").querySelectorAll("input:checked")].map(e=>e.dataset.releaseChoice),expected_revision:state.revision})});
      $("release-preview").innerHTML=`<section class="release-review"><h3>Review ${releasePlan.rows.length} recipient${releasePlan.rows.length===1?"":"s"}</h3><p class="muted">No scores have been released yet.</p>${releasePlan.rows.map(r=>`<p><strong>${escapeHtml(r.student_name)}</strong> · ${escapeHtml(r.assessment_title)} · ${r.total} points</p>`).join("")}</section>`;$("commit-release").disabled=false;
    }catch(e){$("release-batch-error").textContent=e.message;await loadWorkspace();}finally{button.disabled=false;}
  });
  $("commit-release").addEventListener("click",async event=>{
    if(!releasePlan)return;const button=event.currentTarget;button.disabled=true;$("release-batch-error").textContent="";
    try {const result=await mutate("release-plan","/api/release-plans/commit","POST",{plan_id:releasePlan.plan_id});if(!result)return;await refresh(`${result.released_ids.length} results released.`);$("release-batch-dialog").close();}
    catch(e){$("release-batch-error").textContent=e.message;invalidatePlan();}
  });
})();
