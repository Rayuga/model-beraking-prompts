// /app/drills.js - Fixture definitions for Mechanics Lab Drills and Checkpoints

const physics = (typeof require !== 'undefined') ? require('./physics') : (typeof window !== 'undefined' ? window : {});
const CONSTANTS = physics.CONSTANTS || { BALL_RADIUS: 9, DROP_WIDTH: 36, DROP_HEIGHT: 16 };
const getBrickRect = physics.getBrickRect;

function createDrillState(drillId) {
  switch (drillId) {
    case 'brick-types': {
      // Drill 1: Brick types
      // Initial: paused; score 0, lives 3, combo x1, six moving balls;
      // two normal, one intact strong, one damaged strong and one solid brick;
      // ball 3 targets a lower-right brick corner, ball 4 starts at speed 1000 below a normal brick, and ball 6 approaches the paddle off-center
      // After advance 120 ticks: score 1400; combo x1; both normals & damaged strong gone, intact strong damaged, solid remains; events in order.
      return {
        id: 'brick-types',
        name: 'Brick types',
        status: 'paused',
        level: 1,
        score: 0,
        lives: 3,
        combo: 1,
        next_extra_life: 20000,
        paddle: { x: 391, y: 540, width: 118, height: 18, vx: 0 },
        power: null,
        power_seconds: 0,
        baseSpeed: 300,
        speedCap: 520,
        clampSpeedImmediately: true,
        isMechanicsLab: true,
        bricks: [
          { id: 'b1', row: 1, column: 1, x: 80, y: 120, width: 76, height: 22, type: 'normal', hp: 1, drop: '' },
          { id: 'b2', row: 1, column: 3, x: 230, y: 120, width: 76, height: 22, type: 'strong', hp: 2, drop: '' },
          { id: 'b3', row: 1, column: 5, x: 380, y: 120, width: 76, height: 22, type: 'strong', hp: 1, drop: '' },
          { id: 'b4', row: 1, column: 7, x: 530, y: 120, width: 76, height: 22, type: 'normal', hp: 1, drop: '' },
          { id: 'b5', row: 1, column: 9, x: 680, y: 120, width: 76, height: 22, type: 'solid', hp: Infinity, drop: '' },
        ],
        balls: [
          // Ball 1: hits normal brick b1 (+100 at x1 -> combo x2)
          { id: 'ball_1', isPrimary: true, x: 118, y: 160, vx: 0, vy: -300, radius: CONSTANTS.BALL_RADIUS, held: false, lost: false },
          // Ball 2: hits intact strong b2 (+150 at x2 -> combo x3)
          { id: 'ball_2', isPrimary: false, x: 268, y: 190, vx: 0, vy: -300, radius: CONSTANTS.BALL_RADIUS, held: false, lost: false },
          // Ball 3: targets lower-right corner of damaged strong b3 (+750 at x3 -> combo x4)
          { id: 'ball_3', isPrimary: false, x: 480, y: 180, vx: -240, vy: -200, radius: CONSTANTS.BALL_RADIUS, held: false, lost: false },
          // Ball 4: starts at speed 1000 below normal b4 (+400 at x4 -> combo x5)
          { id: 'ball_4', isPrimary: false, x: 568, y: 350, vx: 0, vy: -1000, radius: CONSTANTS.BALL_RADIUS, held: false, lost: false },
          // Ball 5: hits solid brick b5 (solid deflection -> combo x5)
          { id: 'ball_5', isPrimary: false, x: 718, y: 300, vx: 0, vy: -300, radius: CONSTANTS.BALL_RADIUS, held: false, lost: false },
          // Ball 6: approaches paddle off-center (paddle reset -> combo resets to x1)
          { id: 'ball_6', isPrimary: false, x: 440, y: 320, vx: 0, vy: 250, radius: CONSTANTS.BALL_RADIUS, held: false, lost: false },
        ],
        drops: []
      };
    }

    case 'power-relay': {
      // Drill 2: Power relay
      // Initial: paused; one moving ball at speed 300; six ordered drops: wide, wide, slow, multiball, multiball, sticky
      // After advance (120 ticks): zero drops; width 118; one primary moving ball; sticky alone at 20 seconds;
      // events prove wide reset without stacking, slow speed 210 (70% of 300), multiball reset with two balls and no third, and replacement cleanup
      // After second advance: 240 total ticks; paused; sticky alone at 19 seconds
      return {
        id: 'power-relay',
        name: 'Power relay',
        status: 'paused',
        level: 1,
        score: 0,
        lives: 3,
        combo: 1,
        next_extra_life: 20000,
        paddle: { x: 391, y: 540, width: 118, height: 18, vx: 0 },
        power: null,
        power_seconds: 0,
        baseSpeed: 300,
        speedCap: 520,
        isMechanicsLab: true,
        bricks: [],
        balls: [
          { id: 'primary', isPrimary: true, x: 200, y: 300, vx: 180, vy: -240, radius: CONSTANTS.BALL_RADIUS, held: false, lost: false }
        ],
        drops: [
          { id: 'd1', type: 'wide', x: 440, y: 520, vx: 0, vy: 150, width: CONSTANTS.DROP_WIDTH, height: CONSTANTS.DROP_HEIGHT },
          { id: 'd2', type: 'wide', x: 440, y: 480, vx: 0, vy: 150, width: CONSTANTS.DROP_WIDTH, height: CONSTANTS.DROP_HEIGHT },
          { id: 'd3', type: 'slow', x: 440, y: 440, vx: 0, vy: 150, width: CONSTANTS.DROP_WIDTH, height: CONSTANTS.DROP_HEIGHT },
          { id: 'd4', type: 'multiball', x: 440, y: 410, vx: 0, vy: 150, width: CONSTANTS.DROP_WIDTH, height: CONSTANTS.DROP_HEIGHT },
          { id: 'd5', type: 'multiball', x: 440, y: 395, vx: 0, vy: 150, width: CONSTANTS.DROP_WIDTH, height: CONSTANTS.DROP_HEIGHT },
          { id: 'd6', type: 'sticky', x: 440, y: 390, vx: 0, vy: 150, width: CONSTANTS.DROP_WIDTH, height: CONSTANTS.DROP_HEIGHT },
        ]
      };
    }

    case 'multiball': {
      // Drill 3: Multiball
      // Initial: paused; three lives, multiball at 10 seconds, one primary and one already-lost secondary ball
      // After advance (120 ticks): paused; only the same primary remains; three lives; multiball remains at 9 seconds; no life-lost serve
      return {
        id: 'multiball',
        name: 'Multiball',
        status: 'paused',
        level: 1,
        score: 0,
        lives: 3,
        combo: 1,
        next_extra_life: 20000,
        paddle: { x: 391, y: 540, width: 118, height: 18, vx: 0 },
        power: 'multiball',
        power_seconds: 10.0,
        baseSpeed: 300,
        speedCap: 520,
        isMechanicsLab: true,
        bricks: [],
        balls: [
          { id: 'primary', isPrimary: true, x: 450, y: 300, vx: 200, vy: -200, radius: CONSTANTS.BALL_RADIUS, held: false, lost: false },
          { id: 'secondary_lost', isPrimary: false, x: 200, y: 620, vx: 0, vy: 300, radius: CONSTANTS.BALL_RADIUS, held: false, lost: false }
        ],
        drops: []
      };
    }

    case 'sticky-catch': {
      // Drill 4: Sticky catch
      // Initial: paused; one descending primary ball; sticky at 1.5 seconds
      // After advance (120 ticks): paused; the same ball is held on the paddle; sticky shows 1 whole second; visible Launch releases it
      // After second advance without launch: 240 total ticks; paused; sticky has expired and automatically released the same ball, which remains in play
      return {
        id: 'sticky-catch',
        name: 'Sticky catch',
        status: 'paused',
        level: 1,
        score: 0,
        lives: 3,
        combo: 1,
        next_extra_life: 20000,
        paddle: { x: 391, y: 540, width: 118, height: 18, vx: 0 },
        power: 'sticky',
        power_seconds: 1.5,
        baseSpeed: 300,
        speedCap: 520,
        isMechanicsLab: true,
        bricks: [],
        balls: [
          { id: 'primary', isPrimary: true, x: 450, y: 500, vx: 0, vy: 200, radius: CONSTANTS.BALL_RADIUS, held: false, lost: false }
        ],
        drops: []
      };
    }

    case 'extra-life': {
      // Drill 5: Extra life
      // Initial: paused; score 19950, three lives, combo x1, threshold 20000 and two normal bricks
      // After advance (120 ticks): paused; exactly one hit gives +100, score 20050, four lives, combo x2, threshold 40000 and one normal brick remains
      return {
        id: 'extra-life',
        name: 'Extra life',
        status: 'paused',
        level: 1,
        score: 19950,
        lives: 3,
        combo: 1,
        next_extra_life: 20000,
        paddle: { x: 391, y: 540, width: 118, height: 18, vx: 0 },
        power: null,
        power_seconds: 0,
        baseSpeed: 300,
        speedCap: 520,
        isMechanicsLab: true,
        bricks: [
          { id: 'b_hit', row: 1, column: 5, x: 412, y: 150, width: 76, height: 22, type: 'normal', hp: 1, drop: '' },
          { id: 'b_away', row: 1, column: 9, x: 748, y: 150, width: 76, height: 22, type: 'normal', hp: 1, drop: '' }
        ],
        balls: [
          { id: 'primary', isPrimary: true, x: 450, y: 220, vx: 0, vy: -300, radius: CONSTANTS.BALL_RADIUS, held: false, lost: false }
        ],
        drops: []
      };
    }

    case 'last-ball': {
      // Drill 6: Last ball
      // Initial: paused; two lives, one already-lost ball, one slow drop, wide at 10 seconds and width 177
      // After advance (1 tick): stops after 1 tick in life-lost; one life; one held serve; zero drops; no effect; width 118
      return {
        id: 'last-ball',
        name: 'Last ball',
        status: 'paused',
        level: 1,
        score: 0,
        lives: 2,
        combo: 1,
        next_extra_life: 20000,
        paddle: { x: 361.5, y: 540, width: 177, height: 18, vx: 0 },
        paddle_width: 177,
        power: 'wide',
        power_seconds: 10.0,
        baseSpeed: 300,
        speedCap: 520,
        isMechanicsLab: true,
        bricks: [],
        balls: [
          { id: 'lost_ball', isPrimary: true, x: 450, y: 620, vx: 0, vy: 300, radius: CONSTANTS.BALL_RADIUS, held: false, lost: false }
        ],
        drops: [
          { id: 'd_slow', type: 'slow', x: 450, y: 300, vx: 0, vy: 150, width: CONSTANTS.DROP_WIDTH, height: CONSTANTS.DROP_HEIGHT }
        ]
      };
    }

    case 'final-wall': {
      // Drill 7: Final wall
      // Initial: paused practice level 10; score 5000, combo x1, one normal brick and one intact solid brick away from the ball's path
      // After advance: completed; the hit gives +100 at x1 and the level-10 bonus gives +10000, for score 15100, combo x2 and zero breakable bricks;
      // the solid remains intact and does not prevent completion
      return {
        id: 'final-wall',
        name: 'Final wall',
        status: 'paused',
        level: 10,
        score: 5000,
        lives: 3,
        combo: 1,
        next_extra_life: 20000,
        paddle: { x: 391, y: 540, width: 118, height: 18, vx: 0 },
        power: null,
        power_seconds: 0,
        baseSpeed: 464,
        speedCap: 745,
        isMechanicsLab: true,
        bricks: [
          { id: 'b_target', row: 1, column: 5, x: 412, y: 150, width: 76, height: 22, type: 'normal', hp: 1, drop: '' },
          { id: 'b_solid', row: 1, column: 1, x: 76, y: 150, width: 76, height: 22, type: 'solid', hp: Infinity, drop: '' }
        ],
        balls: [
          { id: 'primary', isPrimary: true, x: 450, y: 220, vx: 0, vy: -400, radius: CONSTANTS.BALL_RADIUS, held: false, lost: false }
        ],
        drops: []
      };
    }

    default:
      return null;
  }
}

function createMiraCheckpoint(bricks) {
  // Checkpoints mira:
  // "revision": 1, "level": 8, "score": 24500, "lives": 1, "combo": 4, "next_extra_life": 40000,
  // "power": "wide", "power_seconds": 12.5, "paddle_width": 177,
  // "balls": "two moving balls: the secondary is already below the floor; the primary follows without touching a brick",
  // "drop": "one sticky item that cannot reach the paddle before the final ball is lost",
  // "bricks": "23 normal, 18 intact strong, 1 damaged strong, 0 solid",
  // "next_outcome": "resuming loses the secondary without a life, then loses the primary; game-over remains 24500 with zero lives/balls/drops/effect and finish advances the immediately preceding revision once"

  // Level 8 bricks from seed: 23 normal, 19 strong.
  // In checkpoint: 23 normal (hp 1), 18 intact strong (hp 2), 1 damaged strong (hp 1), 0 solid.
  let strongCount = 0;
  const checkpointBricks = bricks.filter(b => b.level === 8).map(b => {
    let hp = 1;
    if (b.type === 'strong') {
      strongCount++;
      hp = strongCount === 1 ? 1 : 2; // 1 damaged strong, 18 intact strong
    }
    return {
      row: b.row,
      column: b.column,
      type: b.type,
      hp: hp,
      drop: b.drop || ''
    };
  });

  return {
    run_id: 'mira-checkpoint-run',
    level: 8,
    score: 24500,
    lives: 1,
    combo: 4,
    next_extra_life: 40000,
    status: 'paused',
    paddle: { x: 500, y: 540, width: 177, height: 18, vx: 0 },
    paddle_width: 177,
    power: 'wide',
    power_seconds: 12.5,
    baseSpeed: 428,
    speedCap: 695,
    balls: [
      // Primary ball: heading down at x = 100, far to the left of paddle, will fall past floor without touching brick or paddle
      { id: 'primary', isPrimary: true, x: 100, y: 480, vx: -50, vy: 350, radius: CONSTANTS.BALL_RADIUS, held: false, lost: false },
      // Secondary ball: already below floor
      { id: 'secondary', isPrimary: false, x: 300, y: 620, vx: 50, vy: 350, radius: CONSTANTS.BALL_RADIUS, held: false, lost: false }
    ],
    drops: [
      // One sticky item high up that cannot reach paddle before primary ball falls below floor
      { id: 'drop_sticky', type: 'sticky', x: 800, y: 100, vx: 0, vy: 100, width: CONSTANTS.DROP_WIDTH, height: CONSTANTS.DROP_HEIGHT }
    ],
    bricks: checkpointBricks
  };
}

function createDevCheckpoint(bricks) {
  // Checkpoints dev:
  // "revision": 1, "level": 3, "score": 19950, "lives": 3, "combo": 1, "next_extra_life": 20000,
  // "remaining_normal_bricks": 1,
  // "balls": "one moving ball aimed at the final normal brick",
  // "next_outcome": "the hit is +100 at x1, grants one life, raises combo to x2 and threshold to 40000, then the level-3 bonus is +3000; level-complete is 23050 with four lives and progress advances the immediately preceding revision once"

  const lvl3NormalBricks = bricks.filter(b => b.level === 3 && b.type === 'normal');
  const targetBrick = lvl3NormalBricks[0];
  const brickRect = getBrickRect(targetBrick.row, targetBrick.column);

  return {
    run_id: 'dev-checkpoint-run',
    level: 3,
    score: 19950,
    lives: 3,
    combo: 1,
    next_extra_life: 20000,
    status: 'paused',
    paddle: { x: 391, y: 540, width: 118, height: 18, vx: 0 },
    paddle_width: 118,
    power: null,
    power_seconds: 0,
    baseSpeed: 338,
    speedCap: 570,
    balls: [
      {
        id: 'primary',
        isPrimary: true,
        x: brickRect.x + brickRect.width / 2,
        y: brickRect.y + brickRect.height + 25,
        vx: 0,
        vy: -338,
        radius: CONSTANTS.BALL_RADIUS,
        held: false,
        lost: false
      }
    ],
    drops: [],
    bricks: [
      {
        row: targetBrick.row,
        column: targetBrick.column,
        type: 'normal',
        hp: 1,
        drop: ''
      }
    ]
  };
}

const DRILL_SUMMARIES = [
  {
    id: 'brick-types',
    name: 'Brick types',
    description: 'Collision response, damage stages, combo scaling up to x5, solid bounce, paddle combo reset, and speed cap handling.'
  },
  {
    id: 'power-relay',
    name: 'Power relay',
    description: 'Sequential power-up collection, timer renewals without stacking, replacement cleanup, and slow/multiball parameters.'
  },
  {
    id: 'multiball',
    name: 'Multiball',
    description: 'Multiball life protection: losing one ball during multiball preserves current lives.'
  },
  {
    id: 'sticky-catch',
    name: 'Sticky catch',
    description: 'Paddle ball capture, timer display in whole seconds, intentional launch, and automatic release upon expiry.'
  },
  {
    id: 'extra-life',
    name: 'Extra life',
    description: 'Score crossing 20,000 threshold awards exactly one extra life and raises next threshold to 40,000.'
  },
  {
    id: 'last-ball',
    name: 'Last ball',
    description: 'Losing the final active ball immediately ends power-ups, removes falling drops, consumes one life, and triggers serve.'
  },
  {
    id: 'final-wall',
    name: 'Final wall',
    description: 'Clearing all breakable bricks completes level 10 and awards completion bonus, even with solid bricks remaining.'
  }
];

if (typeof window !== 'undefined') {
  window.createDrillState = createDrillState;
  window.createMiraCheckpoint = createMiraCheckpoint;
  window.createDevCheckpoint = createDevCheckpoint;
  window.DRILL_SUMMARIES = DRILL_SUMMARIES;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createDrillState,
    createMiraCheckpoint,
    createDevCheckpoint,
    DRILL_SUMMARIES
  };
}
