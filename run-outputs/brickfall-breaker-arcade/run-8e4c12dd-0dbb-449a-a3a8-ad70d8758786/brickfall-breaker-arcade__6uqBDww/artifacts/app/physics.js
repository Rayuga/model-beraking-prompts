// Physics engine with fixed timestep and swept collision detection

const PHYSICS_STEP = 1 / 120; // Fixed timestep in seconds
const BALL_RADIUS = 6;
const MIN_BALL_SPEED = 100;
const PADDLE_HEIGHT = 15;
const PADDLE_BOTTOM = 720;
const GAME_WIDTH = 800;
const GAME_HEIGHT = 800;

// Swept circle collision detection
function sweptCircleVsRect(ball, rect, dt) {
  const { x: bx, y: by, vx, vy } = ball;
  const { x: rx, y: ry, w, h } = rect;
  
  // Project ball position at next frame
  const nextX = bx + vx * dt;
  const nextY = by + vy * dt;
  
  // Find closest point on rect to ball's swept path
  const closestX = Math.max(rx, Math.min(nextX, rx + w));
  const closestY = Math.max(ry, Math.min(nextY, ry + h));
  
  // Check if swept circle intersects
  const dx = bx - closestX;
  const dy = by - closestY;
  const distSq = dx * dx + dy * dy;
  
  if (distSq < BALL_RADIUS * BALL_RADIUS) {
    // Collision detected
    // Find exact collision point by binary search
    let t = 0, dt_test = dt;
    for (let i = 0; i < 4; i++) {
      const testX = bx + vx * t;
      const testY = by + vy * t;
      const cx = Math.max(rx, Math.min(testX, rx + w));
      const cy = Math.max(ry, Math.min(testY, ry + h));
      const dx2 = testX - cx;
      const dy2 = testY - cy;
      const dist = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      
      if (dist > BALL_RADIUS) {
        t += dt_test;
      } else {
        t -= dt_test;
      }
      dt_test *= 0.5;
    }
    
    // Normal to collision face
    let nx = 0, ny = 0;
    const collideX = bx + vx * t;
    const collideY = by + vy * t;
    
    const distLeft = Math.abs(collideX - rx);
    const distRight = Math.abs(collideX - (rx + w));
    const distTop = Math.abs(collideY - ry);
    const distBottom = Math.abs(collideY - (ry + h));
    
    const minDist = Math.min(distLeft, distRight, distTop, distBottom);
    
    if (minDist === distLeft) {
      nx = -1;
    } else if (minDist === distRight) {
      nx = 1;
    } else if (minDist === distTop) {
      ny = -1;
    } else {
      ny = 1;
    }
    
    return {
      collision: true,
      t: Math.min(t, dt),
      nx, ny,
      x: collideX,
      y: collideY
    };
  }
  
  return { collision: false };
}

// Reflect velocity off surface
function reflectVelocity(vx, vy, nx, ny) {
  const dot = vx * nx + vy * ny;
  return {
    vx: vx - 2 * dot * nx,
    vy: vy - 2 * dot * ny
  };
}

// Enforce minimum speed
function enforceMinimumSpeed(vx, vy, minSpeed) {
  const speed = Math.sqrt(vx * vx + vy * vy);
  if (speed < minSpeed && speed > 0) {
    const factor = minSpeed / speed;
    return { vx: vx * factor, vy: vy * factor };
  }
  return { vx, vy };
}

// Cap maximum speed
function capSpeed(vx, vy, cap) {
  const speed = Math.sqrt(vx * vx + vy * vy);
  if (speed > cap) {
    const factor = cap / speed;
    return { vx: vx * factor, vy: vy * factor };
  }
  return { vx, vy };
}

// Paddle steering based on impact position
function steerFromPaddle(ballX, paddleX, paddleWidth, baseVx, baseVy, recentMotion) {
  const paddleCenter = paddleX + paddleWidth / 2;
  const relPos = (ballX - paddleCenter) / (paddleWidth / 2);
  
  // Steer angle based on impact position
  const maxAngle = Math.PI / 6; // 30 degrees
  const angle = relPos * maxAngle;
  const speed = Math.sqrt(baseVx * baseVx + baseVy * baseVy);
  
  let vx = speed * Math.sin(angle);
  let vy = -Math.abs(baseVy); // Ensure upward
  
  // Add paddle motion influence
  vx += recentMotion * 0.3;
  
  return { vx, vy };
}

// Simulate one fixed physics step
function step(state, paddle, dt = PHYSICS_STEP) {
  const { balls, bricks, drops, combo, power, powerSeconds } = state;
  let { score, lives } = state;
  let newCombo = combo;
  let bricksDestroyed = 0;
  let powerChanged = false;
  let newPower = power;
  let newPowerSeconds = powerSeconds;
  const events = [];
  
  // Advance ball positions with collision detection
  const newBalls = [];
  let stepsRemaining = dt;
  let substep = 0;
  const maxSubsteps = 5;
  
  for (const ball of balls) {
    if (!ball || ball.lost) {
      if (ball) newBalls.push(ball);
      continue;
    }
    
    let currentBall = { ...ball };
    let timeLeft = dt;
    substep = 0;
    
    while (timeLeft > 1e-6 && substep < maxSubsteps) {
      substep++;
      const moveTime = Math.min(timeLeft, dt);
      
      // Check collisions with bricks
      let collided = false;
      for (let i = 0; i < bricks.length; i++) {
        const brick = bricks[i];
        if (brick.destroyed) continue;
        
        const brickRect = {
          x: brick.x,
          y: brick.y,
          w: brick.w,
          h: brick.h
        };
        
        const collision = sweptCircleVsRect(currentBall, brickRect, moveTime);
        
        if (collision.collision) {
          // Move ball to collision point
          currentBall.x += currentBall.vx * collision.t;
          currentBall.y += currentBall.vy * collision.t;
          timeLeft -= collision.t;
          
          // Reflect velocity
          let reflected = reflectVelocity(currentBall.vx, currentBall.vy, collision.nx, collision.ny);
          
          // Damage brick if not solid
          if (brick.type !== 'solid') {
            if (brick.type === 'normal') {
              bricks[i].destroyed = true;
              score += 100 * newCombo;
              events.push({ type: 'brick', score: 100 * newCombo, combo: newCombo });
              bricksDestroyed++;
              
              // Check for power-up
              if (brick.drop) {
                drops.push({
                  type: brick.drop,
                  x: brick.x + brick.w / 2,
                  y: brick.y + brick.h / 2,
                  vy: 100
                });
              }
              
              // Increase combo
              if (newCombo < 5) newCombo++;
            } else if (brick.type === 'strong') {
              if (!brick.damaged) {
                bricks[i].damaged = true;
                score += 75 * newCombo;
                events.push({ type: 'brick', score: 75 * newCombo, combo: newCombo });
                if (newCombo < 5) newCombo++;
              } else {
                bricks[i].destroyed = true;
                score += 250 * newCombo;
                events.push({ type: 'brick', score: 250 * newCombo, combo: newCombo });
                bricksDestroyed++;
                if (brick.drop) {
                  drops.push({
                    type: brick.drop,
                    x: brick.x + brick.w / 2,
                    y: brick.y + brick.h / 2,
                    vy: 100
                  });
                }
                if (newCombo < 5) newCombo++;
              }
            }
          } else {
            events.push({ type: 'solid-deflection' });
          }
          
          currentBall.vx = reflected.vx;
          currentBall.vy = reflected.vy;
          collided = true;
          break;
        }
      }
      
      if (!collided) {
        // Check paddle collision
        const paddleRect = {
          x: paddle.x,
          y: paddle.y - PADDLE_HEIGHT,
          w: paddle.width,
          h: PADDLE_HEIGHT
        };
        
        const paddleCollision = sweptCircleVsRect(currentBall, paddleRect, timeLeft);
        
        if (paddleCollision.collision) {
          currentBall.x += currentBall.vx * paddleCollision.t;
          currentBall.y += currentBall.vy * paddleCollision.t;
          timeLeft -= paddleCollision.t;
          
          // Steer from paddle impact
          const steered = steerFromPaddle(
            currentBall.x,
            paddle.x,
            paddle.width,
            currentBall.vx,
            currentBall.vy,
            paddle.recentMotion || 0
          );
          
          currentBall.vx = steered.vx;
          currentBall.vy = steered.vy;
          
          // Reset combo on paddle hit
          newCombo = 1;
          currentBall.stuck = false;
          
          events.push({ type: 'paddle-contact', combo: newCombo });
          collided = true;
        } else {
          // No collision - move freely
          currentBall.x += currentBall.vx * timeLeft;
          currentBall.y += currentBall.vy * timeLeft;
          timeLeft = 0;
        }
      } else {
        continue;
      }
    }
    
    // Apply speed constraints
    let speedCapped = capSpeed(currentBall.vx, currentBall.vy, 520); // Default cap, should be level-specific
    currentBall.vx = speedCapped.vx;
    currentBall.vy = speedCapped.vy;
    
    let minSpeedEnforced = enforceMinimumSpeed(currentBall.vx, currentBall.vy, MIN_BALL_SPEED);
    currentBall.vx = minSpeedEnforced.vx;
    currentBall.vy = minSpeedEnforced.vy;
    
    // Check if ball is lost
    if (currentBall.y > GAME_HEIGHT) {
      currentBall.lost = true;
      events.push({ type: 'ball-lost' });
    }
    
    newBalls.push(currentBall);
  }
  
  // Update power-up timer
  if (newPower && newPowerSeconds > 0) {
    newPowerSeconds -= dt;
    if (newPowerSeconds <= 0) {
      newPowerSeconds = 0;
      newPower = null;
      powerChanged = true;
      events.push({ type: 'power-expired' });
    }
  }
  
  // Process drops
  const newDrops = [];
  for (const drop of drops) {
    let dropY = drop.y + drop.vy * dt;
    
    // Check paddle collision
    if (dropY + 8 > paddle.y - PADDLE_HEIGHT &&
        dropY - 8 < paddle.y &&
        drop.x > paddle.x &&
        drop.x < paddle.x + paddle.width) {
      
      // Apply power-up
      if (drop.type === 'wide') {
        paddle.width = Math.min(177, paddle.width * 1.5);
      } else if (drop.type === 'slow') {
        for (let ball of newBalls) {
          ball.vx *= 0.7;
          ball.vy *= 0.7;
        }
      } else if (drop.type === 'multiball' && newBalls.length < 2) {
        // Create secondary ball
        const mainBall = newBalls.find(b => !b.lost);
        if (mainBall) {
          newBalls.push({
            x: mainBall.x - 20,
            y: mainBall.y - 20,
            vx: mainBall.vx * 0.8,
            vy: mainBall.vy * 0.8,
            lost: false,
            stuck: false
          });
        }
      } else if (drop.type === 'sticky') {
        const mainBall = newBalls.find(b => !b.lost);
        if (mainBall) {
          mainBall.stuck = true;
        }
      }
      
      // Reset or stack power-up
      if (newPower === drop.type) {
        newPowerSeconds = 20; // Reset timer, don't stack
      } else if (!newPower) {
        newPower = drop.type;
        newPowerSeconds = 20;
        powerChanged = true;
      }
      
      events.push({ type: 'power-collected', power: drop.type });
    } else if (dropY < GAME_HEIGHT) {
      newDrops.push({ ...drop, y: dropY });
    }
  }
  
  return {
    balls: newBalls,
    score,
    lives,
    combo: newCombo,
    bricks,
    drops: newDrops,
    power: newPower,
    powerSeconds: newPowerSeconds,
    events
  };
}

module.exports = {
  step,
  PHYSICS_STEP,
  BALL_RADIUS,
  MIN_BALL_SPEED,
  PADDLE_HEIGHT,
  PADDLE_BOTTOM,
  GAME_WIDTH,
  GAME_HEIGHT
};
