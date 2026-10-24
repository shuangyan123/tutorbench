# Etched markings for the Methodology cover's gauge blocks: one RGBA image per block side face,
# dark laser-etched text on transparent ground, sized to the face (35 mm wide x L mm tall at 60 px/mm).
# usage: python3 gauge_labels.py OUTDIR
import sys, os
from PIL import Image, ImageDraw, ImageFont
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
PX = 60
B = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"; R = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
INK = (20, 22, 26, 235)

def face(name, length_mm, size_txt, small=True):
    W, H = 35 * PX, max(1, int(round(length_mm * PX)))
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if length_mm >= 6:
        f = ImageFont.truetype(B, int(min(H * 0.34, 4.2 * PX)))
        t = f"{size_txt} mm"; tw = d.textlength(t, font=f)
        d.text(((W - tw) / 2, H * 0.30), t, font=f, fill=INK)
        if small:
            g = ImageFont.truetype(R, int(1.5 * PX)); s = "STEEL  ·  GRADE 0  ·  No. 0417"
            d.text(((W - d.textlength(s, font=g)) / 2, H * 0.30 + f.size * 1.25), s, font=g, fill=INK)
    else:                                   # thin blocks carry the size on the long face, small
        f = ImageFont.truetype(B, int(H * 0.62)); t = size_txt
        d.text((2.2 * PX, (H - f.size) / 2 - H * 0.05), t, font=f, fill=INK)
    im.save(os.path.join(OUT, name + ".png"))

for name, L, txt in (("b50", 50, "50"), ("b20", 20, "20"), ("b1_4", 1.4, "1.4"), ("b1_005", 1.005, "1.005"),
                     ("b25", 25, "25"), ("b10", 10, "10"), ("b2_5", 2.5, "2.5")):
    face(name, L, txt)
