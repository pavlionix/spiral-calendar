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
  --bg:#0e0e0e;--card:#fff;--card-sub:#f5f5f5;
  --divider:#ddd;--dark-bg:#1a1a1a;--panel:#111
}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
     background:var(--bg);color:#fff;min-height:100dvh;display:flex;flex-direction:column}

/* ── Upload ─────────────────────────────────────────────────────── */
#upload-screen{flex:1;display:flex;flex-direction:column;align-items:center;
  justify-content:center;padding:24px;gap:8px}
#upload-screen h1{font-size:26px;font-weight:800;letter-spacing:-.02em}
#upload-screen p{color:#777;font-size:14px;margin-bottom:20px}
.form-card{background:var(--dark-bg);border-radius:16px;padding:28px 24px;
  width:100%;max-width:460px}
.fg{margin-bottom:18px}
.fg label{display:block;font-size:10px;font-weight:700;letter-spacing:.14em;
  color:var(--orange);margin-bottom:6px}
.fg input[type=text],.fg input[type=number],.fg input[type=file]{
  width:100%;padding:10px 14px;background:#252525;border:1px solid #333;
  border-radius:8px;color:#fff;font-size:14px;outline:none}
.fg input:focus{border-color:var(--orange)}
.row2{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.btn-primary{width:100%;padding:13px;background:var(--orange);border:none;
  border-radius:8px;color:#fff;font-size:15px;font-weight:700;cursor:pointer;
  letter-spacing:.05em;transition:opacity .15s}
.btn-primary:hover{opacity:.88}
.btn-primary:disabled{opacity:.45;cursor:not-allowed}

/* ── Processing ─────────────────────────────────────────────────── */
#processing-screen{flex:1;display:none;flex-direction:column;align-items:center;
  justify-content:center;gap:14px}
.spinner{width:44px;height:44px;border:4px solid #333;border-top-color:var(--orange);
  border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
#proc-label{color:#888;font-size:14px}

/* ── Results ────────────────────────────────────────────────────── */
#results-screen{flex:1;display:none;flex-direction:column}
.r-header{display:flex;align-items:center;justify-content:space-between;
  padding:10px 16px;background:var(--panel);border-bottom:1px solid #222}
.r-header h2{font-size:15px;font-weight:700}
.r-header button{padding:5px 12px;background:transparent;border:1px solid #444;
  border-radius:20px;color:#bbb;cursor:pointer;font-size:12px}

/* main grid */
.main-grid{display:grid;grid-template-columns:1fr 220px;flex:1}
@media(max-width:600px){.main-grid{grid-template-columns:1fr}}

/* video panel */
.vpanel{position:relative;background:#000;display:flex;align-items:center;justify-content:center}
#frame-canvas{width:100%;height:auto;display:block;max-height:480px;object-fit:contain}
.ftime{position:absolute;bottom:8px;left:8px;background:rgba(0,0,0,.65);
  padding:2px 8px;border-radius:4px;font-size:11px;color:#ccc;
  font-variant-numeric:tabular-nums;letter-spacing:.03em}

/* metrics panel */
.mpanel{display:flex;flex-direction:column;border-left:1px solid #222}

.mc{background:var(--card);color:#000;padding:10px 14px;flex:1;
  border-bottom:1px solid var(--divider)}
.mc .lbl{font-size:9px;font-weight:800;letter-spacing:.15em;color:var(--orange);margin-bottom:4px}
.mc .val{font-size:38px;font-weight:800;line-height:1.05;color:#000}
.mc .sub{font-size:10px;color:#777;margin-top:3px}

/* direction card */
#dc.down .val{color:var(--orange)}
#dc.up   .val{color:var(--blue)}
#dc.none .val{color:#bbb}

/* sparkline */
#spk{width:100%;height:36px;display:block;margin-top:6px}

/* pattern grid */
.pgrid{display:grid;grid-template-columns:repeat(8,1fr);gap:3px;margin-top:8px}
.pc{aspect-ratio:1;display:flex;flex-direction:column;align-items:center;
  justify-content:center;border-radius:4px;background:#f0f0f0;
  font-size:13px;font-weight:700;transition:background .15s}
.pc .bl{font-size:7px;color:#bbb;font-weight:400;margin-top:1px}
.pc.active{background:var(--orange)!important;color:#fff}
.pc.active .bl{color:rgba(255,255,255,.6)}
.pc.dbeat{background:#FFE4DE}
.pc.ubeat{background:#DCE8FF}

/* timeline */
.tbar{padding:10px 16px 14px;background:var(--panel)}
.tlbl{font-size:9px;color:#555;letter-spacing:.1em;margin-bottom:6px}
#wfc{width:100%;height:52px;display:block}
#scrub{width:100%;height:3px;background:#333;border-radius:2px;
  appearance:none;cursor:pointer;outline:none;margin-top:6px;display:block}
#scrub::-webkit-slider-thumb{appearance:none;width:14px;height:14px;
  background:var(--orange);border-radius:50%}
.sdots{position:relative;height:10px;margin-top:4px}
.sd{position:absolute;top:0;width:8px;height:8px;border-radius:50%;
  transform:translateX(-50%)}
.sd.down{background:var(--orange)}
.sd.up{background:var(--blue)}

/* legend */
.legend{display:flex;gap:12px;padding:0 0 10px;align-items:center}
.leg-item{display:flex;align-items:center;gap:5px;font-size:10px;color:#666}
.leg-dot{width:8px;height:8px;border-radius:50%}
</style>
</head>
<body>

<!-- ── Upload ────────────────────────────────────────────── -->
<div id="upload-screen">
  <h1>🎸 Strum Analyzer</h1>
  <p>Upload a guitar video — get the strumming pattern</p>
  <div class="form-card">
    <form id="uform">
      <div class="fg">
        <label>VIDEO FILE (mp4, mov, webm…)</label>
        <input type="file" id="vfile" accept="video/*" required>
      </div>
      <div class="row2">
        <div class="fg"><label>START (s)</label>
          <input type="number" id="fstart" value="10" min="0" step="1"></div>
        <div class="fg"><label>DURATION (s)</label>
          <input type="number" id="fdur" value="16" min="4" max="60" step="1"></div>
        <div class="fg"><label>BPM (opt)</label>
          <input type="number" id="fbpm" placeholder="auto" min="40" max="240"></div>
      </div>
      <div class="fg">
        <label>ROI — x1,y1,x2,y2 fractions where strumming hand is</label>
        <input type="text" id="froi" value="0.4,0.2,1.0,1.0">
      </div>
      <button type="submit" class="btn-primary" id="abtn">ANALYZE PATTERN</button>
    </form>
  </div>
</div>

<!-- ── Processing ───────────────────────────────────────── -->
<div id="processing-screen">
  <div class="spinner"></div>
  <div id="proc-label">Uploading…</div>
</div>

<!-- ── Results ──────────────────────────────────────────── -->
<div id="results-screen">
  <div class="r-header">
    <h2>Strum Pattern Analysis</h2>
    <button id="rbtn">← New video</button>
  </div>

  <div class="main-grid">
    <!-- video -->
    <div class="vpanel">
      <canvas id="frame-canvas"></canvas>
      <div class="ftime" id="ftime">0.00 s</div>
    </div>

    <!-- metrics -->
    <div class="mpanel">
      <!-- direction -->
      <div class="mc" id="dc">
        <div class="lbl">STRUM DIRECTION</div>
        <div class="val" id="dval">·</div>
        <div class="sub" id="dsub">waiting…</div>
      </div>

      <!-- speed -->
      <div class="mc">
        <div class="lbl">STRUM SPEED</div>
        <div class="val" id="sval">0.0</div>
        <div class="sub">optical flow velocity</div>
        <canvas id="spk"></canvas>
      </div>

      <!-- bpm -->
      <div class="mc">
        <div class="lbl">TEMPO</div>
        <div class="val" id="bval">–</div>
        <div class="sub">BPM estimated</div>
      </div>

      <!-- pattern -->
      <div class="mc" style="flex:2">
        <div class="lbl">BAR PATTERN</div>
        <div class="pgrid" id="pgrid"></div>
        <div class="sub" id="psub" style="margin-top:6px"></div>
      </div>
    </div>
  </div>

  <!-- timeline -->
  <div class="tbar">
    <div class="tlbl">VELOCITY TIMELINE (orange = down, blue = up)</div>
    <canvas id="wfc"></canvas>
    <input type="range" id="scrub" min="0" value="0" step="1">
    <div class="sdots" id="sdots"></div>
  </div>
</div>

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

// ── upload ────────────────────────────────────────────────────────
$('uform').addEventListener('submit', async e => {
  e.preventDefault();
  const file = $('vfile').files[0];
  if(!file) return;

  const fd = new FormData();
  fd.append('video', file);
  fd.append('start',    $('fstart').value);
  fd.append('duration', $('fdur').value);
  fd.append('roi',      $('froi').value);
  const bpmv = $('fbpm').value;
  if(bpmv) fd.append('bpm', bpmv);

  show('processing');
  $('proc-label').textContent = 'Uploading…';

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
  // BPM
  $('bval').textContent = data.bpm || '–';

  // Pattern grid
  const labels = ['1','&','2','&','3','&','4','&'];
  const grid = $('pgrid');
  grid.innerHTML = '';
  const bar = data.best_bar || Array(8).fill('·');
  bar.forEach((sym,i)=>{
    const c = document.createElement('div');
    c.className = 'pc' + (sym==='↓'?' dbeat':sym==='↑'?' ubeat':'');
    c.innerHTML = sym + `<span class="bl">${labels[i]}</span>`;
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

  // Speed
  // map frame index to nearest velocity sample
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
  document.querySelectorAll('.pc').forEach((c,i)=>{
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

  // area fill
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
  const cv=$('wfc'), w=cv.parentElement.clientWidth||400, h=52;
  cv.width=w; cv.height=h;
  const ctx=cv.getContext('2d');
  const ser = data.vel_series;
  if(!ser.length) return;

  const mx = Math.max(...ser.map(s=>Math.abs(s.vy)),1);
  ctx.fillStyle='#1a1a1a'; ctx.fillRect(0,0,w,h);

  const bw = w/ser.length+.5;
  ser.forEach((pt,i)=>{
    const x  = i/ser.length*w;
    const bh = (pt.vy/mx)*(h/2-2);
    ctx.fillStyle = pt.vy>0 ? '#E8472A88' : '#2277DD88';
    bh>0 ? ctx.fillRect(x,h/2,bw,bh) : ctx.fillRect(x,h/2+bh,bw,-bh);
  });
  ctx.strokeStyle='#333'; ctx.lineWidth=1;
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
    if "video" not in request.files or request.files["video"].filename == "":
        return jsonify(error="No video file"), 400

    f = request.files["video"]
    try:
        start    = float(request.form.get("start", 10))
        duration = float(request.form.get("duration", 16))
        bpm_in   = request.form.get("bpm")
        bpm_val  = float(bpm_in) if bpm_in else None
        roi_str  = request.form.get("roi", "0.4,0.2,1.0,1.0")
        roi      = tuple(float(x) for x in roi_str.split(","))
        if len(roi) != 4:
            raise ValueError("ROI must be 4 values")
    except Exception as e:
        return jsonify(error=f"Bad parameters: {e}"), 400

    suffix = Path(f.filename).suffix or ".mp4"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        f.save(tmp.name)
        video_path = tmp.name

    try:
        # Optical flow analysis
        times, velocities, fps = vertical_motion_signal(
            video_path, start, duration, roi
        )
        strokes = detect_strokes(times, velocities, fps)
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
