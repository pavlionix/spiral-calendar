#!/usr/bin/env python3
"""
Analyze guitar strumming pattern from a YouTube video.

Requirements:
    pip install yt-dlp anthropic opencv-python

Usage:
    python analyze_guitar.py <youtube_url>
    python analyze_guitar.py "https://youtu.be/5oGbWzIDX8k"
"""

import sys
import os
import base64
import subprocess
import tempfile
from pathlib import Path

try:
    import cv2
except ImportError:
    sys.exit("Install opencv: pip install opencv-python")

try:
    import anthropic
except ImportError:
    sys.exit("Install anthropic: pip install anthropic")


FRAMES_PER_SECOND = 2      # сколько кадров в секунду извлекать
MAX_FRAMES = 20             # максимум кадров для анализа
START_OFFSET_SEC = 10      # пропустить первые N секунд (обычно вступление)


def download_video(url: str, output_path: str) -> str:
    """Download video using yt-dlp, return path to downloaded file."""
    print(f"Downloading: {url}")
    result = subprocess.run(
        [
            "yt-dlp",
            "-f", "best[height<=720]",
            "--no-playlist",
            "-o", output_path,
            url,
        ],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(result.stderr)
        sys.exit("Download failed. Make sure yt-dlp is installed: pip install yt-dlp")

    # yt-dlp may change extension — find the actual file
    parent = Path(output_path).parent
    stem = Path(output_path).stem
    for f in parent.iterdir():
        if f.stem == stem:
            return str(f)
    sys.exit("Downloaded file not found")


def extract_frames(video_path: str, out_dir: str) -> list[str]:
    """Extract frames at FRAMES_PER_SECOND rate, skipping the first START_OFFSET_SEC."""
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps

    print(f"Video duration: {duration:.1f}s, FPS: {fps:.1f}")

    step = max(1, int(fps / FRAMES_PER_SECOND))
    start_frame = int(START_OFFSET_SEC * fps)

    saved = []
    frame_idx = 0
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

    while len(saved) < MAX_FRAMES:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % step == 0:
            path = os.path.join(out_dir, f"frame_{frame_idx:05d}.jpg")
            cv2.imwrite(path, frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
            saved.append(path)
        frame_idx += 1

    cap.release()
    print(f"Extracted {len(saved)} frames")
    return saved


def frame_to_base64(path: str) -> str:
    with open(path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")


def analyze_strumming(frame_paths: list[str]) -> str:
    """Send frames to Claude and ask to identify strumming pattern."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        sys.exit("Set ANTHROPIC_API_KEY environment variable")

    client = anthropic.Anthropic(api_key=api_key)

    content = []

    content.append({
        "type": "text",
        "text": (
            "You are a guitar teacher. I will show you frames from a guitar performance video. "
            "Please analyze the right hand strumming technique and identify:\n"
            "1. The strumming pattern (use ↓ for downstroke, ↑ for upstroke, × for mute, _ for pause)\n"
            "2. Time signature (4/4, 3/4, 6/8 etc.)\n"
            "3. Tempo feel (slow, medium, fast)\n"
            "4. Any special technique (fingerpicking, palm mute, etc.)\n\n"
            "Focus on the right hand position and motion in each frame."
        )
    })

    for i, path in enumerate(frame_paths):
        content.append({
            "type": "text",
            "text": f"Frame {i + 1}:"
        })
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": frame_to_base64(path),
            }
        })

    content.append({
        "type": "text",
        "text": "Based on all frames, what is the strumming pattern? Write it clearly so I can play it."
    })

    print("Sending frames to Claude for analysis...")
    response = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=1024,
        messages=[{"role": "user", "content": content}]
    )

    return response.content[0].text


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    url = sys.argv[1]

    with tempfile.TemporaryDirectory() as tmpdir:
        video_path = download_video(url, os.path.join(tmpdir, "video.%(ext)s"))
        frame_paths = extract_frames(video_path, tmpdir)

        if not frame_paths:
            sys.exit("No frames extracted. Check video path.")

        result = analyze_strumming(frame_paths)

    print("\n" + "=" * 60)
    print("GUITAR STRUMMING PATTERN ANALYSIS")
    print("=" * 60)
    print(result)
    print("=" * 60)


if __name__ == "__main__":
    main()
