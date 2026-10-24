# Labels for the Run cover: one paper strip per test tube, printed with a public case ID (the first
# four in cases.json, the same four the live Run page lists) and the dataset cohort.
# Each strip is 14 x 38 mm and is read along the tube, bottom to top.
# usage: python3 tubes_labels.py CASES_JSON BENCHMARK_JSON OUTDIR
import sys, os, json, random
from PIL import Image, ImageDraw, ImageFont

CASES, BENCH, OUT = sys.argv[1], sys.argv[2], sys.argv[3]; os.makedirs(OUT, exist_ok=True)
ids = [c["id"] for c in json.load(open(CASES))["cases"][:4]]
b = json.load(open(BENCH)); cohort = f'{b["dataset"]["id"]}@{b["dataset"]["version"]}'
PX = 24; L, Wd = 38 * PX, 14 * PX                       # long side runs up the tube
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
INTER = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
for k, cid in enumerate(ids):
    im = Image.new("RGB", (L, Wd), (243, 244, 244)); d = ImageDraw.Draw(im); r = random.Random(k)
    for _ in range(L * Wd // 30):
        x, y = r.randrange(L), r.randrange(Wd); v = r.randint(-8, 3); d.point((x, y), fill=(243 + v, 244 + v, 244 + v))
    ink = (24, 27, 36)
    d.text((2.2 * PX, 2.0 * PX), f"{k + 1:02d}", font=ImageFont.truetype(INTER, int(3.4 * PX)), fill=ink)
    d.line([(2.2 * PX, 6.6 * PX), (L - 2.2 * PX, 6.6 * PX)], fill=ink, width=max(1, PX // 6))
    f = ImageFont.truetype(MONO, int(2.0 * PX))
    while d.textlength(cid, font=f) > L - 4.4 * PX: f = ImageFont.truetype(MONO, f.size - 2)
    d.text((2.2 * PX, 7.6 * PX), cid, font=f, fill=ink)
    d.text((2.2 * PX, 10.6 * PX), cohort, font=ImageFont.truetype(MONO, int(1.5 * PX)), fill=(90, 96, 112))
    im.save(os.path.join(OUT, f"label{k}.png"))
print(ids)
