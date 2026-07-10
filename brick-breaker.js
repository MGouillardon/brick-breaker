#!/usr/bin/env node
'use strict';

const WIDTH = 40;
const HEIGHT = 22;
const PADDLE_WIDTH = 7;
const BRICK_ROWS = 5;
const BRICK_COLS = 10;
const BRICK_WIDTH = Math.floor(WIDTH / BRICK_COLS);
const TOTAL_BRICKS = BRICK_ROWS * BRICK_COLS;
const POWERUP_CHANCE = 0.10;
const BONUS_DURATION = 300;
const MAX_LIVES      = 5;

const SPEED_LEVELS = [
  { threshold: 0,                               tickMs: 75 },
  { threshold: Math.floor(TOTAL_BRICKS * 0.25), tickMs: 62 },
  { threshold: Math.floor(TOTAL_BRICKS * 0.50), tickMs: 50 },
  { threshold: Math.floor(TOTAL_BRICKS * 0.75), tickMs: 40 },
];

const bg  = (r, g, b) => `\x1b[48;2;${r};${g};${b}m`;
const fg  = (r, g, b) => `\x1b[38;2;${r};${g};${b}m`;

const BRICK_COLORS = [
  bg(237, 135, 150),
  bg(245, 169, 127),
  bg(238, 212, 159),
  bg(166, 218, 149),
  bg(138, 173, 244),
];
const PADDLE_COLOR      = bg(139, 213, 202);
const PADDLE_WIDE_COLOR = bg(125, 196, 228);
const BALL_COLOR        = fg(183, 189, 248);
const OVERLAY_COLOR     = fg(110, 115, 141);
const TEXT_COLOR        = fg(202, 211, 245);
const RED_COLOR         = fg(237, 135, 150);
const YELLOW_COLOR      = fg(238, 212, 159);
const GREEN_COLOR       = fg(166, 218, 149);

const RESET       = '\x1b[0m';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

const GRID_ROW_OFFSET = 3;
const GRID_COL_OFFSET = 2;
const at = (row, col) => `\x1b[${row};${col}H`;

function makeBricks() {
  const bricks = [];
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      const rand    = Math.random();
      const powerup = rand < POWERUP_CHANCE
        ? (rand < POWERUP_CHANCE / 2 ? 'life' : 'wide')
        : null;
      bricks.push({
        x: c * BRICK_WIDTH,
        y: r + 2,
        w: BRICK_WIDTH,
        alive: true,
        color: BRICK_COLORS[r % BRICK_COLORS.length],
        powerup,
      });
    }
  }
  return bricks;
}

function makeInitialState() {
  const paddleX = Math.floor((WIDTH - PADDLE_WIDTH) / 2);
  return {
    paddleX,
    ballX: Math.round(paddleX + PADDLE_WIDTH / 2),
    ballY: HEIGHT - 3,
    ballVX: 0,
    ballVY: 0,
    launched: false,
    bricks: makeBricks(),
    powerups: [],
    paddleBonus: 0,
    bonusTimer: 0,
    score: 0,
    lives: 3,
    gameOver: false,
    won: false,
    lifeLost: false,
    flashMsg: '',
    flashTimer: 0,
  };
}

let state = makeInitialState();

function resetBall() {
  state.ballX = Math.round(state.paddleX + PADDLE_WIDTH / 2);
  state.ballY = HEIGHT - 3;
  state.ballVX = 0;
  state.ballVY = 0;
  state.launched = false;
}

function launchBall() {
  if (state.launched) return;
  state.launched = true;
  state.ballVX = Math.random() < 0.5 ? -1 : 1;
  state.ballVY = -1;
}

function movePaddle(dir) {
  state.paddleX = Math.max(0, Math.min(WIDTH - PADDLE_WIDTH, state.paddleX + dir * 3));
}

function applyPowerup(type) {
  if (type === 'life') {
    state.lives    = Math.min(MAX_LIVES, state.lives + 1);
    state.flashMsg = '+♥ Vie !';
  } else if (type === 'wide') {
    state.paddleBonus = 4;
    state.bonusTimer  = Math.min(state.bonusTimer + BONUS_DURATION, BONUS_DURATION * 2);
    state.flashMsg    = '+ Large !';
  }
  state.flashTimer = 90;
}

function updateSpeed() {
  const broken = state.bricks.filter((b) => !b.alive).length;
  const level  = SPEED_LEVELS.filter((l) => broken >= l.threshold).pop();
  if (level.tickMs !== currentTickMs) setSpeed(level.tickMs);
}

function update() {
  if (state.gameOver) return;

  if (state.bonusTimer > 0) {
    state.bonusTimer--;
    if (state.bonusTimer === 0) state.paddleBonus = 0;
  }
  if (state.flashTimer > 0) state.flashTimer--;

  const py = HEIGHT - 2;
  const pw = PADDLE_WIDTH + state.paddleBonus;

  state.powerups = state.powerups.filter((p) => {
    p.y++;
    if (p.y >= py) {
      if (p.x >= state.paddleX - 1 && p.x <= state.paddleX + pw) applyPowerup(p.type);
      return false;
    }
    return true;
  });

  if (!state.launched) {
    state.ballX = Math.round(state.paddleX + PADDLE_WIDTH / 2);
    return;
  }

  state.ballX += state.ballVX;
  state.ballY += state.ballVY;

  if (state.ballX <= 0)              { state.ballX = 0;          state.ballVX =  Math.abs(state.ballVX); }
  else if (state.ballX >= WIDTH - 1) { state.ballX = WIDTH - 1;  state.ballVX = -Math.abs(state.ballVX); }
  if (state.ballY <= 0)              { state.ballY = 0;           state.ballVY =  Math.abs(state.ballVY); }

  const bx = Math.round(state.ballX);
  const by = Math.round(state.ballY);

  if (by === py && state.ballVY > 0 && bx >= state.paddleX - 1 && bx <= state.paddleX + pw) {
    const hitPos  = (bx - state.paddleX) / pw;
    state.ballVX  = hitPos < 0.5 ? -1 : 1;
    state.ballVY  = -1;
    state.ballY   = py - 1;
  }

  if (state.ballY >= py) {
    state.lives--;
    if (state.lives <= 0) { state.gameOver = true; state.won = false; }
    else { resetBall(); state.lifeLost = true; }
    return;
  }

  for (const b of state.bricks) {
    if (b.alive && by === b.y && bx >= b.x && bx < b.x + b.w - 1) {
      b.alive = false;
      state.score += 10;
      state.ballVY *= -1;
      if (b.powerup) {
        state.powerups.push({ x: b.x + Math.floor((b.w - 2) / 2), y: b.y, type: b.powerup });
      }
      updateSpeed();
      break;
    }
  }

  if (state.bricks.every((b) => !b.alive)) {
    state.gameOver = true;
    state.won = true;
  }
}

let prevGrid      = null;
let prevColorGrid = null;
let prevGameOver  = null;
let prevLifeLost  = false;

function resetRender() {
  prevGrid      = null;
  prevColorGrid = null;
  prevGameOver  = null;
  prevLifeLost  = false;
}

function buildGrid() {
  const grid      = Array.from({ length: HEIGHT }, () => new Array(WIDTH).fill(' '));
  const colorGrid = Array.from({ length: HEIGHT }, () => new Array(WIDTH).fill(null));

  for (const b of state.bricks) {
    if (!b.alive) continue;
    for (let dx = 0; dx < b.w - 1; dx++) {
      const x = b.x + dx;
      if (x >= 0 && x < WIDTH) { grid[b.y][x] = ' '; colorGrid[b.y][x] = b.color; }
    }
  }

  const py    = HEIGHT - 2;
  const pw    = PADDLE_WIDTH + state.paddleBonus;
  const pcol  = state.paddleBonus > 0 ? PADDLE_WIDE_COLOR : PADDLE_COLOR;
  for (let dx = 0; dx < pw; dx++) {
    const x = state.paddleX + dx;
    if (x >= 0 && x < WIDTH) { grid[py][x] = ' '; colorGrid[py][x] = pcol; }
  }

  for (const p of state.powerups) {
    if (p.y >= 0 && p.y < HEIGHT && p.x >= 0 && p.x < WIDTH) {
      grid[p.y][p.x]      = p.type === 'life' ? '♥' : '+';
      colorGrid[p.y][p.x] = p.type === 'life' ? RED_COLOR : GREEN_COLOR;
    }
  }

  const bx = Math.round(state.ballX);
  const by = Math.round(state.ballY);
  if (by >= 0 && by < HEIGHT && bx >= 0 && bx < WIDTH) {
    grid[by][bx]      = '●';
    colorGrid[by][bx] = BALL_COLOR;
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
  const score = YELLOW_COLOR + String(state.score).padEnd(5) + RESET;
  process.stdout.write(
    at(1, 1) + TEXT_COLOR +
    `Score: ${score}  Espace: lancer  ←/→: bouger  Ctrl+C: quitter` +
    RESET
  );
}

function renderLives() {
  const col = WIDTH + 4;
  for (let i = 0; i < MAX_LIVES; i++) {
    const row = GRID_ROW_OFFSET + i;
    process.stdout.write(
      at(row, col) + (i < state.lives ? RED_COLOR + '♥' : OVERLAY_COLOR + '♡') + RESET
    );
  }
  const flashRow = GRID_ROW_OFFSET + MAX_LIVES + 1;
  const msg = state.flashTimer > 0 ? state.flashMsg : '        ';
  const col2 = state.flashTimer > 0 ? GREEN_COLOR : '';
  process.stdout.write(at(flashRow, col) + col2 + msg + RESET);
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

function renderLifeLostOverlay() {
  const midRow = Math.floor(HEIGHT / 2) + GRID_ROW_OFFSET;
  const title  = 'Vie perdue !';
  const sub    = 'Espace pour relancer';
  const titleCol = Math.floor((WIDTH - title.length) / 2) + GRID_COL_OFFSET;
  const subCol   = Math.floor((WIDTH - sub.length)   / 2) + GRID_COL_OFFSET;
  process.stdout.write(
    at(midRow - 1, titleCol) + RED_COLOR  + title + RESET +
    at(midRow + 1, subCol)   + TEXT_COLOR + sub   + RESET
  );
}

function renderGameOverOverlay() {
  const midRow = Math.floor(HEIGHT / 2) + GRID_ROW_OFFSET;
  const color  = state.won ? GREEN_COLOR : RED_COLOR;
  const title  = state.won ? 'GAGNÉ !' : 'GAME OVER';
  const sub    = 'R : Rejouer    Ctrl+C : Quitter';

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

  if (state.lifeLost !== prevLifeLost || state.gameOver !== prevGameOver) {
    prevGrid     = null;
    prevLifeLost = state.lifeLost;
    prevGameOver = state.gameOver;
  }

  renderGridDiff(grid, colorGrid);
  renderLives();

  if (state.gameOver)      renderGameOverOverlay();
  else if (state.lifeLost) renderLifeLostOverlay();
}

function handleKey(key) {
  if (key === '\x03') { cleanupAndExit(); return; }
  if (state.gameOver && (key === 'r' || key === 'R')) {
    state = makeInitialState();
    resetRender();
    setSpeed(SPEED_LEVELS[0].tickMs);
    return;
  }
  if (key === ' ') { state.lifeLost = false; launchBall(); return; }
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
  console.error('Ce jeu nécessite un vrai terminal (TTY). Lance-le avec `node brick-breaker.js`.');
  process.exit(1);
}

process.stdin.setEncoding('utf8');
process.stdin.setRawMode(true);
process.stdin.resume();

initScreen();

let currentTickMs = SPEED_LEVELS[0].tickMs;
let loopHandle    = setInterval(gameLoop, currentTickMs);

process.stdin.on('data', handleKey);
process.on('SIGINT', cleanupAndExit);
process.on('exit', () => process.stdout.write(SHOW_CURSOR));
