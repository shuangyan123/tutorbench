# Textures for the Work with us cover (measure.py), "made to measure" (量体裁衣):
#  - piece.png / piece_graphite.png: a paper pattern piece cut from dot-and-cross pattern paper (blue
#    dots on a one-inch grid, a cross on every second one), drafted in pencil: the stitching line
#    dashed inside the cut edge, notches, a grain line, and the piece's own label.
#  - tape_cm.png / tape_in.png: the two faces of a tailor's tape measure, 16 mm wide, centimetres on
#    the front and inches on the back, numbered from the brass end.
# Also writes piece.json: the cut outline in mm, so measure.py builds the paper to the same shape.
# usage: python3 measure_tex.py HAND_FONT.ttf OUT_DIR
import json, math, os, random, sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HAND, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
random.seed(7)
SANS = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"

# ------------------------------------------------------------------ the pattern piece
PX = 8                                      # px per mm
PW, PH = 260, 330                           # the sheet the piece sits in, mm
W, H = PW * PX, PH * PX
def P(x, y): return (x + PW / 2) * PX, (PH / 2 - y) * PX       # piece mm (y up) -> image px

def catmull(pts, n=24, closed=True):
    P_ = pts + pts[:3] if closed else [pts[0]] + pts + [pts[-1]]
    out = []
    for i in range(len(P_) - 3):
        p0, p1, p2, p3 = P_[i], P_[i + 1], P_[i + 2], P_[i + 3]
        for k in range(n):
            u = k / n
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u * u
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u ** 3) for j in range(2)))
    return out

# a front bodice: hem, side seam, armhole, shoulder, neckline, centre front (mm, y up)
KEY = [(-100, -150), (-10, -153), (70, -150), (102, -146), (104, -60), (104, 22), (94, 40),
       (82, 58), (74, 84), (72, 112), (70, 134), (20, 147), (-30, 158), (-44, 136), (-62, 112),
       (-84, 99), (-101, 96), (-101, 20), (-101, -70)]
cut = catmull(KEY, 28)
# inward offset for the stitching line (15 mm seam allowance)
def offset(path, d):
    out = []
    n = len(path)
    for i in range(n):
        (x0, y0), (x1, y1) = path[i - 1], path[(i + 1) % n]
        tx, ty = x1 - x0, y1 - y0; L = math.hypot(tx, ty) or 1
        # the outline runs clockwise in y-up space, so the inside is to the right of travel
        out.append((path[i][0] + ty / L * d, path[i][1] - tx / L * d))
    return out
area = sum(cut[i - 1][0] * cut[i][1] - cut[i][0] * cut[i - 1][1] for i in range(len(cut))) / 2
SIGN = -1 if area > 0 else 1                 # make the offset point inwards either way
stitch = offset(cut, 15 * SIGN)
json.dump({"outline_mm": cut, "sheet_mm": [PW, PH]}, open(os.path.join(OUT, "piece.json"), "w"))

# paper: a cool white with fibre mottle
base = Image.effect_noise((W // 8, H // 8), 20).resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(8))
fine = Image.effect_noise((W, H), 26).filter(ImageFilter.GaussianBlur(0.7))
mott = ImageChops.add(base, fine, scale=2.0)
paper = Image.merge("RGB", [mott.point(lambda v, o=o: int(o + (v - 128) * 0.045)) for o in (240, 242, 246)])

# printed grid: a dot every inch, a cross on every second one, in a soft blue that has bled a little
grid = Image.new("L", (W, H), 0); g = ImageDraw.Draw(grid)
INCH = 25.4
for i in range(-8, 9):
    for j in range(-8, 9):
        x, y = P(i * INCH + 6, j * INCH + 4)
        if (i % 2 == 0) and (j % 2 == 0):
            a = 2.6 * PX; w = int(0.5 * PX)
            g.line((x - a, y, x + a, y), fill=255, width=w); g.line((x, y - a, x, y + a), fill=255, width=w)
        else:
            r = 0.8 * PX; g.ellipse((x - r, y - r, x + r, y + r), fill=255)
grid = grid.filter(ImageFilter.GaussianBlur(0.9))
blue = Image.new("RGB", (W, H), (50, 84, 184))
paper = Image.composite(blue, paper, grid.point(lambda v: int(min(255, v * 1.0))))

# pencil
ink = Image.new("L", (W, H), 0); d = ImageDraw.Draw(ink)
def line(pts, w=0.34, dash=None):
    px = [P(*p) for p in pts]
    if dash is None:
        for a, b in zip(px, px[1:]): d.line((*a, *b), fill=255, width=max(1, int(w * PX)))
        return
    on, off = dash; run = 0.0; draw = True
    for a, b in zip(px, px[1:]):
        seg = math.dist(a, b) / PX; t = 0.0
        while t < seg:
            step = min(seg - t, (on if draw else off) - run)
            if draw:
                u0, u1 = t / seg, (t + step) / seg
                d.line((a[0] + (b[0] - a[0]) * u0, a[1] + (b[1] - a[1]) * u0, a[0] + (b[0] - a[0]) * u1, a[1] + (b[1] - a[1]) * u1), fill=255, width=max(1, int(w * PX)))
            t += step; run += step
            if run >= (on if draw else off) - 1e-6: run = 0.0; draw = not draw
# the cut edge is where the paper ends; the pencil line sits just inside it, drawn by hand
line([(x * 0.993, y * 0.993) for x, y in cut] + [(cut[0][0] * 0.993, cut[0][1] * 0.993)], 0.36)
line(stitch + [stitch[0]], 0.26, (5.5, 3.2))
# notches: short pencil ticks across the cut edge (one on the side seam, two on the armhole)
def notch(k, double=False):
    (x0, y0), (x1, y1) = cut[k - 1], cut[k + 1]; tx, ty = x1 - x0, y1 - y0; L = math.hypot(tx, ty)
    nx, ny = ty / L * SIGN, -tx / L * SIGN
    for o in ((-1.8, 1.8) if double else (0,)):
        bx, by = cut[k][0] + tx / L * o, cut[k][1] + ty / L * o
        line([(bx, by), (bx + nx * 7, by + ny * 7)], 0.32)
notch(28 * 4 + 6); notch(28 * 7 + 10, True); notch(28 * 14 + 8)
# grain line with an arrow at each end
gx = -20
line([(gx, -110), (gx, 92)], 0.3)
for y0, s in ((-110, -1), (92, 1)):
    line([(gx - 3.4, y0 - s * 7), (gx, y0), (gx + 3.4, y0 - s * 7)], 0.3)

def hand(x, y, text, size, rot=0.0):
    """pencil lettering: set along a line, each letter a little unsteady, then turned as a whole"""
    f = ImageFont.truetype(HAND, int(size * PX))
    wd = int(f.getlength(text) * 1.1 + size * PX); ht = int(size * PX * 1.9)
    line_ = Image.new("L", (wd, ht), 0); cx = size * PX * 0.3
    for ch in text:
        gl = Image.new("L", (int(size * PX * 1.7), ht), 0)
        ImageDraw.Draw(gl).text((size * PX * 0.3, size * PX * 0.15), ch, font=f, fill=255)
        gl = gl.rotate(random.uniform(-2.5, 2.5), resample=Image.BICUBIC)
        line_.paste(255, (int(cx - size * PX * 0.3), int(random.uniform(-0.25, 0.25) * PX)), gl)
        cx += f.getlength(ch) * random.uniform(0.98, 1.04)
    line_ = line_.rotate(rot, resample=Image.BICUBIC, expand=True)
    px, py = P(x, y)
    ink.paste(255, (int(px - line_.width / 2), int(py - line_.height / 2)), line_)
hand(gx + 9, 0, "FRONT", 9.5, 90)
hand(gx + 21, 0, "cut 1 · on grain", 6.5, 90)
hand(52, -95, "No. 01", 8.5, 4)

tooth = Image.effect_noise((W, H), 90).filter(ImageFilter.GaussianBlur(0.6)).point(lambda v: 255 if v > 88 else int(v * 2.3))
inkm = ImageChops.multiply(ink.filter(ImageFilter.GaussianBlur(0.9)), tooth).filter(ImageFilter.GaussianBlur(0.6))
graphite = Image.new("RGB", (W, H), (44, 46, 56))
paper = Image.composite(graphite, paper, inkm.point(lambda v: int(min(255, v * 0.92))))
paper.save(os.path.join(OUT, "piece.png")); inkm.save(os.path.join(OUT, "piece_graphite.png"))
print("piece", W, H)

# ------------------------------------------------------------------ the tape
TPX = 12                                    # px per mm
TAPE_RGB = tuple(int(v) for v in os.environ.get("TAPE_RGB", "248,222,92").split(","))
TW, TL, TIP = 16, 760, 0                    # width, length shown (mm); 0 sits at the brass end
def tape(unit, step_mm, sub, label_every, red_every, name):
    w, h = TL * TPX, TW * TPX
    col = Image.new("RGB", (w, h), TAPE_RGB)
    # the coated glass-fibre weave shows through faintly
    weave = Image.effect_noise((w // 3, h // 3), 30).resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.2))
    col = ImageChops.add(col, Image.merge("RGB", [weave.point(lambda v: int((v - 128) * 0.05 + 128))] * 3), scale=1.0, offset=-128)
    d = ImageDraw.Draw(col)
    f = ImageFont.truetype(SANS, int(5.6 * TPX))
    n = int(TL / step_mm * sub) + 1
    for k in range(n):
        x = (TIP + k * step_mm / sub) * TPX
        if x > w: break
        full = k % sub == 0; half = sub % 2 == 0 and k % (sub // 2) == 0
        L = 4.6 if full else 3.0 if half else 1.8
        lw = max(1, int((0.26 if full else 0.18) * TPX))
        ink = (22, 22, 26)
        d.line((x, 0, x, L * TPX), fill=ink, width=lw); d.line((x, h, x, h - L * TPX), fill=ink, width=lw)
        if full and k > 0 and (k // sub) % label_every == 0:
            v = k // sub
            red = red_every and v % red_every == 0
            s = str(v); tw = f.getlength(s)
            # numerals are narrow on a tape: draw wide, squeeze horizontally
            gl = Image.new("RGBA", (int(tw + 4 * TPX), int(7.5 * TPX)), (0, 0, 0, 0))
            ImageDraw.Draw(gl).text((2 * TPX, 0), s, font=f, fill=(176, 34, 30, 255) if red else (20, 20, 24, 255))
            gl = gl.resize((int(gl.width * 0.72), gl.height), Image.LANCZOS)
            col.paste(gl, (int(x - gl.width / 2 - (0 if v < 10 else 0)), int(h / 2 - 3.6 * TPX)), gl)
    # the printer's mark near the brass end
    col.filter(ImageFilter.GaussianBlur(0.35)).save(os.path.join(OUT, name))
tape("cm", 10, 10, 1, 10, "tape_cm.png")
tape("in", 25.4, 8, 1, 12, "tape_in.png")
print("tape", TL * TPX, TW * TPX)
