# Animatic driver: kit.render() loads this when ANIM is set, calls setup() once, then drive(f) for each frame.
# The scene script that built the scene is __main__, so its globals (path, segs, d, nrm ...) are read from there.
import math, os, sys
import bpy
from mathutils import Vector

M = sys.modules["__main__"]
MM = 0.001
FPS = float(os.environ.get("FPS", "12"))
SHOT = os.environ["SHOTID"]
O = bpy.data.objects
sc = bpy.context.scene


def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def smooth(x): x = clamp(x); return x * x * (3 - 2 * x)
def smoother(x): x = clamp(x); return x * x * x * (x * (6 * x - 15) + 10)
def lerp(a, b, u): return Vector(a).lerp(Vector(b), u)


def set_cam(loc, tgt, focus=None, lens=None):
    cam, ct = O["cam"], O["ct"]
    cam.location = Vector(loc); ct.location = Vector(tgt)
    if lens: cam.data.lens = lens
    if cam.data.dof.use_dof:
        cam.data.dof.focus_distance = (Vector(loc) - Vector(focus if focus is not None else tgt)).length


class Track:
    """Arc-length sampler for a polyline given in mm."""
    def __init__(self, pts):
        self.p = [Vector(q) for q in pts]; self.s = [0.0]
        for a, b in zip(self.p, self.p[1:]): self.s.append(self.s[-1] + (b - a).length)
        self.L = self.s[-1]

    def at(self, s):
        s = clamp(s, 0, self.L); lo, hi = 0, len(self.s) - 1
        while hi - lo > 1:
            m = (lo + hi) // 2
            if self.s[m] <= s: lo = m
            else: hi = m
        seg = self.s[hi] - self.s[lo]; u = 0 if seg == 0 else (s - self.s[lo]) / seg
        return self.p[lo].lerp(self.p[hi], u)


def seglen(n):
    """arc length (mm) of the run path up to the end of segment n"""
    k = sum(len(s) - 1 for s in M.segs[:n + 1]); return TR.s[k]


def roll(ball, prev, cur):
    # spin the marble about the axis perpendicular to its motion (clear glass, but keeps refractions alive)
    dv = cur - prev
    if dv.length > 1e-6:
        ax = Vector((0, 0, 1)).cross(dv).normalized(); ang = dv.length / M.R
        ball.rotation_mode = "XYZ"
        from mathutils import Matrix
        ball.matrix_world = Matrix.Translation(cur * MM) @ (Matrix.Rotation(ang, 4, ax) @ ball.matrix_world.to_3x3().to_4x4())


def setup():
    global TR, STATE
    STATE = {}
    if SHOT in ("S4", "S5", "S6", "S9"):
        pts = list(M.path)
        end = pts[-1]; cup = Vector((M.CUPX, M.CUPY, 6 + M.R))
        for i in range(1, 9):                     # short fall into the cup
            u = i / 8; pts.append(Vector((end.x + (cup.x - end.x) * u, end.y + (cup.y - end.y) * u, end.z + (cup.z - end.z) * u * u)))
        TR = Track(pts)
    if SHOT == "S3":
        beads = [o for o in O if o.name.startswith("Sphere")]
        b = min(beads, key=lambda o: o.location.y); STATE["bead"] = b; STATE["b0"] = b.location.copy()
    if SHOT == "S8":
        STATE["g0"] = {g: O["gate%d" % g].location.copy() for g in range(5)}
    STATE["ball_prev"] = None


def ball_to(p_mm):
    b = O["ball"]; prev = STATE["ball_prev"]
    if prev is not None: roll(b, prev, p_mm)
    else: b.location = p_mm * MM
    STATE["ball_prev"] = p_mm.copy()


def drive(f):
    t = f / FPS
    if SHOT == "S1":                                 # ink vortex, 2 s
        u = t / 2.0
        tor = O["Torus"]; tor.rotation_euler.z = 0.55 * u; tor.location.z = (88 - 7 * u) * MM
        O["Cone"].rotation_euler.z = 0.3 * u
        c0, t0 = Vector((-0.06, -0.34, 0.19)), Vector((0, 0, 0.085))
        set_cam(lerp(c0, t0, 0.10 * u), t0, focus=(0, -0.03, 0.088 - 0.007 * u))
    elif SHOT == "S2":                               # manuscripts, 2 s slide
        u = smooth(t / 2.0) * 0.6 + 0.4 * (t / 2.0)
        set_cam(lerp((-0.19, -0.49, 0.225), (-0.12, -0.47, 0.205), u), lerp((-0.02, 0, 0.05), (0.02, 0, 0.045), u), focus=(-0.03, -0.06, 0.046))
    elif SHOT == "S3":                               # unit distances: slow orbit, one bead lifted away
        c0, t0 = Vector((-0.07, -0.25, 0.12)), Vector((0, 0.01, 0.004))
        a = math.radians(-6 + 12 * t / 6.0); rel = c0 - t0
        rel = Vector((rel.x * math.cos(a) - rel.y * math.sin(a), rel.x * math.sin(a) + rel.y * math.cos(a), rel.z)) * (1 - 0.06 * t / 6)
        b = STATE["bead"]; u = clamp((t - 2.4) / 2.2)
        e = u * u * (3 - 2 * u)
        b.location = STATE["b0"] + Vector((0.035 * e * e, -0.01 * e, 0.16 * e * e))
        set_cam(t0 + rel, t0, focus=(STATE["b0"].x, STATE["b0"].y, 0.009))
    elif SHOT == "S4":                               # the student's run: past a1, a2, a3 (8 s)
        L = seglen(6) - 4; T = 8.0; v = L / (T - 0.3)
        s = v * t * t / 1.2 if t < 0.6 else v * (t - 0.3)
        p = TR.at(s); ball_to(p)
        # camera follows a smoothed point ahead of the marble
        cs = sum((TR.at(s + k * 6) for k in range(-12, 13)), Vector()) / 25
        cam = cs * MM + Vector((-0.012, -0.150, 0.004)); tg = cs * MM + Vector((0.006, 0, -0.0065))
        set_cam(cam, tg, focus=p * MM - Vector((0, 0.003, 0.006)), lens=55)
    elif SHOT == "S5":                               # helix, drop into the cup, ding at 2.7 s; slow push
        s0 = seglen(6) - 4; L = TR.L
        sh = seglen(8)                                  # end of the rail; then the fall
        if t < 2.4: s = s0 + (sh - s0) * (t / 2.4) ** 1.08
        else: s = sh + (L - sh) * clamp((t - 2.4) / 0.3)
        ball_to(TR.at(s))
        u = smoother(t / 8.0)
        set_cam(lerp((-0.175, -0.33, 0.17), (-0.150, -0.235, 0.085), u), lerp((-0.075, -0.04, 0.075), (-0.080, -0.045, 0.030), u),
                focus=lerp((-0.075, -0.035, 0.08), (-0.118, -0.06, 0.02), u), lens=50)
    elif SHOT == "S6":                               # pull back: only three levels, then nothing
        ball_to(TR.at(TR.L))
        u = smoother((t - 0.3) / 5.0)
        set_cam(lerp((-0.150, -0.235, 0.085), (-0.22, -0.95, 0.20), u), lerp((-0.080, -0.045, 0.030), (0, 0, 0.14), u),
                focus=lerp((-0.118, -0.06, 0.02), (-0.03, -0.03, 0.15), u), lens=50)
    elif SHOT == "S7":                               # identical modules, each hands the marble on (8 s)
        d, nrm = M.d, M.nrm
        pts = []
        for k in range(9):
            P = d * (k * 80.0 - 300) + Vector((0, 0, 62 - 3.6 * k)); Q = P + d * 70.0 - Vector((0, 0, 2.6))
            pts += [P, Q]
        tr = STATE.setdefault("tr", Track(pts))
        s = 8 + 62.0 * t
        p = tr.at(s); ball_to(p)
        m = tr.at(s + 10) * MM
        BACK, SIDE, UP, AHEAD, TDZ = 0.2, 0.09, 0.07, 0.18, 0.03
        cl = m - d * BACK - nrm * SIDE + Vector((0, 0, UP)); tg = m + d * AHEAD - Vector((0, 0, TDZ))
        set_cam(cl, tg, focus=p * MM, lens=40)
    elif SHOT == "S8":                               # five gates drop, marble passes, needles swing (10 s)
        GX = [-240.0, -120.0, 0.0, 120.0, 240.0]
        for g in range(5):
            u = clamp((t - 0.2 - 0.28 * g) / 0.55)
            dz = 0.08 * (1 - u) ** 3 if u < 1 else 0.0
            if 0 < u < 1: dz -= 0.002 * math.sin(math.pi * u) * u
            O["gate%d" % g].location = STATE["g0"][g] + Vector((0, 0, dz))
        GZ = M.GZ; a_ = 75 / 1.2
        x = -320.0 if t < 1.0 else (-320 + 0.5 * a_ * (t - 1.0) ** 2 if t < 2.2 else -275 + 75 * (t - 2.2))
        p = Vector((x, 0, GZ(x))); ball_to(p)
        for g in range(5):
            tp = 2.2 + (GX[g] + 275) / 75
            dt = t - tp; nd = O["needle%d" % g]
            nd.rotation_euler.y = (0.45 * math.exp(-dt * 1.3) * math.sin(2 * math.pi * 1.1 * dt)) if dt > 0 else 0.0
        wide_c, wide_t = Vector((0.0, -0.80, 0.21)), Vector((0.0, 0.0, 0.045))
        tc = p * MM + Vector((-0.035, -0.205, 0.052)); tt = p * MM + Vector((0.040, 0.0, 0.026))
        w = smoother((t - 1.4) / 1.8)
        set_cam(wide_c.lerp(tc, w), wide_t.lerp(tt, w), focus=lerp((0, 0, 0.04), p * MM + Vector((0.01, -0.017, 0.02)), w), lens=40)
    elif SHOT == "S9":                               # rows of runs; another marble, camera rises (5 s)
        s = 150.0 * t; ball_to(TR.at(s))
        u = smoother(t / 5.0)
        c = lerp((-0.22, -0.95, 0.20), (-0.75, -1.75, 1.05), u); g = lerp((0, 0, 0.14), (0.15, 0.55, 0.02), u)
        set_cam(c, g, focus=lerp((0, 0, 0.14), (0.0, 0.3, 0.1), u))
