const state = {
  token: localStorage.getItem('dropline-token') || '',
  me: null,
  bootstrap: null,
  game: null,
  analyses: [],
  archive: [],
  archiveDetail: null,
  analysis: null,
  analysisCache: new Map(),
  messageTimer: null,
  busy: new Set(),
  branchPreview: null,
  compareResult: null,
  reportResult: null,
};

const els = {
  loginPanel: document.getElementById('loginPanel'),
  dashboard: document.getElementById('dashboard'),
  loginForm: document.getElementById('loginForm'),
  emailInput: document.getElementById('emailInput'),
  passwordInput: document.getElementById('passwordInput'),
  sessionBadge: document.getElementById('sessionBadge'),
  signOutBtn: document.getElementById('signOutBtn'),
  accountName: document.getElementById('accountName'),
  accountEmail: document.getElementById('accountEmail'),
  scoreSummary: document.getElementById('scoreSummary'),
  gameMeta: document.getElementById('gameMeta'),
  analysisSummary: document.getElementById('analysisSummary'),
  messageBar: document.getElementById('messageBar'),
  gameBoardWrap: document.getElementById('gameBoardWrap'),
  gameResult: document.getElementById('gameResult'),
  gameHistory: document.getElementById('gameHistory'),
  gameRedo: document.getElementById('gameRedo'),
  gameUndoBtn: document.getElementById('gameUndoBtn'),
  gameRedoBtn: document.getElementById('gameRedoBtn'),
  archiveSelect: document.getElementById('archiveSelect'),
  archiveMeta: document.getElementById('archiveMeta'),
  archiveBoardWrap: document.getElementById('archiveBoardWrap'),
  archiveStep: document.getElementById('archiveStep'),
  archiveHistory: document.getElementById('archiveHistory'),
  createAnalysisFromReplay: document.getElementById('createAnalysisFromReplay'),
  analysisList: document.getElementById('analysisList'),
  analysisPanel: document.getElementById('analysisPanel'),
  analysisTitle: document.getElementById('analysisTitle'),
  analysisSource: document.getElementById('analysisSource'),
  closeAnalysisBtn: document.getElementById('closeAnalysisBtn'),
  analysisNameInput: document.getElementById('analysisNameInput'),
  renameAnalysisBtn: document.getElementById('renameAnalysisBtn'),
  analysisRevision: document.getElementById('analysisRevision'),
  analysisBoardWrap: document.getElementById('analysisBoardWrap'),
  analysisUndoBtn: document.getElementById('analysisUndoBtn'),
  analysisRedoBtn: document.getElementById('analysisRedoBtn'),
  analysisRedoChoice: document.getElementById('analysisRedoChoice'),
  analysisHistory: document.getElementById('analysisHistory'),
  analysisTree: document.getElementById('analysisTree'),
  compareLeft: document.getElementById('compareLeft'),
  compareRight: document.getElementById('compareRight'),
  compareBtn: document.getElementById('compareBtn'),
  compareResult: document.getElementById('compareResult'),
  branchSourceAnalysis: document.getElementById('branchSourceAnalysis'),
  branchSourceNode: document.getElementById('branchSourceNode'),
  branchDestinationAnalysis: document.getElementById('branchDestinationAnalysis'),
  branchDestinationNode: document.getElementById('branchDestinationNode'),
  branchPreviewBtn: document.getElementById('branchPreviewBtn'),
  branchCommitBtn: document.getElementById('branchCommitBtn'),
  branchPreviewResult: document.getElementById('branchPreviewResult'),
  reportDepth: document.getElementById('reportDepth'),
  reportNode: document.getElementById('reportNode'),
  reportBtn: document.getElementById('reportBtn'),
  reportResult: document.getElementById('reportResult'),
  toast: document.getElementById('toast'),
};

const BOARD_ROWS = 6;
const BOARD_COLS = 7;
const TOTAL_CELLS = 42;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function joinMoves(moves) {
  return moves.map((move, index) => `${index + 1}. ${move.color} · col ${move.column}`).join('');
}

function makeOpId() {
  return crypto.randomUUID().replaceAll('-', '');
}

function setBusy(key, isBusy) {
  if (isBusy) state.busy.add(key);
  else state.busy.delete(key);
  renderButtons();
}

function isBusy(key) {
  return state.busy.has(key);
}

function showToast(message, tone = 'good') {
  els.toast.textContent = message;
  els.toast.className = `toast show ${tone}`;
  clearTimeout(state.messageTimer);
  state.messageTimer = setTimeout(() => {
    els.toast.className = 'toast';
  }, 3500);
}

function setMessage(message, tone = 'good') {
  els.messageBar.textContent = message;
  els.messageBar.className = `message-bar ${tone}`;
  if (message) showToast(message, tone);
}

function authHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!response.ok) {
    const err = new Error(data?.error || `Request failed (${response.status})`);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

function moveLabel(move) {
  return `${move.index}. ${move.color} column ${move.column} → row ${move.row}`;
}

function nodeLabel(node) {
  if (node.parentId == null) return `Root · ${node.turn || '—'} to move`;
  const prefix = node.history?.length ? `${node.history.length}. ` : '';
  return `${prefix}${node.color} column ${node.incomingColumn} → row ${node.row}${node.result ? ` · ${node.result}` : ''}`;
}

function boardLabel(row, column, occupant, winning = false, different = false) {
  const parts = [`Row ${row}`, `Column ${column}`, occupant || 'Empty'];
  if (winning) parts.push('Winning cell');
  if (different) parts.push('Different cell');
  return parts.join(', ');
}

function renderBoard(container, board, options = {}) {
  if (!board || board.length !== TOTAL_CELLS) {
    container.innerHTML = '<p class="muted">No board loaded.</p>';
    return;
  }
  const winning = new Set(options.winningCells || []);
  const diff = new Set(options.differences || []);
  const canPlay = typeof options.onColumn === 'function';
  const title = options.title || '';
  const columnButtons = [];
  for (let col = 1; col <= BOARD_COLS; col += 1) {
    const disabled = options.disabled || !canPlay;
    columnButtons.push(`<button class="secondary column-btn" data-column="${col}" type="button" ${disabled ? 'disabled' : ''} aria-label="Drop in column ${col}">${col}</button>`);
  }
  const cells = [];
  for (let row = 1; row <= BOARD_ROWS; row += 1) {
    for (let column = 1; column <= BOARD_COLS; column += 1) {
      const index = (row - 1) * BOARD_COLS + (column - 1);
      const occupant = board[index] || '';
      const classes = ['cell'];
      if (occupant === 'Red') classes.push('red');
      if (occupant === 'Yellow') classes.push('yellow');
      if (winning.has(index)) classes.push('win');
      if (diff.has(index)) classes.push('diff');
      cells.push(`<div class="${classes.join(' ')}" role="gridcell" aria-label="${escapeHtml(boardLabel(row, column, occupant, winning.has(index), diff.has(index)))}"></div>`);
    }
  }
  container.innerHTML = `
    <div class="board-shell">
      ${title ? `<div class="board-title"><strong>${escapeHtml(title)}</strong></div>` : ''}
      <div class="column-row">${columnButtons.join('')}</div>
      <div class="board-grid" role="grid" aria-label="Connect Four board">${cells.join('')}</div>
    </div>
  `;
  container.querySelectorAll('.column-btn').forEach((button) => {
    button.addEventListener('click', () => options.onColumn(Number(button.dataset.column)));
  });
}

function renderHistory(listEl, history, emptyText = 'No moves yet.') {
  if (!history || !history.length) {
    listEl.innerHTML = `<li class="muted">${escapeHtml(emptyText)}</li>`;
    return;
  }
  listEl.innerHTML = history.map((move) => `<li>${escapeHtml(moveLabel(move))}</li>`).join('');
}

function renderAnalysisList() {
  if (!state.analyses.length) {
    els.analysisList.innerHTML = '<p class="muted">No saved analyses yet.</p>';
    return;
  }
  els.analysisList.innerHTML = state.analyses.map((analysis) => `
    <div class="analysis-item card">
      <div>
        <strong>${escapeHtml(analysis.name)}</strong>
        <div class="muted">${escapeHtml(analysis.sourceLabel)} · step ${analysis.sourceStep} · revision ${analysis.revision}</div>
      </div>
      <button class="secondary" type="button" data-open-analysis="${analysis.id}">Open</button>
    </div>
  `).join('');
  els.analysisList.querySelectorAll('[data-open-analysis]').forEach((button) => {
    button.addEventListener('click', () => openAnalysis(Number(button.dataset.openAnalysis)));
  });
}

function nodeOptions(nodes) {
  return nodes.map((node) => `<option value="${node.id}">${escapeHtml(nodeLabel(node))}</option>`).join('');
}

function analysisTreeMarkup(node, selectedId) {
  if (!node) return '<p class="muted">No tree loaded.</p>';
  const selected = node.id === selectedId;
  const children = (node.children || []).map((child) => analysisTreeMarkup(child, selectedId)).join('');
  return `
    <div class="tree-node ${selected ? 'selected' : ''}">
      <button class="secondary" type="button" data-select-node="${node.id}">${escapeHtml(nodeLabel(node))}</button>
      <div class="node-meta">${escapeHtml(`Node ${node.id} · path ${node.history && node.history.length ? node.history.map((move) => move.column).join(' → ') : 'root'}`)}</div>
      ${children}
    </div>
  `;
}

function compareBoardMarkup(board, winningCells = [], diffCells = []) {
  const diffSet = new Set(diffCells.map((cell) => cell.index));
  const winSet = new Set(winningCells || []);
  const cells = [];
  for (let row = 1; row <= BOARD_ROWS; row += 1) {
    for (let column = 1; column <= BOARD_COLS; column += 1) {
      const index = (row - 1) * BOARD_COLS + (column - 1);
      const occupant = board[index] || '';
      const classes = ['cell'];
      if (occupant === 'Red') classes.push('red');
      if (occupant === 'Yellow') classes.push('yellow');
      if (winSet.has(index)) classes.push('win');
      if (diffSet.has(index)) classes.push('diff');
      cells.push(`<div class="${classes.join(' ')}" role="gridcell" aria-label="${escapeHtml(boardLabel(row, column, occupant, winSet.has(index), diffSet.has(index)))}"></div>`);
    }
  }
  return `<div class="board-grid compare-board" role="grid" aria-label="Position comparison board">${cells.join('')}</div>`;
}

function proofTreeMarkup(node, selectedPath = []) {
  if (!node) return '<p class="muted">No report loaded.</p>';
  const pathText = node.path && node.path.length ? node.path.join(' → ') : 'root';
  const children = (node.children || []).map((child) => proofTreeMarkup(child, selectedPath)).join('');
  return `
    <div class="tree-node">
      <button class="secondary" type="button" data-proof-path="${escapeHtml(pathText)}" data-proof-board="${escapeHtml(JSON.stringify(node.board))}">
        ${escapeHtml(pathText)} · ${escapeHtml(node.player)} · ${escapeHtml(node.outcome)}${node.distance !== null && node.distance !== undefined ? ` in ${node.distance} plies` : ''}${node.terminal ? ' · terminal' : ''}${node.horizon ? ' · horizon' : ''}
      </button>
      ${children}
    </div>
  `;
}

function renderSession() {
  if (!state.token || !state.me) {
    els.sessionBadge.textContent = 'Not signed in';
    els.signOutBtn.classList.add('hidden');
    els.loginPanel.classList.remove('hidden');
    els.dashboard.classList.add('hidden');
    return;
  }
  els.sessionBadge.textContent = `${state.me.name} · ${state.me.email}`;
  els.signOutBtn.classList.remove('hidden');
  els.loginPanel.classList.add('hidden');
  els.dashboard.classList.remove('hidden');
}

function renderGame() {
  if (!state.game) return;
  els.accountName.textContent = state.me?.name || '—';
  els.accountEmail.textContent = state.me?.email || '—';
  els.scoreSummary.textContent = `${state.game.redWins} Red wins · ${state.game.yellowWins} Yellow wins · ${state.game.draws} draws`;
  els.gameMeta.textContent = `Revision ${state.game.revision} · Round ${state.game.roundId} · ${state.game.status}`;
  els.gameResult.textContent = state.game.result ? `Result: ${state.game.result}` : `Turn: ${state.game.currentPlayer}`;
  renderBoard(els.gameBoardWrap, state.game.board, {
    winningCells: state.game.winningCells,
    disabled: Boolean(state.game.result || state.game.status === 'completed'),
    onColumn: playCompetitiveMove,
    title: 'Competitive board',
  });
  renderHistory(els.gameHistory, state.game.history, 'No moves yet.');
  renderHistory(els.gameRedo, state.game.redoHistory, 'Redo stack empty.');
  els.gameUndoBtn.disabled = isBusy('gameUndo') || !state.game.history.length;
  els.gameRedoBtn.disabled = isBusy('gameRedo') || !state.game.redoHistory.length;
}

function renderArchive() {
  const summary = state.archive.length ? `${state.archive.length} archived matches` : 'No archived matches yet.';
  els.analysisSummary.textContent = `${state.analyses.length} saved analyses`;
  els.archiveSelect.innerHTML = state.archive.map((match) => `<option value="${escapeHtml(match.matchId)}">${escapeHtml(match.matchId)} · ${escapeHtml(match.result)}</option>`).join('');
  if (!state.archiveDetail && state.archive.length) {
    state.archiveDetail = null;
  }
  if (state.archiveDetail) {
    const detail = state.archiveDetail;
    els.archiveMeta.textContent = `${detail.matchId} · ${detail.result} · ${detail.completedAt} · ${detail.moveCount} moves`;
    els.archiveStep.max = String(detail.moveCount);
    const step = Number(els.archiveStep.value || detail.moveCount);
    const stepHistory = detail.history.slice(0, step);
    const stateAtStep = replayFromMoves(stepHistory);
    renderBoard(els.archiveBoardWrap, stateAtStep.board, { winningCells: stateAtStep.winningCells, disabled: true, title: `Replay step ${step} / ${detail.moveCount}` });
    renderHistory(els.archiveHistory, stepHistory, 'No moves in this replay.');
  } else {
    els.archiveMeta.textContent = summary;
    els.archiveBoardWrap.innerHTML = '<p class="muted">Select a completed match to inspect its replay.</p>';
    els.archiveHistory.innerHTML = '<li class="muted">No replay loaded.</li>';
  }
}

function renderAnalysis() {
  if (!state.analysis) {
    els.analysisPanel.classList.add('hidden');
    return;
  }
  els.analysisPanel.classList.remove('hidden');
  const detail = state.analysis;
  const analysis = detail.analysis;
  const selected = detail.selectedNode || detail.nodes.find((node) => node.id === analysis.selectedNodeId) || detail.nodes[0];
  els.analysisTitle.textContent = analysis.name;
  els.analysisSource.textContent = `${analysis.sourceLabel} · step ${analysis.sourceStep} · root revision ${analysis.revision}`;
  els.analysisNameInput.value = analysis.name;
  els.analysisRevision.textContent = `Revision ${analysis.revision}`;
  if (selected) {
    els.analysisResult.textContent = selected.result ? `Result: ${selected.result}` : `Turn: ${selected.turn}`;
    renderBoard(els.analysisBoardWrap, selected.board, { winningCells: selected.winningCells, disabled: Boolean(selected.result), onColumn: playAnalysisMove, title: `Selected node ${selected.id}` });
    renderHistory(els.analysisHistory, selected.history, 'Selected node has no moves yet.');
  }
  renderRedoChoice(detail, selected);
  els.analysisTree.innerHTML = detail.tree ? analysisTreeMarkup(detail.tree, selected?.id) : '<p class="muted">No tree loaded.</p>';
  els.analysisTree.querySelectorAll('[data-select-node]').forEach((button) => {
    button.addEventListener('click', () => selectAnalysisNode(Number(button.dataset.selectNode)));
  });
  const compareOptions = nodeOptions(detail.nodes);
  els.compareLeft.innerHTML = compareOptions;
  els.compareRight.innerHTML = compareOptions;
  if (!els.compareLeft.value) els.compareLeft.value = String(selected?.id || analysis.rootNodeId);
  if (!els.compareRight.value) els.compareRight.value = String(selected?.id || analysis.rootNodeId);
  renderBranchSelectors();
  renderReportSelector();
  if (state.compareResult) renderCompareResult(state.compareResult);
  if (state.branchPreview) renderBranchPreviewResult(state.branchPreview);
  if (state.reportResult) renderReportResult(state.reportResult);
}

function renderRedoChoice(detail, selected) {
  const children = detail.nodes.filter((node) => node.parentId === selected?.id);
  if (children.length <= 1) {
    els.analysisRedoChoice.classList.add('hidden');
    els.analysisRedoChoice.innerHTML = '';
    return;
  }
  els.analysisRedoChoice.classList.remove('hidden');
  els.analysisRedoChoice.innerHTML = children.map((child) => `<option value="${child.id}">${escapeHtml(nodeLabel(child))}</option>`).join('');
}

function renderBranchSelectors() {
  const analyses = state.analyses;
  if (!analyses.length) return;
  els.branchSourceAnalysis.innerHTML = analyses.map((analysis) => `<option value="${analysis.id}">${escapeHtml(analysis.name)}</option>`).join('');
  els.branchDestinationAnalysis.innerHTML = analyses.map((analysis) => `<option value="${analysis.id}">${escapeHtml(analysis.name)}</option>`).join('');
  const sourceId = state.analysis?.analysis?.id || Number(localStorage.getItem('dropline-open-analysis')) || analyses[0].id;
  if (!els.branchSourceAnalysis.value) els.branchSourceAnalysis.value = String(sourceId);
  if (!els.branchDestinationAnalysis.value) els.branchDestinationAnalysis.value = String(sourceId);
  syncBranchNodeSelectors();
}

async function syncBranchNodeSelectors() {
  const sourceAnalysisId = Number(els.branchSourceAnalysis.value || state.analysis?.analysis?.id);
  const destinationAnalysisId = Number(els.branchDestinationAnalysis.value || state.analysis?.analysis?.id);
  const sourceDetail = await ensureAnalysisDetail(sourceAnalysisId);
  const destinationDetail = await ensureAnalysisDetail(destinationAnalysisId);
  if (sourceDetail) {
    const sourceNodes = sourceDetail.nodes.filter((node) => node.parentId != null);
    els.branchSourceNode.innerHTML = sourceNodes.map((node) => `<option value="${node.id}">${escapeHtml(nodeLabel(node))}</option>`).join('') || '<option value="">No source nodes</option>';
    if (!els.branchSourceNode.value && sourceNodes[0]) els.branchSourceNode.value = String(sourceNodes[0].id);
  }
  if (destinationDetail) {
    els.branchDestinationNode.innerHTML = destinationDetail.nodes.map((node) => `<option value="${node.id}">${escapeHtml(nodeLabel(node))}</option>`).join('');
    if (!els.branchDestinationNode.value && destinationDetail.analysis.rootNodeId) els.branchDestinationNode.value = String(destinationDetail.analysis.rootNodeId);
  }
}

function renderCompareResult(result) {
  if (!result) {
    els.compareResult.innerHTML = '<p class="muted">Choose two nodes and compare them.</p>';
    return;
  }
  const leftBoard = compareBoardMarkup(result.left.board, result.left.winningCells, result.differingCells);
  const rightBoard = compareBoardMarkup(result.right.board, result.right.winningCells, result.differingCells);
  const diffList = result.differingCells.length
    ? `<ul class="history-list">${result.differingCells.map((cell) => `<li class="compare-diff">Row ${cell.row}, Column ${cell.column}: ${escapeHtml(cell.left || 'Empty')} ↔ ${escapeHtml(cell.right || 'Empty')}</li>`).join('')}</ul>`
    : '<p class="muted">No differing cells.</p>';
  els.compareResult.innerHTML = `
    <div class="compare-grid">
      <p><strong>${escapeHtml(result.commonPrefixMoves)} shared opening moves</strong></p>
      <div class="compare-cols">
        <div class="compare-card">
          <h4>Left</h4>
          ${leftBoard}
        </div>
        <div class="compare-card">
          <h4>Right</h4>
          ${rightBoard}
        </div>
      </div>
      <div class="compare-card">
        <h4>Differences</h4>
        ${diffList}
      </div>
    </div>
  `;
}

function renderBranchPreviewResult(result) {
  if (!result) {
    els.branchPreviewResult.innerHTML = '<p class="muted">Preview a branch to see reuse and legality.</p>';
    return;
  }
  const preview = result.preview || result;
  const illegal = preview.illegal;
  els.branchPreviewResult.innerHTML = `
    <div class="inline-stack">
      <p><strong>${preview.newCount} new</strong> nodes · <strong>${preview.reusedCount} reused</strong> nodes</p>
      ${illegal ? `<p class="compare-diff">Illegal path ${escapeHtml((illegal.path || []).join(' → ') || 'root')}: ${escapeHtml(illegal.reason)}</p>` : '<p class="muted">Preview is legal and ready to commit.</p>'}
      <div class="history-list">
        ${preview.relativePaths.map((entry) => `<div class="card"><strong>${escapeHtml((entry.relativePath || []).join(' → ') || 'root')}</strong><div class="muted">${entry.reused ? 'Reused' : 'New'} · node ${entry.sourceNodeId} → ${entry.destinationNodeId ?? 'pending'}</div></div>`).join('')}
      </div>
    </div>
  `;
}

function renderReportResult(result) {
  if (!result) {
    els.reportResult.innerHTML = '<p class="muted">Generate a tactical report for the selected node.</p>';
    return;
  }
  const proof = result.proofTree;
  els.reportResult.innerHTML = `
    <div class="inline-stack">
      <p><strong>Perspective:</strong> ${escapeHtml(result.perspective)} · <strong>Outcome:</strong> ${escapeHtml(result.outcome)}${result.distance !== null && result.distance !== undefined ? ` in ${result.distance} plies` : ''}</p>
      ${result.terminalResult ? `<p><strong>Terminal result:</strong> ${escapeHtml(result.terminalResult)}</p>` : ''}
      <div class="compare-card">
        <h4>Playable columns</h4>
        ${result.playableColumns.length ? `<ul class="history-list">${result.playableColumns.map((col) => `<li>Column ${col.column}: ${escapeHtml(col.label)}</li>`).join('')}</ul>` : '<p class="muted">No playable columns at this depth.</p>'}
      </div>
      <div class="compare-card">
        <h4>Proof tree</h4>
        <div id="proofTreeWrap" class="tree">${proofTreeMarkup(proof)}</div>
      </div>
      <div class="compare-card">
        <h4>Selected proof node</h4>
        <div id="proofPreviewBoard"></div>
      </div>
    </div>
  `;
  const wrap = document.getElementById('proofTreeWrap');
  const preview = document.getElementById('proofPreviewBoard');
  if (wrap && preview) {
    wrap.querySelectorAll('[data-proof-board]').forEach((button) => {
      button.addEventListener('click', () => {
        const board = JSON.parse(button.dataset.proofBoard);
        renderBoard(preview, board, { disabled: true, title: button.dataset.proofPath || 'proof node' });
      });
    });
    if (proof) renderBoard(preview, proof.board, { disabled: true, title: 'root proof node' });
  }
}

function renderButtons() {
  els.gameUndoBtn.disabled = isBusy('gameUndo') || !state.game?.history?.length;
  els.gameRedoBtn.disabled = isBusy('gameRedo') || !state.game?.redoHistory?.length;
  els.analysisUndoBtn.disabled = isBusy('analysisUndo') || !state.analysis?.selectedNodeId;
  els.analysisRedoBtn.disabled = isBusy('analysisRedo') || !state.analysis;
  els.renameAnalysisBtn.disabled = isBusy('analysisRename') || !state.analysis;
  els.compareBtn.disabled = isBusy('compare') || !state.analysis;
  els.branchPreviewBtn.disabled = isBusy('branchPreview') || !state.analysis;
  els.branchCommitBtn.disabled = isBusy('branchCommit') || !state.branchPreview;
  els.reportBtn.disabled = isBusy('report') || !state.analysis;
  els.createAnalysisFromReplay.disabled = isBusy('createAnalysis') || !state.archiveDetail;
}

function replayFromMoves(moves) {
  let board = Array.from({ length: TOTAL_CELLS }, () => '');
  let winningCells = [];
  let turn = 'Red';
  let result = null;
  for (let i = 0; i < moves.length; i += 1) {
    const move = moves[i];
    const row = findDropRow(board, move.column);
    if (!row) continue;
    const index = (row - 1) * BOARD_COLS + (move.column - 1);
    board[index] = move.color;
    const win = detectWin(board);
    result = win.result;
    winningCells = win.winningCells;
    turn = move.color === 'Red' ? 'Yellow' : 'Red';
  }
  return { board, winningCells, turn, result };
}

function findDropRow(board, column) {
  for (let row = BOARD_ROWS; row >= 1; row -= 1) {
    const index = (row - 1) * BOARD_COLS + (column - 1);
    if (!board[index]) return row;
  }
  return null;
}

function detectWin(board) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let row = 1; row <= BOARD_ROWS; row += 1) {
    for (let column = 1; column <= BOARD_COLS; column += 1) {
      const occupant = board[(row - 1) * BOARD_COLS + (column - 1)];
      if (!occupant) continue;
      for (const [dr, dc] of dirs) {
        const cells = [[row, column]];
        let ok = true;
        for (let step = 1; step < 4; step += 1) {
          const r = row + dr * step;
          const c = column + dc * step;
          if (r < 1 || r > BOARD_ROWS || c < 1 || c > BOARD_COLS) { ok = false; break; }
          const idx = (r - 1) * BOARD_COLS + (c - 1);
          if (board[idx] !== occupant) { ok = false; break; }
          cells.push([r, c]);
        }
        if (ok) return { result: `${occupant} wins`, winningCells: cells.map(([r, c]) => (r - 1) * BOARD_COLS + (c - 1)) };
      }
    }
  }
  if (board.every(Boolean)) return { result: 'Draw', winningCells: [] };
  return { result: null, winningCells: [] };
}

async function loadBootstrap() {
  if (!state.token) return null;
  const data = await api('/api/bootstrap');
  state.me = data.account;
  state.bootstrap = data;
  state.game = data.game;
  state.archive = data.archive || [];
  state.analyses = data.analyses || [];
  state.analysisCache.clear();
  if (state.analysis) state.analysisCache.set(state.analysis.analysis.id, state.analysis);
  renderSession();
  renderGame();
  renderArchiveList();
  renderAnalysisList();
  await restoreOpenPanels();
  renderButtons();
  return data;
}

async function restoreOpenPanels() {
  const openAnalysisId = Number(localStorage.getItem('dropline-open-analysis') || '0');
  if (Number.isInteger(openAnalysisId) && openAnalysisId > 0 && state.analyses.some((analysis) => analysis.id === openAnalysisId)) {
    try {
      await openAnalysis(openAnalysisId, { silent: true });
    } catch {
      state.analysis = null;
      localStorage.removeItem('dropline-open-analysis');
    }
  } else if (!state.analysis) {
    state.analysis = null;
  }
  const archiveId = localStorage.getItem('dropline-archive-match');
  if (archiveId && state.archive.some((match) => match.matchId === archiveId)) {
    try {
      await loadArchiveDetail(archiveId, { silent: true });
    } catch {
      state.archiveDetail = null;
      localStorage.removeItem('dropline-archive-match');
    }
  } else if (!state.archiveDetail && state.archive.length) {
    await loadArchiveDetail(state.archive[0].matchId, { silent: true });
  }
  renderAnalysis();
  renderArchive();
}

function renderArchiveList() {
  els.archiveSelect.innerHTML = state.archive.map((match) => `<option value="${escapeHtml(match.matchId)}">${escapeHtml(match.matchId)} · ${escapeHtml(match.result)} · ${match.moveCount} moves</option>`).join('');
  if (state.archiveDetail) els.archiveSelect.value = state.archiveDetail.matchId;
}

async function loadArchiveDetail(matchId, options = {}) {
  if (!matchId) return null;
  localStorage.setItem('dropline-archive-match', matchId);
  const data = await api(`/api/archive/${encodeURIComponent(matchId)}`);
  state.archiveDetail = data;
  if (!options.silent) {
    els.archiveStep.value = String(data.moveCount);
  }
  renderArchive();
  return data;
}

async function openAnalysis(id, options = {}) {
  if (!id) return null;
  localStorage.setItem('dropline-open-analysis', String(id));
  const data = await api(`/api/analysis/${id}`);
  state.analysis = data;
  state.analysisCache.set(id, data);
  if (!options.silent) {
    els.analysisNameInput.value = data.analysis.name;
  }
  renderAnalysis();
  return data;
}

async function ensureAnalysisDetail(id) {
  if (!id) return null;
  if (state.analysisCache.has(id)) return state.analysisCache.get(id);
  const data = await api(`/api/analysis/${id}`);
  state.analysisCache.set(id, data);
  return data;
}

async function refreshAll() {
  await loadBootstrap();
}

async function login(email, password) {
  const data = await api('/api/auth/login', { method: 'POST', body: { email, password }, headers: {} });
  state.token = data.token;
  localStorage.setItem('dropline-token', data.token);
  state.me = data.account;
  state.bootstrap = data;
  state.game = data.game;
  state.archive = data.archive || [];
  state.analyses = data.analyses || [];
  renderSession();
  renderGame();
  renderArchiveList();
  renderAnalysisList();
  await restoreOpenPanels();
  renderButtons();
}

async function signOutEverywhere() {
  if (!state.token) return;
  try {
    await api('/api/auth/logout-all', { method: 'POST', body: {} });
  } finally {
    state.token = '';
    state.me = null;
    state.bootstrap = null;
    state.game = null;
    state.analyses = [];
    state.archive = [];
    state.archiveDetail = null;
    state.analysis = null;
    state.analysisCache.clear();
    localStorage.removeItem('dropline-token');
    localStorage.removeItem('dropline-open-analysis');
    localStorage.removeItem('dropline-archive-match');
    renderSession();
    renderButtons();
    setMessage('Signed out everywhere.', 'warn');
  }
}

async function playCompetitiveMove(column) {
  if (!state.game || isBusy('gameMove')) return;
  setBusy('gameMove', true);
  try {
    const data = await api('/api/game/move', { method: 'POST', body: { opId: makeOpId(), expectedRevision: state.game.revision, column } });
    state.game = data.game;
    await refreshAll();
    setMessage(`Dropped in column ${column}.`, 'good');
  } catch (error) {
    handleError(error, 'game move');
  } finally {
    setBusy('gameMove', false);
    renderGame();
  }
}

async function undoCompetitiveMove() {
  if (!state.game || isBusy('gameUndo')) return;
  setBusy('gameUndo', true);
  try {
    const data = await api('/api/game/undo', { method: 'POST', body: { opId: makeOpId(), expectedRevision: state.game.revision } });
    state.game = data.game;
    await refreshAll();
    setMessage('Undid the last move.', 'good');
  } catch (error) {
    handleError(error, 'game undo');
  } finally {
    setBusy('gameUndo', false);
    renderGame();
  }
}

async function redoCompetitiveMove() {
  if (!state.game || isBusy('gameRedo')) return;
  setBusy('gameRedo', true);
  try {
    const data = await api('/api/game/redo', { method: 'POST', body: { opId: makeOpId(), expectedRevision: state.game.revision } });
    state.game = data.game;
    await refreshAll();
    setMessage('Redid the move.', 'good');
  } catch (error) {
    handleError(error, 'game redo');
  } finally {
    setBusy('gameRedo', false);
    renderGame();
  }
}

async function selectAnalysisNode(nodeId) {
  if (!state.analysis || isBusy('analysisSelect')) return;
  setBusy('analysisSelect', true);
  try {
    const data = await api(`/api/analysis/${state.analysis.analysis.id}/select`, { method: 'POST', body: { opId: makeOpId(), expectedRevision: state.analysis.analysis.revision, nodeId } });
    state.analysis = data;
    state.analysisCache.set(data.analysis.id, data);
    await loadBootstrap();
    setMessage(`Selected node ${nodeId}.`, 'good');
  } catch (error) {
    handleError(error, 'analysis select');
  } finally {
    setBusy('analysisSelect', false);
    renderAnalysis();
  }
}

async function playAnalysisMove(column) {
  if (!state.analysis || isBusy('analysisMove')) return;
  setBusy('analysisMove', true);
  try {
    const data = await api(`/api/analysis/${state.analysis.analysis.id}/move`, { method: 'POST', body: { opId: makeOpId(), expectedRevision: state.analysis.analysis.revision, column } });
    state.analysis = data;
    state.analysisCache.set(data.analysis.id, data);
    await loadBootstrap();
    setMessage(`Practice move in column ${column}.`, 'good');
  } catch (error) {
    handleError(error, 'analysis move');
  } finally {
    setBusy('analysisMove', false);
    renderAnalysis();
  }
}

async function undoAnalysisMove() {
  if (!state.analysis || isBusy('analysisUndo')) return;
  setBusy('analysisUndo', true);
  try {
    const data = await api(`/api/analysis/${state.analysis.analysis.id}/undo`, { method: 'POST', body: { opId: makeOpId(), expectedRevision: state.analysis.analysis.revision } });
    state.analysis = data;
    state.analysisCache.set(data.analysis.id, data);
    await loadBootstrap();
    setMessage('Moved to the parent node.', 'good');
  } catch (error) {
    handleError(error, 'analysis undo');
  } finally {
    setBusy('analysisUndo', false);
    renderAnalysis();
  }
}

async function redoAnalysisMove() {
  if (!state.analysis || isBusy('analysisRedo')) return;
  setBusy('analysisRedo', true);
  try {
    const body = { opId: makeOpId(), expectedRevision: state.analysis.analysis.revision };
    if (!els.analysisRedoChoice.classList.contains('hidden') && els.analysisRedoChoice.value) {
      body.childId = Number(els.analysisRedoChoice.value);
    }
    const data = await api(`/api/analysis/${state.analysis.analysis.id}/redo`, { method: 'POST', body });
    state.analysis = data;
    state.analysisCache.set(data.analysis.id, data);
    await loadBootstrap();
    setMessage('Selected a continuation.', 'good');
  } catch (error) {
    if (error.status === 409 && error.data?.children) {
      els.analysisRedoChoice.classList.remove('hidden');
      els.analysisRedoChoice.innerHTML = error.data.children.map((child) => `<option value="${child.id}">${escapeHtml(nodeLabel(child))}</option>`).join('');
      setMessage('Redo is ambiguous. Choose a continuation.', 'warn');
      return;
    }
    handleError(error, 'analysis redo');
  } finally {
    setBusy('analysisRedo', false);
    renderAnalysis();
  }
}

async function renameAnalysis() {
  if (!state.analysis || isBusy('analysisRename')) return;
  const name = els.analysisNameInput.value.trim();
  setBusy('analysisRename', true);
  try {
    const data = await api(`/api/analysis/${state.analysis.analysis.id}/rename`, { method: 'POST', body: { opId: makeOpId(), expectedRevision: state.analysis.analysis.revision, name } });
    state.analysis = data;
    state.analysisCache.set(data.analysis.id, data);
    await loadBootstrap();
    setMessage('Analysis renamed.', 'good');
  } catch (error) {
    handleError(error, 'analysis rename');
  } finally {
    setBusy('analysisRename', false);
    renderAnalysis();
  }
}

async function createAnalysisFromArchive() {
  if (!state.archiveDetail || isBusy('createAnalysis')) return;
  const name = prompt('Name this analysis', state.archiveDetail.matchId) || '';
  const trimmed = name.trim();
  if (!trimmed) {
    setMessage('Analysis name is required.', 'warn');
    return;
  }
  setBusy('createAnalysis', true);
  try {
    const data = await api('/api/analysis/from-match', {
      method: 'POST',
      body: {
        opId: makeOpId(),
        sourceMatchId: state.archiveDetail.matchId,
        sourceStep: Number(els.archiveStep.value || state.archiveDetail.moveCount),
        name: trimmed,
      },
    });
    state.analysis = data;
    state.analysisCache.set(data.analysis.id, data);
    await loadBootstrap();
    setMessage('Created a practice analysis.', 'good');
  } catch (error) {
    handleError(error, 'analysis create');
  } finally {
    setBusy('createAnalysis', false);
    renderAnalysis();
  }
}

async function compareAnalysisNodes() {
  if (!state.analysis || isBusy('compare')) return;
  setBusy('compare', true);
  try {
    const data = await api('/api/analysis/compare', {
      method: 'POST',
      body: {
        analysisId: state.analysis.analysis.id,
        leftNodeId: Number(els.compareLeft.value),
        rightNodeId: Number(els.compareRight.value),
      },
    });
    state.compareResult = data;
    renderCompareResult(data);
    setMessage('Compared the positions.', 'good');
  } catch (error) {
    handleError(error, 'analysis compare');
  } finally {
    setBusy('compare', false);
  }
}

async function previewBranchCopy() {
  if (!state.analysis || isBusy('branchPreview')) return;
  setBusy('branchPreview', true);
  try {
    const sourceAnalysisId = Number(els.branchSourceAnalysis.value || state.analysis.analysis.id);
    const destinationAnalysisId = Number(els.branchDestinationAnalysis.value || state.analysis.analysis.id);
    const data = await api('/api/analysis/preview-branch', {
      method: 'POST',
      body: {
        opId: makeOpId(),
        sourceAnalysisId,
        sourceNodeId: Number(els.branchSourceNode.value),
        destinationAnalysisId,
        destinationNodeId: Number(els.branchDestinationNode.value),
      },
    });
    state.branchPreview = data;
    renderBranchPreviewResult(data);
    setMessage('Preview prepared.', 'good');
  } catch (error) {
    handleError(error, 'branch preview');
  } finally {
    setBusy('branchPreview', false);
  }
}

async function commitBranchCopy() {
  if (!state.branchPreview || isBusy('branchCommit')) return;
  setBusy('branchCommit', true);
  try {
    const data = await api('/api/analysis/commit-branch', {
      method: 'POST',
      body: { opId: makeOpId(), previewId: state.branchPreview.previewId },
    });
    state.branchPreview = null;
    state.analysis = data;
    state.analysisCache.set(data.analysis.id, data);
    await loadBootstrap();
    setMessage('Branch committed.', 'good');
  } catch (error) {
    handleError(error, 'branch commit');
  } finally {
    setBusy('branchCommit', false);
    renderAnalysis();
  }
}

async function generateReport() {
  if (!state.analysis || isBusy('report')) return;
  setBusy('report', true);
  try {
    const data = await api('/api/analysis/report', {
      method: 'POST',
      body: {
        analysisId: state.analysis.analysis.id,
        nodeId: Number(els.reportNode.value || state.analysis.analysis.selectedNodeId),
        depth: Number(els.reportDepth.value || 2),
      },
    });
    state.reportResult = data;
    renderReportResult(data);
    setMessage('Generated tactical report.', 'good');
  } catch (error) {
    handleError(error, 'analysis report');
  } finally {
    setBusy('report', false);
  }
}

function handleError(error, context) {
  const message = error.data?.error || error.message || `Unable to complete ${context}.`;
  setMessage(message, 'bad');
  if (error.status === 401) {
    state.token = '';
    state.me = null;
    state.game = null;
    state.analysis = null;
    localStorage.removeItem('dropline-token');
    localStorage.removeItem('dropline-open-analysis');
    renderSession();
  }
}

function syncGameButtons() {
  renderButtons();
}

function renderAnalysisControls() {
  if (!state.analysis) return;
  const nodes = state.analysis.nodes || [];
  els.compareLeft.innerHTML = nodes.map((node) => `<option value="${node.id}">${escapeHtml(nodeLabel(node))}</option>`).join('');
  els.compareRight.innerHTML = nodes.map((node) => `<option value="${node.id}">${escapeHtml(nodeLabel(node))}</option>`).join('');
  els.reportNode.innerHTML = nodes.map((node) => `<option value="${node.id}">${escapeHtml(nodeLabel(node))}</option>`).join('');
  els.branchSourceNode.innerHTML = nodes.filter((node) => node.parentId != null).map((node) => `<option value="${node.id}">${escapeHtml(nodeLabel(node))}</option>`).join('') || '<option value="">No source nodes</option>';
  els.branchDestinationNode.innerHTML = nodes.map((node) => `<option value="${node.id}">${escapeHtml(nodeLabel(node))}</option>`).join('');
}

function wireArchiveRange() {
  els.archiveStep.addEventListener('input', () => {
    if (!state.archiveDetail) return;
    renderArchive();
  });
}

async function init() {
  wireArchiveRange();
  els.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await login(els.emailInput.value.trim(), els.passwordInput.value);
      setMessage(`Signed in as ${state.me.name}.`, 'good');
    } catch (error) {
      handleError(error, 'sign in');
    }
  });
  els.signOutBtn.addEventListener('click', signOutEverywhere);
  els.gameUndoBtn.addEventListener('click', undoCompetitiveMove);
  els.gameRedoBtn.addEventListener('click', redoCompetitiveMove);
  els.archiveSelect.addEventListener('change', async () => {
    await loadArchiveDetail(els.archiveSelect.value);
  });
  els.createAnalysisFromReplay.addEventListener('click', createAnalysisFromArchive);
  els.closeAnalysisBtn.addEventListener('click', () => {
    state.analysis = null;
    localStorage.removeItem('dropline-open-analysis');
    renderAnalysis();
    setMessage('Returned to the live game.', 'good');
  });
  els.renameAnalysisBtn.addEventListener('click', renameAnalysis);
  els.analysisUndoBtn.addEventListener('click', undoAnalysisMove);
  els.analysisRedoBtn.addEventListener('click', redoAnalysisMove);
  els.compareBtn.addEventListener('click', compareAnalysisNodes);
  els.branchPreviewBtn.addEventListener('click', previewBranchCopy);
  els.branchCommitBtn.addEventListener('click', commitBranchCopy);
  els.reportBtn.addEventListener('click', generateReport);
  els.branchSourceAnalysis.addEventListener('change', syncBranchNodeSelectors);
  els.branchDestinationAnalysis.addEventListener('change', syncBranchNodeSelectors);
  els.analysisList.addEventListener('input', () => renderButtons());
  if (state.token) {
    try {
      await loadBootstrap();
      setMessage(`Restored session for ${state.me.name}.`, 'good');
    } catch (error) {
      handleError(error, 'restore session');
      state.token = '';
      localStorage.removeItem('dropline-token');
      renderSession();
    }
  } else {
    renderSession();
  }
  renderButtons();
}

window.addEventListener('storage', (event) => {
  if (event.key === 'dropline-token') {
    state.token = event.newValue || '';
    if (!state.token) {
      state.me = null;
      state.game = null;
      state.analysis = null;
      renderSession();
      renderButtons();
    }
  }
  if (event.key === 'dropline-open-analysis' || event.key === 'dropline-archive-match') {
    if (state.token) init();
  }
});

window.addEventListener('keydown', (event) => {
  if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') && event.target?.closest('.board-shell')) {
    const buttons = [...event.target.closest('.board-shell').querySelectorAll('.column-btn:not(:disabled)')];
    if (!buttons.length) return;
    const currentIndex = buttons.indexOf(document.activeElement);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowLeft') nextIndex = Math.max(0, currentIndex - 1);
    if (event.key === 'ArrowRight') nextIndex = Math.min(buttons.length - 1, currentIndex + 1);
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = buttons.length - 1;
    if (nextIndex >= 0 && buttons[nextIndex]) {
      event.preventDefault();
      buttons[nextIndex].focus();
    }
  }
  if ((event.key === 'Enter' || event.key === ' ') && event.target?.tagName === 'BUTTON') {
    event.preventDefault();
    event.target.click();
  }
});

init();
