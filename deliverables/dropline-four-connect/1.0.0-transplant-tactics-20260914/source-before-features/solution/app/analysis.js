"use strict";

const crypto = require("node:crypto");

module.exports = function installAnalysis(app, { db, authenticate, outcomeFor }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_studies (
      id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL, source_match TEXT NOT NULL, source_step INTEGER NOT NULL,
      prefix_json TEXT NOT NULL, root_id TEXT NOT NULL, selected_id TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS analysis_nodes (
      id TEXT PRIMARY KEY, study_id TEXT NOT NULL REFERENCES analysis_studies(id),
      parent_id TEXT, column_number INTEGER, sequence INTEGER NOT NULL,
      UNIQUE(study_id,parent_id,column_number)
    );
    CREATE TABLE IF NOT EXISTS analysis_receipts (
      user_id INTEGER NOT NULL REFERENCES users(id), operation_id TEXT NOT NULL,
      fingerprint TEXT NOT NULL, status INTEGER NOT NULL, response_json TEXT NOT NULL,
      PRIMARY KEY(user_id,operation_id)
    );
  `);
  const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
  const canonical = value => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
  function owned(id, user) {
    const row = db.prepare("SELECT * FROM analysis_studies WHERE id=? AND user_id=?").get(id, user);
    if (!row) fail(404, "Analysis not found");
    return row;
  }
  function nodeIn(id, study) {
    if (typeof id !== "string" || !id) fail(400, "A position identifier is required");
    const row = db.prepare("SELECT * FROM analysis_nodes WHERE id=? AND study_id=?").get(id, study);
    if (!row) fail(404, "Position not found in this analysis");
    return row;
  }
  function position(moves) {
    const board = Array(42).fill("");
    const history = [];
    let currentPlayer = "Red", status = "active", winningCells = [];
    for (const input of moves) {
      if (status !== "active") fail(409, "The practice line is already complete");
      const column = input.column;
      if (!Number.isInteger(column) || column < 1 || column > 7) fail(400, "Column must be an integer from 1 to 7");
      let index = -1;
      for (let row = 5; row >= 0; row--) if (!board[row * 7 + column - 1]) { index = row * 7 + column - 1; break; }
      if (index < 0) fail(409, `Column ${column} is full`);
      const color = currentPlayer;
      board[index] = color;
      history.push({ move: history.length + 1, color, column, row: Math.floor(index / 7) + 1, index });
      ({ status, winningCells } = outcomeFor(board, index, color));
      currentPlayer = status === "active" ? color === "Red" ? "Yellow" : "Red" : color;
    }
    return { board, currentPlayer, status, winningCells, history };
  }
  function snapshot(row) {
    const prefix = JSON.parse(row.prefix_json);
    const records = db.prepare("SELECT * FROM analysis_nodes WHERE study_id=? ORDER BY sequence,id").all(row.id);
    const positions = new Map();
    const nodes = records.map(n => {
      const moves = n.parent_id ? [...positions.get(n.parent_id).history, { column: n.column_number }] : prefix;
      const value = position(moves);
      positions.set(n.id, value);
      return { id: n.id, parentId: n.parent_id, column: n.column_number, ...value };
    });
    return { id: row.id, name: row.name, sourceMatchId: row.source_match, sourceStep: row.source_step,
      rootId: row.root_id, selectedId: row.selected_id, revision: row.revision, nodes };
  }
  function requireBody(body, keys) {
    if (!body || typeof body !== "object" || Array.isArray(body)) fail(400, "A JSON object is required");
    if (Object.keys(body).some(k => !keys.includes(k))) fail(400, "Unsupported analysis fields");
  }
  function nameOf(value) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 60) fail(400, "Use an analysis name of 1 to 60 characters");
    return value.trim();
  }
  function write(req, res, execute) {
    const body = req.body;
    if (!body || typeof body.operationId !== "string" || !/^[A-Za-z0-9_-]{16,120}$/.test(body.operationId)) {
      return res.status(400).json({ error: "A valid operation identifier is required" });
    }
    const fingerprint = crypto.createHash("sha256").update(JSON.stringify(canonical({ method: req.method, path: req.path, body }))).digest("hex");
    const result = db.transaction(() => {
      const prior = db.prepare("SELECT * FROM analysis_receipts WHERE user_id=? AND operation_id=?").get(req.session.id, body.operationId);
      if (prior) {
        if (prior.fingerprint !== fingerprint) return { status: 409, data: { error: "Operation identifier already used for different input" } };
        return { status: prior.status, data: JSON.parse(prior.response_json) };
      }
      let status = 200, data;
      try { data = execute(); }
      catch (error) {
        if (!error.status || error.status >= 500) throw error;
        status = error.status;
        data = { error: error.message };
        if (req.params.id) {
          const row = db.prepare("SELECT * FROM analysis_studies WHERE id=? AND user_id=?").get(req.params.id, req.session.id);
          if (row) data.study = snapshot(row);
        }
      }
      db.prepare("INSERT INTO analysis_receipts VALUES(?,?,?,?,?)").run(req.session.id, body.operationId, fingerprint, status, JSON.stringify(data));
      return { status, data };
    })();
    res.status(result.status).json(result.data);
  }
  app.get("/api/analysis", authenticate, (req, res) => {
    const rows = db.prepare("SELECT id,name,revision,source_match AS sourceMatchId,source_step AS sourceStep FROM analysis_studies WHERE user_id=? ORDER BY created_at,id").all(req.session.id);
    res.json({ studies: rows });
  });
  app.get("/api/analysis/:id", authenticate, (req, res) => res.json({ study: snapshot(owned(req.params.id, req.session.id)) }));
  app.get("/api/analysis/:id/compare", authenticate, (req, res) => {
    const study = snapshot(owned(req.params.id, req.session.id));
    const left = study.nodes.find(n => n.id === req.query.left), right = study.nodes.find(n => n.id === req.query.right);
    if (!left || !right) fail(404, "Choose two positions in this analysis");
    let commonPrefix = 0;
    while (commonPrefix < left.history.length && commonPrefix < right.history.length
      && left.history[commonPrefix].column === right.history[commonPrefix].column) commonPrefix++;
    const differentCells = left.board.flatMap((cell, index) => cell !== right.board[index] ? [index] : []);
    res.json({ left, right, commonPrefix, differentCells });
  });
  app.post("/api/analysis", authenticate, (req, res) => write(req, res, () => {
    requireBody(req.body, ["name", "matchId", "step", "operationId"]);
    const name = nameOf(req.body.name);
    if (typeof req.body.matchId !== "string") fail(400, "A source match is required");
    const match = db.prepare("SELECT * FROM completed_matches WHERE match_id=? AND user_id=?").get(req.body.matchId, req.session.id);
    if (!match) fail(404, "Source match not found");
    const moves = JSON.parse(match.moves_json), step = req.body.step;
    if (!Number.isInteger(step) || step < 0 || step > moves.length) fail(400, "Choose an existing replay step");
    const prefix = moves.slice(0, step);
    position(prefix);
    const id = crypto.randomUUID(), root = crypto.randomUUID();
    db.prepare("INSERT INTO analysis_studies VALUES(?,?,?,?,?,?,?,?,?,?)").run(id, req.session.id, name, req.body.matchId, step, JSON.stringify(prefix), root, root, 0, new Date().toISOString());
    db.prepare("INSERT INTO analysis_nodes VALUES(?,?,?,?,?)").run(root, id, null, null, 0);
    return { study: snapshot(owned(id, req.session.id)) };
  }));
  app.post("/api/analysis/:id/actions", authenticate, (req, res) => write(req, res, () => {
    const row = owned(req.params.id, req.session.id), body = req.body;
    const extras = { move: ["column"], select: ["nodeId"], undo: [], redo: ["childId"], rename: ["name"] };
    if (typeof body.action !== "string" || !Object.hasOwn(extras, body.action)) fail(400, "Unknown analysis action");
    requireBody(body, ["action", "expectedRevision", "operationId", ...extras[body.action]]);
    if (!Number.isInteger(body.expectedRevision) || body.expectedRevision < 0) fail(400, "A nonnegative integer analysis revision is required");
    if (body.expectedRevision !== row.revision) fail(409, "Analysis updated in another tab");
    let selected = row.selected_id, name = row.name;
    const current = nodeIn(selected, row.id);
    if (body.action === "move") {
      const s = snapshot(row), from = s.nodes.find(n => n.id === selected);
      position([...from.history, { column: body.column }]);
      const existing = db.prepare("SELECT id FROM analysis_nodes WHERE study_id=? AND parent_id=? AND column_number=?").get(row.id, selected, body.column);
      if (existing) selected = existing.id;
      else {
        selected = crypto.randomUUID();
        const sequence = db.prepare("SELECT MAX(sequence)+1 AS next FROM analysis_nodes WHERE study_id=?").get(row.id).next;
        db.prepare("INSERT INTO analysis_nodes VALUES(?,?,?,?,?)").run(selected, row.id, current.id, body.column, sequence);
      }
    } else if (body.action === "undo") {
      if (!current.parent_id) fail(409, "Cannot undo before the analysis source position");
      selected = current.parent_id;
    } else if (body.action === "redo") {
      const children = db.prepare("SELECT id FROM analysis_nodes WHERE study_id=? AND parent_id=? ORDER BY sequence").all(row.id, selected);
      if (!children.length) fail(409, "No continuation to redo");
      if (body.childId !== undefined) {
        if (!children.some(n => n.id === body.childId)) fail(409, "Choose a direct continuation of this position");
        selected = body.childId;
      } else {
        if (children.length !== 1) fail(409, "Choose which continuation to redo");
        selected = children[0].id;
      }
    } else if (body.action === "select") selected = nodeIn(body.nodeId, row.id).id;
    else name = nameOf(body.name);
    db.prepare("UPDATE analysis_studies SET selected_id=?,name=?,revision=revision+1 WHERE id=?").run(selected, name, row.id);
    return { study: snapshot(owned(row.id, req.session.id)) };
  }));
};
