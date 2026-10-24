# Graph-paper sheet for the "When Learning Starts to Feel Like Failure" figure: the essay's own example,
# a learner working out how the parameter a changes y = ax². Pencil axes, three parabolas
# (a = 1/2, 1, 2) and a shifted one, labels in a learner's hand. Writes the colour texture and a
# graphite mask (graphite is a little shinier than paper).
# usage: python3 graph_texture.py OUT_COLOUR.png OUT_GRAPHITE.png
import sys, random, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
random.seed(23)
W, H = 3000, 2100                 # an A4 sheet in landscape at ~10 px/mm
MM = W / 297
paper = Image.new("RGB", (W, H), (244, 244, 239))
d = ImageDraw.Draw(paper)
for i in range(0, int(297 / 1) + 1):                     # 1 mm / 5 mm / 10 mm grid in a soft grey-green ink
    x = round(i * MM); c = (198, 210, 204) if i % 10 == 0 else (212, 222, 216) if i % 5 == 0 else (229, 234, 230)
    d.line([(x, 0), (x, H)], fill=c, width=3 if i % 10 == 0 else 2 if i % 5 == 0 else 1)
for j in range(0, int(210 / 1) + 1):
    y = round(j * MM); c = (198, 210, 204) if j % 10 == 0 else (212, 222, 216) if j % 5 == 0 else (229, 234, 230)
    d.line([(0, y), (W, y)], fill=c, width=3 if j % 10 == 0 else 2 if j % 5 == 0 else 1)

ink = Image.new("L", (W, H), 0)                           # graphite coverage, 0..255
def stroke(pts, width=5, dark=170, passes=2):
    """a pencil line: several slightly offset passes with broken pressure"""
    for _ in range(passes):
        layer = Image.new("L", (W, H), 0); dl = ImageDraw.Draw(layer)
        ox, oy = random.uniform(-1.5, 1.5), random.uniform(-1.5, 1.5)
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            p = dark * random.uniform(0.75, 1.0)
            dl.line([(x0 + ox, y0 + oy), (x1 + ox, y1 + oy)], fill=int(p), width=width)
        grain = Image.effect_noise((W, H), 90).point(lambda v: 255 if v > 110 else int(v * 1.6))
        layer = ImageChops.multiply(layer, grain)
        global ink; ink = ImageChops.lighter(ink, layer)

# axes, origin a little left of centre and low
OX, OY, U = W * 0.5, H * 0.93, 24 * MM             # 1 unit = 24 mm
def P(x, y): return (OX + x * U, OY - y * U)
stroke([(OX - 5.6 * U, OY), (OX + 5.9 * U, OY)], 6, 200, 2)
stroke([(OX, OY + 0.25 * U), (OX, OY - 7.6 * U)], 6, 200, 2)
for (ax, ay), (bx, by) in (((OX + 5.9 * U - 26, OY - 13), (OX + 5.9 * U, OY)), ((OX + 5.9 * U - 26, OY + 13), (OX + 5.9 * U, OY)),
                           ((OX - 13, OY - 7.6 * U + 26), (OX, OY - 7.6 * U)), ((OX + 13, OY - 7.6 * U + 26), (OX, OY - 7.6 * U))):
    stroke([(ax, ay), (bx, by)], 6, 200, 1)
for k in range(-5, 6):                                  # unit ticks
    if k: stroke([P(k, 0.07), P(k, -0.07)], 4, 170, 1)
for k in range(1, 8): stroke([P(0.07, k), P(-0.07, k)], 4, 170, 1)

def curve(f, x0, x1, width=6, dark=190):
    xs = [x0 + (x1 - x0) * t / 160 for t in range(161)]
    pts = []
    for x in xs:
        y = f(x)
        if -0.6 < y < 7.0: pts.append(P(x + random.gauss(0, 0.004), y + random.gauss(0, 0.004)))
    stroke(pts, width, dark, 3)
curve(lambda x: 0.5 * x * x, -3.8, 3.8, 6, 175)
curve(lambda x: x * x, -2.7, 2.7, 7, 205)
curve(lambda x: 2 * x * x, -1.9, 1.9, 6, 190)
# a first attempt at a = 2 drawn too wide, rubbed out: a ghost line
ghost = Image.new("L", (W, H), 0); gd = ImageDraw.Draw(ghost)
pts = [P(x, 1.5 * x * x) for x in [-2.2 + 4.4 * t / 100 for t in range(101)] if 1.5 * x * x < 6.9]
for a_, b_ in zip(pts, pts[1:]): gd.line([a_, b_], fill=60, width=8)
ghost = ghost.filter(ImageFilter.GaussianBlur(5)); ink = ImageChops.lighter(ink, ghost)
# the shifted one the learner tries next
curve(lambda x: (x - 3) ** 2, 0.4, 5.6, 6, 180)

FONT = "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf"
def write(x, y, text, size=64, dark=200):
    global ink
    for ch in text:
        f = ImageFont.truetype(FONT, int(size * random.uniform(.92, 1.08)))
        g = Image.new("L", (size * 2, size * 2), 0); ImageDraw.Draw(g).text((size // 2, size // 3), ch, font=f, fill=dark)
        g = g.rotate(random.uniform(-6, 6), resample=Image.BICUBIC)
        layer = Image.new("L", (W, H), 0); layer.paste(g, (int(x - size / 2), int(y + random.uniform(-4, 4) - size / 3)))
        ink = ImageChops.lighter(ink, layer)
        x += f.getlength(ch) * random.uniform(.95, 1.06) if ch != " " else size * 0.32
write(*P(-4.25, 7.45), "a=1/2", 58)
write(*P(-2.98, 7.45), "a=1", 58)
write(*P(-2.2, 7.55), "a=2", 58)
write(*P(4.0, 7.3), "(x-3)²", 58)
write(*P(-5.5, 5.6), "y = ax²", 70, 215)
write(*P(-5.5, 4.95), "bigger a", 52, 185)
write(*P(-5.5, 4.45), "-> narrower", 52, 185)
write(*P(5.55, -0.2), "x", 56); write(*P(0.15, 7.75), "y", 56)

ink = ink.filter(ImageFilter.GaussianBlur(1.1))
graphite = Image.new("RGB", (W, H), (58, 58, 62))
out = Image.composite(graphite, paper, ink.point(lambda v: int(v * 0.92)))
# paper fibre
fib = Image.effect_noise((W, H), 14).convert("RGB")
out = ImageChops.multiply(out, Image.merge("RGB", [fib.split()[0].point(lambda v: 235 + v // 12)] * 3))
out.save(sys.argv[1]); ink.save(sys.argv[2])
