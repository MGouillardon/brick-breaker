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

function render() {
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

  const header = `Score: ${state.score}   Vies: ${'♥'.repeat(Math.max(state.lives, 0))}  Espace: lancer  ←/→: bouger  Ctrl+C: quitter\n`;
  const body = grid
    .map((row, y) => {
      const line = row.map((ch, x) => (colorGrid[y][x] ? `${colorGrid[y][x]}${ch}${RESET}` : ch)).join('');
      return `│${line}│`;
    })
    .join('\n');
  const footer = state.gameOver
    ? (state.won ? '\n🎉 GAGNÉ ! Toutes les briques détruites. 🎉\n' : '\n💥 GAME OVER 💥\n') +
      'Appuie sur Ctrl+C pour quitter, ou R pour rejouer.\n'
    : '';

  process.stdout.write(
    '\x1b[H' + header +
    '┌' + '─'.repeat(WIDTH) + '┐\n' +
    body + '\n' +
    '└' + '─'.repeat(WIDTH) + '┘\n' +
    footer
  );
}

function handleKey(key) {
  if (key === '') { cleanupAndExit(); return; }
  if (state.gameOver && (key === 'r' || key === 'R')) { state = makeInitialState(); return; }
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
process.stdout.write('\x1b[2J' + HIDE_CURSOR);

const loopHandle = setInterval(() => { update(); render(); }, TICK_MS);

process.stdin.on('data', handleKey);
process.on('exit', () => process.stdout.write(SHOW_CURSOR));
