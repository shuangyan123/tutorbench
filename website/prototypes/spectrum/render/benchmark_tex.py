# Engraving for the Benchmark cover's survey disc (benchmark.py): a height map, white = the polished
# face, black = cut. A surveyor's bench mark carries the broad arrow and a horizontal bar at the
# reference height; the rim reads the benchmark's public name and version.
# usage: python3 benchmark_tex.py OUT_DIR
import math, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
S = 2048; C = S / 2
SANS_B = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
im = Image.new("L", (S, S), 255); d = ImageDraw.Draw(im)

# two engraved rings framing the lettering
for r, w in ((0.93, 10), (0.70, 8)):
    R = r * C; d.ellipse((C - R, C - R, C + R, C + R), outline=0, width=w)

def ring_text(text, radius, size, start_deg, spread_deg, outward=True):
    f = ImageFont.truetype(SANS_B, size)
    widths = [d.textlength(ch, font=f) for ch in text]; total = sum(widths) + 0.0
    ang = math.radians(start_deg)
    per = math.radians(spread_deg) / total
    for ch, w in zip(text, widths):
        a = ang + per * w / 2
        tile = Image.new("L", (size * 2, size * 2), 0); ImageDraw.Draw(tile).text((size - w / 2, size * 0.45), ch, font=f, fill=255)
        rot = tile.rotate(-math.degrees(a) - 90 if outward else -math.degrees(a) + 90, resample=Image.BICUBIC)
        x = C + radius * math.cos(a) - size; y = C + radius * math.sin(a) - size
        im.paste(0, (int(x), int(y)), rot)
        ang += per * w

ring_text("TEACHOMETRY  ·  BENCH MARK", 0.815 * C, 92, -188, 196)
ring_text("TUTOR-EVAL-V0.2A  ·  48 CASES", 0.815 * C, 70, 150, -120, outward=False)

# the broad arrow (three strokes meeting at a point) under a horizontal bar
bar_y = C - 0.08 * C
d.line((C - 0.42 * C, bar_y, C + 0.42 * C, bar_y), fill=0, width=34)
tip = (C, bar_y + 18)
for dx in (-0.26, 0.0, 0.26):
    d.line((C + dx * C, bar_y + 0.50 * C, tip[0], tip[1]), fill=0, width=30)
im = im.filter(ImageFilter.GaussianBlur(2.2))
im.save(os.path.join(OUT, "disc_height.png"))
print("ok")
