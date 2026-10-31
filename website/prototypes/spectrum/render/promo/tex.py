# Text textures for the keyframes: engraving masks (white = engraved) and printed / handwritten cards.
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONTS = os.environ.get("FONTS", os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts"))


def font(name, size, weight=None):
    f = ImageFont.truetype(os.path.join(FONTS, name), size)
    if weight is not None:
        try:
            f.set_variation_by_axes([weight])
        except Exception:
            pass
    return f


def engrave(path, w, h, lines, fname="Cormorant.ttf", size=None, weight=600, blur=1.2):
    """Mask: black ground, white engraved strokes. lines = [text, ...] centred."""
    im = Image.new("L", (w, h), 0); d = ImageDraw.Draw(im)
    size = size or int(h * 0.62 / max(1, len(lines)))
    f = font(fname, size, weight)
    tot = len(lines) * size * 1.05; y = (h - tot) / 2
    for t in lines:
        bb = d.textbbox((0, 0), t, font=f); tw = bb[2] - bb[0]
        d.text(((w - tw) / 2 - bb[0], y - bb[1] * 0.5), t, fill=255, font=f); y += size * 1.05
    im = im.filter(ImageFilter.GaussianBlur(blur)); im.save(path)


def card(path, w, h, items, bg=(246, 247, 250), ink=(28, 28, 34)):
    """Printed/handwritten card. items = [(text, font, size, x, y, colour or None, weight)]"""
    im = Image.new("RGB", (w, h), bg); d = ImageDraw.Draw(im)
    for it in items:
        t, fn, sz, x, y = it[:5]; col = it[5] if len(it) > 5 and it[5] else ink; wt = it[6] if len(it) > 6 else None
        f = font(fn, sz, wt)
        if x == "c":
            bb = d.textbbox((0, 0), t, font=f); x = (w - (bb[2] - bb[0])) / 2 - bb[0]
        d.text((x, y), t, fill=col, font=f)
    im = im.filter(ImageFilter.GaussianBlur(0.6)); im.save(path)


def engrave_rich(path, w, h, segs, size, fname="NotoSerifSC.ttf", weight=500, blur=1.2):
    """Engraving mask with sub/superscripts. segs = [(text, kind)], kind in n | sub | sup."""
    im = Image.new("L", (w, h), 0); d = ImageDraw.Draw(im)
    big = font(fname, size, weight); small = font(fname, int(size * 0.6), weight)
    widths = []
    for t, k in segs:
        f = big if k == "n" else small; widths.append(d.textlength(t, font=f) + size * 0.02)
    x = (w - sum(widths)) / 2; base = h / 2 + size * 0.32
    for (t, k), wd in zip(segs, widths):
        f = big if k == "n" else small
        asc = f.getmetrics()[0]
        y = base - asc + (size * 0.18 if k == "sub" else -size * 0.38 if k == "sup" else 0)
        d.text((x, y), t, fill=255, font=f); x += wd
    im = im.filter(ImageFilter.GaussianBlur(blur)); im.save(path)
