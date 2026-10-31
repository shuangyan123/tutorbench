# Promo direction A, "答对了，路走错了": a rolling-ball sculpture. Two brass wire rails carry a glass
# marble down a long, doubling-back route; the brass tags on the turns read "3 + 4 = 7" and "+ 5", and
# the marble ends in the cup marked "12" (the student's reasoning in public case
# correct-answer-wrong-reasoning-001). Second still: the right reasoning, three groups of four.
# usage: python a_marble.py SHOT OUT.png [W H SPP]   SHOT = run | groups
import math, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *
import tex

a = sys.argv[1:]; SHOT = a[0]; OUT = os.path.abspath(a[1])
W = int(a[2]) if len(a) > 2 else 1280; H = int(a[3]) if len(a) > 3 else 720; SPP = int(a[4]) if len(a) > 4 else 128
TEX = os.path.join(os.path.dirname(OUT), "tex_a"); os.makedirs(TEX, exist_ok=True)
reset()

R, RW, S = 8.0, 1.35, 11.0                       # marble radius, rail wire radius, rail spacing (mm)
HB = math.sqrt((R + RW) ** 2 - (S / 2) ** 2)    # marble centre above the rail centre line

# ---------------------------------------------------------------- the route (ball-centre path, mm)
def line(p, q, n=None):
    p, q = Vector(p), Vector(q); n = n or max(2, int((q - p).length / 2))
    return [p.lerp(q, i / n) for i in range(n + 1)]

def turn(cx, cy, r, a0, a1, z0, z1, n=60):
    return [Vector((cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n)), z0 + (z1 - z0) * i / n)) for i in range(n + 1)]

def smooth_drop(p, q, n=40):
    p, q = Vector(p), Vector(q)
    return [Vector((p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t, p.z + (q.z - p.z) * (t * t))) for t in (i / n for i in range(n + 1))]

segs = [line((-150, 35, 290), (115, 35, 258)), turn(115, 0, 35, 90, -90, 258, 250),
        line((115, -35, 250), (-115, -35, 218)), turn(-115, 0, 35, -90, -270, 218, 210),
        line((-115, 35, 210), (115, 35, 178)), turn(115, 0, 35, 90, -90, 178, 170),
        line((115, -35, 170), (-30, -35, 128)), turn(-62, -35, 32, 0, 540, 128, 70, n=220),
        smooth_drop((-94, -35, 70), (-114, -35, 56), n=20)]
path = []
for s in segs:
    path += s if not path else s[1:]

def frame(i):
    t = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
    n = t.cross(Vector((0, 0, 1))).normalized()
    return t, n

rails = [[], []]
for i, c in enumerate(path):
    t, n = frame(i)
    for k, sgn in enumerate((-1, 1)):
        p = c - Vector((0, 0, HB)) + n * (S / 2) * sgn
        rails[k].append(tuple(v * MM for v in p))

brass, bp = principled("brass", hexc(env("BRASS", "#cf9f52")), fenv("BR", 0.2), Metallic=1.0)
noise_bump(brass, bp, scale=4000, strength=0.04)
poly_curve("rails", rails, RW * MM, brass, bevel_res=3)

# cross ties and posts
ties, posts = [], []
acc = 0.0; nxt = 6.0
for i in range(1, len(path)):
    acc += (path[i] - path[i - 1]).length
    if acc >= nxt and i < len(path) - 6:
        nxt += 46.0
        t, n = frame(i); c = path[i] - Vector((0, 0, HB))
        l, r = c - n * (S / 2), c + n * (S / 2); b = c - Vector((0, 0, 3.2))
        ties.append([tuple(v * MM for v in l), tuple(v * MM for v in (l + b) / 2 - Vector((0, 0, 1.5))), tuple(v * MM for v in b),
                     tuple(v * MM for v in (r + b) / 2 - Vector((0, 0, 1.5))), tuple(v * MM for v in r)])
        if len(posts) % 2 == 0 or True:
            posts.append([tuple(v * MM for v in b), (b.x * MM, b.y * MM, 0.0)])
poly_curve("ties", ties, 1.1 * MM, brass, bevel_res=2)
# only posts that do not pass through a lower level of track
def clear(p):
    x, y = p[0][0] / MM, p[0][1] / MM; ztop = p[0][2] / MM
    for c in path:
        if abs(c.x - x) < 9 and abs(c.y - y) < 9 and c.z < ztop - 15: return False
    return True
posts = [p for p in posts if clear(p)]
poly_curve("posts", posts[::2], 1.9 * MM, brass, bevel_res=2)

# start gate: a small brass cradle at the top
poly_curve("gate", [[(-156 * MM, 30 * MM, (290 - HB) * MM), (-158 * MM, 35 * MM, (290 - HB + 9) * MM), (-156 * MM, 40 * MM, (290 - HB) * MM)]], 1.0 * MM, brass)

# ---------------------------------------------------------------- the plinth and the cup
PL = (400, 170, 34)
paint, pp = principled("plinth paint", hexc(env("PLINTH", "#aebbd8")), 0.62)
noise_bump(paint, pp, scale=900, strength=0.05)
box("plinth", (PL[0] * MM, PL[1] * MM, PL[2] * MM), (0, 0, -PL[2] / 2 * MM), paint, bevel=1.2 * MM)

def lathe(name, prof, mat, seg=96):
    bm = bmesh.new()
    rings = [[bm.verts.new((r * MM * math.cos(2 * math.pi * k / seg), r * MM * math.sin(2 * math.pi * k / seg), z * MM)) for k in range(seg)] for r, z in prof]
    for A, B in zip(rings, rings[1:]):
        for k in range(seg): bm.faces.new((A[k], A[(k + 1) % seg], B[(k + 1) % seg], B[k]))
    o = finish_bm(bm, name, True); o.data.materials.append(mat); return o

CUPX, CUPY = -122, -35
cup = lathe("cup", [(0.1, 0), (17, 0), (18, 1), (18, 3), (15.5, 4.5), (15, 30), (17, 46), (17.6, 48), (16.4, 48.4), (15.6, 46.5), (14, 31), (13.6, 6), (0.1, 6)], brass)
cup.location = (CUPX * MM, CUPY * MM, 0)

# engraved plates: "12" in front of the cup, tags on the turns
def plate(name, mask, size, loc, rot_z=0.0, tilt=0.0):
    w, h = size
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0)); o = bpy.context.object; o.name = name
    o.scale = (w * MM, h * MM, 1); bpy.ops.object.transform_apply(scale=True)
    o.rotation_euler = (math.radians(90 + tilt), 0, rot_z); o.location = loc
    sol = o.modifiers.new("s", "SOLIDIFY"); sol.thickness = 0.8 * MM
    bv = o.modifiers.new("b", "BEVEL"); bv.width = 0.25 * MM; bv.segments = 2
    m, p = principled(name + "m", hexc("#d9b26a"), 0.3, Metallic=1.0)
    t = m.node_tree; n = t.nodes
    img = n.new("ShaderNodeTexImage"); img.image = bpy.data.images.load(mask); img.image.colorspace_settings.name = "Non-Color"; img.interpolation = "Cubic"
    mx = n.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.inputs[6].default_value = (*hexc("#d9b26a"), 1); mx.inputs[7].default_value = (0.05, 0.035, 0.02, 1)
    t.links.new(img.outputs["Color"], mx.inputs[0]); t.links.new(mx.outputs[2], p.inputs["Base Color"])
    mr = n.new("ShaderNodeMapRange"); mr.inputs["To Min"].default_value = 1.0; mr.inputs["To Max"].default_value = 0.2
    t.links.new(img.outputs["Color"], mr.inputs["Value"]); t.links.new(mr.outputs["Result"], p.inputs["Metallic"])
    rr = n.new("ShaderNodeMapRange"); rr.inputs["To Min"].default_value = 0.28; rr.inputs["To Max"].default_value = 0.7
    t.links.new(img.outputs["Color"], rr.inputs["Value"]); t.links.new(rr.outputs["Result"], p.inputs["Roughness"])
    bmp = n.new("ShaderNodeBump"); bmp.invert = True; bmp.inputs["Strength"].default_value = 0.6; bmp.inputs["Distance"].default_value = 0.0002
    t.links.new(img.outputs["Color"], bmp.inputs["Height"]); t.links.new(bmp.outputs[0], p.inputs["Normal"])
    o.data.materials.append(m); return o

R_ = tex.engrave_rich
R_(os.path.join(TEX, "t1.png"), 960, 400, [("a", "n"), ("1", "sub"), (" = 1", "n")], 210)
R_(os.path.join(TEX, "t2.png"), 960, 400, [("a", "n"), ("2", "sub"), (" = 3", "n")], 210)
R_(os.path.join(TEX, "t4.png"), 960, 400, [("a", "n"), ("3", "sub"), (" = 7", "n")], 210)
R_(os.path.join(TEX, "t3.png"), 1400, 400, [("a", "n"), ("n", "sub"), (" = 2", "n"), ("n", "sup"), (" − 1", "n")], 230)
def rail_z(seg, x):
    c = [q for q in segs[seg]]; best = min(c, key=lambda q: abs(q.x - x)); return best.z - HB
for name, mask, w_, seg, x, fy in (("tag1", "t1.png", 34, 2, -20, -40.5), ("tag2", "t2.png", 34, 4, 55, 29.5), ("tag4", "t4.png", 34, 6, 40, -40.5)):
    rz = rail_z(seg, x)
    plate(name, os.path.join(TEX, mask), (w_, 14), (x * MM, (fy - 2) * MM, (rz - 16) * MM))
    poly_curve(name + "hang", [[((x - w_ / 2 + 4) * MM, (fy - 1.5) * MM, (rz - 9.2) * MM), ((x - w_ / 2 + 4) * MM, (fy - 0.3) * MM, (rz - 0.6) * MM)],
                              [((x + w_ / 2 - 4) * MM, (fy - 1.5) * MM, (rz - 9.2) * MM), ((x + w_ / 2 - 4) * MM, (fy - 0.3) * MM, (rz - 0.6) * MM)]], 0.45 * MM, brass)
plate("tag3", os.path.join(TEX, "t3.png"), (46, 13), (CUPX * MM + 6 * MM, (CUPY - 28) * MM, 8 * MM), tilt=-22)
box("tag3foot", (44 * MM, 8 * MM, 1.2 * MM), (CUPX * MM + 6 * MM, (CUPY - 24) * MM, 0.6 * MM), brass, bevel=0.3 * MM)

# ---------------------------------------------------------------- the marble: clear glass with a violet cat's-eye vane
def marble(name, loc, rot=0.0, vane_col="#6f58c9", scale=1.0):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=R * MM * scale, location=loc, segments=96, ring_count=48); o = bpy.context.object; o.name = name
    for pz in o.data.polygons: pz.use_smooth = True
    o.data.materials.append(MARBLE)
    if not int(env("VANE", "0")): return o
    # vanes: three thin twisted petals through the centre
    bm = bmesh.new(); nu, nv = 48, 16
    for k in range(3):
        base = k * math.pi / 3 + rot
        verts = []
        for i in range(nu + 1):
            u = -1 + 2 * i / nu; row = []
            for j in range(nv + 1):
                v = j / nv
                rr = (R - 1.6) * math.sqrt(max(0.0, 1 - u * u)) * v * 0.62
                ang = base + 0.9 * u
                row.append(bm.verts.new((rr * math.cos(ang) * MM * scale, rr * math.sin(ang) * MM * scale, u * (R - 1.6) * MM * scale)))
            verts.append(row)
        for i in range(nu):
            for j in range(nv): bm.faces.new((verts[i][j], verts[i + 1][j], verts[i + 1][j + 1], verts[i][j + 1]))
    vo = finish_bm(bm, name + "vane", True); vo.location = loc; vo.rotation_euler = (math.radians(70), math.radians(20), rot)
    sol = vo.modifiers.new("s", "SOLIDIFY"); sol.thickness = 0.2 * MM
    vm, vp = principled("vane" + name, hexc(vane_col), 0.15, **{"Transmission Weight": 0.85, "IOR": 1.5})
    vo.data.materials.append(vm)
    return o

MARBLE = glass("marble glass", (1, 1, 1), 1.52, 0.0, absorb=tuple(vec("MABS", "0.80,0.78,1.0")), dens=fenv("MDENS", 30))

world(hexc("#c9d3ea"), 0.35)
bg, bgm, bgp = sweep("sweep", hexc(env("BG", "#c6d1ea")), width=3.0, depth=2.2, height=1.6, radius=0.45, z0=-0.034, y_back=0.55)

if SHOT == "run":
    # the marble halfway along the second ramp
    i = len(segs[0]) + len(segs[1]) + int(len(segs[2]) * 0.40)
    marble("ball", tuple(v * MM for v in path[i]), rot=0.7)
    # lighting: broad soft key high left, peach rim behind right, cool fill right, glow on the wall
    area((-0.55, -0.45, 0.75), (0, 0, 0.12), fenv("KEY", 160), size=0.9, size_y=0.6, col=(1.0, 0.97, 0.93), spread=fenv("SPREAD", 70))
    area((0.65, -0.35, 0.25), (0, 0, 0.12), fenv("FILL", 25), size=0.8, col=(0.86, 0.9, 1.0))
    spot((0.45, 0.55, 0.55), (0, 0, 0.18), fenv("RIM", 220), cone=30, blend=0.7, radius=0.05, col=(1.0, 0.85, 0.74))
    area((0.25, 0.25, 0.35), (0.35, 0.55, 0.5), fenv("GLOW", 40), size=0.5, col=(1.0, 0.72, 0.78))
    focus = path[i]
    camera(tuple(vec("CAM", "-0.30,-0.62,0.34")), tuple(vec("TGT", "0.0,0.0,0.155")), lens=fenv("LENS", 50), fstop=fenv("FSTOP", 4.0), focus=tuple(v * MM for v in focus))
if SHOT == "groups":
    # the right reasoning: three groups of four, in a brass tray beside the cup
    for o in list(bpy.data.objects):
        if o.name.startswith(("rails", "ties", "posts", "gate", "tag1", "tag2")): bpy.data.objects.remove(o)
    TX, TY = 10, -40
    box("traybase", (132 * MM, 108 * MM, 2.5 * MM), (TX * MM, TY * MM, 1.25 * MM), brass, bevel=0.6 * MM)
    for sx, sy, w_, d_ in ((0, 1, 132, 3), (0, -1, 132, 3), (1, 0, 3, 108), (-1, 0, 3, 108)):
        box("rim", (w_ * MM, d_ * MM, 7 * MM), ((TX + sx * 64.5) * MM, (TY + sy * 52.5) * MM, 3.5 * MM), brass, bevel=0.8 * MM)
    # dark felt in the tray so the marbles read
    felt, fp = principled("felt", hexc("#3b3f62"), 0.95); fp.inputs["Sheen Weight"].default_value = 0.5
    box("felt", (126 * MM, 102 * MM, 1.0 * MM), (TX * MM, TY * MM, 2.6 * MM), felt)
    for dy in (-16, 16):
        box("divider", (126 * MM, 1.6 * MM, 5 * MM), (TX * MM, (TY + dy) * MM, 2.5 * MM), brass, bevel=0.5 * MM)
    cols = ["#6f58c9", "#3d7bd6", "#8a62d6"]
    k = 0
    for row in range(3):
        for c in range(4):
            x = TX + (c - 1.5) * 22
            y = TY + (row - 1) * 32
            marble("m%d" % k, (x * MM, y * MM, (3.1 + R) * MM), rot=0.4 * k + row, vane_col=cols[row]); k += 1
    tex.card(os.path.join(TEX, "card.png"), 900, 560, [
        ("3 × 4", "Cormorant.ttf", 150, 70, 40, (34, 32, 52), 600),
        ("3 组，每组 4 个", "LXGW.ttf", 92, 70, 250, (52, 44, 110)),
        ("three groups of four", "Cormorant.ttf", 64, 72, 400, (70, 66, 96), 600)], bg=(244, 245, 249))
    cm, cp, ci = image_mat("card", os.path.join(TEX, "card.png"), rough=0.8)
    bpy.ops.mesh.primitive_plane_add(size=1); cardo = bpy.context.object
    cardo.scale = (90 * MM, 56 * MM, 1); bpy.ops.object.transform_apply(scale=True)
    cardo.location = (125 * MM, -62 * MM, 0.3 * MM); cardo.rotation_euler = (0, 0, math.radians(8)); cardo.data.materials.append(cm)
    area((-0.5, -0.35, 0.7), (0, -0.04, 0), fenv("KEY", 140), size=0.9, size_y=0.6, col=(1.0, 0.97, 0.93))
    area((0.6, -0.3, 0.3), (0, -0.04, 0), fenv("FILL", 20), size=0.8, col=(0.86, 0.9, 1.0))
    spot((0.3, 0.5, 0.35), (0.0, -0.04, 0.0), fenv("RIM", 160), cone=30, blend=0.7, radius=0.05, col=(1.0, 0.85, 0.74))
    camera(tuple(vec("CAM", "-0.03,-0.36,0.19")), tuple(vec("TGT", "0.05,-0.03,0.0")), lens=fenv("LENS", 60), fstop=fenv("FSTOP", 5.6), focus=(TX * MM, TY * MM, 0.01))

if SHOT == "steps":
    # the right path: one short ramp that always hands the marble to the next, receding without end
    for o in list(bpy.data.objects):
        if o.type in ("MESH", "CURVE") and o.name != "sweep": bpy.data.objects.remove(o)
    ang = math.atan2(1.0, 0.32); d = Vector((math.cos(ang), math.sin(ang), 0)); nrm = Vector((-d.y, d.x, 0))
    paint2, pp2 = principled("plinth paint", hexc(env("PLINTH", "#aebbd8")), 0.62); noise_bump(paint2, pp2, scale=900, strength=0.05)
    slab = box("slab", (170 * MM, 1700 * MM, 34 * MM), (0, 0, -17 * MM), paint2, bevel=1.2 * MM)
    slab.rotation_euler = (0, 0, ang - math.pi / 2); slab.location = tuple((d * 0.78 * 1).to_tuple())
    slab.location = (d.x * 0.06, d.y * 0.06, -0.017); slab.scale = (1, 0.6, 1)
    rl, ti, po = [[], []], [], []
    labels = ["1", "2", "3", "", "k", "k+1", "", "", "", "", "", "", "", ""]
    for k in range(10):
        z0 = 62 - 3.6 * k; P = d * (k * 80.0 - 300) + Vector((0, 0, z0)); Q = P + d * 70.0 - Vector((0, 0, 2.6))
        for j, sg in enumerate((-1, 1)):
            off = nrm * (S / 2) * sg - Vector((0, 0, HB))
            pts = [P + off + Vector((0, 0, 1.6)) - d * 3, P + off, Q + off, Q + off + d * 2 + Vector((0, 0, -0.6))]
            rl[j].append([tuple(v * MM) for v in pts])
        for f in (0.2, 0.8):
            c = P.lerp(Q, f) - Vector((0, 0, HB)); l_, r_ = c - nrm * (S / 2), c + nrm * (S / 2); b_ = c - Vector((0, 0, 3.2))
            ti.append([tuple(v * MM) for v in (l_, b_, r_)])
        c = P.lerp(Q, 0.5) - Vector((0, 0, HB + 3.2)); po.append([tuple(c * MM), (c.x * MM, c.y * MM, 0.0)])
        if labels[k]:
            segs_ = [("k", "n"), ("+1", "sub")] if labels[k] == "k+1" else [(labels[k], "n")]
            tex.engrave_rich(os.path.join(TEX, "s%d.png" % k), 640, 400, segs_, 230)
            pl_ = plate("lab%d" % k, os.path.join(TEX, "s%d.png" % k), (16, 10), (0, 0, 0))
            pl_.rotation_euler = (math.radians(90), 0, ang - math.pi / 2)
            pl_.location = tuple(((c - nrm * 0 + Vector((0, 0, -(c.z - 22)))) * MM).to_tuple())
            lp = c - nrm * 13 - d * 2; pl_.location = (lp.x * MM, lp.y * MM, (c.z - 12) * MM)
            poly_curve("arm%d" % k, [[tuple((c - Vector((0, 0, 9))) * MM), tuple((lp + Vector((0, 0, -9)) + nrm * 5) * MM)]], 0.6 * MM, brass)
    poly_curve("rails", rl[0] + rl[1], RW * MM, brass, bevel_res=3)
    poly_curve("ties", ti, 1.1 * MM, brass, bevel_res=2)
    poly_curve("posts", po, 1.9 * MM, brass, bevel_res=2)
    m0 = d * (30 - 300) + Vector((0, 0, 62 - 30 * 2.6 / 74))
    marble("ball", tuple(m0 * MM), rot=0.4)
    tex.card(os.path.join(TEX, "hint.png"), 1000, 620, [
        ("前三项都对，", "LXGW.ttf", 92, 70, 60, (52, 44, 110)),
        ("那第 100 项呢？", "LXGW.ttf", 92, 70, 200, (52, 44, 110)),
        ("如果第 k 项成立，", "LXGW.ttf", 80, 70, 360, (70, 64, 120)),
        ("第 k+1 项也成立吗？", "LXGW.ttf", 80, 70, 470, (70, 64, 120))], bg=(244, 245, 249))
    cm, cp, ci = image_mat("hintcard", os.path.join(TEX, "hint.png"), rough=0.8)
    bpy.ops.mesh.primitive_plane_add(size=1); hc = bpy.context.object
    hc.scale = (80 * MM, 49.6 * MM, 1); bpy.ops.object.transform_apply(scale=True)
    hp = m0 * MM - nrm * 0.075 + d * 0.06; hc.location = (hp.x, hp.y, 0.3 * MM); hc.rotation_euler = (0, 0, ang - math.pi / 2 + math.radians(8)); hc.data.materials.append(cm)
    area((-0.6, -0.3, 0.7), (0.1, 0.3, 0), fenv("KEY", 140), size=0.9, size_y=0.6, col=(1.0, 0.97, 0.93), spread=fenv("SPREAD", 70))
    area((0.6, -0.2, 0.3), (0.1, 0.3, 0), fenv("FILL", 20), size=0.8, col=(0.86, 0.9, 1.0))
    spot((0.5, 1.2, 0.5), (0.1, 0.4, 0.0), fenv("RIM", 160) * 2, cone=40, blend=0.8, radius=0.08, col=(1.0, 0.85, 0.74))
    cl = m0 * MM - d * fenv("BACK", 0.10) - nrm * fenv("SIDE", 0.03) + Vector((0, 0, fenv("UP", 0.035))); tg = m0 * MM + d * fenv("AHEAD", 0.25) - Vector((0, 0, fenv("TDZ", 0.02)))
    camera(tuple(cl), tuple(tg), lens=fenv("LENS", 40), fstop=fenv("FSTOP", 2.8), focus=tuple(m0 * MM))

if SHOT == "gates":
    # five brass check gates over one straight track; each has an engraved word and a needle that swings
    for o in list(bpy.data.objects):
        if o.type in ("MESH", "CURVE") and o.name != "sweep": bpy.data.objects.remove(o)
    paint2, pp2 = principled("plinth paint", hexc(env("PLINTH", "#aebbd8")), 0.62); noise_bump(paint2, pp2, scale=900, strength=0.05)
    box("slab", (820 * MM, 130 * MM, 34 * MM), (0, 0, -17 * MM), paint2, bevel=1.2 * MM)
    X0, X1, Z0, Z1 = -380.0, 380.0, 44.0, 26.0
    GZ = lambda x: Z0 + (Z1 - Z0) * (x - X0) / (X1 - X0)       # ball-centre height along the track
    rl = [[], []]
    for j, sg in enumerate((-1, 1)):
        rl[j] = [((x) * MM, sg * S / 2 * MM, (GZ(x) - HB) * MM) for x in (X0, X1)]
    poly_curve("rails", rl, RW * MM, brass, bevel_res=3)
    ti, po = [], []
    for x in range(int(X0) + 10, int(X1), 30):
        z = GZ(x) - HB; ti.append([(x * MM, -S / 2 * MM, z * MM), (x * MM, 0, (z - 3.2) * MM), (x * MM, S / 2 * MM, z * MM)])
        if (x - int(X0) - 10) % 90 == 0: po.append([(x * MM, 0, (z - 3.2) * MM), (x * MM, 0, 0)])
    poly_curve("ties", ti, 1.1 * MM, brass, bevel_res=2)
    poly_curve("posts", po, 1.9 * MM, brass, bevel_res=2)
    words = ["正确", "诊断", "引导", "适应", "可执行"]
    GX = [-240.0, -120.0, 0.0, 120.0, 240.0]
    needle_m, _ = principled("needle", hexc("#2b2433"), 0.35, Metallic=0.6)
    for g, (x, wd) in enumerate(zip(GX, words)):
        e = bpy.data.objects.new("gate%d" % g, None); link(e)
        zt = GZ(x) - HB; top = zt + 46
        arch = poly_curve("arch%d" % g, [[(x * MM, -16 * MM, (zt - 4) * MM), (x * MM, -16 * MM, (top - 6) * MM), (x * MM, -12 * MM, top * MM),
                                          (x * MM, 12 * MM, top * MM), (x * MM, 16 * MM, (top - 6) * MM), (x * MM, 16 * MM, (zt - 4) * MM)]], 1.6 * MM, brass, bevel_res=3)
        tex.engrave_rich(os.path.join(TEX, "g%d.png" % g), 900, 360, [(wd, "n")], 220)
        pl_ = plate("gplate%d" % g, os.path.join(TEX, "g%d.png" % g), (30, 12), (x * MM, -17.5 * MM, (top + 7.5) * MM))
        bar = poly_curve("gbar%d" % g, [[(x * MM, -16 * MM, (top + 1) * MM), (x * MM, -16 * MM, (top + 2) * MM)]], 1.0 * MM, brass)
        # needle hangs from the crossbar, in front of a small blank brass dial (no numbers)
        nd = poly_curve("needle%d" % g, [[(0, 0, 0), (0, 0, -24 * MM), (0, 0, -26 * MM, 0.4)]], 0.55 * MM, needle_m, bevel_res=2)
        nd.location = (x * MM, -19.5 * MM, (top - 3) * MM)
        piv = poly_curve("pivot%d" % g, [[(x * MM, -21 * MM, (top - 3) * MM), (x * MM, -17 * MM, (top - 3) * MM)]], 1.4 * MM, brass)
        dial = [((x + 22 * math.sin(math.radians(a_))) * MM, -17.2 * MM, (top - 3 - 22 * math.cos(math.radians(a_))) * MM) for a_ in range(-35, 36, 5)]
        poly_curve("dial%d" % g, [dial], 0.5 * MM, brass)
        for o in (arch, pl_, bar, nd, piv) + tuple(o for o in bpy.data.objects if o.name.startswith("dial%d" % g)):
            o.parent = e
    m0 = Vector((X0 + 10, 0, GZ(X0 + 10)))
    marble("ball", tuple(m0 * MM), rot=0.4)
    area((-0.6, -0.5, 0.7), (0, 0, 0.04), fenv("KEY", 140), size=0.9, size_y=0.6, col=(1.0, 0.97, 0.93), spread=fenv("SPREAD", 70))
    area((0.6, -0.4, 0.3), (0, 0, 0.04), fenv("FILL", 20), size=0.8, col=(0.86, 0.9, 1.0))
    spot((0.3, 0.6, 0.45), (0, 0, 0.04), fenv("RIM", 160), cone=40, blend=0.8, radius=0.06, col=(1.0, 0.85, 0.74))
    area((0.25, 0.25, 0.35), (0.35, 0.55, 0.5), fenv("GLOW", 25), size=0.5, col=(1.0, 0.72, 0.78))
    camera(tuple(vec("CAM", "0.0,-0.78,0.20")), tuple(vec("TGT", "0.0,0.0,0.05")), lens=fenv("LENS", 40), fstop=fenv("FSTOP", 5.6), focus=(0, 0, 0.04))

if SHOT == "rows":
    # the run, copied into rows: same questions, same standard, run again with another marble
    unit = bpy.data.collections.new("unit")
    for o in list(sc().collection.objects):
        if o.type in ("MESH", "CURVE") and o.name not in ("sweep",):
            sc().collection.objects.unlink(o); unit.objects.link(o)
    bpy.context.scene.collection.children.link(unit); unit.hide_render = False
    lay = bpy.context.view_layer.layer_collection.children["unit"]; lay.exclude = True
    for gx in range(-2, 3):
        for gy in range(0, 5):
            e = bpy.data.objects.new("inst%d_%d" % (gx, gy), None); e.instance_type = "COLLECTION"; e.instance_collection = unit
            e.location = (gx * 0.5 + (0.12 if gy % 2 else 0), gy * 0.30, 0); link(e)
    bg.scale = (5, 6, 1)
    AMB = glass("amber glass", (1, 1, 1), 1.52, 0.0, absorb=(1.0, 0.78, 0.6), dens=40)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=R * MM, location=tuple(v * MM for v in path[0]), segments=64, ring_count=32); bo = bpy.context.object; bo.name = "ball"
    for pz in bo.data.polygons: pz.use_smooth = True
    bo.data.materials.append(AMB)
    area((-1.2, -1.0, 1.6), (0.2, 0.5, 0.1), fenv("KEY", 140) * 4, size=2.4, size_y=1.6, col=(1.0, 0.97, 0.93), spread=fenv("SPREAD", 70))
    area((1.4, -0.8, 0.6), (0.2, 0.5, 0.1), fenv("FILL", 20) * 4, size=2.0, col=(0.86, 0.9, 1.0))
    spot((0.8, 1.9, 1.2), (0.2, 0.5, 0.1), fenv("RIM", 160) * 5, cone=60, blend=0.8, radius=0.1, col=(1.0, 0.85, 0.74))
    camera(tuple(vec("CAM", "-0.22,-0.95,0.20")), tuple(vec("TGT", "0,0,0.14")), lens=fenv("LENS", 50), fstop=fenv("FSTOP", 8), focus=(0, 0, 0.14))

if SHOT == "end":
    # one marble at rest on an empty sweep: the end card sits in the space around it
    for o in list(bpy.data.objects):
        if o.type in ("MESH", "CURVE") and o.name != "sweep": bpy.data.objects.remove(o)
    marble("ball", (0.0, 0.0, -0.034 + R * MM), rot=0.4)
    area((-0.6, -0.5, 0.7), (0, 0, -0.03), fenv("KEY", 140), size=0.9, size_y=0.6, col=(1.0, 0.97, 0.93), spread=fenv("SPREAD", 70))
    area((0.6, -0.4, 0.3), (0, 0, -0.03), fenv("FILL", 20), size=0.8, col=(0.86, 0.9, 1.0))
    spot((0.3, 0.6, 0.45), (0, 0, -0.03), fenv("RIM", 160), cone=40, blend=0.8, radius=0.06, col=(1.0, 0.85, 0.74))
    area((0.25, 0.25, 0.35), (0.35, 0.55, 0.5), fenv("GLOW", 25), size=0.5, col=(1.0, 0.72, 0.78))
    camera(tuple(vec("CAM", "0.10,-0.42,0.02")), tuple(vec("TGT", "0.05,0,-0.02")), lens=fenv("LENS", 50), fstop=fenv("FSTOP", 4), focus=(0, 0, -0.026))

render(OUT, W, H, SPP, expo=fenv("EXPO", 0.0))
