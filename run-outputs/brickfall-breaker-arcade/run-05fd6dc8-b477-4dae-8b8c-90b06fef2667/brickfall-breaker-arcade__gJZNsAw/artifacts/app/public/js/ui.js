class UIManager {
  constructor() {
    this.currentUser = null;
    this.gameState = null;
    this.lastSaveTime = 0;
    this.saveInterval = 5000;
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('sign-in-form').addEventListener('submit', (e) => this.handleSignIn(e));
    document.getElementById('sign-out-btn').addEventListener('click', () => this.handleSignOut());
    
    document.getElementById('launch-btn').addEventListener('click', () => window.game.handleLaunch());
    document.getElementById('pause-btn').addEventListener('click', () => this.togglePause());
    document.getElementById('continue-btn').addEventListener('click', () => this.togglePause());
    document.getElementById('restart-btn').addEventListener('click', () => window.game.handleRestart());

    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    window.addEventListener('focus', () => this.handleWindowFocus());
  }

  async handleSignIn(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const messageEl = document.getElementById('sign-in-message');

    try {
      messageEl.textContent = 'Signing in...';
      const result = await window.api.signIn(email, password);
      
      window.api.setToken(result.token);
      this.currentUser = result.user;

      this.showGameScreen();
      await this.loadGameState();
    } catch (err) {
      messageEl.textContent = err.data?.error || 'Sign in failed';
      messageEl.className = 'message error';
    }
  }

  async handleSignOut() {
    try {
      await window.api.signOut();
      window.api.clearToken();
      this.currentUser = null;
      window.game.destroy();
      this.showSignInScreen();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  }

  showSignInScreen() {
    document.getElementById('sign-in-screen').classList.add('active');
    document.getElementById('game-screen').classList.remove('active');
  }

  showGameScreen() {
    document.getElementById('sign-in-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');

    const playerName = this.currentUser.name || this.currentUser.email;
    document.getElementById('player-name').textContent = `${playerName} (${this.currentUser.initials})`;
  }

  async loadGameState() {
    try {
      this.gameState = await window.api.getGameState();
      
      document.getElementById('best-score').textContent = this.gameState.user.best_score;

      this.renderLevelButtons();
      this.renderLeaderboard(this.gameState.leaderboard);
      this.renderRunHistory(this.gameState.runHistory);

      if (this.gameState.activeRun) {
        this.showContinueOption();
        window.game.loadLevel(this.gameState.activeRun.level);
      }

      this.startAutoSave();
    } catch (err) {
      console.error('Error loading game state:', err);
    }
  }

  renderLevelButtons() {
    const container = document.getElementById('level-buttons');
    container.innerHTML = '';

    for (let i = 1; i <= 10; i++) {
      const btn = document.createElement('button');
      btn.className = 'level-btn';
      btn.textContent = i;

      if (i <= this.gameState.unlockedLevels) {
        btn.className += ' unlocked';
        btn.addEventListener('click', () => this.startNewRun(i));
      } else {
        btn.disabled = true;
      }

      if (this.gameState.activeRun && this.gameState.activeRun.level === i) {
        btn.className += ' active';
      }

      container.appendChild(btn);
    }
  }

  renderLeaderboard(entries) {
    const container = document.getElementById('leaderboard');
    container.innerHTML = '';

    entries.forEach((entry, idx) => {
      const div = document.createElement('div');
      div.className = 'leaderboard-entry';
      
      div.innerHTML = `
        <span class="leaderboard-rank">#${idx + 1}</span>
        <span class="leaderboard-name">${entry.initials}</span>
        <span class="leaderboard-score">${entry.score}</span>
      `;
      
      container.appendChild(div);
    });
  }

  renderRunHistory(history) {
    const container = document.getElementById('run-history');
    container.innerHTML = '';

    if (!history || history.length === 0) {
      container.innerHTML = '<p style="color: var(--text-secondary);">No run history yet</p>';
      return;
    }

    history.forEach(record => {
      const div = document.createElement('div');
      div.className = 'history-entry';

      const outcomeClass = record.outcome === 'completed' ? 'completed' : 'game-over';
      const dateStr = new Date(record.finished_at).toLocaleDateString();

      div.innerHTML = `
        <div class="history-entry-header">
          <span>Level ${record.level}</span>
          <span class="history-outcome ${outcomeClass}">${record.outcome}</span>
        </div>
        <div class="history-details">
          <div class="history-detail-item">
            <span class="history-detail-label">Score:</span>
            <span class="history-detail-value">${record.score}</span>
          </div>
          <div class="history-detail-item">
            <span class="history-detail-label">Date:</span>
            <span class="history-detail-value">${dateStr}</span>
          </div>
        </div>
      `;

      container.appendChild(div);
    });
  }

  async startNewRun(levelNumber) {
    try {
      window.game.destroy();
      window.game = new BrickfallGame();
      await window.game.loadLevel(levelNumber);
      window.game.state = 'ready';
      this.updateUI();
    } catch (err) {
      this.showEventMessage(`Error starting level: ${err.message}`, 'error');
    }
  }

  showContinueOption() {
    if (this.gameState.activeRun) {
      document.getElementById('launch-btn').style.display = 'inline-block';
      document.getElementById('pause-btn').style.display = 'inline-block';
    }
  }

  togglePause() {
    if (window.game.state === 'playing') {
      window.game.togglePause();
      document.getElementById('pause-btn').style.display = 'none';
      document.getElementById('continue-btn').style.display = 'inline-block';
      this.showEventMessage('Game paused');
    } else if (window.game.state === 'paused') {
      window.game.togglePause();
      document.getElementById('pause-btn').style.display = 'inline-block';
      document.getElementById('continue-btn').style.display = 'none';
      this.showEventMessage('Game resumed');
    }
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  }

  updateUI() {
    const game = window.game;

    document.getElementById('hud-score').textContent = game.score;
    document.getElementById('hud-lives').textContent = game.lives;
    document.getElementById('hud-level').textContent = game.currentLevel?.level_number || 1;
    document.getElementById('hud-combo').textContent = `x${game.combo}`;

    if (game.powerUp) {
      document.getElementById('power-up-display').style.display = 'block';
      document.getElementById('power-up-name').textContent = game.powerUp.toUpperCase();
      
      const percentage = Math.max(0, (game.powerSeconds / 20) * 100);
      document.getElementById('power-timer-bar').style.width = `${percentage}%`;
    } else {
      document.getElementById('power-up-display').style.display = 'none';
    }

    document.getElementById('revision-display').textContent = game.gameState?.revision || 0;

    // Update UI based on game state
    if (game.state === 'ready') {
      document.getElementById('launch-btn').style.display = 'inline-block';
      document.getElementById('pause-btn').style.display = 'none';
      document.getElementById('restart-btn').style.display = 'none';
      document.getElementById('continue-btn').style.display = 'none';
    } else if (game.state === 'playing') {
      document.getElementById('launch-btn').style.display = 'none';
      document.getElementById('pause-btn').style.display = 'inline-block';
      document.getElementById('restart-btn').style.display = 'none';
      document.getElementById('continue-btn').style.display = 'none';
    } else if (game.state === 'paused') {
      document.getElementById('pause-btn').style.display = 'none';
      document.getElementById('continue-btn').style.display = 'inline-block';
    } else if (game.state === 'game-over') {
      document.getElementById('pause-btn').style.display = 'none';
      document.getElementById('continue-btn').style.display = 'none';
      document.getElementById('restart-btn').style.display = 'inline-block';
    } else if (game.state === 'level-complete') {
      document.getElementById('pause-btn').style.display = 'none';
      document.getElementById('restart-btn').style.display = 'inline-block';
    }

    requestAnimationFrame(() => this.updateUI());
  }

  showEventMessage(message, type = 'info') {
    const el = document.getElementById('event-message');
    el.textContent = message;
    el.className = 'event-message active';

    setTimeout(() => {
      el.classList.remove('active');
    }, 3000);
  }

  startAutoSave() {
    setInterval(() => {
      if (window.game && window.game.state === 'playing' && window.game.gameState) {
        window.game.saveState();
      }
    }, this.saveInterval);
  }

  handleWindowFocus() {
    if (this.gameState && !window.game.gameState) {
      this.loadGameState();
    }
  }
}

window.ui = new UIManager();

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    window.api.setToken(token);
    try {
      const response = await window.api.getGameState();
      window.ui.currentUser = response.user;
      window.ui.showGameScreen();
      window.ui.loadGameState();
    } catch (err) {
      window.ui.showSignInScreen();
    }
  } else {
    window.ui.showSignInScreen();
  }

  window.ui.updateUI();
});
