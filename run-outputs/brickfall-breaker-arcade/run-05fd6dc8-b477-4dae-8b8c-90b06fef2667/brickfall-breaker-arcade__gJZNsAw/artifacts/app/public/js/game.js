class BrickfallGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    this.PHYSICS_TIMESTEP = 1 / 120;
    this.MAX_ACCUMULATOR = this.PHYSICS_TIMESTEP * 10;
    this.accumulator = 0;
    
    this.canvasWidth = 378;
    this.canvasHeight = 600;
    
    this.state = 'menu';
    this.gameState = null;
    this.currentLevel = null;
    this.currentBrickLayout = null;
    
    this.paddle = {
      x: 189,
      y: 560,
      width: 118,
      height: 16,
      baseWidth: 118,
      speed: 400,
      vx: 0
    };
    
    this.balls = [];
    this.drops = [];
    this.bricks = {};
    
    this.score = 0;
    this.lives = 3;
    this.combo = 1;
    this.nextExtraLife = 20000;
    
    this.powerUp = null;
    this.powerSeconds = 0;
    
    this.lastPaddleX = this.paddle.x;
    this.isPaused = false;
    this.assistPaddle = false;
    
    this.animationFrameId = null;
    this.lastFrameTime = 0;
    
    this.runFinished = false;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.addEventListener('pointermove', (e) => this.handlePointerMove(e));
    document.addEventListener('touchmove', (e) => this.handleTouchMove(e));
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    
    document.getElementById('assist-paddle').addEventListener('change', (e) => {
      this.assistPaddle = e.target.checked;
      if (this.assistPaddle === false) {
        this.assistPaddle = false;
      }
    });
  }

  handlePointerMove(e) {
    if (this.assistPaddle === false && e.pointerType !== 'touch') {
      this.updatePaddleFromPointer(e.clientX);
    }
  }

  handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    this.updatePaddleFromPointer(touch.clientX);
    this.assistPaddle = false;
  }

  updatePaddleFromPointer(clientX) {
    const rect = this.canvas.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const canvasX = (relativeX / rect.width) * this.canvasWidth;
    
    this.paddle.x = Math.max(
      this.paddle.width / 2,
      Math.min(this.canvasWidth - this.paddle.width / 2, canvasX)
    );
    this.paddle.vx = (this.paddle.x - this.lastPaddleX) / (1/60);
    this.lastPaddleX = this.paddle.x;
  }

  handleKeyDown(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a') {
      this.paddle.vx = -this.paddle.speed;
      this.assistPaddle = false;
    } else if (e.key === 'ArrowRight' || e.key === 'd') {
      this.paddle.vx = this.paddle.speed;
      this.assistPaddle = false;
    } else if (e.key === ' ') {
      e.preventDefault();
      this.handleLaunch();
    } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      e.preventDefault();
      this.togglePause();
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      if (this.state === 'game-over') {
        this.handleRestart();
      }
    }
  }

  handleKeyUp(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'ArrowRight' || e.key === 'd') {
      this.paddle.vx = 0;
    }
  }

  handleLaunch() {
    if (this.state === 'ready') {
      const stuckBall = this.balls.find(b => b.stuck);
      if (stuckBall) {
        stuckBall.stuck = false;
        stuckBall.vx = (Math.random() - 0.5) * 200;
        stuckBall.vy = -300;
        this.state = 'playing';
      }
    } else if (this.state === 'playing' && this.balls.some(b => b.stuck)) {
      const stuckBall = this.balls.find(b => b.stuck);
      if (stuckBall) {
        stuckBall.stuck = false;
        stuckBall.vx = (Math.random() - 0.5) * 200;
        stuckBall.vy = -300;
      }
    }
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.isPaused = true;
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.isPaused = false;
      this.accumulator = 0;
    }
  }

  handleRestart() {
    if (this.state === 'game-over' && this.gameState) {
      window.ui.startNewRun(this.currentLevel.level_number || this.currentLevel.level);
    }
  }

  async loadLevel(levelNumber) {
    const gameState = await window.api.getGameState();
    
    // Find level info from the game state
    let levelData = null;
    if (gameState.levels) {
      levelData = gameState.levels.find(l => l.level_number === levelNumber);
    }
    
    if (!levelData) {
      // Fallback to calculated values
      levelData = {
        level_number: levelNumber,
        name: `Level ${levelNumber}`,
        base_speed: 300 + (levelNumber - 1) * 18,
        speed_cap: 520 + (levelNumber - 1) * 25,
        accent: '#56c7ff'
      };
    }

    this.currentLevel = levelData;
    this.currentBrickLayout = gameState.activeRun?.bricks || {};
    
    this.gameState = gameState.activeRun || {
      run_id: null,
      revision: 0,
      level: levelNumber,
      score: 0,
      lives: 3,
      combo: 1,
      next_extra_life: 20000,
      power_up: null,
      power_seconds: 0,
      paddle_width: 118,
      balls: [{ x: 189, y: 540, vx: 0, vy: 0, stuck: true, primary: true }],
      drops: [],
      bricks: this.currentBrickLayout,
      accumulated_time: 0
    };

    this.score = this.gameState.score;
    this.lives = this.gameState.lives;
    this.combo = this.gameState.combo;
    this.nextExtraLife = this.gameState.next_extra_life;
    this.powerUp = this.gameState.power_up;
    this.powerSeconds = this.gameState.power_seconds || 0;
    this.paddle.width = this.gameState.paddle_width;
    this.balls = (this.gameState.balls || []).map(b => ({ ...b }));
    this.drops = (this.gameState.drops || []).map(d => ({ ...d }));
    this.bricks = this.gameState.bricks ? JSON.parse(JSON.stringify(this.gameState.bricks)) : {};
    
    this.accumulator = this.gameState.accumulated_time || 0;
    
    if (!this.gameState.run_id) {
      const response = await window.api.startRun(levelNumber);
      this.gameState = response;
      this.balls = response.balls || this.balls;
      this.drops = response.drops || this.drops;
      this.bricks = response.bricks || this.bricks;
    }

    this.state = 'ready';
    this.startGameLoop();
  }

  startGameLoop() {
    const animate = (time) => {
      if (!this.lastFrameTime) {
        this.lastFrameTime = time;
      }

      const deltaTime = Math.min((time - this.lastFrameTime) / 1000, 0.033);
      this.lastFrameTime = time;

      if (!this.isPaused && this.state === 'playing') {
        this.accumulator += deltaTime;
        this.accumulator = Math.min(this.accumulator, this.MAX_ACCUMULATOR);

        while (this.accumulator >= this.PHYSICS_TIMESTEP) {
          this.update(this.PHYSICS_TIMESTEP);
          this.accumulator -= this.PHYSICS_TIMESTEP;
        }
      }

      this.render();
      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  update(dt) {
    if (this.state !== 'playing') return;

    this.updatePaddle(dt);
    this.updateBalls(dt);
    this.updateDrops(dt);
    this.updatePowerUp(dt);

    const allBroken = this.checkLevelComplete();
    if (allBroken) {
      this.completeLevel();
    }

    const noLives = this.checkGameOver();
    if (noLives) {
      this.endGame();
    }
  }

  updatePaddle(dt) {
    this.paddle.x += this.paddle.vx * dt;
    this.paddle.x = Math.max(
      this.paddle.width / 2,
      Math.min(this.canvasWidth - this.paddle.width / 2, this.paddle.x)
    );
    this.lastPaddleX = this.paddle.x;
  }

  updateBalls(dt) {
    for (const ball of this.balls) {
      if (ball.stuck) {
        ball.x = this.paddle.x;
        ball.y = this.paddle.y - 12;
        continue;
      }

      const startX = ball.x;
      const startY = ball.y;

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      this.ensureMinimumSpeed(ball);
      this.capBallSpeed(ball);

      this.checkWallCollisions(ball, startX, startY, dt);
      this.checkPaddleCollision(ball, startX, startY);
      this.checkBrickCollisions(ball, startX, startY);
    }
  }

  ensureMinimumSpeed(ball) {
    const minSpeed = 100;
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed < minSpeed && speed > 0) {
      const scale = minSpeed / speed;
      ball.vx *= scale;
      ball.vy *= scale;
    }
  }

  capBallSpeed(ball) {
    const levelSpeed = this.currentLevel?.speed_cap || 520;
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > levelSpeed) {
      const scale = levelSpeed / speed;
      ball.vx *= scale;
      ball.vy *= scale;
    }
  }

  checkWallCollisions(ball, startX, startY, dt) {
    const radius = 6;

    if (ball.x - radius < 0) {
      ball.x = radius;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + radius > this.canvasWidth) {
      ball.x = this.canvasWidth - radius;
      ball.vx = -Math.abs(ball.vx);
    }

    if (ball.y - radius < 0) {
      ball.y = radius;
      ball.vy = Math.abs(ball.vy);
    } else if (ball.y > this.canvasHeight) {
      this.loseBall(ball);
    }
  }

  checkPaddleCollision(ball, startX, startY) {
    const paddleTop = this.paddle.y - this.paddle.height / 2;
    const paddleBottom = this.paddle.y + this.paddle.height / 2;
    const paddleLeft = this.paddle.x - this.paddle.width / 2;
    const paddleRight = this.paddle.x + this.paddle.width / 2;
    const ballRadius = 6;

    if (
      ball.x + ballRadius >= paddleLeft &&
      ball.x - ballRadius <= paddleRight &&
      ball.y + ballRadius >= paddleTop &&
      ball.y - ballRadius <= paddleBottom &&
      startY < paddleTop
    ) {
      ball.y = paddleTop - ballRadius;
      
      const contactPos = (ball.x - paddleLeft) / this.paddle.width;
      const angle = (contactPos - 0.5) * Math.PI * 0.4;
      const speed = Math.hypot(ball.vx, ball.vy) || 300;
      
      ball.vx = Math.sin(angle) * speed * 0.8 + this.paddle.vx * 0.3;
      ball.vy = -Math.cos(angle) * speed;
      
      this.combo = 1;
      
      if (this.powerUp === 'sticky' && !ball.stuck) {
        ball.stuck = true;
        this.powerUp = null;
        this.powerSeconds = 0;
      }
    }
  }

  checkBrickCollisions(ball, startX, startY) {
    const ballRadius = 6;
    const gridSize = 30;
    let closestDist = Infinity;
    let closestBrick = null;

    // Find closest collision
    for (const key in this.bricks) {
      const brick = this.bricks[key];
      if (brick.health <= 0) continue;

      const [row, col] = key.split(',').map(Number);
      const brickX = col * gridSize + gridSize / 2;
      const brickY = row * gridSize + gridSize / 2;
      const brickW = gridSize - 2;
      const brickH = gridSize - 2;

      if (this.sweptCollision(startX, startY, ball.x, ball.y, ballRadius, brickX, brickY, brickW, brickH)) {
        const dist = Math.hypot(brickX - startX, brickY - startY);
        if (dist < closestDist) {
          closestDist = dist;
          closestBrick = { key, brick, x: brickX, y: brickY, w: brickW, h: brickH };
        }
      }
    }

    if (closestBrick) {
      const damage = this.damageBrick(closestBrick.key, closestBrick.brick);
      if (damage > 0) {
        this.addScore(damage);
        
        // Reflect ball based on brick surface
        const left = closestBrick.x - closestBrick.w/2;
        const right = closestBrick.x + closestBrick.w/2;
        const top = closestBrick.y - closestBrick.h/2;
        const bottom = closestBrick.y + closestBrick.h/2;
        
        // Determine which edge was hit
        const overlapLeft = Math.abs(ball.x - left);
        const overlapRight = Math.abs(ball.x - right);
        const overlapTop = Math.abs(ball.y - top);
        const overlapBottom = Math.abs(ball.y - bottom);
        
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
        
        if (minOverlap === overlapLeft || minOverlap === overlapRight) {
          // Vertical collision
          ball.vx = -ball.vx;
        } else {
          // Horizontal collision
          ball.vy = -ball.vy;
        }
        
        // Spawn power-up if applicable
        if (closestBrick.brick.drop) {
          this.spawnDrop(closestBrick.x, closestBrick.y, closestBrick.brick.drop);
        }
      }
    }
  }

  sweptCollision(x1, y1, x2, y2, r, bx, by, bw, bh) {
    const left = bx - bw / 2;
    const right = bx + bw / 2;
    const top = by - bh / 2;
    const bottom = by + bh / 2;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);

    if (dist === 0) {
      return x2 > left && x2 < right && y2 > top && y2 < bottom;
    }

    const t = Math.max(0, Math.min(1, ((bx - x1) * dx + (by - y1) * dy) / (dist * dist)));
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;

    const distToBrick = Math.hypot(bx - closestX, by - closestY);
    return distToBrick <= r;
  }

  closestPointOnRect(px, py, left, top, width, height) {
    return {
      x: Math.max(left, Math.min(px, left + width)),
      y: Math.max(top, Math.min(py, top + height))
    };
  }

  damageBrick(key, brick) {
    if (brick.type === 'solid') {
      return 0;
    }
    
    if (brick.health <= 0) {
      return 0;
    }

    brick.health--;
    
    if (brick.type === 'normal') {
      if (brick.health === 0) {
        return 100 * this.combo;
      }
    } else if (brick.type === 'strong') {
      if (brick.health === 1) {
        return 75 * this.combo;
      } else if (brick.health === 0) {
        return 250 * this.combo;
      }
    }
    
    return 0;
  }

  addScore(points) {
    const oldScore = this.score;
    this.score += points;
    
    const oldThreshold = Math.floor(oldScore / 20000);
    const newThreshold = Math.floor(this.score / 20000);
    
    if (newThreshold > oldThreshold) {
      this.lives++;
      this.nextExtraLife = (newThreshold + 1) * 20000;
    }
    
    this.combo = Math.min(5, this.combo + 1);
  }

  checkLevelComplete() {
    // Level is complete when all breakable bricks are destroyed
    const breakableBricks = Object.values(this.bricks).filter(b => b.type !== 'solid');
    return breakableBricks.length === 0 || breakableBricks.every(b => b.health <= 0);
  }

  completeLevel() {
    if (this.state === 'level-complete') return;
    
    this.state = 'level-complete';
    const bonus = this.currentLevel.level_number * 1000;
    this.score += bonus;
    this.gameState.outcome = 'level-complete';
    this.gameState.next_level = this.currentLevel.level_number + 1;
    
    // Save level completion
    if (!this.runFinished) {
      this.runFinished = true;
      this.finishRun('completed');
    }
  }

  checkGameOver() {
    return this.lives === 0;
  }

  endGame() {
    if (this.state === 'game-over') return;
    
    this.state = 'game-over';
    
    if (!this.runFinished) {
      this.runFinished = true;
      this.finishRun('game-over');
    }
  }

  loseBall(ball) {
    const idx = this.balls.indexOf(ball);
    if (idx !== -1) {
      this.balls.splice(idx, 1);
    }

    if (this.balls.length === 0) {
      this.lives--;
      if (this.lives <= 0) {
        this.endGame();
      } else {
        this.state = 'life-lost';
        this.powerUp = null;
        this.powerSeconds = 0;
        this.drops = [];
        setTimeout(() => {
          if (this.state === 'life-lost') {
            this.balls = [{
              x: this.paddle.x,
              y: this.paddle.y - 12,
              vx: 0,
              vy: 0,
              stuck: true,
              primary: true
            }];
            this.state = 'ready';
          }
        }, 1000);
      }
    }
  }

  updateDrops(dt) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      drop.y += 200 * dt;

      const paddleTop = this.paddle.y - this.paddle.height / 2;
      const paddleBottom = this.paddle.y + this.paddle.height / 2;
      const paddleLeft = this.paddle.x - this.paddle.width / 2;
      const paddleRight = this.paddle.x + this.paddle.width / 2;

      if (
        drop.x >= paddleLeft &&
        drop.x <= paddleRight &&
        drop.y >= paddleTop &&
        drop.y <= paddleBottom
      ) {
        this.collectPowerUp(drop.type);
        this.drops.splice(i, 1);
      } else if (drop.y > this.canvasHeight) {
        this.drops.splice(i, 1);
      }
    }
  }

  spawnDrop(x, y, type) {
    this.drops.push({
      x,
      y,
      type,
      vx: 0,
      vy: 0
    });
  }

  collectPowerUp(type) {
    if (this.powerUp && this.powerUp !== type) {
      this.removePowerUp();
    }

    this.powerUp = type;
    this.powerSeconds = 20;

    if (type === 'wide') {
      this.paddle.width = this.paddle.baseWidth * 1.5;
    } else if (type === 'slow') {
      for (const ball of this.balls) {
        ball.vx *= 0.7;
        ball.vy *= 0.7;
      }
    } else if (type === 'multiball') {
      if (this.balls.length === 1) {
        const primaryBall = this.balls[0];
        this.balls.push({
          x: primaryBall.x - 20,
          y: primaryBall.y,
          vx: primaryBall.vx - 100,
          vy: primaryBall.vy,
          stuck: false,
          primary: false
        });
      }
    } else if (type === 'sticky') {
      // No immediate action
    }
  }

  removePowerUp() {
    if (this.powerUp === 'wide') {
      this.paddle.width = this.paddle.baseWidth;
    } else if (this.powerUp === 'slow') {
      for (const ball of this.balls) {
        const speed = Math.hypot(ball.vx, ball.vy);
        const newSpeed = Math.min(speed / 0.7, this.currentLevel?.speed_cap || 520);
        if (speed > 0) {
          ball.vx = (ball.vx / speed) * newSpeed;
          ball.vy = (ball.vy / speed) * newSpeed;
        }
      }
    } else if (this.powerUp === 'multiball') {
      this.balls = this.balls.filter(b => b.primary !== false || !b.secondary_only);
    }
  }

  updatePowerUp(dt) {
    if (this.powerUp && this.powerSeconds > 0) {
      this.powerSeconds -= dt;
      if (this.powerSeconds <= 0) {
        this.removePowerUp();
        this.powerUp = null;
        this.powerSeconds = 0;
      }
    }
  }

  render() {
    this.ctx.fillStyle = '#0f0f1e';
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    this.renderBricks();
    this.renderDrops();
    this.renderPaddle();
    this.renderBalls();
    this.renderUI();
  }

  renderBricks() {
    const gridSize = 30;
    const colors = {
      normal: '#56c7ff',
      strong: '#ffd166',
      solid: '#6b6b7e'
    };

    for (const key in this.bricks) {
      const brick = this.bricks[key];
      const [row, col] = key.split(',').map(Number);
      const x = col * gridSize + 1;
      const y = row * gridSize + 1;

      if (brick.health <= 0 && brick.type !== 'solid') continue;

      this.ctx.fillStyle = colors[brick.type] || '#56c7ff';
      this.ctx.fillRect(x, y, gridSize - 2, gridSize - 2);

      if (brick.type === 'strong' && brick.health > 0) {
        this.ctx.strokeStyle = brick.health === 1 ? '#ff6b6b' : '#ffd166';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, gridSize - 2, gridSize - 2);
      }
    }
  }

  renderDrops() {
    for (const drop of this.drops) {
      const colors = {
        wide: '#56c7ff',
        slow: '#7ee787',
        multiball: '#ffd166',
        sticky: '#ff6b6b'
      };
      
      this.ctx.fillStyle = colors[drop.type] || '#56c7ff';
      this.ctx.beginPath();
      this.ctx.arc(drop.x, drop.y, 6, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  renderPaddle() {
    this.ctx.fillStyle = '#7ee787';
    this.ctx.fillRect(
      this.paddle.x - this.paddle.width / 2,
      this.paddle.y - this.paddle.height / 2,
      this.paddle.width,
      this.paddle.height
    );
  }

  renderBalls() {
    for (const ball of this.balls) {
      this.ctx.fillStyle = ball.primary ? '#56c7ff' : '#ffd166';
      this.ctx.beginPath();
      this.ctx.arc(ball.x, ball.y, 6, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  renderUI() {
    if (this.state === 'ready') {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
      
      this.ctx.fillStyle = '#56c7ff';
      this.ctx.font = 'bold 24px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('Press Space to Launch', this.canvasWidth / 2, this.canvasHeight / 2);
    } else if (this.state === 'paused') {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
      
      this.ctx.fillStyle = '#ffd166';
      this.ctx.font = 'bold 24px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('PAUSED', this.canvasWidth / 2, this.canvasHeight / 2);
    } else if (this.state === 'life-lost') {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
      
      this.ctx.fillStyle = '#ff6b6b';
      this.ctx.font = 'bold 24px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('LIFE LOST', this.canvasWidth / 2, this.canvasHeight / 2);
    }
  }

  async saveState() {
    if (!this.gameState || !this.gameState.run_id) return;

    try {
      const stateToSave = {
        level: this.currentLevel.level_number,
        score: this.score,
        lives: this.lives,
        combo: this.combo,
        next_extra_life: this.nextExtraLife,
        power_up: this.powerUp,
        power_seconds: this.powerSeconds,
        paddle_width: this.paddle.width,
        balls: this.balls,
        drops: this.drops,
        bricks: this.bricks,
        accumulated_time: this.accumulator
      };

      await window.api.saveRun(
        this.gameState.run_id,
        this.gameState.revision,
        stateToSave
      );

      this.gameState.revision++;
    } catch (err) {
      console.error('Error saving state:', err);
    }
  }

  async finishRun(outcome) {
    if (!this.gameState || !this.gameState.run_id) return;

    try {
      const result = await window.api.finishRun(
        this.gameState.run_id,
        this.gameState.revision,
        outcome,
        this.currentLevel.level_number,
        this.score
      );

      window.ui.gameState.leaderboard = result.leaderboard;
      window.ui.renderLeaderboard(result.leaderboard);
    } catch (err) {
      console.error('Error finishing run:', err);
    }
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Remove event listeners
    document.removeEventListener('pointermove', (e) => this.handlePointerMove(e));
    document.removeEventListener('touchmove', (e) => this.handleTouchMove(e));
    document.removeEventListener('keydown', (e) => this.handleKeyDown(e));
    document.removeEventListener('keyup', (e) => this.handleKeyUp(e));
  }
}

window.game = new BrickfallGame();
