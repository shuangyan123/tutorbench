# Textures for the Docs cover: a printed page of the repository's own docs/quickstart.md, and the
# pencil marks of someone tracing its structure on a sheet of vellum laid over it. Both are drawn in
# the same page coordinates (A4, 8 px/mm), so the tracing lines sit on the printed blocks they trace.
# usage: python3 vellum_tex.py QUICKSTART_MD OUTDIR
import sys, os, random, math, re
from PIL import Image, ImageDraw, ImageFont

SRC, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
PX = 8; W, H = 210 * PX, 297 * PX
SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
SERIF_B = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
f_h1 = ImageFont.truetype(SERIF_B, int(6.4 * PX)); f_h2 = ImageFont.truetype(SERIF_B, int(4.2 * PX))
f_p = ImageFont.truetype(SERIF, int(2.75 * PX)); f_code = ImageFont.truetype(MONO, int(2.5 * PX))

page = Image.new("RGB", (W, H), (247, 248, 248)); d = ImageDraw.Draw(page)
ink = (28, 30, 36); grey = (110, 114, 124)
L, R = 24 * PX, W - 24 * PX; y = 26 * PX
blocks = {}  # name -> (x0, y0, x1, y1) in px, for the tracing

def wrap(text, font, width):
    words, line, out = text.split(), "", []
    for w in words:
        t = (line + " " + w).strip()
        if d.textlength(t, font=font) > width and line: out.append(line); line = w
        else: line = t
    if line: out.append(line)
    return out

lines = open(SRC, encoding="utf8").read().split("\n")[:48]
i, para = 0, []
def flush():
    global y, para
    if para:
        y0 = y
        for ln in wrap(re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", " ".join(para)).replace("`", ""), f_p, R - L):
            d.text((L, y), ln, font=f_p, fill=ink); y += int(4.3 * PX)
        blocks.setdefault("p", []).append((L, y0, R, y)); y += int(2.6 * PX); para = []
while i < len(lines):
    s = lines[i]
    if s.startswith("# "):
        flush(); y0 = y; d.text((L, y), s[2:], font=f_h1, fill=ink); y += int(10 * PX); blocks["h1"] = (L, y0, L + d.textlength(s[2:], font=f_h1), y - 2 * PX); y += 2 * PX
    elif s.startswith("## "):
        flush(); y += 2 * PX; y0 = y; d.text((L, y), s[3:], font=f_h2, fill=ink); y += int(7 * PX); blocks.setdefault("h2", (L, y0, L + d.textlength(s[3:], font=f_h2), y - 2 * PX)); y += PX
    elif s.startswith("```"):
        flush(); j = i + 1; code = []
        while j < len(lines) and not lines[j].startswith("```"): code.append(lines[j]); j += 1
        y0 = y; h = len(code) * int(4 * PX) + 6 * PX
        d.rectangle([L, y0, R, y0 + h], fill=(232, 235, 240)); yy = y0 + 3 * PX
        for c in code: d.text((L + 4 * PX, yy), c, font=f_code, fill=ink); yy += int(4 * PX)
        blocks["code"] = (L, y0, R, y0 + h); y = y0 + h + 4 * PX; i = j
    elif s.startswith("|"):
        flush(); j = i; rows = []
        while j < len(lines) and lines[j].startswith("|"):
            if "---" not in lines[j]: rows.append([c.strip().replace("`", "") for c in lines[j].strip("|").split("|")])
            j += 1
        y0 = y
        for k, row in enumerate(rows):
            d.text((L, y), row[0], font=f_code if k else ImageFont.truetype(SERIF_B, int(2.6 * PX)), fill=ink)
            d.text((L + 120 * PX, y), row[1], font=f_code if k else ImageFont.truetype(SERIF_B, int(2.6 * PX)), fill=ink)
            y += int(4.6 * PX)
            if k == 0: d.line([(L, y - PX), (R, y - PX)], fill=grey, width=2)
        blocks["table"] = (L, y0, R, y); y += 3 * PX; i = j - 1
    elif s.strip() == "":
        flush()
    else:
        para.append(s)
    i += 1
    if y > H - 30 * PX: break
flush()
# folio
d.text((L, H - 16 * PX), "docs/quickstart.md", font=f_code, fill=grey)
d.text((R - d.textlength("1 / 3", font=f_code), H - 16 * PX), "1 / 3", font=f_code, fill=grey)
# a little paper tooth
r = random.Random(3); px = page.load()
for _ in range(W * H // 14):
    x, yy = r.randrange(W), r.randrange(H); v = px[x, yy]; k = r.randint(-5, 2); px[x, yy] = (v[0] + k, v[1] + k, v[2] + k)
page.save(os.path.join(OUT, "page.png"))

# ---- the tracing: graphite on vellum, slightly wobbly, drawn over the page's own blocks
tr = Image.new("RGBA", (W, H), (0, 0, 0, 0)); t = ImageDraw.Draw(tr); r = random.Random(7)
G = (52, 54, 60)
def stroke(pts, w=3, a=210):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(2, int(math.hypot(x1 - x0, y1 - y0) / 6))
        for k in range(n):
            u0, u1 = k / n, (k + 1) / n
            j = lambda: r.uniform(-1.1, 1.1)
            t.line([(x0 + (x1 - x0) * u0 + j(), y0 + (y1 - y0) * u0 + j()), (x0 + (x1 - x0) * u1 + j(), y0 + (y1 - y0) * u1 + j())], fill=(*G, r.randint(a - 50, a)), width=w)
def box(b, pad=2.2 * PX, over=3 * PX):
    x0, y0, x1, y1 = b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad
    # corners overshoot a little, as a quick hand box does
    stroke([(x0 - over, y0), (x1 + over * .6, y0 + 2)]); stroke([(x1, y0 - over), (x1 - 2, y1 + over * .7)])
    stroke([(x1 + over * .5, y1), (x0 - over * .4, y1 - 2)]); stroke([(x0, y1 + over * .5), (x0 + 2, y0 - over)])
box(blocks["h1"]); box(blocks["code"]); box(blocks["h2"]); box(blocks["table"])
# a margin rule linking the traced blocks, with ticks, like a hand-drawn table of contents
mx = blocks["code"][2] + 9 * PX
ys = sorted((blocks[k][1] + blocks[k][3]) / 2 for k in ("h1", "code", "h2", "table"))
stroke([(mx, ys[0]), (mx + 1, ys[-1])], w=3)
for k, yy in enumerate(ys):
    stroke([(mx - 3 * PX, yy), (mx + 3 * PX, yy + 1)], w=3)
    t.text((mx + 5 * PX, yy - 2.6 * PX), f"{k + 1}", font=ImageFont.truetype(SERIF, int(4.6 * PX)), fill=(*G, 200))
tr.save(os.path.join(OUT, "trace.png"))
print({k: v for k, v in blocks.items() if k != "p"}, "margin x", mx / PX)

# ---- the drafting mat under it all: misty blue with a faint 10 mm grid
M = 4; S = 700 * M
mat = Image.new("RGB", (S, S), (172, 184, 205)); m = ImageDraw.Draw(mat)
for k in range(0, 701, 10):
    c = (160, 172, 194) if k % 50 else (146, 158, 182); w = 2 if k % 50 else 3
    m.line([(k * M, 0), (k * M, S)], fill=c, width=w); m.line([(0, k * M), (S, k * M)], fill=c, width=w)
mat.save(os.path.join(OUT, "mat.png"))
