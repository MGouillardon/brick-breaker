#!/usr/bin/env node
'use strict';

const WIDTH = 40;
const HEIGHT = 22;
const PADDLE_WIDTH = 7;
const BRICK_ROWS = 5;
const BRICK_COLS = 10;
const BRICK_WIDTH = Math.floor(WIDTH / BRICK_COLS);
const TICK_MS = 60;

const BRICK_COLORS = ['\x1b[41m', '\x1b[43m', '\x1b[42m', '\x1b[44m', '\x1b[45m'];
const RESET = '\x1b[0m';
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
  return {
    paddleX: Math.floor((WIDTH - PADDLE_WIDTH) / 2),
    ballX: WIDTH / 2,
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
  state.ballX = state.paddleX + PADDLE_WIDTH / 2;
  state.ballY = HEIGHT - 3;
  state.ballVX = 0;
  state.ballVY = 0;
  state.launched = false;
}

function launchBall() {
  if (state.launched) return;
  state.launched = true;
  state.ballVX = Math.random() < 0.5 ? -0.5 : 0.5;
  state.ballVY = -1;
}

function movePaddle(dir) {
  state.paddleX = Math.max(0, Math.min(WIDTH - PADDLE_WIDTH, state.paddleX + dir * 3));
}

function update() {
  if (state.gameOver) return;

  if (!state.launched) {
    state.ballX = state.paddleX + PADDLE_WIDTH / 2;
    return;
  }

  state.ballX += state.ballVX;
  state.ballY += state.ballVY;

  if (state.ballX <= 0)              { state.ballX = 0;          state.ballVX *= -1; }
  else if (state.ballX >= WIDTH - 1) { state.ballX = WIDTH - 1;  state.ballVX *= -1; }
  if (state.ballY <= 0)              { state.ballY = 0;           state.ballVY *= -1; }

  const py = HEIGHT - 2;
  if (Math.round(state.ballY) === py && state.ballVY > 0) {
    if (state.ballX >= state.paddleX - 0.5 && state.ballX <= state.paddleX + PADDLE_WIDTH + 0.5) {
      const hitPos = (state.ballX - state.paddleX) / PADDLE_WIDTH;
      state.ballVX = (hitPos - 0.5) * 2;
      state.ballVY = -Math.abs(state.ballVY);
      state.ballY = py - 1;
    }
  }

  if (state.ballY >= HEIGHT - 1) {
    state.lives--;
    if (state.lives <= 0) { state.gameOver = true; state.won = false; }
    else resetBall();
    return;
  }

  const bx = Math.round(state.ballX);
  const by = Math.round(state.ballY);
  for (const b of state.bricks) {
    if (b.alive && by === b.y && bx >= b.x && bx < b.x + b.w - 1) {
      b.alive = false;
      state.score += 10;
      state.ballVY *= -1;
      break;
    }
  }

  if (state.bricks.every((b) => !b.alive)) {
    state.gameOver = true;
    state.won = true;
  }
}

let prevGrid = null;
let prevColorGrid = null;
let prevGameOver = null;

function resetRender() {
  prevGrid = null;
  prevColorGrid = null;
  prevGameOver = null;
}

function buildGrid() {
  const grid = Array.from({ length: HEIGHT }, () => new Array(WIDTH).fill(' '));
  const colorGrid = Array.from({ length: HEIGHT }, () => new Array(WIDTH).fill(null));

  for (const b of state.bricks) {
    if (!b.alive) continue;
    for (let dx = 0; dx < b.w - 1; dx++) {
      const x = b.x + dx;
      if (x >= 0 && x < WIDTH) { grid[b.y][x] = '█'; colorGrid[b.y][x] = b.color; }
    }
  }

  const py = HEIGHT - 2;
  for (let dx = 0; dx < PADDLE_WIDTH; dx++) {
    const x = state.paddleX + dx;
    if (x >= 0 && x < WIDTH) grid[py][x] = '=';
  }

  const bx = Math.round(state.ballX);
  const by = Math.round(state.ballY);
  if (by >= 0 && by < HEIGHT && bx >= 0 && bx < WIDTH) grid[by][bx] = 'O';

  return { grid, colorGrid };
}

function initScreen() {
  process.stdout.write('\x1b[2J' + HIDE_CURSOR);
  process.stdout.write(at(2, 1) + '┌' + '─'.repeat(WIDTH) + '┐');
  process.stdout.write(at(HEIGHT + 3, 1) + '└' + '─'.repeat(WIDTH) + '┘');
  let borders = '';
  for (let y = 0; y < HEIGHT; y++) {
    borders += at(y + GRID_ROW_OFFSET, 1) + '│' + at(y + GRID_ROW_OFFSET, WIDTH + 2) + '│';
  }
  process.stdout.write(borders);
}

function renderHeader() {
  const hearts = '♥'.repeat(Math.max(state.lives, 0));
  process.stdout.write(
    at(1, 1) +
    `Score: ${String(state.score).padEnd(5)} Vies: ${hearts.padEnd(3)}  Espace: lancer  ←/→: bouger  Ctrl+C: quitter`
  );
}

function renderGridDiff(grid, colorGrid) {
  let out = '';
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!prevGrid || grid[y][x] !== prevGrid[y][x] || colorGrid[y][x] !== prevColorGrid[y][x]) {
        const ch = grid[y][x];
        const color = colorGrid[y][x];
        out += at(y + GRID_ROW_OFFSET, x + GRID_COL_OFFSET) + (color ? `${color}${ch}${RESET}` : ch);
      }
    }
  }
  if (out) process.stdout.write(out);
  prevGrid = grid;
  prevColorGrid = colorGrid;
}

function renderFooter() {
  const row = HEIGHT + 4;
  const msg = state.won ? '🎉 GAGNÉ ! Toutes les briques détruites. 🎉' : '💥 GAME OVER 💥';
  process.stdout.write(at(row, 1) + msg + at(row + 1, 1) + 'Appuie sur Ctrl+C pour quitter, ou R pour rejouer.');
}

function clearFooter() {
  const row = HEIGHT + 4;
  const blank = ' '.repeat(WIDTH + 2);
  process.stdout.write(at(row, 1) + blank + at(row + 1, 1) + blank);
}

function render() {
  const { grid, colorGrid } = buildGrid();
  renderHeader();
  renderGridDiff(grid, colorGrid);
  if (state.gameOver !== prevGameOver) {
    state.gameOver ? renderFooter() : clearFooter();
    prevGameOver = state.gameOver;
  }
}

function handleKey(key) {
  if (key === '') { cleanupAndExit(); return; }
  if (state.gameOver && (key === 'r' || key === 'R')) { state = makeInitialState(); resetRender(); return; }
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

if (!process.stdin.isTTY) {
  console.error('Ce jeu nécessite un vrai terminal (TTY). Lance-le avec `node brick-breaker.js`.');
  process.exit(1);
}

process.stdin.setEncoding('utf8');
process.stdin.setRawMode(true);
process.stdin.resume();

initScreen();

const loopHandle = setInterval(() => { update(); render(); }, TICK_MS);

process.stdin.on('data', handleKey);
process.on('exit', () => process.stdout.write(SHOW_CURSOR));
