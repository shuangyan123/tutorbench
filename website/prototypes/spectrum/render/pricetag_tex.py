# Texture for the Methodology knowledge plate (pricetag.py): the face of a white card price tag,
# written on in pencil with the learner's own sum from the case mc-percent-reversal: 200, up 20 %,
# down 20 %, and an equals sign with the last price left open. The tutor in that case may hint but
# must not write the answer, so the tag never shows it.
# usage: python3 pricetag_tex.py HAND_FONT.ttf OUT_DIR
import os, sys, random, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

HAND, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
random.seed(4)
PX = 20; TW, TH = 120, 60                   # the tag, mm; the eyelet end is on the left
W, H = TW * PX, TH * PX

# paper: a cool white card with a faint fibre mottle
base = Image.effect_noise((W // 6, H // 6), 22).resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(6))
fine = Image.effect_noise((W, H), 30).filter(ImageFilter.GaussianBlur(0.8))
mott = ImageChops.add(base, fine, scale=2.0)
col = Image.merge("RGB", [mott.point(lambda v, o=o: int(o + (v - 128) * 0.05)) for o in (238, 239, 242)])

# the pencil: draw a mask, roughen it the way graphite catches on card, then darken the paper by it
ink = Image.new("L", (W, H), 0); d = ImageDraw.Draw(ink)
def hand(x, y, text, size, rot=0.0, jitter=0.6):
    f = ImageFont.truetype(HAND, int(size * PX))
    cx = x * PX
    for ch in text:
        g = Image.new("L", (int(size * PX * 1.6), int(size * PX * 1.8)), 0); gd = ImageDraw.Draw(g)
        gd.text((size * PX * 0.25, size * PX * 0.1), ch, font=f, fill=255)
        g = g.rotate(rot + random.uniform(-3, 3), resample=Image.BICUBIC, expand=False)
        dy = random.uniform(-jitter, jitter) * PX * 0.4
        ink.paste(255, (int(cx - size * PX * 0.25), int(y * PX + dy)), g)
        cx += f.getlength(ch) * random.uniform(0.97, 1.05)
    return cx / PX
def stroke(pts, w=0.42):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        d.line((x0 * PX, y0 * PX, x1 * PX, y1 * PX), fill=255, width=int(w * PX))

L = 34                                       # left margin of the writing, mm (clear of the eyelet)
hand(L, 2.5, "200", 14.5, -1.5)
hand(L + 2, 18.5, "+ 20 %", 12, -1)
hand(L + 2, 30.5, "− 20 %", 12, -2)
# the open answer: an equals sign and an empty line, the pencil lifted before the price
e = hand(L + 2, 42.5, "=", 12, -1)
stroke([(e + 3.5, 52.6), (e + 20, 52.1), (e + 36, 52.4)], 0.32)

# graphite is never solid: break the strokes up with the paper's tooth
tooth = Image.effect_noise((W, H), 90).filter(ImageFilter.GaussianBlur(0.6)).point(lambda v: 255 if v > 92 else int(v * 2.2))
inkm = ImageChops.multiply(ink.filter(ImageFilter.GaussianBlur(1.1)), tooth).filter(ImageFilter.GaussianBlur(0.7))
graphite = Image.new("RGB", (W, H), (40, 42, 50))
col = Image.composite(graphite, col, inkm.point(lambda v: int(min(255, v * 1.0))))

col.save(os.path.join(OUT, "tag.png"))
inkm.save(os.path.join(OUT, "tag_graphite.png"))
print("tag", W, H)
