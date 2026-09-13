"use strict";

window.createAnalysisUI = function (request) {
  const host = document.querySelector("#analysis-workspace");
  host.innerHTML = `<h2>Saved analysis</h2>
    <p>Practice variations do not change your match totals or completed matches.</p>
    <button id="analysis-refresh" type="button">Refresh analyses</button>
    <nav id="analysis-list" aria-label="Saved analyses"></nav>
    <p id="analysis-message" role="status" aria-live="polite"></p>
    <section id="analysis-detail" hidden>
      <h3 id="analysis-title"></h3><p id="analysis-source"></p>
      <p id="analysis-status" role="status"></p><p id="analysis-revision"></p>
      <div id="analysis-columns" class="analysis-columns"></div>
      <div id="analysis-board" class="analysis-board" role="grid" aria-label="Analysis board"></div>
      <div class="analysis-actions"><button id="analysis-undo" type="button">Analysis Undo</button>
        <label>Continuation <select id="analysis-child"></select></label>
        <button id="analysis-redo" type="button">Analysis Redo</button>
        <button id="analysis-close" type="button">Close analysis</button></div>
      <form id="analysis-rename"><label>Analysis name <input id="analysis-rename-name" maxlength="60" required></label><button type="submit">Rename analysis</button></form>
      <h3>Variation tree</h3><div id="analysis-tree"></div>
      <h3>Selected line history</h3><ol id="analysis-history"></ol>
      <div class="analysis-actions"><label>Left position <select id="analysis-left"></select></label>
        <label>Right position <select id="analysis-right"></select></label>
        <button id="analysis-compare" type="button">Compare positions</button></div>
      <section id="analysis-comparison" hidden><p id="analysis-common"></p>
        <p id="analysis-differences"></p><div class="analysis-pair">
        <div><h4>Left position</h4><div id="analysis-left-board" class="analysis-board" role="grid" aria-label="Left comparison board"></div></div>
        <div><h4>Right position</h4><div id="analysis-right-board" class="analysis-board" role="grid" aria-label="Right comparison board"></div></div>
        </div></section>
    </section>`;
  const $ = id => document.getElementById(id);
  let study = null, busy = false;
  const columns = [];
  const text = (id, value) => { $(id).textContent = value; };
  const say = value => text("analysis-message", value);
  const status = n => n.status === "active" ? `${n.currentPlayer}'s turn` : n.status === "draw" ? "Draw" : n.status === "red_win" ? "Red wins" : "Yellow wins";
  function label(node) {
    if (!node.parentId) return `Source position (move ${study.sourceStep})`;
    const m = node.history.at(-1);
    return `Move ${m.move}: ${m.color}, column ${m.column}, row ${m.row}`;
  }
  function optionLabel(node) {
    const path = node.history.slice(study.sourceStep).map(m => m.column).join(" > ");
    return label(node) + (path ? ` | path ${path}` : "");
  }
  function grid(id, node, differences = []) {
    const gridHost = $(id);
    gridHost.replaceChildren();
    node.board.forEach((value, index) => {
      const cell = document.createElement("div");
      const winning = node.winningCells.includes(index), different = differences.includes(index);
      cell.className = `analysis-cell ${value.toLowerCase()}${winning ? " winning" : ""}${different ? " different" : ""}`;
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `Row ${Math.floor(index / 7) + 1}, column ${index % 7 + 1}, ${value || "empty"}${winning ? ", winning" : ""}${different ? ", different" : ""}`);
      if (winning) cell.textContent = "★";
      else if (different) cell.textContent = "≠";
      gridHost.append(cell);
    });
  }
  function controls() {
    const current = study?.nodes.find(n => n.id === study.selectedId);
    host.querySelectorAll("button,select,input").forEach(e => { e.disabled = busy; });
    $("analysis-undo").disabled = busy || !current?.parentId;
    $("analysis-redo").disabled = busy || !study?.nodes.some(n => n.parentId === study.selectedId);
    columns.forEach(b => { b.disabled = busy || !current || current.status !== "active"; });
    $("analysis-child").disabled = busy || !study?.nodes.some(n => n.parentId === study.selectedId);
  }
  function render(data) {
    study = data;
    $("analysis-detail").hidden = false;
    $("analysis-comparison").hidden = true;
    const current = study.nodes.find(n => n.id === study.selectedId);
    text("analysis-title", study.name);
    text("analysis-source", `Source match ${study.sourceMatchId} · move ${study.sourceStep}`);
    text("analysis-status", `Practice: ${status(current)} · ${current.history.length} moves`);
    text("analysis-revision", `Analysis revision ${study.revision}`);
    $("analysis-rename-name").value = study.name;
    grid("analysis-board", current);
    $("analysis-history").replaceChildren(...current.history.map(m => {
      const li = document.createElement("li");
      li.textContent = `Move ${m.move}: ${m.color}, column ${m.column}, row ${m.row}`;
      return li;
    }));
    const tree = document.createElement("ul");
    function append(parent, node, depth) {
      const li = document.createElement("li"), button = document.createElement("button");
      button.type = "button"; button.textContent = label(node); button.dataset.node = node.id;
      if (node.id === study.selectedId) { button.setAttribute("aria-current", "true"); button.textContent += " — selected"; }
      button.onclick = () => action("select", { nodeId: node.id }, () => host.querySelector(`[data-node="${node.id}"]`));
      li.append(button); parent.append(li);
      const children = study.nodes.filter(n => n.parentId === node.id);
      if (children.length) {
        const ul = document.createElement("ul"); ul.style.paddingLeft = depth < 6 ? "12px" : "0"; li.append(ul);
        children.forEach(n => append(ul, n, depth + 1));
      }
    }
    append(tree, study.nodes.find(n => n.id === study.rootId), 0);
    $("analysis-tree").replaceChildren(tree);
    const children = study.nodes.filter(n => n.parentId === current.id);
    $("analysis-child").replaceChildren(...children.map(n => new Option(optionLabel(n), n.id)));
    for (const id of ["analysis-left", "analysis-right"]) $(id).replaceChildren(...study.nodes.map(n => new Option(optionLabel(n), n.id)));
    $("analysis-left").value = current.id; $("analysis-right").value = study.rootId;
    controls();
  }
  async function refreshList() {
    const data = await request("/api/analysis");
    $("analysis-list").replaceChildren();
    if (!data.studies.length) text("analysis-list", "No saved analyses yet. Open a match replay to create one.");
    for (const item of data.studies) {
      const button = document.createElement("button");button.type = "button";
      button.textContent = item.name; button.dataset.study = item.id;
      button.onclick = async () => {
        if (busy) return;
        try { render((await request(`/api/analysis/${item.id}`)).study); say("Saved analysis loaded"); $("analysis-close").focus(); }
        catch (error) { say(error.message); }
      };
      $("analysis-list").append(button);
    }
  }
  async function action(kind, extra = {}, focus = null) {
    if (busy || !study) return;
    busy = true; controls();say("Saving analysis…");
    try {
      const data = await request(`/api/analysis/${study.id}/actions`, { method: "POST", body: JSON.stringify({ action: kind, expectedRevision: study.revision, operationId: crypto.randomUUID(), ...extra }) });
      render(data.study);await refreshList();say("Analysis saved");
    } catch (error) {
      if (error.study) render(error.study);
      say(error.message);
    } finally {
      busy = false;controls();
      const preferred = typeof focus === "function" ? focus() : focus;
      if (preferred && !preferred.disabled) preferred.focus();
      else if (!$("analysis-undo").disabled) $("analysis-undo").focus();
      else $("analysis-close").focus();
    }
  }
  for (let column = 1; column <= 7; column++) {
    const b = document.createElement("button");b.type = "button";b.textContent = String(column);
    b.setAttribute("aria-label", `Analysis drop in column ${column}`);
    b.onclick = () => action("move", { column }, b);
    b.onkeydown = e => {
      const next = e.key === "ArrowLeft" ? Math.max(0, column - 2) : e.key === "ArrowRight" ? Math.min(6, column) : e.key === "Home" ? 0 : e.key === "End" ? 6 : null;
      if (next !== null) { e.preventDefault();columns[next].focus(); }
    };
    columns.push(b);$("analysis-columns").append(b);
  }
  $("analysis-undo").onclick = () => action("undo", {}, $("analysis-undo"));
  $("analysis-redo").onclick = () => action("redo", { childId: $("analysis-child").value }, $("analysis-redo"));
  $("analysis-close").onclick = () => { $("analysis-detail").hidden = true;$("analysis-refresh").focus(); };
  $("analysis-rename").onsubmit = e => { e.preventDefault();action("rename", { name: $("analysis-rename-name").value }, $("analysis-rename-name")); };
  $("analysis-refresh").onclick = async () => {
    try { await refreshList();if (study) render((await request(`/api/analysis/${study.id}`)).study);say("Analyses refreshed"); }
    catch (error) { say(error.message); }
  };
  $("analysis-compare").onclick = async () => {
    try {
      const left = $("analysis-left").value, right = $("analysis-right").value;
      const data = await request(`/api/analysis/${study.id}/compare?left=${encodeURIComponent(left)}&right=${encodeURIComponent(right)}`);
      grid("analysis-left-board", data.left, data.differentCells);grid("analysis-right-board", data.right, data.differentCells);
      text("analysis-common", `Common prefix: ${data.commonPrefix} moves`);
      text("analysis-differences", data.differentCells.length ? `Different cells: ${data.differentCells.map(i => `row ${Math.floor(i / 7) + 1} column ${i % 7 + 1}`).join("; ")}` : "No different cells");
      $("analysis-comparison").hidden = false;say("Comparison ready — saved positions unchanged");
    } catch (error) { say(error.message); }
  };
  return {
    refreshList,
    reset() { study = null;$("analysis-detail").hidden = true;$("analysis-list").replaceChildren();say(""); },
    async create(matchId, step, name) {
      if (busy) return;
      busy = true;controls();say("Creating analysis…");
      try {
        const data = await request("/api/analysis", { method: "POST", body: JSON.stringify({ matchId, step, name, operationId: crypto.randomUUID() }) });
        render(data.study);await refreshList();say("Analysis created; competitive match unchanged");
        $("analysis-workspace").scrollIntoView({ block: "start" });
      } catch (error) { say(error.message); }
      finally { busy = false;controls();$("analysis-close").focus(); }
    },
  };
};
