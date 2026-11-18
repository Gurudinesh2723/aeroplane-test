"""
Rebuild scroll frames directly from the source MP4s (no ezgif / JPG middle step).

- Decodes each video frame losslessly with OpenCV
- Desktop: Lanczos upscale 1280x720 -> 1920x1080 + gentle unsharp mask, WebP q90
- Mobile:  Lanczos downscale to 960px, WebP q85
Hero = CLIP1 + CLIP2 + CLIP3 (first 4 frames of CLIP3 skipped, same as before)
Dismantle = FLOW CLIP

Usage:  python rebuild_frames.py            (full rebuild)
        python rebuild_frames.py --test     (writes one sample frame to _frame_test/)
"""

import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

import cv2
import numpy as np
from PIL import Image

BASE = Path(__file__).resolve().parent
FRAMES = BASE / "assets" / "frames"

DESKTOP_W, DESKTOP_H = 1920, 1080
MOBILE_W, MOBILE_H = 960, 540
DESKTOP_Q, MOBILE_Q = 90, 85


def read_video(path):
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        sys.exit(f"Cannot open {path}")
    frames = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        frames.append(f)
    cap.release()
    return frames


WM_BOX = (1110, 550, 1210, 650)   # x0, y0, x1, y1 in 1280x720 source pixels
_ALPHA = None


def watermark_alpha():
    """Measure the sparkle watermark's per-pixel opacity from CLIP1, where it sits on
    near-black sky. The mark is a semi-transparent white overlay: I = B*(1-a) + 255*a."""
    global _ALPHA
    if _ALPHA is None:
        x0, y0, x1, y1 = WM_BOX
        crops = [f[y0:y1, x0:x1].astype(np.float32) for f in read_video(BASE / "CLIP1.mp4")]
        mn = np.stack(crops).min(axis=0).mean(axis=2)
        bg = np.median(mn)
        alpha = np.clip((mn - bg) / (255.0 - bg), 0, 0.95)
        alpha[alpha < 0.02] = 0
        _ALPHA = alpha[..., None]
    return _ALPHA


def remove_watermark(frames):
    """Exactly reverse the alpha-blended watermark, then lightly clean the anti-aliased rim."""
    a = watermark_alpha()
    x0, y0, x1, y1 = WM_BOX
    rim = ((a[..., 0] > 0.02) & (a[..., 0] < 0.25)).astype(np.uint8) * 255
    out = []
    for f in frames:
        f = f.copy()
        crop = f[y0:y1, x0:x1].astype(np.float32)
        restored = (crop - 255.0 * a) / (1.0 - a)
        crop = np.clip(restored, 0, 255).astype(np.uint8)
        if rim.any():
            crop = cv2.inpaint(crop, rim, 2, cv2.INPAINT_TELEA)
        f[y0:y1, x0:x1] = crop
        out.append(f)
    return out


def sharpen(img, amount=0.55, sigma=1.1):
    blur = cv2.GaussianBlur(img, (0, 0), sigma)
    return cv2.addWeighted(img, 1 + amount, blur, -amount, 0)


def save_webp(bgr, path, q):
    Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)).save(path, "WEBP", quality=q, method=6)


def process(args):
    frame, name, desk_dir, mob_dir = args
    desk = cv2.resize(frame, (DESKTOP_W, DESKTOP_H), interpolation=cv2.INTER_LANCZOS4)
    desk = sharpen(desk)
    save_webp(desk, desk_dir / name, DESKTOP_Q)
    mob = cv2.resize(frame, (MOBILE_W, MOBILE_H), interpolation=cv2.INTER_AREA)
    mob = sharpen(mob, amount=0.3, sigma=0.8)
    save_webp(mob, mob_dir / name, MOBILE_Q)


def build(frames, desk_dir, mob_dir):
    desk_dir.mkdir(parents=True, exist_ok=True)
    mob_dir.mkdir(parents=True, exist_ok=True)
    tasks = [(f, f"frame_{i:04d}.webp", desk_dir, mob_dir) for i, f in enumerate(frames, 1)]
    with ThreadPoolExecutor(max_workers=8) as ex:
        list(ex.map(process, tasks))
    print(f"  {desk_dir.name}: {len(frames)} frames")


if __name__ == "__main__":
    if "--test" in sys.argv:
        out = BASE / "_frame_test"
        frames = remove_watermark(read_video(BASE / "FLOW CLIP.mp4"))
        build([frames[149]], out / "desk", out / "mob")
        sys.exit(0)

    clip = lambda n: remove_watermark(read_video(BASE / n))
    hero = clip("CLIP1.mp4") + clip("CLIP2.mp4") + clip("CLIP3.mp4")[4:]
    dismantle = clip("FLOW CLIP.mp4")
    print(f"Hero {len(hero)} frames, dismantle {len(dismantle)} frames")
    build(hero, FRAMES / "hero", FRAMES / "hero-mobile")
    build(dismantle, FRAMES / "dismantle", FRAMES / "dismantle-mobile")
    print("Done")
