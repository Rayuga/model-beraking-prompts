// /app/physics.js - Deterministic 2D Physics Engine for Brickfall

const CONSTANTS = {
  CANVAS_WIDTH: 900,
  CANVAS_HEIGHT: 600,
  PADDLE_WIDTH: 118,
  PADDLE_HEIGHT: 18,
  BALL_RADIUS: 9,
  PHYSICS_STEP_HZ: 120,
  DT: 1 / 120,
  INITIAL_LIVES: 3,
  EXTRA_LIFE_STEP: 20000,
  POWERUP_DURATION: 20,
  DROP_WIDTH: 36,
  DROP_HEIGHT: 16,
  DROP_SPEED: 150,
  BRICK_WIDTH: 76,
  BRICK_HEIGHT: 22,
  BRICK_GAP_X: 8,
  BRICK_GAP_Y: 8,
  BRICK_MARGIN_LEFT: 34,
  BRICK_MARGIN_TOP: 70,
  PADDLE_Y: 540,
  MIN_BOUNCE_ANGLE: 0.25, // minimum vertical component fraction
};

function getBrickRect(row, column) {
  const x = CONSTANTS.BRICK_MARGIN_LEFT + (column - 1) * (CONSTANTS.BRICK_WIDTH + CONSTANTS.BRICK_GAP_X);
  const y = CONSTANTS.BRICK_MARGIN_TOP + (row - 1) * (CONSTANTS.BRICK_HEIGHT + CONSTANTS.BRICK_GAP_Y);
  return { x, y, width: CONSTANTS.BRICK_WIDTH, height: CONSTANTS.BRICK_HEIGHT };
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function normalizeSpeed(vx, vy, targetSpeed) {
  const currentSpeed = Math.sqrt(vx * vx + vy * vy);
  if (currentSpeed === 0) return { vx: 0, vy: -targetSpeed };
  const scale = targetSpeed / currentSpeed;
  return { vx: vx * scale, vy: vy * scale };
}

function ensureUsefulComponents(vx, vy, minSpeed, maxSpeed) {
  let speed = Math.sqrt(vx * vx + vy * vy);
  if (speed < minSpeed) speed = minSpeed;
  if (speed > maxSpeed) speed = maxSpeed;

  let angle = Math.atan2(vy, vx);
  // Avoid nearly horizontal trajectories (|vy| too small)
  const minAngle = 0.26; // ~15 degrees
  // Avoid nearly vertical trajectories (|vx| too small)
  const maxAngle = Math.PI / 2 - 0.15; // ~81 degrees

  let absAngle = Math.abs(angle);
  let signX = vx >= 0 ? 1 : -1;
  let signY = vy >= 0 ? 1 : -1;

  let normAngle = Math.abs(Math.atan2(Math.abs(vy), Math.abs(vx)));
  if (normAngle < minAngle) {
    normAngle = minAngle;
  } else if (normAngle > maxAngle) {
    normAngle = maxAngle;
  }

  const nvx = signX * speed * Math.cos(normAngle);
  const nvy = signY * speed * Math.sin(normAngle);
  return { vx: nvx, vy: nvy };
}

// Circle to AABB swept/continuous collision
function circleAABBOverlap(cx, cy, r, rx, ry, rw, rh) {
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;
  if (distSq < r * r) {
    return {
      hit: true,
      overlap: r - Math.sqrt(distSq || 0.0001),
      dx,
      dy,
      closestX,
      closestY,
      distSq
    };
  }
  return { hit: false };
}

function getWholeSeconds(powerSeconds) {
  if (!powerSeconds || powerSeconds <= 0) return 0;
  return Math.ceil(Math.round(powerSeconds * 1000) / 1000);
}

class GameEngine {
  constructor(state = {}) {
    this.reset(state);
  }

  reset(state = {}) {
    this.status = state.status || 'paused'; // 'menu'|'ready'|'playing'|'paused'|'life-lost'|'level-complete'|'game-over'|'completed'
    this.level = state.level || 1;
    this.score = state.score || 0;
    this.lives = state.lives !== undefined ? state.lives : CONSTANTS.INITIAL_LIVES;
    this.combo = state.combo || 1;
    this.nextExtraLife = state.next_extra_life || state.nextExtraLife || CONSTANTS.EXTRA_LIFE_STEP;
    this.paddle = Object.assign({
      x: (CONSTANTS.CANVAS_WIDTH - CONSTANTS.PADDLE_WIDTH) / 2,
      y: CONSTANTS.PADDLE_Y,
      width: CONSTANTS.PADDLE_WIDTH,
      height: CONSTANTS.PADDLE_HEIGHT,
      vx: 0,
    }, state.paddle || {});
    if (state.paddle_width) {
      this.paddle.width = state.paddle_width;
    }

    this.power = state.power || null; // null | 'wide' | 'slow' | 'multiball' | 'sticky'
    this.powerSeconds = state.power_seconds !== undefined ? state.power_seconds : (state.powerSeconds || 0);

    this.balls = (state.balls || []).map((b, idx) => ({
      id: b.id || (idx === 0 ? 'primary' : `secondary_${idx}`),
      isPrimary: b.isPrimary !== undefined ? b.isPrimary : (idx === 0),
      x: b.x,
      y: b.y,
      vx: b.vx,
      vy: b.vy,
      radius: b.radius || CONSTANTS.BALL_RADIUS,
      held: !!b.held,
      heldOffset: b.heldOffset !== undefined ? b.heldOffset : 0,
      lost: !!b.lost
    }));

    this.drops = (state.drops || []).map((d, idx) => ({
      id: d.id || `drop_${idx}`,
      type: d.type,
      x: d.x,
      y: d.y,
      vx: d.vx || 0,
      vy: d.vy || CONSTANTS.DROP_SPEED,
      width: d.width || CONSTANTS.DROP_WIDTH,
      height: d.height || CONSTANTS.DROP_HEIGHT
    }));

    this.bricks = (state.bricks || []).map(br => ({
      id: br.id || `${br.row}_${br.column}`,
      row: br.row,
      column: br.column,
      type: br.type, // 'normal' | 'strong' | 'solid'
      hp: br.hp !== undefined ? br.hp : (br.type === 'strong' ? 2 : (br.type === 'normal' ? 1 : Infinity)),
      drop: br.drop || '',
      x: br.x !== undefined ? br.x : getBrickRect(br.row, br.column).x,
      y: br.y !== undefined ? br.y : getBrickRect(br.row, br.column).y,
      width: br.width !== undefined ? br.width : CONSTANTS.BRICK_WIDTH,
      height: br.height !== undefined ? br.height : CONSTANTS.BRICK_HEIGHT
    }));

    this.baseSpeed = state.baseSpeed || 300;
    this.speedCap = state.speedCap || 520;
    this.events = state.events ? [...state.events] : [];
    this.stepCount = state.stepCount || 0;
    this.clampSpeedImmediately = state.clampSpeedImmediately !== undefined ? state.clampSpeedImmediately : true;
    this.isMechanicsLab = !!state.isMechanicsLab;
  }

  logEvent(msg) {
    this.events.unshift({ text: msg, time: Date.now() });
    if (this.events.length > 50) this.events.pop();
  }

  applyPowerup(type) {
    if (this.power === type) {
      // Recollecting same type resets timer; does not stack or repeat immediate spawn
      this.powerSeconds = CONSTANTS.POWERUP_DURATION;
      this.logEvent(`Power-up renewed: ${type} (20s)`);
      return;
    }

    // Collecting a different type first removes old effect
    this.clearPowerup();

    this.power = type;
    this.powerSeconds = CONSTANTS.POWERUP_DURATION;

    if (type === 'wide') {
      this.paddle.width = Math.round(CONSTANTS.PADDLE_WIDTH * 1.5); // 177
      this.logEvent('Power-up: WIDE paddle (20s)');
    } else if (type === 'slow') {
      for (const ball of this.balls) {
        if (!ball.held && !ball.lost) {
          ball.vx *= 0.7;
          ball.vy *= 0.7;
        }
      }
      this.logEvent('Power-up: SLOW motion (20s)');
    } else if (type === 'multiball') {
      const activeBalls = this.balls.filter(b => !b.lost);
      if (activeBalls.length === 1) {
        const prim = activeBalls[0];
        this.balls.push({
          id: `secondary_${Date.now()}`,
          isPrimary: false,
          x: prim.x,
          y: prim.y,
          vx: -prim.vx,
          vy: prim.vy,
          radius: CONSTANTS.BALL_RADIUS,
          held: false,
          heldOffset: 0,
          lost: false
        });
      }
      this.logEvent('Power-up: MULTIBALL (20s)');
    } else if (type === 'sticky') {
      this.logEvent('Power-up: STICKY paddle (20s)');
    }
  }

  clearPowerup() {
    if (!this.power) return;
    const oldPower = this.power;
    this.power = null;
    this.powerSeconds = 0;

    if (oldPower === 'wide') {
      this.paddle.width = CONSTANTS.PADDLE_WIDTH;
    } else if (oldPower === 'slow') {
      for (const ball of this.balls) {
        if (!ball.held && !ball.lost) {
          ball.vx /= 0.7;
          ball.vy /= 0.7;
          const capped = ensureUsefulComponents(ball.vx, ball.vy, this.baseSpeed, this.speedCap);
          ball.vx = capped.vx;
          ball.vy = capped.vy;
        }
      }
    } else if (oldPower === 'multiball') {
      // Replacement or expiry keeps only designated primary ball
      this.balls = this.balls.filter(b => b.isPrimary);
    } else if (oldPower === 'sticky') {
      // Expiry releases a held ball automatically
      for (const ball of this.balls) {
        if (ball.held) {
          this.launchBall(ball);
        }
      }
    }
  }

  launchBall(targetBall = null) {
    const ballsToLaunch = targetBall ? [targetBall] : this.balls.filter(b => b.held);
    for (const ball of ballsToLaunch) {
      if (ball.held) {
        ball.held = false;
        const speed = this.power === 'slow' ? this.baseSpeed * 0.7 : this.baseSpeed;
        const angle = -Math.PI / 2 + (ball.heldOffset / (this.paddle.width / 2)) * (Math.PI / 4);
        ball.vx = speed * Math.sin(angle);
        ball.vy = -Math.abs(speed * Math.cos(angle));
        const capped = ensureUsefulComponents(ball.vx, ball.vy, speed, this.speedCap);
        ball.vx = capped.vx;
        ball.vy = capped.vy;
        this.logEvent('Ball launched');
      }
    }
    if (this.status === 'ready' || this.status === 'life-lost') {
      this.status = 'playing';
    }
  }

  // Single fixed physics step (dt = 1/120s)
  step(dt = CONSTANTS.DT) {
    this.stepCount++;

    // 1. Advance power-up timer
    if (this.power && this.powerSeconds > 0) {
      this.powerSeconds = Math.max(0, this.powerSeconds - dt);
      if (this.powerSeconds <= 0.000001) {
        this.powerSeconds = 0;
        this.clearPowerup();
      }
    }

    // 2. Paddle position bounds
    this.paddle.x = clamp(this.paddle.x, 0, CONSTANTS.CANVAS_WIDTH - this.paddle.width);

    // 3. Move drops & drop collision with paddle
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      drop.y += drop.vy * dt;
      drop.x += (drop.vx || 0) * dt;

      // Check paddle collection
      if (
        drop.x + drop.width >= this.paddle.x &&
        drop.x <= this.paddle.x + this.paddle.width &&
        drop.y + drop.height >= this.paddle.y &&
        drop.y <= this.paddle.y + this.paddle.height
      ) {
        this.applyPowerup(drop.type);
        this.drops.splice(i, 1);
        continue;
      }

      // Check floor (missed)
      if (drop.y > CONSTANTS.CANVAS_HEIGHT) {
        this.drops.splice(i, 1);
      }
    }

    // Track damaged bricks this step (at most once per physics step per brick)
    const damagedBrickIds = new Set();

    // 4. Update balls
    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];
      if (ball.lost) continue;

      if (ball.held) {
        ball.x = this.paddle.x + this.paddle.width / 2 + ball.heldOffset;
        ball.y = this.paddle.y - ball.radius;
        continue;
      }

      // Sub-stepping for swept collision
      const subSteps = 4;
      const subDt = dt / subSteps;

      for (let s = 0; s < subSteps; s++) {
        ball.x += ball.vx * subDt;
        ball.y += ball.vy * subDt;

        // Wall collisions (left, right, top)
        if (ball.x - ball.radius <= 0) {
          ball.x = ball.radius;
          ball.vx = Math.abs(ball.vx);
        } else if (ball.x + ball.radius >= CONSTANTS.CANVAS_WIDTH) {
          ball.x = CONSTANTS.CANVAS_WIDTH - ball.radius;
          ball.vx = -Math.abs(ball.vx);
        }
        if (ball.y - ball.radius <= 0) {
          ball.y = ball.radius;
          ball.vy = Math.abs(ball.vy);
        }

        // Brick collisions
        for (const brick of this.bricks) {
          if (brick.hp <= 0) continue;

          const overlap = circleAABBOverlap(
            ball.x, ball.y, ball.radius,
            brick.x, brick.y, brick.width, brick.height
          );

          if (overlap.hit) {
            // Reflect ball
            const dx = overlap.dx;
            const dy = overlap.dy;

            // Determine collision normal
            let nx = 0, ny = 0;
            if (Math.abs(dx) > 0 && Math.abs(dy) === 0) {
              nx = Math.sign(dx);
              ny = 0;
            } else if (Math.abs(dx) === 0 && Math.abs(dy) > 0) {
              nx = 0;
              ny = Math.sign(dy);
            } else if (Math.abs(dx) > 0 && Math.abs(dy) > 0) {
              // Corner hit
              const len = Math.sqrt(dx * dx + dy * dy);
              nx = dx / len;
              ny = dy / len;
            } else {
              // Deep inside
              ny = -Math.sign(ball.vy || 1);
            }

            // Reflect velocity vector
            const dot = ball.vx * nx + ball.vy * ny;
            if (dot < 0) {
              ball.vx = ball.vx - 2 * dot * nx;
              ball.vy = ball.vy - 2 * dot * ny;
            }

            // Push ball out of brick
            ball.x = overlap.closestX + nx * ball.radius;
            ball.y = overlap.closestY + ny * ball.radius;

            // Damage brick once per physics step
            if (!damagedBrickIds.has(brick.id)) {
              damagedBrickIds.add(brick.id);
              if (brick.type !== 'solid') {
                const wasIntact = brick.type === 'strong' && brick.hp === 2;
                brick.hp--;
                const isDestroyed = brick.hp <= 0;

                let basePts = 0;
                if (brick.type === 'normal') {
                  basePts = 100;
                } else if (brick.type === 'strong') {
                  basePts = wasIntact ? 75 : 250;
                }

                const award = basePts * this.combo;
                this.score += award;
                this.logEvent(`+${award} at x${this.combo}`);

                // Check extra life threshold
                while (this.score >= this.nextExtraLife) {
                  this.lives++;
                  this.logEvent(`Extra life awarded! (${this.score} >= ${this.nextExtraLife})`);
                  this.nextExtraLife += CONSTANTS.EXTRA_LIFE_STEP;
                }

                // Increment combo up to x5
                if (this.combo < 5) {
                  this.combo++;
                }

                // Spawn drop if destroyed
                if (isDestroyed && brick.drop) {
                  this.drops.push({
                    id: `drop_${Date.now()}_${brick.id}`,
                    type: brick.drop,
                    x: brick.x + brick.width / 2 - CONSTANTS.DROP_WIDTH / 2,
                    y: brick.y + brick.height / 2 - CONSTANTS.DROP_HEIGHT / 2,
                    vx: 0,
                    vy: CONSTANTS.DROP_SPEED,
                    width: CONSTANTS.DROP_WIDTH,
                    height: CONSTANTS.DROP_HEIGHT
                  });
                }
              } else {
                this.logEvent('Solid brick deflection');
              }
            }
          }
        }

        // Paddle collision
        const paddleOverlap = circleAABBOverlap(
          ball.x, ball.y, ball.radius,
          this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height
        );

        if (paddleOverlap.hit && ball.vy > 0) {
          // Reset combo to x1 on paddle contact
          this.combo = 1;
          this.logEvent('Paddle contact (combo reset to x1)');

          if (this.power === 'sticky') {
            ball.held = true;
            ball.heldOffset = ball.x - (this.paddle.x + this.paddle.width / 2);
            ball.y = this.paddle.y - ball.radius;
            ball.vx = 0;
            ball.vy = 0;
            break; // Stop sub-steps for this ball
          } else {
            // Paddle steering
            const paddleCenter = this.paddle.x + this.paddle.width / 2;
            const hitOffset = (ball.x - paddleCenter) / (this.paddle.width / 2);
            const clampedOffset = clamp(hitOffset, -1, 1);

            let currentSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            const maxSpd = this.speedCap;
            const minSpd = this.power === 'slow' ? this.baseSpeed * 0.7 : this.baseSpeed;
            currentSpeed = clamp(currentSpeed, minSpd, maxSpd);

            // Steer angle: -65 deg to +65 deg from vertical up (-PI/2)
            const steerAngle = -Math.PI / 2 + clampedOffset * (Math.PI / 2.8);
            let newVx = currentSpeed * Math.cos(steerAngle);
            let newVy = currentSpeed * Math.sin(steerAngle);

            // Paddle motion push
            if (this.paddle.vx) {
              newVx += this.paddle.vx * 0.15;
            }

            const adjusted = ensureUsefulComponents(newVx, newVy, minSpd, maxSpd);
            ball.vx = adjusted.vx;
            ball.vy = adjusted.vy;
            ball.y = this.paddle.y - ball.radius;
          }
        }
      }

      // Speed cap enforcement at end of step
      if (this.clampSpeedImmediately) {
        const curSpd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        const maxSpd = this.speedCap;
        const minSpd = this.power === 'slow' ? this.baseSpeed * 0.7 : this.baseSpeed;
        if (curSpd > maxSpd || curSpd < minSpd) {
          const adj = ensureUsefulComponents(ball.vx, ball.vy, minSpd, maxSpd);
          ball.vx = adj.vx;
          ball.vy = adj.vy;
        }
      }

      // Floor check (ball lost)
      if (ball.y - ball.radius > CONSTANTS.CANVAS_HEIGHT) {
        ball.lost = true;
      }
    }

    // 5. Check remaining balls
    const activeBalls = this.balls.filter(b => !b.lost);

    if (activeBalls.length === 0) {
      // Last ball lost!
      this.logEvent('Last ball lost');
      this.lives--;
      this.clearPowerup();
      this.drops = [];

      if (this.lives <= 0) {
        this.status = 'game-over';
        this.logEvent('Game Over');
      } else {
        this.status = 'life-lost';
        // Prepare held serve ball
        this.balls = [{
          id: 'primary',
          isPrimary: true,
          x: this.paddle.x + this.paddle.width / 2,
          y: this.paddle.y - CONSTANTS.BALL_RADIUS,
          vx: 0,
          vy: 0,
          radius: CONSTANTS.BALL_RADIUS,
          held: true,
          heldOffset: 0,
          lost: false
        }];
        this.combo = 1;
      }
      return;
    }

    // Multiball cleanup: if secondary ball was lost, primary continues
    this.balls = activeBalls;

    // 6. Check level completion
    if (this.bricks.length > 0) {
      const breakableRemaining = this.bricks.filter(b => b.type !== 'solid' && b.hp > 0).length;
      if (breakableRemaining === 0 && (this.status === 'playing' || this.status === 'paused' || this.status === 'ready')) {
        const bonus = 1000 * this.level;
        this.score += bonus;
        this.logEvent(`Level ${this.level} complete! Bonus +${bonus}`);

        // Check extra life threshold for bonus
        while (this.score >= this.nextExtraLife) {
          this.lives++;
          this.logEvent(`Extra life awarded! (${this.score} >= ${this.nextExtraLife})`);
          this.nextExtraLife += CONSTANTS.EXTRA_LIFE_STEP;
        }

        if (this.level >= 10) {
          this.status = 'completed';
          this.logEvent('All levels completed! Victory!');
        } else {
          this.status = 'level-complete';
        }
      }
    }
  }

  // Advance simulation by up to maxSteps (default 120 = 1 sec)
  // Stops early if status transitions to terminal/outcome state (life-lost, level-complete, game-over, completed)
  advanceSteps(maxSteps = 120, stopOnOutcome = true) {
    const initialStatus = this.status;
    let stepsExecuted = 0;

    for (let i = 0; i < maxSteps; i++) {
      stepsExecuted++;
      this.step(CONSTANTS.DT);

      if (stopOnOutcome && this.status !== initialStatus && this.status !== 'playing') {
        break;
      }
    }

    // Return to paused if still in active state
    if (this.status === 'playing') {
      this.status = 'paused';
    }

    return stepsExecuted;
  }

  getSnapshot() {
    return {
      status: this.status,
      level: this.level,
      score: this.score,
      lives: this.lives,
      combo: this.combo,
      next_extra_life: this.nextExtraLife,
      paddle: {
        x: this.paddle.x,
        y: this.paddle.y,
        width: this.paddle.width,
        height: this.paddle.height,
        vx: this.paddle.vx
      },
      power: this.power,
      power_seconds: Math.round(this.powerSeconds * 100) / 100,
      balls: this.balls.map(b => ({
        id: b.id,
        isPrimary: b.isPrimary,
        x: Math.round(b.x * 10) / 10,
        y: Math.round(b.y * 10) / 10,
        vx: Math.round(b.vx * 10) / 10,
        vy: Math.round(b.vy * 10) / 10,
        radius: b.radius,
        held: b.held,
        heldOffset: Math.round(b.heldOffset * 10) / 10,
        lost: b.lost
      })),
      drops: this.drops.map(d => ({
        id: d.id,
        type: d.type,
        x: Math.round(d.x * 10) / 10,
        y: Math.round(d.y * 10) / 10,
        vx: Math.round(d.vx * 10) / 10,
        vy: Math.round(d.vy * 10) / 10,
        width: d.width,
        height: d.height
      })),
      bricks: this.bricks.map(br => ({
        id: br.id,
        row: br.row,
        column: br.column,
        type: br.type,
        hp: br.hp,
        drop: br.drop
      })),
      baseSpeed: this.baseSpeed,
      speedCap: this.speedCap,
      stepCount: this.stepCount
    };
  }
}

if (typeof window !== 'undefined') {
  window.CONSTANTS = CONSTANTS;
  window.getBrickRect = getBrickRect;
  window.GameEngine = GameEngine;
  window.clamp = clamp;
  window.normalizeSpeed = normalizeSpeed;
  window.ensureUsefulComponents = ensureUsefulComponents;
  window.getWholeSeconds = getWholeSeconds;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CONSTANTS,
    getBrickRect,
    GameEngine,
    clamp,
    normalizeSpeed,
    ensureUsefulComponents,
    getWholeSeconds
  };
}
