# Card faces for the Cases cover: white index cards (127 x 76 mm) typed on a typewriter, and
# pressboard guide cards with a tab. Only real public data is typed: the featured card carries
# fraction-misconception-001 exactly as published; guide tabs carry the five subjects.
# usage: python3 catalogue_cards.py CASES_JSON OUTDIR
import sys, os, json, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

CASES, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
PX = 12                                    # px per mm
W, H = 127 * PX, 76 * PX
MONO = "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf"
SANS_B = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

def stock(col, grain=6, seed=0):
    im = Image.new("RGB", (W, H), col); d = ImageDraw.Draw(im); r = random.Random(seed)
    for _ in range(W * H // 40):
        x, y = r.randrange(W), r.randrange(H); v = r.randint(-grain, grain // 2)
        d.point((x, y), fill=tuple(max(0, min(255, c + v)) for c in col))
    return im.filter(ImageFilter.GaussianBlur(0.5))

def ruled(im):
    d = ImageDraw.Draw(im)
    d.line([0, int(14 * PX), W, int(14 * PX)], fill=(196, 72, 78), width=3)          # the red head rule
    for k in range(1, 9):
        y = int((14 + k * 6.6) * PX); d.line([0, y, W, y], fill=(150, 182, 214), width=2)
    return im

def typed(d, xy, text, size, seed):
    """typewriter: each glyph a little off its line, a little uneven in ink"""
    f = ImageFont.truetype(MONO, size); r = random.Random(seed); x, y = xy
    for ch in text:
        ink = r.randint(28, 62); d.text((x + r.uniform(-.6, .6), y + r.uniform(-1.1, 1.1)), ch, font=f, fill=(ink, ink, ink + 8))
        x += d.textlength(ch, font=f)

def hole(im):
    """the rod hole, punched through: transparent"""
    m = Image.new("L", im.size, 255); cx, cy, r = W // 2, H - int(6 * PX), int(2.6 * PX)
    ImageDraw.Draw(m).ellipse([cx - r, cy - r, cx + r, cy + r], fill=0)
    im = im.convert("RGBA"); im.putalpha(m)
    return im

cases = {c["id"]: c for c in json.load(open(CASES))["cases"]}
c = cases["fraction-misconception-001"]
im = ruled(stock((246, 247, 244), seed=1)); d = ImageDraw.Draw(im)
S = int(4.4 * PX)
typed(d, (int(6 * PX), int(4.2 * PX)), c["id"], S, 1)
typed(d, (int(112 * PX), int(4.2 * PX)), c["locale"], S, 2)
typed(d, (int(6 * PX), int(15.6 * PX)), c["metadata"]["topic"].capitalize() + "  -  " + c["metadata"]["subject"], S, 3)
msg = c["tutorInput"]["studentMessage"]
lines, cur = [], ""
for w in msg.split():
    if len(cur) + len(w) + 1 > 36: lines.append(cur); cur = w
    else: cur = (cur + " " + w).strip()
lines.append(cur)
for k, ln in enumerate(lines):
    typed(d, (int(6 * PX), int((22.2 + k * 6.6) * PX)), ("“" if k == 0 else " ") + ln + ("”" if k == len(lines) - 1 else ""), S, 10 + k)
lvl = c["metadata"]["difficulty"]["learnerLevel"].replace("-", " ")
typed(d, (int(6 * PX), int((22.2 + (len(lines) + 1) * 6.6) * PX)), lvl + "  /  " + c["metadata"]["studentState"].replace("_", " "), S, 30)
typed(d, (int(6 * PX), int((22.2 + (len(lines) + 2) * 6.6) * PX)), "disclosure: " + c["disclosurePolicy"].replace("_", " "), S, 31)
hole(im).save(os.path.join(OUT, "featured.png"))

for k in range(4):                          # blank ruled cards, a few slightly different
    hole(ruled(stock((244 - k, 245 - k, 242 - k), seed=20 + k))).save(os.path.join(OUT, f"blank{k}.png"))

# guide cards: grey-green pressboard, a tab on top (the tab is part of the image, 12 mm tall)
TAB = 12 * PX
for i, subj in enumerate(["MATHEMATICS", "HISTORY", "LANGUAGE", "PROGRAMMING", "SCIENCE"]):
    g = Image.new("RGB", (W, H + TAB), (0, 0, 0)); body = stock((150, 168, 150), grain=14, seed=40 + i)
    g.paste(body, (0, TAB)); tw = int(30 * PX); tx = int((4 + (i - 1) % 5 * 23) * PX)   # mathematics takes the right-hand tab, clear of the typing
    tab = stock((150, 168, 150), grain=14, seed=50 + i).crop((0, 0, tw, TAB + 4)); g.paste(tab, (tx, 0))
    m = Image.new("L", g.size, 0); dm = ImageDraw.Draw(m)
    dm.rectangle([0, TAB, W, H + TAB], fill=255); dm.rounded_rectangle([tx, 0, tx + tw, TAB + 10], radius=int(2 * PX), fill=255)
    cy, r = TAB + H - int(6 * PX), int(2.6 * PX); dm.ellipse([W // 2 - r, cy - r, W // 2 + r, cy + r], fill=0)
    dg = ImageDraw.Draw(g); lab = Image.new("RGB", (tw - int(4 * PX), int(7 * PX)), (240, 238, 230)); g.paste(lab, (tx + int(2 * PX), int(2.4 * PX)))
    f = ImageFont.truetype(SANS_B, int(4.0 * PX)); lw = dg.textlength(subj, font=f)
    while lw > tw - int(6 * PX): f = ImageFont.truetype(SANS_B, f.size - 2); lw = dg.textlength(subj, font=f)
    dg.text((tx + (tw - lw) / 2, int(3.6 * PX)), subj, font=f, fill=(30, 34, 40))
    g.putalpha(m); g.save(os.path.join(OUT, f"guide{i}.png"))

# the label in the drawer front's brass holder (46 x 14 mm): what the drawer holds, nothing more
LW, LH = 46 * PX, 14 * PX
lb = Image.new("RGB", (LW, LH), (236, 233, 222)); r = random.Random(60); dl = ImageDraw.Draw(lb)
for _ in range(LW * LH // 30):
    x, y = r.randrange(LW), r.randrange(LH); v = r.randint(-8, 4); dl.point((x, y), fill=(236 + v, 233 + v, 222 + v))
lb = lb.filter(ImageFilter.GaussianBlur(0.5)); dl = ImageDraw.Draw(lb)
f = ImageFont.truetype(MONO, int(3.6 * PX))
for k, t in enumerate(["PUBLIC CASES", "48"]):
    tw = dl.textlength(t, font=f); typed(dl, ((LW - tw) / 2, int((1.6 + k * 5.4) * PX)), t, int(3.6 * PX), 70 + k)
lb.save(os.path.join(OUT, "label.png"))
