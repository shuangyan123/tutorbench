# The cut gems that mark the five dimensions (λ1–λ5), and the paler stones of the Methodology
# knowledge map, rendered in Blender (Cycles) on a transparent background.
#
#   λ1 ruby       oval brilliant          λ2 citrine   pear brilliant
#   λ3 emerald    emerald (step) cut      λ4 sapphire  cushion brilliant
#   λ5 amethyst   trillion
#
# How they are made (v2, 2026-11-17):
# - Cut like a lapidary designs a stone: every facet is a plane set by its angle and where it meets
#   the girdle, and the stone is the intersection of those planes. Facets are exactly flat and meet in
#   clean edges. Brilliants have table, stars, bezels, upper and lower halves and pavilion mains (fancy
#   shapes with split mains, 16 under the table); step cuts have three crown and three pavilion tiers
#   and a keel. Crown and pavilion angles suit each stone's refractive index, so light comes back up
#   through the crown instead of leaking out (the dark "window" of the first version).
# - Colour and fire are spectral: 12 wavelength bins from 400 to 700 nm. Each bin has the stone's own
#   absorption (from its absorption bands: Cr3+ in ruby and emerald, Fe-Ti in sapphire, Fe in citrine,
#   the colour centre in amethyst) and its own refractive index (Cauchy fit to n_D and the B–G
#   dispersion). Cycles has no spectral mode, so a pass is rendered per refractive index, carrying three
#   neighbouring bins in its R, G, B channels; the bins are mixed to colour with the CIE 1931 colour
#   matching functions.
# - Light: a jeweller's light tent in the site's colours. Misty-blue page below, a ring of small soft
#   boxes, a key strip, peach and lavender glows, black cards and the camera's own dark reflection for
#   contrast, and small hard lamps for sparkle and fire.
# - Rendered large (576 px), trimmed to the stone and reduced in linear light to 96 px (gem-k.webp)
#   and 192 px (gem-k-2x.webp, for the larger markers on high-density screens).
#
# needs: pip install bpy scipy pillow   (bpy brings numpy; Blender 5.x)
# usage: python gems.py render OUT_DIR [SIZE SPP]      12 bins in 4 passes per stone -> OUT_DIR/<name>_p<g>.exr
#        python gems.py combine OUT_DIR [EXPOSURE]     -> OUT_DIR/<name>.png (full size)
#        python gems.py export OUT_DIR ASSETS_DIR      -> ASSETS_DIR/gem-<k>.webp, gem-<k>-2x.webp (domains: 96 px only)
#        GEMSET=domains python gems.py ...             the knowledge map's stones (domain-<id>.webp)
# The site's files: render 576 256, combine 1 (the domain stones too), export into ../assets/gems.
import math, os, sys, time
import numpy as np

# ---------------------------------------------------------------- spectra
GROUPS = 4                       # refractive-index passes
NB = 3 * GROUPS                  # wavelength bins, three per pass (in its R, G, B)
EDGES = np.linspace(400, 700, NB + 1)
CENTRES = (EDGES[:-1] + EDGES[1:]) / 2


def _lobe(x, mu, s1, s2):
    return np.exp(-0.5 * ((x - mu) / np.where(x < mu, s1, s2)) ** 2)


def cmf(lam):
    """CIE 1931 2° colour matching functions (Wyman, Sloan & Shirley 2013 multi-lobe fit)"""
    x = 1.056 * _lobe(lam, 599.8, 37.9, 31.0) + 0.362 * _lobe(lam, 442.0, 16.0, 26.7) - 0.065 * _lobe(lam, 501.1, 20.4, 26.2)
    y = 0.821 * _lobe(lam, 568.8, 46.9, 40.5) + 0.286 * _lobe(lam, 530.9, 16.3, 31.1)
    z = 1.217 * _lobe(lam, 437.0, 11.8, 36.0) + 0.681 * _lobe(lam, 459.0, 26.0, 13.8)
    return np.stack([x, y, z], -1)


XYZ2RGB = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]])
W = np.array([XYZ2RGB @ cmf(np.linspace(a, b, 26)).mean(0) for a, b in zip(EDGES[:-1], EDGES[1:])])
W = W / W.sum(0)                 # (NB, 3) linear sRGB per bin; a flat spectrum is white (1, 1, 1)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


_BASIS = np.stack([smoothstep(565, 615, CENTRES), smoothstep(480, 520, CENTRES) - smoothstep(565, 615, CENTRES),
                   1 - smoothstep(480, 520, CENTRES)], 0)
_BASIS_INV = np.linalg.inv((_BASIS @ W).T)


def spectrum(rgb):
    """a smooth spectrum over the bins for a (mildly tinted) linear RGB light colour"""
    return np.clip((_BASIS_INV @ np.asarray(rgb, float)) @ _BASIS, 0, None)


def ior(nd, disp, lam):
    """Cauchy n = A + B / λ², fitted to n_D (589.3 nm) and the B–G dispersion (430.8–686.7 nm)"""
    B = disp / (1 / 0.4308 ** 2 - 1 / 0.6867 ** 2)
    return nd - B / 0.5893 ** 2 + B / (lam / 1000) ** 2


def band(lam, mu, s, a): return a * np.exp(-0.5 * ((lam - mu) / s) ** 2)
def edge(lam, at, width, a): return a / (1 + np.exp((lam - at) / width))   # rising into the violet


def srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def tonemap(rgb, exposure=0.0, knee=0.62):
    """a soft shoulder on luminance, then colours out of range are desaturated towards their own
    luminance (hue kept), so jewel colours stay saturated and bright highlights run to white"""
    x = np.maximum(rgb, -0.05) * 2 ** exposure
    L = x @ np.array([0.2126, 0.7152, 0.0722])
    Lc = np.where(L < knee, L, knee + (1 - knee) * (1 - np.exp(-(L - knee) / (1 - knee))))
    x = x * (Lc / np.maximum(L, 1e-9))[..., None]
    Lm = np.clip(Lc, 0, 1)[..., None]
    mx = x.max(-1, keepdims=True); mn = x.min(-1, keepdims=True)
    t = np.minimum(np.where(mx > 1, (1 - Lm) / np.maximum(mx - Lm, 1e-9), 1), np.where(mn < 0, Lm / np.maximum(Lm - mn, 1e-9), 1))
    return Lm + (x - Lm) * np.clip(t, 0, 1)


# ---------------------------------------------------------------- the stones
# absorption per scene unit (a stone is about 2 units long); nd and dispersion from gemmological tables
FIVE = [
    dict(name="ruby", cut=("brilliant", "oval", dict(crown_deg=36, pav_deg=42, split=True)), nd=1.766, disp=0.018,
         # Cr3+ in corundum: bands near 410 and 550 nm, a little blue between them, red free
         sigma=lambda l: band(l, 410, 30, 7.0) + band(l, 548, 34, 6.5) + band(l, 480, 22, 3.5) + 0.03),
    dict(name="citrine", cut=("brilliant", "pear", dict(crown_deg=40, pav_deg=45, mains="arc8", split=True)), nd=1.548, disp=0.013,
         # Fe3+ in quartz: absorption climbing steeply into the blue and violet
         sigma=lambda l: edge(l, 488, 18, 7.0) + band(l, 530, 30, 0.9) + 0.03),
    dict(name="emerald", cut=("step", None, dict()), nd=1.580, disp=0.014,
         # Cr3+ in beryl: bands near 430 and 610 nm, Fe2+ tail into the deep red
         sigma=lambda l: band(l, 430, 30, 6.0) + band(l, 478, 14, 1.2) + band(l, 612, 36, 5.5) + band(l, 720, 60, 1.6) + 0.04),
    dict(name="sapphire", cut=("brilliant", "cushion", dict(crown_deg=36, pav_deg=42, split=True)), nd=1.766, disp=0.018,
         # Fe2+–Ti4+ charge transfer over yellow and red; a little violet absorbed too
         sigma=lambda l: band(l, 582, 40, 5.5) + band(l, 690, 60, 4.0) + band(l, 405, 18, 2.2) + 0.04),
    dict(name="amethyst", cut=("brilliant", "trillion", dict(crown_deg=40, pav_deg=43, mains=[0, 60, 120, 180, 240, 300])),
         nd=1.548, disp=0.013,
         # Fe4+ colour centre: one broad band over green and yellow; violet and some red pass
         sigma=lambda l: band(l, 550, 45, 5.0) + band(l, 690, 45, 1.2) + edge(l, 405, 12, 0.6) + 0.04),
]
# GEMSET=domains: the knowledge map's eight mathematics domains, as five families of paler stones (so
# they never read as the five dimension gems), grouped as on the map: PISA's four content areas plus
# TutorBench's internal domains. Within a family the stone is the same and the cut and shade change.
#   quantity            morganite      peach-pink    number                       round
#   change & relations  aquamarine     sea blue      algebra / functions          step / oval
#   space & shape       tanzanite      blue-violet   geometry                     asscher
#   uncertainty & data  kunzite        lilac pink    probability / statistics     marquise / baguette
#   internal            quartz         clear, smoky  proof / calculus + algebra   cushion / pear
DOMAINS = [
    dict(name="number-quantity", cut=("brilliant", "round", dict(crown_deg=40, pav_deg=43)), nd=1.587, disp=0.014,
         sigma=lambda l: band(l, 500, 40, 0.55) + edge(l, 440, 22, 0.55) + 0.02),
    dict(name="algebra-equations", cut=("step", None, dict()), nd=1.577, disp=0.014,
         sigma=lambda l: band(l, 730, 95, 1.05) + band(l, 428, 16, 0.25) + 0.03),
    dict(name="functions", cut=("brilliant", "oval", dict(crown_deg=40, pav_deg=43)), nd=1.577, disp=0.014,
         sigma=lambda l: band(l, 730, 95, 0.62) + 0.02),
    dict(name="geometry", cut=("step", None, dict(w=0.84, l=0.84, corner=0.26)), nd=1.694, disp=0.019,
         sigma=lambda l: band(l, 592, 42, 0.8) + band(l, 528, 28, 0.35) + 0.03),
    dict(name="discrete-probability", cut=("brilliant", "marquise", dict(crown_deg=40, pav_deg=43)), nd=1.666, disp=0.017,
         sigma=lambda l: band(l, 545, 48, 0.62) + 0.02),
    dict(name="statistics", cut=("step", None, dict(w=1.0, l=0.4, corner=0.03, crown_rings=((0.05, 40), (0.12, 25)),
                                                      pav_rings=((0.15, 50),), keel_deg=45)), nd=1.666, disp=0.017,
         sigma=lambda l: band(l, 545, 48, 0.4) + band(l, 440, 30, 0.12) + 0.02),
    dict(name="proof-structures", cut=("brilliant", "cushion", dict(crown_deg=40, pav_deg=43)), nd=1.548, disp=0.013,
         sigma=lambda l: 0.015 + 0 * l),
    dict(name="advanced-mathematics", cut=("brilliant", "pear", dict(crown_deg=40, pav_deg=43, mains="arc8")), nd=1.548, disp=0.013,
         sigma=lambda l: edge(l, 470, 70, 0.75) + 0.13),
]
DOMAIN_SET = os.environ.get("GEMSET") == "domains"
STONES = DOMAINS if DOMAIN_SET else FIVE


# ---------------------------------------------------------------- the cuts
def outline(cut, t):
    """girdle outline, t in [0, 1): a point on the stone's plan, longest axis along x"""
    th = 2 * math.pi * t; c, s = math.cos(th), math.sin(th)
    if cut == "round": return 0.86 * c, 0.86 * s
    if cut == "oval": return 1.0 * c, 0.72 * s
    if cut == "marquise": return 1.0 * c, math.copysign(0.48 * (1 - c * c) ** 0.85, s)
    if cut == "pear": return 1.0 * c, 0.70 * s * ((1 - c) / 2) ** 0.62      # round shoulder at -x, point at +x
    if cut == "cushion":
        p = 0.6   # superellipse, a square with softened corners
        return math.copysign(abs(c) ** p, c) * 0.9, math.copysign(abs(s) ** p, s) * 0.9
    if cut == "trillion":   # equilateral, gently curved sides, softened points
        k = (th + math.pi / 2) % (2 * math.pi / 3) - math.pi / 3
        r = min(0.5 / math.cos(k) * (1 + 0.10 * math.cos(3 * k)) * 1.12, 0.95)
        return r * math.cos(th + math.pi / 2), r * math.sin(th + math.pi / 2)
    raise ValueError(cut)


class Outline:
    def __init__(self, cut, n=4096):
        self.n = n; self.P = np.array([outline(cut, i / n) for i in range(n)])

    def support(self, phi):
        u = np.array([math.cos(phi), math.sin(phi)]); d = self.P @ u; i = int(np.argmax(d))
        return float(d[i]), self.P[i]

    def normal_az(self, t):
        i = int(round(t * self.n)) % self.n
        tg = self.P[(i + 6) % self.n] - self.P[(i - 6) % self.n]
        return math.atan2(-tg[0], tg[1])


def _facet(O, phi, ang, z0, up):
    """a crown (up) or pavilion facet at azimuth phi and `ang` degrees, touching the girdle at height z0"""
    h, _ = O.support(phi); a = math.radians(ang)
    n = np.array([math.sin(a) * math.cos(phi), math.sin(a) * math.sin(phi), math.cos(a) if up else -math.cos(a)])
    return n, h * math.sin(a) + (z0 if up else -z0) * math.cos(a)


def brilliant(cut, crown_deg, pav_deg, table=0.56, girdle=0.022, mains=8, split=False):
    """table, stars, bezels and upper halves; girdle; pavilion mains and lower halves. mains: a count
    (spaced along the outline's parameter), "arcN" (spaced by arc length) or a list of azimuths."""
    O = Outline(cut); g = girdle
    star_deg, uh_deg, lh_deg = crown_deg - 15, crown_deg + 6, pav_deg + 1.6
    if isinstance(mains, str):
        k_ = int(mains[3:]); seg = np.linalg.norm(np.roll(O.P, -1, 0) - O.P, axis=1)
        cum = np.r_[0, np.cumsum(seg)[:-1]] / seg.sum()
        ts = [float(np.searchsorted(cum, k / k_)) / O.n for k in range(k_)]
    else:
        ts = [k / mains for k in range(mains)] if isinstance(mains, int) else None
    phis = [math.radians(a) for a in mains] if ts is None else [O.normal_az(t) for t in ts]
    m = len(phis)

    def az(k, f):   # an azimuth a fraction f of the way from main k to main k+1
        if ts is None:
            return phis[k] + f * (phis[(k + 1) % m] + (2 * math.pi if k == m - 1 else 0) - phis[k])
        t0, t1 = ts[k], ts[(k + 1) % m] + (1 if k == m - 1 else 0)
        return O.normal_az((t0 + f * (t1 - t0)) % 1)

    planes = []
    for j in range(128):     # the girdle, 128 narrow vertical facets
        phi = 2 * math.pi * j / 128
        planes.append((np.array([math.cos(phi), math.sin(phi), 0.0]), O.support(phi)[0]))
    hm = [O.support(p)[0] for p in phis]
    H = g + (1 - table) * float(np.mean(hm)) * math.tan(math.radians(crown_deg))
    planes.append((np.array([0, 0, 1.0]), H))
    C = []                    # table corners: where each bezel reaches the table
    for p, h in zip(phis, hm):
        _, Gp = O.support(p); s = 1 - (H - g) / (math.tan(math.radians(crown_deg)) * h)
        C.append(np.array([Gp[0] * s, Gp[1] * s, H]))
    sa = math.radians(star_deg)
    for k in range(m):
        planes.append(_facet(O, phis[k], crown_deg, g, True))                 # bezel
        a, b = C[k], C[(k + 1) % m]; tg = b - a
        mo = np.array([tg[1], -tg[0]]); mo /= np.linalg.norm(mo)
        if mo @ ((a + b)[:2] / 2) < 0: mo = -mo
        n = np.array([mo[0] * math.sin(sa), mo[1] * math.sin(sa), math.cos(sa)])
        planes.append((n, float(n @ a)))                                      # star, on the table edge
        for f in (0.25, 0.75):
            planes.append(_facet(O, az(k, f), uh_deg, g, True))               # upper halves
        pm = (0.0, 0.5) if split else (0.0,)     # split: mains between the mains too (16 under the table)
        for f in pm:
            planes.append(_facet(O, az(k, f), pav_deg, -g, False))            # pavilion main
            for q in (0.25, 0.75):
                planes.append(_facet(O, az(k, f + q / len(pm)), lh_deg, -g, False))   # lower halves
    return planes


def step(w=1.0, l=0.72, corner=0.2, crown_rings=((0.06, 46), (0.15, 34), (0.24, 22)),
         pav_rings=((0.12, 52), (0.30, 46), (0.50, 43)), keel_deg=41, girdle=0.02):
    """step cut on a cut-corner rectangle; each ring is (inward offset, angle), so every tier is cut at
    one angle all round and every facet lies between two parallel edges: an exact trapezoid"""
    c = corner
    V = [(w, l - c), (w - c, l), (-w + c, l), (-w, l - c), (-w, -l + c), (-w + c, -l), (w - c, -l), (w, -l + c)]
    E = []
    for i in range(8):
        a, b = np.array(V[i]), np.array(V[(i + 1) % 8]); tg = b - a
        u = np.array([tg[1], -tg[0]]); u /= np.linalg.norm(u)
        E.append((u if u @ (a + b) > 0 else -u, abs(float(u @ a))))
    planes = [(np.array([u[0], u[1], 0.0]), d) for u, d in E]

    def tier(d0, z0, ang, up):
        a = math.radians(ang)
        return [(np.array([math.sin(a) * u[0], math.sin(a) * u[1], math.cos(a) if up else -math.cos(a)]),
                 (d - d0) * math.sin(a) + (z0 if up else -z0) * math.cos(a)) for u, d in E]
    d0, z0 = 0.0, girdle
    for d1, ang in crown_rings:
        planes += tier(d0, z0, ang, True); z0 += (d1 - d0) * math.tan(math.radians(ang)); d0 = d1
    planes.append((np.array([0, 0, 1.0]), z0))
    d0, z0 = 0.0, -girdle
    for d1, ang in pav_rings:
        planes += tier(d0, z0, ang, False); z0 -= (d1 - d0) * math.tan(math.radians(ang)); d0 = d1
    return planes + tier(d0, z0, keel_deg, False)


def polytope(planes, eps=1e-6):
    """vertices and outward-wound faces of the intersection of the half-spaces n.x <= d"""
    from scipy.spatial import HalfspaceIntersection
    A = np.array([np.r_[n / np.linalg.norm(n), -d / np.linalg.norm(n)] for n, d in planes])
    V = []
    for p in HalfspaceIntersection(A, np.zeros(3)).intersections:
        if not any(np.linalg.norm(p - q) < 1e-7 for q in V): V.append(p)
    V = np.array(V); faces = []
    for row in A:
        n, d = row[:3], -row[3]; on = np.where(np.abs(V @ n - d) < eps)[0]
        if len(on) < 3: continue
        c = V[on].mean(0); e1 = V[on[0]] - c; e1 /= np.linalg.norm(e1); e2 = np.cross(n, e1)
        ring = [int(on[i]) for i in np.argsort([math.atan2((V[i] - c) @ e2, (V[i] - c) @ e1) for i in on])]
        if not any(set(ring) == set(f) for f in faces): faces.append(ring)
    return V, faces


# ---------------------------------------------------------------- the light: a jeweller's light tent
def environment():
    EW, EH = 2048, 1024
    u = (np.arange(EW) + 0.5) / EW; v = (np.arange(EH) + 0.5) / EH
    PHI, TH = np.meshgrid((u - 0.5) * 2 * np.pi, (v - 0.5) * np.pi)
    D = np.stack([-np.cos(PHI) * np.cos(TH), np.sin(PHI) * np.cos(TH), np.sin(TH)], -1)   # Blender's equirect
    Z = D[..., 2]
    def unit(*x): x = np.array(x, float); return x / np.linalg.norm(x)
    def angle(d): return np.degrees(np.arccos(np.clip(D @ unit(*d), -1, 1)))
    def cap(d, radius, soft): return 1 - smoothstep(radius - soft, radius + soft, angle(d))
    def glow(d, width): return np.exp(-0.5 * (angle(d) / width) ** 2)
    def box(d, w, h, soft):   # a rectangular soft box facing the stone, w x h degrees
        f = unit(*d); r = np.cross([0, 0, 1.0], f); r /= np.linalg.norm(r); t = np.cross(f, r)
        x = np.degrees(np.arctan2(D @ r, D @ f)); y = np.degrees(np.arctan2(D @ t, D @ f))
        return ((D @ f) > 0) * (1 - smoothstep(w / 2 - soft, w / 2 + soft, np.abs(x))) * (1 - smoothstep(h / 2 - soft, h / 2 + soft, np.abs(y)))
    sky = smoothstep(-0.12, 0.35, Z)
    layers = [((0.60, 0.67, 0.84), 0.42 * (1 - sky) * (0.25 + 0.75 * smoothstep(-0.97, -0.35, Z))),   # the page below, in the stone's own shade straight down
              ((0.86, 0.89, 0.98), 0.12 * sky),                               # tent walls
              ((1.0, 1.0, 1.0), 0.5 * smoothstep(0.55, 1.0, Z)),             # overhead diffuser
              ((1.0, 0.97, 0.93), 16.0 * box((-0.55, 0.35, 0.75), 34, 7, 1.2)),  # key strip
              ((0.92, 0.96, 1.04), 10.0 * box((0.813, -0.103, 0.52), 14, 22, 1.5)),  # fill box
              ((0.96, 0.98, 1.0), 8.0 * box((0.05, 0.95, 0.35), 50, 6, 1)),       # strip behind
              ((1.0, 0.70, 0.56), 1.6 * glow((-1.0, -0.25, 0.18), 24)),           # peach glow, left
              ((0.90, 0.76, 1.0), 1.1 * glow((0.85, 0.6, 0.12), 22))]             # lavender glow, right
    ring = np.zeros_like(Z)
    for i in range(12):                                                      # a ring of small soft boxes
        a = np.radians(30 * i + 20); el = np.radians(24 if i % 2 else 44)
        d = (np.cos(a) * np.cos(el), np.sin(a) * np.cos(el), np.sin(el))
        ring += (0.75 + 0.5 * ((i * 7) % 5) / 4) * box(d, 11, 8, 0.8) * (0.45 + 0.55 * glow(d, 4))
    layers.append(((0.97, 0.98, 1.0), 4.0 * ring))
    rng = np.random.default_rng(7); spark = np.zeros_like(Z)
    for i in range(28):                                                      # small hard lamps: sparkle, fire
        a = 2 * np.pi * i / 28 + rng.uniform(-0.1, 0.1); el = np.radians(rng.uniform(15, 68))
        spark += cap((np.cos(a) * np.cos(el), np.sin(a) * np.cos(el), np.sin(el)), 0.8, 0.3)
    layers.append(((1.0, 1.0, 1.0), 160.0 * spark))
    dark = 1 - 0.95 * cap((0, -2.6, 5.4), 17, 4)                             # the camera's own reflection
    for az in (20, 75, 125, 160, 200, 250, 290, 335):                        # black cards between the boxes
        a = np.radians(az); dark = dark * (1 - 0.96 * box((np.cos(a), np.sin(a), 0.3), 8, 60, 1.2))
    spec = [spectrum(c) for c, _ in layers]

    def group(g):
        img = np.zeros((EH, EW, 4), np.float32); img[..., 3] = 1
        for ch in range(3):
            img[..., ch] = sum(spec[i][3 * g + ch] * m for i, (_, m) in enumerate(layers)) * dark
        return img
    return EW, EH, group


# ---------------------------------------------------------------- render, combine, export
def render(out, size, spp):
    import bpy, addon_utils
    os.makedirs(out, exist_ok=True)
    EW, EH, env = environment()
    for st in STONES:
        bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
        sc = bpy.context.scene
        kind, shape, kw = st["cut"]
        V, F = polytope(brilliant(shape, **kw) if kind == "brilliant" else step(**kw))
        me = bpy.data.meshes.new(st["name"]); me.from_pydata([tuple(p) for p in V], [], F); me.update()
        o = bpy.data.objects.new(st["name"], me); sc.collection.objects.link(o); o.rotation_euler = (0, 0, math.radians(-18))
        mat = bpy.data.materials.new("g"); mat.use_nodes = True; nt = mat.node_tree; nt.nodes.clear()
        out_n = nt.nodes.new("ShaderNodeOutputMaterial"); gl = nt.nodes.new("ShaderNodeBsdfGlass")
        gl.inputs["Color"].default_value = (1, 1, 1, 1); gl.inputs["Roughness"].default_value = 0.0
        va = nt.nodes.new("ShaderNodeVolumeAbsorption")
        nt.links.new(gl.outputs[0], out_n.inputs["Surface"]); nt.links.new(va.outputs[0], out_n.inputs["Volume"])
        o.data.materials.append(mat)
        w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
        bg = w.node_tree.nodes["Background"]; et = w.node_tree.nodes.new("ShaderNodeTexEnvironment")
        w.node_tree.links.new(et.outputs[0], bg.inputs[0])
        img = bpy.data.images.new("env", EW, EH, alpha=True, float_buffer=True); img.colorspace_settings.name = "Non-Color"
        et.image = img
        cd = bpy.data.cameras.new("c"); cd.type = "ORTHO"; cd.ortho_scale = 2.35
        cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
        cam.location = (0, -2.6, 5.4); cam.rotation_euler = (math.radians(26), 0, 0)
        sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = spp
        cy.use_denoising = False; cy.use_adaptive_sampling = False; cy.seed = 0   # same paths in every pass
        cy.max_bounces = 48; cy.transmission_bounces = 40; cy.glossy_bounces = 40; cy.diffuse_bounces = 0
        cy.volume_bounces = 0; cy.caustics_reflective = False; cy.caustics_refractive = False
        cy.sample_clamp_direct = 0; cy.sample_clamp_indirect = 0
        sc.render.film_transparent = True; cy.film_transparent_glass = False
        sc.render.resolution_x = sc.render.resolution_y = size
        sc.view_settings.view_transform = "Standard"
        ims = sc.render.image_settings; ims.file_format = "OPEN_EXR"; ims.color_depth = "32"; ims.color_mode = "RGBA"; ims.exr_codec = "ZIP"
        sig = st["sigma"](CENTRES)
        for g in range(GROUPS):
            sg = sig[3 * g:3 * g + 3]; dens = float(max(sg.max(), 1e-4))
            gl.inputs["IOR"].default_value = float(ior(st["nd"], st["disp"], CENTRES[3 * g:3 * g + 3].mean()))
            va.inputs["Color"].default_value = (*(1 - sg / dens), 1); va.inputs["Density"].default_value = dens
            img.pixels.foreach_set(env(g).ravel())
            sc.render.filepath = f"{out}/{st['name']}_p{g}.exr"
            t = time.time(); bpy.ops.render.render(write_still=True)
            print(f"{st['name']} pass {g}: {time.time() - t:.1f}s", flush=True)


def combine(out, exposure):
    import bpy
    from PIL import Image
    def load(path):
        im = bpy.data.images.load(path); w, h = im.size
        a = np.empty(w * h * 4, np.float32); im.pixels.foreach_get(a); bpy.data.images.remove(im)
        return a.reshape(h, w, 4)[::-1]
    for st in STONES:
        P = [load(f"{out}/{st['name']}_p{g}.exr") for g in range(GROUPS)]
        alpha = P[0][..., 3]
        rgb = (np.concatenate([p[..., :3] for p in P], -1) @ W) / np.maximum(alpha, 1e-4)[..., None]
        px = np.concatenate([srgb(tonemap(rgb, exposure)), alpha[..., None]], -1)
        Image.fromarray((np.clip(px, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA").save(f"{out}/{st['name']}.png")
        print(st["name"], "combined")


def export(out, assets):
    """trim to the stone, centre it in a square and reduce in premultiplied linear light"""
    from PIL import Image
    def lin(x): return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)
    for k, st in enumerate(STONES):
        im = np.asarray(Image.open(f"{out}/{st['name']}.png").convert("RGBA")).astype(np.float32) / 255
        ys, xs = np.where(im[..., 3] > 0.02)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        side = int(round(max(x1 - x0, y1 - y0) / 0.97)); h, w = im.shape[:2]
        ox, oy = int(round(side / 2 - (x0 + x1) / 2)), int(round(side / 2 - (y0 + y1) / 2))
        sq = np.zeros((side, side, 4), np.float32)
        sx0, sy0, sx1, sy1 = max(0, -ox), max(0, -oy), min(w, side - ox), min(h, side - oy)
        sq[sy0 + oy:sy1 + oy, sx0 + ox:sx1 + ox] = im[sy0:sy1, sx0:sx1]
        pm = np.concatenate([lin(sq[..., :3]) * sq[..., 3:], sq[..., 3:]], -1)
        name = f"domain-{st['name']}" if DOMAIN_SET else f"gem-{k}"
        for size, suffix in ((96, ""),) if DOMAIN_SET else ((96, ""), (192, "-2x")):   # the map shows its stones small
            r = np.stack([np.array(Image.fromarray(np.ascontiguousarray(pm[..., c]), "F").resize((size, size), Image.LANCZOS)) for c in range(4)], -1)
            al = np.clip(r[..., 3:], 0, 1); rgb = np.where(al > 1e-5, np.clip(r[..., :3], 0, None) / np.maximum(al, 1e-5), 0)
            px = np.concatenate([srgb(rgb), al], -1)
            Image.fromarray((px * 255 + 0.5).astype(np.uint8), "RGBA").save(f"{assets}/{name}{suffix}.webp", quality=92, method=6)
        print(st["name"], "->", name)


if __name__ == "__main__":
    cmd, a = sys.argv[1], sys.argv[2:]
    if cmd == "render": render(os.path.abspath(a[0]), int(a[1]) if len(a) > 1 else 576, int(a[2]) if len(a) > 2 else 256)
    elif cmd == "combine": combine(os.path.abspath(a[0]), float(a[1]) if len(a) > 1 else 1.0)
    elif cmd == "export": export(os.path.abspath(a[0]), os.path.abspath(a[1]))
    else: raise SystemExit(__doc__ or "usage: gems.py render|combine|export ...")
