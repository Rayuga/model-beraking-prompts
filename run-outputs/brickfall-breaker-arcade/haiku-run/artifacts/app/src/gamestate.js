const { Ball, Brick, Paddle, Drop, Vector2, PHYSICS_STEP, sweepCircleRect, reflectVelocity, clampSpeed } = require('./physics');
const { getDb } = require('./db');

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 600;
const BRICK_WIDTH = 80;
const BRICK_HEIGHT = 20;
const BRICK_PADDING = 5;
const PADDLE_HEIGHT = 18;
const BALL_RADIUS = 9;

const STATES = {
  MENU: 'menu',
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  LIFE_LOST: 'life-lost',
  LEVEL_COMPLETE: 'level-complete',
  GAME_OVER: 'game-over',
  COMPLETED: 'completed'
};

class GameState {
  constructor(level, baseSpeed, speedCap, bricks, constants) {
    this.level = level;
    this.baseSpeed = baseSpeed;
    this.speedCap = speedCap;
    this.bricks = bricks.map(b => new Brick(b.x, b.y, b.width, b.height, b.type, b.drop));
    
    this.score = 0;
    this.lives = constants.initial_lives;
    this.combo = 1;
    this.nextExtraLife = constants.extra_life_step;
    
    this.paddle = new Paddle(CANVAS_WIDTH / 2 - 59, CANVAS_HEIGHT - 40, 118, PADDLE_HEIGHT);
    this.balls = [new Ball(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 60, 0, -baseSpeed, BALL_RADIUS, 'primary')];
    this.balls[0].stuck = true;
    
    this.drops = [];
    this.power = null;
    this.powerSeconds = 0;
    
    this.state = STATES.READY;
    this.simulationTime = 0;
    this.accumulator = 0;
    
    this.events = [];
    this.lastBrickHitId = null;
    this.assistPaddleActive = false;
    
    this.constants = constants;
  }

  static fromSnapshot(snapshot, constants) {
    const gs = new GameState(snapshot.level, constants.base_speed, constants.speed_cap, [], constants);
    
    gs.score = snapshot.score;
    gs.lives = snapshot.lives;
    gs.combo = snapshot.combo;
    gs.nextExtraLife = snapshot.next_extra_life;
    gs.paddle = new Paddle(snapshot.paddle_x, snapshot.paddle_y, snapshot.paddle_width, PADDLE_HEIGHT);
    gs.paddle.baseWidth = 118;
    
    gs.balls = snapshot.balls.map(b => {
      const ball = new Ball(b.x, b.y, b.vx, b.vy, BALL_RADIUS, b.id);
      ball.stuck = b.stuck;
      ball.stuckToPaddle = b.stuck_to_paddle;
      return ball;
    });
    
    gs.drops = snapshot.drops.map(d => new Drop(d.x, d.y, d.type));
    gs.power = snapshot.power;
    gs.powerSeconds = snapshot.power_seconds;
    
    gs.bricks = snapshot.bricks.map(b => {
      const brick = new Brick(b.x, b.y, b.width, b.height, b.type, b.drop);
      brick.health = b.health;
      brick.damaged = b.damaged;
      return brick;
    });
    
    gs.state = snapshot.state;
    gs.simulationTime = snapshot.simulation_time;
    gs.accumulator = 0;
    
    return gs;
  }

  toSnapshot() {
    return {
      level: this.level,
      score: this.score,
      lives: this.lives,
      combo: this.combo,
      next_extra_life: this.nextExtraLife,
      paddle_x: this.paddle.x,
      paddle_y: this.paddle.y,
      paddle_width: this.paddle.width,
      balls: this.balls.map(b => ({
        id: b.id,
        x: b.x,
        y: b.y,
        vx: b.vx,
        vy: b.vy,
        stuck: b.stuck,
        stuck_to_paddle: b.stuckToPaddle
      })),
      drops: this.drops.map(d => ({
        x: d.x,
        y: d.y,
        type: d.type
      })),
      power: this.power,
      power_seconds: this.powerSeconds,
      bricks: this.bricks.map(b => ({
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        type: b.type,
        drop: b.drop,
        health: b.health,
        damaged: b.damaged
      })),
      state: this.state,
      simulation_time: this.simulationTime
    };
  }

  update(dt) {
    if (this.state === STATES.PAUSED || this.state === STATES.READY) {
      return;
    }

    this.accumulator += dt;
    this.events = [];

    while (this.accumulator >= PHYSICS_STEP) {
      this.simulationStep();
      this.accumulator -= PHYSICS_STEP;
      this.simulationTime += PHYSICS_STEP;
    }
  }

  simulationStep() {
    // Update power-up timer
    if (this.power) {
      this.powerSeconds -= PHYSICS_STEP;
      if (this.powerSeconds <= 0) {
        this.endPowerUp();
      }
    }

    // Update drops
    this.updateDrops();

    // Update balls
    this.updateBalls();

    // Check for level completion
    const breakableBricks = this.bricks.filter(b => b.isBreakable() && b.health > 0);
    if (breakableBricks.length === 0) {
      this.completeLevel();
    }

    // Check for game over
    if (this.balls.length === 0 && this.lives === 0) {
      this.gameOver();
    }
  }

  updateBalls() {
    const ballsCopy = [...this.balls];
    
    for (let i = 0; i < ballsCopy.length; i++) {
      const ball = ballsCopy[i];
      
      if (ball.stuck) {
        // Stuck ball follows paddle
        ball.x = this.paddle.x + this.paddle.width / 2;
        ball.y = this.paddle.y - ball.radius;
        continue;
      }

      // Move ball
      const newX = ball.x + ball.vx * PHYSICS_STEP;
      const newY = ball.y + ball.vy * PHYSICS_STEP;

      // Check collisions with bricks
      let hitBrick = null;
      for (let j = 0; j < this.bricks.length; j++) {
        const brick = this.bricks[j];
        const collision = sweepCircleRect(
          new Vector2(ball.x, ball.y),
          new Vector2(ball.vx, ball.vy),
          ball.radius,
          brick.x,
          brick.y,
          brick.width,
          brick.height,
          PHYSICS_STEP
        );

        if (collision) {
          hitBrick = { brick, collision, index: j };
          break;
        }
      }

      if (hitBrick) {
        const { brick, collision } = hitBrick;
        ball.x = collision.point.x;
        ball.y = collision.point.y;
        ball.vx = reflectVelocity(new Vector2(ball.vx, ball.vy), collision.normal, collision.face).x;
        ball.vy = reflectVelocity(new Vector2(ball.vx, ball.vy), collision.normal, collision.face).y;
        ball.vx = clampSpeed(new Vector2(ball.vx, ball.vy), this.speedCap).x;
        ball.vy = clampSpeed(new Vector2(ball.vx, ball.vy), this.speedCap).y;

        // Damage brick
        if (brick.isBreakable() && hitBrick.index !== this.lastBrickHitId) {
          this.lastBrickHitId = hitBrick.index;
          
          if (brick.type === 'normal') {
            this.score += 100 * this.combo;
            this.events.push({ type: 'brick-hit', points: 100 * this.combo, combo: this.combo });
            brick.health = 0;
            
            // Check for drop
            if (brick.drop) {
              this.drops.push(new Drop(brick.x + brick.width / 2, brick.y + brick.height, brick.drop));
            }
          } else if (brick.type === 'strong') {
            if (!brick.damaged) {
              this.score += 75 * this.combo;
              this.events.push({ type: 'brick-hit', points: 75 * this.combo, combo: this.combo });
              brick.damaged = true;
            } else {
              this.score += 250 * this.combo;
              this.events.push({ type: 'brick-hit', points: 250 * this.combo, combo: this.combo });
              brick.health = 0;
              
              // Check for drop
              if (brick.drop) {
                this.drops.push(new Drop(brick.x + brick.width / 2, brick.y + brick.height, brick.drop));
              }
            }
          }

          this.combo = Math.min(this.combo + 1, 5);
          
          // Check for extra life
          if (this.score >= this.nextExtraLife) {
            this.lives++;
            this.events.push({ type: 'extra-life', lives: this.lives });
            this.nextExtraLife += this.constants.extra_life_step;
          }
        }
      } else {
        // Check paddle collision
        const paddleCollision = sweepCircleRect(
          new Vector2(ball.x, ball.y),
          new Vector2(ball.vx, ball.vy),
          ball.radius,
          this.paddle.x,
          this.paddle.y,
          this.paddle.width,
          this.paddle.height,
          PHYSICS_STEP
        );

        if (paddleCollision) {
          ball.x = paddleCollision.point.x;
          ball.y = paddleCollision.point.y;
          
          // Steering based on paddle position
          const paddleCenter = this.paddle.x + this.paddle.width / 2;
          const hitOffset = (ball.x - paddleCenter) / (this.paddle.width / 2);
          const steerAngle = hitOffset * Math.PI / 6; // ±30 degrees
          
          const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
          ball.vx = Math.sin(steerAngle) * speed + this.paddle.vx * 0.3;
          ball.vy = -Math.cos(steerAngle) * speed;
          
          ball.vx = clampSpeed(new Vector2(ball.vx, ball.vy), this.speedCap).x;
          ball.vy = clampSpeed(new Vector2(ball.vx, ball.vy), this.speedCap).y;
          
          this.combo = 1;
          this.events.push({ type: 'paddle-hit' });
          
          if (ball.stuck) {
            ball.stuck = false;
            ball.stuckToPaddle = false;
          }
        } else {
          ball.x = newX;
          ball.y = newY;
        }
      }

      // Check if ball is out of bounds
      if (ball.y > CANVAS_HEIGHT) {
        this.balls = this.balls.filter(b => b.id !== ball.id);
        
        if (this.balls.length === 0) {
          this.loseLife();
        }
      }
    }
  }

  updateDrops() {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      drop.y += drop.vy * PHYSICS_STEP;

      // Check paddle collision
      if (drop.y + drop.radius > this.paddle.y &&
          drop.y - drop.radius < this.paddle.y + this.paddle.height &&
          drop.x + drop.radius > this.paddle.x &&
          drop.x - drop.radius < this.paddle.x + this.paddle.width) {
        
        this.collectPowerUp(drop.type);
        this.drops.splice(i, 1);
        this.events.push({ type: 'power-collected', power: drop.type });
      } else if (drop.y > CANVAS_HEIGHT) {
        this.drops.splice(i, 1);
      }
    }
  }

  collectPowerUp(type) {
    if (this.power === type) {
      // Reset timer
      this.powerSeconds = this.constants.powerup_duration_seconds;
    } else {
      // Replace power
      if (this.power) {
        this.endPowerUp();
      }
      
      this.power = type;
      this.powerSeconds = this.constants.powerup_duration_seconds;
      
      if (type === 'wide') {
        this.paddle.width = this.paddle.baseWidth * 1.5;
      } else if (type === 'slow') {
        const speed = Math.sqrt(this.balls[0].vx ** 2 + this.balls[0].vy ** 2);
        const newSpeed = speed * 0.7;
        const factor = newSpeed / speed;
        this.balls.forEach(b => {
          b.vx *= factor;
          b.vy *= factor;
        });
      } else if (type === 'multiball') {
        if (this.balls.length === 1) {
          const primary = this.balls[0];
          const secondary = new Ball(primary.x, primary.y, primary.vx, primary.vy, BALL_RADIUS, 'secondary');
          this.balls.push(secondary);
        }
      } else if (type === 'sticky') {
        if (this.balls.length > 0) {
          this.balls[0].stuck = true;
          this.balls[0].stuckToPaddle = true;
        }
      }
    }
  }

  endPowerUp() {
    if (this.power === 'wide') {
      this.paddle.width = this.paddle.baseWidth;
    } else if (this.power === 'slow') {
      // Restore speed to level cap
      this.balls.forEach(b => {
        const speed = Math.sqrt(b.vx ** 2 + b.vy ** 2);
        if (speed > 0) {
          const factor = Math.min(this.speedCap, speed) / speed;
          b.vx *= factor;
          b.vy *= factor;
        }
      });
    } else if (this.power === 'multiball') {
      // Keep only primary ball
      this.balls = this.balls.filter(b => b.id === 'primary');
    } else if (this.power === 'sticky') {
      // Release stuck ball
      if (this.balls.length > 0 && this.balls[0].stuck) {
        this.balls[0].stuck = false;
        this.balls[0].stuckToPaddle = false;
      }
    }
    
    this.power = null;
    this.powerSeconds = 0;
  }

  loseLife() {
    this.lives--;
    this.drops = [];
    this.endPowerUp();
    
    if (this.lives > 0) {
      this.state = STATES.LIFE_LOST;
      this.events.push({ type: 'life-lost', lives: this.lives });
    } else {
      this.gameOver();
    }
  }

  completeLevel() {
    this.score += 1000 * this.level;
    this.state = STATES.LEVEL_COMPLETE;
    this.events.push({ type: 'level-complete', bonus: 1000 * this.level });
  }

  gameOver() {
    this.state = STATES.GAME_OVER;
    this.events.push({ type: 'game-over' });
  }

  launch() {
    if (this.state === STATES.READY) {
      this.state = STATES.PLAYING;
      this.balls.forEach(b => {
        if (b.stuck) {
          b.stuck = false;
          b.stuckToPaddle = false;
        }
      });
    }
  }

  pause() {
    if (this.state === STATES.PLAYING) {
      this.state = STATES.PAUSED;
    } else if (this.state === STATES.PAUSED) {
      this.state = STATES.PLAYING;
    }
  }

  movePaddle(x) {
    const newX = Math.max(0, Math.min(x, CANVAS_WIDTH - this.paddle.width));
    this.paddle.vx = (newX - this.paddle.x) / PHYSICS_STEP;
    this.paddle.x = newX;
  }

  clone() {
    const gs = new GameState(this.level, this.baseSpeed, this.speedCap, [], this.constants);
    gs.score = this.score;
    gs.lives = this.lives;
    gs.combo = this.combo;
    gs.nextExtraLife = this.nextExtraLife;
    gs.paddle = this.paddle.clone();
    gs.balls = this.balls.map(b => b.clone());
    gs.drops = this.drops.map(d => d.clone());
    gs.power = this.power;
    gs.powerSeconds = this.powerSeconds;
    gs.bricks = this.bricks.map(b => b.clone());
    gs.state = this.state;
    gs.simulationTime = this.simulationTime;
    gs.accumulator = this.accumulator;
    gs.events = [...this.events];
    gs.lastBrickHitId = this.lastBrickHitId;
    gs.assistPaddleActive = this.assistPaddleActive;
    return gs;
  }
}

module.exports = {
  GameState,
  STATES,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BRICK_WIDTH,
  BRICK_HEIGHT,
  BRICK_PADDING,
  PADDLE_HEIGHT,
  BALL_RADIUS
};
