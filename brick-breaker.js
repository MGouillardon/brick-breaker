#!/usr/bin/env node
'use strict';

/**
 * Brick Breaker - terminal, pur Node.js, aucune dépendance.
 * Contrôles : ←/→ (ou Q/D) pour bouger la raquette, Espace pour lancer la balle, Ctrl+C pour quitter.
 */

const WIDTH = 40;         // largeur du terrain de jeu
const HEIGHT = 22;        // hauteur du terrain de jeu
const PADDLE_WIDTH = 7;
const BRICK_ROWS = 5;
const BRICK_COLS = 10;
const BRICK_WIDTH = Math.floor(WIDTH / BRICK_COLS);
const TICK_MS = 40;       // ~25 FPS

const BRICK_COLORS = ['\x1b[41m', '\x1b[43m', '\x1b[42m', '\x1b[44m', '\x1b[45m'];
const RESET = '\x1b[0m';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

function makeBricks() {
  const bricks = [];
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      bricks.push({ x: c * BRICK_WIDTH, y: r + 2, w: BRICK_WIDTH, alive: true, color: BRICK_COLORS[r % BRICK_COLORS.length] });
    }
  }
  return bricks;
}

const state = {
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
  paused: false,
};

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

function render() {
  const grid = [];
  for (let y = 0; y < HEIGHT; y++) {
    grid.push(new Array(WIDTH).fill(' '));
  }
  const colorGrid = [];
  for (let y = 0; y < HEIGHT; y++) colorGrid.push(new Array(WIDTH).fill(null));

  // briques
  for (const b of state.bricks) {
    if (!b.alive) continue;
    for (let dx = 0; dx < b.w - 1; dx++) {
      const x = b.x + dx;
      if (x >= 0 && x < WIDTH) {
        grid[b.y][x] = '█';
        colorGrid[b.y][x] = b.color;
      }
    }
  }

  // raquette
  const py = HEIGHT - 2;
  for (let dx = 0; dx < PADDLE_WIDTH; dx++) {
    const x = state.paddleX + dx;
    if (x >= 0 && x < WIDTH) grid[py][x] = '=';
  }

  // balle
  const bx = Math.round(state.ballX);
  const by = Math.round(state.ballY);
  if (by >= 0 && by < HEIGHT && bx >= 0 && bx < WIDTH) {
    grid[by][bx] = 'O';
  }

  let out = '';
  out += `Score: ${state.score}   Vies: ${'♥'.repeat(Math.max(state.lives, 0))}${'  Espace: lancer  ←/→: bouger  Ctrl+C: quitter'}\n`;
  out += '┌' + '─'.repeat(WIDTH) + '┐\n';
  for (let y = 0; y < HEIGHT; y++) {
    let line = '│';
    for (let x = 0; x < WIDTH; x++) {
      const ch = grid[y][x];
      const col = colorGrid[y][x];
      line += col ? col + ch + RESET : ch;
    }
    line += '│\n';
    out += line;
  }
  out += '└' + '─'.repeat(WIDTH) + '┘\n';

  if (state.gameOver) {
    out += state.won ? '\n🎉 GAGNÉ ! Toutes les briques détruites. 🎉\n' : '\n💥 GAME OVER 💥\n';
    out += 'Appuie sur Ctrl+C pour quitter, ou R pour rejouer.\n';
  }

  process.stdout.write('\x1b[H' + out);
}

function update() {
  if (state.gameOver || state.paused) return;

  if (!state.launched) {
    state.ballX = state.paddleX + PADDLE_WIDTH / 2;
    return;
  }

  state.ballX += state.ballVX;
  state.ballY += state.ballVY;

  // rebonds murs
  if (state.ballX <= 0) {
    state.ballX = 0;
    state.ballVX *= -1;
  } else if (state.ballX >= WIDTH - 1) {
    state.ballX = WIDTH - 1;
    state.ballVX *= -1;
  }
  if (state.ballY <= 0) {
    state.ballY = 0;
    state.ballVY *= -1;
  }

  // rebond raquette
  const py = HEIGHT - 2;
  if (Math.round(state.ballY) === py && state.ballVY > 0) {
    const bx = state.ballX;
    if (bx >= state.paddleX - 0.5 && bx <= state.paddleX + PADDLE_WIDTH + 0.5) {
      const hitPos = (bx - state.paddleX) / PADDLE_WIDTH; // 0..1
      state.ballVX = (hitPos - 0.5) * 2; // -1..1 selon l'endroit touché
      state.ballVY = -Math.abs(state.ballVY);
      state.ballY = py - 1;
    }
  }

  // balle perdue
  if (state.ballY >= HEIGHT - 1) {
    state.lives -= 1;
    if (state.lives <= 0) {
      state.gameOver = true;
      state.won = false;
    } else {
      resetBall();
    }
    return;
  }

  // collision briques
  const bx = Math.round(state.ballX);
  const by = Math.round(state.ballY);
  for (const b of state.bricks) {
    if (!b.alive) continue;
    if (by === b.y && bx >= b.x && bx < b.x + b.w - 1) {
      b.alive = false;
      state.score += 10;
      state.ballVY *= -1;
      break;
    }
  }

  // victoire
  if (state.bricks.every(b => !b.alive)) {
    state.gameOver = true;
    state.won = true;
  }
}

function movePaddle(dir) {
  state.paddleX += dir * 3;
  if (state.paddleX < 0) state.paddleX = 0;
  if (state.paddleX > WIDTH - PADDLE_WIDTH) state.paddleX = WIDTH - PADDLE_WIDTH;
}

function restart() {
  state.paddleX = Math.floor((WIDTH - PADDLE_WIDTH) / 2);
  state.bricks = makeBricks();
  state.score = 0;
  state.lives = 3;
  state.gameOver = false;
  state.won = false;
  resetBall();
}

function cleanupAndExit() {
  clearInterval(loopHandle);
  process.stdout.write(SHOW_CURSOR + '\x1b[2J\x1b[H');
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stdin.pause();
  process.exit(0);
}

// --- Input ---
process.stdin.setEncoding('utf8');
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
} else {
  console.error("Ce jeu nécessite un vrai terminal (TTY) pour capter les touches. Lance-le directement avec `node brick-breaker.js` dans un terminal.");
  process.exit(1);
}
process.stdin.resume();

process.stdin.on('data', (key) => {
  if (key === '\u0003') { // Ctrl+C
    cleanupAndExit();
    return;
  }
  if (state.gameOver && (key === 'r' || key === 'R')) {
    restart();
    return;
  }
  if (key === ' ') {
    launchBall();
    return;
  }
  // flèches : séquences ANSI \x1b[C (droite) et \x1b[D (gauche)
  if (key === '\x1b[C' || key === 'd' || key === 'D') {
    movePaddle(1);
  } else if (key === '\x1b[D' || key === 'q' || key === 'Q') {
    movePaddle(-1);
  }
});

// --- Boucle de jeu ---
process.stdout.write('\x1b[2J' + HIDE_CURSOR);
const loopHandle = setInterval(() => {
  update();
  render();
}, TICK_MS);

process.on('exit', () => {
  process.stdout.write(SHOW_CURSOR);
});
