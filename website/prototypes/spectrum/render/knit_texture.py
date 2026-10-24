# Stockinette knit height map for the coat-hook cover scarf: columns of V stitches, each leg a
# round two-ply yarn with a twist, a little hand-knit irregularity. Tiles seamlessly.
# usage: python3 knit_texture.py OUT_HEIGHT.png
import sys
import numpy as np
from PIL import Image, ImageFilter

NX, NY = 12, 16          # stitches across and rows down in one tile
SW, SH = 48, 40          # pixels per stitch
W, H = NX * SW, NY * SH
rng = np.random.default_rng(5)
jit = rng.normal(0, 0.035, (NY, NX, 4))          # per stitch: leg end wobble
plump = 1 + rng.normal(0, 0.06, (NY, NX))        # some stitches pulled tighter than others

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
out = np.zeros((H, W), np.float32)

def leg(px, py, ax, ay, bx, by, r, phase):
    """height of one round yarn leg from a to b at points p, in pixel units"""
    dx, dy = bx - ax, by - ay; L2 = dx * dx + dy * dy
    t = np.clip(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1)
    cx, cy = ax + t * dx, ay + t * dy
    d = np.sqrt((px - cx) ** 2 + (py - cy) ** 2) / r
    side = np.sign((px - cx) * dy - (py - cy) * dx)          # which side of the leg's centre line
    h = np.sqrt(np.clip(1 - d * d, 0, 1))
    ply = 0.5 + 0.5 * np.cos(2 * np.pi * (t * 4.2 + side * d * 0.55 + phase))   # two plies twisting
    return h * (0.78 + 0.22 * ply) * (0.85 + 0.15 * np.sin(np.pi * t))

for j in range(NY):
    for i in range(NX):
        ox, oy = i * SW, j * SH
        r = SW * 0.235 * plump[j, i]
        e = jit[j, i] * SW
        for wrapx in (-W, 0, W):
            for wrapy in (-H, 0, H):
                X0, Y0 = ox + wrapx, oy + wrapy
                # only evaluate pixels near this stitch
                x0, x1 = int(max(0, X0 - SW * 0.3)), int(min(W, X0 + SW * 1.3))
                y0, y1 = int(max(0, Y0 - SH * 0.4)), int(min(H, Y0 + SH * 1.5))
                if x0 >= x1 or y0 >= y1: continue
                px, py = xx[y0:y1, x0:x1], yy[y0:y1, x0:x1]
                hl = leg(px, py, X0 + SW * 0.1 + e[0], Y0 - SH * 0.18, X0 + SW * 0.5 + e[1], Y0 + SH * 1.02, r, 0.0)
                hr = leg(px, py, X0 + SW * 0.9 + e[2], Y0 - SH * 0.18, X0 + SW * 0.5 + e[3], Y0 + SH * 1.02, r, 0.37)
                out[y0:y1, x0:x1] = np.maximum(out[y0:y1, x0:x1], np.maximum(hl, hr))

# fine fibre fuzz
fz = rng.normal(0, 1, (H, W)).astype(np.float32)
img = Image.fromarray(np.uint8(np.clip(out, 0, 1) * 235))
fuzz = Image.fromarray(np.uint8(np.clip(128 + fz * 40, 0, 255))).filter(ImageFilter.GaussianBlur(0.6))
a = np.asarray(img, np.float32) + (np.asarray(fuzz, np.float32) - 128) * 0.18
Image.fromarray(np.uint8(np.clip(a, 0, 255))).filter(ImageFilter.GaussianBlur(0.7)).save(sys.argv[1])
