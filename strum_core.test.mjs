// Tests for strum_core.js — pure, browser-free strum-detection logic.
// Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as core from './strum_core.js';
import {
  meanStd, palmCenter, dominantAxisDelta, classifyDir,
  spectralFlux, audioOnsetDecision, vibScale, vibGlow,
  estimateBPM, HandTracker, calcCanvasSize, uiScale,
  replayAudioOnsets, patternRegularity, patternScore, sweepSensitivity,
} from './strum_core.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const approx = (a, b, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) <= eps, `${a} !~= ${b}`);

// ── meanStd ────────────────────────────────────────────────────────────
test('meanStd: population mean and std', () => {
  const { mean, std } = meanStd([2, 4, 4, 4, 5, 5, 7, 9]);
  approx(mean, 5);
  approx(std, 2);
});
test('meanStd: empty array is safe', () => {
  const { mean, std } = meanStd([]);
  approx(mean, 0);
  approx(std, 1); // fallback std so thresholds stay finite
});

// ── palmCenter ─────────────────────────────────────────────────────────
test('palmCenter: averages the five palm landmarks', () => {
  const lm = Array.from({ length: 21 }, (_, i) => ({ x: i, y: i * 2 }));
  const c = palmCenter(lm);
  approx(c.x, (0 + 5 + 9 + 13 + 17) / 5); // 8.8
  approx(c.y, 17.6);
});

// ── dominantAxisDelta ──────────────────────────────────────────────────
test('dominantAxisDelta: picks the larger-magnitude axis (vertical)', () => {
  approx(dominantAxisDelta({ x: 0, y: 0 }, { x: 0.1, y: 0.3 }), 0.3);
});
test('dominantAxisDelta: picks horizontal when it dominates, keeps sign', () => {
  approx(dominantAxisDelta({ x: 0, y: 0 }, { x: -0.4, y: 0.2 }), -0.4);
});

// ── classifyDir ────────────────────────────────────────────────────────
test('classifyDir: non-negative is down, negative is up', () => {
  assert.equal(classifyDir(0.3), 'down');
  assert.equal(classifyDir(0), 'down');
  assert.equal(classifyDir(-0.01), 'up');
});

// ── spectralFlux ───────────────────────────────────────────────────────
test('spectralFlux: sums only positive bin increases', () => {
  const { flux, nextPrev } = spectralFlux(
    [-90, -60, -25], [-100, -50, -30]);
  approx(flux, 15); // +10 (bin0) + +5 (bin2); bin1 dropped
  assert.deepEqual(Array.from(nextPrev), [-90, -60, -25]);
});
test('spectralFlux: treats -Infinity / NaN as floor (-140)', () => {
  const { flux } = spectralFlux([-Infinity, NaN], [-Infinity, -140]);
  approx(flux, 0);
});

// ── audioOnsetDecision ─────────────────────────────────────────────────
test('audioOnsetDecision: fires on a clear spike past threshold', () => {
  const hist = [2, 3, 2, 3, 2, 3];
  const ok = audioOnsetDecision({
    flux: 40, histVals: hist, k: 2.6, minFlux: 3,
    dtSinceLast: 0.5, refractory: 0.1,
  });
  assert.equal(ok, true);
});
test('audioOnsetDecision: suppressed inside refractory window', () => {
  const hist = [2, 3, 2, 3, 2, 3];
  const ok = audioOnsetDecision({
    flux: 40, histVals: hist, k: 2.6, minFlux: 3,
    dtSinceLast: 0.05, refractory: 0.1,
  });
  assert.equal(ok, false);
});
test('audioOnsetDecision: suppressed below absolute minFlux', () => {
  const ok = audioOnsetDecision({
    flux: 2, histVals: [0, 0, 0], k: 2.6, minFlux: 3,
    dtSinceLast: 1, refractory: 0.1,
  });
  assert.equal(ok, false);
});

// ── vibration envelopes ────────────────────────────────────────────────
test('vibScale: peaks (~1.95) at impact, returns to 1 after decay', () => {
  approx(vibScale(0), 1.95, 1e-6);
  assert.equal(vibScale(0.8), 1);
  assert.ok(vibScale(0.05) > 1 && vibScale(0.05) < 1.95);
});
test('vibGlow: 1 at impact, 0 after decay', () => {
  approx(vibGlow(0), 1, 1e-6);
  assert.equal(vibGlow(0.7), 0);
});

// ── estimateBPM ────────────────────────────────────────────────────────
test('estimateBPM: 0.5 s spacing => 120 BPM', () => {
  assert.equal(estimateBPM([0, 0.5, 1.0, 1.5, 2.0]), 120);
});
test('estimateBPM: needs >=3 downstrokes else null', () => {
  assert.equal(estimateBPM([0, 0.5]), null);
});
test('estimateBPM: ignores implausible gaps (<0.15 or >2 s)', () => {
  // gaps: 0.5, 0.02(drop), 0.48 -> median ~0.5 -> 120
  assert.equal(estimateBPM([0, 0.5, 0.52, 1.0]), 120);
});

// ── HandTracker: the strumming-hand selector ───────────────────────────
test('HandTracker: picks the oscillating (strumming) hand over a still one', () => {
  const tr = new HandTracker();
  const STILL = { x: 0.80, y: 0.50 };        // fretting hand, fixed
  let chosen = null;
  for (let f = 0; f < 12; f++) {
    const moving = { x: 0.30, y: 0.50 + (f % 2 ? 0.12 : -0.12) }; // strums
    chosen = tr.update([STILL, moving]).chosen; // index 0 = still, 1 = moving
  }
  assert.ok(chosen, 'a hand should be chosen');
  assert.equal(chosen.index, 1, 'the moving hand (index 1) must win');
  assert.ok(chosen.speed > 0, 'chosen hand reports motion');
});

test('HandTracker: chosen velEMA tracks the strumming hand sign', () => {
  const tr = new HandTracker();
  const STILL = { x: 0.80, y: 0.50 };
  let res;
  // drive the moving hand downward (increasing y) for several frames
  for (let f = 0; f < 6; f++) {
    res = tr.update([STILL, { x: 0.30, y: 0.40 + f * 0.06 }]);
  }
  assert.equal(res.chosen.index, 1);
  assert.equal(classifyDir(res.chosen.velEMA), 'down');
});

test('HandTracker: hysteresis prevents flicker on a single spike', () => {
  const tr = new HandTracker();
  // hand A oscillates strongly for a while -> becomes chosen
  let res;
  for (let f = 0; f < 12; f++) {
    const A = { x: 0.30, y: 0.50 + (f % 2 ? 0.12 : -0.12) };
    const B = { x: 0.80, y: 0.50 };
    res = tr.update([A, B]);
  }
  assert.equal(res.chosen.index, 0, 'A is the established strumming hand');
  // one frame where B jumps once — should NOT immediately steal selection
  res = tr.update([{ x: 0.30, y: 0.50 }, { x: 0.80, y: 0.66 }]);
  assert.equal(res.chosen.index, 0, 'single spike must not switch hands');
});

test('HandTracker: handles a single hand', () => {
  const tr = new HandTracker();
  const res = tr.update([{ x: 0.5, y: 0.5 }]);
  assert.equal(res.chosen.index, 0);
});

test('HandTracker: no hands => chosen is null', () => {
  const tr = new HandTracker();
  const res = tr.update([]);
  assert.equal(res.chosen, null);
});

// ── calcCanvasSize ─────────────────────────────────────────────────────
test('calcCanvasSize: caps 4K landscape to 1280×720', () => {
  const { w, h } = calcCanvasSize(3840, 2160);
  assert.equal(w, 1280);
  assert.equal(h, 720);
});
test('calcCanvasSize: caps 4K portrait (longest dim) to 720×1280', () => {
  const { w, h } = calcCanvasSize(2160, 3840);
  assert.equal(w, 720);
  assert.equal(h, 1280);
});
test('calcCanvasSize: leaves small video unchanged', () => {
  const { w, h } = calcCanvasSize(640, 480);
  assert.equal(w, 640);
  assert.equal(h, 480);
});
test('calcCanvasSize: HD 1920×1080 scaled to exactly 1280×720', () => {
  const { w, h } = calcCanvasSize(1920, 1080);
  assert.equal(w, 1280);
  assert.equal(h, 720);
});
test('calcCanvasSize: custom maxDim is respected', () => {
  const { w } = calcCanvasSize(1920, 1080, 960);
  assert.equal(w, 960);
});

// ── uiScale ────────────────────────────────────────────────────────────
test('uiScale: all values increase with canvas size', () => {
  const small = uiScale(640, 480);
  const large = uiScale(1280, 720);
  for (const key of Object.keys(small)) {
    assert.ok(large[key] >= small[key], `${key}: ${large[key]} >= ${small[key]}`);
  }
});
test('uiScale: minimum floors prevent zero-size elements on tiny canvas', () => {
  const tiny = uiScale(100, 100);
  assert.ok(tiny.chipH      >= 56);
  assert.ok(tiny.patternFont >= 64);
  assert.ok(tiny.stripH      >= 72);
  assert.ok(tiny.arrowSize   >= 90);
});
test('uiScale: portrait canvas (H > W) gives larger pattern font than landscape', () => {
  const portrait   = uiScale(540, 960);
  const landscape  = uiScale(960, 540);
  // portrait has more height → bigger font
  assert.ok(portrait.patternFont > landscape.patternFont);
});

// ── sensitivity sweep: replay + scoring ────────────────────────────────
// Build a synthetic recorded-frame series at 30 fps:
//   strong onsets (flux 60) every 0.5 s  -> the true strum pattern
//   irregular weak spikes (flux 25)       -> noise (false positives)
//   baseline flux 3 elsewhere
function buildFrames() {
  const dt = 1 / 30, dur = 4.0;
  const trueOnsets  = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5];   // 7 real strums
  const noiseSpikes = [0.70, 1.18, 2.34];                    // irregular noise
  const near = (t, arr) => arr.some(o => Math.abs(t - o) < dt / 2);
  const frames = [];
  for (let f = 0; f * dt < dur; f++) {
    const t = f * dt;
    let flux = 3 + (f % 3) * 0.2;                 // small deterministic ripple
    if (near(t, trueOnsets))  flux = 60;
    else if (near(t, noiseSpikes)) flux = 25;
    frames.push({ t, flux, velEMA: (f % 2 ? 0.2 : -0.2) });
  }
  return { frames, trueOnsets, noiseSpikes };
}

test('replayAudioOnsets: detects the strong onsets, skips baseline', () => {
  const { frames, trueOnsets } = buildFrames();
  const strokes = replayAudioOnsets(frames, {
    k: 2.0, minFlux: 3, refractory: 0.12, histLen: 120,
  });
  assert.equal(strokes.length, trueOnsets.length);
  strokes.forEach((s, i) =>
    assert.ok(Math.abs(s.t - trueOnsets[i]) < 0.05, `onset ${i} near ${trueOnsets[i]}`));
});

test('replayAudioOnsets: respects the refractory window', () => {
  const dt = 1 / 30;
  const frames = [];
  // spike every other frame (~0.066 s apart) — below the 0.12 s refractory,
  // so the detector must drop roughly every second spike.
  for (let f = 0; f * dt < 1; f++)
    frames.push({ t: f * dt, flux: (f % 2 === 0 ? 80 : 3), velEMA: 1 });
  const strokes = replayAudioOnsets(frames, { k: 0.5, minFlux: 3, refractory: 0.12 });
  assert.ok(strokes.length <= Math.ceil(1 / 0.12) + 1, 'rate-limited by refractory');
  assert.ok(strokes.length >= 6, 'still fires repeatedly between refractory gaps');
  // no two onsets closer than the refractory window
  for (let i = 1; i < strokes.length; i++)
    assert.ok(strokes[i].t - strokes[i - 1].t > 0.12, 'gap exceeds refractory');
});

test('patternRegularity: perfectly on-grid times score ~1', () => {
  approx(patternRegularity([0, 0.5, 1.0, 1.5, 2.0]), 1, 1e-9);
});
test('patternRegularity: integer-multiple gaps still score ~1', () => {
  // gaps of 0.5 and 1.0 are both multiples of the 0.5 grid
  assert.ok(patternRegularity([0, 0.5, 1.0, 2.0, 2.5]) > 0.9);
});
test('patternRegularity: irregular times score low', () => {
  assert.ok(patternRegularity([0, 0.5, 1.5, 1.6, 2.9]) < 0.7);
});
test('patternRegularity: too few points -> 0', () => {
  assert.equal(patternRegularity([0, 0.5]), 0);
});

test('patternScore: clean pattern beats a noisy denser one', () => {
  const clean = patternScore(
    [0.5, 1, 1.5, 2, 2.5, 3, 3.5].map(t => ({ t, dir: 'down' })));
  const noisy = patternScore(
    [0.5, 0.7, 1, 1.18, 1.5, 2, 2.34, 2.5, 3, 3.5].map(t => ({ t, dir: 'down' })));
  assert.ok(clean.score > noisy.score, `${clean.score} > ${noisy.score}`);
  assert.equal(clean.bpm, 120);
});

test('sweepSensitivity: auto-selects the level giving the cleanest pattern', () => {
  const { frames, trueOnsets } = buildFrames();
  const { best, all } = sweepSensitivity(frames, {
    minFlux: 3, refractory: 0.12, histLen: 120,
  });
  // best result recovers exactly the real strums
  assert.equal(best.nStrokes, trueOnsets.length);
  assert.ok(best.regularity > 0.9);
  assert.equal(best.bpm, 120);
  // every sensitivity level is reported, in ascending order
  assert.equal(all.length, 10);
  all.forEach((r, i) => assert.equal(r.sens, i + 1));
  // the most-sensitive level over-triggers on the noise spikes
  const hottest = all.find(r => r.sens === 10);
  assert.ok(hottest.nStrokes > best.nStrokes, 'max sensitivity adds false positives');
  assert.ok(hottest.regularity < best.regularity, 'and is less regular');
});

// ── wiring guard: strum_live.html stays in sync with the module ────────
test('strum_live.html imports only symbols that strum_core exports', () => {
  const html = readFileSync(join(HERE, 'strum_live.html'), 'utf8');
  const m = html.match(/import\s*\{([^}]+)\}\s*from\s*["']\.\/strum_core\.js["']/);
  assert.ok(m, 'HTML must import from ./strum_core.js');
  const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
  const missing = names.filter(n => !(n in core));
  assert.deepEqual(missing, [], `HTML imports missing from core: ${missing}`);
});

test('strum_live.html requests two hands from MediaPipe', () => {
  const html = readFileSync(join(HERE, 'strum_live.html'), 'utf8');
  assert.match(html, /numHands:\s*2/, 'must detect 2 hands to pick the strummer');
});
test('strum_live.html uses calcCanvasSize for sizeCanvas', () => {
  const html = readFileSync(join(HERE, 'strum_live.html'), 'utf8');
  assert.match(html, /calcCanvasSize/, 'must cap canvas to limit MediaPipe cost on large files');
});
test('strum_live.html uses uiScale for chip and overlay sizing', () => {
  const html = readFileSync(join(HERE, 'strum_live.html'), 'utf8');
  assert.match(html, /uiScale\(/, 'must derive all overlay sizes from uiScale');
});
test('strum_live.html uses requestVideoFrameCallback for efficient loop', () => {
  const html = readFileSync(join(HERE, 'strum_live.html'), 'utf8');
  assert.match(html, /requestVideoFrameCallback/, 'must use rvfc to avoid duplicate frame processing');
});
test('strum_live.html wires the auto-tune sweep', () => {
  const html = readFileSync(join(HERE, 'strum_live.html'), 'utf8');
  assert.match(html, /sweepSensitivity\(/, 'auto-tune must call sweepSensitivity');
  assert.match(html, /id="tuneBtn"/, 'must expose an Auto-tune button');
});
