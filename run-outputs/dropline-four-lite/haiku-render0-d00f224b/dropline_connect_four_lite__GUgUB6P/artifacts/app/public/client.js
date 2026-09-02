class DropLineGame {
  constructor() {
    this.token = null;
    this.currentAccount = null;
    this.gameState = null;
    this.moves = [];
    this.focusedColumn = 1;
    this.init();
  }

  init() {
    this.loadFromSession();
    this.setupEventListeners();
    this.updateView();
  }

  loadFromSession() {
    const stored = sessionStorage.getItem('dropline-token');
    if (stored) {
      this.token = stored;
      const account = sessionStorage.getItem('dropline-account');
      if (account) {
        this.currentAccount = JSON.parse(account);
      }
    }
  }

  saveToSession() {
    if (this.token) {
      sessionStorage.setItem('dropline-token', this.token);
      sessionStorage.setItem('dropline-account', JSON.stringify(this.currentAccount));
    }
  }

  setupEventListeners() {
    // Sign-in form
    const signinForm = document.getElementById('signin-form');
    signinForm.addEventListener('submit', (e) => this.handleSignIn(e));

    // Game buttons
    document.getElementById('signout-btn').addEventListener('click', () => this.handleSignOut());
    document.getElementById('new-game-btn').addEventListener('click', () => this.handleNewGame());
    document.getElementById('undo-btn').addEventListener('click', () => this.handleUndo());
    document.getElementById('redo-btn').addEventListener('click', () => this.handleRedo());

    // Drop column buttons
    document.querySelectorAll('.drop-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const column = parseInt(e.target.dataset.column);
        this.handleMove(column);
      });

      btn.addEventListener('keydown', (e) => this.handleKeyboardNavigation(e));
    });
  }

  handleKeyboardNavigation(e) {
    const column = parseInt(e.target.dataset.column);
    
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (column > 1) {
        const nextBtn = document.querySelector(`[data-column="${column - 1}"]`);
        nextBtn.focus();
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (column < 7) {
        const nextBtn = document.querySelector(`[data-column="${column + 1}"]`);
        nextBtn.focus();
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      document.querySelector('[data-column="1"]').focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      document.querySelector('[data-column="7"]').focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.handleMove(column);
    }
  }

  async handleSignIn(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('signin-error');
    
    errorDiv.textContent = '';
    errorDiv.classList.remove('show');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const data = await response.json();
        errorDiv.textContent = data.error || 'Sign-in failed. Please try again.';
        errorDiv.classList.add('show');
        return;
      }

      const data = await response.json();
      this.token = data.token;
      this.currentAccount = {
        email: data.email,
        name: data.name
      };
      this.saveToSession();
      await this.loadGameState();
      this.updateView();
      
      document.getElementById('email').value = '';
      document.getElementById('password').value = '';
    } catch (err) {
      errorDiv.textContent = 'Connection error. Please try again.';
      errorDiv.classList.add('show');
    }
  }

  async handleSignOut() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
    } catch (err) {
      // Ignore errors on logout
    }
    
    this.token = null;
    this.currentAccount = null;
    this.gameState = null;
    this.moves = [];
    sessionStorage.removeItem('dropline-token');
    sessionStorage.removeItem('dropline-account');
    this.updateView();
  }

  async loadGameState() {
    if (!this.token) return;

    try {
      const response = await fetch('/api/game', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      if (response.ok) {
        const data = await response.json();
        this.gameState = data.state;
        this.moves = data.moves || [];
      }
    } catch (err) {
      console.error('Failed to load game state:', err);
    }
  }

  async handleMove(column) {
    if (!this.token || !this.gameState || this.gameState.status !== 'active') {
      return;
    }

    try {
      const response = await fetch('/api/game/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ column })
      });

      const data = await response.json();
      
      if (!response.ok) {
        this.showStatus(data.error, true);
        return;
      }

      this.gameState = data.state;
      this.moves = data.moves || [];
      this.updateView();
    } catch (err) {
      console.error('Move failed:', err);
    }
  }

  async handleUndo() {
    if (!this.token || !this.gameState || this.gameState.applied_moves.length === 0) {
      return;
    }

    try {
      const response = await fetch('/api/game/undo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      this.gameState = data.state;
      this.moves = data.moves || [];
      this.updateView();
    } catch (err) {
      console.error('Undo failed:', err);
    }
  }

  async handleRedo() {
    if (!this.token || !this.gameState || this.gameState.redo_stack.length === 0) {
      return;
    }

    try {
      const response = await fetch('/api/game/redo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      this.gameState = data.state;
      this.moves = data.moves || [];
      this.updateView();
    } catch (err) {
      console.error('Redo failed:', err);
    }
  }

  async handleNewGame() {
    if (!this.token || !this.gameState) {
      return;
    }

    try {
      const response = await fetch('/api/game/new', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      this.gameState = data.state;
      this.moves = [];
      this.updateView();
    } catch (err) {
      console.error('New game failed:', err);
    }
  }

  updateView() {
    if (!this.token) {
      this.showSignInView();
    } else {
      this.showGameView();
    }
  }

  showSignInView() {
    document.getElementById('signin-view').classList.add('active');
    document.getElementById('game-view').classList.remove('active');
  }

  showGameView() {
    document.getElementById('signin-view').classList.remove('active');
    document.getElementById('game-view').classList.add('active');

    if (this.currentAccount) {
      document.getElementById('account-name').textContent = 
        `${this.currentAccount.name} (${this.currentAccount.email})`;
    }

    if (this.gameState) {
      this.renderBoard();
      this.renderScores();
      this.renderMoveHistory();
      this.updateStatus();
      this.updateControls();
    }
  }

  renderBoard() {
    const boardDiv = document.querySelector('.board');
    boardDiv.innerHTML = '';

    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        const cell = document.createElement('div');
        cell.className = 'board-cell';
        cell.setAttribute('role', 'gridcell');
        
        const color = this.gameState.board[row][col];
        if (color) {
          cell.setAttribute('data-color', color);
        }

        const isWinning = this.gameState.winning_cells && 
          this.gameState.winning_cells.some(([r, c]) => r === row && c === col);
        
        if (isWinning) {
          cell.classList.add('winning');
        }

        // Accessible name: "Row N Column N Color State [Winning]"
        let accessibleName = `Row ${row + 1} Column ${col + 1} `;
        if (color) {
          accessibleName += color;
        } else {
          accessibleName += 'empty';
        }
        if (isWinning) {
          accessibleName += ' winning';
        }

        cell.setAttribute('aria-label', accessibleName);
        boardDiv.appendChild(cell);
      }
    }
  }

  renderScores() {
    document.getElementById('red-wins').textContent = this.gameState.red_wins;
    document.getElementById('yellow-wins').textContent = this.gameState.yellow_wins;
    document.getElementById('draws').textContent = this.gameState.draws;
  }

  renderMoveHistory() {
    const moveList = document.getElementById('move-list');
    moveList.innerHTML = '';

    const appliedMoveSet = new Set(this.gameState.applied_moves);

    for (const move of this.moves) {
      const isApplied = appliedMoveSet.has(move.move_number);
      const li = document.createElement('li');
      
      const moveClass = move.color === 'Red' ? 'red-move' : 'yellow-move';
      li.className = moveClass;
      
      if (!isApplied) {
        li.classList.add('undone');
      }

      li.textContent = `Move ${move.move_number}: ${move.color} → column ${move.column}, row ${move.landing_row}`;
      moveList.appendChild(li);
    }
  }

  updateStatus() {
    const statusDiv = document.getElementById('status');
    statusDiv.classList.remove('error');

    if (this.gameState.status === 'active') {
      statusDiv.textContent = `${this.gameState.current_player}'s turn`;
    } else if (this.gameState.status === 'red_won') {
      statusDiv.textContent = 'Red wins';
    } else if (this.gameState.status === 'yellow_won') {
      statusDiv.textContent = 'Yellow wins';
    } else if (this.gameState.status === 'draw') {
      statusDiv.textContent = 'Draw';
    }
  }

  updateControls() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const dropBtns = document.querySelectorAll('.drop-btn');

    undoBtn.disabled = this.gameState.applied_moves.length === 0;
    redoBtn.disabled = this.gameState.redo_stack.length === 0;

    const gameActive = this.gameState.status === 'active';
    dropBtns.forEach(btn => {
      btn.disabled = !gameActive;
    });
  }

  showStatus(message, isError = false) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    if (isError) {
      statusDiv.classList.add('error');
    } else {
      statusDiv.classList.remove('error');
    }
  }
}

// Initialize the game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new DropLineGame();
});
