export const SVG_WIDTH = 800;
export const SVG_HEIGHT = 800;
export const SVG_CX = SVG_WIDTH / 2;
export const SVG_CY = SVG_HEIGHT / 2;

// Years view: 5 rings (currentYear ± 2)
export const YEARS_VIEW_RINGS = [
  { innerR: 60,  outerR: 105 },
  { innerR: 110, outerR: 155 },
  { innerR: 160, outerR: 205 },
  { innerR: 210, outerR: 255 },
  { innerR: 260, outerR: 305 },
];

// Year view: single ring with 12 month sectors
export const YEAR_VIEW_INNER_R = 100;
export const YEAR_VIEW_OUTER_R = 340;

// Month view: days fill full 360°
export const MONTH_VIEW_INNER_R = 60;
export const MONTH_VIEW_OUTER_R = 370;

// Week view
export const WEEK_VIEW_INNER_R = 80;
export const WEEK_VIEW_OUTER_R = 370;

// Spiral params
export const SPIRAL_A = 80;  // px, starting radius
export const SPIRAL_B = 40;  // px per radian

// Transition duration in ms
export const TRANSITION_MS = 175;

// Month angle helpers (0=top, clockwise, in radians)
export const MONTH_ANGLE = (2 * Math.PI) / 12; // π/6 per month
