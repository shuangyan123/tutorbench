# Composite the film: rendered shot frames + subtitles, the AI reply panel, the five-question list and the
# end card. Layout is written in 1280x720 units and drawn at OUT_W x OUT_H (env; 1920x1080 for the final).
# usage: python comp.py [first last]   env: FR (shot frames), OUT, FPS, OUT_W, OUT_H, FONTS
import os, re, glob, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
FR = os.environ.get("FR", os.path.join(HERE, "frames")); OUT = os.environ.get("OUT", os.path.join(HERE, "final")); os.makedirs(OUT, exist_ok=True)
FONTS = os.environ.get("FONTS", os.path.join(HERE, "fonts"))
W, H, FPS = 1280, 720, int(os.environ.get("FPS", "12"))
PW, PH = int(os.environ.get("OUT_W", "1280")), int(os.environ.get("OUT_H", "720")); S = PW / W


class SD:
    """ImageDraw in 1280x720 layout units, drawn at S x"""
    def __init__(self, d): self.d = d
    def text(self, xy, t, font=None, fill=None, anchor=None): self.d.text((xy[0] * S, xy[1] * S), t, font=font, fill=fill, anchor=anchor)
    def textlength(self, t, font=None): return self.d.textlength(t, font=font) / S
    def rounded_rectangle(self, box, r, fill=None, outline=None, width=1): self.d.rounded_rectangle([v * S for v in box], r * S, fill=fill, outline=outline, width=max(1, round(width * S)))
    def ellipse(self, box, fill=None): self.d.ellipse([v * S for v in box], fill=fill)
    def line(self, pts, fill=None, width=1): self.d.line([v * S for v in pts], fill=fill, width=max(1, round(width * S)))
Draw = lambda im: SD(ImageDraw.Draw(im))
INK = (29, 27, 38); MUTE = (70, 66, 96); VIOLET = (92, 74, 170)


def font(size, weight=500):
    f = ImageFont.truetype(os.path.join(FONTS, "NotoSerifSC.ttf"), max(1, round(size * S)))
    try: f.set_variation_by_axes([weight])
    except Exception: pass
    return f

_fc = {}
def F(size, weight=500):
    k = (size, weight)
    if k not in _fc: _fc[k] = font(size, weight)
    return _fc[k]


FALL = set("őŐűŰ")
_cf = {}
def CF(size):
    if size not in _cf: _cf[size] = ImageFont.truetype(os.path.join(FONTS, "Cormorant.ttf"), max(1, round(size * 1.12 * S)))
    return _cf[size]


def runs(t):
    out = []
    for ch in t:
        fb = ch in FALL
        if out and out[-1][1] == fb: out[-1][0] += ch
        else: out.append([ch, fb])
    return out


def parse(s):
    """'a_{n} = 2^{n} - 1' -> [(text, kind)]"""
    out = []; i = 0
    for m in re.finditer(r"([_^])\{([^}]*)\}", s):
        if m.start() > i: out.append((s[i:m.start()], "n"))
        out.append((m.group(2), "sub" if m.group(1) == "_" else "sup")); i = m.end()
    if i < len(s): out.append((s[i:], "n"))
    return out


def rich_width(d, s, size, weight=500):
    w = 0
    for t, k in parse(s):
        sz = size if k == "n" else int(size * 0.62)
        for r, fb in runs(t): w += d.textlength(r, font=CF(sz) if fb else F(sz, weight))
    return w


def rich(d, xy, s, size, fill, weight=500):
    """draw rich text with its baseline at xy[1]"""
    x, base = xy
    for t, k in parse(s):
        sz = size if k == "n" else int(size * 0.62); f = F(sz, weight)
        dy = size * 0.2 if k == "sub" else -size * 0.42 if k == "sup" else 0
        for r, fb in runs(t):
            ff = CF(sz) if fb else f
            d.text((x, base + dy), r, font=ff, fill=fill, anchor="ls"); x += d.textlength(r, font=ff)
    return x


def fade(t, a, b, r=0.22):
    if t < a or t > b: return 0.0
    return max(0.0, min(1.0, (t - a) / r, (b - t) / r))


def glow_layer(size, draw_fn, alpha):
    """text with a soft pale halo behind it, for legibility over brass and glass"""
    txt = Image.new("RGBA", size, (0, 0, 0, 0)); draw_fn(Draw(txt), None)
    halo = Image.new("RGBA", size, (238, 242, 252, 0)); draw_fn(Draw(halo), (238, 242, 252))
    a = halo.split()[3].filter(ImageFilter.GaussianBlur(9 * S)).point(lambda v: int(min(255, v * 1.6) * 0.8 * alpha))
    halo.putalpha(a)
    ta = txt.split()[3].point(lambda v: int(v * alpha)); txt.putalpha(ta)
    return halo, txt


# ------------------------------------------------------------------ timeline
SHOTS = [("S1", 0, 2), ("S2", 2, 4), ("S3", 4, 10), ("S4", 10, 18), ("S5", 18, 26), ("S6", 26, 32),
         ("S7", 32, 40), ("S8", 40, 50), ("S9", 50, 55), ("END", 55, 60)]

SUBS = [  # start, end, zh, en, speaker
    (0.15, 1.95, "千禧年难题。", "A Millennium Prize problem.", None),
    (2.05, 3.95, "722 篇论文。", "722 papers.", None),
    (4.05, 5.95, "埃尔德什猜想。", "An Erdős conjecture.", None),
    (6.1, 9.8, "AI 解题的新闻，几乎每周都有。", "News of AI solving hard maths arrives almost every week.", None),
    (10.4, 14.0, "「a_{1} = 1，a_{n+1} = 2a_{n} + 1。前三项是 1、3、7，所以 a_{n} = 2^{n} − 1。", "a_{1} = 1, a_{n+1} = 2a_{n} + 1. The first terms are 1, 3, 7, so a_{n} = 2^{n} − 1.", "学生"),
    (14.0, 17.8, "我验证了 n = 1、2、3，已经证明了。」", "I checked n = 1, 2, 3, so it's proved.", "学生"),
    (26.6, 28.0, "每一句都对。", "Every line is correct.", None),
    (28.0, 30.2, "可没人告诉他：验三项，不叫证明。", "But no one told him that checking three cases is not a proof.", None),
    (30.2, 32.0, "最后一步，也替他走完了。", "And it took the last step for him.", None),
    (32.4, 35.6, "好老师不会替他写完，而是问一句：", "A good tutor would not finish it for him. It would ask:", None),
    (35.6, 39.8, "如果第 k 项成立，第 k+1 项也成立吗？", "If it holds for k, does it hold for k + 1?", None),
    (50.3, 52.7, "同样的题，同样的标准，换一个 AI 再测一遍。", "Same questions, same standard, run again with another AI.", None),
    (52.7, 54.9, "题目和评分细则全部公开。", "Every question and rubric is public.", None),
]

AI_LINES = [(21.1, "观察得很好！a_{n} = 2^{n} − 1 是对的。"), (21.9, "用数学归纳法证明："),
            (22.6, "假设 a_{k} = 2^{k} − 1，"), (23.3, "则 a_{k+1} = 2(2^{k} − 1) + 1 = 2^{k+1} − 1。"), (24.2, "证毕。")]
AI_T0, AI_T1 = 20.9, 26.35

QS = [("帮助本身对吗？", "Is the help correct?"), ("看出问题了吗？", "Did it see the problem?"),
      ("帮学生往前走了吗？", "Did it move the learner forward?"), ("是对这个学生说的吗？", "Was it said to this learner?"),
      ("他知道下一步做什么吗？", "Does he know what to do next?")]
Q_T = [40 + 2.2 + (gx + 275) / 75 - 0.35 for gx in (-240, -120, 0, 120, 240)]
Q_T0, Q_T1 = 40.3, 50.1


def shot_frame(t):
    for sid, a, b in SHOTS:
        if a <= t < b: return sid, int(round((t - a) * FPS))
    return "END", int(round((t - 55) * FPS))


def base_image(t):
    sid, f = shot_frame(t)
    if sid == "END":
        last = Image.open(sorted(glob.glob(os.path.join(FR, "S9", "*.png")))[-1]).convert("RGB").resize((PW, PH), Image.LANCZOS)
        end = Image.open(os.path.join(FR, "end.png")).convert("RGB").resize((PW, PH), Image.LANCZOS)
        u = (t - 55) / 5.0; z = 1.0 + 0.035 * u          # slow push on the resting marble
        cw, ch = PW / z, PH / z; end = end.crop(((PW - cw) / 2, (PH - ch) / 2 + 20 * S * u, (PW + cw) / 2, (PH + ch) / 2 + 20 * S * u)).resize((PW, PH), Image.LANCZOS)
        k = min(1.0, (t - 55) / 0.7)
        return Image.blend(last, end, k)
    d = os.path.join(FR, sid); fs = sorted(glob.glob(os.path.join(d, "*.png")))
    nums = [int(os.path.basename(x)[:4]) for x in fs]
    if f in nums: return Image.open(fs[nums.index(f)]).convert("RGB").resize((PW, PH), Image.LANCZOS)
    best = min(range(len(nums)), key=lambda j: abs(nums[j] - f))
    return Image.open(fs[best]).convert("RGB").resize((PW, PH), Image.LANCZOS)


def subtitle(img, zh, en, speaker, a):
    zs, es = 34, 20
    yz, ye = (96, 132) if speaker else (640, 676)
    def draw(d, col):
        zw = rich_width(d, zh, zs, 520); x = (W - zw) / 2
        if speaker:
            sw = d.textlength(speaker + "  ", font=F(22, 600)); x = (W - zw - sw) / 2
            d.text((x, yz), speaker, font=F(22, 600), fill=col or VIOLET, anchor="ls"); x += sw
        rich(d, (x, yz), zh, zs, col or INK, 520)
        ew = rich_width(d, en, es, 420); rich(d, ((W - ew) / 2, ye), en, es, col or MUTE, 420)
    halo, txt = glow_layer((PW, PH), draw, a)
    img.alpha_composite(halo); img.alpha_composite(txt)


def ai_panel(img, t):
    a = fade(t, AI_T0, AI_T1, 0.35)
    if a <= 0: return
    x0, y0, x1 = 664, 150, 1218
    lay = Image.new("RGBA", (PW, PH), (0, 0, 0, 0)); d = Draw(lay)
    shown = [l for l in AI_LINES if t >= l[0]]
    y1 = y0 + 84 + 52 * len(AI_LINES) + 18
    sh = Image.new("RGBA", (PW, PH), (0, 0, 0, 0)); Draw(sh).rounded_rectangle((x0 + 4, y0 + 10, x1 + 4, y1 + 12), 10, fill=(40, 40, 80, int(50 * a)))
    sh = sh.filter(ImageFilter.GaussianBlur(14 * S)); img.alpha_composite(sh)
    d.rounded_rectangle((x0, y0, x1, y1), 10, fill=(250, 251, 254, int(236 * a)), outline=(60, 58, 90, int(60 * a)), width=1)
    d.ellipse((x0 + 28, y0 + 30, x0 + 40, y0 + 42), fill=(*VIOLET, int(255 * a)))
    d.text((x0 + 52, y0 + 44), "AI 老师", font=F(21, 600), fill=(*VIOLET, int(255 * a)), anchor="ls")
    d.text((x1 - 28, y0 + 44), "AI tutor", font=F(16, 400), fill=(*MUTE, int(200 * a)), anchor="rs")
    d.line((x0 + 28, y0 + 64, x1 - 28, y0 + 64), fill=(60, 58, 90, int(40 * a)), width=1)
    y = y0 + 108
    for t0, s in AI_LINES:
        la = a * max(0.0, min(1.0, (t - t0) / 0.3))
        if la > 0:
            dy = (1 - la) * 6
            rich(d, (x0 + 28, y + dy), s, 25, (*INK, int(255 * la)), 480)
        y += 52
    img.alpha_composite(lay)


def questions(img, t):
    a = fade(t, Q_T0, Q_T1, 0.35)
    if a <= 0: return
    def draw(d, col):
        d.text((64, 96), "TutorBench 问五件事", font=F(30, 600), fill=col or INK, anchor="ls")
        d.text((64, 126), "Five questions TutorBench asks", font=F(17, 420), fill=col or MUTE, anchor="ls")
        y = 186
        for i, ((zh, en), tq) in enumerate(zip(QS, Q_T)):
            la = max(0.0, min(1.0, (t - tq) / 0.3))
            if la <= 0: break
            cur = (i == len([q for q in Q_T if t >= q]) - 1)
            ink = INK if cur else (120, 118, 140)
            c = col or ink
            d.text((64, y), "%d" % (i + 1), font=F(18, 600), fill=col or VIOLET, anchor="ls")
            d.text((92, y), zh, font=F(28 if cur else 24, 560 if cur else 480), fill=c, anchor="ls")
            d.text((92, y + 24), en, font=F(15, 420), fill=col or MUTE, anchor="ls")
            y += 62
    halo, txt = glow_layer((PW, PH), draw, a)
    img.alpha_composite(halo); img.alpha_composite(txt)


def end_card(img, t):
    a1 = max(0.0, min(1.0, (t - 55.8) / 0.8)); a2 = max(0.0, min(1.0, (t - 56.8) / 0.8))
    if a1 <= 0: return
    def draw(d, col):
        s = "会做题，不等于会教。"; f = F(58, 560)
        d.text((W / 2, 250), s, font=f, fill=col or INK, anchor="ms")
        d.text((W / 2, 292), "Solving is not teaching.", font=F(22, 420), fill=col or MUTE, anchor="ms")
    halo, txt = glow_layer((PW, PH), draw, a1); img.alpha_composite(txt)
    if a2 > 0:
        lay = Image.new("RGBA", (PW, PH), (0, 0, 0, 0)); d = Draw(lay)
        d.text((W / 2, 646), "Teachometry  TutorBench  ·  teachometry.com", font=F(20, 480), fill=(*INK, int(230 * a2)), anchor="ms")
        img.alpha_composite(lay)


def frame(i):
    t = i / FPS
    img = base_image(t).convert("RGBA")
    # thin dip between the montage and the run (bead lifted away -> marble lands)
    for s in SUBS:
        a = fade(t, s[0], s[1])
        if a > 0: subtitle(img, s[2], s[3], s[4], a)
    ai_panel(img, t); questions(img, t); end_card(img, t)
    if t > 59.2:
        k = (t - 59.2) / 0.8; img = Image.blend(img, Image.new("RGBA", (PW, PH), (226, 231, 244, 255)), min(1.0, k) * 0.0)
    return img.convert("RGB")


if __name__ == "__main__":
    import sys
    a = int(sys.argv[1]) if len(sys.argv) > 1 else 0; b = int(sys.argv[2]) if len(sys.argv) > 2 else 60 * FPS
    for i in range(a, b):
        frame(i).save(os.path.join(OUT, "%04d.png" % i))
