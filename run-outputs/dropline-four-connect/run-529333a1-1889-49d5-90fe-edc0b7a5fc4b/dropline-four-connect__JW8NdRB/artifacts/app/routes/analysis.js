const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db');
const { authMiddleware } = require('./auth');
const { hashInput, checkReceipt, saveReceipt } = require('../receipts');
const engine = require('../gameEngine');

const router = express.Router();
router.use(authMiddleware);

function formatAnalysisFull(db, analysisId, accountId) {
  const analysis = db.prepare('SELECT * FROM analyses WHERE id = ? AND account_id = ?').get(analysisId, accountId);
  if (!analysis) return null;

  const allNodes = db.prepare(`
    SELECT * FROM analysis_nodes WHERE analysis_id = ? AND account_id = ?
  `).all(analysisId, accountId);

  const nodeMap = new Map();
  const childrenMap = new Map();

  for (const n of allNodes) {
    const parsedBoard = typeof n.board === 'string' ? JSON.parse(n.board) : n.board;
    const parsedWinning = n.winning_cells === 'none' || !n.winning_cells ? [] : (typeof n.winning_cells === 'string' ? JSON.parse(n.winning_cells) : n.winning_cells);
    const nodeObj = {
      id: n.id,
      analysisId: n.analysis_id,
      parentId: n.parent_id,
      incomingColumn: n.incoming_column,
      moveNumber: n.move_number,
      color: n.color,
      landingRow: n.landing_row,
      landingCol: n.landing_col,
      landingIndex: n.landing_index,
      board: parsedBoard,
      turn: n.turn,
      status: n.status,
      winningCells: parsedWinning,
      createdAt: n.created_at,
      childrenIds: []
    };
    nodeMap.set(n.id, nodeObj);
    if (n.parent_id) {
      if (!childrenMap.has(n.parent_id)) {
        childrenMap.set(n.parent_id, []);
      }
      childrenMap.get(n.parent_id).push(n.id);
    }
  }

  for (const [parentId, childIds] of childrenMap.entries()) {
    if (nodeMap.has(parentId)) {
      nodeMap.get(parentId).childrenIds = childIds;
    }
  }

  const selectedNode = nodeMap.get(analysis.selected_node_id) || nodeMap.get(analysis.root_node_id);
  const sourcePrefix = typeof analysis.source_prefix === 'string' ? JSON.parse(analysis.source_prefix) : analysis.source_prefix;

  // Compute selected line history (from root down to selectedNode)
  const branchMoves = [];
  let curr = selectedNode;
  while (curr && curr.parentId) {
    branchMoves.unshift({
      moveNumber: curr.moveNumber,
      color: curr.color,
      column: curr.incomingColumn,
      row: curr.landingRow,
      index: curr.landingIndex,
      nodeId: curr.id
    });
    curr = nodeMap.get(curr.parentId);
  }

  const fullSelectedHistory = [...sourcePrefix, ...branchMoves];

  // Direct available children of selectedNode
  const directChildren = (selectedNode.childrenIds || []).map(cid => {
    const c = nodeMap.get(cid);
    return {
      id: c.id,
      incomingColumn: c.incomingColumn,
      color: c.color,
      landingRow: c.landingRow,
      landingCol: c.landingCol,
      landingIndex: c.landingIndex
    };
  }).sort((a, b) => a.incomingColumn - b.incomingColumn);

  return {
    id: analysis.id,
    name: analysis.name,
    sourceMatchId: analysis.source_match_id,
    sourceStep: analysis.source_step,
    sourcePrefix,
    rootNodeId: analysis.root_node_id,
    selectedNodeId: analysis.selected_node_id,
    revision: analysis.revision,
    createdAt: analysis.created_at,
    updatedAt: analysis.updated_at,
    selectedNode: {
      id: selectedNode.id,
      parentId: selectedNode.parentId,
      moveNumber: selectedNode.moveNumber,
      board: selectedNode.board,
      turn: selectedNode.turn,
      status: selectedNode.status,
      winningCells: selectedNode.winningCells,
      canUndo: selectedNode.parentId !== null,
      canRedo: directChildren.length > 0,
      availableChildren: directChildren
    },
    fullSelectedHistory,
    treeNodes: Array.from(nodeMap.values())
  };
}

// GET /api/analyses
router.get('/analyses', (req, res) => {
  const db = getDb();
  const accountId = req.account.id;

  const rows = db.prepare(`
    SELECT id, name, source_match_id, source_step, root_node_id, selected_node_id, revision, created_at, updated_at
    FROM analyses
    WHERE account_id = ?
    ORDER BY updated_at DESC, created_at DESC
  `).all(accountId);

  const formatted = rows.map(r => ({
    id: r.id,
    name: r.name,
    sourceMatchId: r.source_match_id,
    sourceStep: r.source_step,
    rootNodeId: r.root_node_id,
    selectedNodeId: r.selected_node_id,
    revision: r.revision,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));

  return res.json({ analyses: formatted });
});

// POST /api/analyses - Create new analysis
router.post('/analyses', (req, res) => {
  const accountId = req.account.id;
  const { matchId, step, name, operationId } = req.body || {};

  const allowedKeys = ['matchId', 'step', 'name', 'operationId'];
  const extraKeys = Object.keys(req.body || {}).filter(k => !allowedKeys.includes(k));
  if (extraKeys.length > 0) {
    return res.status(400).json({ error: 'Unexpected additional fields' });
  }

  if (!operationId || typeof operationId !== 'string' || operationId.trim().length === 0) {
    return res.status(400).json({ error: 'Valid operationId is required' });
  }

  if (!matchId || typeof matchId !== 'string') {
    return res.status(400).json({ error: 'Valid matchId is required' });
  }

  if (typeof step !== 'number' || !Number.isInteger(step) || step < 0) {
    return res.status(400).json({ error: 'Valid integer step is required' });
  }

  if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 60) {
    return res.status(400).json({ error: 'Name must be between 1 and 60 characters' });
  }

  const trimmedName = name.trim();
  const inputHash = hashInput({ action: 'createAnalysis', matchId, step, name: trimmedName, operationId });
  const cached = checkReceipt(accountId, operationId, inputHash);
  if (cached) {
    return res.status(cached.statusCode).json(cached.responseJson);
  }

  const db = getDb();
  const match = db.prepare('SELECT * FROM completed_matches WHERE account_id = ? AND match_id = ?').get(accountId, matchId);

  if (!match) {
    const resp = { error: 'Source completed match not found' };
    saveReceipt(accountId, operationId, 'analysis', inputHash, 404, resp);
    return res.status(404).json(resp);
  }

  const matchMoves = typeof match.moves === 'string' ? JSON.parse(match.moves) : match.moves;
  if (step > matchMoves.length) {
    const resp = { error: `Step ${step} exceeds match length of ${matchMoves.length}` };
    saveReceipt(accountId, operationId, 'analysis', inputHash, 400, resp);
    return res.status(400).json(resp);
  }

  const prefix = matchMoves.slice(0, step);
  const derived = engine.deriveStateFromMoves(prefix);

  const createTx = db.transaction(() => {
    const analysisId = 'analysis-' + crypto.randomUUID();
    const rootNodeId = 'node-' + crypto.randomUUID();
    const now = new Date().toISOString();

    const lastPrefixMove = prefix.length > 0 ? prefix[prefix.length - 1] : null;

    db.prepare(`
      INSERT INTO analyses (
        id, account_id, name, source_match_id, source_step, source_prefix,
        root_node_id, selected_node_id, revision, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      analysisId,
      accountId,
      trimmedName,
      matchId,
      step,
      JSON.stringify(prefix),
      rootNodeId,
      rootNodeId,
      now,
      now
    );

    db.prepare(`
      INSERT INTO analysis_nodes (
        id, analysis_id, account_id, parent_id, incoming_column, move_number,
        color, landing_row, landing_col, landing_index, board, turn, status, winning_cells, created_at
      ) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      rootNodeId,
      analysisId,
      accountId,
      prefix.length,
      lastPrefixMove ? lastPrefixMove.color : 'none',
      lastPrefixMove ? lastPrefixMove.row : null,
      lastPrefixMove ? lastPrefixMove.column : null,
      lastPrefixMove ? lastPrefixMove.index : null,
      JSON.stringify(derived.board),
      derived.currentPlayer,
      derived.status,
      JSON.stringify(derived.winningCells),
      now
    );

    const formatted = formatAnalysisFull(db, analysisId, accountId);
    saveReceipt(accountId, operationId, 'analysis', inputHash, 201, formatted);
    return formatted;
  });

  const analysisObj = createTx();
  return res.status(201).json(analysisObj);
});

// GET /api/analyses/:id
router.get('/analyses/:id', (req, res) => {
  const db = getDb();
  const accountId = req.account.id;
  const { id } = req.params;

  const analysis = formatAnalysisFull(db, id, accountId);
  if (!analysis) {
    return res.status(404).json({ error: 'Analysis not found' });
  }

  return res.json(analysis);
});

// POST /api/analyses/:id/move
router.post('/analyses/:id/move', (req, res) => {
  const accountId = req.account.id;
  const { id: analysisId } = req.params;
  const { column, expectedRevision, operationId } = req.body || {};

  const allowedKeys = ['column', 'expectedRevision', 'operationId'];
  const extraKeys = Object.keys(req.body || {}).filter(k => !allowedKeys.includes(k));
  if (extraKeys.length > 0) {
    return res.status(400).json({ error: 'Unexpected additional fields' });
  }

  if (!operationId || typeof operationId !== 'string' || operationId.trim().length === 0) {
    return res.status(400).json({ error: 'Valid operationId is required' });
  }

  if (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
    return res.status(400).json({ error: 'Valid integer expectedRevision is required' });
  }

  if (typeof column !== 'number' || !Number.isInteger(column) || column < 1 || column > engine.COLS) {
    return res.status(400).json({ error: 'Column must be an integer between 1 and 7' });
  }

  const inputHash = hashInput({ action: 'analysisMove', analysisId, column, expectedRevision, operationId });
  const cached = checkReceipt(accountId, operationId, inputHash);
  if (cached) {
    return res.status(cached.statusCode).json(cached.responseJson);
  }

  const db = getDb();
  const performMove = db.transaction(() => {
    const analysis = db.prepare('SELECT * FROM analyses WHERE id = ? AND account_id = ?').get(analysisId, accountId);
    if (!analysis) {
      const resp = { error: 'Analysis not found' };
      saveReceipt(accountId, operationId, 'analysis', inputHash, 404, resp);
      return { status: 404, body: resp };
    }

    if (analysis.revision !== expectedRevision) {
      const resp = {
        error: 'Analysis updated in another tab',
        analysis: formatAnalysisFull(db, analysisId, accountId)
      };
      saveReceipt(accountId, operationId, 'analysis', inputHash, 409, resp);
      return { status: 409, body: resp };
    }

    const selectedNode = db.prepare('SELECT * FROM analysis_nodes WHERE id = ? AND analysis_id = ?').get(analysis.selected_node_id, analysisId);
    if (!selectedNode) {
      const resp = { error: 'Selected node not found' };
      saveReceipt(accountId, operationId, 'analysis', inputHash, 400, resp);
      return { status: 400, body: resp };
    }

    if (selectedNode.status !== 'active') {
      const resp = { error: 'Cannot make moves in a finished position' };
      saveReceipt(accountId, operationId, 'analysis', inputHash, 400, resp);
      return { status: 400, body: resp };
    }

    const currentBoard = typeof selectedNode.board === 'string' ? JSON.parse(selectedNode.board) : selectedNode.board;
    if (engine.isColumnFull(currentBoard, column)) {
      const resp = { error: `Column ${column} is full` };
      saveReceipt(accountId, operationId, 'analysis', inputHash, 400, resp);
      return { status: 400, body: resp };
    }

    // Check if child with this incoming_column already exists from selectedNode
    const existingChild = db.prepare(`
      SELECT id FROM analysis_nodes
      WHERE parent_id = ? AND analysis_id = ? AND incoming_column = ?
    `).get(selectedNode.id, analysisId, column);

    let nextSelectedNodeId;
    const now = new Date().toISOString();

    if (existingChild) {
      // Reopen existing child
      nextSelectedNodeId = existingChild.id;
    } else {
      // Create new child node
      const moveRes = engine.applyMoveToBoard(currentBoard, column, selectedNode.turn);
      const nextTurn = selectedNode.turn === 'Red' ? 'Yellow' : 'Red';
      const newNodeId = 'node-' + crypto.randomUUID();

      db.prepare(`
        INSERT INTO analysis_nodes (
          id, analysis_id, account_id, parent_id, incoming_column, move_number,
          color, landing_row, landing_col, landing_index, board, turn, status, winning_cells, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newNodeId,
        analysisId,
        accountId,
        selectedNode.id,
        column,
        selectedNode.move_number + 1,
        selectedNode.turn,
        moveRes.lastMove.row,
        column,
        moveRes.lastMove.index,
        JSON.stringify(moveRes.board),
        nextTurn,
        moveRes.status,
        JSON.stringify(moveRes.winningCells),
        now
      );

      nextSelectedNodeId = newNodeId;
    }

    const nextRevision = analysis.revision + 1;
    db.prepare(`
      UPDATE analyses SET
        selected_node_id = ?,
        revision = ?,
        updated_at = ?
      WHERE id = ?
    `).run(nextSelectedNodeId, nextRevision, now, analysisId);

    const updated = formatAnalysisFull(db, analysisId, accountId);
    saveReceipt(accountId, operationId, 'analysis', inputHash, 200, updated);
    return { status: 200, body: updated };
  });

  const resObj = performMove();
  return res.status(resObj.status).json(resObj.body);
});

// POST /api/analyses/:id/undo
router.post('/analyses/:id/undo', (req, res) => {
  const accountId = req.account.id;
  const { id: analysisId } = req.params;
  const { expectedRevision, operationId } = req.body || {};

  const allowedKeys = ['expectedRevision', 'operationId'];
  const extraKeys = Object.keys(req.body || {}).filter(k => !allowedKeys.includes(k));
  if (extraKeys.length > 0) {
    return res.status(400).json({ error: 'Unexpected additional fields' });
  }

  if (!operationId || typeof operationId !== 'string' || operationId.trim().length === 0) {
    return res.status(400).json({ error: 'Valid operationId is required' });
  }

  if (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
    return res.status(400).json({ error: 'Valid integer expectedRevision is required' });
  }

  const inputHash = hashInput({ action: 'analysisUndo', analysisId, expectedRevision, operationId });
  const cached = checkReceipt(accountId, operationId, inputHash);
  if (cached) {
    return res.status(cached.statusCode).json(cached.responseJson);
  }

  const db = getDb();
  const performUndo = db.transaction(() => {
    const analysis = db.prepare('SELECT * FROM analyses WHERE id = ? AND account_id = ?').get(analysisId, accountId);
    if (!analysis) {
      const resp = { error: 'Analysis not found' };
      saveReceipt(accountId, operationId, 'analysis', inputHash, 404, resp);
      return { status: 404, body: resp };
    }

    if (analysis.revision !== expectedRevision) {
      const resp = {
        error: 'Analysis updated in another tab',
        analysis: formatAnalysisFull(db, analysisId, accountId)
      };
      saveReceipt(accountId, operationId, 'analysis', inputHash, 409, resp);
      return { status: 409, body: resp };
    }

    const selectedNode = db.prepare('SELECT * FROM analysis_nodes WHERE id = ? AND analysis_id = ?').get(analysis.selected_node_id, analysisId);
    if (!selectedNode || !selectedNode.parent_id) {
      const resp = { error: 'Cannot undo past source step' };
      saveReceipt(accountId, operationId, 'analysis', inputHash, 400, resp);
      return { status: 400, body: resp };
    }

    const nextRevision = analysis.revision + 1;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE analyses SET
        selected_node_id = ?,
        revision = ?,
        updated_at = ?
      WHERE id = ?
    `).run(selectedNode.parent_id, nextRevision, now, analysisId);

    const updated = formatAnalysisFull(db, analysisId, accountId);
    saveReceipt(accountId, operationId, 'analysis', inputHash, 200, updated);
    return { status: 200, body: updated };
  });

  const resObj = performUndo();
  return res.status(resObj.status).json(resObj.body);
});

// POST /api/analyses/:id/redo
router.post('/analyses/:id/redo', (req, res) => {
  const accountId = req.account.id;
  const { id: analysisId } = req.params;
  const { childNodeId, expectedRevision, operationId } = req.body || {};

  const allowedKeys = ['childNodeId', 'expectedRevision', 'operationId'];
  const extraKeys = Object.keys(req.body || {}).filter(k => !allowedKeys.includes(k));
  if (extraKeys.length > 0) {
    return res.status(400).json({ error: 'Unexpected additional fields' });
  }

  if (!operationId || typeof operationId !== 'string' || operationId.trim().length === 0) {
    return res.status(400).json({ error: 'Valid operationId is required' });
  }

  if (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
    return res.status(400).json({ error: 'Valid integer expectedRevision is required' });
  }

  const inputHash = hashInput({ action: 'analysisRedo', analysisId, childNodeId: childNodeId || null, expectedRevision, operationId });
  const cached = checkReceipt(accountId, operationId, inputHash);
  if (cached) {
    return res.status(cached.statusCode).json(cached.responseJson);
  }

  const db = getDb();
  const performRedo = db.transaction(() => {
    const analysis = db.prepare('SELECT * FROM analyses WHERE id = ? AND account_id = ?').get(analysisId, accountId);
    if (!analysis) {
      const resp = { error: 'Analysis not found' };
      saveReceipt(accountId, operationId, 'analysis', inputHash, 404, resp);
      return { status: 404, body: resp };
    }

    if (analysis.revision !== expectedRevision) {
      const resp = {
        error: 'Analysis updated in another tab',
        analysis: formatAnalysisFull(db, analysisId, accountId)
      };
      saveReceipt(accountId, operationId, 'analysis', inputHash, 409, resp);
      return { status: 409, body: resp };
    }

    const children = db.prepare(`
      SELECT id, incoming_column, color, landing_row, landing_col, landing_index
      FROM analysis_nodes
      WHERE parent_id = ? AND analysis_id = ?
      ORDER BY incoming_column ASC
    `).all(analysis.selected_node_id, analysisId);

    if (children.length === 0) {
      const resp = { error: 'No continuation available to redo' };
      saveReceipt(accountId, operationId, 'analysis', inputHash, 400, resp);
      return { status: 400, body: resp };
    }

    let targetChildId;
    if (children.length === 1 && !childNodeId) {
      targetChildId = children[0].id;
    } else if (childNodeId) {
      const matching = children.find(c => c.id === childNodeId);
      if (!matching) {
        const resp = { error: 'Specified child node is not a direct continuation of current node' };
        saveReceipt(accountId, operationId, 'analysis', inputHash, 400, resp);
        return { status: 400, body: resp };
      }
      targetChildId = matching.id;
    } else {
      // Multiple children but no child specified
      const resp = {
        error: 'Ambiguous redo continuation. Please choose a child branch.',
        availableChildren: children
      };
      saveReceipt(accountId, operationId, 'analysis', inputHash, 400, resp);
      return { status: 400, body: resp };
    }

    const nextRevision = analysis.revision + 1;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE analyses SET
        selected_node_id = ?,
        revision = ?,
        updated_at = ?
      WHERE id = ?
    `).run(targetChildId, nextRevision, now, analysisId);

    const updated = formatAnalysisFull(db, analysisId, accountId);
    saveReceipt(accountId, operationId, 'analysis', inputHash, 200, updated);
    return { status: 200, body: updated };
  });

  const resObj = performRedo();
  return res.status(resObj.status).json(resObj.body);
});

// POST /api/analyses/:id/select
router.post('/analyses/:id/select', (req, res) => {
  const accountId = req.account.id;
  const { id: analysisId } = req.params;
  const { nodeId, expectedRevision, operationId } = req.body || {};

  const allowedKeys = ['nodeId', 'expectedRevision', 'operationId'];
  const extraKeys = Object.keys(req.body || {}).filter(k => !allowedKeys.includes(k));
  if (extraKeys.length > 0) {
    return res.status(400).json({ error: 'Unexpected additional fields' });
  }

  if (!operationId || typeof operationId !== 'string' || operationId.trim().length === 0) {
    return res.status(400).json({ error: 'Valid operationId is required' });
  }

  if (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
    return res.status(400).json({ error: 'Valid integer expectedRevision is required' });
  }

  if (!nodeId || typeof nodeId !== 'string') {
    return res.status(400).json({ error: 'Valid nodeId is required' });
  }

  const inputHash = hashInput({ action: 'analysisSelect', analysisId, nodeId, expectedRevision, operationId });
  const cached = checkReceipt(accountId, operationId, inputHash);
  if (cached) {
    return res.status(cached.statusCode).json(cached.responseJson);
  }

  const db = getDb();
  const performSelect = db.transaction(() => {
    const analysis = db.prepare('SELECT * FROM analyses WHERE id = ? AND account_id = ?').get(analysisId, accountId);
    if (!analysis) {
      const resp = { error: 'Analysis not found' };
      saveReceipt(accountId, operationId, 'analysis', inputHash, 404, resp);
      return { status: 404, body: resp };
    }

    if (analysis.revision !== expectedRevision) {
      const resp = {
        error: 'Analysis updated in another tab',
        analysis: formatAnalysisFull(db, analysisId, accountId)
      };
      saveReceipt(accountId, operationId, 'analysis', inputHash, 409, resp);
      return { status: 409, body: resp };
    }

    const node = db.prepare('SELECT id FROM analysis_nodes WHERE id = ? AND analysis_id = ?').get(nodeId, analysisId);
    if (!node) {
      const resp = { error: 'Target node not found in this analysis' };
      saveReceipt(accountId, operationId, 'analysis', inputHash, 400, resp);
      return { status: 400, body: resp };
    }

    const nextRevision = analysis.revision + 1;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE analyses SET
        selected_node_id = ?,
        revision = ?,
        updated_at = ?
      WHERE id = ?
    `).run(nodeId, nextRevision, now, analysisId);

    const updated = formatAnalysisFull(db, analysisId, accountId);
    saveReceipt(accountId, operationId, 'analysis', inputHash, 200, updated);
    return { status: 200, body: updated };
  });

  const resObj = performSelect();
  return res.status(resObj.status).json(resObj.body);
});

// POST /api/analyses/:id/rename
router.post('/analyses/:id/rename', (req, res) => {
  const accountId = req.account.id;
  const { id: analysisId } = req.params;
  const { name, expectedRevision, operationId } = req.body || {};

  const allowedKeys = ['name', 'expectedRevision', 'operationId'];
  const extraKeys = Object.keys(req.body || {}).filter(k => !allowedKeys.includes(k));
  if (extraKeys.length > 0) {
    return res.status(400).json({ error: 'Unexpected additional fields' });
  }

  if (!operationId || typeof operationId !== 'string' || operationId.trim().length === 0) {
    return res.status(400).json({ error: 'Valid operationId is required' });
  }

  if (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
    return res.status(400).json({ error: 'Valid integer expectedRevision is required' });
  }

  if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 60) {
    return res.status(400).json({ error: 'Name must be between 1 and 60 characters' });
  }

  const trimmedName = name.trim();
  const inputHash = hashInput({ action: 'analysisRename', analysisId, name: trimmedName, expectedRevision, operationId });
  const cached = checkReceipt(accountId, operationId, inputHash);
  if (cached) {
    return res.status(cached.statusCode).json(cached.responseJson);
  }

  const db = getDb();
  const performRename = db.transaction(() => {
    const analysis = db.prepare('SELECT * FROM analyses WHERE id = ? AND account_id = ?').get(analysisId, accountId);
    if (!analysis) {
      const resp = { error: 'Analysis not found' };
      saveReceipt(accountId, operationId, 'analysis', inputHash, 404, resp);
      return { status: 404, body: resp };
    }

    if (analysis.revision !== expectedRevision) {
      const resp = {
        error: 'Analysis updated in another tab',
        analysis: formatAnalysisFull(db, analysisId, accountId)
      };
      saveReceipt(accountId, operationId, 'analysis', inputHash, 409, resp);
      return { status: 409, body: resp };
    }

    const nextRevision = analysis.revision + 1;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE analyses SET
        name = ?,
        revision = ?,
        updated_at = ?
      WHERE id = ?
    `).run(trimmedName, nextRevision, now, analysisId);

    const updated = formatAnalysisFull(db, analysisId, accountId);
    saveReceipt(accountId, operationId, 'analysis', inputHash, 200, updated);
    return { status: 200, body: updated };
  });

  const resObj = performRename();
  return res.status(resObj.status).json(resObj.body);
});

// POST /api/analyses/:id/compare
router.post('/analyses/:id/compare', (req, res) => {
  const accountId = req.account.id;
  const { id: analysisId } = req.params;
  const { nodeAId, nodeBId } = req.body || {};

  const allowedKeys = ['nodeAId', 'nodeBId'];
  const extraKeys = Object.keys(req.body || {}).filter(k => !allowedKeys.includes(k));
  if (extraKeys.length > 0) {
    return res.status(400).json({ error: 'Unexpected additional fields' });
  }

  if (!nodeAId || typeof nodeAId !== 'string' || !nodeBId || typeof nodeBId !== 'string') {
    return res.status(400).json({ error: 'nodeAId and nodeBId are required' });
  }

  const db = getDb();
  const analysis = db.prepare('SELECT * FROM analyses WHERE id = ? AND account_id = ?').get(analysisId, accountId);
  if (!analysis) {
    return res.status(404).json({ error: 'Analysis not found' });
  }

  const nodeA = db.prepare('SELECT * FROM analysis_nodes WHERE id = ? AND analysis_id = ?').get(nodeAId, analysisId);
  const nodeB = db.prepare('SELECT * FROM analysis_nodes WHERE id = ? AND analysis_id = ?').get(nodeBId, analysisId);

  if (!nodeA || !nodeB) {
    return res.status(400).json({ error: 'One or both comparison nodes not found in this analysis' });
  }

  const allNodes = db.prepare('SELECT * FROM analysis_nodes WHERE analysis_id = ?').all(analysisId);
  const nodeMap = new Map(allNodes.map(n => [n.id, n]));

  // Trace moves from root to nodeA
  function getBranchPath(startNode) {
    const branch = [];
    let curr = startNode;
    while (curr && curr.parent_id) {
      branch.unshift({
        column: curr.incoming_column,
        color: curr.color
      });
      curr = nodeMap.get(curr.parent_id);
    }
    return branch;
  }

  const sourcePrefix = typeof analysis.source_prefix === 'string' ? JSON.parse(analysis.source_prefix) : analysis.source_prefix;
  const movesA = [...sourcePrefix, ...getBranchPath(nodeA)];
  const movesB = [...sourcePrefix, ...getBranchPath(nodeB)];

  const boardA = typeof nodeA.board === 'string' ? JSON.parse(nodeA.board) : nodeA.board;
  const boardB = typeof nodeB.board === 'string' ? JSON.parse(nodeB.board) : nodeB.board;

  const sharedOpeningMovesCount = engine.findCommonPrefixLength(movesA, movesB);
  const differingCells = engine.diffBoards(boardA, boardB);

  const winningCellsA = nodeA.winning_cells === 'none' || !nodeA.winning_cells ? [] : (typeof nodeA.winning_cells === 'string' ? JSON.parse(nodeA.winning_cells) : nodeA.winning_cells);
  const winningCellsB = nodeB.winning_cells === 'none' || !nodeB.winning_cells ? [] : (typeof nodeB.winning_cells === 'string' ? JSON.parse(nodeB.winning_cells) : nodeB.winning_cells);

  return res.json({
    nodeA: {
      id: nodeA.id,
      moveNumber: nodeA.move_number,
      turn: nodeA.turn,
      status: nodeA.status,
      winningCells: winningCellsA,
      board: boardA
    },
    nodeB: {
      id: nodeB.id,
      moveNumber: nodeB.move_number,
      turn: nodeB.turn,
      status: nodeB.status,
      winningCells: winningCellsB,
      board: boardB
    },
    sharedOpeningMovesCount,
    differingCells
  });
});

// POST /api/analyses/:id/transplant/preview
router.post('/analyses/:id/transplant/preview', (req, res) => {
  const accountId = req.account.id;
  const { id: sourceAnalysisId } = req.params;
  const { sourceNodeId, destAnalysisId, destNodeId } = req.body || {};

  const allowedKeys = ['sourceNodeId', 'destAnalysisId', 'destNodeId'];
  const extraKeys = Object.keys(req.body || {}).filter(k => !allowedKeys.includes(k));
  if (extraKeys.length > 0) {
    return res.status(400).json({ error: 'Unexpected additional fields' });
  }

  if (!sourceNodeId || typeof sourceNodeId !== 'string' || !destAnalysisId || typeof destAnalysisId !== 'string' || !destNodeId || typeof destNodeId !== 'string') {
    return res.status(400).json({ error: 'sourceNodeId, destAnalysisId, and destNodeId are required' });
  }

  const db = getDb();
  const sourceAnalysis = db.prepare('SELECT * FROM analyses WHERE id = ? AND account_id = ?').get(sourceAnalysisId, accountId);
  const destAnalysis = db.prepare('SELECT * FROM analyses WHERE id = ? AND account_id = ?').get(destAnalysisId, accountId);

  if (!sourceAnalysis || !destAnalysis) {
    return res.status(404).json({ error: 'Source or destination analysis not found' });
  }

  const sourceNode = db.prepare('SELECT * FROM analysis_nodes WHERE id = ? AND analysis_id = ?').get(sourceNodeId, sourceAnalysisId);
  const destNode = db.prepare('SELECT * FROM analysis_nodes WHERE id = ? AND analysis_id = ?').get(destNodeId, destAnalysisId);

  if (!sourceNode || !destNode) {
    return res.status(400).json({ error: 'Source node or destination node not found' });
  }

  if (!sourceNode.parent_id || sourceNode.incoming_column === null) {
    return res.status(400).json({ error: 'Cannot transplant from the root position. Choose a branch node.' });
  }

  const sourceAllNodes = db.prepare('SELECT * FROM analysis_nodes WHERE analysis_id = ?').all(sourceAnalysisId);
  const destAllNodes = db.prepare('SELECT * FROM analysis_nodes WHERE analysis_id = ?').all(destAnalysisId);

  const previewResult = engine.previewTransplant(sourceNode, sourceAllNodes, destNode, destAllNodes);

  if (!previewResult.valid) {
    return res.status(422).json({
      error: previewResult.error.reason,
      illegalPath: previewResult.error.path
    });
  }

  const previewId = 'preview-' + crypto.randomUUID();
  db.prepare(`
    INSERT INTO transplant_previews (
      id, account_id, source_analysis_id, source_node_id, source_revision,
      dest_analysis_id, dest_node_id, dest_revision, preview_data, committed, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
  `).run(
    previewId,
    accountId,
    sourceAnalysisId,
    sourceNodeId,
    sourceAnalysis.revision,
    destAnalysisId,
    destNodeId,
    destAnalysis.revision,
    JSON.stringify(previewResult)
  );

  return res.json({
    previewId,
    sourceAnalysisId,
    sourceNodeId,
    sourceRevision: sourceAnalysis.revision,
    destAnalysisId,
    destNodeId,
    destRevision: destAnalysis.revision,
    newCount: previewResult.newCount,
    reusedCount: previewResult.reusedCount,
    previewNodes: previewResult.previewNodes
  });
});

// POST /api/analyses/:id/transplant/commit
router.post('/analyses/:id/transplant/commit', (req, res) => {
  const accountId = req.account.id;
  const { id: sourceAnalysisId } = req.params;
  const { previewId, operationId } = req.body || {};

  const allowedKeys = ['previewId', 'operationId'];
  const extraKeys = Object.keys(req.body || {}).filter(k => !allowedKeys.includes(k));
  if (extraKeys.length > 0) {
    return res.status(400).json({ error: 'Unexpected additional fields' });
  }

  if (!operationId || typeof operationId !== 'string' || operationId.trim().length === 0) {
    return res.status(400).json({ error: 'Valid operationId is required' });
  }

  if (!previewId || typeof previewId !== 'string') {
    return res.status(400).json({ error: 'Valid previewId is required' });
  }

  const inputHash = hashInput({ action: 'transplantCommit', previewId, operationId });
  const cached = checkReceipt(accountId, operationId, inputHash);
  if (cached) {
    return res.status(cached.statusCode).json(cached.responseJson);
  }

  const db = getDb();
  const commitTx = db.transaction(() => {
    const preview = db.prepare('SELECT * FROM transplant_previews WHERE id = ? AND account_id = ?').get(previewId, accountId);
    if (!preview) {
      const resp = { error: 'Transplant preview not found' };
      saveReceipt(accountId, operationId, 'transplant', inputHash, 404, resp);
      return { status: 404, body: resp };
    }

    if (preview.committed === 1) {
      const resp = { error: 'This transplant preview has already been committed' };
      saveReceipt(accountId, operationId, 'transplant', inputHash, 400, resp);
      return { status: 400, body: resp };
    }

    const sourceAnalysis = db.prepare('SELECT revision FROM analyses WHERE id = ? AND account_id = ?').get(preview.source_analysis_id, accountId);
    const destAnalysis = db.prepare('SELECT revision FROM analyses WHERE id = ? AND account_id = ?').get(preview.dest_analysis_id, accountId);

    if (!sourceAnalysis || !destAnalysis) {
      const resp = { error: 'Source or destination analysis no longer exists' };
      saveReceipt(accountId, operationId, 'transplant', inputHash, 404, resp);
      return { status: 404, body: resp };
    }

    if (sourceAnalysis.revision !== preview.source_revision || destAnalysis.revision !== preview.dest_revision) {
      const resp = {
        error: 'Analysis state changed since preview was generated. Please re-preview before committing.',
        sourceRevision: sourceAnalysis.revision,
        destRevision: destAnalysis.revision
      };
      saveReceipt(accountId, operationId, 'transplant', inputHash, 409, resp);
      return { status: 409, body: resp };
    }

    const previewData = JSON.parse(preview.preview_data);
    const previewNodes = previewData.previewNodes;

    const destParentNode = db.prepare('SELECT move_number FROM analysis_nodes WHERE id = ?').get(preview.dest_node_id);
    const nodeMapping = {};
    const now = new Date().toISOString();

    for (const node of previewNodes) {
      let actualDestNodeId;

      if (node.reused) {
        actualDestNodeId = node.reusedDestNodeId;
      } else {
        // Determine parent id in destination
        let parentDestId;
        if (!node.parentSourceId || node.parentSourceId === preview.dest_node_id || node.sourceNodeId === preview.source_node_id) {
          parentDestId = preview.dest_node_id;
        } else {
          parentDestId = nodeMapping[node.parentSourceId];
        }

        const parentNodeInDest = db.prepare('SELECT move_number FROM analysis_nodes WHERE id = ?').get(parentDestId);
        const parentMoveNumber = parentNodeInDest ? parentNodeInDest.move_number : destParentNode.move_number;

        const newNodeId = 'node-' + crypto.randomUUID();
        db.prepare(`
          INSERT INTO analysis_nodes (
            id, analysis_id, account_id, parent_id, incoming_column, move_number,
            color, landing_row, landing_col, landing_index, board, turn, status, winning_cells, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          newNodeId,
          preview.dest_analysis_id,
          accountId,
          parentDestId,
          node.incomingColumn,
          parentMoveNumber + 1,
          node.color,
          node.landingRow,
          node.landingCol,
          node.landingIndex,
          JSON.stringify(node.board),
          node.turn,
          node.status,
          JSON.stringify(node.winningCells),
          now
        );

        actualDestNodeId = newNodeId;
      }

      nodeMapping[node.sourceNodeId] = actualDestNodeId;
    }

    // Mark preview committed
    db.prepare('UPDATE transplant_previews SET committed = 1 WHERE id = ?').run(previewId);

    // Advance only destination revision exactly once
    const nextDestRevision = destAnalysis.revision + 1;
    db.prepare('UPDATE analyses SET revision = ?, updated_at = ? WHERE id = ?').run(
      nextDestRevision,
      now,
      preview.dest_analysis_id
    );

    const resultBody = {
      success: true,
      previewId,
      destAnalysisId: preview.dest_analysis_id,
      destAnalysisRevision: nextDestRevision,
      nodeMapping,
      newCount: previewData.newCount,
      reusedCount: previewData.reusedCount
    };

    saveReceipt(accountId, operationId, 'transplant', inputHash, 200, resultBody);
    return { status: 200, body: resultBody };
  });

  const resObj = commitTx();
  return res.status(resObj.status).json(resObj.body);
});

// GET or POST /api/analyses/:id/tactical
function handleTacticalReport(req, res) {
  const accountId = req.account.id;
  const { id: analysisId } = req.params;
  const nodeId = req.method === 'POST' ? req.body?.nodeId : req.query.nodeId;
  const rawDepth = req.method === 'POST' ? req.body?.depth : req.query.depth;

  if (req.method === 'POST') {
    const allowedKeys = ['nodeId', 'depth'];
    const extraKeys = Object.keys(req.body || {}).filter(k => !allowedKeys.includes(k));
    if (extraKeys.length > 0) {
      return res.status(400).json({ error: 'Unexpected additional fields' });
    }
  }

  if (!nodeId || typeof nodeId !== 'string') {
    return res.status(400).json({ error: 'Valid nodeId is required' });
  }

  const depth = Number(rawDepth);
  if (!Number.isInteger(depth) || depth < 1 || depth > 4) {
    return res.status(400).json({ error: 'Depth must be an integer between 1 and 4' });
  }

  const db = getDb();
  const analysis = db.prepare('SELECT id, revision FROM analyses WHERE id = ? AND account_id = ?').get(analysisId, accountId);
  if (!analysis) {
    return res.status(404).json({ error: 'Analysis not found' });
  }

  const node = db.prepare('SELECT * FROM analysis_nodes WHERE id = ? AND analysis_id = ?').get(nodeId, analysisId);
  if (!node) {
    return res.status(400).json({ error: 'Node not found in this analysis' });
  }

  const board = typeof node.board === 'string' ? JSON.parse(node.board) : node.board;
  const winningCells = node.winning_cells === 'none' || !node.winning_cells ? [] : (typeof node.winning_cells === 'string' ? JSON.parse(node.winning_cells) : node.winning_cells);

  const report = engine.computeTacticalReport(board, node.turn, depth, node.status, winningCells);

  return res.json({
    analysisId,
    nodeId,
    analysisRevision: analysis.revision,
    depth,
    playerToMove: node.turn,
    isTerminal: report.isTerminal,
    rootOutcome: report.rootOutcome,
    columns: report.columns,
    tree: report.tree
  });
}

router.get('/analyses/:id/tactical', handleTacticalReport);
router.post('/analyses/:id/tactical', handleTacticalReport);

module.exports = {
  router,
  formatAnalysisFull
};
