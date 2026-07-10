import {
  WIDTH, PADDLE_WIDTH, BRICK_COLS, BRICK_WIDTH,
  MAX_LEVELS, POWERUP_CHANCE, LEVEL_PATTERNS, GREEN_COLOR,
} from './constants.js';

export const effectivePaddleWidth = (state) => Math.max(3,
  PADDLE_WIDTH
  + (state.wideTimer   > 0 ?  4 : 0)
  - (state.shrinkTimer > 0 ?  3 : 0)
);

export const ballOnPaddleX = (state) =>
  Math.round(state.paddleX + effectivePaddleWidth(state) / 2);

export function getSpeedLevels(level) {
  const base = Math.max(42, 82 - (level - 1) * 8);
  return [
    { frac: 0,    tickMs: base },
    { frac: 0.25, tickMs: Math.max(40, base - 12) },
    { frac: 0.50, tickMs: Math.max(38, base - 22) },
    { frac: 0.75, tickMs: Math.max(36, base - 30) },
  ];
}

function pickPowerupType(level) {
  const r = Math.random();
  if (level === 1) {
    if (r < 0.40) return 'life';
    if (r < 0.68) return 'wide';
    if (r < 0.86) return 'slow';
    return 'multi';
  }
  if (level === 2) {
    if (r < 0.25) return 'life';
    if (r < 0.45) return 'wide';
    if (r < 0.62) return 'multi';
    if (r < 0.78) return 'slow';
    return 'shrink';
  }
  if (r < 0.15) return 'life';
  if (r < 0.30) return 'wide';
  if (r < 0.46) return 'multi';
  if (r < 0.62) return 'slow';
  return 'shrink';
}

function makeBricks(level) {
  const pattern = LEVEL_PATTERNS[(level - 1) % MAX_LEVELS];
  const bricks  = [];
  for (let r = 0; r < pattern.length; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      const hits = pattern[r][c];
      if (hits === 0) continue;
      bricks.push({
        x: c * BRICK_WIDTH, y: r + 2, w: BRICK_WIDTH,
        row: r, hits, maxHits: hits, alive: true,
        powerup: Math.random() < POWERUP_CHANCE ? pickPowerupType(level) : null,
      });
    }
  }
  return bricks;
}

export function makeLevelState(level, carry = {}) {
  const paddleX = Math.floor((WIDTH - PADDLE_WIDTH) / 2);
  return {
    paddleX,
    launched: false,
    balls: [],
    bricks: makeBricks(level),
    powerups: [],
    wideTimer: 0, shrinkTimer: 0, slowTimer: 0, naturalTickMs: null,
    score:  carry.score ?? 0,
    lives:  carry.lives ?? 3,
    level,
    gameOver: false, won: false, levelComplete: false,
    lifeLost: false,
    flashMsg: '', flashTimer: 0, flashColor: GREEN_COLOR,
    stuckTicks: 0,
  };
}

export const makeInitialState = () => makeLevelState(1);
