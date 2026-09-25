const ROWS = 6;
const COLS = 7;
const TOTAL_CELLS = 42;

function createEmptyBoard() {
  return Array(TOTAL_CELLS).fill("");
}

function cellIndex(row, col) {
  // row: 1..6, col: 1..7
  return (row - 1) * COLS + (col - 1);
}

function indexToRow(idx) {
  return Math.floor(idx / COLS) + 1;
}

function indexToCol(idx) {
  return (idx % COLS) + 1;
}

function getLowestEmptyRow(board, col) {
  if (col < 1 || col > COLS) return null;
  for (let r = ROWS; r >= 1; r--) {
    const idx = cellIndex(r, col);
    if (!board[idx]) {
      return r;
    }
  }
  return null;
}

function isColumnFull(board, col) {
  return getLowestEmptyRow(board, col) === null;
}

function getLegalColumns(board) {
  const cols = [];
  for (let c = 1; c <= COLS; c++) {
    if (!isColumnFull(board, c)) {
      cols.push(c);
    }
  }
  return cols;
}

function isBoardFull(board) {
  return board.every(cell => cell === 'Red' || cell === 'Yellow');
}

function checkWin(board, lastRow, lastCol, color) {
  if (!color) return { won: false, winningCells: [] };

  const directions = [
    { dr: 0, dc: 1 },  // Horizontal
    { dr: 1, dc: 0 },  // Vertical
    { dr: 1, dc: 1 },  // Diagonal \
    { dr: -1, dc: 1 }  // Diagonal /
  ];

  for (const { dr, dc } of directions) {
    // Collect consecutive cells in this direction passing through (lastRow, lastCol)
    const line = [{ r: lastRow, c: lastCol, idx: cellIndex(lastRow, lastCol) }];

    // Forward
    let step = 1;
    while (true) {
      const r = lastRow + dr * step;
      const c = lastCol + dc * step;
      if (r < 1 || r > ROWS || c < 1 || c > COLS) break;
      const idx = cellIndex(r, c);
      if (board[idx] === color) {
        line.push({ r, c, idx });
        step++;
      } else {
        break;
      }
    }

    // Backward
    step = 1;
    while (true) {
      const r = lastRow - dr * step;
      const c = lastCol - dc * step;
      if (r < 1 || r > ROWS || c < 1 || c > COLS) break;
      const idx = cellIndex(r, c);
      if (board[idx] === color) {
        line.unshift({ r, c, idx });
        step++;
      } else {
        break;
      }
    }

    if (line.length >= 4) {
      // Find the 4 consecutive cells that include the last played piece
      const lastPieceIndexInLine = line.findIndex(pt => pt.r === lastRow && pt.c === lastCol);
      // Pick 4 contiguous cells containing lastPieceIndexInLine
      let start = Math.max(0, lastPieceIndexInLine - 3);
      let end = Math.min(line.length - 4, lastPieceIndexInLine);
      const chosenStart = Math.min(start, end);
      const winning4 = line.slice(chosenStart, chosenStart + 4).map(pt => pt.idx);
      return { won: true, winningCells: winning4 };
    }
  }

  return { won: false, winningCells: [] };
}

function checkBoardAnyWin(board) {
  // Check horizontal
  for (let r = 1; r <= ROWS; r++) {
    for (let c = 1; c <= COLS - 3; c++) {
      const idx1 = cellIndex(r, c);
      const color = board[idx1];
      if (color && color === board[cellIndex(r, c+1)] && color === board[cellIndex(r, c+2)] && color === board[cellIndex(r, c+3)]) {
        return { won: true, winner: color, winningCells: [idx1, cellIndex(r, c+1), cellIndex(r, c+2), cellIndex(r, c+3)] };
      }
    }
  }

  // Check vertical
  for (let c = 1; c <= COLS; c++) {
    for (let r = 1; r <= ROWS - 3; r++) {
      const idx1 = cellIndex(r, c);
      const color = board[idx1];
      if (color && color === board[cellIndex(r+1, c)] && color === board[cellIndex(r+2, c)] && color === board[cellIndex(r+3, c)]) {
        return { won: true, winner: color, winningCells: [idx1, cellIndex(r+1, c), cellIndex(r+2, c), cellIndex(r+3, c)] };
      }
    }
  }

  // Diagonal Down-Right \
  for (let r = 1; r <= ROWS - 3; r++) {
    for (let c = 1; c <= COLS - 3; c++) {
      const idx1 = cellIndex(r, c);
      const color = board[idx1];
      if (color && color === board[cellIndex(r+1, c+1)] && color === board[cellIndex(r+2, c+2)] && color === board[cellIndex(r+3, c+3)]) {
        return { won: true, winner: color, winningCells: [idx1, cellIndex(r+1, c+1), cellIndex(r+2, c+2), cellIndex(r+3, c+3)] };
      }
    }
  }

  // Diagonal Up-Right /
  for (let r = 4; r <= ROWS; r++) {
    for (let c = 1; c <= COLS - 3; c++) {
      const idx1 = cellIndex(r, c);
      const color = board[idx1];
      if (color && color === board[cellIndex(r-1, c+1)] && color === board[cellIndex(r-2, c+2)] && color === board[cellIndex(r-3, c+3)]) {
        return { won: true, winner: color, winningCells: [idx1, cellIndex(r-1, c+1), cellIndex(r-2, c+2), cellIndex(r-3, c+3)] };
      }
    }
  }

  return { won: false, winner: null, winningCells: [] };
}

function evaluateBoardState(board, lastMove) {
  if (lastMove && lastMove.row && lastMove.column && lastMove.color) {
    const winResult = checkWin(board, lastMove.row, lastMove.column, lastMove.color);
    if (winResult.won) {
      return {
        status: `${lastMove.color} wins`,
        winner: lastMove.color,
        winningCells: winResult.winningCells
      };
    }
  } else {
    const fullWin = checkBoardAnyWin(board);
    if (fullWin.won) {
      return {
        status: `${fullWin.winner} wins`,
        winner: fullWin.winner,
        winningCells: fullWin.winningCells
      };
    }
  }

  if (isBoardFull(board)) {
    return {
      status: 'Draw',
      winner: null,
      winningCells: []
    };
  }

  return {
    status: 'active',
    winner: null,
    winningCells: []
  };
}

function applyMoveToBoard(board, col, color) {
  const row = getLowestEmptyRow(board, col);
  if (row === null) {
    throw new Error(`Column ${col} is full`);
  }
  const idx = cellIndex(row, col);
  const newBoard = [...board];
  newBoard[idx] = color;
  const lastMove = { row, column: col, index: idx, color };
  const evalState = evaluateBoardState(newBoard, lastMove);

  return {
    board: newBoard,
    lastMove,
    status: evalState.status,
    winner: evalState.winner,
    winningCells: evalState.winningCells
  };
}

function deriveStateFromMoves(moves) {
  let board = createEmptyBoard();
  let currentPlayer = 'Red';
  let lastMove = null;

  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    const color = m.color || currentPlayer;
    const col = m.column;
    const res = applyMoveToBoard(board, col, color);
    board = res.board;
    lastMove = res.lastMove;
    currentPlayer = color === 'Red' ? 'Yellow' : 'Red';
  }

  const evalState = evaluateBoardState(board, lastMove);
  return {
    board,
    currentPlayer,
    status: evalState.status,
    winner: evalState.winner,
    winningCells: evalState.winningCells
  };
}

function diffBoards(boardA, boardB) {
  const differences = [];
  for (let i = 0; i < TOTAL_CELLS; i++) {
    const occA = boardA[i] || 'empty';
    const occB = boardB[i] || 'empty';
    if (occA !== occB) {
      differences.push({
        index: i,
        row: indexToRow(i),
        column: indexToCol(i),
        occupantA: occA,
        occupantB: occB
      });
    }
  }
  return differences;
}

function findCommonPrefixLength(movesA, movesB) {
  let count = 0;
  const minLen = Math.min(movesA.length, movesB.length);
  for (let i = 0; i < minLen; i++) {
    if (movesA[i].column === movesB[i].column && movesA[i].color === movesB[i].color) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// Bounded Tactical Search
function computeTacticalReport(rootBoard, rootPlayerToMove, maxDepth, existingStatus, existingWinningCells) {
  // Check if root is already terminal
  const initialEval = evaluateBoardState(rootBoard);
  if (initialEval.status !== 'active') {
    return {
      isTerminal: true,
      rootOutcome: initialEval.status,
      playerToMove: rootPlayerToMove,
      depth: maxDepth,
      columns: [],
      tree: {
        id: 'root',
        columnPath: [],
        lastMove: null,
        board: rootBoard,
        player: rootPlayerToMove,
        perspective: rootPlayerToMove,
        status: initialEval.status,
        winningCells: initialEval.winningCells,
        isTerminal: true,
        isHorizon: false,
        outcome: initialEval.status === 'Draw' ? 'forced_draw' : (initialEval.winner === rootPlayerToMove ? 'forced_win' : 'forced_loss'),
        distance: 0,
        children: []
      }
    };
  }

  // Recursive minimax proof tree builder
  function buildProofNode(board, player, remainingDepth, path, lastMove) {
    const pathKey = path.length === 0 ? 'root' : `col-${path.join('-')}`;
    const evalState = evaluateBoardState(board, lastMove);

    // If terminal
    if (evalState.status !== 'active') {
      const isWin = evalState.winner !== null;
      const isDraw = evalState.status === 'Draw';
      // From player's perspective (the player whose turn it would be):
      // The previous player just won or drew
      const outcome = isDraw ? 'forced_draw' : 'forced_loss';
      return {
        id: pathKey,
        columnPath: path,
        lastMove,
        board,
        player,
        perspective: player,
        status: evalState.status,
        winningCells: evalState.winningCells,
        isTerminal: true,
        isHorizon: false,
        outcome,
        distance: 0,
        children: []
      };
    }

    // If depth 0 reached and nonterminal
    if (remainingDepth === 0) {
      return {
        id: pathKey,
        columnPath: path,
        lastMove,
        board,
        player,
        perspective: player,
        status: 'active',
        winningCells: [],
        isTerminal: false,
        isHorizon: true,
        outcome: 'not_established',
        distance: null,
        children: []
      };
    }

    // Nonterminal with remaining depth > 0: examine legal children in ascending column order
    const legalCols = getLegalColumns(board);
    const opponent = player === 'Red' ? 'Yellow' : 'Red';
    const children = [];

    for (const col of legalCols) {
      const moveRes = applyMoveToBoard(board, col, player);
      const childNode = buildProofNode(
        moveRes.board,
        opponent,
        remainingDepth - 1,
        [...path, col],
        moveRes.lastMove
      );
      children.push({
        col,
        childNode
      });
    }

    // Evaluate current node outcome from `player` perspective based on children
    // Each child was evaluated from `opponent` perspective.
    // Opponent forced_loss -> Player forced_win
    // Opponent forced_win -> Player forced_loss
    // Opponent forced_draw -> Player forced_draw
    // Opponent not_established -> Player not_established

    const childResultsForPlayer = children.map(({ col, childNode }) => {
      let outcomeForPlayer;
      let distForPlayer = null;

      if (childNode.outcome === 'forced_loss') {
        outcomeForPlayer = 'forced_win';
        distForPlayer = (childNode.distance || 0) + 1;
      } else if (childNode.outcome === 'forced_win') {
        outcomeForPlayer = 'forced_loss';
        distForPlayer = (childNode.distance || 0) + 1;
      } else if (childNode.outcome === 'forced_draw') {
        outcomeForPlayer = 'forced_draw';
        distForPlayer = null;
      } else {
        outcomeForPlayer = 'not_established';
        distForPlayer = null;
      }

      return {
        col,
        outcome: outcomeForPlayer,
        distance: distForPlayer,
        childNode
      };
    });

    let overallOutcome = 'not_established';
    let overallDistance = null;

    const winChildren = childResultsForPlayer.filter(c => c.outcome === 'forced_win');
    const lossChildren = childResultsForPlayer.filter(c => c.outcome === 'forced_loss');
    const drawChildren = childResultsForPlayer.filter(c => c.outcome === 'forced_draw');
    const unknownChildren = childResultsForPlayer.filter(c => c.outcome === 'not_established');

    if (winChildren.length > 0) {
      // Shortest winning distance
      overallOutcome = 'forced_win';
      overallDistance = Math.min(...winChildren.map(c => c.distance));
    } else if (lossChildren.length === childResultsForPlayer.length && childResultsForPlayer.length > 0) {
      // All children are proven losses -> longest distance (best resistance)
      overallOutcome = 'forced_loss';
      overallDistance = Math.max(...lossChildren.map(c => c.distance));
    } else if (winChildren.length === 0 && unknownChildren.length === 0 && drawChildren.length > 0) {
      // No winning, no unknown, at least one draw
      overallOutcome = 'forced_draw';
      overallDistance = null;
    } else {
      overallOutcome = 'not_established';
      overallDistance = null;
    }

    return {
      id: pathKey,
      columnPath: path,
      lastMove,
      board,
      player,
      perspective: player,
      status: 'active',
      winningCells: [],
      isTerminal: false,
      isHorizon: false,
      outcome: overallOutcome,
      distance: overallDistance,
      children: children.map(c => c.childNode),
      _columnEvaluations: childResultsForPlayer
    };
  }

  const rootProof = buildProofNode(rootBoard, rootPlayerToMove, maxDepth, [], null);

  const columnSummaries = (rootProof._columnEvaluations || []).map(evalItem => {
    let description;
    if (evalItem.outcome === 'forced_win') {
      description = `Forced win in ${evalItem.distance} ${evalItem.distance === 1 ? 'ply' : 'plies'}`;
    } else if (evalItem.outcome === 'forced_loss') {
      description = `Forced loss in ${evalItem.distance} ${evalItem.distance === 1 ? 'ply' : 'plies'}`;
    } else if (evalItem.outcome === 'forced_draw') {
      description = 'Forced draw';
    } else {
      description = `Not established within search depth (${maxDepth} ${maxDepth === 1 ? 'ply' : 'plies'})`;
    }

    return {
      column: evalItem.col,
      outcome: evalItem.outcome,
      distance: evalItem.distance,
      description
    };
  });

  // Clean up private helper properties before returning
  function cleanNode(n) {
    delete n._columnEvaluations;
    if (n.children) {
      n.children.forEach(cleanNode);
    }
  }
  cleanNode(rootProof);

  return {
    isTerminal: false,
    rootOutcome: null,
    playerToMove: rootPlayerToMove,
    depth: maxDepth,
    columns: columnSummaries,
    tree: rootProof
  };
}

// Branch Preview and Transplant Logic
function previewTransplant(sourceNode, sourceAllNodes, destNode, destAllNodes) {
  // Build lookup maps
  const sourceNodeMap = new Map();
  for (const n of sourceAllNodes) {
    sourceNodeMap.set(n.id, n);
  }

  const sourceChildrenMap = new Map();
  for (const n of sourceAllNodes) {
    if (n.parent_id) {
      if (!sourceChildrenMap.has(n.parent_id)) {
        sourceChildrenMap.set(n.parent_id, []);
      }
      sourceChildrenMap.get(n.parent_id).push(n);
    }
  }

  const destChildrenMap = new Map();
  for (const n of destAllNodes) {
    if (n.parent_id) {
      if (!destChildrenMap.has(n.parent_id)) {
        destChildrenMap.set(n.parent_id, []);
      }
      destChildrenMap.get(n.parent_id).push(n);
    }
  }

  if (!sourceNode.parent_id || sourceNode.incoming_column === null) {
    return {
      valid: false,
      error: {
        path: [],
        reason: 'Cannot transplant from the root position. Choose a branch node.'
      }
    };
  }

  const previewNodes = [];
  let newCount = 0;
  let reusedCount = 0;

  // Recursive DFS traversal
  function simulateNode(currentSrcNode, parentDestBoard, parentDestTurn, parentDestId, relativePath) {
    const col = currentSrcNode.incoming_column;
    const currentPath = [...relativePath, col];

    // Check if parentDestBoard is terminal
    const parentEval = evaluateBoardState(parentDestBoard);
    if (parentEval.status !== 'active') {
      return {
        valid: false,
        error: {
          path: currentPath,
          reason: `Position is terminal (${parentEval.status})`
        }
      };
    }

    // Check if column is full
    if (isColumnFull(parentDestBoard, col)) {
      return {
        valid: false,
        error: {
          path: currentPath,
          reason: `Column ${col} is full`
        }
      };
    }

    // Apply move
    const moveRes = applyMoveToBoard(parentDestBoard, col, parentDestTurn);
    const nextTurn = parentDestTurn === 'Red' ? 'Yellow' : 'Red';

    // Check if parentDestId has existing child with incoming_column === col
    let existingChild = null;
    if (parentDestId && destChildrenMap.has(parentDestId)) {
      existingChild = destChildrenMap.get(parentDestId).find(c => c.incoming_column === col);
    }

    let isReused = false;
    let reusedDestNodeId = null;

    if (existingChild) {
      isReused = true;
      reusedDestNodeId = existingChild.id;
      reusedCount++;
    } else {
      newCount++;
    }

    previewNodes.push({
      sourceNodeId: currentSrcNode.id,
      relativePath: currentPath,
      incomingColumn: col,
      color: parentDestTurn,
      landingRow: moveRes.lastMove.row,
      landingCol: moveRes.lastMove.column,
      landingIndex: moveRes.lastMove.index,
      board: moveRes.board,
      turn: nextTurn,
      status: moveRes.status,
      winningCells: moveRes.winningCells,
      reused: isReused,
      reusedDestNodeId: reusedDestNodeId,
      parentSourceId: currentSrcNode.parent_id
    });

    // Inspect children of currentSrcNode sorted by ascending incoming_column
    const srcChildren = (sourceChildrenMap.get(currentSrcNode.id) || [])
      .slice()
      .sort((a, b) => a.incoming_column - b.incoming_column);

    for (const child of srcChildren) {
      const childRes = simulateNode(
        child,
        moveRes.board,
        nextTurn,
        reusedDestNodeId,
        currentPath
      );
      if (!childRes.valid) {
        return childRes;
      }
    }

    return { valid: true };
  }

  const parseBoard = (b) => (typeof b === 'string' ? JSON.parse(b) : b);
  const destBoard = parseBoard(destNode.board);
  const destTurn = destNode.turn;

  const simResult = simulateNode(sourceNode, destBoard, destTurn, destNode.id, []);
  if (!simResult.valid) {
    return {
      valid: false,
      error: simResult.error
    };
  }

  return {
    valid: true,
    previewNodes,
    newCount,
    reusedCount
  };
}

module.exports = {
  ROWS,
  COLS,
  TOTAL_CELLS,
  createEmptyBoard,
  cellIndex,
  indexToRow,
  indexToCol,
  getLowestEmptyRow,
  isColumnFull,
  getLegalColumns,
  isBoardFull,
  checkWin,
  checkBoardAnyWin,
  evaluateBoardState,
  applyMoveToBoard,
  deriveStateFromMoves,
  diffBoards,
  findCommonPrefixLength,
  computeTacticalReport,
  previewTransplant
};
