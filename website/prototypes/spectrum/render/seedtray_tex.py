# Plant labels for the Evidence Matrix cover (seedtray.py): white plastic stakes with a public
# case ID written on each in soft pencil capitals (rendered with a mono face and a little jitter).
# usage: python3 seedtray_tex.py OUT_DIR
import os, sys, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
MONO = "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf"
CASES = ["fraction-misconception-001", "history-source-bias-001", "programming-off-by-one-001",
         "science-graph-error-001", "language-verb-check-001", "paired-fraction-conceptual-001"]
PX = 24; W, H = int(100 * PX), int(16 * PX)      # a 100 x 16 mm stake, text along its length
f = ImageFont.truetype(MONO, int(4.6 * PX))
for k, case in enumerate(CASES):
    im = Image.new("RGB", (W, H), (236, 238, 236)); d = ImageDraw.Draw(im); r = random.Random(k)
    x = 6 * PX
    for ch in case.upper():
        d.text((x, (H - 4.8 * PX) / 2 + r.uniform(-0.35, 0.35) * PX), ch, font=f, fill=(78, 80, 86))
        x += d.textlength(ch, font=f) * r.uniform(0.86, 0.94)
    # the pointed end is cut in the mesh; a faint soil smudge near it
    sm = Image.new("L", (W, H), 0); ImageDraw.Draw(sm).rectangle((W - 26 * PX, 0, W, H), fill=120)
    sm = sm.filter(ImageFilter.GaussianBlur(5 * PX))
    im = Image.composite(Image.new("RGB", (W, H), (120, 100, 82)), im, sm)
    im.save(os.path.join(OUT, f"stake_{k}.png"))
print("ok")
