"use strict";

const crypto = require("node:crypto");

module.exports = function(app, { db, authenticate, owned, snapshot, position, requireBody, write, fail }) {
  db.exec(`CREATE TABLE IF NOT EXISTS analysis_previews (
    id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
    source_id TEXT NOT NULL, destination_id TEXT NOT NULL,
    source_revision INTEGER NOT NULL, destination_revision INTEGER NOT NULL,
    source_node TEXT NOT NULL, destination_node TEXT NOT NULL,
    consumed INTEGER NOT NULL DEFAULT 0
  )`);
  function node(study, id) {
    if (typeof id !== "string") fail(400, "Choose a saved position");
    const n = study.nodes.find(n => n.id === id);
    if (!n) fail(404, "Position not found in the selected analysis");
    return n;
  }
  function prepare(source, destination, sourceId, targetId) {
    const branch = node(source, sourceId), target = node(destination, targetId);
    if (!branch.parentId) fail(400, "Choose a branch below the source root");
    const mappings = [];
    let invalid = null;
    function walk(n, parentPosition, path, existingParent) {
      if (invalid) return;
      const nextPath = [...path, n.column];
      let value;
      try { value = position([...parentPosition.history, { column: n.column }]); }
      catch (error) {
        if (!error.status) throw error;
        invalid = { path: nextPath, sourceNodeId: n.id, reason: error.message };
        return;
      }
      const existing = existingParent && destination.nodes.find(x => x.parentId === existingParent && x.column === n.column);
      mappings.push({ sourceNodeId: n.id, path: nextPath, existingTargetId: existing?.id || null, position: value });
      source.nodes.filter(x => x.parentId === n.id).sort((a,b) => a.column-b.column).forEach(child => walk(child, value, nextPath, existing?.id));
    }
    walk(branch, target, [], target.id);
    return { valid: !invalid, invalid, mappings: invalid ? [] : mappings, added: invalid ? 0 : mappings.filter(x => !x.existingTargetId).length,
      reused: invalid ? 0 : mappings.filter(x => x.existingTargetId).length };
  }
  app.post("/api/analysis-tools/transplant/preview", authenticate, (req,res) => {
    requireBody(req.body, ["sourceStudyId","sourceNodeId","destinationStudyId","destinationNodeId"]);
    if (typeof req.body.sourceStudyId !== "string" || typeof req.body.destinationStudyId !== "string") fail(400, "Choose two analyses");
    const source = snapshot(owned(req.body.sourceStudyId, req.session.id));
    const destination = snapshot(owned(req.body.destinationStudyId, req.session.id));
    const plan = prepare(source,destination,req.body.sourceNodeId,req.body.destinationNodeId);
    let previewId = null;
    if (plan.valid) {
      previewId = crypto.randomUUID();
      db.prepare("INSERT INTO analysis_previews VALUES(?,?,?,?,?,?,?,?,0)").run(previewId,req.session.id,source.id,destination.id,source.revision,destination.revision,req.body.sourceNodeId,req.body.destinationNodeId);
    }
    res.json({ previewId, sourceRevision:source.revision, destinationRevision:destination.revision, ...plan });
  });
  app.post("/api/analysis-tools/transplant/commit", authenticate, (req,res) => write(req,res,() => {
    requireBody(req.body,["previewId","operationId"]);
    if (typeof req.body.previewId !== "string") fail(400,"A saved preview is required");
    const preview = db.prepare("SELECT * FROM analysis_previews WHERE id=? AND user_id=?").get(req.body.previewId,req.session.id);
    if (!preview) fail(404,"Preview not found");
    if (preview.consumed) fail(409,"Preview already committed; create a new preview");
    const source = snapshot(owned(preview.source_id,req.session.id)), destination = snapshot(owned(preview.destination_id,req.session.id));
    if (source.revision !== preview.source_revision || destination.revision !== preview.destination_revision) fail(409,"Source or destination changed; refresh both and preview again");
    const plan = prepare(source,destination,preview.source_node,preview.destination_node);
    if (!plan.valid) fail(409,"Branch is no longer legal; preview again");
    const ids = new Map([["",preview.destination_node]]), mapping = [];
    let sequence = db.prepare("SELECT MAX(sequence) AS last FROM analysis_nodes WHERE study_id=?").get(destination.id).last;
    for (const item of plan.mappings) {
      const key = item.path.join(","), parentKey = item.path.slice(0,-1).join(",");
      const id = item.existingTargetId || crypto.randomUUID();
      if (!item.existingTargetId) db.prepare("INSERT INTO analysis_nodes VALUES(?,?,?,?,?)").run(id,destination.id,ids.get(parentKey),item.path.at(-1),++sequence);
      ids.set(key,id);mapping.push({ sourceNodeId:item.sourceNodeId,targetNodeId:id,path:item.path,reused:!!item.existingTargetId });
    }
    db.prepare("UPDATE analysis_studies SET revision=revision+1 WHERE id=?").run(destination.id);
    db.prepare("UPDATE analysis_previews SET consumed=1 WHERE id=?").run(preview.id);
    return { study:snapshot(owned(destination.id,req.session.id)),mapping,added:plan.added,reused:plan.reused };
  }));
  const flip = value => value === "win" ? "loss" : value === "loss" ? "win" : value;
  function search(moves, depth, path = []) {
    const state = position(moves), player = moves.length % 2 === 0 ? "Red" : "Yellow";
    const base = { path, player, board:state.board, status:state.status, winningCells:state.winningCells, remainingDepth:depth, children:[] };
    if (state.status !== "active") return { ...base, outcome:state.status === "draw" ? "draw" : (state.status === "red_win" ? "Red" : "Yellow") === player ? "win" : "loss", distance:0, reason:"terminal" };
    if (depth === 0) return { ...base,outcome:"unknown",distance:null,reason:"horizon" };
    const children = [];
    for (let column=1;column<=7;column++) if (!state.board[column-1]) {
      const child = search([...moves,{column}],depth-1,[...path,column]);
      children.push({ column, outcome:flip(child.outcome),distance:child.distance === null ? null : child.distance+1, proof:child });
    }
    const wins=children.filter(c=>c.outcome === "win");
    let outcome="unknown",distance=null;
    if (wins.length) { outcome="win";distance=Math.min(...wins.map(c=>c.distance)); }
    else if (children.every(c=>c.outcome === "loss")) { outcome="loss";distance=Math.max(...children.map(c=>c.distance)); }
    else if (children.every(c=>c.outcome !== "unknown")) outcome="draw";
    return { ...base,children,outcome,distance,reason:"searched" };
  }
  app.post("/api/analysis/:id/tactics",authenticate,(req,res) => {
    requireBody(req.body,["nodeId","depth"]);
    if (!Number.isInteger(req.body.depth) || req.body.depth<1 || req.body.depth>4) fail(400,"Search depth must be an integer from 1 to 4 plies");
    const study=snapshot(owned(req.params.id,req.session.id)), selected=node(study,req.body.nodeId);
    const proof=search(selected.history,req.body.depth);
    res.json({ studyId:study.id,nodeId:selected.id,revision:study.revision,depth:req.body.depth,terminal:proof.status !== "active",proof });
  });
};
