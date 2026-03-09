// Month colors (1-indexed: index 0 = January)
export const MONTH_COLORS: Record<number, string> = {
  1:  '#B8D4E8',
  2:  '#C9DCF0',
  3:  '#C8E6C9',
  4:  '#A8D5A2',
  5:  '#D4EDAA',
  6:  '#FFF9A0',
  7:  '#FFE599',
  8:  '#FFCC80',
  9:  '#FFAB76',
  10: '#F4A261',
  11: '#D4A0B5',
  12: '#B0C4DE',
};

// Slightly darker hover variants
export const MONTH_COLORS_HOVER: Record<number, string> = {
  1:  '#9BC3DC',
  2:  '#B0CCE6',
  3:  '#AACFAA',
  4:  '#8CC486',
  5:  '#BEDC8E',
  6:  '#EDE880',
  7:  '#EED480',
  8:  '#EFBA60',
  9:  '#EF9A58',
  10: '#E08C4A',
  11: '#C08EA0',
  12: '#9AB4CC',
};

// Event color palette (8 options for user to pick from)
export const EVENT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

// Selection/range overlay colors
export const SELECTION_FILL = 'rgba(99, 102, 241, 0.35)';
export const RANGE_FILL = 'rgba(99, 102, 241, 0.18)';
export const TODAY_STROKE = '#EF4444';
export const ANCHOR_FILL = 'rgba(99, 102, 241, 0.55)';
