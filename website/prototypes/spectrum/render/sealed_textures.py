# Textures for the Results cover: the back of an archive envelope (229 x 162 mm, C5) with its
# printed record form, and the height map of the Teachometry seal for the wax impression.
# Everything typed on the form is a public fact from benchmark.json; nothing is a result.
# usage: python3 sealed_textures.py BENCHMARK_JSON SEAL_PNG OUTDIR
#   SEAL_PNG: assets/logo/teachometry-seal.svg rasterised square, black on white (any size >= 1200)
import sys, os, json, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

BENCH, SEAL, OUT = sys.argv[1], sys.argv[2], sys.argv[3]; os.makedirs(OUT, exist_ok=True)
b = json.load(open(BENCH))
PX = 10                                            # px per mm
W, H = 229 * PX, 162 * PX
MONO = "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf"
SANS = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
SANS_B = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

def typed(d, xy, text, size, seed):
    f = ImageFont.truetype(MONO, size); r = random.Random(seed); x, y = xy
    for ch in text:
        ink = r.randint(24, 58); d.text((x + r.uniform(-.7, .7), y + r.uniform(-1.2, 1.2)), ch, font=f, fill=(ink, ink, ink + 10))
        x += d.textlength(ch, font=f)

# ---- the envelope back: cool white cotton paper, a printed form in slate blue, typed values
im = Image.new("RGB", (W, H), (236, 238, 238)); r = random.Random(3); d = ImageDraw.Draw(im)
for _ in range(W * H // 18):                       # fibre speckle
    x, y = r.randrange(W), r.randrange(H); v = r.randint(-9, 4); d.point((x, y), fill=(236 + v, 238 + v, 238 + v))
im = im.filter(ImageFilter.GaussianBlur(0.6)); d = ImageDraw.Draw(im)
INK = (72, 88, 116)                                # printed form ink
x0, y0, fw = 16 * PX, 104 * PX, 120 * PX           # the form block, lower left, clear of the flap tip
fh = ImageFont.truetype(SANS_B, int(3.1 * PX)); fl = ImageFont.truetype(SANS, int(2.3 * PX))
d.text((x0, y0), "TEACHOMETRY  ·  PUBLIC RESULTS", font=fh, fill=INK)
d.line([x0, y0 + 5 * PX, x0 + fw, y0 + 5 * PX], fill=INK, width=4)
c = b["coverage"]; rows = [
    ("Dataset cohort", f'{c["datasetId"]}@{c["datasetVersion"]}'),
    ("Benchmark version", str(b["benchmarkVersion"])),
    ("Calibrated public model runs", "none yet"),
    ("Status", "Not yet published."),
]
for k, (label, value) in enumerate(rows):
    yy = y0 + (9.5 + k * 9) * PX
    d.text((x0, yy), label.upper(), font=fl, fill=INK)
    d.line([x0, yy + 7 * PX, x0 + fw, yy + 7 * PX], fill=(150, 162, 182), width=2)
    typed(d, (x0 + 52 * PX, yy - 1.2 * PX), value, int(3.6 * PX), 10 + k)
im.save(os.path.join(OUT, "envelope.png"))

# ---- the seal: 0 = paper, 1 = engraved line; blurred a touch so the wax relief has soft shoulders
s = ImageOps.invert(Image.open(SEAL).convert("L")).resize((1200, 1200), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.6))
s.save(os.path.join(OUT, "seal_height.png"))
