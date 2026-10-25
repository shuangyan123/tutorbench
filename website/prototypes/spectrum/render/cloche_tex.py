# Museum label for the Models cover (cloche.py): a small card on the base of an empty display
# cloche, typed with the catalogue's public state.
# usage: python3 cloche_tex.py OUT_DIR
import os, sys
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
SERIF = "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"
SERIF_I = "/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf"
MONO = "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf"
PX = 30; W, H = 70 * PX, 40 * PX                # a 70 x 40 mm card
im = Image.new("RGB", (W, H), (240, 240, 236)); d = ImageDraw.Draw(im)
d.text((5 * PX, 4.5 * PX), "Model evidence", font=ImageFont.truetype(SERIF, int(6 * PX)), fill=(26, 26, 30))
d.text((5 * PX, 13.5 * PX), "Catalogue entry, awaiting its first public run.", font=ImageFont.truetype(SERIF_I, int(2.9 * PX)), fill=(60, 60, 66))
d.line((5 * PX, 20 * PX, W - 5 * PX, 20 * PX), fill=(120, 120, 126), width=3)
f = ImageFont.truetype(MONO, int(2.6 * PX))
for k, line in enumerate(["BENCHMARK   tutor-eval-v0.2a", "PUBLIC RUNS  0", "RANKING      none published"]):
    d.text((5 * PX, (23 + k * 4.6) * PX), line, font=f, fill=(40, 40, 46))
im.save(os.path.join(OUT, "label.png"))
print("ok")
