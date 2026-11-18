"""
Frame Processing Pipeline for NOCTIS/AERION
1. Extract dismantle frames from FLOW CLIP.mp4
2. Join hero clips 1+2+3 with near-duplicate removal at joins
3. Convert all to WebP at desktop (1600px) and mobile (960px) sizes
"""

import os
import re
import sys
from pathlib import Path
from PIL import Image
import cv2
import numpy as np

BASE = Path(r"c:\Users\gurudineshch\Desktop\aeroplane")
ASSETS = BASE / "assets" / "frames"

# Output dirs
HERO_DIR = ASSETS / "hero"
HERO_MOBILE_DIR = ASSETS / "hero-mobile"
DISMANTLE_DIR = ASSETS / "dismantle"
DISMANTLE_MOBILE_DIR = ASSETS / "dismantle-mobile"

for d in [HERO_DIR, HERO_MOBILE_DIR, DISMANTLE_DIR, DISMANTLE_MOBILE_DIR]:
    d.mkdir(parents=True, exist_ok=True)

def natural_sort_key(s):
    """Sort strings with embedded numbers naturally."""
    return [int(c) if c.isdigit() else c.lower() for c in re.split(r'(\d+)', str(s))]

def get_sorted_frames(folder, extensions=('.jpg', '.jpeg', '.png')):
    """Get all image files sorted in natural numeric order."""
    files = [f for f in Path(folder).iterdir() if f.suffix.lower() in extensions]
    files.sort(key=natural_sort_key)
    return files

def images_are_similar(img_path1, img_path2, threshold=0.98):
    """Check if two images are nearly identical using normalized correlation."""
    img1 = cv2.imread(str(img_path1), cv2.IMREAD_GRAYSCALE)
    img2 = cv2.imread(str(img_path2), cv2.IMREAD_GRAYSCALE)
    if img1 is None or img2 is None:
        return False
    # Resize to same small size for fast comparison
    size = (160, 90)
    img1 = cv2.resize(img1, size)
    img2 = cv2.resize(img2, size)
    # Normalized cross-correlation
    corr = np.corrcoef(img1.flatten().astype(float), img2.flatten().astype(float))[0, 1]
    return corr >= threshold

def convert_and_save(src_path, dst_path, width, quality):
    """Open image, resize to width (maintaining aspect ratio), save as WebP."""
    img = Image.open(src_path)
    # Calculate new height maintaining aspect ratio
    ratio = width / img.width
    new_height = round(img.height * ratio)
    img = img.resize((width, new_height), Image.LANCZOS)
    img.save(dst_path, 'WEBP', quality=quality)

# =============================================================
# STEP 1: Extract dismantle frames from FLOW CLIP.mp4
# =============================================================
print("=" * 60)
print("STEP 1: Extracting dismantle frames from FLOW CLIP.mp4")
print("=" * 60)

flow_clip = BASE / "FLOW CLIP.mp4"
dismantle_src_dir = BASE / "_dismantle_extracted"
dismantle_src_dir.mkdir(exist_ok=True)

cap = cv2.VideoCapture(str(flow_clip))
if not cap.isOpened():
    print(f"ERROR: Cannot open {flow_clip}")
    sys.exit(1)

fps = cap.get(cv2.CAP_PROP_FPS)
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
print(f"  Video: {fps:.1f} fps, {total_frames} total frames")

# Extract every frame
frame_idx = 0
extracted = 0
while True:
    ret, frame = cap.read()
    if not ret:
        break
    frame_idx += 1
    out_path = dismantle_src_dir / f"frame_{frame_idx:04d}.jpg"
    cv2.imwrite(str(out_path), frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
    extracted += 1

cap.release()
print(f"  Extracted {extracted} frames from FLOW CLIP.mp4")

# =============================================================
# STEP 2: Join hero clips with near-duplicate removal
# =============================================================
print("\n" + "=" * 60)
print("STEP 2: Joining hero clips 1 + 2 + 3")
print("=" * 60)

clip1_frames = get_sorted_frames(BASE / "CLIP1-ezgif-split")
clip2_frames = get_sorted_frames(BASE / "CLIP2-ezgif-split")
clip3_frames = get_sorted_frames(BASE / "CLIP3-ezgif-split")

print(f"  Clip 1: {len(clip1_frames)} frames")
print(f"  Clip 2: {len(clip2_frames)} frames")
print(f"  Clip 3: {len(clip3_frames)} frames")

# Build joined sequence, removing near-duplicate transition frames
hero_frames = list(clip1_frames)  # start with all of clip 1

# Check if clip2's first frames are similar to clip1's last frame
skip2 = 0
for i, f in enumerate(clip2_frames[:5]):  # check up to first 5 frames
    if images_are_similar(clip1_frames[-1], f):
        skip2 = i + 1
    else:
        break
print(f"  Skipping {skip2} duplicate frame(s) at clip1→clip2 join")
hero_frames.extend(clip2_frames[skip2:])

# Check if clip3's first frames are similar to clip2's last frame
skip3 = 0
for i, f in enumerate(clip3_frames[:5]):
    if images_are_similar(clip2_frames[-1], f):
        skip3 = i + 1
    else:
        break
print(f"  Skipping {skip3} duplicate frame(s) at clip2→clip3 join")
hero_frames.extend(clip3_frames[skip3:])

print(f"  Total hero frames after joining: {len(hero_frames)}")

# =============================================================
# STEP 3: Convert everything to WebP
# =============================================================
print("\n" + "=" * 60)
print("STEP 3: Converting hero frames to WebP")
print("=" * 60)

for i, src in enumerate(hero_frames, 1):
    name = f"frame_{i:04d}.webp"
    # Desktop: 1600px, quality 78
    convert_and_save(src, HERO_DIR / name, 1600, 78)
    # Mobile: 960px, quality 72
    convert_and_save(src, HERO_MOBILE_DIR / name, 960, 72)
    if i % 50 == 0 or i == len(hero_frames):
        print(f"  Hero: {i}/{len(hero_frames)}")

print("\n" + "=" * 60)
print("STEP 4: Converting dismantle frames to WebP")
print("=" * 60)

dismantle_frames = get_sorted_frames(dismantle_src_dir)
print(f"  Dismantle source frames: {len(dismantle_frames)}")

for i, src in enumerate(dismantle_frames, 1):
    name = f"frame_{i:04d}.webp"
    convert_and_save(src, DISMANTLE_DIR / name, 1600, 78)
    convert_and_save(src, DISMANTLE_MOBILE_DIR / name, 960, 72)
    if i % 50 == 0 or i == len(dismantle_frames):
        print(f"  Dismantle: {i}/{len(dismantle_frames)}")

# =============================================================
# SUMMARY
# =============================================================
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)

for label, folder in [
    ("hero", HERO_DIR),
    ("hero-mobile", HERO_MOBILE_DIR),
    ("dismantle", DISMANTLE_DIR),
    ("dismantle-mobile", DISMANTLE_MOBILE_DIR),
]:
    files = list(folder.glob("*.webp"))
    total_bytes = sum(f.stat().st_size for f in files)
    total_mb = total_bytes / (1024 * 1024)
    print(f"  {label}: {len(files)} frames, {total_mb:.1f} MB total")

print(f"\nHero frame count: {len(hero_frames)}")
print(f"Dismantle frame count: {len(dismantle_frames)}")
print("\nDone!")
