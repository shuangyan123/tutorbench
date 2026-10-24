# Texture for the Community cover: a printed review card for one public case (its real ID, version,
# student message and context from cases.json), with the five score dimensions left as empty boxes:
# no judgment has been made, and none is invented.
# usage: python3 perspectives_tex.py CASES_JSON BENCHMARK_JSON OUTDIR
import sys, os, json, random
from PIL import Image, ImageDraw, ImageFont

CASES, BENCH, OUT = sys.argv[1], sys.argv[2], sys.argv[3]; os.makedirs(OUT, exist_ok=True)
case = next(c for c in json.load(open(CASES))["cases"] if c["id"] == "correct-answer-wrong-reasoning-001")
dims = json.load(open(BENCH))["dimensions"]["score"]
PX = 12; W, H = 180 * PX, 120 * PX   # a 180 x 120 mm card
SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
SERIF_I = "/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
im = Image.new("RGB", (W, H), (246, 247, 247)); d = ImageDraw.Draw(im)
ink, grey, rule = (24, 26, 32), (104, 108, 120), (150, 156, 168)
L, R = 12 * PX, W - 12 * PX

def wrap(text, font, width):
    out, line = [], ""
    for w in text.split():
        t = (line + " " + w).strip()
        if d.textlength(t, font=font) > width and line: out.append(line); line = w
        else: line = t
    return out + [line]

f_m = ImageFont.truetype(MONO, int(2.6 * PX))
d.text((L, 10 * PX), f'{case["id"]}  ·  v{case["version"]}', font=f_m, fill=grey)
d.text((R - d.textlength("REVIEW CARD", font=f_m), 10 * PX), "REVIEW CARD", font=f_m, fill=grey)
d.line([(L, 15.5 * PX), (R, 15.5 * PX)], fill=ink, width=3)
f_k = ImageFont.truetype(SANS, int(2.4 * PX))
d.text((L, 20 * PX), "STUDENT", font=f_k, fill=grey)
f_s = ImageFont.truetype(SERIF, int(6.0 * PX)); y = 25 * PX
for ln in wrap("“" + case["tutorInput"]["studentMessage"] + "”", f_s, R - L):
    d.text((L, y), ln, font=f_s, fill=ink); y += int(8.4 * PX)
y += 3 * PX
d.text((L, y), "CONTEXT", font=f_k, fill=grey); y += 4.4 * PX
f_c = ImageFont.truetype(SERIF_I, int(3.8 * PX))
for ln in wrap(case["tutorInput"]["problemContext"], f_c, R - L):
    d.text((L, y), ln, font=f_c, fill=(60, 64, 74)); y += int(5 * PX)
# five dimensions, every box empty
y = H - 24 * PX
d.line([(L, y - 3 * PX), (R, y - 3 * PX)], fill=rule, width=2)
d.text((L, y), "TUTOR REPLY · NOT YET REVIEWED", font=f_k, fill=grey); y += 6 * PX
colw = (R - L) / len(dims); f_d = ImageFont.truetype(SANS, int(2.5 * PX))
for k, dim in enumerate(dims):
    x = L + k * colw
    d.rectangle([x, y, x + 4 * PX, y + 4 * PX], outline=ink, width=3)
    d.text((x + 6 * PX, y + 0.5 * PX), dim.capitalize(), font=f_d, fill=ink)
r = random.Random(5); px = im.load()
for _ in range(W * H // 12):
    x, yy = r.randrange(W), r.randrange(H); v = px[x, yy]; k = r.randint(-5, 2); px[x, yy] = (v[0] + k, v[1] + k, v[2] + k)
im.save(os.path.join(OUT, "card.png"))
print(case["tutorInput"]["studentMessage"], dims)
