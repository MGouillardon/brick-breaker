#!/usr/bin/env node
import { SHOW_CURSOR } from './src/constants.js';
import { makeInitialState, makeLevelState, getSpeedLevels } from './src/state.js';
import { update, launchBall, movePaddle } from './src/physics.js';
import { render, initScreen, resetRender } from './src/render.js';
import * as loop from './src/loop.js';

let state     = makeInitialState();
let highScore = 0;

function gameLoop() {
  update(state);
  render(state, highScore);
}

loop.init(gameLoop);

function handleKey(key) {
  if (key === '\x03') { cleanupAndExit(); return; }

  if (state.gameOver && (key === 'r' || key === 'R')) {
    highScore = Math.max(highScore, state.score);
    state     = makeInitialState();
    resetRender();
    loop.setSpeed(getSpeedLevels(1)[0].tickMs);
    return;
  }

  if (state.levelComplete && key === ' ') {
    state = makeLevelState(state.level + 1, { score: state.score, lives: state.lives });
    resetRender();
    loop.setSpeed(getSpeedLevels(state.level)[0].tickMs);
    return;
  }

  if (key === ' ') {
    if (state.lifeLost) state.lifeLost = false;
    launchBall(state);
    return;
  }

  if      (key === '\x1b[C' || key === 'd' || key === 'D') movePaddle(state,  1);
  else if (key === '\x1b[D' || key === 'q' || key === 'Q') movePaddle(state, -1);
}

function cleanupAndExit() {
  loop.stop();
  process.stdout.write(SHOW_CURSOR + '\x1b[2J\x1b[H');
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stdin.pause();
  process.exit(0);
}

if (!process.stdin.isTTY) {
  console.error('Ce jeu necessite un vrai terminal (TTY). Lance-le avec `node brick-breaker.js`.');
  process.exit(1);
}

process.stdin.setEncoding('utf8');
process.stdin.setRawMode(true);
process.stdin.resume();

initScreen();
loop.start(getSpeedLevels(1)[0].tickMs);

process.stdin.on('data', handleKey);
process.on('SIGINT', cleanupAndExit);
process.on('exit', () => process.stdout.write(SHOW_CURSOR));
