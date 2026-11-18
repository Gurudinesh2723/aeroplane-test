"""
Enhance all frames with:
- Lanczos 1600px width
- Detail sharpening (UnsharpMask)
- High WebP quality (92 desktop, 85 mobile)
- Multi-threaded fast conversion
"""

import os
import re
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageFilter

BASE = Path(r"c:\Users\gurudineshch\Desktop\aeroplane")
ASSETS = BASE / "assets" / "frames"

HERO_DIR = ASSETS / "hero"
HERO_MOBILE_DIR = ASSETS / "hero-mobile"
DISMANTLE_DIR = ASSETS / "dismantle"
DISMANTLE_MOBILE_DIR = ASSETS / "dismantle-mobile"

def natural_sort_key(s):
    return [int(c) if c.isdigit() else c.lower() for c in re.split(r'(\d+)', str(s))]

def get_sorted_frames(folder, extensions=('.jpg', '.jpeg', '.png')):
    files = [f for f in Path(folder).iterdir() if f.suffix.lower() in extensions]
    files.sort(key=natural_sort_key)
    return files

def process_one(task):
    src_path, dst_desktop, dst_mobile = task
    img = Image.open(src_path)

    # Desktop: 1600px, quality 92, subtle sharpening
    ratio_d = 1600 / img.width
    h_d = round(img.height * ratio_d)
    img_d = img.resize((1600, h_d), Image.LANCZOS)
    img_d = img_d.filter(ImageFilter.UnsharpMask(radius=1.0, percent=80, threshold=1))
    img_d.save(dst_desktop, 'WEBP', quality=92)

    # Mobile: 960px, quality 85
    ratio_m = 960 / img.width
    h_m = round(img.height * ratio_m)
    img_m = img.resize((960, h_m), Image.LANCZOS)
    img_m = img_m.filter(ImageFilter.UnsharpMask(radius=0.8, percent=60, threshold=1))
    img_m.save(dst_mobile, 'WEBP', quality=85)

# Build hero frames
clip1 = get_sorted_frames(BASE / "CLIP1-ezgif-split")
clip2 = get_sorted_frames(BASE / "CLIP2-ezgif-split")
clip3 = get_sorted_frames(BASE / "CLIP3-ezgif-split")

hero_srcs = list(clip1) + list(clip2) + list(clip3[4:])  # 4 duplicate frames skipped at clip3
print(f"Total hero frames: {len(hero_srcs)}")

hero_tasks = []
for i, src in enumerate(hero_srcs, 1):
    name = f"frame_{i:04d}.webp"
    hero_tasks.append((src, HERO_DIR / name, HERO_MOBILE_DIR / name))

# Build dismantle frames
dismantle_srcs = get_sorted_frames(BASE / "_dismantle_extracted")
print(f"Total dismantle frames: {len(dismantle_srcs)}")

dismantle_tasks = []
for i, src in enumerate(dismantle_srcs, 1):
    name = f"frame_{i:04d}.webp"
    dismantle_tasks.append((src, DISMANTLE_DIR / name, DISMANTLE_MOBILE_DIR / name))

all_tasks = hero_tasks + dismantle_tasks
print(f"Processing {len(all_tasks)} frames with 8 worker threads...")

with ThreadPoolExecutor(max_workers=8) as executor:
    list(executor.map(process_one, all_tasks))

print("Enhancement complete!")
