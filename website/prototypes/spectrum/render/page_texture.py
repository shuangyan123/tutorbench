# Pencil page for the "When Learning Starts to Feel Like Failure" cover: a ruled exercise page with
# a learner's working, the top half rubbed out with an eraser (ghost strokes and grey smudge).
# usage: python3 page_texture.py OUT.png
import sys, random, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
random.seed(11)
W, H = 2400, 3200
paper = Image.new("L", (W, H), 246)
d = ImageDraw.Draw(paper)
for y in range(260, H, 92):                      # faint ruled lines
    d.line([(0, y), (W, y)], fill=214, width=3)
d.line([(250, 0), (250, H)], fill=222, width=3)  # margin rule

FONT = "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf"
def write(layer, x, y, text, size=70, ink=70):
    dd = ImageDraw.Draw(layer)
    for ch in text:
        f = ImageFont.truetype(FONT, int(size * random.uniform(.92, 1.08)))
        g = Image.new("L", (size * 2, size * 2), 0); ImageDraw.Draw(g).text((size // 2, size // 3), ch, font=f, fill=255)
        g = g.rotate(random.uniform(-7, 7), resample=Image.BICUBIC)
        layer.paste(Image.new("L", g.size, ink), (int(x), int(y + random.uniform(-5, 5))), g)
        x += f.getlength(ch) * random.uniform(.95, 1.05)
    return x

ink = Image.new("L", (W, H), 255)
lines = [("1/3 + 1/4 = 2/7", 1), ("top + top, bottom + bottom", 1), ("= 2/7  ?", 1), ("1/3 = 4/12    1/4 = 3/12", 0), ("4/12 + 3/12 = 7/12", 0)]
y = 330
for text, erased in lines:
    layer = Image.new("L", (W, H), 255)
    write(layer, 330, y - 70, text, 78, 60)
    layer = layer.filter(ImageFilter.GaussianBlur(1.1))
    if erased:   # rubbed out: most of the graphite lifted, a grey ghost left behind
        layer = layer.point(lambda v: 255 - (255 - v) * 0.22)
    ink = ImageChops.multiply(ink, layer); y += 184 * (1 if erased else 1)
# eraser smudge over the rubbed-out block
sm = Image.new("L", (W, H), 0); sd = ImageDraw.Draw(sm)
for _ in range(90):
    cx, cy = random.uniform(300, 1900), random.uniform(220, 820)
    sd.ellipse([cx - 160, cy - 40, cx + 160, cy + 40], fill=random.randint(5, 13))
sm = sm.filter(ImageFilter.GaussianBlur(28))
ink = ImageChops.subtract(ink, sm)
grain = Image.effect_noise((W, H), 10).point(lambda v: 128 + (v - 128) // 3)
out = ImageChops.multiply(paper, ink)
out = ImageChops.add(out, grain, scale=1.0, offset=-128)
out.convert("RGB").save(sys.argv[1])
