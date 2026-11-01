# Textures for the Contact cover (letterbox.py): the engraved word on the brass flap (height map)
# and the message side of the postcard going through the slot.
# usage: python3 letterbox_tex.py OUT_DIR
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
SANS_B = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
SERIF_I = "/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf"
MONO = "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf"

# flap engraving, 240 x 52 mm
PX = 12; W, H = 240 * PX, 52 * PX
im = Image.new("L", (W, H), 255); d = ImageDraw.Draw(im)
f = ImageFont.truetype(SANS_B, int(9 * PX)); t = "L E T T E R S"; tw = d.textlength(t, font=f)
d.text(((W - tw) / 2, (H - 10 * PX) / 2), t, font=f, fill=0)
im.filter(ImageFilter.GaussianBlur(1.5)).save(os.path.join(OUT, "flap_height.png"))

# postcard, 148 x 105 mm, message side
PX = 16; W, H = 148 * PX, 105 * PX
im = Image.new("RGB", (W, H), (244, 242, 236)); d = ImageDraw.Draw(im)
d.line((W * 0.56, 10 * PX, W * 0.56, H - 10 * PX), fill=(150, 150, 156), width=4)
hand = ImageFont.truetype(SERIF_I, int(6.4 * PX))
for k, line in enumerate(["A question about", "case fraction-", "misconception-001,", "and an idea for", "a new one."]):
    d.text((8 * PX, (14 + k * 10) * PX), line, font=hand, fill=(30, 46, 98))
d.rectangle((W - 30 * PX, 8 * PX, W - 8 * PX, 34 * PX), outline=(150, 150, 156), width=4)
mono = ImageFont.truetype(MONO, int(4.2 * PX))
for k, line in enumerate(["Teachometry", "Contact", "teachometry.com"]):
    d.line((W * 0.6, (58 + k * 13) * PX, W - 8 * PX, (58 + k * 13) * PX), fill=(170, 170, 176), width=3)
    d.text((W * 0.61, (52.5 + k * 13) * PX), line, font=mono, fill=(36, 38, 46))
im.save(os.path.join(OUT, "postcard.png"))
print("ok")
