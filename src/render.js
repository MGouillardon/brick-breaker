import {
  WIDTH, HEIGHT, MAX_LIVES, MAX_LEVELS,
  BRICK_COLORS, PADDLE_COLOR, PADDLE_WIDE_COLOR, PADDLE_SHRINK_COLOR,
  BALL_COLOR, OVERLAY_COLOR, TEXT_COLOR, RED_COLOR, YELLOW_COLOR, GREEN_COLOR, MAUVE_COLOR,
  RESET, HIDE_CURSOR, POWERUP_STYLES,
  GRID_ROW_OFFSET, GRID_COL_OFFSET, at,
} from './constants.js';
import { effectivePaddleWidth, ballOnPaddleX } from './state.js';

let prevGrid          = null;
let prevColorGrid     = null;
let prevGameOver      = null;
let prevLifeLost      = false;
let prevLevelComplete = false;

export function resetRender() {
  prevGrid          = null;
  prevColorGrid     = null;
  prevGameOver      = null;
  prevLifeLost      = false;
  prevLevelComplete = false;
}

function buildGrid(state) {
  const grid      = Array.from({ length: HEIGHT }, () => new Array(WIDTH).fill(' '));
  const colorGrid = Array.from({ length: HEIGHT }, () => new Array(WIDTH).fill(null));

  for (const b of state.bricks) {
    if (!b.alive) continue;
    const healthIdx = b.maxHits === 1 ? 0
      : b.hits === b.maxHits ? 0
      : b.hits === 1         ? 2
      : 1;
    const brickColor = BRICK_COLORS[b.row % 5][healthIdx];
    const char       = healthIdx === 0 ? ' ' : healthIdx === 1 ? '▒' : '░';
    const cellColor  = healthIdx > 0 ? brickColor + '\x1b[37m' : brickColor;
    for (let dx = 0; dx < b.w - 1; dx++) {
      const x = b.x + dx;
      if (x >= 0 && x < WIDTH) { grid[b.y][x] = char; colorGrid[b.y][x] = cellColor; }
    }
  }

  const py   = HEIGHT - 2;
  const pw   = effectivePaddleWidth(state);
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
    const bx = ballOnPaddleX(state);
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

export function initScreen() {
  process.stdout.write('\x1b[2J' + HIDE_CURSOR + OVERLAY_COLOR);
  process.stdout.write(at(2, 1) + '┌' + '─'.repeat(WIDTH) + '┐');
  process.stdout.write(at(HEIGHT + 3, 1) + '└' + '─'.repeat(WIDTH) + '┘');
  let borders = '';
  for (let y = 0; y < HEIGHT; y++) {
    borders += at(y + GRID_ROW_OFFSET, 1) + '│'
             + at(y + GRID_ROW_OFFSET, WIDTH + 2) + '│';
  }
  process.stdout.write(borders + RESET);
}

function renderHeader(state, highScore) {
  const score = YELLOW_COLOR + String(state.score).padEnd(6)          + RESET;
  const lvl   = MAUVE_COLOR  + `Niv.${state.level}/${MAX_LEVELS}`    + RESET;
  const hi    = OVERLAY_COLOR + `Hi:${String(highScore).padEnd(5)}`   + RESET;
  process.stdout.write(
    at(1, 1) + TEXT_COLOR +
    `Score: ${score} ${lvl}  ${hi}  Espace: lancer  Q/D: bouger` +
    RESET
  );
}

function renderLives(state) {
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
        out += at(y + GRID_ROW_OFFSET, x + GRID_COL_OFFSET)
             + (color ? `${color}${ch}${RESET}` : ch);
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
    at(midRow - 1, titleCol) + color        + title + RESET +
    at(midRow + 1, subCol)   + TEXT_COLOR   + sub   + RESET
  );
}

export function render(state, highScore) {
  const { grid, colorGrid } = buildGrid(state);
  renderHeader(state, highScore);

  const changed = state.lifeLost      !== prevLifeLost
    || state.gameOver      !== prevGameOver
    || state.levelComplete !== prevLevelComplete;
  if (changed) {
    prevGrid          = null;
    prevLifeLost      = state.lifeLost;
    prevGameOver      = state.gameOver;
    prevLevelComplete = state.levelComplete;
  }

  renderGridDiff(grid, colorGrid);
  renderLives(state);

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
