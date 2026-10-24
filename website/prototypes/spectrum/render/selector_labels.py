# Screen-printed legend for the Micro-Review cover: the front panel of a three-way selector, its
# positions named with the live demo's three choices. The pointer's rest mark is unlabelled: no
# judgment has been made yet. Panel 160 x 200 mm, knob centre at (80, 120) mm from the top left.
# usage: python3 selector_labels.py OUTDIR
import sys, os, math
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
PX = 16                                              # px per mm
W, H = 160 * PX, 200 * PX; CX, CY = 80 * PX, 120 * PX
INTER = "/usr/share/fonts/opentype/inter/"
f_lab = ImageFont.truetype(INTER + "Inter-Medium.otf", int(2.9 * PX))
f_head = ImageFont.truetype(INTER + "Inter-SemiBold.otf", int(4.2 * PX))
f_sub = ImageFont.truetype(INTER + "Inter-Medium.otf", int(2.6 * PX))

# white = bare panel, black = ink; Blender mixes the panel colour and the ink with it
im = Image.new("L", (W, H), 255); d = ImageDraw.Draw(im)
def tick(ang, r0, r1, w):
    a = math.radians(ang)
    d.line([(CX + r0 * PX * math.sin(a), CY - r0 * PX * math.cos(a)), (CX + r1 * PX * math.sin(a), CY - r1 * PX * math.cos(a))], fill=0, width=int(w * PX))

# fine graduations between the positions, the three positions bold, an open ring at six o'clock for rest
for k in range(-60, 61, 5): tick(k, 27.5, 29.5, 0.22)
POS = [(-50, "BASICALLY\nSUITABLE"), (0, "HAS A TEACHING\nPROBLEM"), (50, "NOT\nSURE")]
for ang, _ in POS: tick(ang, 27, 33, 0.55)
d.ellipse([CX - 1.3 * PX, CY + 28.7 * PX, CX + 1.3 * PX, CY + 31.3 * PX], outline=0, width=int(0.4 * PX))   # rest: an open ring

def text(xy, s, f, anchor, spacing=0.12):
    """tracked capitals"""
    x, y = xy; widths = [d.textlength(c, font=f) + spacing * f.size for c in s]; tw = sum(widths) - spacing * f.size
    x0 = x - tw if anchor == "r" else x - tw / 2 if anchor == "m" else x
    for c, w in zip(s, widths): d.text((x0, y), c, font=f, fill=0, anchor="ls"); x0 += w

LH = 4.4 * PX                                       # line height
for ang, lab in POS:
    a = math.radians(ang); ex, ey = CX + 35.5 * PX * math.sin(a), CY - 35.5 * PX * math.cos(a)
    lines = lab.split("\n")
    if ang == 0:
        for i, ln in enumerate(lines): text((ex, ey - 2 * PX - (len(lines) - 1 - i) * LH), ln, f_lab, "m")
    else:
        y0 = ey + 1.2 * PX - (len(lines) - 1) * LH / 2
        for i, ln in enumerate(lines): text((ex + (-1 if ang < 0 else 1) * PX, y0 + i * LH), ln, f_lab, "r" if ang < 0 else "l")

# header block, top of the panel
text((CX, 34 * PX), "MICRO-REVIEW", f_head, "m", 0.2)
d.line([CX - 26 * PX, 39 * PX, CX + 26 * PX, 39 * PX], fill=0, width=int(0.3 * PX))
text((CX, 45 * PX), "ONE CONVERSATION  ·  ONE JUDGMENT", f_sub, "m", 0.18)
im.save(os.path.join(OUT, "legend.png"))
