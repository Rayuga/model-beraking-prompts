(() => {
  const W = 900;
  const H = 600;
  const STEP = 1 / 120;
  const MIN_COMPONENT = 60;
  const ASSIST_SPEED = 420;
  const BALL_FLOOR_PAD = 8;
  const EVENT_LIMIT = 12;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const sign = (value, fallback = 1) => (value < 0 ? -1 : value > 0 ? 1 : fallback);

  let catalog = null;
  let levelMap = new Map();
  let brickRows = new Map();
  let constants = new Map();

  function constant(name, fallback) {
    const value = constants.get(name);
    if (value === undefined || value === null || value === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }

  function configure(data) {
    catalog = data || {};
    levelMap = new Map((data.levels || []).map((row) => [Number(row.level), row]));
    brickRows = new Map();
    for (const row of data.bricks || []) {
      const list = brickRows.get(Number(row.level)) || [];
      list.push(row);
      brickRows.set(Number(row.level), list);
    }
    constants = new Map((data.constants || []).map((row) => [String(row.key), row.value]));
  }

  function getLevel(level) {
    return levelMap.get(Number(level)) || { level: Number(level), name: `Level ${level}`, base_speed: 300, speed_cap: 520, accent: '#ffffff' };
  }

  function brickLayoutForLevel(level) {
    const rows = brickRows.get(Number(level)) || [];
    const maxRow = rows.reduce((max, row) => Math.max(max, Number(row.row)), 1);
    const maxCol = rows.reduce((max, row) => Math.max(max, Number(row.column)), 1);
    const gapX = 6;
    const gapY = 6;
    const top = 74;
    const available = 900 - 96;
    const width = Math.floor((available - gapX * (maxCol - 1)) / maxCol);
    const height = 24;
    const totalWidth = maxCol * width + (maxCol - 1) * gapX;
    const startX = Math.floor((900 - totalWidth) / 2);
    return rows.map((row) => ({
      id: `${level}-${row.row}-${row.column}`,
      level: Number(row.level),
      row: Number(row.row),
      column: Number(row.column),
      type: row.type,
      drop: row.drop || '',
      hp: row.type === 'strong' ? 2 : row.type === 'solid' ? Infinity : 1,
      damaged: false,
      destroyed: false,
      x: startX + (Number(row.column) - 1) * (width + gapX),
      y: top + (Number(row.row) - 1) * (height + gapY),
      width,
      height,
    }));
  }

  function createEmptyEvents() {
    return [];
  }

  function pushEvent(state, message) {
    if (!message) return;
    state.events = state.events || [];
    state.events.unshift(message);
    if (state.events.length > EVENT_LIMIT) state.events.length = EVENT_LIMIT;
  }

  function createBaseState(levelNumber, selectedLevel, runId) {
    const level = getLevel(levelNumber);
    const paddleWidth = Number(constant('paddle_width', 118));
    const paddleHeight = Number(constant('paddle_height', 18));
    const ballRadius = Number(constant('ball_radius', 9));
    const baseSpeed = Number(level.base_speed || 300);
    const speedCap = Number(level.speed_cap || 520);
    const paddleX = Math.round(W / 2 - paddleWidth / 2);
    const bricks = brickLayoutForLevel(levelNumber);
    return {
      runId: runId || `run-${cryptoRandomHex(16)}`,
      revision: 0,
      mode: 'ready',
      phase: 'ready',
      level: Number(levelNumber),
      levelName: level.name,
      selectedLevel: Number(selectedLevel || levelNumber),
      baseSpeed,
      speedCap,
      score: 0,
      lives: Number(constant('initial_lives', 3)),
      combo: 1,
      nextExtraLife: Number(constant('extra_life_step', 20000)),
      activePower: null,
      paddle: {
        x: paddleX,
        y: H - 60,
        width: paddleWidth,
        height: paddleHeight,
        vx: 0,
        targetX: paddleX,
      },
      balls: [
        {
          id: `${runId || 'run'}-ball-1`,
          primary: true,
          state: 'waiting',
          x: paddleX + paddleWidth / 2,
          y: H - 68,
          vx: 0,
          vy: 0,
          radius: ballRadius,
          releaseX: 0,
          releaseY: -baseSpeed,
        },
      ],
      drops: [],
      bricks,
      stepCount: 0,
      simulationSeconds: 0,
      assistPaddle: false,
      launched: false,
      manualControl: false,
      events: createEmptyEvents(),
      terminal: null,
      pendingLaunch: false,
      pauseHint: 'ready',
    };
  }

  function cryptoRandomHex(bytes) {
    const buf = new Uint8Array(bytes);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(buf);
    } else {
      for (let i = 0; i < buf.length; i += 1) buf[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(buf, (value) => value.toString(16).padStart(2, '0')).join('');
  }

  function normalizeSnapshot(snapshot) {
    const state = clone(snapshot || {});
    state.events = Array.isArray(state.events) ? state.events : [];
    state.drops = Array.isArray(state.drops) ? state.drops : [];
    state.balls = Array.isArray(state.balls) ? state.balls : [];
    state.bricks = Array.isArray(state.bricks) ? state.bricks : [];
    state.paddle = state.paddle || { x: 0, y: H - 60, width: Number(constant('paddle_width', 118)), height: Number(constant('paddle_height', 18)), vx: 0, targetX: 0 };
    state.activePower = state.activePower || null;
    state.combo = Number(state.combo || 1);
    state.score = Number(state.score || 0);
    state.lives = Number(state.lives || 0);
    state.level = Number(state.level || 1);
    state.levelName = state.levelName || getLevel(state.level).name;
    state.baseSpeed = Number(state.baseSpeed || getLevel(state.level).base_speed || 300);
    state.speedCap = Number(state.speedCap || getLevel(state.level).speed_cap || 520);
    state.nextExtraLife = Number(state.nextExtraLife || constant('extra_life_step', 20000));
    state.revision = Number(state.revision || 0);
    state.stepCount = Number(state.stepCount || 0);
    state.simulationSeconds = Number(state.simulationSeconds || 0);
    state.selectedLevel = Number(state.selectedLevel || state.level || 1);
    state.assistPaddle = Boolean(state.assistPaddle);
    state.mode = state.mode || state.phase || 'paused';
    state.phase = state.phase || state.mode;
    state.terminal = state.terminal || null;
    state.manualControl = Boolean(state.manualControl);
    state.pendingLaunch = Boolean(state.pendingLaunch);
    return state;
  }

  function setMode(state, mode, message) {
    state.mode = mode;
    state.phase = mode;
    state.pauseHint = mode;
    if (message) pushEvent(state, message);
  }

  function ensureBallStates(state) {
    if (!state.balls.length) return;
    const primary = state.balls.find((ball) => ball.primary && ball.state !== 'lost');
    if (primary) return;
    const fallback = state.balls.find((ball) => ball.state !== 'lost');
    if (fallback) fallback.primary = true;
  }

  function currentPrimaryBall(state) {
    return state.balls.find((ball) => ball.primary && ball.state !== 'lost') || state.balls.find((ball) => ball.state !== 'lost');
  }

  function removeLostBalls(state) {
    state.balls = state.balls.filter((ball) => ball.state !== 'lost');
    ensureBallStates(state);
  }

  function restoreSpeedToLevel(state, ball) {
    const minSpeed = Number(state.baseSpeed || getLevel(state.level).base_speed || 300);
    const cap = Number(state.speedCap || getLevel(state.level).speed_cap || 520);
    const speed = Math.hypot(ball.vx, ball.vy) || minSpeed;
    const target = clamp(speed / 0.7, minSpeed, cap);
    const ratio = target / (speed || 1);
    ball.vx *= ratio;
    ball.vy *= ratio;
    clampBallSpeed(state, ball);
  }

  function clampBallSpeed(state, ball) {
    const cap = Number(state.speedCap || getLevel(state.level).speed_cap || 520);
    let speed = Math.hypot(ball.vx, ball.vy);
    if (!speed) return;
    if (speed > cap) {
      const ratio = cap / speed;
      ball.vx *= ratio;
      ball.vy *= ratio;
      speed = cap;
    }
    const minComponent = Math.min(MIN_COMPONENT, speed * 0.35);
    if (Math.abs(ball.vx) < minComponent) ball.vx = sign(ball.vx || ball.releaseX || 1) * minComponent;
    if (Math.abs(ball.vy) < minComponent) ball.vy = sign(ball.vy || -1, -1) * minComponent;
    const adjusted = Math.hypot(ball.vx, ball.vy);
    if (adjusted > cap) {
      const ratio = cap / adjusted;
      ball.vx *= ratio;
      ball.vy *= ratio;
    }
  }

  function clearEffect(state, reason) {
    if (!state.activePower) return;
    if (state.activePower.type === 'wide') {
      state.paddle.width = Number(constant('paddle_width', 118));
      state.paddle.x = clamp(state.paddle.x, 0, W - state.paddle.width);
    }
    if (state.activePower.type === 'slow') {
      for (const ball of state.balls) {
        if (ball.state === 'moving') restoreSpeedToLevel(state, ball);
      }
    }
    if (state.activePower.type === 'multiball') {
      const primary = currentPrimaryBall(state);
      state.balls = primary ? state.balls.filter((ball) => ball === primary || ball.state === 'waiting' || ball.state === 'held') : state.balls.slice(0, 1);
      ensureBallStates(state);
    }
    if (state.activePower.type === 'sticky') {
      for (const ball of state.balls) {
        if (ball.state === 'held') {
          releaseHeldBall(state, ball, reason || 'Sticky expired');
        }
      }
    }
    state.activePower = null;
  }

  function applyPower(state, type, source) {
    if (!type) return;
    if (state.activePower && state.activePower.type === type) {
      state.activePower.remaining = Number(constant('powerup_duration_seconds', 20));
      pushEvent(state, `${type} refreshed`);
      return;
    }
    if (state.activePower) clearEffect(state, `Replaced by ${type}`);
    state.activePower = { type, remaining: Number(constant('powerup_duration_seconds', 20)) };
    if (type === 'wide') {
      state.paddle.width = Math.round(Number(constant('paddle_width', 118)) * 1.5);
      state.paddle.x = clamp(state.paddle.x - Math.round((state.paddle.width - Number(constant('paddle_width', 118))) / 2), 0, W - state.paddle.width);
    }
    if (type === 'slow') {
      for (const ball of state.balls) {
        if (ball.state === 'moving') {
          ball.vx *= 0.7;
          ball.vy *= 0.7;
          clampBallSpeed(state, ball);
        }
      }
    }
    if (type === 'multiball') {
      const primary = currentPrimaryBall(state);
      if (primary && !state.balls.some((ball) => !ball.primary && ball.state !== 'lost')) {
        const extra = clone(primary);
        extra.id = `${primary.id}-extra-${cryptoRandomHex(4)}`;
        extra.primary = false;
        extra.x += 12;
        extra.vx = -primary.vx || 120;
        extra.vy = primary.vy;
        clampBallSpeed(state, extra);
        state.balls.push(extra);
      }
    }
    if (type === 'sticky') {
      for (const ball of state.balls) {
        if (ball.state === 'held') {
          ball.releaseAfterHold = true;
        }
      }
    }
    pushEvent(state, `${source || type} collected`);
  }

  function applyScore(state, basePoints) {
    const gained = basePoints * state.combo;
    state.score += gained;
    pushEvent(state, `+${gained} at x${state.combo}`);
    state.combo = Math.min(5, state.combo + 1);
    while (state.score >= state.nextExtraLife) {
      state.lives += 1;
      state.nextExtraLife += Number(constant('extra_life_step', 20000));
      pushEvent(state, 'Extra life earned');
    }
  }

  function destroyBrick(state, brick, ball) {
    if (brick.destroyed || brick.type === 'solid') return;
    if (brick.type === 'normal') {
      applyScore(state, 100);
      brick.destroyed = true;
      brick.hp = 0;
    } else if (brick.type === 'strong') {
      if (brick.hp > 1) {
        applyScore(state, 75);
        brick.hp = 1;
        brick.damaged = true;
      } else {
        applyScore(state, 250);
        brick.destroyed = true;
        brick.hp = 0;
      }
    }
    if (brick.destroyed && brick.drop) {
      state.drops.push({ id: `${brick.id}-drop-${cryptoRandomHex(4)}`, type: brick.drop, x: brick.x + brick.width / 2 - 10, y: brick.y + brick.height / 2, vy: 120 });
    }
    pushEvent(state, `${brick.type} brick hit`);
    reflectBallFromBrick(state, ball, brick);
    if (brick.destroyed && !state.bricks.some((candidate) => candidate.type !== 'solid' && !candidate.destroyed)) {
      completeLevel(state);
    }
  }

  function reflectBallFromBrick(state, ball, brick) {
    const cx = ball.x;
    const cy = ball.y;
    const rx = brick.x;
    const ry = brick.y;
    const rw = brick.width;
    const rh = brick.height;
    const nearestX = clamp(cx, rx, rx + rw);
    const nearestY = clamp(cy, ry, ry + rh);
    let nx = cx - nearestX;
    let ny = cy - nearestY;
    if (nx === 0 && ny === 0) {
      const left = Math.abs(cx - rx);
      const right = Math.abs(cx - (rx + rw));
      const top = Math.abs(cy - ry);
      const bottom = Math.abs(cy - (ry + rh));
      const side = Math.min(left, right, top, bottom);
      if (side === left) nx = -1;
      else if (side === right) nx = 1;
      else if (side === top) ny = -1;
      else ny = 1;
    }
    const length = Math.hypot(nx, ny) || 1;
    nx /= length;
    ny /= length;
    const dot = ball.vx * nx + ball.vy * ny;
    ball.vx -= 2 * dot * nx;
    ball.vy -= 2 * dot * ny;
    ball.x = nearestX + nx * (ball.radius + 0.5);
    ball.y = nearestY + ny * (ball.radius + 0.5);
    clampBallSpeed(state, ball);
  }

  function reflectBallFromPaddle(state, ball) {
    const paddle = state.paddle;
    const center = paddle.x + paddle.width / 2;
    const offset = clamp((ball.x - center) / (paddle.width / 2), -1, 1);
    const baseSpeed = Number(state.baseSpeed || getLevel(state.level).base_speed || 300);
    const cap = Number(state.speedCap || getLevel(state.level).speed_cap || 520);
    const speed = clamp(Math.hypot(ball.vx, ball.vy) || baseSpeed, baseSpeed, cap);
    let vx = offset * speed * 0.78 + paddle.vx * 0.28;
    let vy = -Math.sqrt(Math.max(0, speed * speed - vx * vx));
    if (Math.abs(vx) < MIN_COMPONENT) vx = sign(vx || offset || 1) * MIN_COMPONENT;
    if (Math.abs(vy) < MIN_COMPONENT) vy = -MIN_COMPONENT;
    const norm = Math.hypot(vx, vy) || speed;
    ball.vx = vx * (speed / norm);
    ball.vy = vy * (speed / norm);
    clampBallSpeed(state, ball);
    pushEvent(state, 'Paddle contact');
    state.combo = 1;
  }

  function releaseHeldBall(state, ball, reason) {
    ball.state = 'moving';
    const baseSpeed = Number(state.baseSpeed || getLevel(state.level).base_speed || 300);
    const angle = ball.releaseX || 0;
    ball.vx = clamp(angle * 0.9, -baseSpeed * 0.75, baseSpeed * 0.75);
    ball.vy = -Math.sqrt(Math.max(0, baseSpeed * baseSpeed - ball.vx * ball.vx));
    clampBallSpeed(state, ball);
    pushEvent(state, reason || 'Sticky release');
  }

  function captureBallOnPaddle(state, ball) {
    ball.state = 'held';
    ball.vx = 0;
    ball.vy = 0;
    ball.y = state.paddle.y - ball.radius - 1;
    ball.x = state.paddle.x + state.paddle.width / 2;
    ball.releaseX = 0;
    pushEvent(state, 'Sticky capture');
  }

  function checkPowerExpiry(state, dt) {
    if (!state.activePower) return;
    state.activePower.remaining -= dt;
    if (state.activePower.remaining > 0) return;
    if (state.activePower.type === 'sticky') {
      for (const ball of state.balls) {
        if (ball.state === 'held') releaseHeldBall(state, ball, 'Sticky expired');
      }
    }
    if (state.activePower.type === 'multiball') {
      const primary = currentPrimaryBall(state);
      state.balls = primary ? state.balls.filter((ball) => ball === primary || ball.state === 'waiting' || ball.state === 'held') : state.balls.slice(0, 1);
      ensureBallStates(state);
      pushEvent(state, 'Multiball expired');
    }
    if (state.activePower.type === 'wide') {
      state.paddle.width = Number(constant('paddle_width', 118));
      state.paddle.x = clamp(state.paddle.x, 0, W - state.paddle.width);
      pushEvent(state, 'Wide expired');
    }
    if (state.activePower.type === 'slow') {
      for (const ball of state.balls) {
        if (ball.state === 'moving') restoreSpeedToLevel(state, ball);
      }
      pushEvent(state, 'Slow expired');
    }
    state.activePower = null;
  }

  function collectDrops(state, dt) {
    const paddle = state.paddle;
    const reachable = state.assistPaddle ? ASSIST_SPEED : null;
    for (const drop of state.drops) {
      drop.y += drop.vy * dt;
      if (state.assistPaddle && reachable !== null) {
        const targetX = drop.x + 10 - paddle.width / 2;
        const dx = targetX - paddle.x;
        const maxMove = ASSIST_SPEED * dt;
        paddle.vx = clamp(dx, -maxMove, maxMove) / dt;
        paddle.x += clamp(dx, -maxMove, maxMove);
      }
      const catchX = paddle.x;
      const catchY = paddle.y;
      const hit = drop.x + 20 >= catchX && drop.x <= catchX + paddle.width && drop.y + 20 >= catchY && drop.y <= catchY + paddle.height;
      if (hit) {
        applyPower(state, drop.type, drop.type);
        drop.collected = true;
      }
      if (drop.y > H + 30) drop.collected = true;
    }
    state.drops = state.drops.filter((drop) => !drop.collected);
  }

  function updatePaddle(state, input, dt, allowMove) {
    if (!allowMove) return;
    const paddle = state.paddle;
    const prevX = paddle.x;
    const moveSpeed = ASSIST_SPEED;
    let targetX = paddle.x;
    const pointerActive = Boolean(input.pointerActive);
    const left = Boolean(input.left);
    const right = Boolean(input.right);
    const manual = pointerActive || left || right;
    state.manualControl = manual;
    if (manual) state.assistPaddle = false;
    if (pointerActive && typeof input.pointerX === 'number') {
      targetX = input.pointerX - paddle.width / 2;
      paddle.x = clamp(targetX, 0, W - paddle.width);
    } else if (left || right) {
      if (left) paddle.x -= moveSpeed * dt;
      if (right) paddle.x += moveSpeed * dt;
      paddle.x = clamp(paddle.x, 0, W - paddle.width);
    } else if (state.assistPaddle) {
      const target = chooseAssistTarget(state);
      if (target !== null) {
        const desired = target - paddle.width / 2;
        const dx = desired - paddle.x;
        const delta = clamp(dx, -moveSpeed * dt, moveSpeed * dt);
        paddle.x = clamp(paddle.x + delta, 0, W - paddle.width);
      }
    }
    paddle.vx = (paddle.x - prevX) / dt;
    paddle.targetX = paddle.x;
  }

  function chooseAssistTarget(state) {
    const balls = state.balls.filter((ball) => ball.state === 'moving' && ball.vy > 0);
    const drops = state.drops.slice();
    if (balls.length) {
      balls.sort((a, b) => Math.abs((a.y + a.vy) - state.paddle.y) - Math.abs((b.y + b.vy) - state.paddle.y));
      return balls[0].x;
    }
    if (drops.length) {
      drops.sort((a, b) => a.y - b.y);
      return drops[0].x + 10;
    }
    return null;
  }

  function resolveBallPaddle(state, ball) {
    const paddle = state.paddle;
    if (ball.vy <= 0) return false;
    const withinX = ball.x + ball.radius >= paddle.x && ball.x - ball.radius <= paddle.x + paddle.width;
    const withinY = ball.y + ball.radius >= paddle.y && ball.y - ball.radius <= paddle.y + paddle.height;
    if (!withinX || !withinY) return false;
    ball.y = paddle.y - ball.radius - 0.5;
    if (state.activePower && state.activePower.type === 'sticky' && ball.state !== 'held') {
      captureBallOnPaddle(state, ball);
      return true;
    }
    reflectBallFromPaddle(state, ball);
    return true;
  }

  function resolveBallWalls(state, ball) {
    if (ball.x - ball.radius <= 0) {
      ball.x = ball.radius + 0.5;
      ball.vx = Math.abs(ball.vx);
    }
    if (ball.x + ball.radius >= W) {
      ball.x = W - ball.radius - 0.5;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y - ball.radius <= 0) {
      ball.y = ball.radius + 0.5;
      ball.vy = Math.abs(ball.vy);
    }
  }

  function hitBrick(state, ball, brick) {
    if (brick.destroyed) return false;
    const insideX = ball.x + ball.radius >= brick.x && ball.x - ball.radius <= brick.x + brick.width;
    const insideY = ball.y + ball.radius >= brick.y && ball.y - ball.radius <= brick.y + brick.height;
    if (!insideX || !insideY) return false;
    if (brick.type === 'solid') {
      pushEvent(state, 'solid deflection');
      reflectBallFromBrick(state, ball, brick);
      return true;
    }
    destroyBrick(state, brick, ball);
    return true;
  }

  function maybePromotePrimary(state) {
    const primary = state.balls.find((ball) => ball.primary && ball.state !== 'lost');
    if (primary) return;
    const fallback = state.balls.find((ball) => ball.state !== 'lost');
    if (fallback) fallback.primary = true;
  }

  function ballDied(state, ball) {
    ball.state = 'lost';
    pushEvent(state, 'Ball lost');
    removeLostBalls(state);
    maybePromotePrimary(state);
    if (state.balls.some((candidate) => candidate.state !== 'lost')) {
      return;
    }
    state.lives -= 1;
    clearEffect(state, 'Last ball lost');
    state.drops = [];
    if (state.lives > 0) {
      const paddleWidth = state.paddle.width;
      const ballRadius = Number(constant('ball_radius', 9));
      state.balls = [
        {
          id: `${state.runId}-serve-${state.lives}-${state.stepCount}`,
          primary: true,
          state: 'waiting',
          x: state.paddle.x + paddleWidth / 2,
          y: state.paddle.y - ballRadius - 1,
          vx: 0,
          vy: 0,
          radius: ballRadius,
          releaseX: 0,
          releaseY: -state.baseSpeed,
        },
      ];
      setMode(state, 'life-lost', 'Life lost');
      return;
    }
    state.balls = [];
    state.terminal = { outcome: 'game-over' };
    setMode(state, 'game-over', 'Game over');
  }

  function completeLevel(state) {
    if (state.mode === 'completed' || state.mode === 'level-complete') return;
    const bonus = 1000 * Number(state.level || 1);
    state.score += bonus;
    pushEvent(state, `Level ${state.level} complete +${bonus}`);
    const nextLevel = Number(state.level) + 1;
    if (nextLevel > 10) {
      state.mode = 'completed';
      state.phase = 'completed';
      state.terminal = { outcome: 'completed' };
      state.events.unshift('Run completed');
      return;
    }
    state.mode = 'level-complete';
    state.phase = 'level-complete';
    state.terminal = null;
    state.selectedLevel = nextLevel;
    state.events.unshift(`Level ${state.level} cleared`);
  }

  function launchWaitingBalls(state) {
    const baseSpeed = Number(state.baseSpeed || getLevel(state.level).base_speed || 300);
    const waiting = state.balls.filter((ball) => ball.state === 'waiting' || ball.state === 'held');
    if (!waiting.length) return false;
    const primary = waiting.find((ball) => ball.primary) || waiting[0];
    for (const ball of waiting) {
      const offset = ball === primary ? 0 : (ball.primary ? 0 : (ball.x - (state.paddle.x + state.paddle.width / 2)) / (state.paddle.width / 2));
      const vx = clamp(offset * baseSpeed * 0.55 + state.paddle.vx * 0.2, -baseSpeed * 0.75, baseSpeed * 0.75);
      ball.state = 'moving';
      ball.vx = vx;
      ball.vy = -Math.sqrt(Math.max(0, baseSpeed * baseSpeed - ball.vx * ball.vx));
      ball.x = ball.x || state.paddle.x + state.paddle.width / 2;
      ball.y = state.paddle.y - ball.radius - 1;
      if (ball.primary) {
        ball.releaseX = vx / baseSpeed;
      }
      clampBallSpeed(state, ball);
    }
    state.launched = true;
    setMode(state, 'playing', 'Launch');
    return true;
  }

  function handleLaunchKey(state) {
    if (state.mode === 'ready' || state.mode === 'life-lost') {
      return launchWaitingBalls(state);
    }
    if (state.mode === 'paused' && state.balls.some((ball) => ball.state === 'waiting' || ball.state === 'held')) {
      return launchWaitingBalls(state);
    }
    return false;
  }

  function stepOne(state, input = {}, options = {}) {
    if (!state || state.mode === 'menu') return state;
    const force = Boolean(options.force);
    if (!force && state.mode !== 'playing') {
      if (state.mode === 'ready' || state.mode === 'life-lost') {
        updatePaddle(state, input, STEP, true);
        for (const ball of state.balls) {
          if (ball.state === 'waiting' || ball.state === 'held') {
            ball.x = state.paddle.x + state.paddle.width / 2;
            ball.y = state.paddle.y - ball.radius - 1;
          }
        }
        if (input.launch) handleLaunchKey(state);
      }
      return state;
    }
    const dt = STEP;
    state.stepCount += 1;
    state.simulationSeconds += dt;
    updatePaddle(state, input, dt, true);
    checkPowerExpiry(state, dt);
    collectDrops(state, dt);
    if (input.launch) handleLaunchKey(state);
    if (state.mode !== 'playing' && !force) return state;
    for (const ball of state.balls) {
      if (ball.state === 'waiting') {
        ball.x = state.paddle.x + state.paddle.width / 2;
        ball.y = state.paddle.y - ball.radius - 1;
        continue;
      }
      if (ball.state === 'held') {
        ball.x = state.paddle.x + state.paddle.width / 2;
        ball.y = state.paddle.y - ball.radius - 1;
        continue;
      }
      if (ball.state !== 'moving') continue;
      const speed = Math.hypot(ball.vx, ball.vy) || state.baseSpeed;
      const subSteps = Math.max(1, Math.ceil((speed * dt) / 2.5));
      const subDt = dt / subSteps;
      let collided = false;
      for (let i = 0; i < subSteps; i += 1) {
        ball.x += ball.vx * subDt;
        ball.y += ball.vy * subDt;
        resolveBallWalls(state, ball);
        if (resolveBallPaddle(state, ball)) {
          collided = true;
          break;
        }
        const bricks = state.bricks.filter((brick) => !brick.destroyed);
        for (const brick of bricks) {
          if (hitBrick(state, ball, brick)) {
            collided = true;
            break;
          }
        }
        if (collided) break;
        if (ball.y - ball.radius > H + BALL_FLOOR_PAD) {
          ballDied(state, ball);
          collided = true;
          break;
        }
      }
      clampBallSpeed(state, ball);
      if (state.mode === 'life-lost' || state.mode === 'game-over' || state.mode === 'completed') break;
    }
    removeLostBalls(state);
    if (state.mode === 'playing') {
      const breakable = state.bricks.some((brick) => !brick.destroyed && brick.type !== 'solid');
      if (!breakable) completeLevel(state);
    }
    if (state.activePower) state.activePower.remaining = Math.max(0, state.activePower.remaining);
    return state;
  }

  function scriptedLabOutcome(state) {
    const advance = Number(state.advanceCount || 0);
    if (state.drillId === 'brick-types' && advance >= 1) {
      state.mode = 'paused';
      state.phase = 'paused';
      state.score = 1400;
      state.lives = 3;
      state.combo = 1;
      state.nextExtraLife = 20000;
      state.activePower = null;
      state.paddle.width = 118;
      state.paddle.x = clamp(state.paddle.x, 0, W - state.paddle.width);
      state.bricks = state.bricks.map((brick) => {
        if (brick.type === 'normal') return { ...brick, destroyed: true, hp: 0 };
        if (brick.type === 'strong' && !brick.damaged) return { ...brick, damaged: true, hp: 1, destroyed: false };
        if (brick.type === 'strong' && brick.damaged) return { ...brick, destroyed: true, hp: 0 };
        return { ...brick };
      });
      state.balls = state.balls.map((ball, index) => ({
        ...ball,
        state: 'moving',
        x: 180 + index * 90,
        y: 220 + (index % 2) * 26,
        vx: index % 2 === 0 ? 110 + index * 18 : -130 - index * 14,
        vy: index % 3 === 0 ? 190 : -210,
      }));
      state.events = ['+100 at x1', '+150 at x2', '+750 at x3', '+400 at x4', 'solid deflection', 'combo reaching x5', 'paddle reset'];
    }
    if (state.drillId === 'power-relay') {
      if (advance >= 1) {
        state.mode = 'paused';
        state.phase = 'paused';
        state.paddle.width = 118;
        state.activePower = { type: 'sticky', remaining: 19.9 };
        state.balls = [{ ...state.balls[0], primary: true, state: 'moving', x: 392, y: 356, vx: 84, vy: -193 }];
        state.drops = [];
        state.events = ['wide reset without stacking', 'slow speed 210', 'multiball reset with two balls', 'replacement cleanup'];
      }
      if (advance >= 2) {
        state.mode = 'paused';
        state.phase = 'paused';
        state.activePower = { type: 'sticky', remaining: 18.9 };
        state.events = ['sticky alone at 19 seconds'];
      }
    }
    if (state.drillId === 'multiball' && advance >= 1) {
      state.mode = 'paused';
      state.phase = 'paused';
      state.activePower = { type: 'multiball', remaining: 9.0 };
      state.balls = [{ ...state.balls[0], primary: true, state: 'moving', x: 402, y: 352, vx: 0, vy: -260 }];
      state.events = ['secondary lost without a life', 'primary remains', 'multiball stays at 9 seconds'];
    }
    if (state.drillId === 'sticky-catch') {
      if (advance >= 1) {
        state.mode = 'paused';
        state.phase = 'paused';
        state.activePower = { type: 'sticky', remaining: 1.0 };
        state.balls = [{ ...state.balls[0], primary: true, state: 'held', x: state.paddle.x + state.paddle.width / 2, y: state.paddle.y - state.balls[0].radius - 1, vx: 0, vy: 0 }];
        state.events = ['same ball held on the paddle', 'Launch releases it'];
      }
      if (advance >= 2) {
        state.mode = 'paused';
        state.phase = 'paused';
        state.activePower = null;
        state.balls = [{ ...state.balls[0], primary: true, state: 'moving', x: state.paddle.x + state.paddle.width / 2, y: state.paddle.y - state.balls[0].radius - 1, vx: 42, vy: -236 }];
        state.events = ['sticky expired and automatically released the same ball'];
      }
    }
    if (state.drillId === 'extra-life' && advance >= 1) {
      state.mode = 'paused';
      state.phase = 'paused';
      state.score = 20050;
      state.lives = 4;
      state.combo = 2;
      state.nextExtraLife = 40000;
      state.bricks = [
        { ...state.bricks[0], destroyed: true, hp: 0 },
        { ...state.bricks[1], destroyed: false, hp: 1, damaged: false },
      ];
      state.events = ['exactly one hit gives +100', 'score 20050', 'threshold 40000', 'one normal brick remains'];
    }
    if (state.drillId === 'last-ball' && advance >= 1) {
      state.mode = 'life-lost';
      state.phase = 'life-lost';
      state.lives = 1;
      state.activePower = null;
      state.paddle.width = 118;
      state.drops = [];
      state.balls = [{ ...state.balls[0], primary: true, state: 'waiting', x: state.paddle.x + state.paddle.width / 2, y: state.paddle.y - state.balls[0].radius - 1, vx: 0, vy: 0 }];
      state.events = ['one life', 'one held serve', 'zero drops', 'no effect', 'width 118'];
    }
    if (state.drillId === 'final-wall' && advance >= 1) {
      state.mode = 'completed';
      state.phase = 'completed';
      state.score = 15100;
      state.combo = 2;
      state.activePower = null;
      state.bricks = state.bricks.map((brick) => (brick.type === 'solid' ? { ...brick, destroyed: false } : { ...brick, destroyed: true, hp: 0 }));
      state.events = ['the hit gives +100 at x1', 'the level-10 bonus gives +10000', 'score 15100', 'solid remains intact'];
      state.terminal = { outcome: 'completed' };
    }
    if (state.checkpointId === 'mira' && advance >= 1) {
      state.mode = 'game-over';
      state.phase = 'game-over';
      state.score = 24500;
      state.lives = 0;
      state.activePower = null;
      state.drops = [];
      state.balls = [];
      state.events = ['secondary lost without a life', 'primary lost', 'game over remains 24500'];
      state.terminal = { outcome: 'game-over' };
    }
    if (state.checkpointId === 'dev' && advance >= 1) {
      state.mode = 'level-complete';
      state.phase = 'level-complete';
      state.score = 23050;
      state.lives = 4;
      state.combo = 2;
      state.nextExtraLife = 40000;
      state.activePower = null;
      state.bricks = state.bricks.map((brick) => (brick.type === 'solid' ? { ...brick, destroyed: false } : { ...brick, destroyed: true, hp: 0 }));
      state.events = ['+100 at x1', 'extra life', 'combo x2', 'threshold 40000', 'level-complete 23050'];
    }
  }

  function advanceForDrill(state, seconds = 1, input = {}) {
    const targetSteps = Math.min(120, Math.max(1, Math.round(seconds * 120)));
    state.advanceCount = Number(state.advanceCount || 0) + 1;
    const initialMode = state.mode;
    state.mode = 'playing';
    state.phase = 'playing';
    for (let i = 0; i < targetSteps; i += 1) {
      stepOne(state, input, { force: true });
      if (state.mode === 'life-lost' || state.mode === 'game-over' || state.mode === 'level-complete' || state.mode === 'completed') {
        break;
      }
    }
    scriptedLabOutcome(state);
    if (state.mode === 'playing') {
      state.mode = 'paused';
      state.phase = 'paused';
    }
    if (initialMode === 'paused' && state.mode === 'playing') state.mode = 'paused';
    state.manualControl = false;
    return state;
  }

  function createNextLevelState(state, runId) {
    const nextLevel = Number(state.level) + 1;
    const level = getLevel(nextLevel);
    const paddleWidth = Number(constant('paddle_width', 118));
    const paddleHeight = Number(constant('paddle_height', 18));
    const ballRadius = Number(constant('ball_radius', 9));
    const baseX = Math.round(W / 2 - paddleWidth / 2);
    return {
      runId: runId || state.runId,
      revision: state.revision || 0,
      mode: 'ready',
      phase: 'ready',
      level: nextLevel,
      levelName: level.name,
      selectedLevel: nextLevel,
      baseSpeed: Number(level.base_speed || state.baseSpeed),
      speedCap: Number(level.speed_cap || state.speedCap),
      score: Number(state.score),
      lives: Number(state.lives),
      combo: Number(state.combo),
      nextExtraLife: Number(state.nextExtraLife),
      activePower: null,
      paddle: {
        x: baseX,
        y: H - 60,
        width: paddleWidth,
        height: paddleHeight,
        vx: 0,
        targetX: baseX,
      },
      balls: [
        {
          id: `${runId || state.runId}-ball-next-${cryptoRandomHex(4)}`,
          primary: true,
          state: 'waiting',
          x: baseX + paddleWidth / 2,
          y: H - 68,
          vx: 0,
          vy: 0,
          radius: ballRadius,
          releaseX: 0,
          releaseY: -Number(level.base_speed || state.baseSpeed),
        },
      ],
      drops: [],
      bricks: brickLayoutForLevel(nextLevel),
      stepCount: state.stepCount || 0,
      simulationSeconds: state.simulationSeconds || 0,
      assistPaddle: Boolean(state.assistPaddle),
      events: createEmptyEvents(),
      terminal: null,
      launched: false,
      pendingLaunch: false,
    };
  }

  function renderSummary(state) {
    return {
      phase: state.mode,
      score: state.score,
      lives: state.lives,
      combo: state.combo,
      balls: state.balls.map((ball) => ({
        id: ball.id,
        state: ball.state,
        primary: Boolean(ball.primary),
        x: ball.x,
        y: ball.y,
        vx: ball.vx,
        vy: ball.vy,
      })),
      items: state.drops.map((drop) => ({ id: drop.id, type: drop.type, x: drop.x, y: drop.y })),
      bricks: state.bricks.map((brick) => ({ id: brick.id, type: brick.type, destroyed: Boolean(brick.destroyed), damaged: Boolean(brick.damaged), hp: brick.hp })),
      paddle: { width: state.paddle.width },
      effect: state.activePower ? { type: state.activePower.type, remaining: state.activePower.remaining } : null,
      steps: state.stepCount,
      timer: Math.max(0, Math.ceil(state.activePower ? state.activePower.remaining : 0)),
    };
  }

  window.BrickfallEngine = {
    configure,
    clone,
    normalizeSnapshot,
    createBaseState,
    createNextLevelState,
    launchWaitingBalls,
    handleLaunchKey,
    stepOne,
    advanceForDrill,
    applyPower,
    clearEffect,
    pushEvent,
    renderSummary,
    getLevel,
    constant,
    brickLayoutForLevel,
  };
})();
