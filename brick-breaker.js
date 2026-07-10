#!/usr/bin/env node
'use strict';

const WIDTH = 40;
const HEIGHT = 22;
const PADDLE_WIDTH = 7;
const BRICK_ROWS = 5;
const BRICK_COLS = 10;
const BRICK_WIDTH = Math.floor(WIDTH / BRICK_COLS);
const TOTAL_BRICKS = BRICK_ROWS * BRICK_COLS;

const SPEED_LEVELS = [
  { threshold: 0,                              tickMs: 60 },
  { threshold: Math.floor(TOTAL_BRICKS * 0.25), tickMs: 50 },
  { threshold: Math.floor(TOTAL_BRICKS * 0.50), tickMs: 40 },
  { threshold: Math.floor(TOTAL_BRICKS * 0.75), tickMs: 30 },
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
const PADDLE_COLOR  = bg(139, 213, 202);
const BALL_COLOR    = fg(183, 189, 248);
const OVERLAY_COLOR = fg(110, 115, 141);
const TEXT_COLOR    = fg(202, 211, 245);
const RED_COLOR     = fg(237, 135, 150);
const YELLOW_COLOR  = fg(238, 212, 159);
const GREEN_COLOR   = fg(166, 218, 149);

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
      bricks.push({
        x: c * BRICK_WIDTH,
        y: r + 2,
        w: BRICK_WIDTH,
        alive: true,
        color: BRICK_COLORS[r % BRICK_COLORS.length],
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
    score: 0,
    lives: 3,
    gameOver: false,
    won: false,
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

function updateSpeed() {
  const broken = state.bricks.filter((b) => !b.alive).length;
  const level = SPEED_LEVELS.filter((l) => broken >= l.threshold).pop();
  if (level.tickMs !== currentTickMs) setSpeed(level.tickMs);
}

function update() {
  if (state.gameOver) return;

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
  const py = HEIGHT - 2;

  if (by === py && state.ballVY > 0 && bx >= state.paddleX && bx < state.paddleX + PADDLE_WIDTH) {
    const hitPos = (bx - state.paddleX) / PADDLE_WIDTH;
    state.ballVX = hitPos < 0.5 ? -1 : 1;
    state.ballVY = -1;
    state.ballY = py - 1;
  }

  if (state.ballY >= py) {
    state.lives--;
    if (state.lives <= 0) { state.gameOver = true; state.won = false; }
    else resetBall();
    return;
  }

  for (const b of state.bricks) {
    if (b.alive && by === b.y && bx >= b.x && bx < b.x + b.w - 1) {
      b.alive = false;
      state.score += 10;
      state.ballVY *= -1;
      updateSpeed();
      break;
    }
  }

  if (state.bricks.every((b) => !b.alive)) {
    state.gameOver = true;
    state.won = true;
  }
}

let prevGrid     = null;
let prevColorGrid = null;
let prevGameOver = null;

function resetRender() {
  prevGrid      = null;
  prevColorGrid = null;
  prevGameOver  = null;
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

  const py = HEIGHT - 2;
  for (let dx = 0; dx < PADDLE_WIDTH; dx++) {
    const x = state.paddleX + dx;
    if (x >= 0 && x < WIDTH) { grid[py][x] = ' '; colorGrid[py][x] = PADDLE_COLOR; }
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
  const hearts = RED_COLOR + '♥'.repeat(Math.max(state.lives, 0)) + RESET +
                 ' '.repeat(Math.max(3 - state.lives, 0));
  const score  = YELLOW_COLOR + String(state.score).padEnd(5) + RESET;
  process.stdout.write(
    at(1, 1) + TEXT_COLOR +
    `Score: ${score} Vies: ${hearts}  Espace: lancer  ←/→: bouger  Ctrl+C: quitter` +
    RESET
  );
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

function renderGameOverOverlay() {
  const midRow = Math.floor(HEIGHT / 2) + GRID_ROW_OFFSET;
  const color  = state.won ? GREEN_COLOR : RED_COLOR;
  const title  = state.won ? 'GAGNÉ !' : 'GAME OVER';
  const sub    = 'R : Rejouer    Ctrl+C : Quitter';

  const titleCol = Math.floor((WIDTH - title.length) / 2) + GRID_COL_OFFSET;
  const subCol   = Math.floor((WIDTH - sub.length)   / 2) + GRID_COL_OFFSET;

  process.stdout.write(
    at(midRow - 1, titleCol) + color    + title + RESET +
    at(midRow + 1, subCol)   + TEXT_COLOR + sub  + RESET
  );
}

function render() {
  const { grid, colorGrid } = buildGrid();
  renderHeader();
  renderGridDiff(grid, colorGrid);
  if (state.gameOver !== prevGameOver) {
    prevGameOver = state.gameOver;
  }
  if (state.gameOver) renderGameOverOverlay();
}

function handleKey(key) {
  if (key === '') { cleanupAndExit(); return; }
  if (state.gameOver && (key === 'r' || key === 'R')) {
    state = makeInitialState();
    resetRender();
    setSpeed(SPEED_LEVELS[0].tickMs);
    return;
  }
  if (key === ' ') { launchBall(); return; }
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
