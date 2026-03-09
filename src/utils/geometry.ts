import { SVG_CX, SVG_CY } from '../constants/geometry';

// Convert polar coords (angle in radians, 0=top, clockwise) to SVG cartesian
export function polarToCartesian(
  r: number,
  theta: number,
  cx = SVG_CX,
  cy = SVG_CY
): { x: number; y: number } {
  const svgTheta = theta - Math.PI / 2;
  return {
    x: cx + r * Math.cos(svgTheta),
    y: cy + r * Math.sin(svgTheta),
  };
}

// Build an SVG path for an annular wedge (ring sector)
// startAngle/endAngle: 0=top, clockwise, radians
export function describeSector(
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
  cx = SVG_CX,
  cy = SVG_CY
): string {
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  const outerStart = polarToCartesian(outerR, startAngle, cx, cy);
  const outerEnd = polarToCartesian(outerR, endAngle, cx, cy);
  const innerEnd = polarToCartesian(innerR, endAngle, cx, cy);
  const innerStart = polarToCartesian(innerR, startAngle, cx, cy);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

// Month angle helpers (radians, 0=top, clockwise)
export function monthStartAngle(month: number): number {
  return ((month - 1) / 12) * 2 * Math.PI;
}

export function monthEndAngle(month: number): number {
  return (month / 12) * 2 * Math.PI;
}

export function monthMidAngle(month: number): number {
  return ((month - 0.5) / 12) * 2 * Math.PI;
}

// Day angle helpers (within month view, days fill 0..2π)
export function dayStartAngle(dayIndex: number, totalDays: number): number {
  return (dayIndex / totalDays) * 2 * Math.PI;
}

export function dayEndAngle(dayIndex: number, totalDays: number): number {
  return ((dayIndex + 1) / totalDays) * 2 * Math.PI;
}

export function dayMidAngle(dayIndex: number, totalDays: number): number {
  return ((dayIndex + 0.5) / totalDays) * 2 * Math.PI;
}

// Label placement: position + rotation for text at arc midpoint
export function arcLabelPlacement(
  midAngle: number,
  r: number,
  cx = SVG_CX,
  cy = SVG_CY
): { x: number; y: number; rotation: number } {
  const pos = polarToCartesian(r, midAngle, cx, cy);
  let rotation = (midAngle * 180) / Math.PI;
  // Flip text on bottom half so it reads left-to-right
  if (midAngle > Math.PI) {
    rotation += 180;
  }
  return { x: pos.x, y: pos.y, rotation };
}

// ─── Archimedean Spiral helpers ───────────────────────────────────────────────
//
// All years share the same 12 angular positions (Jan at top, Dec at bottom).
// Years differ by radial position: innermost = oldest, outermost = newest.
//
// r_inner(α, yearIndex) = SPIRAL_A + SPIRAL_B × (α + yearIndex × 2π)
// r_outer(α, yearIndex) = r_inner(α, yearIndex) + SPIRAL_B × 2π
//
// This gives constant radial band width (= SPIRAL_B × 2π) and seamless
// adjacency between consecutive year bands.

interface SpiralParams {
  a: number;         // innermost inner radius (px)
  b: number;         // radial growth per radian (px/rad)
  bandWidth: number; // b × 2π  (constant radial thickness per year band)
}

export function getSpiralParams(
  numYears: number,
  cx = SVG_CX,
  cy = SVG_CY
): SpiralParams {
  const maxR = Math.min(cx, cy) - 22; // e.g. 378
  const minR = 28;                     // innermost inner radius
  // At θ=2π (end of last year outer edge): r = minR + b×(numYears+1)×2π = maxR
  const b = (maxR - minR) / ((numYears + 1) * 2 * Math.PI);
  return { a: minR, b, bandWidth: b * 2 * Math.PI };
}

// Inner radius at angle α for yearIndex
function rInner(alpha: number, yearIndex: number, p: SpiralParams): number {
  return p.a + p.b * (alpha + yearIndex * 2 * Math.PI);
}

// Outer radius at angle α for yearIndex
function rOuter(alpha: number, yearIndex: number, p: SpiralParams): number {
  return rInner(alpha, yearIndex, p) + p.bandWidth;
}

// SVG path for one month sector in the spiral view.
// yearIndex: 0 = innermost (oldest), numYears-1 = outermost (newest)
// month: 1-12, segments: polyline quality
export function describeSpiralSector(
  yearIndex: number,
  numYears: number,
  month: number,
  segments = 48,
  cx = SVG_CX,
  cy = SVG_CY
): string {
  const p = getSpiralParams(numYears, cx, cy);
  const alphaStart = ((month - 1) / 12) * 2 * Math.PI;
  const alphaEnd = (month / 12) * 2 * Math.PI;

  const fmt = (n: number) => n.toFixed(2);

  // Outer arc: clockwise from alphaStart → alphaEnd
  const parts: string[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = alphaStart + (i / segments) * (alphaEnd - alphaStart);
    const { x, y } = polarToCartesian(rOuter(t, yearIndex, p), t, cx, cy);
    parts.push(i === 0 ? `M ${fmt(x)} ${fmt(y)}` : `L ${fmt(x)} ${fmt(y)}`);
  }

  // Inner arc: counterclockwise from alphaEnd → alphaStart
  for (let i = 0; i <= segments; i++) {
    const t = alphaEnd - (i / segments) * (alphaEnd - alphaStart);
    const { x, y } = polarToCartesian(rInner(t, yearIndex, p), t, cx, cy);
    parts.push(`L ${fmt(x)} ${fmt(y)}`);
  }

  parts.push('Z');
  return parts.join(' ');
}

// Label position for a month sector in spiral mode
export function spiralLabelPlacement(
  yearIndex: number,
  numYears: number,
  month: number,
  cx = SVG_CX,
  cy = SVG_CY
): { x: number; y: number; rotation: number } {
  const p = getSpiralParams(numYears, cx, cy);
  const alphaMid = ((month - 0.5) / 12) * 2 * Math.PI;
  const rMid = (rInner(alphaMid, yearIndex, p) + rOuter(alphaMid, yearIndex, p)) / 2;
  return arcLabelPlacement(alphaMid, rMid, cx, cy);
}

// Year label position (at θ=0, top of band)
export function spiralYearLabelPos(
  yearIndex: number,
  numYears: number,
  cx = SVG_CX,
  cy = SVG_CY
): { x: number; y: number } {
  const p = getSpiralParams(numYears, cx, cy);
  const alpha = 0; // top (Jan boundary)
  const rMid = (rInner(alpha, yearIndex, p) + rOuter(alpha, yearIndex, p)) / 2;
  return polarToCartesian(rMid, alpha, cx, cy);
}

// Radius for the "today" indicator arc (dashed ring) in spiral mode
export function spiralTodayRadius(
  yearIndex: number,
  numYears: number,
  cx = SVG_CX,
  cy = SVG_CY
): number {
  const p = getSpiralParams(numYears, cx, cy);
  const alpha = Math.PI;
  return (rInner(alpha, yearIndex, p) + rOuter(alpha, yearIndex, p)) / 2;
}

// ── Event visualization helpers ───────────────────────────────────────────────

// Simple open arc at fixed radius (for circular-mode event arcs).
// Returns an SVG "M … A …" path (no fill, intended for stroke use).
export function describeCircularArc(
  r: number,
  startAngle: number,
  endAngle: number,
  cx = SVG_CX,
  cy = SVG_CY
): string {
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const start = polarToCartesian(r, startAngle, cx, cy);
  const end   = polarToCartesian(r, endAngle,   cx, cy);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

// Polyline arc slightly outside the spiral band's outer edge (for spiral-mode event arcs).
export function describeSpiralEventArc(
  yearIndex: number,
  numYears: number,
  startMonth: number,  // 1-12 within this year
  endMonth: number,    // 1-12 within this year
  offset = 5,          // px gap beyond the band outer edge
  segments = 48,
  cx = SVG_CX,
  cy = SVG_CY
): string {
  const p = getSpiralParams(numYears, cx, cy);
  const alphaStart = ((startMonth - 1) / 12) * 2 * Math.PI;
  const alphaEnd   = (endMonth         / 12) * 2 * Math.PI;

  const fmt = (n: number) => n.toFixed(2);
  const parts: string[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = alphaStart + (i / segments) * (alphaEnd - alphaStart);
    const r = rOuter(t, yearIndex, p) + offset;
    const { x, y } = polarToCartesian(r, t, cx, cy);
    parts.push(i === 0 ? `M ${fmt(x)} ${fmt(y)}` : `L ${fmt(x)} ${fmt(y)}`);
  }
  return parts.join(' ');
}

// Small dot position for a single-day event on the spiral/circular view.
// Returns the cartesian position at monthMidAngle, just outside the outer edge.
export function eventDotPos(
  yearIndex: number,
  numYears: number,
  month: number,
  viewMode: 'circular' | 'spiral',
  circularOuterR: number,  // only used in circular mode
  cx = SVG_CX,
  cy = SVG_CY
): { x: number; y: number } {
  const alpha = monthMidAngle(month);
  if (viewMode === 'spiral') {
    const p = getSpiralParams(numYears, cx, cy);
    const r = rOuter(alpha, yearIndex, p) + 8;
    return polarToCartesian(r, alpha, cx, cy);
  }
  return polarToCartesian(circularOuterR + 8, alpha, cx, cy);
}
