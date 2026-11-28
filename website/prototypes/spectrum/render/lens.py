# Journal cover, "Why Learn When AI Is Smarter Than Us?": a magnifying glass propped over a fallen leaf on a
# garden stone, in summer shade. The lens has been left tilted on a pebble, and through it the leaf's veins
# open into their fine network; outside the glass the same leaf is just a green leaf. The world under the
# lens has not changed, only what can be seen of it. The light is high sun broken by a canopy overhead:
# warm dapples on the stone, the shade between them cool from the open sky.
# usage: python lens.py OUT.png [W H SPP]
#        the cover is 900 x 1100 at 160 spp, then render/photo_finish.py into assets/journal/lens.webp
# tuning (env): EXPO SUN SKY LOOK FOCAL FSTOP CAMD CAMEL CAMAZ TX TY TZ SUNAZ SUNEL GAP LIFT TILT YAW
import math, os, random, sys, tempfile
import bpy, bmesh, addon_utils
import numpy as np
from mathutils import Vector, Matrix
from PIL import Image

a = sys.argv[1:]; OUT = os.path.abspath(a[0])
W = int(a[1]) if len(a) > 1 else 900; H = int(a[2]) if len(a) > 2 else 1100; SPP = int(a[3]) if len(a) > 3 else 160
E = os.environ.get
EXPO = float(E("EXPO", -0.25)); SUN = float(E("SUN", 1.0)); SKY = float(E("SKY", 1.0))
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene; rng = np.random.default_rng(5); rnd = random.Random(5)
TMP = tempfile.mkdtemp(prefix="lens_")


def principled(name, col, rough=.5, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): b.inputs[k].default_value = v
    return m, b


def mesh_obj(name, verts, faces, m=None, smooth=True):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    if m is not None: o.data.materials.append(m)
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
    return o


# ---------------------------------------------------------------- the leaf texture (numpy): shape, veins, colour
# leaf space: u along the midrib from the stalk (0) to the tip (1), v across (-1 .. 1 at the widest point)
N = 2048
LL, LW = 0.13, 0.082          # the leaf's length and greatest width, in metres
uu, vv = np.meshgrid(np.linspace(-0.04, 1.02, N), np.linspace(-0.62, 0.62, N))   # texture covers the leaf box
# half-width along the midrib: ovate, broadest a third of the way up, drawn out into a tip
def half_width(u):
    u = np.clip(u, 0, 1)
    return 0.5 * np.sin(np.pi * u ** 0.78) ** 1.05 * (1 - 0.18 * u)
hw = half_width(uu)
# a fine double serration along the edge
ang = uu * 58.0
serr = 0.010 * (np.abs(((ang) % 1.0) - 0.5) * 2) + 0.004 * (np.abs(((ang * 2.7) % 1.0) - 0.5) * 2)
edge = hw - serr * np.clip(uu * 4, 0, 1)
inside = (np.abs(vv) < edge) & (uu > 0) & (uu < 1)
# a stalk below the blade
stalk = (uu > -0.04) & (uu <= 0.02) & (np.abs(vv) < 0.012)
alpha = (inside | stalk).astype(np.float32)

# veins: the midrib, eight pairs of secondary veins curving up towards the margin, and a fine network
vein = np.zeros_like(uu)
mid = np.exp(-(vv / 0.010) ** 2) * (1.0 - 0.6 * uu)          # thick at the base, thinner to the tip
vein = np.maximum(vein, mid)
for k in range(9):
    u0 = 0.06 + k * 0.105
    if u0 > 0.95: break
    for s in (-1, 1):
        # a vein leaving the midrib at u0 and bending towards the tip as it runs out: u = u0 + c * |v|^1.3
        t = np.abs(vv)
        curve = u0 + 0.55 * t ** 1.25 + 0.02 * np.sin(k * 1.7)
        d = np.abs(uu - curve) * (1.0 + 0.0 * t)
        side = (np.sign(vv) == s) & (t < edge * 0.96)
        w = 0.0042 * (1.0 - 0.55 * t / 0.5)
        vein = np.maximum(vein, np.where(side, np.exp(-(d / w) ** 2) * 0.72, 0))
# tertiary network: edges of a jittered grid of cells (distance to nearest minus second nearest)
cell = 0.016
gx, gy = np.floor(uu / cell), np.floor(vv / cell)
pts = rng.random((int(1.2 / cell) + 4, int(1.4 / cell) + 4, 2))
d1 = np.full(uu.shape, 9.0); d2 = np.full(uu.shape, 9.0)
for dx in (-1, 0, 1):
    for dy in (-1, 0, 1):
        ix = (gx + dx).astype(int) + 4; iy = (gy + dy).astype(int) + 44
        ix = np.clip(ix, 0, pts.shape[0] - 1); iy = np.clip(iy, 0, pts.shape[1] - 1)
        px = (gx + dx + pts[ix, iy, 0]) * cell; py = (gy + dy + pts[ix, iy, 1]) * cell
        d = np.hypot(uu - px, vv - py)
        d2 = np.where(d < d1, d1, np.minimum(d2, d)); d1 = np.minimum(d1, d)
net = np.exp(-((d2 - d1) / 0.0011) ** 2) * 0.42
# a still finer areole network inside the cells
cell2 = 0.0055
gx, gy = np.floor(uu / cell2), np.floor(vv / cell2)
pts2 = rng.random((int(1.2 / cell2) + 6, int(1.4 / cell2) + 6, 2))
d1 = np.full(uu.shape, 9.0); d2 = np.full(uu.shape, 9.0)
for dx in (-1, 0, 1):
    for dy in (-1, 0, 1):
        ix = np.clip((gx + dx).astype(int) + 8, 0, pts2.shape[0] - 1); iy = np.clip((gy + dy).astype(int) + 120, 0, pts2.shape[1] - 1)
        px = (gx + dx + pts2[ix, iy, 0]) * cell2; py = (gy + dy + pts2[ix, iy, 1]) * cell2
        d = np.hypot(uu - px, vv - py)
        d2 = np.where(d < d1, d1, np.minimum(d2, d)); d1 = np.minimum(d1, d)
net2 = np.exp(-((d2 - d1) / 0.0006) ** 2) * 0.22
vein = np.clip(np.maximum(vein, np.maximum(net, net2)), 0, 1)

# colour: a summer leaf, deeper green in the middle, a little yellow-green at the edge, a few dry spots
lo = rng.random((N // 64, N // 64)); lo = np.array(Image.fromarray(np.uint8(lo * 255)).resize((N, N), Image.BICUBIC), np.float32) / 255
spots = np.zeros_like(uu)
for _ in range(7):
    cu, cv, r = rng.uniform(0.15, 0.9), rng.uniform(-0.35, 0.35), rng.uniform(0.008, 0.02)
    spots = np.maximum(spots, np.clip(1 - np.hypot(uu - cu, vv - cv) / r, 0, 1) ** 0.6)
rim = np.clip(1 - (edge - np.abs(vv)) / 0.06, 0, 1)
deep = np.array([0.055, 0.15, 0.03]); light = np.array([0.20, 0.33, 0.06]); yel = np.array([0.42, 0.42, 0.08]); dry = np.array([0.33, 0.21, 0.07])
col = deep[None, None] * (1 - lo[..., None] * 0.5) + light[None, None] * (lo[..., None] * 0.5)
col = col * (1 - rim[..., None] * 0.45) + yel[None, None] * rim[..., None] * 0.45
col = col * (1 - spots[..., None] * 0.7) + dry[None, None] * spots[..., None] * 0.7
veincol = np.array([0.36, 0.50, 0.17])
col = col * (1 - vein[..., None] * 0.62) + veincol[None, None] * vein[..., None] * 0.62
stalkcol = np.array([0.28, 0.30, 0.09])
col = np.where(stalk[..., None] & ~inside[..., None], stalkcol[None, None], col)
rgba = np.concatenate([np.clip(col, 0, 1) ** (1 / 2.2), alpha[..., None]], -1)
Image.fromarray(np.uint8(np.flipud(rgba) * 255), "RGBA").save(os.path.join(TMP, "leaf.png"))
Image.fromarray(np.uint8(np.flipud(vein) * 255)).save(os.path.join(TMP, "veins.png"))


def img(name, linear=False):
    im = bpy.data.images.load(os.path.join(TMP, name))
    if linear: im.colorspace_settings.name = "Non-Color"
    return im


# ---------------------------------------------------------------- the leaf: a gently folded blade, its tip lifting
leafm = bpy.data.materials.new("leaf"); leafm.use_nodes = True
nt = leafm.node_tree; Nn, Ln = nt.nodes, nt.links
bsdf = Nn["Principled BSDF"]; out = Nn["Material Output"]
tx = Nn.new("ShaderNodeTexImage"); tx.image = img("leaf.png"); tx.interpolation = "Cubic"
vt = Nn.new("ShaderNodeTexImage"); vt.image = img("veins.png", True); vt.interpolation = "Cubic"
uvn = Nn.new("ShaderNodeUVMap")
Ln.new(uvn.outputs[0], tx.inputs[0]); Ln.new(uvn.outputs[0], vt.inputs[0])
Ln.new(tx.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.5; bsdf.inputs["Coat Weight"].default_value = 0.08; bsdf.inputs["Coat Roughness"].default_value = 0.45
bsdf.inputs["Subsurface Weight"].default_value = 0.0
bump = Nn.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.55; bump.inputs["Distance"].default_value = 0.0004
inv = Nn.new("ShaderNodeMath"); inv.operation = "SUBTRACT"; inv.inputs[0].default_value = 1.0
Ln.new(vt.outputs["Color"], inv.inputs[1]); Ln.new(inv.outputs[0], bump.inputs["Height"]); Ln.new(bump.outputs[0], bsdf.inputs["Normal"])
# light through the blade: a translucent layer tinted by the same texture
tr = Nn.new("ShaderNodeBsdfTranslucent")
hue = Nn.new("ShaderNodeHueSaturation"); hue.inputs["Saturation"].default_value = 1.3; hue.inputs["Value"].default_value = 1.6
Ln.new(tx.outputs["Color"], hue.inputs["Color"]); Ln.new(hue.outputs[0], tr.inputs["Color"])
mixt = Nn.new("ShaderNodeMixShader"); mixt.inputs[0].default_value = 0.28
Ln.new(bsdf.outputs[0], mixt.inputs[1]); Ln.new(tr.outputs[0], mixt.inputs[2])
tp = Nn.new("ShaderNodeBsdfTransparent")
cut = Nn.new("ShaderNodeMixShader")
Ln.new(tx.outputs["Alpha"], cut.inputs[0]); Ln.new(tp.outputs[0], cut.inputs[1]); Ln.new(mixt.outputs[0], cut.inputs[2])
Ln.new(cut.outputs[0], out.inputs["Surface"])
leafm.blend_method = "HASHED" if hasattr(leafm, "blend_method") else None

nu, nv = 140, 90
verts, faces, uvs = [], [], []
for j in range(nv + 1):
    for i in range(nu + 1):
        u = -0.04 + 1.06 * i / nu; v = -0.62 + 1.24 * j / nv
        x = u * LL; y = v * LW
        # a shallow fold along the midrib, the halves rising to the edge; the tip curls up, the stalk dips
        z = 0.0055 * (abs(v) / 0.5) ** 1.6 + 0.012 * max(0.0, u - 0.62) ** 2 / 0.14 + (0.0035 * (0.02 - u) / 0.06 if u < 0.02 else 0)
        z += 0.0016 * math.sin(u * 9.0 + v * 4.0)
        verts.append((x, y, z)); uvs.append(((u + 0.04) / 1.06, (v + 0.62) / 1.24))
for j in range(nv):
    for i in range(nu):
        k = j * (nu + 1) + i
        faces.append((k, k + 1, k + nu + 2, k + nu + 1))
leaf = mesh_obj("leaf", verts, faces, leafm)
uvl = leaf.data.uv_layers.new(name="UVMap")
for poly in leaf.data.polygons:
    for li in poly.loop_indices:
        uvl.data[li].uv = uvs[leaf.data.loops[li].vertex_index]
LEAFYAW = math.radians(float(E("LEAFYAW", 28)))
leaf.rotation_euler = (0, 0, LEAFYAW); leaf.location = (float(E("LEAFX", -0.088)), float(E("LEAFY", -0.046)), 0.0032)   # clear of the stone where the blade ripples down

# ---------------------------------------------------------------- the stone: a weathered garden slab, cool grey with lichen
stone, sb = principled("stone", (0.4, 0.41, 0.42), 0.82)
nt = stone.node_tree; Nn, Ln = nt.nodes, nt.links
tc = Nn.new("ShaderNodeTexCoord")
n1 = Nn.new("ShaderNodeTexNoise"); n1.inputs["Scale"].default_value = 9.0; n1.inputs["Detail"].default_value = 10.0; n1.inputs["Roughness"].default_value = 0.62
n2 = Nn.new("ShaderNodeTexNoise"); n2.inputs["Scale"].default_value = 140.0; n2.inputs["Detail"].default_value = 6.0
vo = Nn.new("ShaderNodeTexVoronoi"); vo.inputs["Scale"].default_value = 5.0; vo.feature = "DISTANCE_TO_EDGE"
lic = Nn.new("ShaderNodeTexVoronoi"); lic.inputs["Scale"].default_value = 11.0; lic.inputs["Randomness"].default_value = 1.0
for t_ in (n1, n2, vo, lic): Ln.new(tc.outputs["Object"], t_.inputs["Vector"])
ramp = Nn.new("ShaderNodeValToRGB"); r = ramp.color_ramp
r.elements[0].position = 0.3; r.elements[0].color = (0.36, 0.375, 0.39, 1)
r.elements[1].position = 0.7; r.elements[1].color = (0.6, 0.6, 0.58, 1)
Ln.new(n1.outputs["Fac"], ramp.inputs[0])
# fine speckle
sp = Nn.new("ShaderNodeMapRange"); sp.inputs[1].default_value = 0.35; sp.inputs[2].default_value = 0.75; sp.inputs[3].default_value = 0.78; sp.inputs[4].default_value = 1.12
Ln.new(n2.outputs["Fac"], sp.inputs[0])
c1 = Nn.new("ShaderNodeVectorMath"); c1.operation = "SCALE"
Ln.new(ramp.outputs[0], c1.inputs[0]); Ln.new(sp.outputs[0], c1.inputs["Scale"])
# pale grey-green lichen rosettes in a few places
lr = Nn.new("ShaderNodeMapRange"); lr.inputs[1].default_value = 0.16; lr.inputs[2].default_value = 0.10; lr.inputs[3].default_value = 0.0; lr.inputs[4].default_value = 1.0
Ln.new(lic.outputs["Distance"], lr.inputs[0])
lm = Nn.new("ShaderNodeMath"); lm.operation = "MULTIPLY"
gate = Nn.new("ShaderNodeMapRange"); gate.inputs[1].default_value = 0.55; gate.inputs[2].default_value = 0.62
Ln.new(lic.outputs["Color"], gate.inputs[0])
Ln.new(lr.outputs[0], lm.inputs[0]); Ln.new(gate.outputs[0], lm.inputs[1])
mixc = Nn.new("ShaderNodeMix"); mixc.data_type = "RGBA"; mixc.inputs[7].default_value = (0.5, 0.55, 0.42, 1)
Ln.new(lm.outputs[0], mixc.inputs[0]); Ln.new(c1.outputs[0], mixc.inputs[6]); Ln.new(mixc.outputs[2], sb.inputs["Base Color"])
hsum = Nn.new("ShaderNodeMath"); hsum.operation = "MULTIPLY_ADD"; hsum.inputs[1].default_value = 0.35
Ln.new(n2.outputs["Fac"], hsum.inputs[0]); Ln.new(n1.outputs["Fac"], hsum.inputs[2])
cr = Nn.new("ShaderNodeMapRange"); cr.inputs[1].default_value = 0.0; cr.inputs[2].default_value = 0.03; cr.inputs[3].default_value = -0.12; cr.inputs[4].default_value = 0.0
Ln.new(vo.outputs["Distance"], cr.inputs[0])
hs2 = Nn.new("ShaderNodeMath"); hs2.operation = "ADD"; Ln.new(hsum.outputs[0], hs2.inputs[0]); Ln.new(cr.outputs[0], hs2.inputs[1])
sbump = Nn.new("ShaderNodeBump"); sbump.inputs["Strength"].default_value = 0.6; sbump.inputs["Distance"].default_value = 0.002
Ln.new(hs2.outputs[0], sbump.inputs["Height"]); Ln.new(sbump.outputs[0], sb.inputs["Normal"])
bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=2, y_segments=2, size=0.6)
me = bpy.data.meshes.new("slab"); bm.to_mesh(me); bm.free()
slab = bpy.data.objects.new("slab", me); sc.collection.objects.link(slab); slab.data.materials.append(stone)

# ---------------------------------------------------------------- the magnifier: a biconvex glass, a dark horn rim, an ash handle
R_LENS = 0.041; T_EDGE = 0.0016; T_MID = float(E("TMID", 0.02))
# spherical caps: sag at the centre (T_MID - T_EDGE) / 2 on each side gives the radius of curvature
sag = (T_MID - T_EDGE) / 2; RC = (R_LENS ** 2 + sag ** 2) / (2 * sag)
rings, segs = 48, 160
lv, lf = [], []
for side in (1, -1):
    for i in range(1, rings + 1):
        rr = R_LENS * i / rings
        z = side * (T_EDGE / 2 + (math.sqrt(RC ** 2 - rr ** 2) - math.sqrt(RC ** 2 - R_LENS ** 2)))
        for s in range(segs):
            th = 2 * math.pi * s / segs
            lv.append((rr * math.cos(th), rr * math.sin(th), z))
for side in (1, -1):   # the two poles
    lv.append((0, 0, side * (T_EDGE / 2 + RC - math.sqrt(RC ** 2 - R_LENS ** 2))))
POLE = {0: len(lv) - 2, 1: len(lv) - 1}
ring = lambda side, i, s: side * rings * segs + (i - 1) * segs + (s % segs)
for side in (0, 1):
    for s in range(segs):
        t = (POLE[side], ring(side, 1, s), ring(side, 1, s + 1))
        lf.append(t if side == 0 else t[::-1])
    for i in range(1, rings):
        for s in range(segs):
            q = (ring(side, i, s), ring(side, i + 1, s), ring(side, i + 1, s + 1), ring(side, i, s + 1))
            lf.append(q if side == 0 else q[::-1])
for s in range(segs):   # the edge band between the two caps
    lf.append((ring(0, rings, s), ring(1, rings, s), ring(1, rings, s + 1), ring(0, rings, s + 1)))
glass = bpy.data.materials.new("glass"); glass.use_nodes = True
gn = glass.node_tree; gn.nodes.remove(gn.nodes["Principled BSDF"])
gb = gn.nodes.new("ShaderNodeBsdfGlass"); gb.inputs["IOR"].default_value = 1.52; gb.inputs["Roughness"].default_value = 0.0
gb.inputs["Color"].default_value = (0.97, 0.99, 0.98, 1)
lp = gn.nodes.new("ShaderNodeLightPath"); gt = gn.nodes.new("ShaderNodeBsdfTransparent"); gt.inputs["Color"].default_value = (0.92, 0.94, 0.93, 1)
gm = gn.nodes.new("ShaderNodeMixShader")
gn.links.new(lp.outputs["Is Shadow Ray"], gm.inputs[0]); gn.links.new(gb.outputs[0], gm.inputs[1]); gn.links.new(gt.outputs[0], gm.inputs[2])
gn.links.new(gm.outputs[0], gn.nodes["Material Output"].inputs["Surface"])
lens = mesh_obj("lens", lv, lf, glass)

horn, hb = principled("horn", (0.035, 0.024, 0.018), 0.28, **{"Coat Weight": 0.6, "Coat Roughness": 0.12})
bm = bmesh.new()
bmesh.ops.create_circle(bm, cap_ends=False, segments=8, radius=1.0)
prof = [v.co.copy() for v in bm.verts]; bm.free()
# the rim: a ring with a rounded rectangular section that holds the glass edge
rv, rf = [], []
secn = 16; rsegs = 160
for s in range(rsegs):
    th = 2 * math.pi * s / rsegs
    for k in range(secn):
        ph = 2 * math.pi * k / secn
        cx = 0.0036 * math.copysign(abs(math.cos(ph)) ** 0.6, math.cos(ph)); cz = 0.0042 * math.copysign(abs(math.sin(ph)) ** 0.6, math.sin(ph))
        rr = R_LENS + 0.0022 + cx
        rv.append((rr * math.cos(th), rr * math.sin(th), cz))
for s in range(rsegs):
    for k in range(secn):
        a0 = s * secn + k; a1 = s * secn + (k + 1) % secn; b0 = ((s + 1) % rsegs) * secn + k; b1 = ((s + 1) % rsegs) * secn + (k + 1) % secn
        rf.append((a0, b0, b1, a1))
rim = mesh_obj("rim", rv, rf, horn)

# the handle: a dark metal ferrule, then a turned walnut handle with a rounded end
ash, ab = principled("walnut", (0.2, 0.12, 0.07), 0.45, **{"Coat Weight": 0.35, "Coat Roughness": 0.25})
nt = ash.node_tree; tc = nt.nodes.new("ShaderNodeTexCoord")
wv = nt.nodes.new("ShaderNodeTexWave"); wv.wave_type = "BANDS"; wv.inputs["Scale"].default_value = 60.0; wv.inputs["Distortion"].default_value = 6.0; wv.inputs["Detail"].default_value = 3.0
mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (0.25, 1.0, 1.0)
nt.links.new(tc.outputs["Object"], mp.inputs[0]); nt.links.new(mp.outputs[0], wv.inputs["Vector"])
gr = nt.nodes.new("ShaderNodeMix"); gr.data_type = "RGBA"; gr.inputs[6].default_value = (0.24, 0.14, 0.08, 1); gr.inputs[7].default_value = (0.13, 0.075, 0.04, 1)
gm_ = nt.nodes.new("ShaderNodeMapRange"); gm_.inputs[1].default_value = 0.55; gm_.inputs[2].default_value = 1.0
nt.links.new(wv.outputs["Fac"], gm_.inputs[0]); nt.links.new(gm_.outputs[0], gr.inputs[0]); nt.links.new(gr.outputs[2], ab.inputs["Base Color"])
steel, _ = principled("steel", (0.32, 0.31, 0.3), 0.32, **{"Metallic": 1.0})
def lathe(name, profile, m, segs=48):
    """a turned part along +x: profile is [(x, radius), ...]"""
    v, f = [], []
    for (x, r_) in profile:
        for s in range(segs):
            th = 2 * math.pi * s / segs
            v.append((x, r_ * math.cos(th), r_ * math.sin(th)))
    n = len(profile)
    for i in range(n - 1):
        for s in range(segs):
            f.append((i * segs + s, i * segs + (s + 1) % segs, (i + 1) * segs + (s + 1) % segs, (i + 1) * segs + s))
    v.append((profile[0][0], 0, 0)); v.append((profile[-1][0], 0, 0)); c0, c1 = len(v) - 2, len(v) - 1
    for s in range(segs):
        f.append((c0, (s + 1) % segs, s)); f.append((c1, (n - 1) * segs + s, (n - 1) * segs + (s + 1) % segs))
    return mesh_obj(name, v, f, m)
X0 = R_LENS + 0.0055
fer = lathe("ferrule", [(X0 - 0.003, 0.0032), (X0 + 0.004, 0.0040), (X0 + 0.016, 0.0058), (X0 + 0.018, 0.0062)], steel)
hp = [(X0 + 0.018, 0.0062)]
for i in range(1, 25):
    t = i / 24; x = X0 + 0.018 + 0.098 * t
    r_ = 0.0066 + 0.0028 * math.sin(math.pi * t * 0.9) + (0.0012 * math.exp(-((t - 0.08) / 0.03) ** 2))
    if t > 0.93: r_ *= math.sqrt(max(0.0, 1 - ((t - 0.93) / 0.07) ** 2)) * 0.9 + 0.1
    hp.append((x, r_))
handle = lathe("handle", hp, ash)

# the magnifier as one rig: rim plane through the origin, handle along +x; tilt it so its far rim rests on a
# pebble and the handle's end on the stone
rig = bpy.data.objects.new("rig", None); sc.collection.objects.link(rig)
for o in (lens, rim, fer, handle): o.parent = rig
pebble, pbb = principled("pebble", (0.16, 0.175, 0.2), 0.5)
_n = pebble.node_tree; _tc = _n.nodes.new("ShaderNodeTexCoord")
_wv = _n.nodes.new("ShaderNodeTexWave"); _wv.wave_type = "BANDS"; _wv.inputs["Scale"].default_value = 0.35; _wv.inputs["Distortion"].default_value = 2.5; _wv.inputs["Detail"].default_value = 4.0
_mp = _n.nodes.new("ShaderNodeMapping"); _mp.inputs["Rotation"].default_value = (0.4, 0.9, 0.3)
_n.links.new(_tc.outputs["Object"], _mp.inputs[0]); _n.links.new(_mp.outputs[0], _wv.inputs["Vector"])
_mr = _n.nodes.new("ShaderNodeMapRange"); _mr.inputs[1].default_value = 0.93; _mr.inputs[2].default_value = 0.97
_n.links.new(_wv.outputs["Fac"], _mr.inputs[0])
_sn = _n.nodes.new("ShaderNodeTexNoise"); _sn.inputs["Scale"].default_value = 18.0; _sn.inputs["Detail"].default_value = 8.0
_n.links.new(_tc.outputs["Object"], _sn.inputs["Vector"])
_cr = _n.nodes.new("ShaderNodeValToRGB"); _cr.color_ramp.elements[0].color = (0.12, 0.135, 0.16, 1); _cr.color_ramp.elements[1].color = (0.26, 0.28, 0.3, 1)
_n.links.new(_sn.outputs["Fac"], _cr.inputs[0])
_mx = _n.nodes.new("ShaderNodeMix"); _mx.data_type = "RGBA"; _mx.inputs[7].default_value = (0.75, 0.74, 0.7, 1)
_n.links.new(_mr.outputs[0], _mx.inputs[0]); _n.links.new(_cr.outputs[0], _mx.inputs[6]); _n.links.new(_mx.outputs[2], pbb.inputs["Base Color"])
bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=4, radius=1.0)
from mathutils import noise
for v in bm.verts: v.co *= 1 + 0.06 * noise.noise(v.co * 2.0)
pm = bpy.data.meshes.new("pebble"); bm.to_mesh(pm); bm.free()
peb = bpy.data.objects.new("pebble", pm); sc.collection.objects.link(peb); peb.data.materials.append(pebble)
for p in peb.data.polygons: p.use_smooth = True
PR = float(E("PEB", 0.017))
peb.scale = (PR * 1.35, PR * 1.0, PR * 0.78)
TILT = math.radians(float(E("TILT", 7.5))); YAW = math.radians(float(E("YAW", -38.0)))
# handle end on the stone at the origin of the rig's far side: rotate about y (tilt, handle down), then yaw
rig.rotation_euler = (0, TILT, YAW)
LIFT = float(E("LIFT", 0.0)) or (R_LENS + X0 + 0.116) * math.sin(TILT) * 0.0
rig.location = (float(E("TX", 0.0)), float(E("TY", 0.0)), float(E("TZ", 0.0)))
bpy.context.view_layer.update()
# place the rig so the handle tip touches the stone, and the pebble under the far rim
Mw = rig.matrix_world
tip = Mw @ Vector((X0 + 0.116, 0, 0)); far = Mw @ Vector((-(R_LENS + 0.004), 0, -0.004))
rig.location.z += -tip.z + 0.0048
bpy.context.view_layer.update()
far = rig.matrix_world @ Vector((-(R_LENS + 0.004), 0, -0.0045))
# the pebble is as tall as the far rim is high, so the rim sits on it
PR = max(0.006, far.z / (2 * 0.5))
peb.scale = (PR * 1.25, PR * 0.95, PR * 0.5)
peb.location = (far.x - 0.006, far.y + 0.004, PR * 0.5)
print("lens centre height", round((rig.matrix_world @ Vector((0, 0, 0))).z, 4), "pebble z", round(peb.location.z, 4))

# a second pebble and a few grit grains, so the stone is a garden and not a studio table
for (x, y, s_) in ((0.15, 0.11, 0.011), (-0.19, 0.16, 0.007)):
    o = peb.copy(); o.data = peb.data; sc.collection.objects.link(o)
    o.location = (x, y, s_ * 0.5); o.scale = (s_ * 1.3, s_, s_ * 0.7); o.rotation_euler = (0, 0, rnd.random() * 3)
grit = bpy.data.meshes.new("grit"); bm = bmesh.new()
for _ in range(90):
    x, y = rnd.uniform(-0.3, 0.3), rnd.uniform(-0.25, 0.3); s_ = rnd.uniform(0.0006, 0.0018)
    res = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=s_)
    for v in res["verts"]: v.co += Vector((x, y, s_ * 0.4))
bm.to_mesh(grit); bm.free()
go = bpy.data.objects.new("grit", grit); sc.collection.objects.link(go); go.data.materials.append(pebble)

# ---------------------------------------------------------------- light: high sun through leaves overhead, cool open sky
SUNAZ = math.radians(float(E("SUNAZ", 135))); SUNEL = math.radians(float(E("SUNEL", 58)))
sd_ = Vector((math.cos(SUNEL) * math.cos(SUNAZ), math.cos(SUNEL) * math.sin(SUNAZ), math.sin(SUNEL)))
bpy.ops.object.light_add(type="SUN"); sun = bpy.context.object
sun.rotation_euler = (-sd_).to_track_quat("-Z", "Y").to_euler()
sun.data.energy = 6.5 * SUN; sun.data.angle = math.radians(0.53); sun.data.color = (1.0, 0.9, 0.74)
# the canopy: a sheet of leaf clusters well above the frame; the gaps let the sun through as dapples
canopy = bpy.data.materials.new("canopy"); canopy.use_nodes = True
cn = canopy.node_tree; cn.nodes.remove(cn.nodes["Principled BSDF"])
ctc = cn.nodes.new("ShaderNodeTexCoord")
cno = cn.nodes.new("ShaderNodeTexNoise"); cno.inputs["Scale"].default_value = float(E("CSCALE", 10.0)); cno.inputs["Detail"].default_value = 7.0; cno.inputs["Roughness"].default_value = 0.66
cn.links.new(ctc.outputs["Object"], cno.inputs["Vector"])
cmr = cn.nodes.new("ShaderNodeMapRange"); GAP = float(E("GAP", 0.58))
cmr.inputs[1].default_value = GAP - 0.012; cmr.inputs[2].default_value = GAP + 0.012
cn.links.new(cno.outputs["Fac"], cmr.inputs[0])
HOLE = float(E("HOLE", 0.075))
hd = cn.nodes.new("ShaderNodeVectorMath"); hd.operation = "DISTANCE"; cn.links.new(ctc.outputs["Object"], hd.inputs[0])
# the gap is ragged like the others: its edge pushed in and out by the same foliage noise
hn = cn.nodes.new("ShaderNodeMath"); hn.operation = "MULTIPLY_ADD"; hn.inputs[1].default_value = -0.09
cn.links.new(cno.outputs["Fac"], hn.inputs[0]); cn.links.new(hd.outputs["Value"], hn.inputs[2])
hmr = cn.nodes.new("ShaderNodeMapRange"); hmr.inputs[1].default_value = HOLE - 0.045; hmr.inputs[2].default_value = HOLE - 0.05
cn.links.new(hn.outputs[0], hmr.inputs[0])
hmx = cn.nodes.new("ShaderNodeMath"); hmx.operation = "MAXIMUM"
cn.links.new(cmr.outputs[0], hmx.inputs[0]); cn.links.new(hmr.outputs[0], hmx.inputs[1])
ctr = cn.nodes.new("ShaderNodeBsdfTransparent"); cdf = cn.nodes.new("ShaderNodeBsdfDiffuse"); cdf.inputs["Color"].default_value = (0.05, 0.09, 0.03, 1)
cmx = cn.nodes.new("ShaderNodeMixShader")
cn.links.new(hmx.outputs[0], cmx.inputs[0]); cn.links.new(cdf.outputs[0], cmx.inputs[1]); cn.links.new(ctr.outputs[0], cmx.inputs[2])
cn.links.new(cmx.outputs[0], cn.nodes["Material Output"].inputs["Surface"])
bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=2.2)
cme = bpy.data.meshes.new("canopy"); bm.to_mesh(cme); bm.free()
cano = bpy.data.objects.new("canopy", cme); sc.collection.objects.link(cano); cano.data.materials.append(canopy)
HX, HY = float(E("HX", -0.01)), float(E("HY", 0.0))
cano.location = (HX + sd_.x / sd_.z * 1.4, HY + sd_.y / sd_.z * 1.4, 1.4)
cano.visible_camera = False; cano.visible_glossy = False; cano.visible_transmission = False

w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
wn_ = w.node_tree; bg = wn_.nodes["Background"]
geo = wn_.nodes.new("ShaderNodeNewGeometry")
vdir = wn_.nodes.new("ShaderNodeVectorMath"); vdir.operation = "SCALE"; vdir.inputs["Scale"].default_value = -1.0
wn_.links.new(geo.outputs["Incoming"], vdir.inputs[0])
sep = wn_.nodes.new("ShaderNodeSeparateXYZ"); wn_.links.new(vdir.outputs[0], sep.inputs[0])
grad = wn_.nodes.new("ShaderNodeValToRGB"); g = grad.color_ramp
# open sky through the leaves: blue-grey overhead, green-tinted from the foliage round the horizon
g.elements[0].position = 0.0; g.elements[0].color = (0.34, 0.4, 0.3, 1)
g.elements[1].position = 0.6; g.elements[1].color = (0.55, 0.66, 0.85, 1)
wn_.links.new(sep.outputs["Z"], grad.inputs[0]); wn_.links.new(grad.outputs[0], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 0.42 * SKY

# ---------------------------------------------------------------- camera: close, looking down across the stone
cam = bpy.data.cameras.new("cam"); c = bpy.data.objects.new("cam", cam); sc.collection.objects.link(c); sc.camera = c
cam.lens = float(E("FOCAL", 90)); cam.sensor_width = 36
CAMD = float(E("CAMD", 0.52)); CAMEL = math.radians(float(E("CAMEL", 52))); CAMAZ = math.radians(float(E("CAMAZ", -96)))
target = Vector((float(E("LX", -0.012)), float(E("LY", -0.004)), 0.004))
c.location = target + CAMD * Vector((math.cos(CAMEL) * math.cos(CAMAZ), math.cos(CAMEL) * math.sin(CAMAZ), math.sin(CAMEL)))
c.rotation_euler = (target - c.location).to_track_quat("-Z", "Y").to_euler()
cam.dof.use_dof = True; cam.dof.focus_distance = (target - c.location).length; cam.dof.aperture_fstop = float(E("FSTOP", 5.6))

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.max_bounces = 12; cy.transmission_bounces = 12; cy.glossy_bounces = 6; cy.transparent_max_bounces = 16
cy.caustics_refractive = False; cy.caustics_reflective = False
sc.render.resolution_x = W; sc.render.resolution_y = H; sc.render.resolution_percentage = 100
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = E("LOOK", "AgX - Base Contrast"); sc.view_settings.exposure = EXPO
sc.render.filepath = OUT; sc.render.image_settings.file_format = "PNG"
bpy.ops.render.render(write_still=True)
print("wrote", OUT)
