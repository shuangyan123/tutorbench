# Vision film storyboard: a dandelion clock in misty blue-violet light.
# usage: python dandelion.py SHOT OUT.png [W H SPP]
# SHOT: believe | ask | explore | make | see | keep
# units: 1 Blender unit = 1 mm (scene scale set accordingly)
import math, sys, os, random
import bpy, addon_utils
from mathutils import Vector, Matrix, Quaternion

a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
SHOT = a[0]; OUT = os.path.abspath(a[1])
W = int(a[2]) if len(a) > 2 else 1280; H = int(a[3]) if len(a) > 3 else 720; SPP = int(a[4]) if len(a) > 4 else 96
env = lambda k, d: os.environ.get(k, d)
fenv = lambda k, d: float(env(k, d))
vec = lambda k, d: Vector([float(v) for v in env(k, d).split(",")])

bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene
sc.unit_settings.scale_length = 0.001
lin = lambda c: tuple(((v / 255 + 0.055) / 1.055) ** 2.4 for v in c)
hexc = lambda h: lin((int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)))

# ---------------------------------------------------------------- materials
def mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    return m, m.node_tree.nodes, m.node_tree.links, m.node_tree.nodes["Principled BSDF"]

def fibre_mat(name, col, trans, rough=0.45, sheen=0.4):
    m, N, L, p = mat(name)
    p.inputs["Base Color"].default_value = (*col, 1); p.inputs["Roughness"].default_value = rough
    p.inputs["Subsurface Weight"].default_value = trans
    p.inputs["Subsurface Radius"].default_value = (1.0, 0.9, 0.8)
    p.inputs["Subsurface Scale"].default_value = 0.4
    p.inputs["Sheen Weight"].default_value = sheen
    tl = N.new("ShaderNodeBsdfTranslucent"); tl.inputs["Color"].default_value = (*col, 1)
    mx = N.new("ShaderNodeMixShader"); mx.inputs[0].default_value = trans
    out = N["Material Output"]; L.new(p.outputs[0], mx.inputs[1]); L.new(tl.outputs[0], mx.inputs[2]); L.new(mx.outputs[0], out.inputs[0])
    return m

pappus_m = fibre_mat("pappus", hexc("#f4f2f6"), 0.7, 0.4, 0.6)
beak_m = fibre_mat("beak", hexc("#e9e4dc"), 0.6, 0.45, 0.2)
achene_m = fibre_mat("achene", hexc("#7a5b46"), 0.2, 0.5, 0.0)
recept_m = fibre_mat("receptacle", hexc("#b39a7c"), 0.3, 0.6, 0.0)
stem_m = fibre_mat("stem", hexc("#b8bfae"), 0.5, 0.35, 0.0)

# ---------------------------------------------------------------- geometry
def curve_obj(name, m, splines, bevel, res=4):
    """splines: list of [(Vector, radius), ...] poly lines"""
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"
    cu.bevel_depth = bevel; cu.bevel_resolution = 1; cu.resolution_u = res; cu.use_fill_caps = True
    for pts in splines:
        sp = cu.splines.new("NURBS"); sp.points.add(len(pts) - 1)
        for i, (p, r) in enumerate(pts):
            sp.points[i].co = (*p, 1); sp.points[i].radius = r
        sp.use_endpoint_u = True; sp.order_u = min(3, len(pts))
    o = bpy.data.objects.new(name, cu); sc.collection.objects.link(o); cu.materials.append(m)
    return o

def basis(axis):
    axis = axis.normalized()
    t = Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((1, 0, 0))
    u = axis.cross(t).normalized(); v = axis.cross(u)
    return u, v

class Seeds:
    def __init__(self): self.pap, self.beak, self.ach = [], [], []
    def add(self, base, axis, rng, open_=1.0, scale=1.0, n=int(env("NFIL", 56))):
        """one seed: achene from base along axis, beak, then pappus umbrella. open_ 0..1 folds the umbrella"""
        axis = axis.normalized(); u, v = basis(axis); s = scale
        a0 = base; a1 = base + axis * 3.2 * s
        self.ach.append([(a0, 0.18 * s), (base + axis * 1.4 * s, 0.42 * s), (a1, 0.12 * s)])
        lb = rng.uniform(8.5, 10.0) * s
        bend = (u * rng.uniform(-1, 1) + v * rng.uniform(-1, 1)) * 0.25 * s
        tip = a1 + axis * lb + bend
        self.beak.append([(a1, 0.06 * s), (a1 + axis * lb * 0.5 + bend * 0.6, 0.05 * s), (tip, 0.045 * s)])
        th = math.radians(rng.uniform(68, 80) * open_ + 8 * (1 - open_))
        for k in range(n):
            ph = 2 * math.pi * (k + rng.uniform(-0.3, 0.3)) / n
            d = (u * math.cos(ph) + v * math.sin(ph)) * math.sin(th) + axis * math.cos(th)
            ln = rng.uniform(5.2, 6.4) * s
            up = axis * (0.9 * open_ + 0.2) * s
            fr = fenv("FR", 0.014)
            pts = [(tip, fr * 1.4 * s), (tip + d * ln * 0.45 + up * 0.15, fr * s),
                   (tip + d * ln * 0.8 + up * 0.55, fr * 0.8 * s), (tip + d * ln + up * 1.0, fr * 0.5 * s)]
            self.pap.append(pts)
    def build(self, tag=""):
        curve_obj("pappus" + tag, pappus_m, self.pap, 1.0, 3)
        curve_obj("beak" + tag, beak_m, self.beak, 1.0, 3)
        curve_obj("achene" + tag, achene_m, self.ach, 1.0, 4)

def seed_head(center, rng, n=int(env("NSEED", 260)), missing=None, R0=2.6, lift=None):
    """seed head on a receptacle; missing(dir)->bool drops seeds; lift: (index, offset, tilt) for a leaving seed"""
    S = Seeds(); ga = math.pi * (3 - math.sqrt(5)); kept = []
    for i in range(n):
        z = 1 - 2 * (i + 0.5) / n; r = math.sqrt(1 - z * z); ph = ga * i
        d = Vector((r * math.cos(ph), r * math.sin(ph), z))
        if d.z < -0.62: continue
        d = (d + Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * 0.05).normalized()
        if missing and missing(d): continue
        kept.append(d)
    for j, d in enumerate(kept):
        base = center + d * R0
        if lift and j == lift[0]:
            continue
        S.add(base, d, rng)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=R0, location=center, segments=48, ring_count=24)
    rc = bpy.context.object; rc.scale = (1, 1, 0.92); rc.data.materials.append(recept_m)
    bpy.ops.object.shade_smooth()
    tex = rc.modifiers.new("pits", "DISPLACE"); t = bpy.data.textures.new("pits", "VORONOI"); t.noise_scale = 0.35
    tex.texture = t; tex.strength = 0.12
    return S, kept

def stem(center, length=170, R0=2.6, sway=(6, -10)):
    top = center + Vector((0, 0, -R0 * 0.85))
    pts = [(top, 1.0)]
    for k in range(1, 7):
        t = k / 6
        pts.append((top + Vector((sway[0] * t * t, sway[1] * t * t, -length * t)), 1.0 + 0.25 * t))
    curve_obj("stem", stem_m, pts and [pts], 1.0, 8).data.bevel_depth = 0.75

def detached(pos, axis, rng, scale=1.0, open_=1.0, S=None):
    S = S or Seeds()
    S.add(pos, axis, rng, open_=open_, scale=scale)
    return S

# ---------------------------------------------------------------- light, backdrop, world
def backdrop(dist, size, glows):
    """an emissive misty blue-violet wall far behind, with soft peach / pink glows (fully defocused by DOF)"""
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, dist, 0), rotation=(math.radians(90), 0, 0))
    o = bpy.context.object; m, N, L, p = mat("mist"); N.remove(p)
    out = N["Material Output"]; em = N.new("ShaderNodeEmission"); L.new(em.outputs[0], out.inputs[0])
    em.inputs["Strength"].default_value = fenv("MIST", 0.85)
    tc = N.new("ShaderNodeTexCoord"); sep = N.new("ShaderNodeSeparateXYZ"); L.new(tc.outputs["Object"], sep.inputs[0])
    # vertical base gradient: lighter lavender top, periwinkle bottom
    gy = N.new("ShaderNodeMapRange"); gy.inputs["From Min"].default_value = -size / 2; gy.inputs["From Max"].default_value = size / 2
    L.new(sep.outputs[1], gy.inputs["Value"])
    ramp = N.new("ShaderNodeValToRGB"); cr = ramp.color_ramp
    cr.elements[0].color = (*hexc("#a9b8e6"), 1); cr.elements[1].color = (*hexc("#d3daf3"), 1)
    L.new(gy.outputs[0], ramp.inputs[0]); col = ramp.outputs[0]
    for (gx, gz, rad, hexcol, amt) in glows:
        # radial falloff from (gx, gz) in plane coords (plane local x, y)
        cv = N.new("ShaderNodeCombineXYZ"); cv.inputs[0].default_value = gx; cv.inputs[1].default_value = gz
        dv = N.new("ShaderNodeVectorMath"); dv.operation = "DISTANCE"; L.new(tc.outputs["Object"], dv.inputs[0]); L.new(cv.outputs[0], dv.inputs[1])
        mr = N.new("ShaderNodeMapRange"); mr.inputs["From Min"].default_value = 0; mr.inputs["From Max"].default_value = rad
        mr.inputs["To Min"].default_value = amt; mr.inputs["To Max"].default_value = 0; mr.interpolation_type = "SMOOTHSTEP"
        L.new(dv.outputs["Value"], mr.inputs["Value"])
        mix = N.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MIX"
        L.new(mr.outputs[0], mix.inputs["Factor"]); L.new(col, mix.inputs[6]); mix.inputs[7].default_value = (*hexc(hexcol), 1)
        col = mix.outputs[2]
    L.new(col, em.inputs["Color"])
    o.data.materials.append(m); o.visible_shadow = False
    return o

def world(strength=0.6):
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes["Background"]; bg.inputs[0].default_value = (*hexc("#c9d3ec"), 1); bg.inputs[1].default_value = strength

def area(name, loc, target, power, size, hexcol):
    l = bpy.data.lights.new(name, "AREA"); l.energy = power * fenv("LP", 55); l.size = size; l.color = hexc(hexcol); l.shape = "DISK"
    o = bpy.data.objects.new(name, l); sc.collection.objects.link(o); o.location = loc
    o.visible_glossy = False; o.visible_camera = False
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o

def camera(loc, target, lens, fstop, focus):
    c = bpy.data.cameras.new("cam"); c.lens = lens; c.sensor_width = 36
    c.dof.use_dof = True; c.dof.aperture_fstop = fstop / fenv("DOFK", 1.0); c.dof.focus_distance = focus
    c.clip_start = 1; c.clip_end = 100000
    o = bpy.data.objects.new("cam", c); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    sc.camera = o
    return o

def water(z=0, ripple_c=(0, 0), k=1.1, decay=0.06, rmax=60, amp=0.6, phase=0.0):
    bpy.ops.mesh.primitive_plane_add(size=30000, location=(0, 0, z)); o = bpy.context.object
    m, N, L, p = mat("water")
    p.inputs["Base Color"].default_value = (*hexc("#5b6185"), 1); p.inputs["Roughness"].default_value = 0.02
    p.inputs["IOR"].default_value = 1.33
    tc = N.new("ShaderNodeTexCoord"); cv = N.new("ShaderNodeCombineXYZ"); cv.inputs[0].default_value = ripple_c[0]; cv.inputs[1].default_value = ripple_c[1]
    dv = N.new("ShaderNodeVectorMath"); dv.operation = "DISTANCE"; L.new(tc.outputs["Object"], dv.inputs[0]); L.new(cv.outputs[0], dv.inputs[1])
    m1 = N.new("ShaderNodeMath"); m1.operation = "MULTIPLY"; m1.inputs[1].default_value = k; L.new(dv.outputs["Value"], m1.inputs[0])
    ph = N.new("ShaderNodeMath"); ph.operation = "SUBTRACT"; ph.inputs[1].default_value = phase; L.new(m1.outputs[0], ph.inputs[0])
    sn = N.new("ShaderNodeMath"); sn.operation = "SINE"; L.new(ph.outputs[0], sn.inputs[0])
    e1 = N.new("ShaderNodeMath"); e1.operation = "MULTIPLY"; e1.inputs[1].default_value = -decay; L.new(dv.outputs["Value"], e1.inputs[0])
    ex = N.new("ShaderNodeMath"); ex.operation = "EXPONENT"; L.new(e1.outputs[0], ex.inputs[0])
    win = N.new("ShaderNodeMapRange"); win.inputs["From Min"].default_value = rmax * 0.7; win.inputs["From Max"].default_value = rmax
    win.inputs["To Min"].default_value = 1; win.inputs["To Max"].default_value = 0; L.new(dv.outputs["Value"], win.inputs["Value"])
    h1 = N.new("ShaderNodeMath"); h1.operation = "MULTIPLY"; L.new(sn.outputs[0], h1.inputs[0]); L.new(ex.outputs[0], h1.inputs[1])
    h2 = N.new("ShaderNodeMath"); h2.operation = "MULTIPLY"; L.new(h1.outputs[0], h2.inputs[0]); L.new(win.outputs[0], h2.inputs[1])
    # faint broad swell so the surface is never a dead mirror
    nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 0.004; nz.inputs["Detail"].default_value = 2
    L.new(tc.outputs["Object"], nz.inputs["Vector"])
    nm = N.new("ShaderNodeMath"); nm.operation = "MULTIPLY_ADD"; nm.inputs[1].default_value = 0.15; L.new(nz.outputs["Fac"], nm.inputs[0]); L.new(h2.outputs[0], nm.inputs[2])
    bu = N.new("ShaderNodeBump"); bu.inputs["Strength"].default_value = amp; bu.inputs["Distance"].default_value = 1.0
    L.new(nm.outputs[0], bu.inputs["Height"]); L.new(bu.outputs[0], p.inputs["Normal"])
    o.data.materials.append(m)
    return o

# ---------------------------------------------------------------- shots
rng = random.Random(int(env("SEED", "7")))
C = Vector((0, 0, 0))
T = fenv("T", -1)          # animation time 0..1 within the shot; -1 = the storyboard still
STILL = T < 0
ease = lambda x: (lambda y: y * y * (3 - 2 * y))(min(max(x, 0.0), 1.0))
lerp = lambda a, b, u: a + (b - a) * u
GLOWS = [(200, 120, 420, "#ffb48e", 0.8), (-300, -80, 380, "#f4a6c8", 0.55), (60, -300, 420, "#a9bdf0", 0.4)]
world(0.5)

if SHOT == "believe":
    # 1. the whole clock, backlit, fully round
    S, kept = seed_head(C, rng); S.build(); stem(C)
    backdrop(1600, 3600, GLOWS)
    area("rim", (40, 120, 60), (0, 0, 0), 9000, 60, "#ffd9c4")
    area("rim2", (-70, 110, -10), (0, 0, 0), 3500, 50, "#f2d0e4")
    area("fill", (-120, -260, 60), (0, 0, 0), 2500, 200, "#dfe6fb")
    if STILL: camera((-34, -260, 2), (-14, 0, -4), 100, 5.6, 248)
    else:
        u = ease(T); y = lerp(-305, -250, u)
        camera((-34, y, 2), (-14, 0, -4), 100, 5.6, -y - 12 + 4 * math.sin(T * math.pi))

elif SHOT == "ask":
    # 2. one seed has just let go: macro on the edge of the clock
    lift_i = None
    S, kept = seed_head(C, rng)
    # pick the seed pointing most toward upper-left-front and lift it away
    tgt = Vector((-0.55, -0.35, 0.76)).normalized()
    j = max(range(len(kept)), key=lambda i: kept[i].dot(tgt)); d = kept[j]
    S2, kept2 = None, None
    # rebuild without it
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)
    rng2 = random.Random(int(env("SEED", "7")))
    S, kept = seed_head(C, rng2, lift=(j, 0, 0)); S.build(); stem(C)
    L1 = Seeds(); ax = (d + Vector((-0.15, 0, 0.2))).normalized()
    if STILL: L1.add(C + d * 2.6 + d * 9.0 + Vector((-2, -1, 3)), ax, random.Random(3))
    else:
        u = 0.72 * ease((T - 0.06) / 0.94) ** 1.15
        L1.add(C + d * 2.6 + (d * 14.0 + Vector((-4, -1, 7))) * u, (d + Vector((-0.15, 0, 0.2)) * u).normalized(), random.Random(3), open_=lerp(0.8, 1.0, u))
    L1.build("_lift")
    backdrop(1600, 3600, GLOWS)
    area("rim", (20, 120, 80), (-8, 0, 12), 9000, 60, "#ffd9c4")
    area("fill", (-120, -260, 60), (0, 0, 0), 2000, 200, "#dfe6fb")
    foc = C + d * 2.6 + d * 18 + Vector((-2, -1, 3))
    cam = Vector((foc.x - 25, foc.y - 70, foc.z - 4))
    pan = Vector((0, 0, 0)) if STILL else (d * 14.0 + Vector((-4, -1, 7))) * u * fenv("PAN", 0.55)
    camera(cam + pan, foc + Vector((4, 0, -3)) + pan, 100, 2.0, (foc - cam).length)

elif SHOT == "explore":
    # 3. seeds adrift at different depths; the clock far behind, soft
    HC = Vector((70, 420, -60)); S, kept = seed_head(HC, rng, missing=lambda d: d.x < -0.1 and d.z > -0.2); S.build(); stem(HC)
    A = Seeds(); r3 = random.Random(11)
    floats = [((-6, 0, -9), (0.15, -0.1, 1)), ((-30, 45, -3), (-0.3, 0.1, 1)), ((24, -40, -15), (0.3, 0, 1)),
              ((34, 80, 0), (0.35, 0.1, 1)), ((-52, 130, -22), (-0.1, 0.2, 1)), ((12, 220, 6), (0.2, 0.2, 1)),
              ((-20, -70, 2), (-0.35, 0, 1))]
    for i, (p, ax) in enumerate(floats):
        if STILL: A.add(Vector(p), Vector(ax), r3); continue
        rv = random.Random(100 + i); tt = T - 0.5
        vel = Vector((rv.uniform(-6, 10), rv.uniform(-3, 3), rv.uniform(4, 10)))
        sw = Vector((math.sin(T * 3 + i) * 0.12, 0, 0))
        A.add(Vector(p) + vel * tt, Vector(ax) + sw, random.Random(500 + i))
    A.build("_air")
    backdrop(1600, 4000, GLOWS)
    area("rim", (60, 160, 80), (0, 20, 0), 22000, 100, "#ffd9c4")
    area("rim2", (-110, 140, 30), (0, 20, 0), 8000, 80, "#f2d0e4")
    area("fill", (-120, -300, 60), (0, 0, 0), 2500, 220, "#dfe6fb")
    cx = 0 if STILL else lerp(-12, 12, ease(T))
    camera((cx, -180, 2), (cx * 0.6, 0, 0), 100, 2.8, 180)

elif SHOT == "make":
    # 4. a seed touches still water; rings go out
    if STILL:
        water(0, (0, 0), k=fenv("RK", 0.28), decay=fenv("RD", 0.016), rmax=240, amp=fenv("RA", 0.35)); sz = -0.6
    else:
        TC = 0.32
        if T < TC:
            sz = lerp(40, -0.6, 1 - (1 - T / TC) ** 2); water(0, (0, 0), k=0.28, decay=0.016, rmax=1, amp=0.0)
        else:
            R = 6 + (T - TC) * 300; k = 0.28
            water(0, (0, 0), k=k, decay=0.016, rmax=R, amp=0.35 * (1 - 0.35 * (T - TC)), phase=k * R)
            sz = -0.6 - 0.25 * math.sin((T - TC) * 25) * math.exp(-(T - TC) * 6)
    A = Seeds(); A.add(Vector((0, 0, sz)), Vector((0.12, 0.05, 1)), random.Random(5)); A.build("_w")
    backdrop(9000, 30000, [(1200, 600, 2600, "#ffb48e", 0.75), (-2000, 300, 2600, "#f4a6c8", 0.5)])
    area("rim", (40, 260, 90), (0, 0, 8), 16000, 90, "#ffd9c4")
    area("fill", (-160, -300, 120), (0, 0, 0), 2500, 240, "#dfe6fb")
    camera((-10, -150, 26), (0, 0, 9), 85, 2.4, 152)

elif SHOT == "see":
    # 5. learning to see clearly: one seed drifting, its crown in sharp focus; the clock far behind, soft
    HC = Vector((48, 260, 6)); S, kept = seed_head(HC, rng); S.build(); stem(HC)
    A = Seeds(); A.add(Vector((0, 0, -10)), Vector((0.08, 0.35, 1)), random.Random(8)); A.build("_one")
    tip = Vector((0, 0, -10)) + Vector((0.08, 0.35, 1)).normalized() * 12.4
    backdrop(1600, 4000, GLOWS)
    area("rim", (20, 160, 60), tuple(tip), 9000, 60, "#ffd9c4")
    area("fill", (-120, -260, 60), (0, 0, 0), 1800, 200, "#dfe6fb")
    cam = tip + Vector((-4, -40, -9))
    fd = (tip - cam).length
    if not STILL: fd = lerp(260, fd, ease((T - 0.12) / 0.6) ** 0.7)
    camera(cam, tip + Vector((2, 0, 1.5)), 100, 4.0 if STILL else fenv("SEEF", 0.3), fd)

elif SHOT == "keep":
    # 6. the clock afterwards: a gap where seeds have gone, two still leaving
    S, kept = seed_head(C, rng, missing=lambda d: d.x > 0.25 and d.z > 0.1 and rng.random() < 0.85); S.build(); stem(C, sway=(-4, -8))
    A = Seeds(); r3 = random.Random(21)
    k6 = 0 if STILL else T - 0.4
    A.add(Vector((26, -6, 26)) + Vector((34, -4, 26)) * k6, Vector((0.4, -0.1, 1)), r3)
    A.add(Vector((50, 12, 48)) + Vector((30, 6, 30)) * k6, Vector((0.25, 0.1, 1)), r3)
    A.build("_go")
    backdrop(1600, 3600, GLOWS)
    area("rim", (60, 120, 70), (10, 0, 10), 10000, 60, "#ffd9c4")
    area("fill", (-120, -260, 60), (0, 0, 0), 2200, 200, "#dfe6fb")
    if STILL: camera((-60, -260, 10), (14, 0, 10), 85, 5.6, 255)
    else:
        u = ease(T); camera((lerp(-50, -66, u), lerp(-225, -300, u), 10), (14, 0, 10), 85, 5.6, lerp(222, 296, u))

# ---------------------------------------------------------------- render
r = sc.render; r.engine = "CYCLES"; r.resolution_x = W; r.resolution_y = H; r.resolution_percentage = 100
cy = sc.cycles; cy.samples = SPP; cy.use_denoising = True
DEV = env("DEVICE", "CPU")          # CPU | OPTIX | CUDA | HIP | METAL | ONEAPI
cy.device = "CPU"
if DEV != "CPU":
    pr = bpy.context.preferences.addons["cycles"].preferences
    pr.compute_device_type = DEV; pr.refresh_devices()
    for dv in pr.devices: dv.use = dv.type == DEV
    if any(dv.use for dv in pr.devices): cy.device = "GPU"; cy.denoiser = "OPTIX" if DEV == "OPTIX" else "OPENIMAGEDENOISE"
    else: print("no", DEV, "device found, using CPU")
cy.max_bounces = 8; cy.transmission_bounces = 8; cy.diffuse_bounces = 3
r.film_transparent = False
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = env("LOOK", "AgX - Medium High Contrast")
sc.view_settings.exposure = fenv("EXPO", 0.0)
r.image_settings.file_format = "PNG"; r.filepath = OUT
bpy.ops.render.render(write_still=True)
print("WROTE", OUT)
