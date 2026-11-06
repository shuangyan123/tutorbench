# Score for the "Arrogance Is Not What You Need" cover (piano.py): an open book of piano music on the
# music desk, engraved by this script. Left page: the theme of Mozart's variations on "Ah ! vous
# dirai-je, Maman" (K. 265, the tune of "Twinkle, Twinkle", public domain); right page: the first
# variation's running sixteenths. A teacher's pencil fingering sits over the opening bars.
# The tapper in the essay has this page in their head; the listener hears only the knocks.
# usage: python3 piano_tex.py OUT_DIR   ->  score_l.png, score_r.png (A4 at 150 dpi), smudge.png
import math, os, random, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
W, H = 1240, 1754
SP = 11.0                      # staff space, px
INK = (22, 22, 26)
PAPER = (245, 244, 240)
SERIF = "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"
SERIF_I = "/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf"
SERIF_B = "/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf"
rnd = random.Random(7)

# pitch -> diatonic step (C4 = 0)
NAMES = "CDEFGAB"


def step(p):
    return NAMES.index(p[0]) + 7 * (int(p[1]) - 4)


TREBLE_BOTTOM = step("E4")     # bottom line of the treble staff
BASS_BOTTOM = step("G2")       # bottom line of the bass staff

# the theme, two quarter notes a bar (2/4); a half note is ("G5", 2)
THEME_RH = [["C5", "C5"], ["G5", "G5"], ["A5", "A5"], [("G5", 2)], ["F5", "F5"], ["E5", "E5"], ["D5", "D5"], [("C5", 2)],
            ["G5", "G5"], ["F5", "F5"], ["E5", "E5"], [("D5", 2)], ["G5", "G5"], ["F5", "F5"], ["E5", "E5"], [("D5", 2)],
            ["C5", "C5"], ["G5", "G5"], ["A5", "A5"], [("G5", 2)], ["F5", "F5"], ["E5", "E5"], ["D5", "D5"], [("C5", 2)]]
THEME_LH = [["C3", "C4"], ["E4", "C4"], ["F4", "C4"], ["E4", "C4"], ["D4", "B3"], ["C4", "A3"], ["F3", "G3"], ["C3", "G2"],
            ["E3", "C4"], ["D3", "B3"], ["C3", "G3"], ["B2", "G3"], ["E3", "C4"], ["D3", "B3"], ["C3", "G3"], ["B2", "G3"],
            ["C3", "C4"], ["E4", "C4"], ["F4", "C4"], ["E4", "C4"], ["D4", "B3"], ["C4", "A3"], ["F3", "G3"], ["C3", "C3"]]


def var1_bar(melody_note):
    """eight sixteenths that turn around the theme note (Var. I runs)"""
    s = step(melody_note)
    shape = [1, 0, -1, 0, 2, 1, 0, -1] if rnd.random() < .5 else [0, -1, 0, 1, 2, 1, 0, -1]
    return [s + d for d in shape]


def font(path, size):
    return ImageFont.truetype(path, int(size))


class Page:
    def __init__(self):
        self.im = Image.new("RGB", (W, H), PAPER)
        self.d = ImageDraw.Draw(self.im)

    def text(self, xy, s, f, fill=INK, anchor="la"):
        self.d.text(xy, s, font=f, fill=fill, anchor=anchor)

    def staff(self, x0, x1, y):  # y = bottom line
        for i in range(5):
            self.d.line([(x0, y - i * SP), (x1, y - i * SP)], fill=INK, width=1)

    def head(self, x, y, filled=True):
        # an engraved notehead: a slightly tilted ellipse
        w, h = SP * 1.32, SP * 0.98
        pts = []
        for k in range(40):
            t = 2 * math.pi * k / 40
            px, py = w / 2 * math.cos(t), h / 2 * math.sin(t)
            a = math.radians(-22)
            pts.append((x + px * math.cos(a) - py * math.sin(a), y + px * math.sin(a) + py * math.cos(a)))
        if filled:
            self.d.polygon(pts, fill=INK)
        else:
            self.d.polygon(pts, fill=INK)
            inner = []
            for k in range(40):
                t = 2 * math.pi * k / 40
                px, py = w * .34 * math.cos(t), h * .2 * math.sin(t)
                a = math.radians(-35)
                inner.append((x + px * math.cos(a) - py * math.sin(a), y + px * math.sin(a) + py * math.cos(a)))
            self.d.polygon(inner, fill=PAPER)

    def ledgers(self, x, pos, ybottom):
        # pos counted in half spaces from the bottom line; ledger lines below 0 and above 8
        r = SP * .95
        for q in range(-2, pos - 1, -2) if pos <= -2 else []:
            yy = ybottom - q * SP / 2
            self.d.line([(x - r, yy), (x + r, yy)], fill=INK, width=1)
        for q in range(10, pos + 1, 2) if pos >= 10 else []:
            yy = ybottom - q * SP / 2
            self.d.line([(x - r, yy), (x + r, yy)], fill=INK, width=1)

    def note(self, x, pos, ybottom, dur=1, stem=True):
        y = ybottom - pos * SP / 2
        self.ledgers(x, pos, ybottom)
        self.head(x, y, filled=dur < 2)
        if stem:
            up = pos < 4
            sx = x + SP * .6 if up else x - SP * .6
            self.d.line([(sx, y), (sx, y - 3.4 * SP if up else y + 3.4 * SP)], fill=INK, width=2)
        return y


def system(pg, x0, x1, ytop, first, bars_rh, bars_lh, sixteenths=False, final=False, clef_size=1.0):
    yt = ytop + 4 * SP           # treble bottom line
    yb = yt + 10 * SP            # bass bottom line (6 spaces between staves)
    pg.staff(x0, x1, yt); pg.staff(x0, x1, yb)
    pg.d.line([(x0, yt - 4 * SP), (x0, yb)], fill=INK, width=2)
    # brace
    bf = font(SERIF, (yb - (yt - 4 * SP)) * 1.18)
    pg.text((x0 - 6, (yt - 4 * SP + yb) / 2), "{", bf, anchor="rm")
    cf = font(SERIF, SP * 6.2)
    pg.text((x0 + SP * .6, yt - SP * 1.0), "\U0001D11E", cf, anchor="ls")
    bcf = font(SERIF, SP * 3.4)
    pg.text((x0 + SP * .7, yb - SP * 1.55), "\U0001D122", bcf, anchor="ls")
    x = x0 + SP * 4.2
    if first:
        tf = font(SERIF_B, SP * 2.3)
        for yy in (yt, yb):
            pg.text((x + SP * .7, yy - 3 * SP), "2", tf, anchor="mm")
            pg.text((x + SP * .7, yy - 1 * SP), "4", tf, anchor="mm")
        x += SP * 2.6
    n = len(bars_rh)
    bw = (x1 - x - SP) / n
    for b in range(n):
        bx = x + b * bw + SP * 1.4
        rh, lh = bars_rh[b], bars_lh[b]
        if sixteenths:
            xs = [bx + k * (bw - SP * 2.2) / 8 for k in range(8)]
            ys = []
            for k, s in enumerate(rh):
                pos = s - TREBLE_BOTTOM
                ys.append(pg.note(xs[k], pos, yt, stem=False))
            # beamed in fours, stems up
            for g in (0, 4):
                tops = []
                for k in range(g, g + 4):
                    sx = xs[k] + SP * .6
                    top = min(ys[g:g + 4]) - 3.2 * SP
                    pg.d.line([(sx, ys[k]), (sx, top)], fill=INK, width=2)
                    tops.append((sx, top))
                for off in (0, SP * .75):
                    pg.d.polygon([(tops[0][0], tops[0][1] + off), (tops[-1][0], tops[-1][1] + off),
                                  (tops[-1][0], tops[-1][1] + off + SP * .45), (tops[0][0], tops[0][1] + off + SP * .45)], fill=INK)
        else:
            k = 0
            for item in rh:
                p, dur = (item, 1) if isinstance(item, str) else item
                pg.note(bx + k * bw / 2, step(p) - TREBLE_BOTTOM, yt, dur)
                k += dur
        for k, p in enumerate(lh):
            pg.note(bx + k * bw / 2, step(p) - BASS_BOTTOM, yb)
        bar_x = x + (b + 1) * bw
        if final and b == n - 1:
            pg.d.line([(bar_x - SP * .7, yt - 4 * SP), (bar_x - SP * .7, yb)], fill=INK, width=2)
            pg.d.rectangle([bar_x - SP * .35, yt - 4 * SP, bar_x, yb], fill=INK)
        else:
            pg.d.line([(bar_x, yt - 4 * SP), (bar_x, yt)], fill=INK, width=2)
            pg.d.line([(bar_x, yb - 4 * SP), (bar_x, yb)], fill=INK, width=2)
    return yt, yb, x, bw


def pencil(pg, xy, s, size=30, rot=0):
    f = font(SERIF_I, size)
    layer = Image.new("L", (size * 3, size * 3), 0)
    ImageDraw.Draw(layer).text((size * 1.5, size * 1.5), s, font=f, fill=150, anchor="mm")
    layer = layer.rotate(rot, resample=Image.BICUBIC).filter(ImageFilter.GaussianBlur(.6))
    graphite = Image.new("RGB", layer.size, (92, 92, 98))
    pg.im.paste(graphite, (int(xy[0] - size * 1.5), int(xy[1] - size * 1.5)), layer)


def finish(pg, path, seed):
    # paper: a faint fibre and a soft print density variation
    r = random.Random(seed)
    im = pg.im
    noise = Image.effect_noise((W // 4, H // 4), 18).resize((W, H), Image.BICUBIC)
    im = Image.blend(im, Image.merge("RGB", [noise] * 3).point(lambda v: v), .035)
    grain = Image.effect_noise((W, H), 30)
    im = Image.blend(im, Image.merge("RGB", [grain] * 3), .02)
    im.save(path)


margin_x, top = 120, 150
x0, x1 = margin_x + 40, W - margin_x

# left page: the theme
L = Page()
L.text((W / 2, top), "Ah ! vous dirai-je, Maman", font(SERIF_I, 52), anchor="mm")
L.text((W / 2, top + 58), "Thema", font(SERIF, 30), anchor="mm")
L.text((x1, top + 100), "W. A. Mozart, K. 265", font(SERIF, 24), anchor="rm")
L.text((x0 - 30, top + 112), "Allegretto", font(SERIF_B, 25), anchor="lm")
y = top + 150
rows = [(0, 4), (4, 8), (8, 12), (12, 16), (16, 20), (20, 24)]
for i, (a, b) in enumerate(rows):
    yt, yb, xs, bw = system(L, x0, x1, y, i == 0, THEME_RH[a:b], THEME_LH[a:b], final=(i == len(rows) - 1))
    if i == 0:
        # a teacher's fingering over the first bars, and a dynamics mark between the staves
        bx = xs + SP * 1.4
        pencil(L, (bx, yt - 6.2 * SP), "1", 30, 4)
        pencil(L, (bx + bw, yt - 7.2 * SP), "4", 30, -3)
        pencil(L, (bx + 2 * bw, yt - 7.8 * SP), "5", 30, 2)
        L.text((xs + SP * 1.0, yt + 3.0 * SP), "p", font(SERIF_I, 32), anchor="lm")
    y = yb + 6 * SP
L.text((W / 2, H - 80), "2", font(SERIF, 26), anchor="mm")
finish(L, os.path.join(OUT, "score_l.png"), 1)

# right page: variation I
R = Page()
R.text((x0 - 30, top + 40), "Var. I", font(SERIF_B, 34), anchor="lm")
y = top + 90
for i, (a, b) in enumerate(rows):
    rh = [var1_bar(bar[0][0] if isinstance(bar[0], tuple) else bar[0]) for bar in THEME_RH[a:b]]
    yt, yb, xs, bw = system(R, x0, x1, y, False, rh, THEME_LH[a:b], sixteenths=True, final=(i == len(rows) - 1))
    y = yb + 6 * SP
R.text((W / 2, H - 80), "3", font(SERIF, 26), anchor="mm")
finish(R, os.path.join(OUT, "score_r.png"), 2)
print("score pages written to", OUT)

# fingertip marks on the fallboard's clear coat (piano.py maps white to a duller coat): a loose cluster
# of soft ovals near the front edge, just right of the middle of the keyboard, where a finger has been
# tapping (it falls where the score is mirrored in the lid, so the marks blur the reflected music)
SW, SH = 2048, 512
sm = Image.new("L", (SW, SH), 0); sd = ImageDraw.Draw(sm)
r = random.Random(3)
for k in range(9):
    cx = SW * (0.6 + r.uniform(-0.05, 0.06)); cy = SH * (1 - r.uniform(0.18, 0.40))
    rx, ry = r.uniform(9, 13), r.uniform(18, 26)
    sd.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=r.randint(120, 200))
sm = sm.filter(ImageFilter.GaussianBlur(5))
# and the faint general haze of a lid that is wiped now and then
haze = Image.effect_noise((SW // 16, SH // 16), 40).resize((SW, SH), Image.BICUBIC).point(lambda v: max(0, v - 110) // 4)
sm = Image.composite(sm, haze, sm.point(lambda v: 255 if v > 10 else 0))
sm.save(os.path.join(OUT, "smudge.png"))
