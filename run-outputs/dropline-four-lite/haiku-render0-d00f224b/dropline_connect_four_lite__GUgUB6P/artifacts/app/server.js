const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const dbPath = '/app/dropline.db';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database
function initializeDatabase() {
  const db = new Database(dbPath);
  
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tokens (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL REFERENCES accounts(email),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE REFERENCES accounts(email),
      state TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS moves (
      id INTEGER PRIMARY KEY,
      game_id INTEGER NOT NULL REFERENCES games(id),
      move_number INTEGER NOT NULL,
      color TEXT NOT NULL,
      column INTEGER NOT NULL,
      landing_row INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed accounts from workbook
  const XLSX = require('xlsx');
  const workbookPath = '/assets/artifacts/dropline_seed.xlsx';
  
  if (fs.existsSync(workbookPath)) {
    try {
      const workbook = XLSX.readFile(workbookPath);
      const accountsSheet = workbook.Sheets['Accounts'];
      const accounts = XLSX.utils.sheet_to_json(accountsSheet);
      
      // Insert seed accounts
      accounts.forEach(row => {
        const email = row.Email;
        const password = row.Password;
        const name = row.Name;
        
        try {
          db.prepare('INSERT INTO accounts (email, name, password) VALUES (?, ?, ?)')
            .run(email, name, password);
        } catch (e) {
          // Account already exists
        }
      });

      // Initialize games for seed accounts
      accounts.forEach(row => {
        const email = row.Email;
        const gameState = {
          board: Array(6).fill(null).map(() => Array(7).fill(null)),
          current_player: 'Red',
          status: 'active',
          winning_cells: null,
          red_wins: 0,
          yellow_wins: 0,
          draws: 0,
          applied_moves: [],
          redo_stack: []
        };
        
        try {
          db.prepare('INSERT INTO games (email, state) VALUES (?, ?)')
            .run(email, JSON.stringify(gameState));
        } catch (e) {
          // Game already exists
        }
      });
    } catch (e) {
      console.error('Error seeding database:', e);
    }
  }

  return db;
}

const db = initializeDatabase();

function getTokenEmail(token) {
  const row = db.prepare('SELECT email FROM tokens WHERE token = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)').get(token);
  return row ? row.email : null;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve index.html for all routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Authentication endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const account = db.prepare('SELECT * FROM accounts WHERE email = ?').get(email);
  
  if (!account || account.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken();
  db.prepare('INSERT INTO tokens (token, email) VALUES (?, ?)').run(token, email);

  res.json({ 
    token,
    name: account.name,
    email: account.email
  });
});

app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  db.prepare('DELETE FROM tokens WHERE token = ?').run(token);
  res.json({ success: true });
});

// Game endpoints
app.get('/api/game', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  const email = getTokenEmail(token);
  
  if (!email) {
    return res.status(401).json({ error: 'Token invalid or expired' });
  }

  const game = db.prepare('SELECT state FROM games WHERE email = ?').get(email);
  
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const gameState = JSON.parse(game.state);
  const moves = db.prepare('SELECT * FROM moves WHERE game_id = (SELECT id FROM games WHERE email = ?) ORDER BY move_number').all(email);

  res.json({
    state: gameState,
    moves: moves
  });
});

app.post('/api/game/move', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  const email = getTokenEmail(token);
  
  if (!email) {
    return res.status(401).json({ error: 'Token invalid or expired' });
  }

  const { column } = req.body;
  
  if (typeof column !== 'number' || column < 1 || column > 7) {
    return res.status(400).json({ error: 'Invalid column' });
  }

  const gameRow = db.prepare('SELECT id, state FROM games WHERE email = ?').get(email);
  
  if (!gameRow) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const gameState = JSON.parse(gameRow.state);
  const gameId = gameRow.id;

  // Check if game is finished
  if (gameState.status !== 'active') {
    return res.status(400).json({ error: 'Game is finished' });
  }

  // Check if column is full
  const colIndex = column - 1;
  let landingRow = -1;
  for (let row = 5; row >= 0; row--) {
    if (gameState.board[row][colIndex] === null) {
      landingRow = row;
      break;
    }
  }

  if (landingRow === -1) {
    return res.status(400).json({ error: `Column ${column} is full` });
  }

  // Clear redo stack on new move
  gameState.redo_stack = [];

  // Save the color of the player making this move
  const moveColor = gameState.current_player;
  
  // Apply the move
  gameState.board[landingRow][colIndex] = moveColor;
  
  // Add to applied moves
  const moveNumber = gameState.applied_moves.length + 1;
  gameState.applied_moves.push(moveNumber);

  // Check for winner
  const winner = checkWinner(gameState.board, landingRow, colIndex);
  
  if (winner) {
    gameState.status = winner === 'Red' ? 'red_won' : 'yellow_won';
    gameState.winning_cells = findWinningCells(gameState.board, landingRow, colIndex, winner);
    if (winner === 'Red') {
      gameState.red_wins++;
    } else {
      gameState.yellow_wins++;
    }
  } else if (gameState.applied_moves.length === 42) {
    gameState.status = 'draw';
    gameState.draws++;
  } else {
    // Switch player
    gameState.current_player = gameState.current_player === 'Red' ? 'Yellow' : 'Red';
  }

  // Persist move with the correct color
  db.prepare('INSERT INTO moves (game_id, move_number, color, column, landing_row) VALUES (?, ?, ?, ?, ?)')
    .run(gameId, moveNumber, moveColor, column, landingRow + 1);

  // Persist game state
  db.prepare('UPDATE games SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(JSON.stringify(gameState), gameId);

  res.json({
    state: gameState,
    moves: db.prepare('SELECT * FROM moves WHERE game_id = ? ORDER BY move_number').all(gameId)
  });
});

app.post('/api/game/undo', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  const email = getTokenEmail(token);
  
  if (!email) {
    return res.status(401).json({ error: 'Token invalid or expired' });
  }

  const gameRow = db.prepare('SELECT id, state FROM games WHERE email = ?').get(email);
  
  if (!gameRow) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const gameState = JSON.parse(gameRow.state);
  const gameId = gameRow.id;

  if (gameState.applied_moves.length === 0) {
    return res.status(400).json({ error: 'No moves to undo' });
  }

  // Save old status to detect changes
  const oldStatus = gameState.status;

  // Remove last applied move
  const movedMoveNumber = gameState.applied_moves.pop();
  gameState.redo_stack.unshift(movedMoveNumber);

  // Reconstruct board from remaining applied moves
  gameState.board = Array(6).fill(null).map(() => Array(7).fill(null));
  gameState.status = 'active';
  gameState.winning_cells = null;
  
  const allMoves = db.prepare('SELECT * FROM moves WHERE game_id = ? ORDER BY move_number').all(gameId);
  
  for (const moveNum of gameState.applied_moves) {
    const move = allMoves.find(m => m.move_number === moveNum);
    const row = move.landing_row - 1;
    const col = move.column - 1;
    gameState.board[row][col] = move.color;
  }

  // Set current player based on applied moves count
  gameState.current_player = gameState.applied_moves.length % 2 === 0 ? 'Red' : 'Yellow';

  // Check if reconstructed board has a winner
  if (gameState.applied_moves.length > 0) {
    const lastMove = allMoves.find(m => m.move_number === gameState.applied_moves[gameState.applied_moves.length - 1]);
    const row = lastMove.landing_row - 1;
    const col = lastMove.column - 1;
    const winner = checkWinner(gameState.board, row, col);
    
    if (winner) {
      gameState.status = winner === 'Red' ? 'red_won' : 'yellow_won';
      gameState.winning_cells = findWinningCells(gameState.board, row, col, winner);
    } else if (gameState.applied_moves.length === 42) {
      gameState.status = 'draw';
    }
  }

  // Adjust counters if status changed from winning/draw to active
  if (oldStatus === 'red_won' && gameState.status !== 'red_won') {
    gameState.red_wins--;
  } else if (oldStatus === 'yellow_won' && gameState.status !== 'yellow_won') {
    gameState.yellow_wins--;
  } else if (oldStatus === 'draw' && gameState.status !== 'draw') {
    gameState.draws--;
  }

  // Persist game state
  db.prepare('UPDATE games SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(JSON.stringify(gameState), gameId);

  res.json({
    state: gameState,
    moves: allMoves
  });
});

app.post('/api/game/redo', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  const email = getTokenEmail(token);
  
  if (!email) {
    return res.status(401).json({ error: 'Token invalid or expired' });
  }

  const gameRow = db.prepare('SELECT id, state FROM games WHERE email = ?').get(email);
  
  if (!gameRow) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const gameState = JSON.parse(gameRow.state);
  const gameId = gameRow.id;

  if (gameState.redo_stack.length === 0) {
    return res.status(400).json({ error: 'No moves to redo' });
  }

  // Save old status to detect changes
  const oldStatus = gameState.status;

  // Get the move to redo
  const moveNumberToRedo = gameState.redo_stack.shift();
  gameState.applied_moves.push(moveNumberToRedo);

  // Reconstruct board from applied moves
  gameState.board = Array(6).fill(null).map(() => Array(7).fill(null));
  gameState.status = 'active';
  gameState.winning_cells = null;
  
  const allMoves = db.prepare('SELECT * FROM moves WHERE game_id = ? ORDER BY move_number').all(gameId);
  
  for (const moveNum of gameState.applied_moves) {
    const move = allMoves.find(m => m.move_number === moveNum);
    const row = move.landing_row - 1;
    const col = move.column - 1;
    gameState.board[row][col] = move.color;
  }

  // Set current player based on applied moves count
  gameState.current_player = gameState.applied_moves.length % 2 === 0 ? 'Red' : 'Yellow';

  // Check if reconstructed board has a winner
  if (gameState.applied_moves.length > 0) {
    const lastMove = allMoves.find(m => m.move_number === gameState.applied_moves[gameState.applied_moves.length - 1]);
    const row = lastMove.landing_row - 1;
    const col = lastMove.column - 1;
    const winner = checkWinner(gameState.board, row, col);
    
    if (winner) {
      gameState.status = winner === 'Red' ? 'red_won' : 'yellow_won';
      gameState.winning_cells = findWinningCells(gameState.board, row, col, winner);
    } else if (gameState.applied_moves.length === 42) {
      gameState.status = 'draw';
    }
  }

  // Adjust counters if status changed to winning/draw from active
  if (oldStatus !== 'red_won' && gameState.status === 'red_won') {
    gameState.red_wins++;
  } else if (oldStatus !== 'yellow_won' && gameState.status === 'yellow_won') {
    gameState.yellow_wins++;
  } else if (oldStatus !== 'draw' && gameState.status === 'draw') {
    gameState.draws++;
  }

  // Persist game state
  db.prepare('UPDATE games SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(JSON.stringify(gameState), gameId);

  res.json({
    state: gameState,
    moves: allMoves
  });
});

app.post('/api/game/new', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  const email = getTokenEmail(token);
  
  if (!email) {
    return res.status(401).json({ error: 'Token invalid or expired' });
  }

  const gameRow = db.prepare('SELECT id, state FROM games WHERE email = ?').get(email);
  
  if (!gameRow) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const oldGameState = JSON.parse(gameRow.state);
  const gameId = gameRow.id;

  // Delete all moves for this game
  db.prepare('DELETE FROM moves WHERE game_id = ?').run(gameId);

  // Create new game state, preserving scores
  const gameState = {
    board: Array(6).fill(null).map(() => Array(7).fill(null)),
    current_player: 'Red',
    status: 'active',
    winning_cells: null,
    red_wins: oldGameState.red_wins,
    yellow_wins: oldGameState.yellow_wins,
    draws: oldGameState.draws,
    applied_moves: [],
    redo_stack: []
  };

  // Persist game state
  db.prepare('UPDATE games SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(JSON.stringify(gameState), gameId);

  res.json({
    state: gameState,
    moves: []
  });
});

function checkWinner(board, row, col) {
  const color = board[row][col];
  if (!color) return null;

  // Check horizontal
  let count = 1;
  let c = col - 1;
  while (c >= 0 && board[row][c] === color) {
    count++;
    c--;
  }
  c = col + 1;
  while (c < 7 && board[row][c] === color) {
    count++;
    c++;
  }
  if (count >= 4) return color;

  // Check vertical
  count = 1;
  let r = row - 1;
  while (r >= 0 && board[r][col] === color) {
    count++;
    r--;
  }
  r = row + 1;
  while (r < 6 && board[r][col] === color) {
    count++;
    r++;
  }
  if (count >= 4) return color;

  // Check diagonal (top-left to bottom-right)
  count = 1;
  r = row - 1;
  c = col - 1;
  while (r >= 0 && c >= 0 && board[r][c] === color) {
    count++;
    r--;
    c--;
  }
  r = row + 1;
  c = col + 1;
  while (r < 6 && c < 7 && board[r][c] === color) {
    count++;
    r++;
    c++;
  }
  if (count >= 4) return color;

  // Check diagonal (top-right to bottom-left)
  count = 1;
  r = row - 1;
  c = col + 1;
  while (r >= 0 && c < 7 && board[r][c] === color) {
    count++;
    r--;
    c++;
  }
  r = row + 1;
  c = col - 1;
  while (r < 6 && c >= 0 && board[r][c] === color) {
    count++;
    r++;
    c--;
  }
  if (count >= 4) return color;

  return null;
}

function findWinningCells(board, row, col, color) {
  const cells = [];

  // Horizontal
  let count = 1;
  let cells_h = [[row, col]];
  let c = col - 1;
  while (c >= 0 && board[row][c] === color) {
    cells_h.push([row, c]);
    count++;
    c--;
  }
  c = col + 1;
  while (c < 7 && board[row][c] === color) {
    cells_h.push([row, c]);
    count++;
    c++;
  }
  if (count >= 4) return cells_h;

  // Vertical
  count = 1;
  let cells_v = [[row, col]];
  let r = row - 1;
  while (r >= 0 && board[r][col] === color) {
    cells_v.push([r, col]);
    count++;
    r--;
  }
  r = row + 1;
  while (r < 6 && board[r][col] === color) {
    cells_v.push([r, col]);
    count++;
    r++;
  }
  if (count >= 4) return cells_v;

  // Diagonal (top-left to bottom-right)
  count = 1;
  let cells_d1 = [[row, col]];
  r = row - 1;
  c = col - 1;
  while (r >= 0 && c >= 0 && board[r][c] === color) {
    cells_d1.push([r, c]);
    count++;
    r--;
    c--;
  }
  r = row + 1;
  c = col + 1;
  while (r < 6 && c < 7 && board[r][c] === color) {
    cells_d1.push([r, c]);
    count++;
    r++;
    c++;
  }
  if (count >= 4) return cells_d1;

  // Diagonal (top-right to bottom-left)
  count = 1;
  let cells_d2 = [[row, col]];
  r = row - 1;
  c = col + 1;
  while (r >= 0 && c < 7 && board[r][c] === color) {
    cells_d2.push([r, c]);
    count++;
    r--;
    c++;
  }
  r = row + 1;
  c = col - 1;
  while (r < 6 && c >= 0 && board[r][c] === color) {
    cells_d2.push([r, c]);
    count++;
    r++;
    c--;
  }
  if (count >= 4) return cells_d2;

  return [];
}



const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`DropLine server listening on port ${PORT}`);
});
