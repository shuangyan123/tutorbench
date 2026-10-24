"""Builds assets/atmos.webp: the page's misty light, like wet pigment bleeding into paper.
Large soft glows (peach-pink, lavender, pale white) on the periwinkle base, their edges pushed
about by low-frequency noise so they bleed instead of fading in perfect circles.
Run: python3 tools/build-atmos.py  (needs numpy + Pillow)"""
import os
import numpy as np
from PIL import Image, ImageFilter

W, H = 1600, 1000
rng = np.random.default_rng(7)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets", "atmos.webp")

def noise(scale, octaves=4):
    out = np.zeros((H, W)); amp = 1.0; tot = 0
    for o in range(octaves):
        gx, gy = max(2, int(W / scale * 2 ** o)), max(2, int(H / scale * 2 ** o))
        g = Image.fromarray((rng.random((gy, gx)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
        out += amp * (np.asarray(g) / 255.0 - 0.5); tot += amp; amp *= 0.5
    return out / tot

yy, xx = np.mgrid[0:H, 0:W].astype(float)
# domain warp: every glow's outline is pushed by the same slow noise, so they bleed into each other
wx, wy = noise(700) * 260, noise(700) * 260
X, Y = xx + wx, yy + wy

base = np.array([0xcc, 0xd6, 0xec], float) / 255
img = np.ones((H, W, 3)) * base

GLOWS = [  # (cx, cy, rx, ry, colour, strength)
    (0.22, 0.06, 0.30, 0.34, (1.00, 0.86, 0.84), 0.75),   # peach-pink, top left
    (0.86, 0.30, 0.26, 0.32, (0.84, 0.80, 0.98), 0.60),   # lavender, right
    (0.52, 0.72, 0.34, 0.26, (0.93, 0.94, 0.99), 0.55),   # pale white haze, lower middle
    (0.05, 0.62, 0.20, 0.30, (0.98, 0.88, 0.90), 0.45),   # rose, left edge
    (0.70, 0.95, 0.24, 0.20, (1.00, 0.90, 0.82), 0.40),   # warm peach, bottom right
    (0.38, 0.34, 0.16, 0.14, (0.88, 0.86, 1.00), 0.30),   # faint violet, centre
]
for cx, cy, rx, ry, col, k in GLOWS:
    d = np.sqrt(((X - cx * W) / (rx * W)) ** 2 + ((Y - cy * H) / (ry * W)) ** 2)
    a = np.clip(1 - d, 0, 1) ** 1.6 * k
    a *= 0.85 + 0.3 * (noise(260, 3) + 0.5)          # uneven pigment inside each glow
    img = img * (1 - a[..., None]) + np.array(col) * a[..., None]

im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(34))
arr = np.asarray(im).astype(float)
arr += (rng.random((H, W, 1)) - 0.5) * 5.0           # a little grain against banding
Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(OUT, quality=94, method=6)
print(OUT, os.path.getsize(OUT))
