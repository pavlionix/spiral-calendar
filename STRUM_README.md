# Strum Analyzer

Strum Analyzer detects guitar strumming patterns from a video file or YouTube URL. It uses dense optical flow (Farneback method) to measure vertical hand motion inside a configurable region of interest, quantizes the resulting velocity signal into down- and up-strokes on an eighth-note grid, estimates tempo from downstroke spacing, and reports the most common one-bar pattern across the analyzed clip. A Flask web UI provides a sports-analytics-style overlay with frame playback, a velocity timeline, and live metric cards.

---

## Requirements

```bash
pip install flask opencv-python numpy   # core (motion engine + web UI)
pip install yt-dlp                      # only if you want to analyze YouTube URLs
pip install anthropic                   # only if you want --engine vision
```

---

## Quick Start

### CLI

```bash
# Analyze a local file (default: start at 10 s, 16 s window)
python strum_analyzer.py song.mp4

# Start 30 s in, analyze 20 s, hint the tempo
python strum_analyzer.py song.mp4 --start 30 --duration 20 --bpm 120

# Narrow the ROI to the right half of the frame
python strum_analyzer.py song.mp4 --roi 0.5,0.2,1.0,1.0

# Analyze a YouTube video
python strum_analyzer.py "https://youtu.be/5oGbWzIDX8k" --start 15

# Save annotated debug frames
python strum_analyzer.py song.mp4 --debug-dir ./debug_out
```

### Web UI

```bash
python strum_ui.py --port 7860
# Then open http://localhost:7860
```

---

## Options

| Flag | Default | Description |
|---|---|---|
| `--start SEC` | `10` | Skip intro; begin analysis at this offset (seconds) |
| `--duration SEC` | `16` | Length of the window to analyze (seconds) |
| `--roi X1,Y1,X2,Y2` | `0.4,0.2,1.0,1.0` | Region of interest as frame fractions (0–1). Set this to the area where the strumming hand moves. |
| `--bpm BPM` | *(auto)* | Assume this tempo instead of estimating it from stroke timing |
| `--engine` | `motion` | `motion` for optical-flow (offline); `vision` to send frames to Claude (requires `ANTHROPIC_API_KEY`) |
| `--debug-dir DIR` | *(off)* | Save annotated JPEG frames to this directory for visual inspection |

---

## How the Motion Engine Works

Each frame pair is processed with OpenCV's Farneback dense optical flow, which yields a per-pixel 2-D displacement field. Only the vertical component (y-axis) is used, and only for pixels whose flow magnitude exceeds the 90th percentile — this weights the hand's movement heavily while ignoring the relatively static guitar body and background. The resulting scalar velocity signal is lightly smoothed (~40 ms moving average) and then segmented: contiguous runs of same-sign velocity above an adaptive threshold become candidate strokes. Runs shorter than 60 ms are merged with their neighbors to eliminate noise spikes. Stroke times are placed at the frame with peak velocity within each run.

---

## Interpreting the Output

**Pattern notation** uses three symbols on an 8-slot eighth-note grid:

| Symbol | Meaning |
|---|---|
| `↓` | Downstroke detected |
| `↑` | Upstroke detected |
| `·` | Rest / no stroke on this eighth note |

**Grid layout** — one bar of 4/4:

```
1  &  2  &  3  &  4  &
↓  ·  ↓  ↑  ·  ↑  ↓  ↑
```

**BPM** is estimated from the median gap between consecutive downstrokes unless `--bpm` is given.

**Most common bar** — the CLI and web UI both find the single bar pattern that repeats most often and report it along with how many times it occurred (e.g., "3/5 bars").

**Strength** — each stroke has a `strength` value (peak optical-flow velocity) that can be used to identify accented beats; the CLI does not print it directly but it is included in the JSON response from the web UI.

---

## Using the Web UI

1. Start the server:
   ```bash
   python strum_ui.py --port 7860
   ```
2. Open `http://localhost:7860` in your browser.
3. Click **Choose File** and select your guitar video (mp4, mov, webm, etc.).
4. Set **Start** (seconds into the video to skip intro) and **Duration** (how many seconds to analyze).
5. Optionally enter **BPM** if you know the tempo.
6. Adjust the **ROI** field to a tighter box around the strumming hand for better accuracy (e.g., `0.5,0.3,1.0,0.9`).
7. Click **Analyze Pattern** and wait for processing (typically 5–30 s depending on file size and duration).
8. The results screen shows:
   - **Left panel**: annotated video playback with ROI rectangle and stroke arrow overlaid on each frame.
   - **Right panel**: four metric cards — Strum Direction (color-coded arrow), Strum Speed (sparkline), Tempo (BPM), and Pattern (YES/NO with the 8-cell grid; the current beat slot pulses as the video plays).
   - **Bottom bar**: full-width velocity timeline waveform with stroke dots and a scrubber for manual frame-by-frame inspection.
9. Click **New Video** to return to the upload screen.
