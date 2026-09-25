"use strict";

window.createStudyToolsUI = function(request, onCommit) {
  const host=document.querySelector("#study-tools");
  host.innerHTML=`<h2>Advanced study tools</h2>
    <section class="tool-card" aria-labelledby="transplant-heading"><h3 id="transplant-heading">Transplant a variation</h3>
    <p>Copy column choices, with every branch checked at the new position. Originals stay intact.</p>
    <div class="tool-fields"><label>Source branch<select id="transplant-source"></select></label>
    <label>Destination analysis<select id="transplant-study"></select></label>
    <label>Destination position<select id="transplant-target"></select></label></div>
    <div class="analysis-actions"><button id="transplant-refresh" type="button">Refresh destinations</button><button id="transplant-preview" type="button">Preview transplant</button><button id="transplant-commit" type="button" disabled>Commit transplant</button></div>
    <p id="transplant-message" role="status" aria-live="polite"></p>
    <div class="tool-preview-layout"><div id="transplant-result"></div><div id="transplant-board" class="analysis-board" role="grid" aria-label="Transplant preview board" hidden></div></div></section>
    <section class="tool-card" aria-labelledby="tactics-heading"><h3 id="tactics-heading">Tactical explanation</h3>
    <p>Exact bounded search. Unknown means the horizon does not establish a result, not a draw.</p>
    <div class="analysis-actions"><label>Search depth (plies)<select id="tactics-depth"><option>1</option><option>2</option><option selected>3</option><option>4</option></select></label><button id="tactics-run" type="button">Analyze selected position</button></div>
    <p id="tactics-message" role="status" aria-live="polite"></p><div id="tactics-results"></div>
    <div class="tool-proof-layout"><div id="tactics-tree" aria-label="Tactical explanation tree"></div><section id="tactics-inspector" hidden><h4>Explanation position</h4><p id="tactics-position" role="status" aria-live="polite"></p><div id="tactics-board" class="analysis-board" role="grid" aria-label="Tactical explanation board"></div></section></div></section>`;
  const $=id=>document.getElementById(id);
  let study=null,preview=null,busy=false,generation=0;
  const describe=n=>n.parentId?`Move ${n.history.length}: ${n.history.at(-1).color}, column ${n.column} | ${n.history.map(m=>m.column).join(" > ")}`:`Root, move ${n.history.length}`;
  function message(id,value){$(id).textContent=value;}
  function board(id,node){const target=$(id);target.hidden=false;target.replaceChildren();node.board.forEach((value,i)=>{const cell=document.createElement("div");const winning=node.winningCells.includes(i);cell.className=`analysis-cell ${value.toLowerCase()}${winning?" winning":""}`;cell.setAttribute("role","gridcell");cell.setAttribute("aria-label",`Row ${Math.floor(i/7)+1}, column ${i%7+1}, ${value||"empty"}${winning?", winning":""}`);if(winning)cell.textContent="★";target.append(cell);});}
  function controls(){host.querySelectorAll("button,select").forEach(e=>e.disabled=busy);$("transplant-commit").disabled=busy||!preview;$("transplant-preview").disabled=busy||!$("transplant-source").value||!$("transplant-target").value;}
  function clearPreview(){preview=null;$("transplant-result").replaceChildren();$("transplant-board").hidden=true;controls();}
  async function loadTarget(){const id=$("transplant-study").value;if(!id)return;const token=generation;const data=await request(`/api/analysis/${encodeURIComponent(id)}`);if(token!==generation)return;$("transplant-target").replaceChildren(...data.study.nodes.map(n=>new Option(describe(n),n.id)));controls();}
  async function destinations(){if(!study)return;const token=generation;const data=await request("/api/analysis");if(token!==generation)return;$("transplant-study").replaceChildren(...data.studies.map(s=>new Option(s.name,s.id)));$("transplant-study").value=study.id;await loadTarget();}
  async function run(button, action, output){if(busy)return;busy=true;controls();const token=generation;try{await action(token);}catch(error){if(token===generation)message(output,error.message);}finally{busy=false;controls();if(!button.disabled)button.focus();}}
  function planRows(items,committed=false){const list=document.createElement("ol");list.className="tool-mapping";for(const item of items){const li=document.createElement("li");const text=document.createElement("span");text.textContent=`Path ${item.path.join(" > ")} — ${(committed?item.reused:item.existingTargetId)?"Reused":"New"}${committed?` · ${item.sourceNodeId} → ${item.targetNodeId}`:""}`;li.append(text);if(item.position){const b=document.createElement("button");b.type="button";b.textContent=`Inspect path ${item.path.join(" > ")}`;b.onclick=()=>board("transplant-board",item.position);li.append(b);}list.append(li);}$("transplant-result").replaceChildren(list);}
  $("transplant-refresh").onclick=()=>run($("transplant-refresh"),async()=>{clearPreview();await destinations();message("transplant-message","Destinations refreshed. Preview again before committing.");},"transplant-message");
  $("transplant-study").onchange=()=>run($("transplant-refresh"),async()=>{clearPreview();await loadTarget();},"transplant-message");
  for(const id of ["transplant-source","transplant-target"])$(id).onchange=()=>{clearPreview();message("transplant-message","Selection changed. Preview again.");};
  $("transplant-preview").onclick=()=>run($("transplant-preview"),async token=>{
    clearPreview();message("transplant-message","Checking every continuation…");
    const data=await request("/api/analysis-tools/transplant/preview",{method:"POST",body:JSON.stringify({sourceStudyId:study.id,sourceNodeId:$("transplant-source").value,destinationStudyId:$("transplant-study").value,destinationNodeId:$("transplant-target").value})});
    if(token!==generation)return;
    if(!data.valid){message("transplant-message",`Cannot transplant path ${data.invalid.path.join(" > ")}: ${data.invalid.reason}. Nothing saved.`);return;}
    preview=data.previewId;message("transplant-message",`Unsaved preview: ${data.added} new, ${data.reused} reused. Source revision ${data.sourceRevision}; destination revision ${data.destinationRevision}.`);planRows(data.mappings);if(data.mappings.length)board("transplant-board",data.mappings[0].position);
  },"transplant-message");
  $("transplant-commit").onclick=()=>run($("transplant-commit"),async()=>{
    const id=preview;preview=null;
    const data=await request("/api/analysis-tools/transplant/commit",{method:"POST",body:JSON.stringify({previewId:id,operationId:crypto.randomUUID()})});
    await onCommit(data.study);message("transplant-message",`Transplant committed: ${data.added} new, ${data.reused} reused. Destination revision ${data.study.revision}. Selection unchanged.`);planRows(data.mapping,true);$("transplant-refresh").focus();
  },"transplant-message");
  const outcome=(value,distance)=>value==="unknown"?"Not established":`Forced ${value}${distance!==null&&value!=="draw"?` in ${distance} ${distance===1?"ply":"plies"}`:""}`;
  function inspect(node){$("tactics-inspector").hidden=false;message("tactics-position",`${node.path.length?node.path.join(" > "):"Root"} · ${node.player} perspective · ${outcome(node.outcome,node.distance)} · ${node.reason}`);board("tactics-board",node);}
  function proofNode(node){const item=document.createElement("details"),summary=document.createElement("summary");summary.textContent=`${node.path.length?node.path.join(" > "):"Root"} · ${node.player}: ${outcome(node.outcome,node.distance)} (${node.reason})`;item.append(summary);const inspectButton=document.createElement("button");inspectButton.type="button";inspectButton.textContent=`Inspect explanation ${node.path.length?node.path.join(" > "):"root"}`;inspectButton.onclick=()=>inspect(node);item.append(inspectButton);let loaded=false;item.ontoggle=()=>{if(!item.open||loaded)return;loaded=true;for(const child of node.children)item.append(proofNode(child.proof));};return item;}
  $("tactics-depth").onchange=()=>{$("tactics-results").replaceChildren();$("tactics-tree").replaceChildren();$("tactics-inspector").hidden=true;message("tactics-message","Depth changed. Analyze again.");};
  $("tactics-run").onclick=()=>run($("tactics-run"),async token=>{
    const data=await request(`/api/analysis/${study.id}/tactics`,{method:"POST",body:JSON.stringify({nodeId:study.selectedId,depth:Number($("tactics-depth").value)})});if(token!==generation)return;
    const analyzed=study.nodes.find(n=>n.id===data.nodeId);
    message("tactics-message",`${describe(analyzed)} · revision ${data.revision} · depth ${data.depth}. ${data.terminal?`Terminal: ${data.proof.status.replaceAll("_"," ")}`:`${data.proof.player}: ${outcome(data.proof.outcome,data.proof.distance)}`}. No saved state changed.`);
    const table=document.createElement("table");table.className="tool-table";const caption=document.createElement("caption");caption.textContent=`Legal columns — ${data.proof.player}'s perspective`;table.append(caption);const header=table.createTHead().insertRow();for(const label of ["Column","Result"]){const th=document.createElement("th");th.scope="col";th.textContent=label;header.append(th);}const body=table.createTBody();for(const child of data.proof.children){const row=body.insertRow();row.insertCell().textContent=child.column;row.insertCell().textContent=outcome(child.outcome,child.distance);}$("tactics-results").replaceChildren(table);
    const tree=proofNode(data.proof);$("tactics-tree").replaceChildren(tree);tree.open=true;inspect(data.proof);
  },"tactics-message");
  return {setStudy(data){generation++;study=data;clearPreview();$("transplant-source").replaceChildren(...data.nodes.filter(n=>n.parentId).map(n=>new Option(describe(n),n.id)));$("transplant-target").replaceChildren();$("tactics-results").replaceChildren();$("tactics-tree").replaceChildren();$("tactics-inspector").hidden=true;message("tactics-message","");message("transplant-message","");destinations().catch(e=>message("transplant-message",e.message));},reset(){generation++;study=null;clearPreview();}};
};
