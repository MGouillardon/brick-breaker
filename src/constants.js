export const WIDTH          = 40;
export const HEIGHT         = 22;
export const PADDLE_WIDTH   = 7;
export const BRICK_COLS     = 10;
export const BRICK_WIDTH    = Math.floor(WIDTH / BRICK_COLS);
export const MAX_LEVELS     = 5;
export const MAX_LIVES      = 5;
export const BONUS_DURATION   = 300;
export const SLOW_DURATION    = 400;
export const SHRINK_DURATION  = 250;
export const POWERUP_CHANCE   = 0.12;
export const STUCK_THRESHOLD  = 150;

export const LEVEL_PATTERNS = [
  [[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1]],
  [[2,2,2,2,2,2,2,2,2,2],[2,2,2,2,2,2,2,2,2,2],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1]],
  [[3,0,3,0,3,0,3,0,3,0],[0,2,2,0,2,2,0,2,2,0],[1,1,2,1,1,2,1,1,2,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1]],
  [[0,0,0,3,3,3,3,0,0,0],[0,0,2,2,2,2,2,2,0,0],[0,2,2,2,2,2,2,2,2,0],[1,1,1,1,2,2,1,1,1,1],[1,1,1,1,1,1,1,1,1,1]],
  [[3,3,3,3,3,3,3,3,3,3],[3,3,3,3,3,3,3,3,3,3],[2,2,2,2,2,2,2,2,2,2],[2,2,2,2,2,2,2,2,2,2],[1,1,1,1,1,1,1,1,1,1]],
];

const bg = (r, g, b) => `\x1b[48;2;${r};${g};${b}m`;
const fg = (r, g, b) => `\x1b[38;2;${r};${g};${b}m`;
export { bg, fg };

export const BRICK_COLORS = [
  [bg(237,135,150), bg(168, 82, 98), bg(100, 45, 58)],
  [bg(245,169,127), bg(183,112, 75), bg(112, 62, 38)],
  [bg(238,212,159), bg(178,152,103), bg(108, 88, 56)],
  [bg(166,218,149), bg(106,155, 92), bg( 58, 92, 48)],
  [bg(138,173,244), bg( 80,115,182), bg( 40, 62,110)],
];

export const PADDLE_COLOR        = bg(139, 213, 202);
export const PADDLE_WIDE_COLOR   = bg(125, 196, 228);
export const PADDLE_SHRINK_COLOR = bg(237, 135, 150);
export const BALL_COLOR          = fg(183, 189, 248);
export const OVERLAY_COLOR       = fg(110, 115, 141);
export const TEXT_COLOR          = fg(202, 211, 245);
export const RED_COLOR           = fg(237, 135, 150);
export const YELLOW_COLOR        = fg(238, 212, 159);
export const GREEN_COLOR         = fg(166, 218, 149);
export const BLUE_COLOR          = fg(138, 173, 244);
export const PEACH_COLOR         = fg(245, 169, 127);
export const MAUVE_COLOR         = fg(198, 160, 246);

export const RESET       = '\x1b[0m';
export const HIDE_CURSOR = '\x1b[?25l';
export const SHOW_CURSOR = '\x1b[?25h';

export const GRID_ROW_OFFSET = 3;
export const GRID_COL_OFFSET = 2;
export const at = (row, col) => `\x1b[${row};${col}H`;

export const POWERUP_STYLES = {
  life:   { char: '+', color: RED_COLOR   },
  wide:   { char: 'W', color: GREEN_COLOR },
  multi:  { char: '*', color: MAUVE_COLOR },
  slow:   { char: 'S', color: BLUE_COLOR  },
  shrink: { char: '!', color: PEACH_COLOR },
};

export const FLASH_MSGS = {
  life:   '+Vie !',
  wide:   'Large !',
  multi:  'Multi !',
  slow:   'Lent !',
  shrink: 'Petit !',
};
