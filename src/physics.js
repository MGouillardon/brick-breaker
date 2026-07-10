import {
  WIDTH, HEIGHT, PADDLE_WIDTH, MAX_LEVELS,
  MAX_LIVES, BONUS_DURATION, SLOW_DURATION, SHRINK_DURATION, STUCK_THRESHOLD,
  FLASH_MSGS, PEACH_COLOR, GREEN_COLOR,
} from './constants.js';
import { effectivePaddleWidth, ballOnPaddleX, getSpeedLevels } from './state.js';
import { setSpeed, getTickMs } from './loop.js';

export function resetBall(state) {
  state.balls      = [];
  state.launched   = false;
  state.stuckTicks = 0;
}

export function launchBall(state) {
  if (state.launched) return;
  state.launched = true;
  const x = Math.max(1, Math.min(WIDTH - 2,
    ballOnPaddleX(state) + (Math.random() < 0.5 ? 0 : 1)
  ));
  state.balls = [{ x, y: HEIGHT - 3, vx: Math.random() < 0.5 ? -1 : 1, vy: -1 }];
}

export function movePaddle(state, dir) {
  state.paddleX = Math.max(0, Math.min(WIDTH - PADDLE_WIDTH, state.paddleX + dir * 3));
}

export function applyPowerup(state, type) {
  state.flashMsg   = FLASH_MSGS[type] ?? type;
  state.flashTimer = 90;
  state.flashColor = type === 'shrink' ? PEACH_COLOR : GREEN_COLOR;

  if (type === 'life') {
    state.lives = Math.min(MAX_LIVES, state.lives + 1);
  } else if (type === 'wide') {
    state.wideTimer = Math.min(state.wideTimer + BONUS_DURATION, BONUS_DURATION * 2);
  } else if (type === 'multi') {
    if (!state.launched) {
      launchBall(state);
    } else if (state.balls.length > 0) {
      const ref = state.balls[0];
      const nx  = Math.max(1, Math.min(WIDTH - 2, ref.x + (ref.vx > 0 ? -2 : 2)));
      state.balls.push({ x: nx, y: Math.max(0, ref.y - 1), vx: -ref.vx, vy: -1 });
    }
  } else if (type === 'slow') {
    if (state.slowTimer === 0) state.naturalTickMs = getTickMs();
    state.slowTimer = Math.min(state.slowTimer + SLOW_DURATION, SLOW_DURATION * 2);
    setSpeed(Math.min(200, (state.naturalTickMs ?? getTickMs()) * 2));
  } else if (type === 'shrink') {
    state.shrinkTimer = SHRINK_DURATION;
  }
}

function updateSpeed(state) {
  if (state.slowTimer > 0) return;
  const total = state.bricks.length;
  if (total === 0) return;
  const frac   = state.bricks.filter(b => !b.alive).length / total;
  const levels = getSpeedLevels(state.level);
  const lvl    = levels.filter(l => frac >= l.frac).pop();
  if (lvl.tickMs !== getTickMs()) setSpeed(lvl.tickMs);
}

function stepBall(state, ball) {
  ball.x += ball.vx;
  ball.y += ball.vy;

  let hitWall = false;
  if (ball.x <= 0)             { ball.x = 0;         ball.vx =  Math.abs(ball.vx); hitWall = true; }
  else if (ball.x >= WIDTH-1)  { ball.x = WIDTH-1;   ball.vx = -Math.abs(ball.vx); hitWall = true; }
  if (ball.y <= 0)             { ball.y = 0;          ball.vy =  Math.abs(ball.vy); }

  if (hitWall && state.stuckTicks > STUCK_THRESHOLD) {
    ball.x = Math.max(1, Math.min(WIDTH - 2, ball.x + 1));
  }

  const bx = Math.round(ball.x);
  const by = Math.round(ball.y);
  const py = HEIGHT - 2;
  const pw = effectivePaddleWidth(state);

  if (by === py && ball.vy > 0 && bx >= state.paddleX - 1 && bx <= state.paddleX + pw) {
    const hitPos = (bx - state.paddleX) / pw;
    ball.vx = hitPos < 0.5 ? -1 : 1;
    ball.vy = -1;
    ball.y  = py - 1;
    ball.x  = Math.max(1, Math.min(WIDTH - 2, ball.x + (Math.random() < 0.5 ? 1 : -1)));
    state.stuckTicks = 0;
    return 'paddle';
  }

  if (ball.y >= py) return 'dead';

  for (const b of state.bricks) {
    if (!b.alive) continue;
    if (by === b.y && bx >= b.x && bx < b.x + b.w - 1) {
      b.hits--;
      state.score += 10 * state.level;
      if (b.hits === 0) {
        b.alive = false;
        if (b.powerup) {
          state.powerups.push({ x: b.x + Math.floor((b.w - 2) / 2), y: b.y, type: b.powerup });
        }
      }
      ball.vy *= -1;
      return 'brick';
    }
  }

  return 'alive';
}

export function update(state) {
  if (state.gameOver || state.levelComplete) return;

  if (state.wideTimer   > 0) state.wideTimer--;
  if (state.shrinkTimer > 0) state.shrinkTimer--;
  if (state.flashTimer  > 0) state.flashTimer--;
  if (state.slowTimer   > 0) {
    state.slowTimer--;
    if (state.slowTimer === 0 && state.naturalTickMs !== null) {
      setSpeed(state.naturalTickMs);
      state.naturalTickMs = null;
      updateSpeed(state);
    }
  }

  const py = HEIGHT - 2;
  const pw = effectivePaddleWidth(state);

  state.powerups = state.powerups.filter(p => {
    p.y++;
    if (p.y >= py) {
      if (p.x >= state.paddleX - 1 && p.x <= state.paddleX + pw) applyPowerup(state, p.type);
      return false;
    }
    return true;
  });

  if (!state.launched) return;

  let hitBrick = false;
  state.balls = state.balls.filter(ball => {
    const result = stepBall(state, ball);
    if (result === 'brick') hitBrick = true;
    return result !== 'dead';
  });

  if (hitBrick) { state.stuckTicks = 0; updateSpeed(state); }
  else          { state.stuckTicks++; }

  if (state.balls.length === 0) {
    state.lives--;
    if (state.lives <= 0) {
      state.gameOver = true;
      state.won      = false;
    } else {
      resetBall(state);
      state.lifeLost = true;
    }
    return;
  }

  if (state.bricks.every(b => !b.alive)) {
    if (state.level >= MAX_LEVELS) {
      state.gameOver = true;
      state.won      = true;
    } else {
      state.levelComplete = true;
    }
  }
}
