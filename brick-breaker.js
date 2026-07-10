#!/usr/bin/env node
'use strict';

const WIDTH          = 40;
const HEIGHT         = 22;
const PADDLE_WIDTH   = 7;
const BRICK_COLS     = 10;
const BRICK_WIDTH    = Math.floor(WIDTH / BRICK_COLS);
const MAX_LEVELS     = 5;
const MAX_LIVES      = 5;
const BONUS_DURATION   = 300;
const SLOW_DURATION    = 400;
const SHRINK_DURATION  = 250;
const POWERUP_CHANCE   = 0.12;
const STUCK_THRESHOLD  = 150;

const LEVEL_PATTERNS = [
  [[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1]],
  [[2,2,2,2,2,2,2,2,2,2],[2,2,2,2,2,2,2,2,2,2],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1]],
  [[3,0,3,0,3,0,3,0,3,0],[0,2,2,0,2,2,0,2,2,0],[1,1,2,1,1,2,1,1,2,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1]],
  [[0,0,0,3,3,3,3,0,0,0],[0,0,2,2,2,2,2,2,0,0],[0,2,2,2,2,2,2,2,2,0],[1,1,1,1,2,2,1,1,1,1],[1,1,1,1,1,1,1,1,1,1]],
  [[3,3,3,3,3,3,3,3,3,3],[3,3,3,3,3,3,3,3,3,3],[2,2,2,2,2,2,2,2,2,2],[2,2,2,2,2,2,2,2,2,2],[1,1,1,1,1,1,1,1,1,1]],
];

const bg = (r, g, b) => `\x1b[48;2;${r};${g};${b}m`;
const fg = (r, g, b) => `\x1b[38;2;${r};${g};${b}m`;

const BRICK_COLORS = [
  [bg(237,135,150), bg(168, 82, 98), bg(100, 45, 58)],
  [bg(245,169,127), bg(183,112, 75), bg(112, 62, 38)],
  [bg(238,212,159), bg(178,152,103), bg(108, 88, 56)],
  [bg(166,218,149), bg(106,155, 92), bg( 58, 92, 48)],
  [bg(138,173,244), bg( 80,115,182), bg( 40, 62,110)],
];

const PADDLE_COLOR        = bg(139, 213, 202);
const PADDLE_WIDE_COLOR   = bg(125, 196, 228);
const PADDLE_SHRINK_COLOR = bg(237, 135, 150);
const BALL_COLOR          = fg(183, 189, 248);
const OVERLAY_COLOR       = fg(110, 115, 141);
const TEXT_COLOR          = fg(202, 211, 245);
const RED_COLOR           = fg(237, 135, 150);
const YELLOW_COLOR        = fg(238, 212, 159);
const GREEN_COLOR         = fg(166, 218, 149);
const BLUE_COLOR          = fg(138, 173, 244);
const PEACH_COLOR         = fg(245, 169, 127);
const MAUVE_COLOR         = fg(198, 160, 246);

const RESET       = '\x1b[0m';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

const GRID_ROW_OFFSET = 3;
const GRID_COL_OFFSET = 2;
const at = (row, col) => `\x1b[${row};${col}H`;

const POWERUP_STYLES = {
  life:   { char: '+', color: RED_COLOR   },
  wide:   { char: 'W', color: GREEN_COLOR },
  multi:  { char: '*', color: MAUVE_COLOR },
  slow:   { char: 'S', color: BLUE_COLOR  },
  shrink: { char: '!', color: PEACH_COLOR },
};

const FLASH_MSGS = {
  life:   '+Vie !',
  wide:   'Large !',
  multi:  'Multi !',
  slow:   'Lent !',
  shrink: 'Petit !',
};

function getSpeedLevels(level) {
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

function makeLevelState(level, carry = {}) {
  const paddleX = Math.floor((WIDTH - PADDLE_WIDTH) / 2);
  return {
    paddleX,
    launched: false,
    balls: [],
    bricks: makeBricks(level),
    powerups: [],
    wideTimer: 0, shrinkTimer: 0, slowTimer: 0, naturalTickMs: null,
    score: carry.score ?? 0,
    lives: carry.lives ?? 3,
    level,
    gameOver: false, won: false, levelComplete: false,
    lifeLost: false,
    flashMsg: '', flashTimer: 0, flashColor: GREEN_COLOR,
    stuckTicks: 0,
  };
}

const makeInitialState = () => makeLevelState(1);

let state     = makeInitialState();
let highScore = 0;

const effectivePaddleWidth = () => Math.max(3,
  PADDLE_WIDTH + (state.wideTimer > 0 ? 4 : 0) - (state.shrinkTimer > 0 ? 3 : 0)
);

const ballOnPaddleX = () => Math.round(state.paddleX + effectivePaddleWidth() / 2);

function resetBall() {
  state.balls      = [];
  state.launched   = false;
  state.stuckTicks = 0;
}

function launchBall() {
  if (state.launched) return;
  state.launched = true;
  const x = Math.max(1, Math.min(WIDTH - 2, ballOnPaddleX() + (Math.random() < 0.5 ? 0 : 1)));
  state.balls = [{ x, y: HEIGHT - 3, vx: Math.random() < 0.5 ? -1 : 1, vy: -1 }];
}

function movePaddle(dir) {
  state.paddleX = Math.max(0, Math.min(WIDTH - PADDLE_WIDTH, state.paddleX + dir * 3));
}

function applyPowerup(type) {
  state.flashMsg   = FLASH_MSGS[type] ?? type;
  state.flashTimer = 90;
  state.flashColor = type === 'shrink' ? PEACH_COLOR : GREEN_COLOR;

  if (type === 'life') {
    state.lives = Math.min(MAX_LIVES, state.lives + 1);
  } else if (type === 'wide') {
    state.wideTimer = Math.min(state.wideTimer + BONUS_DURATION, BONUS_DURATION * 2);
  } else if (type === 'multi') {
    if (!state.launched) {
      launchBall();
    } else if (state.balls.length > 0) {
      const ref = state.balls[0];
      const nx  = Math.max(1, Math.min(WIDTH - 2, ref.x + (ref.vx > 0 ? -2 : 2)));
      state.balls.push({ x: nx, y: Math.max(0, ref.y - 1), vx: -ref.vx, vy: -1 });
    }
  } else if (type === 'slow') {
    if (state.slowTimer === 0) state.naturalTickMs = currentTickMs;
    state.slowTimer = Math.min(state.slowTimer + SLOW_DURATION, SLOW_DURATION * 2);
    setSpeed(Math.min(200, (state.naturalTickMs ?? currentTickMs) * 2));
  } else if (type === 'shrink') {
    state.shrinkTimer = SHRINK_DURATION;
  }
}

function updateSpeed() {
  if (state.slowTimer > 0) return;
  const total = state.bricks.length;
  if (total === 0) return;
  const frac   = state.bricks.filter(b => !b.alive).length / total;
  const levels = getSpeedLevels(state.level);
  const lvl    = levels.filter(l => frac >= l.frac).pop();
  if (lvl.tickMs !== currentTickMs) setSpeed(lvl.tickMs);
}

function stepBall(ball) {
  ball.x += ball.vx;
  ball.y += ball.vy;

  let hitWall = false;
  if (ball.x <= 0)              { ball.x = 0;          ball.vx =  Math.abs(ball.vx); hitWall = true; }
  else if (ball.x >= WIDTH - 1) { ball.x = WIDTH - 1;  ball.vx = -Math.abs(ball.vx); hitWall = true; }
  if (ball.y <= 0)              { ball.y = 0;           ball.vy =  Math.abs(ball.vy); }

  if (hitWall && state.stuckTicks > STUCK_THRESHOLD) {
    ball.x = Math.max(1, Math.min(WIDTH - 2, ball.x + 1));
  }

  const bx = Math.round(ball.x);
  const by = Math.round(ball.y);
  const py = HEIGHT - 2;
  const pw = effectivePaddleWidth();

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

function update() {
  if (state.gameOver || state.levelComplete) return;

  if (state.wideTimer   > 0) state.wideTimer--;
  if (state.shrinkTimer > 0) state.shrinkTimer--;
  if (state.flashTimer  > 0) state.flashTimer--;
  if (state.slowTimer   > 0) {
    state.slowTimer--;
    if (state.slowTimer === 0 && state.naturalTickMs !== null) {
      setSpeed(state.naturalTickMs);
      state.naturalTickMs = null;
      updateSpeed();
    }
  }

  const py = HEIGHT - 2;
  const pw = effectivePaddleWidth();

  state.powerups = state.powerups.filter(p => {
    p.y++;
    if (p.y >= py) {
      if (p.x >= state.paddleX - 1 && p.x <= state.paddleX + pw) applyPowerup(p.type);
      return false;
    }
    return true;
  });

  if (!state.launched) return;

  let hitBrick = false;
  state.balls = state.balls.filter(ball => {
    const result = stepBall(ball);
    if (result === 'brick') hitBrick = true;
    return result !== 'dead';
  });

  if (hitBrick) { state.stuckTicks = 0; updateSpeed(); }
  else          { state.stuckTicks++; }

  if (state.balls.length === 0) {
    state.lives--;
    if (state.lives <= 0) {
      state.gameOver = true;
      state.won      = false;
      highScore = Math.max(highScore, state.score);
    } else {
      resetBall();
      state.lifeLost = true;
    }
    return;
  }

  if (state.bricks.every(b => !b.alive)) {
    if (state.level >= MAX_LEVELS) {
      state.gameOver = true;
      state.won      = true;
      highScore = Math.max(highScore, state.score);
    } else {
      state.levelComplete = true;
    }
  }
}

let prevGrid          = null;
let prevColorGrid     = null;
let prevGameOver      = null;
let prevLifeLost      = false;
let prevLevelComplete = false;

function resetRender() {
  prevGrid          = null;
  prevColorGrid     = null;
  prevGameOver      = null;
  prevLifeLost      = false;
  prevLevelComplete = false;
}

function buildGrid() {
  const grid      = Array.from({ length: HEIGHT }, () => new Array(WIDTH).fill(' '));
  const colorGrid = Array.from({ length: HEIGHT }, () => new Array(WIDTH).fill(null));

  for (const b of state.bricks) {
    if (!b.alive) continue;
    const healthIdx = b.maxHits === 1 ? 0
      : b.hits === b.maxHits ? 0
      : b.hits === 1 ? 2
      : 1;
    const brickColor = BRICK_COLORS[b.row % 5][healthIdx];
    const char       = healthIdx === 0 ? ' ' : healthIdx === 1 ? '▒' : '░';
    const cellColor  = healthIdx > 0 ? brickColor + '\x1b[37m' : brickColor;
    for (let dx = 0; dx < b.w - 1; dx++) {
      const x = b.x + dx;
      if (x >= 0 && x < WIDTH) { grid[b.y][x] = char; colorGrid[b.y][x] = cellColor; }
    }
  }

  const py  = HEIGHT - 2;
  const pw  = effectivePaddleWidth();
  const pcol = state.shrinkTimer > 0 ? PADDLE_SHRINK_COLOR
             : state.wideTimer   > 0 ? PADDLE_WIDE_COLOR
             : PADDLE_COLOR;
  for (let dx = 0; dx < pw; dx++) {
    const x = state.paddleX + dx;
    if (x >= 0 && x < WIDTH) { grid[py][x] = ' '; colorGrid[py][x] = pcol; }
  }

  for (const p of state.powerups) {
    if (p.y >= 0 && p.y < HEIGHT && p.x >= 0 && p.x < WIDTH) {
      const s = POWERUP_STYLES[p.type];
      grid[p.y][p.x]      = s.char;
      colorGrid[p.y][p.x] = s.color;
    }
  }

  if (!state.launched) {
    const bx = ballOnPaddleX();
    const by = HEIGHT - 3;
    if (by >= 0 && by < HEIGHT && bx >= 0 && bx < WIDTH) {
      grid[by][bx] = '●'; colorGrid[by][bx] = BALL_COLOR;
    }
  }

  for (const ball of state.balls) {
    const bx = Math.round(ball.x);
    const by = Math.round(ball.y);
    if (by >= 0 && by < HEIGHT && bx >= 0 && bx < WIDTH) {
      grid[by][bx] = '●'; colorGrid[by][bx] = BALL_COLOR;
    }
  }

  return { grid, colorGrid };
}

function initScreen() {
  process.stdout.write('\x1b[2J' + HIDE_CURSOR + OVERLAY_COLOR);
  process.stdout.write(at(2, 1) + '┌' + '─'.repeat(WIDTH) + '┐');
  process.stdout.write(at(HEIGHT + 3, 1) + '└' + '─'.repeat(WIDTH) + '┘');
  let borders = '';
  for (let y = 0; y < HEIGHT; y++) {
    borders += at(y + GRID_ROW_OFFSET, 1) + '│' + at(y + GRID_ROW_OFFSET, WIDTH + 2) + '│';
  }
  process.stdout.write(borders + RESET);
}

function renderHeader() {
  const score = YELLOW_COLOR + String(state.score).padEnd(6) + RESET;
  const lvl   = MAUVE_COLOR  + `Niv.${state.level}/${MAX_LEVELS}` + RESET;
  const hi    = OVERLAY_COLOR + `Hi:${String(highScore).padEnd(5)}` + RESET;
  process.stdout.write(
    at(1, 1) + TEXT_COLOR +
    `Score: ${score} ${lvl}  ${hi}  Espace: lancer  Q/D: bouger` +
    RESET
  );
}

function renderLives() {
  const col = WIDTH + 4;
  for (let i = 0; i < MAX_LIVES; i++) {
    process.stdout.write(
      at(GRID_ROW_OFFSET + i, col) +
      (i < state.lives ? RED_COLOR + '♥' : OVERLAY_COLOR + '♡') + RESET
    );
  }
  const flashRow = GRID_ROW_OFFSET + MAX_LIVES + 1;
  if (state.flashTimer > 0) {
    process.stdout.write(at(flashRow, col) + state.flashColor + state.flashMsg.substring(0, 8) + RESET);
  } else {
    process.stdout.write(at(flashRow, col) + '        ');
  }
}

function renderGridDiff(grid, colorGrid) {
  let out = '';
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!prevGrid || grid[y][x] !== prevGrid[y][x] || colorGrid[y][x] !== prevColorGrid[y][x]) {
        const ch    = grid[y][x];
        const color = colorGrid[y][x];
        out += at(y + GRID_ROW_OFFSET, x + GRID_COL_OFFSET) + (color ? `${color}${ch}${RESET}` : ch);
      }
    }
  }
  if (out) process.stdout.write(out);
  prevGrid      = grid;
  prevColorGrid = colorGrid;
}

function renderOverlay(color, title, sub) {
  const midRow   = Math.floor(HEIGHT / 2) + GRID_ROW_OFFSET;
  const titleCol = Math.floor((WIDTH - title.length) / 2) + GRID_COL_OFFSET;
  const subCol   = Math.floor((WIDTH - sub.length)   / 2) + GRID_COL_OFFSET;
  process.stdout.write(
    at(midRow - 1, titleCol) + color      + title + RESET +
    at(midRow + 1, subCol)   + TEXT_COLOR + sub   + RESET
  );
}

function render() {
  const { grid, colorGrid } = buildGrid();
  renderHeader();

  const changed = state.lifeLost !== prevLifeLost
    || state.gameOver      !== prevGameOver
    || state.levelComplete !== prevLevelComplete;
  if (changed) {
    prevGrid          = null;
    prevLifeLost      = state.lifeLost;
    prevGameOver      = state.gameOver;
    prevLevelComplete = state.levelComplete;
  }

  renderGridDiff(grid, colorGrid);
  renderLives();

  if (state.gameOver) {
    renderOverlay(
      state.won ? GREEN_COLOR : RED_COLOR,
      state.won ? 'VICTOIRE !' : 'GAME OVER',
      'R : Rejouer    Ctrl+C : Quitter'
    );
  } else if (state.levelComplete) {
    renderOverlay(GREEN_COLOR, `Niveau ${state.level} termine !`, 'Espace pour continuer...');
  } else if (state.lifeLost) {
    renderOverlay(RED_COLOR, 'Vie perdue !', 'Espace pour relancer');
  }
}

function handleKey(key) {
  if (key === '\x03') { cleanupAndExit(); return; }

  if (state.gameOver && (key === 'r' || key === 'R')) {
    highScore = Math.max(highScore, state.score);
    state     = makeInitialState();
    resetRender();
    setSpeed(getSpeedLevels(1)[0].tickMs);
    return;
  }

  if (state.levelComplete && key === ' ') {
    state = makeLevelState(state.level + 1, { score: state.score, lives: state.lives });
    resetRender();
    setSpeed(getSpeedLevels(state.level)[0].tickMs);
    return;
  }

  if (key === ' ') {
    if (state.lifeLost) state.lifeLost = false;
    launchBall();
    return;
  }

  if (key === '\x1b[C' || key === 'd' || key === 'D') movePaddle(1);
  else if (key === '\x1b[D' || key === 'q' || key === 'Q') movePaddle(-1);
}

function cleanupAndExit() {
  clearInterval(loopHandle);
  process.stdout.write(SHOW_CURSOR + '\x1b[2J\x1b[H');
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stdin.pause();
  process.exit(0);
}

function setSpeed(tickMs) {
  currentTickMs = tickMs;
  clearInterval(loopHandle);
  loopHandle = setInterval(gameLoop, tickMs);
}

function gameLoop() { update(); render(); }

if (!process.stdin.isTTY) {
  console.error('Ce jeu necessite un vrai terminal (TTY). Lance-le avec `node brick-breaker.js`.');
  process.exit(1);
}

process.stdin.setEncoding('utf8');
process.stdin.setRawMode(true);
process.stdin.resume();

initScreen();

let currentTickMs = getSpeedLevels(1)[0].tickMs;
let loopHandle    = setInterval(gameLoop, currentTickMs);

process.stdin.on('data', handleKey);
process.on('SIGINT', cleanupAndExit);
process.on('exit', () => process.stdout.write(SHOW_CURSOR));
