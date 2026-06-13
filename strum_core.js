// strum_core.js — pure, browser-free strum-detection logic.
// Imported by strum_live.html (in the browser) and by strum_core.test.mjs
// (in Node). Must not reference DOM, canvas, MediaPipe, or globals.

// ── stats ──────────────────────────────────────────────────────────────
export function meanStd(arr) {
  const n = arr.length;
  if (!n) return { mean: 0, std: 1 };
  const mean = arr.reduce((s, v) => s + v, 0) / n;
  const std = n > 2
    ? Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / n)
    : 1;
  return { mean, std };
}

// ── geometry ───────────────────────────────────────────────────────────
const PALM_IDS = [0, 5, 9, 13, 17];

export function palmCenter(landmarks) {
  let sx = 0, sy = 0;
  for (const i of PALM_IDS) { sx += landmarks[i].x; sy += landmarks[i].y; }
  return { x: sx / PALM_IDS.length, y: sy / PALM_IDS.length };
}

// Signed displacement along whichever axis moved more (handles any camera
// angle): vertical strums report dy, sideways strums report dx.
export function dominantAxisDelta(prev, cur) {
  const dx = cur.x - prev.x;
  const dy = cur.y - prev.y;
  return Math.abs(dy) >= Math.abs(dx) ? dy : dx;
}

export function classifyDir(vel) {
  return vel >= 0 ? 'down' : 'up';
}

// ── audio onset ────────────────────────────────────────────────────────
const DB_FLOOR = -140;
const finiteOr = (v, fb) => (Number.isFinite(v) ? v : fb);

// Spectral flux: sum of positive bin-to-bin increases. Returns the flux and
// the array to carry forward as "previous".
export function spectralFlux(freq, freqPrev) {
  let flux = 0;
  const nextPrev = new Float32Array(freq.length);
  for (let i = 0; i < freq.length; i++) {
    const a = finiteOr(freq[i], DB_FLOOR);
    const b = finiteOr(freqPrev[i], DB_FLOOR);
    const d = a - b;
    if (d > 0) flux += d;
    nextPrev[i] = a;
  }
  return { flux, nextPrev };
}

// Adaptive-threshold onset decision over recent flux history.
export function audioOnsetDecision({
  flux, histVals, k, minFlux, dtSinceLast, refractory,
}) {
  const { mean, std } = meanStd(histVals);
  return flux > mean + k * std
      && flux > minFlux
      && dtSinceLast > refractory;
}

// Map UI sensitivity (1..10) to a flux threshold multiplier k (2.6..0.6).
export function sensToK(sens) {
  return 2.6 - (sens - 1) * (2.6 - 0.6) / 9;
}
// Map UI sensitivity (1..10) to a motion-onset magnitude floor.
export function sensToMinMag(sens) {
  return 0.013 - (sens - 1) * (0.013 - 0.002) / 9;
}

// ── vibration envelopes (damped oscillation) ───────────────────────────
// ageSec: seconds since the triggering event. Both return 1/peak at 0 and
// settle to their rest value after the decay window.
export function vibScale(ageSec) {
  if (ageSec > 0.7) return 1;
  const env = Math.exp(-ageSec * 9);
  const osc = (1 + Math.cos(ageSec * 24)) / 2;
  return 1 + env * 0.95 * osc;
}
export function vibGlow(ageSec) {
  if (ageSec > 0.6) return 0;
  const env = Math.exp(-ageSec * 8);
  const osc = (1 + Math.cos(ageSec * 28)) / 2;
  return env * osc;
}

// ── tempo ──────────────────────────────────────────────────────────────
export function estimateBPM(downTimes) {
  if (downTimes.length < 3) return null;
  const gaps = [];
  for (let i = 1; i < downTimes.length; i++) {
    const g = downTimes[i] - downTimes[i - 1];
    if (g > 0.15 && g < 2) gaps.push(g);
  }
  if (!gaps.length) return null;
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  return Math.round(60 / median);
}

// ── HandTracker — choose the strumming hand by motion ──────────────────
// MediaPipe may return up to two hands with no stable identity. We keep
// lightweight tracks, match each frame's detections to the nearest existing
// track, and accumulate a motion score (EMA of displacement magnitude). The
// strumming hand sweeps far and fast every beat, so its motion score stays
// well above the fretting hand's. Hysteresis (switchMargin) stops the
// selection flickering when both hands move briefly.
export class HandTracker {
  constructor({
    matchDist = 0.35,   // max normalized distance to link a detection
                        // (must exceed a fast strum's per-frame travel)
    motionAlpha = 0.35, // EMA weight for the motion score
    velAlpha = 0.55,    // EMA weight for signed dominant-axis velocity
    switchMargin = 1.4, // challenger must exceed champion by this factor
    maxMissed = 8,      // drop a track after this many unseen frames
  } = {}) {
    Object.assign(this, {
      matchDist, motionAlpha, velAlpha, switchMargin, maxMissed,
    });
    this.tracks = [];     // {id,x,y,motionEMA,velEMA,missed,lastIndex}
    this.nextId = 1;
    this.chosenId = null;
  }

  update(centers) {
    // 1. greedy nearest matching of detections -> existing tracks
    const pairs = [];
    this.tracks.forEach((tr, ti) => {
      centers.forEach((c, ci) => {
        const d = Math.hypot(c.x - tr.x, c.y - tr.y);
        if (d <= this.matchDist) pairs.push({ ti, ci, d });
      });
    });
    pairs.sort((a, b) => a.d - b.d);

    const trackUsed = new Set();
    const centerUsed = new Set();
    this.tracks.forEach(tr => { tr.lastIndex = -1; tr.missed++; });

    for (const { ti, ci } of pairs) {
      if (trackUsed.has(ti) || centerUsed.has(ci)) continue;
      trackUsed.add(ti); centerUsed.add(ci);
      const tr = this.tracks[ti];
      const c = centers[ci];
      const signed = dominantAxisDelta(tr, c);
      const mag = Math.hypot(c.x - tr.x, c.y - tr.y);
      tr.motionEMA = this.motionAlpha * mag
                   + (1 - this.motionAlpha) * tr.motionEMA;
      tr.velEMA = this.velAlpha * signed + (1 - this.velAlpha) * tr.velEMA;
      tr.x = c.x; tr.y = c.y; tr.missed = 0; tr.lastIndex = ci;
    }

    // 2. unmatched detections -> new tracks
    centers.forEach((c, ci) => {
      if (centerUsed.has(ci)) return;
      this.tracks.push({
        id: this.nextId++, x: c.x, y: c.y,
        motionEMA: 0, velEMA: 0, missed: 0, lastIndex: ci,
      });
    });

    // 3. decay + retire stale tracks
    this.tracks = this.tracks.filter(tr => {
      if (tr.missed > 0) tr.motionEMA *= 0.9;
      return tr.missed <= this.maxMissed;
    });

    // 4. pick the strumming hand with hysteresis
    const visible = this.tracks.filter(tr => tr.lastIndex >= 0);
    if (!visible.length) { return { chosen: null, tracks: this.tracks }; }

    let champion = visible.reduce((a, b) =>
      b.motionEMA > a.motionEMA ? b : a);
    const current = visible.find(tr => tr.id === this.chosenId);
    if (current && current !== champion) {
      // only switch if the challenger clearly beats the incumbent
      if (champion.motionEMA < current.motionEMA * this.switchMargin) {
        champion = current;
      }
    }
    this.chosenId = champion.id;

    return {
      chosen: {
        index: champion.lastIndex,
        velEMA: champion.velEMA,
        speed: champion.motionEMA,
        id: champion.id,
      },
      tracks: this.tracks,
    };
  }
}
