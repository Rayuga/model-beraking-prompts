// DropLine Connect Four Game - Comprehensive Version

class DropLineGame {
  constructor() {
    this.token = localStorage.getItem('token');
    this.account = JSON.parse(localStorage.getItem('account') || 'null');
    this.game = null;
    this.analyses = [];
    this.currentAnalysis = null;
    this.pendingOperations = new Set();
    this.replayStep = 0;
    this.replayArchive = null;
    
    this.init();
  }

  async init() {
    this.render();
    
    if (this.token && this.account) {
      await this.loadGameState();
      this.render();
    }
  }

  render() {
    const root = document.getElementById('root');
    
    if (!this.token || !this.account) {
      root.innerHTML = this.renderSignIn();
      this.attachSignInHandlers();
    } else {
      root.innerHTML = this.renderMainScreen();
      this.attachMainScreenHandlers();
    }
  }

  renderSignIn() {
    return `
      <div class="signin-screen">
        <form class="signin-form">
          <h1>DropLine</h1>
          <div id="error-message"></div>
          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" placeholder="avery@dropline.test" required>
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" placeholder="password123" required>
          </div>
          <button type="submit" class="signin-btn">Sign In</button>
          <div style="margin-top: 16px; font-size: 12px; color: #7f8c8d; text-align: center;">
            Demo accounts: avery@dropline.test or jordan@dropline.test<br>
            Password: password123
          </div>
        </form>
      </div>
    `;
  }

  attachSignInHandlers() {
    const form = document.querySelector('.signin-form');
    form.addEventListener('submit', (e) => this.handleSignIn(e));
  }

  async handleSignIn(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error-message');
    
    try {
      const response = await fetch('/api/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      if (!response.ok) {
        errorDiv.innerHTML = '<div class="signin-error">Invalid email or password</div>';
        return;
      }
      
      const data = await response.json();
      this.token = data.token;
      this.account = data.account;
      
      localStorage.setItem('token', this.token);
      localStorage.setItem('account', JSON.stringify(this.account));
      
      await this.loadGameState();
      this.render();
    } catch (err) {
      errorDiv.innerHTML = '<div class="signin-error">Sign in failed</div>';
    }
  }

  async loadGameState() {
    try {
      const response = await fetch('/api/game', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (response.status === 401) {
        this.signOut();
        return;
      }
      
      if (!response.ok) throw new Error('Failed to load game state');
      
      const data = await response.json();
      this.game = data.game;
      
      if (!this.game) {
        this.game = {
          id: null,
          roundId: `game-${Date.now()}`,
          board: Array(42).fill(''),
          currentPlayer: 'Red',
          status: 'active',
          winningCells: [],
          redWins: 0,
          yellowWins: 0,
          draws: 0,
          revision: 0,
          moves: [],
          redoMoves: []
        };
      }
    } catch (err) {
      console.error('Failed to load game state:', err);
    }
  }

  renderMainScreen() {
    return `
      <div class="container main-screen">
        <div class="header">
          <div class="header-account">
            <div class="account-name">${this.account.name}</div>
            <div class="account-email">${this.account.email}</div>
          </div>
          <button class="signout-btn" id="signout-btn">Sign Out</button>
        </div>

        <div class="game-section">
          <h2 class="game-title">DropLine</h2>
          
          <div id="feedback" class="feedback"></div>
          
          <div class="game-status" id="status" role="status" aria-live="polite">
            ${this.getStatusText()}
          </div>

          <div class="board-container">
            <div class="board" role="grid" aria-label="Connect Four Board">
              ${this.renderBoard()}
            </div>
          </div>

          <div class="columns">
            ${Array.from({ length: 7 }, (_, i) => `
              <button class="column-btn" data-column="${i + 1}" aria-label="Drop in column ${i + 1}" id="col-${i + 1}">
                ▼<span class="sr-only">Column ${i + 1}</span>
              </button>
            `).join('')}
          </div>

          <div class="scores">
            <div class="score-box red">
              <div class="score-label">Red</div>
              <div class="score-value">${this.game.redWins}</div>
            </div>
            <div class="score-box">
              <div class="score-label">Draws</div>
              <div class="score-value">${this.game.draws}</div>
            </div>
            <div class="score-box yellow">
              <div class="score-label">Yellow</div>
              <div class="score-value">${this.game.yellowWins}</div>
            </div>
          </div>
        </div>

        <div class="history-section">
          <h3 class="history-title">Move History</h3>
          <div class="history-list" id="history">
            ${this.game.moves.length === 0 ? '<div class="empty-history">No moves yet</div>' : ''}
            ${this.game.moves.map(m => `
              <div class="history-item ${m.color.toLowerCase()}">
                <div class="history-number">#${m.number}</div>
                <div class="history-move">Col ${m.column}</div>
              </div>
            `).join('')}
          </div>
          <div class="history-actions">
            <button class="history-btn" id="undo-btn" ${this.game.moves.length === 0 ? 'disabled' : ''}>
              ↶ Undo
            </button>
            <button class="history-btn" id="redo-btn" ${this.game.redoMoves.length === 0 ? 'disabled' : ''}>
              ↷ Redo
            </button>
          </div>
          <button class="newgame-btn" id="newgame-btn">New Game</button>
        </div>

        <div class="archive-section">
          <div class="archive-header">
            <h3 class="archive-title">Completed Matches</h3>
          </div>
          <div id="archive-container">
            <div class="empty-archive">Loading...</div>
          </div>
        </div>
      </div>
    `;
  }

  renderBoard() {
    return this.game.board.map((cell, index) => {
      const row = Math.floor(index / 7);
      const col = index % 7;
      const rowNum = 6 - row;
      const colNum = col + 1;
      const isWinning = this.game.winningCells.includes(index);
      
      let ariaLabel = `Row ${rowNum}, Column ${colNum}, `;
      if (cell === '') {
        ariaLabel += 'empty';
      } else {
        ariaLabel += cell;
        if (isWinning) {
          ariaLabel += ', winning';
        }
      }
      
      return `
        <div class="cell ${cell.toLowerCase()} ${isWinning ? 'winning' : ''}" 
             role="gridcell" aria-label="${ariaLabel}">
          ${cell === 'Red' ? '●' : cell === 'Yellow' ? '●' : ''}
        </div>
      `;
    }).join('');
  }

  getStatusText() {
    if (this.game.status === 'terminal') {
      if (this.game.winningCells.length > 0) {
        if (this.game.redWins > this.game.yellowWins) {
          return `<span class="status-terminal">Red wins!</span>`;
        } else {
          return `<span class="status-terminal">Yellow wins!</span>`;
        }
      } else {
        return `<span class="status-terminal">Draw!</span>`;
      }
    }
    
    if (this.game.currentPlayer === 'Red') {
      return `<span class="status-red">Red's turn</span>`;
    } else {
      return `<span class="status-yellow">Yellow's turn</span>`;
    }
  }

  attachMainScreenHandlers() {
    // Sign out
    document.getElementById('signout-btn').addEventListener('click', () => this.signOut());

    // Column buttons
    document.querySelectorAll('.column-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const col = parseInt(e.target.closest('.column-btn').dataset.column);
        this.makeMove(col);
      });
      
      btn.addEventListener('keydown', (e) => {
        const col = parseInt(btn.dataset.column);
        if (e.key === 'ArrowLeft' && col > 1) {
          e.preventDefault();
          document.getElementById(`col-${col - 1}`).focus();
        } else if (e.key === 'ArrowRight' && col < 7) {
          e.preventDefault();
          document.getElementById(`col-${col + 1}`).focus();
        } else if (e.key === 'Home') {
          e.preventDefault();
          document.getElementById('col-1').focus();
        } else if (e.key === 'End') {
          e.preventDefault();
          document.getElementById('col-7').focus();
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.makeMove(col);
        }
      });
    });

    // Undo/Redo
    document.getElementById('undo-btn').addEventListener('click', () => this.undo());
    document.getElementById('redo-btn').addEventListener('click', () => this.redo());

    // New Game
    document.getElementById('newgame-btn').addEventListener('click', () => this.newGame());

    // Load archives
    this.loadArchives();
  }

  async makeMove(column) {
    if (this.game.status !== 'active') {
      this.showFeedback('Game is not active', 'error');
      return;
    }

    if (this.pendingOperations.has(`move-${column}`)) {
      return;
    }

    this.pendingOperations.add(`move-${column}`);
    
    try {
      const operationId = `op-${Date.now()}-${Math.random()}`;
      const response = await fetch('/api/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          column,
          operationId,
          expectedRevision: this.game.revision
        })
      });

      const data = await response.json();

      if (response.status === 401) {
        this.signOut();
        return;
      }

      if (response.status === 409) {
        this.showFeedback('Game updated in another tab', 'info');
        this.game = data.game;
        this.render();
        return;
      }

      if (!response.ok) {
        this.showFeedback(data.error || 'Move failed', 'error');
        return;
      }

      this.game = data.game;
      this.render();
    } catch (err) {
      this.showFeedback('Network error', 'error');
      console.error(err);
    } finally {
      this.pendingOperations.delete(`move-${column}`);
    }
  }

  async undo() {
    if (this.game.moves.length === 0) {
      this.showFeedback('No moves to undo', 'error');
      return;
    }

    try {
      const operationId = `op-${Date.now()}-${Math.random()}`;
      const response = await fetch('/api/undo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          operationId,
          expectedRevision: this.game.revision
        })
      });

      const data = await response.json();

      if (response.status === 401) {
        this.signOut();
        return;
      }

      if (response.status === 409) {
        this.showFeedback('Game updated in another tab', 'info');
        this.game = data.game;
        this.render();
        return;
      }

      if (!response.ok) {
        this.showFeedback(data.error || 'Undo failed', 'error');
        return;
      }

      this.game = data.game;
      this.render();
    } catch (err) {
      this.showFeedback('Network error', 'error');
      console.error(err);
    }
  }

  async redo() {
    if (this.game.redoMoves.length === 0) {
      this.showFeedback('No moves to redo', 'error');
      return;
    }

    try {
      const operationId = `op-${Date.now()}-${Math.random()}`;
      const response = await fetch('/api/redo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          operationId,
          expectedRevision: this.game.revision
        })
      });

      const data = await response.json();

      if (response.status === 401) {
        this.signOut();
        return;
      }

      if (response.status === 409) {
        this.showFeedback('Game updated in another tab', 'info');
        this.game = data.game;
        this.render();
        return;
      }

      if (!response.ok) {
        this.showFeedback(data.error || 'Redo failed', 'error');
        return;
      }

      this.game = data.game;
      this.render();
    } catch (err) {
      this.showFeedback('Network error', 'error');
      console.error(err);
    }
  }

  async newGame() {
    if (!confirm('Start a new game?')) {
      return;
    }

    try {
      const operationId = `op-${Date.now()}-${Math.random()}`;
      const response = await fetch('/api/newgame', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          operationId,
          expectedRevision: this.game.revision
        })
      });

      const data = await response.json();

      if (response.status === 401) {
        this.signOut();
        return;
      }

      if (response.status === 409) {
        this.showFeedback('Game updated in another tab', 'info');
        this.game = data.game;
        this.render();
        return;
      }

      if (!response.ok) {
        this.showFeedback(data.error || 'New game failed', 'error');
        return;
      }

      this.game = data.game;
      this.render();
    } catch (err) {
      this.showFeedback('Network error', 'error');
      console.error(err);
    }
  }

  async loadArchives() {
    try {
      const response = await fetch('/api/archives', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (!response.ok) throw new Error('Failed to load archives');
      
      const data = await response.json();
      const container = document.getElementById('archive-container');
      
      if (!data.archives || data.archives.length === 0) {
        container.innerHTML = '<div class="empty-archive">No completed matches yet</div>';
        return;
      }
      
      container.innerHTML = `
        <div class="archive-list">
          ${data.archives.map(a => `
            <div class="archive-item">
              <div class="archive-info">
                <div class="archive-result">${a.result}</div>
                <div class="archive-date">${new Date(a.completedAt).toLocaleDateString()}</div>
                <div class="archive-moves">${a.moveCount} moves</div>
              </div>
              <button class="archive-btn" data-archive-id="${a.id}">Replay</button>
            </div>
          `).join('')}
        </div>
      `;
      
      // Attach replay handlers
      container.querySelectorAll('.archive-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.showReplay(parseInt(btn.dataset.archiveId));
        });
      });
    } catch (err) {
      console.error('Failed to load archives:', err);
    }
  }

  async showReplay(archiveId) {
    try {
      const response = await fetch(`/api/archive/${archiveId}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (!response.ok) throw new Error('Failed to load archive');
      
      const data = await response.json();
      const archive = data.archive;
      
      this.replayStep = 0;
      this.replayArchive = archive;
      this.showReplayModal();
    } catch (err) {
      console.error('Failed to load archive:', err);
      this.showFeedback('Failed to load replay', 'error');
    }
  }

  showReplayModal() {
    const root = document.getElementById('root');
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Replay: ${this.replayArchive.result}</h2>
          <button class="modal-close" aria-label="Close replay">×</button>
        </div>
        
        <div class="board-container">
          <div class="replay-board" id="replay-board">
            ${this.renderReplayBoard()}
          </div>
        </div>
        
        <div class="replay-controls">
          <div>
            <input type="range" id="replay-range" min="0" max="${this.replayArchive.moveCount}" value="0">
            <div class="replay-label">Step <span id="replay-step">0</span> of ${this.replayArchive.moveCount}</div>
          </div>
        </div>
        
        <div class="replay-step-btns">
          <button class="replay-btn" id="replay-prev">← Previous</button>
          <button class="replay-btn" id="replay-next">Next →</button>
        </div>
        
        <button class="replay-close-btn">Close</button>
      </div>
    `;
    
    root.appendChild(modal);
    
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.replay-close-btn').addEventListener('click', () => modal.remove());
    
    const range = modal.querySelector('#replay-range');
    range.addEventListener('input', (e) => {
      this.replayStep = parseInt(e.target.value);
      this.updateReplayBoard(modal);
    });
    
    modal.querySelector('#replay-prev').addEventListener('click', () => {
      if (this.replayStep > 0) {
        this.replayStep--;
        range.value = this.replayStep;
        this.updateReplayBoard(modal);
      }
    });
    
    modal.querySelector('#replay-next').addEventListener('click', () => {
      if (this.replayStep < this.replayArchive.moveCount) {
        this.replayStep++;
        range.value = this.replayStep;
        this.updateReplayBoard(modal);
      }
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  renderReplayBoard() {
    const board = Array(42).fill('');
    const finalBoard = this.replayArchive.board;
    
    for (let i = 0; i < Math.min(this.replayStep, finalBoard.length); i++) {
      board[i] = finalBoard[i];
    }
    
    return board.map((cell) => {
      return `
        <div class="replay-cell ${cell.toLowerCase()}">
          ${cell === 'Red' ? '●' : cell === 'Yellow' ? '●' : ''}
        </div>
      `;
    }).join('');
  }

  updateReplayBoard(modal) {
    const boardState = Array(42).fill('');
    const finalBoard = this.replayArchive.board;
    
    for (let i = 0; i < this.replayStep && i < finalBoard.length; i++) {
      boardState[i] = finalBoard[i];
    }
    
    const replayBoard = modal.querySelector('#replay-board');
    replayBoard.innerHTML = boardState.map((cell) => {
      return `
        <div class="replay-cell ${cell.toLowerCase()}">
          ${cell === 'Red' ? '●' : cell === 'Yellow' ? '●' : ''}
        </div>
      `;
    }).join('');
    
    modal.querySelector('#replay-step').textContent = this.replayStep;
  }

  showFeedback(message, type) {
    const feedback = document.getElementById('feedback');
    if (!feedback) return;
    
    feedback.textContent = message;
    feedback.className = `feedback show ${type}`;
    
    setTimeout(() => {
      feedback.classList.remove('show');
    }, 3000);
  }

  signOut() {
    fetch('/api/signout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}` }
    }).catch(() => {});
    
    localStorage.removeItem('token');
    localStorage.removeItem('account');
    
    this.token = null;
    this.account = null;
    this.game = null;
    this.currentAnalysis = null;
    
    this.render();
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new DropLineGame();
});
