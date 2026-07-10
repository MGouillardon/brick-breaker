let _handle    = null;
let _tickMs    = 82;
let _gameLoop  = null;

export function init(gameLoop) { _gameLoop = gameLoop; }

export function setSpeed(tickMs) {
  _tickMs = tickMs;
  clearInterval(_handle);
  _handle = setInterval(_gameLoop, tickMs);
}

export function start(tickMs) {
  _tickMs = tickMs;
  _handle = setInterval(_gameLoop, tickMs);
}

export function stop()      { clearInterval(_handle); }
export const   getTickMs = () => _tickMs;
