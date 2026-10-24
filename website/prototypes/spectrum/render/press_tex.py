# Textures for the About cover: the proof pulled from the composed line "ANSWERS ≠ TEACHING", inked
# split-fountain (the five dimension colours laid side by side in the fountain, so they blend across
# the line), and the same five-colour ink rolled out on the slab.
# usage: python3 press_tex.py OUTDIR
import sys, os, random, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
LINE = "ANSWERS ≠ TEACHING"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
# the homepage's five spectral colours (assets: --s0..--s4), left to right
SPEC = [(242, 72, 42), (243, 154, 18), (19, 162, 94), (45, 92, 246), (123, 62, 242)]

def spectrum(w):
    xs = np.linspace(0, len(SPEC) - 1, w); out = np.zeros((w, 3))
    for i, x in enumerate(xs):
        k = min(int(x), len(SPEC) - 2); t = x - k; t = t * t * (3 - 2 * t)
        out[i] = np.array(SPEC[k]) * (1 - t) + np.array(SPEC[k + 1]) * t
    return out

PX = 12; W, H = 220 * PX, 50 * PX       # proof strip, 220 x 50 mm
mask = Image.new("L", (W, H), 0); d = ImageDraw.Draw(mask)
f = ImageFont.truetype(FONT, int(12.7 * PX * 0.92))
tw = d.textlength(LINE, font=f); x0 = (W - tw) / 2
d.text((x0, H * 0.3), LINE, font=f, fill=255)
r = np.random.default_rng(4)
m = np.asarray(mask, np.float32) / 255
# letterpress: slightly uneven ink, darker at the edges of each stroke (ink squeeze), a little speckle
edge = np.asarray(mask.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(1.2)), np.float32) / 255
cover = np.clip(m * (0.86 + 0.1 * r.random((H, W))) + edge * 0.25, 0, 1)
cover *= (r.random((H, W)) > 0.015)
sp = spectrum(int(tw) + 2); col = np.zeros((H, W, 3)); xi = np.clip(np.arange(W) - int(x0), 0, int(tw) + 1)
col[:] = sp[xi][None, :, :]   # the fountain spans exactly the composed line
paper = np.array([244, 243, 240], np.float32)
img = paper * (1 - cover[..., None]) + col * cover[..., None] * 0.92
img += r.normal(0, 2.2, (H, W))[..., None]
Image.fromarray(np.uint8(np.clip(img, 0, 255))).save(os.path.join(OUT, "proof.png"))
# impression depth for a bump map
Image.fromarray(np.uint8(255 - np.asarray(mask.filter(ImageFilter.GaussianBlur(2)), np.float32))).save(os.path.join(OUT, "proof_bump.png"))

# ink slab: rolled five-colour ink, bands running across, roller marks and a ragged edge
SW, SH = 160 * 8, 110 * 8
band = spectrum(SW)[None, :, :] * np.ones((SH, 1, 1))   # colours across the roller's length
y = np.arange(SH)[:, None]; x = np.arange(SW)[None, :]
tex = 0.86 + 0.035 * np.sin(y / 2.2 + 2 * np.sin(x / 57.0)) + 0.07 * r.random((SH, SW))   # fine roller grain
edge_l = 18 * 8 + 10 * np.sin(y / 23.0) + 6 * r.random((SH, 1)); edge_r = SW - 22 * 8 + 8 * np.sin(y / 31.0 + 1)
alpha = np.clip((x - edge_l) / 12, 0, 1) * np.clip((edge_r - x) / 12, 0, 1)
alpha *= np.clip((y - 6 * 8) / 10, 0, 1) * np.clip((SH - 6 * 8 - y) / 10, 0, 1)
rgba = np.dstack([np.clip(band * tex[..., None], 0, 255), (alpha * 255)[..., None]])
Image.fromarray(np.uint8(rgba), "RGBA").save(os.path.join(OUT, "slab.png"))
# advance widths (in ems) of each character, for sizing the lead sorts in press.py
em = ImageFont.truetype(FONT, 1000)
json.dump([em.getlength(ch) / 1000 for ch in LINE], open(os.path.join(OUT, "advances.json"), "w"))
print("proof", W, H, "line width mm", tw / PX)
