#!/usr/bin/env python3
"""
strum_analyzer — determine a guitar strumming pattern from a video.

Two analysis engines:

  motion  (default) — pure OpenCV: tracks vertical motion of the strumming
          hand via optical flow, detects down/up strokes, groups them into
          measures and prints a pattern like  ↓ ↓↑ ↑↓↑
          Works fully offline, no API key needed.

  vision  — sends extracted frames to Claude Vision for a musical
          interpretation (chords, technique, feel). Requires ANTHROPIC_API_KEY.

Input can be a local video file or a YouTube URL (downloaded via yt-dlp).

Requirements:
    pip install opencv-python numpy            # motion engine
    pip install yt-dlp                         # only for YouTube URLs
    pip install anthropic                      # only for --engine vision

Usage:
    python strum_analyzer.py VIDEO_OR_URL [options]

Examples:
    python strum_analyzer.py song.mp4
    python strum_analyzer.py "https://youtu.be/5oGbWzIDX8k" --start 15 --duration 20
    python strum_analyzer.py song.mp4 --engine vision
    python strum_analyzer.py song.mp4 --roi 0.5,0.3,1.0,0.9   # x1,y1,x2,y2 fractions

Options:
    --start SEC        skip intro, start analysis at SEC (default 10)
    --duration SEC     analyze SEC seconds of video (default 16)
    --roi X1,Y1,X2,Y2  region of interest as fractions of frame size where the
                       strumming hand is (default right half: 0.4,0.2,1.0,1.0)
    --bpm BPM          assume tempo; if omitted, estimated from stroke timing
    --engine ENGINE    motion | vision (default motion)
    --debug-dir DIR    save annotated frames there for inspection
"""

import argparse
import base64
import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np

try:
    import cv2
except ImportError:
    sys.exit("Install opencv: pip install opencv-python")


# ----------------------------------------------------------------------------
# Input handling
# ----------------------------------------------------------------------------

def resolve_input(source: str, tmpdir: str) -> str:
    """Return a local video path; download with yt-dlp if source is a URL."""
    if os.path.exists(source):
        return source
    if not source.startswith(("http://", "https://")):
        sys.exit(f"Not a file and not a URL: {source}")

    print(f"Downloading: {source}")
    out_tpl = os.path.join(tmpdir, "video.%(ext)s")
    result = subprocess.run(
        ["yt-dlp", "-f", "best[height<=720]", "--no-playlist", "-o", out_tpl, source],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(result.stderr)
        sys.exit("Download failed. Is yt-dlp installed? (pip install yt-dlp)")

    for f in Path(tmpdir).iterdir():
        if f.stem == "video":
            return str(f)
    sys.exit("Downloaded file not found")


# ----------------------------------------------------------------------------
# Motion engine: optical-flow stroke detection
# ----------------------------------------------------------------------------

@dataclass
class Stroke:
    time: float       # seconds from start of analyzed window
    direction: str    # "down" | "up"
    strength: float   # peak vertical velocity (px/frame, ROI-relative)


def vertical_motion_signal(video_path, start, duration, roi, debug_dir=None):
    """Sample mean vertical optical flow inside the ROI for each frame.

    Returns (times, velocities, fps). Positive velocity = downward motion
    (image y grows downward), negative = upward.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        sys.exit(f"Cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    cap.set(cv2.CAP_PROP_POS_MSEC, start * 1000)

    ret, frame = cap.read()
    if not ret:
        sys.exit("Video shorter than --start offset")

    h, w = frame.shape[:2]
    x1, y1 = int(roi[0] * w), int(roi[1] * h)
    x2, y2 = int(roi[2] * w), int(roi[3] * h)

    def crop_gray(img):
        g = cv2.cvtColor(img[y1:y2, x1:x2], cv2.COLOR_BGR2GRAY)
        return cv2.GaussianBlur(g, (5, 5), 0)

    prev = crop_gray(frame)
    times, velocities = [], []
    n_frames = int(duration * fps)

    for i in range(n_frames):
        ret, frame = cap.read()
        if not ret:
            break
        gray = crop_gray(frame)

        flow = cv2.calcOpticalFlowFarneback(
            prev, gray, None,
            pyr_scale=0.5, levels=3, winsize=21,
            iterations=3, poly_n=7, poly_sigma=1.5, flags=0,
        )
        # Weight flow by where motion actually happens, so the static
        # background doesn't dilute the hand's movement.
        mag = np.linalg.norm(flow, axis=2)
        thresh = max(0.5, float(np.percentile(mag, 90)))
        mask = mag >= thresh
        vy = float(flow[..., 1][mask].mean()) if mask.any() else 0.0

        times.append((i + 1) / fps)
        velocities.append(vy)
        prev = gray

        if debug_dir and i % int(fps // 4 + 1) == 0:
            dbg = frame.copy()
            cv2.rectangle(dbg, (x1, y1), (x2, y2), (0, 255, 0), 2)
            label = f"vy={vy:+.2f}"
            cv2.putText(dbg, label, (x1 + 5, y1 + 25),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
            cv2.imwrite(os.path.join(debug_dir, f"dbg_{i:05d}.jpg"), dbg)

    cap.release()
    return np.array(times), np.array(velocities), fps


def detect_strokes(times, velocities, fps, thresh_k: float = 2.0):
    """Turn the velocity signal into a list of discrete strokes.

    thresh_k controls sensitivity: lower = more strokes detected (default 2.0).
    The web UI exposes this as a 1-10 slider mapped to ~0.8-3.5.
    """
    if len(velocities) == 0:
        return []

    # Smooth with ~40 ms window to kill single-frame noise
    k = max(1, int(round(fps * 0.04)))
    kernel = np.ones(k) / k
    v = np.convolve(velocities, kernel, mode="same")

    noise = float(np.median(np.abs(v))) or 1e-6
    threshold = max(noise * thresh_k, float(np.abs(v).max()) * 0.10)

    strokes = []
    i = 0
    while i < len(v):
        if abs(v[i]) < threshold:
            i += 1
            continue
        sign = np.sign(v[i])
        j = i
        while j < len(v) and np.sign(v[j]) == sign and abs(v[j]) >= threshold * 0.4:
            j += 1
        seg = v[i:j]
        peak_rel = int(np.argmax(np.abs(seg)))
        strokes.append(Stroke(
            time=float(times[i + peak_rel]),
            direction="down" if sign > 0 else "up",
            strength=float(abs(seg[peak_rel])),
        ))
        i = j

    # Merge strokes closer than 60 ms (same physical motion split by noise)
    merged = []
    for s in strokes:
        if merged and s.direction == merged[-1].direction and s.time - merged[-1].time < 0.06:
            if s.strength > merged[-1].strength:
                merged[-1] = s
        else:
            merged.append(s)
    return merged


def estimate_beat(strokes, bpm=None):
    """Return seconds per beat. Use given bpm, else infer from downstroke gaps."""
    if bpm:
        return 60.0 / bpm
    downs = [s.time for s in strokes if s.direction == "down"]
    if len(downs) < 3:
        all_t = [s.time for s in strokes]
        gaps = np.diff(all_t) if len(all_t) > 2 else np.array([0.5])
        return float(np.median(gaps)) * 2
    gaps = np.diff(downs)
    gaps = gaps[(gaps > 0.15) & (gaps < 2.0)]
    return float(np.median(gaps)) if len(gaps) else 0.5


def format_pattern(strokes, spb):
    """Quantize strokes to an 8th-note grid and render measures of 4/4."""
    if not strokes:
        return "No strokes detected — try adjusting --roi/--start, or use --debug-dir to check the region."

    eighth = spb / 2
    t0 = strokes[0].time
    grid = {}
    for s in strokes:
        slot = int(round((s.time - t0) / eighth))
        # On collision keep the stronger stroke
        if slot not in grid or s.strength > grid[slot].strength:
            grid[slot] = s

    n_slots = max(grid) + 1
    symbols = []
    for i in range(n_slots):
        if i in grid:
            symbols.append("↓" if grid[i].direction == "down" else "↑")
        else:
            symbols.append("·")

    # Render in measures of 8 eighth-notes with beat numbers
    lines = []
    for m in range(0, n_slots, 8):
        chunk = symbols[m:m + 8]
        chunk += ["·"] * (8 - len(chunk))
        beats = "1 & 2 & 3 & 4 &"
        lines.append(f"  {beats}\n  {' '.join(chunk)}")
    return "\n\n".join(lines)


def find_repeating_bar(strokes, spb):
    """Try to find the single most common one-bar pattern."""
    eighth = spb / 2
    t0 = strokes[0].time
    bars = {}
    for s in strokes:
        slot = int(round((s.time - t0) / eighth))
        bar, pos = divmod(slot, 8)
        bars.setdefault(bar, {})
        cur = bars[bar].get(pos)
        if cur is None or s.strength > cur.strength:
            bars[bar][pos] = s

    def bar_key(b):
        return tuple(
            ("↓" if b[p].direction == "down" else "↑") if p in b else "·"
            for p in range(8)
        )

    counts = {}
    for b in bars.values():
        counts[bar_key(b)] = counts.get(bar_key(b), 0) + 1
    if not counts:
        return None
    best, n = max(counts.items(), key=lambda kv: kv[1])
    if n < 2:
        return None
    return best, n, len(bars)


def run_motion_engine(video_path, args):
    debug_dir = args.debug_dir
    if debug_dir:
        os.makedirs(debug_dir, exist_ok=True)

    print(f"Analyzing motion: start={args.start}s, duration={args.duration}s, roi={args.roi}")
    times, velocities, fps = vertical_motion_signal(
        video_path, args.start, args.duration, args.roi, debug_dir
    )
    strokes = detect_strokes(times, velocities, fps)
    print(f"Detected {len(strokes)} strokes "
          f"({sum(s.direction == 'down' for s in strokes)} down, "
          f"{sum(s.direction == 'up' for s in strokes)} up)")

    if not strokes:
        print(format_pattern(strokes, 0.5))
        return

    spb = estimate_beat(strokes, args.bpm)
    bpm = 60.0 / spb
    print(f"Estimated tempo: ~{bpm:.0f} BPM "
          f"({'given' if args.bpm else 'from downstroke spacing'})")

    print("\nStroke timeline (↓ = downstroke, ↑ = upstroke, · = rest):\n")
    print(format_pattern(strokes, spb))

    rep = find_repeating_bar(strokes, spb)
    if rep:
        pattern, n, total = rep
        print(f"\nMost common bar pattern ({n}/{total} bars):\n")
        print("  1 & 2 & 3 & 4 &")
        print("  " + " ".join(pattern))


# ----------------------------------------------------------------------------
# Vision engine: Claude analyzes extracted frames
# ----------------------------------------------------------------------------

def run_vision_engine(video_path, args):
    try:
        import anthropic
    except ImportError:
        sys.exit("Install anthropic: pip install anthropic")
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        sys.exit("Set ANTHROPIC_API_KEY for --engine vision")

    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    cap.set(cv2.CAP_PROP_POS_MSEC, args.start * 1000)

    max_frames = 20
    step = max(1, int(args.duration * fps / max_frames))
    frames = []
    i = 0
    while len(frames) < max_frames:
        ret, frame = cap.read()
        if not ret:
            break
        if i % step == 0:
            ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
            if ok:
                t = args.start + i / fps
                frames.append((t, base64.standard_b64encode(buf).decode()))
        i += 1
    cap.release()
    print(f"Extracted {len(frames)} frames, sending to Claude...")

    content = [{
        "type": "text",
        "text": (
            "You are a guitar teacher. These are sequential frames from a guitar "
            "performance (timestamps given). Analyze the right-hand strumming:\n"
            "1. Strumming pattern (↓ down, ↑ up, × mute, · rest) on a 1&2&3&4& grid\n"
            "2. Time signature and tempo feel\n"
            "3. Technique notes (palm mute, accents, fingerstyle)\n"
            "Write the final pattern so a student can play it."
        ),
    }]
    for t, b64 in frames:
        content.append({"type": "text", "text": f"t={t:.2f}s:"})
        content.append({"type": "image", "source": {
            "type": "base64", "media_type": "image/jpeg", "data": b64}})

    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=1024,
        messages=[{"role": "user", "content": content}],
    )
    print("\n" + "=" * 60)
    print(response.content[0].text)
    print("=" * 60)


# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------

def parse_roi(text):
    parts = [float(p) for p in text.split(",")]
    if len(parts) != 4 or not all(0 <= p <= 1 for p in parts):
        raise argparse.ArgumentTypeError("ROI must be x1,y1,x2,y2 fractions in [0,1]")
    if parts[0] >= parts[2] or parts[1] >= parts[3]:
        raise argparse.ArgumentTypeError("ROI must have x1<x2 and y1<y2")
    return tuple(parts)


def main():
    parser = argparse.ArgumentParser(
        description="Determine guitar strumming pattern from a video.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("source", help="local video file or YouTube URL")
    parser.add_argument("--start", type=float, default=10.0)
    parser.add_argument("--duration", type=float, default=16.0)
    parser.add_argument("--roi", type=parse_roi, default=(0.4, 0.2, 1.0, 1.0),
                        help="x1,y1,x2,y2 fractions of frame containing the strumming hand")
    parser.add_argument("--bpm", type=float, default=None)
    parser.add_argument("--engine", choices=["motion", "vision"], default="motion")
    parser.add_argument("--debug-dir", default=None)
    args = parser.parse_args()

    with tempfile.TemporaryDirectory() as tmpdir:
        video_path = resolve_input(args.source, tmpdir)
        if args.engine == "motion":
            run_motion_engine(video_path, args)
        else:
            run_vision_engine(video_path, args)


if __name__ == "__main__":
    main()
