// ============ GLOBAL STATE ============

const gameState = {
  token: null,
  user: null,
  currentLevel: null,
  currentRun: null,
  gamePhase: 'menu', // menu, ready, playing, paused, life-lost, level-complete, game-over, completed
  lastSaveTime: 0,
  pendingRequests: new Set(),
  lastRevision: 0,
  activeOperationId: null,
  currentDrill: null,
  labStepCounter: 0
};

const inputState = {
  left: false,
  right: false,
  space: false,
  paddle: { x: 300, y: 720, width: 118, height: 15 }
};

const SAVE_INTERVAL = 1000; // Save every second
const PHYSICS_STEP = 1 / 120;
const BALL_RADIUS = 6;
const GAME_WIDTH = 800;
const GAME_HEIGHT = 800;
const MIN_BALL_SPEED = 100;

// ============ INITIALIZATION ============

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  restoreSession();
});

function setupEventListeners() {
  // Sign-in
  document.getElementById('signin-form').addEventListener('submit', handleSignin);
  
  document.querySelectorAll('.demo-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const email = btn.getAttribute('data-email');
      document.getElementById('email').value = email;
      document.getElementById('password').value = 'password123';
      document.getElementById('signin-form').dispatchEvent(new Event('submit'));
    });
  });
  
  // Sign-out
  document.getElementById('signout-btn').addEventListener('click', handleSignout);
  
  // Game controls
  document.getElementById('launch-btn').addEventListener('click', launchBall);
  document.getElementById('pause-btn').addEventListener('click', togglePause);
  document.getElementById('restart-btn').addEventListener('click', restartRun);
  
  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', switchTab);
  });
  
  // Canvas
  const canvas = document.getElementById('game-canvas');
  canvas.addEventListener('mousemove', handleCanvasMouseMove);
  canvas.addEventListener('touchmove', handleCanvasTouchMove);
  
  // Keyboard
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
  
  // Assist paddle
  document.getElementById('assist-paddle-toggle').addEventListener('change', updateAssistPaddle);
}

// ============ AUTHENTICATION ============

async function handleSignin(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('signin-error');
  
  try {
    const response = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      const data = await response.json();
      errorDiv.textContent = data.error || 'Sign-in failed';
      errorDiv.style.display = 'block';
      return;
    }
    
    const data = await response.json();
    gameState.token = data.token;
    gameState.user = data.user;
    gameState.lastRevision = 0;
    
    localStorage.setItem('brickfall_token', data.token);
    localStorage.setItem('brickfall_user', JSON.stringify(data.user));
    
    errorDiv.style.display = 'none';
    showGameScreen();
  } catch (err) {
    console.error('Sign-in error:', err);
    errorDiv.textContent = 'Network error. Please try again.';
    errorDiv.style.display = 'block';
  }
}

async function handleSignout() {
  if (!confirm('Sign out?')) return;
  
  try {
    await apiFetch('/api/auth/signout', { method: 'POST' });
  } catch (err) {
    console.error('Signout error:', err);
  }
  
  gameState.token = null;
  gameState.user = null;
  gameState.currentRun = null;
  
  localStorage.removeItem('brickfall_token');
  localStorage.removeItem('brickfall_user');
  localStorage.removeItem('brickfall_run');
  
  showSigninScreen();
}

function restoreSession() {
  const token = localStorage.getItem('brickfall_token');
  const user = localStorage.getItem('brickfall_user');
  
  if (token && user) {
    gameState.token = token;
    gameState.user = JSON.parse(user);
    showGameScreen();
  }
}

// ============ SCREEN MANAGEMENT ============

function showSigninScreen() {
  document.getElementById('signin-screen').classList.add('active');
  document.getElementById('game-screen').classList.remove('active');
}

function showGameScreen() {
  document.getElementById('signin-screen').classList.remove('active');
  document.getElementById('game-screen').classList.add('active');
  
  updatePlayerInfo();
  loadLevels();
  loadLeaderboard();
  loadRunHistory();
  loadDrills();
  loadActiveRun();
}

function updatePlayerInfo() {
  if (!gameState.user) return;
  
  document.querySelector('.player-name').textContent = gameState.user.name;
  document.querySelector('.player-initials').textContent = gameState.user.initials;
}

// ============ LEVELS ============

async function loadLevels() {
  try {
    const data = await apiFetch('/api/levels');
    const container = document.getElementById('levels-list');
    container.innerHTML = '';
    
    data.all.forEach(level => {
      const btn = document.createElement('button');
      btn.className = 'level-btn';
      btn.textContent = `Level ${level.level}: ${level.name}`;
      btn.style.borderLeftColor = level.accent;
      btn.style.borderLeftWidth = '3px';
      
      if (level.level > data.unlocked) {
        btn.classList.add('locked');
        btn.disabled = true;
        btn.textContent += ' (Locked)';
      } else {
        btn.addEventListener('click', () => startNewRun(level.level));
      }
      
      container.appendChild(btn);
    });
  } catch (err) {
    console.error('Failed to load levels:', err);
  }
}

async function startNewRun(level) {
  if (gameState.currentRun && gameState.gamePhase !== 'game-over' && gameState.gamePhase !== 'completed') {
    if (!confirm('Abandon current run?')) return;
  }
  
  const operationId = generateOperationId();
  gameState.activeOperationId = operationId;
  
  try {
    const response = await apiFetch('/api/game/start', {
      method: 'POST',
      body: JSON.stringify({
        level,
        revision: gameState.lastRevision,
        operationId
      })
    });
    
    if (!response.success) {
      if (response.status === 409) {
        gameState.lastRevision = response.revision;
        loadActiveRun();
        return;
      }
      showStatus(response.error || 'Failed to start run', 'error');
      return;
    }
    
    gameState.lastRevision = response.revision;
    gameState.currentRun = response.run;
    gameState.currentLevel = level;
    gameState.gamePhase = 'ready';
    
    initializeGameState();
    showStatus(`Level ${level} loaded. Press Space to launch!`, 'info');
  } catch (err) {
    console.error('Failed to start run:', err);
    showStatus('Failed to start run', 'error');
  }
}

async function loadActiveRun() {
  try {
    const data = await apiFetch('/api/game/state');
    
    if (data.activeRun) {
      gameState.currentRun = data.activeRun;
      gameState.currentLevel = data.activeRun.level;
      gameState.lastRevision = data.activeRun.revision;
      gameState.gamePhase = 'paused';
      
      document.getElementById('resume-run-btn').style.display = 'block';
      document.getElementById('resume-run-btn').addEventListener('click', () => {
        gameState.gamePhase = 'playing';
        startGameLoop();
      });
      
      updateHUD();
    }
  } catch (err) {
    console.error('Failed to load active run:', err);
  }
}

// ============ GAME INITIALIZATION ============

function initializeGameState() {
  if (!gameState.currentRun) {
    gameState.currentRun = {
      state: {
        level: gameState.currentLevel,
        score: 0,
        lives: 3,
        combo: 1,
        nextExtraLife: 20000,
        balls: [{ x: 400, y: 400, vx: 0, vy: 0, stuck: true }],
        paddle: { x: 300, y: 720, width: 118, height: 15, recentMotion: 0 },
        bricks: [],
        drops: [],
        power: null,
        powerSeconds: 0
      }
    };
  }
  
  loadLevelBricks();
  gameState.gamePhase = 'ready';
  updateHUD();
}

async function loadLevelBricks() {
  try {
    const levelNum = gameState.currentLevel || 1;
    const response = await apiFetch(`/api/levels/${levelNum}/bricks`);
    
    // Convert brick data to game format
    gameState.currentRun.state.bricks = response.bricks.map(brick => ({
      x: brick.column * 100,
      y: brick.row * 40 + 60,
      w: 95,
      h: 35,
      type: brick.type,
      destroyed: false,
      damaged: false,
      drop: brick.drop || null
    }));
  } catch (err) {
    console.error('Failed to load bricks:', err);
    // Fallback to generated bricks
    gameState.currentRun.state.bricks = generateBricksForLevel(gameState.currentLevel || 1);
  }
}

function generateBricksForLevel(level) {
  const bricks = [];
  const types = ['normal', 'strong', 'solid'];
  const rows = 4;
  const cols = 8;
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const typeIdx = (r + c) % types.length;
      const type = types[typeIdx];
      bricks.push({
        x: c * 100,
        y: r * 40 + 60,
        w: 95,
        h: 35,
        type,
        destroyed: false,
        damaged: false,
        drop: null
      });
    }
  }
  
  return bricks;
}

// ============ GAME LOOP ============

let animationFrameId = null;
let lastFrameTime = 0;
let physicsAccumulator = 0;

async function startGameLoop() {
  gameState.gamePhase = 'playing';
  
  function loop(currentTime) {
    if (!lastFrameTime) lastFrameTime = currentTime;
    const deltaTime = Math.min((currentTime - lastFrameTime) / 1000, 0.016);
    lastFrameTime = currentTime;
    
    if (gameState.gamePhase === 'playing') {
      physicsAccumulator += deltaTime;
      
      while (physicsAccumulator >= PHYSICS_STEP) {
        updatePhysics();
        physicsAccumulator -= PHYSICS_STEP;
      }
      
      const now = Date.now();
      if (now - gameState.lastSaveTime > SAVE_INTERVAL) {
        saveGameState();
        gameState.lastSaveTime = now;
      }
    }
    
    render();
    animationFrameId = requestAnimationFrame(loop);
  }
  
  animationFrameId = requestAnimationFrame(loop);
}

function updatePhysics() {
  if (!gameState.currentRun || gameState.gamePhase === 'paused') return;
  
  const state = gameState.currentRun.state;
  const paddle = inputState.paddle;
  
  // Update paddle position based on input
  if (inputState.left && paddle.x > 0) {
    paddle.x -= 400 * PHYSICS_STEP;
    paddle.recentMotion = -400;
  } else if (inputState.right && paddle.x < GAME_WIDTH - paddle.width) {
    paddle.x += 400 * PHYSICS_STEP;
    paddle.recentMotion = 400;
  } else {
    paddle.recentMotion = 0;
  }
  
  // Clamp paddle to bounds
  paddle.x = Math.max(0, Math.min(paddle.x, GAME_WIDTH - paddle.width));
  
  // Move stuck balls with paddle
  state.balls.forEach(ball => {
    if (ball.stuck) {
      ball.x = paddle.x + paddle.width / 2;
      ball.y = paddle.y - BALL_RADIUS - 5;
    }
  });
  
  // Update power-up timer
  if (state.power && state.powerSeconds > 0) {
    state.powerSeconds -= PHYSICS_STEP;
    if (state.powerSeconds <= 0) {
      state.powerSeconds = 0;
      // Reset power-up effects
      if (state.power === 'wide') {
        inputState.paddle.width = 118;
      } else if (state.power === 'slow') {
        state.balls.forEach(ball => {
          if (!ball.stuck) {
            const speed = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
            if (speed > 0) {
              ball.vx /= 0.7;
              ball.vy /= 0.7;
            }
          }
        });
      }
      state.power = null;
      showStatus('Power-up expired', 'info');
    }
  }
  
  // Update drops
  const newDrops = [];
  state.drops.forEach(drop => {
    drop.y += drop.vy * PHYSICS_STEP;
    
    if (drop.y > GAME_HEIGHT) return;
    
    // Check paddle collision
    if (drop.y + 8 > paddle.y - 15 && drop.y - 8 < paddle.y &&
        drop.x > paddle.x && drop.x < paddle.x + paddle.width) {
      applyPowerUp(drop.type);
      addEvent(`Collected ${drop.type}`);
      return;
    }
    newDrops.push(drop);
  });
  state.drops = newDrops;
  
  // Simulate ball physics
  const lostBalls = [];
  state.balls.forEach((ball, ballIdx) => {
    if (ball.stuck || ball.lost) return;
    
    let ballLost = false;
    
    // Move ball
    ball.x += ball.vx * PHYSICS_STEP;
    ball.y += ball.vy * PHYSICS_STEP;
    
    // Wall bounces
    if (ball.x - BALL_RADIUS < 0) {
      ball.x = BALL_RADIUS;
      ball.vx = Math.abs(ball.vx);
    }
    if (ball.x + BALL_RADIUS > GAME_WIDTH) {
      ball.x = GAME_WIDTH - BALL_RADIUS;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y - BALL_RADIUS < 0) {
      ball.y = BALL_RADIUS;
      ball.vy = Math.abs(ball.vy);
    }
    
    // Check if lost (below screen)
    if (ball.y > GAME_HEIGHT + 20) {
      ball.lost = true;
      ballLost = true;
      lostBalls.push(ballIdx);
      addEvent('Ball lost');
    }
    
    // Paddle collision
    const paddleRect = {
      x: paddle.x,
      y: paddle.y - 15,
      w: paddle.width,
      h: 15
    };
    
    if (!ballLost && circleRectCollision(ball, paddleRect)) {
      ball.y = paddle.y - BALL_RADIUS - 5;
      ball.vy = -Math.abs(ball.vy);
      state.combo = 1;
      addEvent('Paddle hit');
    }
    
    // Brick collision
    if (!ballLost) {
      for (let i = 0; i < state.bricks.length; i++) {
        const brick = state.bricks[i];
        if (brick.destroyed) continue;
        
        const brickRect = { x: brick.x, y: brick.y, w: brick.w, h: brick.h };
        
        if (circleRectCollision(ball, brickRect)) {
          // Simple bounce off top/bottom or left/right
          const ballCenterX = ball.x;
          const ballCenterY = ball.y;
          const brickCenterX = brick.x + brick.w / 2;
          const brickCenterY = brick.y + brick.h / 2;
          
          const dx = Math.abs(ballCenterX - brickCenterX);
          const dy = Math.abs(ballCenterY - brickCenterY);
          
          if (dx > dy) {
            ball.vx = -ball.vx;
          } else {
            ball.vy = -ball.vy;
          }
          
          if (brick.type !== 'solid') {
            if (brick.type === 'normal') {
              brick.destroyed = true;
              state.score += 100 * state.combo;
              if (brick.drop) {
                state.drops.push({
                  type: brick.drop,
                  x: brick.x + brick.w / 2,
                  y: brick.y + brick.h / 2,
                  vy: 100
                });
              }
              state.combo = Math.min(state.combo + 1, 5);
              addEvent(`+${100 * state.combo} (×${state.combo})`);
            } else if (brick.type === 'strong') {
              if (!brick.damaged) {
                brick.damaged = true;
                state.score += 75 * state.combo;
                state.combo = Math.min(state.combo + 1, 5);
                addEvent(`+${75 * state.combo} (damaged)`);
              } else {
                brick.destroyed = true;
                state.score += 250 * state.combo;
                if (brick.drop) {
                  state.drops.push({
                    type: brick.drop,
                    x: brick.x + brick.w / 2,
                    y: brick.y + brick.h / 2,
                    vy: 100
                  });
                }
                state.combo = Math.min(state.combo + 1, 5);
                addEvent(`+${250 * state.combo} (destroyed)`);
              }
            }
          } else {
            addEvent('Solid bounce');
          }
          break;
        }
      }
    }
  });
  
  // Check if all balls lost
  if (lostBalls.length > 0 && state.balls.filter(b => !b.lost).length === 0) {
    state.lives--;
    if (state.lives > 0) {
      gameState.gamePhase = 'life-lost';
      showStatus(`Life lost! ${state.lives} remaining`, 'error');
      setTimeout(() => {
        resetBall();
        gameState.gamePhase = 'playing';
      }, 2000);
    } else {
      gameState.gamePhase = 'game-over';
      addEvent('Game Over');
      finishRun('game-over');
    }
  }
  
  // Check level completion
  const breakableCount = state.bricks.filter(b => b.type !== 'solid').length;
  const breakableDestroyed = state.bricks.filter(b => b.type !== 'solid' && b.destroyed).length;
  
  if (breakableDestroyed === breakableCount && breakableCount > 0 && state.balls.some(b => !b.lost)) {
    state.score += 1000 * gameState.currentLevel;
    gameState.gamePhase = 'level-complete';
    addEvent(`Level ${gameState.currentLevel} complete!`);
    
    if (gameState.currentLevel === 10) {
      gameState.gamePhase = 'completed';
      finishRun('completed');
    } else {
      showStatus(`Level ${gameState.currentLevel} completed! Next: Level ${gameState.currentLevel + 1}`, 'success');
      setTimeout(() => {
        gameState.currentLevel++;
        initializeGameState();
        gameState.gamePhase = 'playing';
      }, 2000);
    }
  }
  
  updateHUD();
}

function circleRectCollision(circle, rect) {
  const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  
  return (dx * dx + dy * dy) < (BALL_RADIUS * BALL_RADIUS);
}

function resetBall() {
  if (!gameState.currentRun) return;
  
  const state = gameState.currentRun.state;
  const paddle = inputState.paddle;
  
  state.balls = [{
    x: paddle.x + paddle.width / 2,
    y: paddle.y - BALL_RADIUS - 5,
    vx: 0,
    vy: 0,
    stuck: true,
    lost: false
  }];
  
  showStatus('Press Space to launch', 'info');
}

async function saveGameState() {
  if (!gameState.currentRun || gameState.gamePhase === 'menu') return;
  
  try {
    await apiFetch('/api/game/save', {
      method: 'POST',
      body: JSON.stringify({
        state: gameState.currentRun.state,
        revision: gameState.lastRevision,
        operationId: generateOperationId()
      })
    });
  } catch (err) {
    console.error('Failed to save:', err);
  }
}

async function finishRun(outcome) {
  if (!gameState.currentRun) return;
  
  try {
    const response = await apiFetch('/api/game/finish', {
      method: 'POST',
      body: JSON.stringify({
        outcome,
        level: gameState.currentLevel,
        score: gameState.currentRun.state.score,
        snapshot: gameState.currentRun.state,
        revision: gameState.lastRevision,
        operationId: generateOperationId()
      })
    });
    
    if (response.success) {
      showStatus(`Run ${outcome}! Score: ${gameState.currentRun.state.score}`, 'success');
      gameState.currentRun = null;
      gameState.lastRevision = 0;
      loadLeaderboard();
      loadRunHistory();
      gameState.gamePhase = outcome === 'completed' ? 'completed' : 'game-over';
    }
  } catch (err) {
    console.error('Failed to finish run:', err);
  }
}

// ============ RENDERING ============

function render() {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#0a0e27';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  
  if (!gameState.currentRun) return;
  
  const state = gameState.currentRun.state;
  
  // Draw bricks
  state.bricks.forEach(brick => {
    if (brick.destroyed) return;
    
    if (brick.type === 'normal') {
      ctx.fillStyle = '#56c7ff';
    } else if (brick.type === 'strong') {
      ctx.fillStyle = brick.damaged ? '#7ee787' : '#ff6b6b';
    } else {
      ctx.fillStyle = '#4a5568';
    }
    
    ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(brick.x, brick.y, brick.w, brick.h);
  });
  
  // Draw paddle
  const paddle = inputState.paddle;
  ctx.fillStyle = '#56c7ff';
  ctx.fillRect(paddle.x, paddle.y - 15, paddle.width, 15);
  
  // Draw balls
  ctx.fillStyle = '#fff';
  state.balls.forEach(ball => {
    if (ball.lost) return;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  });
  
  // Draw drops
  state.drops.forEach(drop => {
    const colors = {
      wide: '#ff9999',
      slow: '#99ff99',
      multiball: '#ffff99',
      sticky: '#ff99ff'
    };
    ctx.fillStyle = colors[drop.type] || '#ffffff';
    ctx.beginPath();
    ctx.arc(drop.x, drop.y, 8, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ============ HUD UPDATE ============

function updateHUD() {
  if (!gameState.currentRun) return;
  
  const state = gameState.currentRun.state;
  
  document.getElementById('score-display').textContent = state.score;
  document.getElementById('level-display').textContent = gameState.currentLevel || 1;
  document.getElementById('lives-display').textContent = state.lives;
  document.getElementById('combo-display').textContent = `×${state.combo}`;
  
  if (state.power) {
    document.getElementById('power-display').style.display = 'block';
    document.getElementById('power-name').textContent = state.power;
    document.getElementById('power-timer').textContent = `${Math.ceil(state.powerSeconds)}s`;
  } else {
    document.getElementById('power-display').style.display = 'none';
  }
}

function showStatus(message, type = 'info') {
  const el = document.getElementById('status-message');
  el.textContent = message;
  el.className = `status-message ${type}`;
}

function addEvent(message) {
  const list = document.getElementById('events-list');
  const item = document.createElement('div');
  item.className = 'event-item';
  item.textContent = message;
  list.insertBefore(item, list.firstChild);
  
  // Keep only last 10 events
  while (list.children.length > 10) {
    list.removeChild(list.lastChild);
  }
}

// ============ INPUT HANDLING ============

function handleKeyDown(e) {
  if (e.key === 'ArrowLeft' || e.key === 'a') {
    inputState.left = true;
    if (gameState.currentRun && inputState.paddle) {
      document.getElementById('assist-paddle-toggle').checked = false;
    }
  }
  if (e.key === 'ArrowRight' || e.key === 'd') {
    inputState.right = true;
    if (gameState.currentRun && inputState.paddle) {
      document.getElementById('assist-paddle-toggle').checked = false;
    }
  }
  if (e.key === ' ') {
    e.preventDefault();
    launchBall();
  }
  if (e.key === 'p' || e.key === 'P') {
    e.preventDefault();
    togglePause();
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    togglePause();
  }
  if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    if (gameState.gamePhase === 'game-over' || gameState.gamePhase === 'completed') {
      restartRun();
    }
  }
}

function handleKeyUp(e) {
  if (e.key === 'ArrowLeft' || e.key === 'a') inputState.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd') inputState.right = false;
}

function handleCanvasMouseMove(e) {
  const canvas = document.getElementById('game-canvas');
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  
  if (gameState.currentRun) {
    inputState.paddle.x = Math.max(0, Math.min(x - inputState.paddle.width / 2, GAME_WIDTH - inputState.paddle.width));
    document.getElementById('assist-paddle-toggle').checked = false;
  }
}

function handleCanvasTouchMove(e) {
  const canvas = document.getElementById('game-canvas');
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  const x = touch.clientX - rect.left;
  
  if (gameState.currentRun) {
    inputState.paddle.x = Math.max(0, Math.min(x - inputState.paddle.width / 2, GAME_WIDTH - inputState.paddle.width));
    document.getElementById('assist-paddle-toggle').checked = false;
  }
}

function launchBall() {
  if (!gameState.currentRun) return;
  
  const state = gameState.currentRun.state;
  const stuck = state.balls.find(b => b.stuck);
  
  if (stuck) {
    stuck.stuck = false;
    stuck.vx = (Math.random() - 0.5) * 400;
    stuck.vy = -300;
    gameState.gamePhase = 'playing';
    if (!animationFrameId) startGameLoop();
  }
}

function togglePause() {
  if (gameState.gamePhase === 'playing') {
    gameState.gamePhase = 'paused';
    showStatus('Paused', 'info');
  } else if (gameState.gamePhase === 'paused') {
    gameState.gamePhase = 'playing';
    if (!animationFrameId) startGameLoop();
  }
}

function restartRun() {
  if (gameState.currentLevel) {
    gameState.currentRun = null;
    startNewRun(gameState.currentLevel);
  }
}

function applyPowerUp(type) {
  if (!gameState.currentRun) return;
  
  const state = gameState.currentRun.state;
  
  if (type === 'wide') {
    inputState.paddle.width = Math.min(177, inputState.paddle.width * 1.5);
  } else if (type === 'slow') {
    state.balls.forEach(ball => {
      if (!ball.stuck) {
        ball.vx *= 0.7;
        ball.vy *= 0.7;
      }
    });
  } else if (type === 'multiball') {
    const moving = state.balls.find(b => !b.stuck && !b.lost);
    if (moving && state.balls.length < 2) {
      state.balls.push({
        x: moving.x - 20,
        y: moving.y - 20,
        vx: moving.vx * 0.8,
        vy: moving.vy * 0.8,
        stuck: false,
        lost: false
      });
    }
  } else if (type === 'sticky') {
    const moving = state.balls.find(b => !b.stuck && !b.lost);
    if (moving) {
      moving.stuck = true;
    }
  }
  
  if (state.power === type) {
    state.powerSeconds = 20;
  } else {
    state.power = type;
    state.powerSeconds = 20;
  }
  
  showStatus(`${type} collected!`, 'success');
}

function updateAssistPaddle() {
  // Implement assist paddle logic
}

// ============ LEADERBOARD & HISTORY ============

async function loadLeaderboard() {
  try {
    const data = await apiFetch('/api/leaderboard');
    const container = document.getElementById('leaderboard-list');
    container.innerHTML = '';
    
    data.leaderboard.forEach((entry, idx) => {
      const div = document.createElement('div');
      div.className = 'leaderboard-entry';
      div.innerHTML = `
        <div><strong>#${idx + 1}</strong> ${entry.initials}</div>
        <div>Score: ${entry.score} | Level ${entry.level}</div>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    console.error('Failed to load leaderboard:', err);
  }
}

async function loadRunHistory() {
  try {
    const data = await apiFetch('/api/leaderboard/history');
    const container = document.getElementById('history-list');
    container.innerHTML = '';
    
    data.history.forEach(run => {
      const div = document.createElement('div');
      div.className = 'history-entry';
      div.innerHTML = `
        <div><strong>${run.outcome}</strong> on Level ${run.level}</div>
        <div>Score: ${run.score}</div>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}

// ============ MECHANICS LAB ============

async function loadDrills() {
  try {
    const data = await apiFetch('/api/lab/drills');
    const container = document.getElementById('drills-list');
    container.innerHTML = '';
    
    data.drills.forEach(drill => {
      const div = document.createElement('div');
      div.className = 'drill-entry';
      div.innerHTML = `
        <strong>${drill.name}</strong>
        <button class="btn btn-secondary" style="margin-top: 0.5rem; width: 100%;">Load Drill</button>
      `;
      div.querySelector('button').addEventListener('click', () => loadDrill(drill.id));
      container.appendChild(div);
    });
  } catch (err) {
    console.error('Failed to load drills:', err);
  }
}

async function loadDrill(drillId) {
  try {
    const data = await apiFetch(`/api/lab/drill/${drillId}`);
    gameState.currentDrill = data.drill;
    gameState.labStepCounter = 0;
    
    document.getElementById('lab-telemetry').style.display = 'block';
    updateLabTelemetry();
    showStatus(`Drill loaded: ${data.drill.name}`, 'success');
  } catch (err) {
    console.error('Failed to load drill:', err);
    showStatus('Failed to load drill', 'error');
  }
}

function updateLabTelemetry() {
  if (!gameState.currentDrill) return;
  
  const drill = gameState.currentDrill;
  document.getElementById('lab-phase').textContent = 'paused';
  document.getElementById('lab-score').textContent = '-';
  document.getElementById('lab-lives').textContent = '-';
  document.getElementById('lab-combo').textContent = '-';
  document.getElementById('lab-steps').textContent = gameState.labStepCounter;
}

// ============ TAB NAVIGATION ============

function switchTab(e) {
  const tabName = e.target.getAttribute('data-tab');
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  e.target.classList.add('active');
  document.getElementById(`tab-content-${tabName}`).classList.add('active');
}

// ============ UTILITIES ============

async function apiFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (gameState.token) {
    headers.Authorization = `Bearer ${gameState.token}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  if (response.status === 401) {
    showSigninScreen();
    throw new Error('Unauthorized');
  }
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }
  
  return response.json();
}

function generateOperationId() {
  return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
