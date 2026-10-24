# Light photographic finish for Blender stills: a soft vignette and fine luminance grain.
# usage: python3 photo_finish.py IN.png OUT.webp [VIGNETTE GRAIN QUALITY]
import sys
import numpy as np
from PIL import Image
a = sys.argv[1:]; vig = float(a[2]) if len(a) > 2 else 0.18; grain = float(a[3]) if len(a) > 3 else 3.0; q = int(a[4]) if len(a) > 4 else 84
im = np.asarray(Image.open(a[0]).convert("RGB"), np.float32)
lift = float(a[5]) if len(a) > 5 else 1.0
im = 255 * (im / 255) ** lift
h, w, _ = im.shape
yy, xx = np.mgrid[0:h, 0:w]; r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2) / np.sqrt(2)
im *= (1 - vig * r ** 2.2)[..., None]
im += np.random.default_rng(1).normal(0, grain, (h, w))[..., None]
Image.fromarray(np.uint8(np.clip(im, 0, 255))).save(a[1], quality=q, method=6)
