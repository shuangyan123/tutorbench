# Journal cover, "Are We Seeking Truth, or Trying to Prove Ourselves Right?": a brass pocket compass on a
# printed map, set square to the map's north arrow. Beside it lies a red horseshoe magnet, and the needle
# has swung away from N towards it. North has not moved; the needle has. The light is a low afternoon sun
# raking across the table from the left: long shadows, the folds of the map catching it, and the glass of
# the compass throwing a bright crescent.
# usage: python compass.py OUT.png [W H SPP]
#        the cover is 900 x 1100 at 160 spp, then render/photo_finish.py into assets/journal/compass.webp
# tuning (env): EXPO SUN SKY LOOK FOCAL FSTOP CAMD CAMEL CAMAZ SUNAZ SUNEL DEFLECT MAGX MAGY MAGROT
import math, os, random, sys, tempfile
import bpy, bmesh, addon_utils
import numpy as np
from mathutils import Vector
from PIL import Image, ImageDraw, ImageFont, ImageFilter

a = sys.argv[1:]; OUT = os.path.abspath(a[0])
W = int(a[1]) if len(a) > 1 else 900; H = int(a[2]) if len(a) > 2 else 1100; SPP = int(a[3]) if len(a) > 3 else 160
E = os.environ.get
EXPO = float(E("EXPO", 0.0)); SUN = float(E("SUN", 1.0)); SKY = float(E("SKY", 1.0))
FONT = E("FONT", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
SERIF = E("SERIF", "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf")
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene; rnd = random.Random(3); rng = np.random.default_rng(3)
TMP = tempfile.mkdtemp(prefix="compass_")


def principled(name, col, rough=.5, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): b.inputs[k].default_value = v
    return m, b


def mesh_obj(name, verts, faces, m=None, smooth=True, uvs=None):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    if m is not None: o.data.materials.append(m)
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
    if uvs is not None:
        uvl = o.data.uv_layers.new(name="UVMap")
        for poly in o.data.polygons:
            for li in poly.loop_indices: uvl.data[li].uv = uvs[o.data.loops[li].vertex_index]
    return o


def lathe(name, profile, m, segs=128, x=0.0, y=0.0):
    """a turned part about the z axis: profile is [(radius, z), ...] from the inside out or bottom up"""
    v, f = [], []
    for (r_, z) in profile:
        for s in range(segs):
            th = 2 * math.pi * s / segs
            v.append((x + r_ * math.cos(th), y + r_ * math.sin(th), z))
    n = len(profile)
    for i in range(n - 1):
        for s in range(segs):
            f.append((i * segs + s, i * segs + (s + 1) % segs, (i + 1) * segs + (s + 1) % segs, (i + 1) * segs + s))
    return mesh_obj(name, v, f, m)


def disc(name, r, z, m, x=0.0, y=0.0, segs=128, uv=False):
    v = [(x, y, z)] + [(x + r * math.cos(2 * math.pi * s / segs), y + r * math.sin(2 * math.pi * s / segs), z) for s in range(segs)]
    f = [(0, 1 + s, 1 + (s + 1) % segs) for s in range(segs)]
    uvs = [(0.5, 0.5)] + [(0.5 + 0.5 * math.cos(2 * math.pi * s / segs), 0.5 + 0.5 * math.sin(2 * math.pi * s / segs)) for s in range(segs)] if uv else None
    return mesh_obj(name, v, f, m, smooth=False, uvs=uvs)


def textured(name, png, rough=0.6, bump_png=None, bump=0.0):
    m, b = principled(name, (1, 1, 1), rough)
    nt = m.node_tree; t = nt.nodes.new("ShaderNodeTexImage"); t.image = bpy.data.images.load(png); t.interpolation = "Cubic"
    uv = nt.nodes.new("ShaderNodeUVMap"); nt.links.new(uv.outputs[0], t.inputs[0])
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    return m, b, nt, t


# ---------------------------------------------------------------- the map: contours, a lake, a grid, a north arrow
MS = 3000; MAPW = 0.62
def map_png(path):
    # a terrain: a few hills and a valley, in numpy, then contour lines every 10 "metres"
    yy, xx = np.mgrid[0:MS, 0:MS] / MS
    hgt = np.zeros((MS, MS))
    for _ in range(14):
        cx, cy, s, amp = rng.uniform(-0.1, 1.1), rng.uniform(-0.1, 1.1), rng.uniform(0.08, 0.3), rng.uniform(-60, 140)
        hgt += amp * np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * s * s)))
    lo = rng.random((40, 40)); lo = np.array(Image.fromarray(np.uint8(lo * 255)).resize((MS, MS), Image.BICUBIC), np.float32) / 255
    hgt += 18 * lo
    step = 8.0
    lev = hgt / step
    frac = np.abs(lev - np.round(lev))
    grad = np.hypot(*np.gradient(lev)) + 1e-6
    line = np.clip(1 - frac / (grad * 1.1), 0, 1)
    index = (np.round(lev) % 5 == 0)
    ink = np.where(index, np.clip(1 - frac / (grad * 2.0), 0, 1), line * 0.75)
    water = hgt < np.percentile(hgt, 9)
    img = np.ones((MS, MS, 3)) * np.array([243, 244, 245])
    # woodland: soft green patches where a second noise is high, drawn under the contours
    wd = rng.random((34, 34)); wd = np.array(Image.fromarray(np.uint8(wd * 255)).resize((MS, MS), Image.BICUBIC), np.float32) / 255
    wood = (wd > 0.68) & ~water
    img[wood] = np.array([214, 230, 204])
    img[water] = np.array([196, 214, 230])
    shore = water & ~np.roll(water, 3, 0) | water & ~np.roll(water, -3, 1)
    brown = np.array([150, 112, 86])   # contour ink: the usual brown, faded
    img = img * (1 - ink[..., None] * 0.8) + brown * ink[..., None] * 0.8
    im = Image.fromarray(np.uint8(np.clip(img, 0, 255)))
    d = ImageDraw.Draw(im)
    # the grid: kilometre squares in blue, numbered at the edge
    fs = ImageFont.truetype(FONT, 34)
    for k in range(1, 8):
        p = int(k * MS / 8)
        d.line([(p, 0), (p, MS)], fill=(120, 150, 190), width=3); d.line([(0, p), (MS, p)], fill=(120, 150, 190), width=3)
        d.text((p + 8, 10), f"{40 + k}", fill=(90, 120, 170), font=fs); d.text((10, p + 6), f"{88 - k}", fill=(90, 120, 170), font=fs)
    # a few spot heights, a place name in italics-like serif
    fl = ImageFont.truetype(SERIF, 52)
    d.text((int(0.58 * MS), int(0.68 * MS)), "High Moor", fill=(70, 70, 80), font=fl)
    d.text((int(0.12 * MS), int(0.34 * MS)), "Long Water", fill=(60, 90, 130), font=fl)
    fsm = ImageFont.truetype(FONT, 30)
    for (x, y, h) in ((0.36, 0.22, "412"), (0.72, 0.62, "388"), (0.84, 0.82, "301")):
        d.ellipse([x * MS - 6, y * MS - 6, x * MS + 6, y * MS + 6], fill=(60, 60, 60)); d.text((x * MS + 12, y * MS - 18), h, fill=(60, 60, 60), font=fsm)
    # the north arrow, printed in the margin corner
    ax, ay = int(float(E("ARX", 0.52)) * MS), int(float(E("ARY", 0.36)) * MS)
    d.polygon([(ax, ay - 190), (ax - 38, ay + 20), (ax, ay - 20), (ax + 38, ay + 20)], fill=(30, 32, 40))
    d.polygon([(ax, ay - 190), (ax, ay - 20), (ax + 38, ay + 20)], fill=(243, 244, 245), outline=(30, 32, 40))
    fn_ = ImageFont.truetype(SERIF, 90); bb = d.textbbox((0, 0), "N", font=fn_)
    d.text((ax - (bb[2] - bb[0]) / 2, ay - 310), "N", fill=(30, 32, 40), font=fn_)
    a_ = np.asarray(im, np.float32)
    a_ += rng.normal(0, 3.0, (MS, MS))[..., None]
    Image.fromarray(np.uint8(np.clip(a_, 0, 255))).save(path)
    # paper fibre for the bump
    fib = rng.random((MS // 2, MS // 2)); fibi = Image.fromarray(np.uint8(fib * 255)).filter(ImageFilter.GaussianBlur(1.2)).resize((MS, MS))
    fibi.save(path.replace(".png", "_fibre.png"))
map_png(os.path.join(TMP, "map.png"))

paper, pb, pn, pt = textured("map", os.path.join(TMP, "map.png"), 0.78)
fib = pn.nodes.new("ShaderNodeTexImage"); fib.image = bpy.data.images.load(os.path.join(TMP, "map_fibre.png")); fib.image.colorspace_settings.name = "Non-Color"
pn.links.new(pn.nodes["UV Map"].outputs[0], fib.inputs[0])
pbump = pn.nodes.new("ShaderNodeBump"); pbump.inputs["Strength"].default_value = 0.25; pbump.inputs["Distance"].default_value = 0.0004
pn.links.new(fib.outputs["Color"], pbump.inputs["Height"]); pn.links.new(pbump.outputs[0], pb.inputs["Normal"])
pb.inputs["Subsurface Weight"].default_value = 0.0
# the map sheet: folded once each way and opened out, so its creases stand a little proud and catch the light
nm = 160; mv, mf, muv = [], [], []
for j in range(nm + 1):
    for i in range(nm + 1):
        u, v = i / nm, j / nm
        x, y = (u - 0.5) * MAPW, (v - 0.5) * MAPW
        z = 0.0022 * math.exp(-((u - 0.5) / 0.03) ** 2) * (0.6 + 0.4 * math.sin(v * 7)) - 0.0012 * math.exp(-((v - 0.5) / 0.025) ** 2)
        z += 0.0035 * (abs(u - 0.5) * 2) ** 3 * (0.5 + 0.5 * math.sin(v * 3 + 1)) + 0.0018 * math.sin(u * 5.3 + v * 3.1) * (u * (1 - u)) * 4
        mv.append((x, y, max(z, 0.0) + 0.0005)); muv.append((u, v))
for j in range(nm):
    for i in range(nm):
        k = j * (nm + 1) + i; mf.append((k, k + 1, k + nm + 2, k + nm + 1))
mapo = mesh_obj("map", mv, mf, paper, uvs=muv)
MAPROT = math.radians(float(E("MAPROT", -6)))
mapo.rotation_euler = (0, 0, MAPROT)
# the table: dark oiled walnut, only a margin of it shows
table, tb = principled("table", (0.1, 0.06, 0.04), 0.42, **{"Coat Weight": 0.3, "Coat Roughness": 0.2})
tn = table.node_tree; ttc = tn.nodes.new("ShaderNodeTexCoord")
twv = tn.nodes.new("ShaderNodeTexWave"); twv.inputs["Scale"].default_value = 18.0; twv.inputs["Distortion"].default_value = 7.0; twv.inputs["Detail"].default_value = 4.0
tmp_ = tn.nodes.new("ShaderNodeMapping"); tmp_.inputs["Scale"].default_value = (0.15, 1.0, 1.0)
tn.links.new(ttc.outputs["Object"], tmp_.inputs[0]); tn.links.new(tmp_.outputs[0], twv.inputs["Vector"])
tcr = tn.nodes.new("ShaderNodeValToRGB"); tcr.color_ramp.elements[0].color = (0.07, 0.04, 0.025, 1); tcr.color_ramp.elements[1].color = (0.17, 0.1, 0.06, 1)
tn.links.new(twv.outputs["Fac"], tcr.inputs[0]); tn.links.new(tcr.outputs[0], tb.inputs["Base Color"])
bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=2.0)
tme = bpy.data.meshes.new("table"); bm.to_mesh(tme); bm.free()
to = bpy.data.objects.new("table", tme); sc.collection.objects.link(to); to.data.materials.append(table)

# the compass sits on the map, turned so its N points to the map's north (the map is turned by MAPROT)
north = Vector((-math.sin(MAPROT), math.cos(MAPROT), 0))
CX, CY = float(E("CX", -0.035)), float(E("CY", -0.018))
ZB = 0.0016   # the map surface under the compass

# ---------------------------------------------------------------- the compass dial (PIL)
def dial_png(path, S=2000):
    im = Image.new("RGB", (S, S), (238, 239, 240)); d = ImageDraw.Draw(im); c = S / 2
    for deg in range(0, 360, 2):
        th = math.radians(deg - 90)
        r0 = c * (0.80 if deg % 10 else 0.74); r1 = c * 0.88
        d.line([(c + r0 * math.cos(th), c + r0 * math.sin(th)), (c + r1 * math.cos(th), c + r1 * math.sin(th))], fill=(25, 25, 28), width=7 if deg % 10 == 0 else 3)
    fn = ImageFont.truetype(FONT, 46)
    for deg in range(30, 360, 30):
        if deg % 90 == 0: continue
        th = math.radians(deg - 90); r = c * 0.66; t = str(deg)
        bb = d.textbbox((0, 0), t, font=fn)
        d.text((c + r * math.cos(th) - (bb[2] - bb[0]) / 2, c + r * math.sin(th) - (bb[3] - bb[1]) / 2 - bb[1]), t, fill=(40, 40, 44), font=fn)
    fl = ImageFont.truetype(SERIF, 150)
    for deg, t in ((0, "N"), (90, "E"), (180, "S"), (270, "W")):
        th = math.radians(deg - 90); r = c * 0.6
        bb = d.textbbox((0, 0), t, font=fl)
        d.text((c + r * math.cos(th) - (bb[2] - bb[0]) / 2, c + r * math.sin(th) - (bb[3] - bb[1]) / 2 - bb[1]), t, fill=(170, 30, 30) if t == "N" else (25, 25, 28), font=fl)
    # a fine eight-point rose in the middle
    for deg in range(0, 360, 45):
        th = math.radians(deg - 90); L = c * (0.42 if deg % 90 == 0 else 0.26); w_ = math.radians(9)
        p0 = (c + L * math.cos(th), c + L * math.sin(th))
        p1 = (c + c * 0.07 * math.cos(th + math.pi / 2), c + c * 0.07 * math.sin(th + math.pi / 2))
        p2 = (c + c * 0.07 * math.cos(th - math.pi / 2), c + c * 0.07 * math.sin(th - math.pi / 2))
        d.polygon([p0, p1, (c, c)], fill=(200, 202, 206)); d.polygon([p0, p2, (c, c)], fill=(120, 124, 132))
    d.ellipse([c - c * 0.9, c - c * 0.9, c + c * 0.9, c + c * 0.9], outline=(40, 40, 44), width=5)
    im.save(path)
dial_png(os.path.join(TMP, "dial.png"))

brass, _ = principled("brass", (0.78, 0.6, 0.34), 0.22, **{"Metallic": 1.0})
bn = brass.node_tree; btc = bn.nodes.new("ShaderNodeTexCoord")
bno = bn.nodes.new("ShaderNodeTexNoise"); bno.inputs["Scale"].default_value = 300.0; bno.inputs["Detail"].default_value = 4.0
bn.links.new(btc.outputs["Object"], bno.inputs["Vector"])
bmr = bn.nodes.new("ShaderNodeMapRange"); bmr.inputs[3].default_value = 0.16; bmr.inputs[4].default_value = 0.32
bn.links.new(bno.outputs["Fac"], bmr.inputs[0]); bn.links.new(bmr.outputs[0], bn.nodes["Principled BSDF"].inputs["Roughness"])
RC_ = 0.034
# the case: a shallow drum with a rolled rim and a seat for the glass
case = lathe("case", [(0.0, ZB), (RC_ - 0.004, ZB), (RC_ - 0.001, ZB + 0.001), (RC_, ZB + 0.004), (RC_ + 0.0008, ZB + 0.010),
                      (RC_ + 0.0004, ZB + 0.0135), (RC_ - 0.0012, ZB + 0.0145), (RC_ - 0.0026, ZB + 0.0138), (RC_ - 0.0026, ZB + 0.0115),
                      (RC_ - 0.0024, ZB + 0.004)], brass, x=CX, y=CY)
dm, _, _, _ = textured("dial", os.path.join(TMP, "dial.png"), 0.5)
dial = disc("dial", RC_ - 0.0026, ZB + 0.004, dm, uv=True)
dial.location = (CX, CY, 0); dial.rotation_euler = (0, 0, MAPROT)
# the bow: a ring at north for a chain, through a small pendant knob
knob = lathe("knob", [(0.0, -0.002), (0.0032, -0.002), (0.0036, 0.0), (0.0032, 0.0025), (0.0, 0.003)], brass, segs=48)
knob.rotation_euler = (math.radians(90), 0, MAPROT); knob.location = Vector((CX, CY, ZB + 0.0075)) + north * (RC_ + 0.0025)
bpy.ops.mesh.primitive_torus_add(major_radius=0.0085, minor_radius=0.0014, major_segments=64, minor_segments=16)
bow = bpy.context.object; bow.data.materials.append(brass)
bow.rotation_euler = (0, 0, MAPROT); bow.location = Vector((CX, CY, ZB + 0.0016)) + north * (RC_ + 0.0115)
for p in bow.data.polygons: p.use_smooth = True
bow.rotation_euler = (math.radians(8), 0, MAPROT)

# the needle: a long diamond, the north half red, the south half blued steel, on a jewelled pivot
DEFLECT = math.radians(float(E("DEFLECT", -38)))     # negative: swung east, towards the magnet
nd = MAPROT + DEFLECT
red, _ = principled("red", (0.62, 0.05, 0.04), 0.35, **{"Coat Weight": 0.4})
blue, _ = principled("blued", (0.05, 0.07, 0.12), 0.28, **{"Metallic": 0.9})
NL = RC_ * 0.82; NW = 0.0028; NZ = ZB + 0.0072
def half(name, sgn, m):
    ux, uy = -math.sin(nd) * sgn, math.cos(nd) * sgn
    px, py = -uy, ux
    pts = [(0, 0, 0.0004), (px * NW, py * NW, 0), (ux * NL, uy * NL, 0), (-px * NW, -py * NW, 0)]
    v = [(CX + x, CY + y, NZ + z) for (x, y, z) in pts] + [(CX + x, CY + y, NZ - 0.0005 - z) for (x, y, z) in pts]
    f = [(0, 1, 2), (0, 2, 3), (4, 6, 5), (4, 7, 6), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0), (0, 4, 5, 1)]
    return mesh_obj(name, v, f, m, smooth=False)
half("needle_n", 1, red); half("needle_s", -1, blue)
cap = lathe("cap", [(0.0, NZ + 0.0016), (0.0016, NZ + 0.0010), (0.0022, NZ + 0.0002), (0.0022, NZ - 0.0008)], brass, segs=48, x=CX, y=CY)
lathe("pivot", [(0.0006, ZB + 0.004), (0.0006, NZ - 0.0005)], brass, segs=16, x=CX, y=CY)
# the glass, a slight dome, letting shadow rays through
glass = bpy.data.materials.new("glass"); glass.use_nodes = True
gn = glass.node_tree; gn.nodes.remove(gn.nodes["Principled BSDF"])
gg = gn.nodes.new("ShaderNodeBsdfGlass"); gg.inputs["IOR"].default_value = 1.5
lp = gn.nodes.new("ShaderNodeLightPath"); gt = gn.nodes.new("ShaderNodeBsdfTransparent"); gm = gn.nodes.new("ShaderNodeMixShader")
gn.links.new(lp.outputs["Is Shadow Ray"], gm.inputs[0]); gn.links.new(gg.outputs[0], gm.inputs[1]); gn.links.new(gt.outputs[0], gm.inputs[2])
gn.links.new(gm.outputs[0], gn.nodes["Material Output"].inputs["Surface"])
GR = RC_ - 0.0022
gprof_top = [(GR * (1 - i / 24), ZB + 0.0128 + 0.0012 * (1 - (1 - i / 24) ** 2)) for i in range(25)]
gprof_bot = [(GR * (i / 24), ZB + 0.0115 + 0.0010 * (1 - (i / 24) ** 2)) for i in range(25)]
lathe("glass", gprof_bot + [(GR, ZB + 0.0115), (GR, ZB + 0.0128)] + gprof_top, glass, x=CX, y=CY)

# ---------------------------------------------------------------- the magnet: a red horseshoe, its pole faces bare steel
MAGX, MAGY = float(E("MAGX", 0.066)), float(E("MAGY", 0.026)); MAGROT = math.radians(float(E("MAGROT", 158)))
mred, _ = principled("magnet_red", (0.42, 0.04, 0.032), 0.46, **{"Coat Weight": 0.25, "Coat Roughness": 0.3})
mstl, _ = principled("magnet_steel", (0.72, 0.72, 0.74), 0.24, **{"Metallic": 1.0})
def magnet():
    # a U bent from a square bar: the bend, two straight arms, then the polished pole pieces
    R0, T, D = 0.018, 0.011, 0.009       # centre radius of the bend, bar width, bar thickness
    path = []
    for i in range(33):                  # the bend, round the back
        th = math.pi / 2 + math.pi * i / 32
        path.append((R0 * math.cos(th), R0 * math.sin(th), "r"))
    L = 0.038
    arms = []
    for sgn in (1, -1):
        arms.append([(0.0 + L * i / 10, sgn * R0, "r" if i < 8 else "s") for i in range(11)])
    out = []
    def sweep(pts, closed=False):
        v, f = [], []
        for k, (x, y, tag) in enumerate(pts):
            # tangent and normal in the plane
            x2, y2, _ = pts[min(k + 1, len(pts) - 1)]; x1, y1, _ = pts[max(k - 1, 0)]
            tx, ty = x2 - x1, y2 - y1; n_ = math.hypot(tx, ty) or 1; tx, ty = tx / n_, ty / n_
            nx, ny = -ty, tx
            for (a_, b_) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                v.append((x + nx * a_ * T / 2, y + ny * a_ * T / 2, D / 2 + b_ * D / 2))
        for k in range(len(pts) - 1):
            for e in range(4):
                f.append((k * 4 + e, k * 4 + (e + 1) % 4, (k + 1) * 4 + (e + 1) % 4, (k + 1) * 4 + e))
        f.append((0, 3, 2, 1)); n = len(pts) - 1; f.append((n * 4, n * 4 + 1, n * 4 + 2, n * 4 + 3))
        return v, f
    parts = []
    v, f = sweep([(x, y, t) for (x, y, t) in path]); parts.append(("bend", v, f, mred))
    for idx, arm in enumerate(arms):
        red_part = [p for p in arm if p[2] == "r"]; steel_part = [arm[7]] + [p for p in arm if p[2] == "s"]
        v, f = sweep(red_part); parts.append((f"arm{idx}", v, f, mred))
        v, f = sweep(steel_part); parts.append((f"pole{idx}", v, f, mstl))
    objs = []
    for (nm, v, f, m) in parts:
        o = mesh_obj(nm, v, f, m, smooth=False)
        md = o.modifiers.new("b", "BEVEL"); md.width = 0.0012; md.segments = 3; md.limit_method = "ANGLE"
        o.modifiers.new("w", "WEIGHTED_NORMAL"); [setattr(p, "use_smooth", True) for p in o.data.polygons]
        objs.append(o)
    rig = bpy.data.objects.new("magnet", None); sc.collection.objects.link(rig)
    for o in objs: o.parent = rig
    return rig
mg = magnet()
mg.location = (MAGX, MAGY, ZB); mg.rotation_euler = (0, 0, MAGROT)

# ---------------------------------------------------------------- light: a low afternoon sun raking in from the left, a cool sky
SUNAZ = math.radians(float(E("SUNAZ", 168))); SUNEL = math.radians(float(E("SUNEL", 30)))
sd_ = Vector((math.cos(SUNEL) * math.cos(SUNAZ), math.cos(SUNEL) * math.sin(SUNAZ), math.sin(SUNEL)))
bpy.ops.object.light_add(type="SUN"); sun = bpy.context.object
sun.rotation_euler = (-sd_).to_track_quat("-Z", "Y").to_euler()
sun.data.energy = 4.2 * SUN; sun.data.angle = math.radians(0.8); sun.data.color = (1.0, 0.8, 0.58)
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
wn_ = w.node_tree; bg = wn_.nodes["Background"]
geo = wn_.nodes.new("ShaderNodeNewGeometry")
vdir = wn_.nodes.new("ShaderNodeVectorMath"); vdir.operation = "SCALE"; vdir.inputs["Scale"].default_value = -1.0
wn_.links.new(geo.outputs["Incoming"], vdir.inputs[0])
sep = wn_.nodes.new("ShaderNodeSeparateXYZ"); wn_.links.new(vdir.outputs[0], sep.inputs[0])
grad = wn_.nodes.new("ShaderNodeValToRGB"); g = grad.color_ramp
g.elements[0].position = 0.0; g.elements[0].color = (0.5, 0.52, 0.56, 1)
g.elements[1].position = 0.7; g.elements[1].color = (0.58, 0.68, 0.9, 1)
wn_.links.new(sep.outputs["Z"], grad.inputs[0]); wn_.links.new(grad.outputs[0], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 0.5 * SKY

# ---------------------------------------------------------------- camera: from the south-east, looking down across the map
cam = bpy.data.cameras.new("cam"); c = bpy.data.objects.new("cam", cam); sc.collection.objects.link(c); sc.camera = c
cam.lens = float(E("FOCAL", 70)); cam.sensor_width = 36
CAMD = float(E("CAMD", 0.47)); CAMEL = math.radians(float(E("CAMEL", 50))); CAMAZ = math.radians(float(E("CAMAZ", -78)))
target = Vector((float(E("LX", -0.002)), float(E("LY", 0.014)), 0.006))
c.location = target + CAMD * Vector((math.cos(CAMEL) * math.cos(CAMAZ), math.cos(CAMEL) * math.sin(CAMAZ), math.sin(CAMEL)))
c.rotation_euler = (target - c.location).to_track_quat("-Z", "Y").to_euler()
cam.dof.use_dof = True; cam.dof.focus_distance = (Vector((CX, CY, NZ)) - c.location).length; cam.dof.aperture_fstop = float(E("FSTOP", 4.0))

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.max_bounces = 10; cy.transmission_bounces = 8; cy.glossy_bounces = 6; cy.transparent_max_bounces = 8
cy.caustics_refractive = False; cy.caustics_reflective = False
sc.render.resolution_x = W; sc.render.resolution_y = H; sc.render.resolution_percentage = 100
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = E("LOOK", "AgX - Base Contrast"); sc.view_settings.exposure = EXPO
sc.render.filepath = OUT; sc.render.image_settings.file_format = "PNG"
bpy.ops.render.render(write_still=True)
print("wrote", OUT)
