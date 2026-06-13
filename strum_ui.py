#!/usr/bin/env python3
"""
Strum Analyzer — web UI.

Start:
    python strum_ui.py [--port 7860]

Then open http://localhost:7860 in your browser.

Requirements:
    pip install flask opencv-python numpy yt-dlp
"""

import argparse
import base64
import os
import sys
import tempfile
import subprocess
from pathlib import Path

import numpy as np

try:
    import cv2
except ImportError:
    sys.exit("pip install opencv-python")

from flask import Flask, request, jsonify, render_template_string

# ── re-use core analysis functions from strum_analyzer ───────────────────
sys.path.insert(0, os.path.dirname(__file__))
from strum_analyzer import (
    vertical_motion_signal,
    detect_strokes,
    estimate_beat,
    format_pattern,
    find_repeating_bar,
)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024   # 500 MB upload limit

# ── HTML template ─────────────────────────────────────────────────────────
HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Strum Analyzer</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --orange:#E8472A;--blue:#2277DD;
  --bg:#0e0e0e;--card:#ffffff;--divider:#e8e8e8;
  --dark-bg:#1a1a1a;--panel:#111;--card-sub:#777
}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;
     background:var(--bg);color:#fff;min-height:100dvh;display:flex;flex-direction:column}

/* ── Upload ─────────────────────────────────────────────────────── */
#upload-screen{flex:1;display:flex;flex-direction:column;align-items:center;
  justify-content:center;padding:24px;gap:10px}
.upload-title{font-size:13px;font-weight:800;letter-spacing:.18em;color:var(--orange);
  text-transform:uppercase}
.upload-headline{font-size:28px;font-weight:900;letter-spacing:-.02em;color:#fff}
.upload-sub{color:#555;font-size:13px;margin-bottom:16px}
.form-card{background:var(--dark-bg);border-radius:12px;padding:28px 24px;
  width:100%;max-width:480px;border:1px solid #252525}
.fg{margin-bottom:16px}
.fg label{display:block;font-size:9px;font-weight:800;letter-spacing:.16em;
  color:var(--orange);text-transform:uppercase;margin-bottom:6px}
.fg input[type=text],.fg input[type=number],.fg input[type=file]{
  width:100%;padding:10px 14px;background:#1e1e1e;border:1px solid #2e2e2e;
  border-radius:6px;color:#fff;font-size:14px;outline:none;transition:border-color .15s}
.fg input:focus{border-color:var(--orange)}
.row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.btn-primary{width:100%;padding:14px;background:var(--orange);border:none;
  border-radius:6px;color:#fff;font-size:13px;font-weight:800;cursor:pointer;
  letter-spacing:.1em;text-transform:uppercase;transition:opacity .15s}
.btn-primary:hover{opacity:.88}
.btn-primary:disabled{opacity:.4;cursor:not-allowed}

/* ── sensitivity slider ──────────────────────────────────────────── */
.sens-row{display:flex;align-items:center;gap:10px;margin-top:4px}
.sens-row input[type=range]{flex:1;accent-color:var(--orange);height:3px;cursor:pointer}
.sens-val{font-size:12px;font-weight:700;color:#fff;min-width:18px;text-align:right}

/* ── source tabs ─────────────────────────────────────────────────── */
.src-tabs{display:flex;margin-bottom:16px;border:1px solid #2e2e2e;border-radius:6px;overflow:hidden}
.src-tab{flex:1;padding:9px 0;background:transparent;border:none;color:#555;
  font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  cursor:pointer;transition:background .15s,color .15s}
.src-tab.active{background:var(--orange);color:#fff}

/* ── Processing ─────────────────────────────────────────────────── */
#processing-screen{flex:1;display:none;flex-direction:column;align-items:center;
  justify-content:center;gap:16px}
.spinner{width:40px;height:40px;border:3px solid #2a2a2a;border-top-color:var(--orange);
  border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
#proc-label{color:#555;font-size:12px;letter-spacing:.1em;text-transform:uppercase}

/* ── Results ────────────────────────────────────────────────────── */
#results-screen{flex:1;display:none;flex-direction:column;min-height:0}
.r-header{display:flex;align-items:center;justify-content:space-between;
  padding:10px 16px;background:#0a0a0a;border-bottom:1px solid #1c1c1c}
.r-header-left{display:flex;flex-direction:column;gap:2px}
.r-header-eyebrow{font-size:9px;font-weight:800;letter-spacing:.18em;color:var(--orange);
  text-transform:uppercase}
.r-header-title{font-size:15px;font-weight:800;color:#fff;letter-spacing:-.01em}
.r-back-btn{padding:6px 14px;background:transparent;border:1px solid #2e2e2e;
  border-radius:20px;color:#666;cursor:pointer;font-size:11px;font-weight:600;
  letter-spacing:.05em;transition:border-color .15s,color .15s}
.r-back-btn:hover{border-color:#555;color:#bbb}

/* main two-column grid — 60/40 split */
.main-grid{display:grid;grid-template-columns:60fr 40fr;flex:1;min-height:0}
@media(max-width:680px){.main-grid{grid-template-columns:1fr}}

/* ── video panel ──────────────────────────────────────────────── */
.vpanel{position:relative;background:#000;display:flex;align-items:center;
  justify-content:center;overflow:hidden;min-height:300px}
#frame-canvas{max-width:100%;max-height:520px;width:auto;height:auto;display:block;object-fit:contain}
.ftime{position:absolute;bottom:10px;left:10px;background:rgba(0,0,0,.7);
  padding:3px 10px;border-radius:4px;font-size:11px;color:#ccc;
  font-variant-numeric:tabular-nums;letter-spacing:.05em;font-weight:600}

/* ── metrics panel ────────────────────────────────────────────── */
.mpanel{display:flex;flex-direction:column;border-left:1px solid #1c1c1c;overflow-y:auto}

/* generic metric card */
.mc{background:var(--card);color:#000;padding:14px 18px;
  border-bottom:1px solid var(--divider);flex-shrink:0}
.mc .lbl{font-size:9px;font-weight:800;letter-spacing:.16em;
  color:var(--orange);text-transform:uppercase;margin-bottom:6px}
.mc .val{font-size:56px;font-weight:900;line-height:1;color:#000;letter-spacing:-.03em}
.mc .sub{font-size:11px;color:var(--card-sub);margin-top:5px;font-weight:500}

/* direction card — sticky at top, always visible */
#dc{position:sticky;top:0;z-index:10;box-shadow:0 2px 8px rgba(0,0,0,.08)}
#dc .val{font-size:72px}
#dc.down .val{color:var(--orange)}
#dc.up   .val{color:var(--blue)}
#dc.none .val{color:#ccc}

/* speed card gets a smaller value + sparkline below */
#sc-card .val{font-size:52px}

/* sparkline */
#spk{width:100%;height:36px;display:block;margin-top:8px}

/* BPM card */
#bc .val{font-size:56px}

/* pattern card */
#pc{flex:1;min-height:0}
#pc .lbl{color:var(--orange)}
#pc .pat-found{font-size:38px;font-weight:900;letter-spacing:-.02em}
#pc .pat-found.yes{color:var(--orange)}
#pc .pat-found.no{color:#bbb}

/* 8-cell pattern grid */
.pgrid{display:grid;grid-template-columns:repeat(8,1fr);gap:4px;margin-top:10px}
.pc-cell{aspect-ratio:1;display:flex;flex-direction:column;align-items:center;
  justify-content:center;border-radius:5px;background:#f0f0f0;
  font-size:14px;font-weight:800;transition:background .12s,outline .12s;
  outline:2px solid transparent;outline-offset:1px}
.pc-cell .bl{font-size:7px;color:#bbb;font-weight:500;margin-top:2px;line-height:1}
.pc-cell.active{outline:2px solid var(--orange);animation:pulse .4s ease}
@keyframes pulse{0%{outline-width:3px}50%{outline-width:5px}100%{outline-width:2px}}
.pc-cell.dbeat{background:#FFE0D8;color:var(--orange)}
.pc-cell.ubeat{background:#D6E5FF;color:var(--blue)}
.pc-cell.dbeat.active{background:#FFE0D8}
.pc-cell.ubeat.active{background:#D6E5FF}
.pc-cell.rest{background:#f0f0f0;color:#bbb}

/* ── bottom timeline bar ──────────────────────────────────────── */
.tbar{padding:12px 18px 16px;background:#0a0a0a;border-top:1px solid #1c1c1c;flex-shrink:0}
.tbar-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.tlbl{font-size:9px;color:#444;letter-spacing:.12em;text-transform:uppercase;font-weight:700}
.legend{display:flex;gap:14px;align-items:center}
.leg-item{display:flex;align-items:center;gap:5px;font-size:10px;color:#555;font-weight:600}
.leg-dot{width:8px;height:8px;border-radius:50%}
#wfc{width:100%;height:54px;display:block;border-radius:4px;overflow:hidden}
#scrub{width:100%;height:3px;background:#222;border-radius:2px;
  -webkit-appearance:none;appearance:none;cursor:pointer;outline:none;
  margin-top:8px;display:block}
#scrub::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
  width:14px;height:14px;background:var(--orange);border-radius:50%;cursor:grab}
#scrub::-moz-range-thumb{width:14px;height:14px;background:var(--orange);
  border-radius:50%;border:none;cursor:grab}
.sdots{position:relative;height:10px;margin-top:6px}
.sd{position:absolute;top:0;width:8px;height:8px;border-radius:50%;
  transform:translateX(-50%);cursor:default}
.sd.down{background:var(--orange)}
.sd.up{background:var(--blue)}
</style>
</head>
<body>

<!-- ════════════════════════════════════════════════════════════
     UPLOAD SCREEN
═════════════════════════════════════════════════════════════ -->
<div id="upload-screen">
  <div class="upload-title">Guitar Analytics</div>
  <div class="upload-headline">Strum Pattern Analyzer</div>
  <div class="upload-sub">Upload a guitar video — get the strumming pattern</div>

  <div class="form-card">
    <form id="uform">
      <div class="src-tabs">
        <button type="button" class="src-tab active" id="tab-file" onclick="switchTab('file')">Upload File</button>
        <button type="button" class="src-tab" id="tab-url" onclick="switchTab('url')">YouTube URL</button>
      </div>
      <div class="fg" id="src-file">
        <label>Video File (mp4, mov, webm)</label>
        <input type="file" id="vfile" accept="video/*">
      </div>
      <div class="fg" id="src-url" style="display:none">
        <label>YouTube URL</label>
        <input type="text" id="vurl" placeholder="https://youtu.be/...">
      </div>
      <div class="row3">
        <div class="fg"><label>Start (s)</label>
          <input type="number" id="fstart" value="10" min="0" step="1"></div>
        <div class="fg"><label>Duration (s)</label>
          <input type="number" id="fdur" value="16" min="4" max="60" step="1"></div>
        <div class="fg"><label>BPM (opt)</label>
          <input type="number" id="fbpm" placeholder="auto" min="40" max="240"></div>
      </div>
      <div class="fg">
        <label>ROI — x1,y1,x2,y2 fractions (strumming hand region)</label>
        <input type="text" id="froi" value="0.0,0.2,1.0,0.9">
      </div>
      <div class="fg">
        <label>Sensitivity (higher = detect more strokes)</label>
        <div class="sens-row">
          <input type="range" id="fsens" min="1" max="10" value="7"
            oninput="$('sens-display').textContent=this.value">
          <span class="sens-val" id="sens-display">7</span>
        </div>
      </div>
      <button type="submit" class="btn-primary" id="abtn">Analyze Pattern</button>
    </form>
  </div>
</div>

<!-- ════════════════════════════════════════════════════════════
     PROCESSING SCREEN
═════════════════════════════════════════════════════════════ -->
<div id="processing-screen">
  <div class="spinner"></div>
  <div id="proc-label">Uploading</div>
</div>

<!-- ════════════════════════════════════════════════════════════
     RESULTS SCREEN
═════════════════════════════════════════════════════════════ -->
<div id="results-screen">

  <!-- header bar -->
  <div class="r-header">
    <div class="r-header-left">
      <div class="r-header-eyebrow">Guitar Analytics</div>
      <div class="r-header-title">Strum Pattern Analysis</div>
    </div>
    <button class="r-back-btn" id="rbtn">New Video</button>
  </div>

  <!-- main 60/40 grid -->
  <div class="main-grid">

    <!-- ── LEFT: video frame ──────────────────────────── -->
    <div class="vpanel">
      <canvas id="frame-canvas"></canvas>
      <div class="ftime" id="ftime">0.00 s</div>
    </div>

    <!-- ── RIGHT: stacked metric cards ──────────────────── -->
    <div class="mpanel">

      <!-- STRUM DIRECTION -->
      <div class="mc" id="dc">
        <div class="lbl">Strum Direction</div>
        <div class="val" id="dval">·</div>
        <div class="sub" id="dsub">waiting for data</div>
      </div>

      <!-- STRUM SPEED -->
      <div class="mc" id="sc-card">
        <div class="lbl">Strum Speed</div>
        <div class="val" id="sval">0.0</div>
        <div class="sub">optical flow units</div>
        <canvas id="spk"></canvas>
      </div>

      <!-- TEMPO -->
      <div class="mc" id="bc">
        <div class="lbl">Tempo</div>
        <div class="val" id="bval">—</div>
        <div class="sub">BPM estimated</div>
      </div>

      <!-- PATTERN -->
      <div class="mc" id="pc">
        <div class="lbl">Pattern?</div>
        <div class="pat-found" id="pat-found-label">—</div>
        <div class="pgrid" id="pgrid"></div>
        <div class="sub" id="psub" style="margin-top:8px"></div>
      </div>

    </div><!-- /mpanel -->
  </div><!-- /main-grid -->

  <!-- ── BOTTOM: velocity timeline ──────────────────────── -->
  <div class="tbar">
    <div class="tbar-header">
      <div class="tlbl">Velocity Timeline</div>
      <div class="legend">
        <div class="leg-item">
          <div class="leg-dot" style="background:var(--orange)"></div>
          Downstroke
        </div>
        <div class="leg-item">
          <div class="leg-dot" style="background:var(--blue)"></div>
          Upstroke
        </div>
      </div>
    </div>
    <canvas id="wfc"></canvas>
    <input type="range" id="scrub" min="0" value="0" step="1">
    <div class="sdots" id="sdots"></div>
  </div>

</div><!-- /results-screen -->

<script>
// ── state ─────────────────────────────────────────────────────────
let data = null, timer = null, fi = 0;
const SPK_LEN = 40;
let sphist = [];

// ── utils ─────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
function show(name){
  $('upload-screen').style.display     = name==='upload'     ? 'flex' : 'none';
  $('processing-screen').style.display = name==='processing' ? 'flex' : 'none';
  $('results-screen').style.display    = name==='results'    ? 'flex' : 'none';
}

// ── source tab switcher ───────────────────────────────────────────
let srcMode = 'file';
function switchTab(mode){
  srcMode = mode;
  $('tab-file').classList.toggle('active', mode==='file');
  $('tab-url').classList.toggle('active', mode==='url');
  $('src-file').style.display = mode==='file' ? '' : 'none';
  $('src-url').style.display  = mode==='url'  ? '' : 'none';
}

// ── upload ────────────────────────────────────────────────────────
$('uform').addEventListener('submit', async e => {
  e.preventDefault();

  const fd = new FormData();
  if(srcMode === 'file'){
    const file = $('vfile').files[0];
    if(!file){ alert('Please select a video file'); return; }
    fd.append('video', file);
  } else {
    const url = $('vurl').value.trim();
    if(!url){ alert('Please enter a YouTube URL'); return; }
    fd.append('url', url);
  }
  fd.append('start',    $('fstart').value);
  fd.append('duration', $('fdur').value);
  fd.append('roi',      $('froi').value);
  fd.append('sens',     $('fsens').value);
  const bpmv = $('fbpm').value;
  if(bpmv) fd.append('bpm', bpmv);

  show('processing');
  $('proc-label').textContent = srcMode === 'url' ? 'Downloading…' : 'Uploading…';

  try{
    const r = await fetch('/analyze', {method:'POST', body:fd});
    if(!r.ok){ const j=await r.json(); throw new Error(j.error||'Server error'); }
    $('proc-label').textContent = 'Done!';
    data = await r.json();
    initResults();
    show('results');
  }catch(err){
    alert('Error: '+err.message);
    show('upload');
  }
});

// ── reset ────────────────────────────────────────────────────────
$('rbtn').addEventListener('click', ()=>{ stopPlay(); show('upload'); });

// ── init results ─────────────────────────────────────────────────
function initResults(){
  sphist = [];

  // BPM
  $('bval').textContent = data.bpm || '—';

  // Pattern found label
  const hasBar = !!(data.best_bar);
  const pfl = $('pat-found-label');
  pfl.textContent = hasBar ? 'YES' : 'NO';
  pfl.className = 'pat-found ' + (hasBar ? 'yes' : 'no');

  // Pattern grid
  const labels = ['1','&','2','&','3','&','4','&'];
  const grid = $('pgrid');
  grid.innerHTML = '';
  const bar = data.best_bar || Array(8).fill('·');
  bar.forEach((sym,i)=>{
    const c = document.createElement('div');
    let cls = 'pc-cell';
    if(sym==='↓') cls += ' dbeat';
    else if(sym==='↑') cls += ' ubeat';
    else cls += ' rest';
    c.className = cls;
    c.innerHTML = `<span>${sym}</span><span class="bl">${labels[i]}</span>`;
    grid.appendChild(c);
  });
  $('psub').textContent = data.bar_info || '';

  // Scrubber
  const sc = $('scrub');
  sc.max = data.frames.length - 1;
  sc.value = 0;
  sc.oninput = ()=>{ stopPlay(); renderFrame(+sc.value); };

  // Waveform
  drawWaveform();
  // Stroke dots
  buildDots();

  // Start playback
  fi = 0; startPlay();
}

// ── playback ─────────────────────────────────────────────────────
function startPlay(){
  renderFrame(0);
  timer = setInterval(()=>{
    fi = (fi+1) % data.frames.length;
    renderFrame(fi);
    $('scrub').value = fi;
  }, 1000/8);
}
function stopPlay(){ if(timer){ clearInterval(timer); timer=null; } }

// ── render frame ─────────────────────────────────────────────────
const imgCache = {};
function renderFrame(idx){
  const fr = data.frames[idx];
  const cv = $('frame-canvas');
  const ctx = cv.getContext('2d');

  let img = imgCache[idx];
  if(!img){
    img = new Image();
    imgCache[idx] = img;
    img.src = 'data:image/jpeg;base64,'+fr.img;
  }
  const draw = ()=>{
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
  };
  img.complete ? draw() : (img.onload = draw);

  // Direction card
  const dir = fr.direction;
  const dc = $('dc');
  dc.className = 'mc ' + dir;
  $('dval').textContent = dir==='down'?'↓': dir==='up'?'↑':'·';
  $('dsub').textContent = dir==='down'?'DOWNSTROKE': dir==='up'?'UPSTROKE':'no stroke';

  // Speed — map frame index to nearest velocity sample
  const vi = Math.min(Math.round(idx * data.vel_series.length / data.frames.length),
                      data.vel_series.length-1);
  const vy = data.vel_series[vi]?.vy || 0;
  $('sval').textContent = Math.abs(vy).toFixed(1);
  sphist.push(vy);
  if(sphist.length > SPK_LEN) sphist.shift();
  drawSparkline();

  // Frame time
  $('ftime').textContent = fr.t.toFixed(2)+' s';

  // Pattern highlight
  highlightBar(fr.t);
}

// ── pattern beat highlight ────────────────────────────────────────
function highlightBar(t){
  if(!data.strokes.length) return;
  const spb = 60/data.bpm, eighth = spb/2;
  const t0  = data.strokes[0].time;
  const slot = Math.round((t-t0)/eighth);
  const pos  = ((slot % 8) + 8) % 8;
  document.querySelectorAll('.pc-cell').forEach((c,i)=>{
    c.classList.toggle('active', i===pos);
  });
}

// ── sparkline ────────────────────────────────────────────────────
function drawSparkline(){
  const cv = $('spk'), w = cv.parentElement.clientWidth||180, h=36;
  cv.width=w; cv.height=h;
  const ctx=cv.getContext('2d');
  ctx.clearRect(0,0,w,h);

  if(sphist.length<2) return;
  const mx = Math.max(...sphist.map(Math.abs),1);

  ctx.beginPath();
  sphist.forEach((v,i)=>{
    const x = i/(SPK_LEN-1)*w, y = h/2 - (v/mx)*(h/2-3);
    i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  });
  ctx.strokeStyle='#E8472A'; ctx.lineWidth=1.5; ctx.stroke();

  // zero line
  ctx.strokeStyle='#e0e0e0'; ctx.lineWidth=.5;
  ctx.setLineDash([3,3]);
  ctx.beginPath(); ctx.moveTo(0,h/2); ctx.lineTo(w,h/2); ctx.stroke();
  ctx.setLineDash([]);
}

// ── waveform ─────────────────────────────────────────────────────
function drawWaveform(){
  const cv=$('wfc'), w=cv.parentElement.clientWidth||400, h=54;
  cv.width=w; cv.height=h;
  const ctx=cv.getContext('2d');
  const ser = data.vel_series;
  if(!ser.length) return;

  const mx = Math.max(...ser.map(s=>Math.abs(s.vy)),1);
  ctx.fillStyle='#111'; ctx.fillRect(0,0,w,h);

  const bw = w/ser.length+.5;
  ser.forEach((pt,i)=>{
    const x  = i/ser.length*w;
    const bh = (pt.vy/mx)*(h/2-2);
    ctx.fillStyle = pt.vy>0 ? '#E8472A99' : '#2277DD99';
    bh>0 ? ctx.fillRect(x,h/2,bw,bh) : ctx.fillRect(x,h/2+bh,bw,-bh);
  });
  ctx.strokeStyle='#2a2a2a'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,h/2); ctx.lineTo(w,h/2); ctx.stroke();
}

// ── stroke dots ──────────────────────────────────────────────────
function buildDots(){
  const cont=$('sdots'); cont.innerHTML='';
  if(!data.frames.length) return;
  const t0=data.frames[0].t, t1=data.frames[data.frames.length-1].t, dur=t1-t0||1;
  data.strokes.forEach(s=>{
    const d=document.createElement('div');
    d.className='sd '+s.direction;
    d.style.left=((s.time-t0)/dur*100)+'%';
    d.title=(s.direction==='down'?'↓':'↑')+' '+s.time.toFixed(2)+'s';
    cont.appendChild(d);
  });
}

show('upload');
</script>
</body>
</html>
"""


# ── helpers ───────────────────────────────────────────────────────────────

def resolve_source(src: str, tmpdir: str) -> str:
    if os.path.exists(src):
        return src
    if not src.startswith(("http://", "https://")):
        raise ValueError(f"Not a file and not a URL: {src}")
    out = os.path.join(tmpdir, "video.%(ext)s")
    r = subprocess.run(
        ["yt-dlp", "-f", "best[height<=720]", "--no-playlist", "-o", out, src],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        raise RuntimeError("yt-dlp failed: " + r.stderr[-400:])
    for f in Path(tmpdir).iterdir():
        if f.stem == "video":
            return str(f)
    raise RuntimeError("Downloaded file not found")


def extract_annotated_frames(
    video_path: str,
    start: float,
    duration: float,
    roi: tuple,
    strokes,
    playback_fps: int = 8,
) -> list:
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    cap.set(cv2.CAP_PROP_POS_MSEC, start * 1000)

    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    x1, y1 = int(roi[0] * w), int(roi[1] * h)
    x2, y2 = int(roi[2] * w), int(roi[3] * h)

    # Build a lookup: for each 100ms bucket which stroke is active
    stroke_at = {}   # bucket -> ("down"|"up")
    for s in strokes:
        for dt in range(int((s.time - 0.1) * 10), int((s.time + 0.15) * 10)):
            if dt not in stroke_at:
                stroke_at[dt] = s.direction

    step = max(1, int(fps / playback_fps))
    max_frames = int(duration * playback_fps)
    frames = []
    i = 0
    while len(frames) < max_frames:
        ret, frame = cap.read()
        if not ret:
            break
        if i % step == 0:
            t = start + i / fps
            bkt = int(t * 10)
            direction = stroke_at.get(bkt)

            # Resize for web (max width 640)
            if w > 640:
                scale = 640 / w
                frame = cv2.resize(frame, (640, int(h * scale)))
                fh, fw = frame.shape[:2]
                ax1, ay1 = int(roi[0]*fw), int(roi[1]*fh)
                ax2, ay2 = int(roi[2]*fw), int(roi[3]*fh)
            else:
                ax1, ay1, ax2, ay2 = x1, y1, x2, y2

            # ROI rectangle
            color = (30, 100, 232) if direction == "down" else \
                    (220, 100, 30) if direction == "up" else (120, 120, 120)
            cv2.rectangle(frame, (ax1, ay1), (ax2, ay2), color, 2)

            # Arrow overlay when stroking
            if direction:
                cx = (ax1 + ax2) // 2
                cy = (ay1 + ay2) // 2
                dy = 50 if direction == "down" else -50
                cv2.arrowedLine(
                    frame,
                    (cx, cy - dy // 2), (cx, cy + dy // 2),
                    color, 5, tipLength=0.4,
                )

            ok, buf = cv2.imencode(
                ".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 68]
            )
            if ok:
                frames.append({
                    "t": round(t, 2),
                    "img": base64.standard_b64encode(buf).decode(),
                    "direction": direction or "none",
                })
        i += 1
    cap.release()
    return frames


# ── routes ────────────────────────────────────────────────────────────────

@app.get("/")
def index():
    return render_template_string(HTML)


@app.post("/analyze")
def analyze():
    try:
        start    = float(request.form.get("start", 10))
        duration = float(request.form.get("duration", 16))
        bpm_in   = request.form.get("bpm")
        bpm_val  = float(bpm_in) if bpm_in else None
        roi_str  = request.form.get("roi", "0.0,0.2,1.0,1.0")
        roi      = tuple(float(x) for x in roi_str.split(","))
        if len(roi) != 4:
            raise ValueError("ROI must be 4 values")
        # sensitivity 1-10 → threshold multiplier 3.5 (low sens) … 0.8 (high sens)
        sens     = max(1, min(10, int(request.form.get("sens", 5))))
        thresh_k = 3.5 - (sens - 1) * (3.5 - 0.8) / 9
    except Exception as e:
        return jsonify(error=f"Bad parameters: {e}"), 400

    url_src = request.form.get("url", "").strip()
    tmpdir_obj = None
    video_path = None

    try:
        if url_src:
            tmpdir_obj = tempfile.TemporaryDirectory()
            video_path = resolve_source(url_src, tmpdir_obj.name)
        else:
            if "video" not in request.files or request.files["video"].filename == "":
                return jsonify(error="No video file or URL provided"), 400
            f = request.files["video"]
            suffix = Path(f.filename).suffix or ".mp4"
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                f.save(tmp.name)
                video_path = tmp.name

    except Exception as e:
        if tmpdir_obj:
            tmpdir_obj.cleanup()
        return jsonify(error=f"Could not load video: {e}"), 500

    try:
        # Optical flow analysis
        times, velocities, fps = vertical_motion_signal(
            video_path, start, duration, roi
        )
        strokes = detect_strokes(times, velocities, fps, thresh_k=thresh_k)
        spb     = estimate_beat(strokes, bpm_val)
        est_bpm = max(1, round(60.0 / spb))

        rep = find_repeating_bar(strokes, spb)
        best_bar  = list(rep[0]) if rep else None
        bar_info  = (f"Most common: {rep[1]}/{rep[2]} bars" if rep else
                     f"{len(strokes)} strokes detected")

        # Annotated frames for playback
        frames = extract_annotated_frames(
            video_path, start, duration, roi, strokes
        )

        return jsonify(
            bpm       = est_bpm,
            best_bar  = best_bar,
            bar_info  = bar_info,
            strokes   = [
                {"time": s.time, "direction": s.direction, "strength": round(s.strength, 2)}
                for s in strokes
            ],
            frames    = frames,
            vel_series= [
                {"t": round(float(t), 3), "vy": round(float(v), 3)}
                for t, v in zip(times, velocities)
            ],
        )

    except SystemExit as e:
        return jsonify(error=str(e)), 500
    except Exception as e:
        return jsonify(error=str(e)), 500
    finally:
        if tmpdir_obj:
            tmpdir_obj.cleanup()
        elif video_path:
            try:
                os.unlink(video_path)
            except OSError:
                pass


# ── main ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Strum Analyzer web UI")
    p.add_argument("--port", type=int, default=7860)
    p.add_argument("--host", default="0.0.0.0")
    args = p.parse_args()
    print(f"\n  Strum Analyzer → http://localhost:{args.port}\n")
    app.run(host=args.host, port=args.port, debug=False, threaded=True)
