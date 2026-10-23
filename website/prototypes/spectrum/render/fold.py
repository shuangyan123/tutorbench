"""Folds a rendered wedge (mandala.py WEDGE=1) into the full kaleidoscope rosette.
usage: python3 fold.py WEDGE.png OUT.webp SIZE ANGLE [--png]
The wedge render is the right half of the frame from its centre row up to the top of the wedge.
Every output pixel is mapped back into the wedge by mirroring its angle across the two mirror
lines, then cut to the eyepiece circle with a soft rim. Output keeps alpha (RGBA WebP)."""
import sys, math
import numpy as np
from PIL import Image

src, out, size, ang = sys.argv[1], sys.argv[2], int(sys.argv[3]), float(sys.argv[4])
im = np.asarray(Image.open(src).convert("RGB")).astype(np.float32) / 255
h, w, _ = im.shape
full = 2 * w                       # the wedge was rendered from a square frame of this size
th = math.radians(ang)
# source pixel of the frame centre: left edge, row where y_frame = 0.5 (the crop starts 0.004 below it)
cy_src = h - 1 - (0.004 * full)    # rows count from the top; the crop's bottom is 0.5 - 0.004
cx_src = -0.5

ss = 2                              # supersample, then average down
n = size * ss
yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
dx = (xx + 0.5) / n - 0.5; dy = 0.5 - (yy + 0.5) / n        # frame units, y up
r = np.hypot(dx, dy); a = np.mod(np.arctan2(dy, dx), 2 * th)
a = np.where(a > th, 2 * th - a, a)                          # mirror across the second line
sx = cx_src + r * np.cos(a) * full; sy = cy_src - r * np.sin(a) * full
sx = np.clip(sx, 0, w - 1.001); sy = np.clip(sy, 0, h - 1.001)
x0 = np.floor(sx).astype(int); y0 = np.floor(sy).astype(int); fx = (sx - x0)[..., None]; fy = (sy - y0)[..., None]
c = (im[y0, x0] * (1 - fx) * (1 - fy) + im[y0, x0 + 1] * fx * (1 - fy) + im[y0 + 1, x0] * (1 - fx) * fy + im[y0 + 1, x0 + 1] * fx * fy)
# each reflection loses a little light, as silvered glass does; sector index from the unfolded angle
k = np.floor(np.mod(np.arctan2(dy, dx), 2 * math.pi) / th).astype(int)
k = np.minimum(k, (2 * math.pi / th) - k)                   # reflections counted both ways round
c *= (0.993 ** k)[..., None]
# eyepiece: circle with a soft rim, a faint darkening toward it
R = 0.47
alpha = np.clip((R - r) / 0.004, 0, 1)
c *= (1 - 0.18 * np.clip((r - 0.36) / (R - 0.36), 0, 1) ** 2)[..., None]
rgba = np.concatenate([c, alpha[..., None]], axis=2)
rgba = rgba.reshape(size, ss, size, ss, 4).mean(axis=(1, 3))
img = Image.fromarray((np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")
if "--png" in sys.argv: img.save(out)
else: img.save(out, quality=90, method=6)
