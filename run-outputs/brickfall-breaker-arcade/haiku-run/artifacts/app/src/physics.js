// Physics engine with fixed timestep and collision detection

const PHYSICS_STEP = 1 / 120; // 1/120 second per step
const MIN_VELOCITY = 50;
const EPSILON = 0.001;

class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  add(v) {
    return new Vector2(this.x + v.x, this.y + v.y);
  }

  subtract(v) {
    return new Vector2(this.x - v.x, this.y - v.y);
  }

  multiply(scalar) {
    return new Vector2(this.x * scalar, this.y * scalar);
  }

  dot(v) {
    return this.x * v.x + this.y * v.y;
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize() {
    const len = this.length();
    if (len === 0) return new Vector2(0, 0);
    return new Vector2(this.x / len, this.y / len);
  }

  clone() {
    return new Vector2(this.x, this.y);
  }
}

class Ball {
  constructor(x, y, vx, vy, radius = 9, id = 'primary') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
    this.id = id;
    this.stuck = false;
    this.stuckToPaddle = false;
  }

  clone() {
    const b = new Ball(this.x, this.y, this.vx, this.vy, this.radius, this.id);
    b.stuck = this.stuck;
    b.stuckToPaddle = this.stuckToPaddle;
    return b;
  }
}

class Brick {
  constructor(x, y, width, height, type = 'normal', drop = null) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.type = type; // 'normal', 'strong', 'solid'
    this.drop = drop; // 'wide', 'slow', 'multiball', 'sticky', null
    this.health = type === 'strong' ? 2 : (type === 'normal' ? 1 : 0);
    this.damaged = false; // For strong bricks
  }

  isBreakable() {
    return this.type !== 'solid';
  }

  clone() {
    const b = new Brick(this.x, this.y, this.width, this.height, this.type, this.drop);
    b.health = this.health;
    b.damaged = this.damaged;
    return b;
  }
}

class Paddle {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.baseWidth = width;
    this.vx = 0;
  }

  clone() {
    const p = new Paddle(this.x, this.y, this.width, this.height);
    p.baseWidth = this.baseWidth;
    p.vx = this.vx;
    return p;
  }
}

class Drop {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'wide', 'slow', 'multiball', 'sticky'
    this.vx = 0;
    this.vy = 150; // Falling speed
    this.radius = 8;
  }

  clone() {
    const d = new Drop(this.x, this.y, this.type);
    d.vx = this.vx;
    d.vy = this.vy;
    return d;
  }
}

// Swept circle collision detection
function sweepCircleRect(ballPos, ballVel, ballRadius, rectX, rectY, rectW, rectH, dt) {
  const nextPos = ballPos.add(ballVel.multiply(dt));
  
  // Find closest point on rect to ball's swept path
  const closestX = Math.max(rectX, Math.min(ballPos.x, rectX + rectW));
  const closestY = Math.max(rectY, Math.min(ballPos.y, rectY + rectH));
  
  const dx = ballPos.x - closestX;
  const dy = ballPos.y - closestY;
  const distSq = dx * dx + dy * dy;
  
  if (distSq > ballRadius * ballRadius) {
    return null; // No collision
  }

  // Find collision point more precisely
  const dist = Math.sqrt(distSq);
  if (dist < EPSILON) {
    // Ball center is inside rect, find exit point
    const centerX = rectX + rectW / 2;
    const centerY = rectY + rectH / 2;
    const dx2 = ballPos.x - centerX;
    const dy2 = ballPos.y - centerY;
    const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    
    if (dist2 < EPSILON) {
      // Ball at center, default to top collision
      return {
        point: new Vector2(ballPos.x, rectY),
        normal: new Vector2(0, -1),
        face: 'top'
      };
    }
    
    const norm = new Vector2(dx2 / dist2, dy2 / dist2);
    return {
      point: new Vector2(ballPos.x - norm.x * ballRadius, ballPos.y - norm.y * ballRadius),
      normal: norm,
      face: determineFace(ballPos, rectX, rectY, rectW, rectH)
    };
  }

  const normal = new Vector2(dx / dist, dy / dist);
  return {
    point: new Vector2(closestX + normal.x * ballRadius, closestY + normal.y * ballRadius),
    normal: normal,
    face: determineFace(new Vector2(closestX, closestY), rectX, rectY, rectW, rectH)
  };
}

function determineFace(point, rectX, rectY, rectW, rectH) {
  const centerX = rectX + rectW / 2;
  const centerY = rectY + rectH / 2;
  
  const dx = Math.abs(point.x - centerX);
  const dy = Math.abs(point.y - centerY);
  
  const halfW = rectW / 2;
  const halfH = rectH / 2;
  
  // Determine which face was hit
  if (dx / halfW > dy / halfH) {
    return point.x < centerX ? 'left' : 'right';
  } else {
    return point.y < centerY ? 'top' : 'bottom';
  }
}

function reflectVelocity(velocity, normal, face) {
  // Reflect velocity across normal
  const dot = velocity.dot(normal);
  const reflected = velocity.subtract(normal.multiply(2 * dot));
  
  // Ensure minimum velocity components
  let vx = reflected.x;
  let vy = reflected.y;
  
  if (Math.abs(vx) < MIN_VELOCITY && Math.abs(vy) > 0) {
    vx = Math.sign(vx) * MIN_VELOCITY;
  }
  if (Math.abs(vy) < MIN_VELOCITY && Math.abs(vx) > 0) {
    vy = Math.sign(vy) * MIN_VELOCITY;
  }
  
  return new Vector2(vx, vy);
}

function clampSpeed(velocity, speedCap) {
  const speed = velocity.length();
  if (speed > speedCap) {
    return velocity.normalize().multiply(speedCap);
  }
  return velocity;
}

module.exports = {
  Vector2,
  Ball,
  Brick,
  Paddle,
  Drop,
  PHYSICS_STEP,
  MIN_VELOCITY,
  sweepCircleRect,
  reflectVelocity,
  clampSpeed,
  determineFace
};
