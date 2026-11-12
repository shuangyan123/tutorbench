# Journal cover, "After You've Beaten Everyone, Then What?": an empty wooden winners' podium standing in
# a wet meadow at dawn. A medal hangs from the top step on its ribbon; nobody is there to wear it. Behind
# the podium the meadow runs on into ground mist, and a line of trees is only a darker patch of fog.
# The light is a low sun behind the mist, off to the right: the podium's fronts are in soft shade, the wet
# tops and the medal's rim catch the glow, and the grass is lit through from behind.
# usage: python podium.py OUT.png [W H SPP]
#        the cover is 900 x 1100 at 192 spp, then render/photo_finish.py into assets/journal/podium.webp
# tuning (env): EXPO SUN SKY FOG FOGH ANISO GLOW HALO DISC LOOK LENS FSTOP CAMX CAMY CAMZ TX TY TZ BLADES SUNAZ SUNEL LTX LTY FONT
import math, os, random, sys
import bpy, bmesh, addon_utils
import numpy as np
from mathutils import Vector

a = sys.argv[1:]; OUT = os.path.abspath(a[0])
W = int(a[1]) if len(a) > 1 else 900; H = int(a[2]) if len(a) > 2 else 1100; SPP = int(a[3]) if len(a) > 3 else 192
E = os.environ.get
EXPO = float(E("EXPO", -0.25)); SUN = float(E("SUN", 0.5)); SKY = float(E("SKY", 1.2))
FOG = float(E("FOG", 0.028)); FOGH = float(E("FOGH", 5.0)); BLADES = int(E("BLADES", 320000))
FONT = E("FONT", "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf")
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene; rnd = random.Random(11); rng = np.random.default_rng(11)


def principled(name, col, rough=.5, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): b.inputs[k].default_value = v
    return m, b


def obj(name, bm, m, smooth=False):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    if m is not None: o.data.materials.append(m)
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
    return o


def box(name, x0, x1, y0, y1, z0, z1, m, bevel=0.0, segs=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = x0 if v.co.x < 0 else x1; v.co.y = y0 if v.co.y < 0 else y1; v.co.z = z0 if v.co.z < 0 else z1
    o = obj(name, bm, m)
    if bevel > 0:
        md = o.modifiers.new("b", "BEVEL"); md.width = bevel; md.segments = segs; md.limit_method = "ANGLE"
        o.modifiers.new("w", "WEIGHTED_NORMAL"); [setattr(p, "use_smooth", True) for p in o.data.polygons]
    return o


def board(name, x0, x1, y0, y1, z0, z1, m, along_y=False, bevel=0.003):
    """a plank between the given world bounds, modelled around its own centre with its length on local x
    (turned a quarter about z when it runs along y), so each one gets its own grain"""
    cx, cy, cz = (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2
    lx, ly, lz = (y1 - y0, x1 - x0, z1 - z0) if along_y else (x1 - x0, y1 - y0, z1 - z0)
    o = box(name, -lx / 2, lx / 2, -ly / 2, ly / 2, -lz / 2, lz / 2, m, bevel=bevel)
    o.location = (cx, cy, cz)
    if along_y:
        o.rotation_euler = (0, 0, math.radians(90))
    return o


def ground_z(x, y):
    """the meadow floor: flat under the podium, a slow swell further out (numpy or float)"""
    r = np.sqrt(np.asarray(x) ** 2 + np.asarray(y) ** 2)
    far = np.clip((r - 3.0) / 10.0, 0, 1)
    return far * (0.18 * np.sin(x * 0.11 + 1.3) * np.cos(y * 0.07) + 0.10 * np.sin(y * 0.19 + x * 0.05))


# ---------------------------------------------------------------- materials
def wood(name, wet):
    """weathered outdoor timber: each board its own grain and tone, part silvered, part still brown;
    the top boards wet with dew"""
    m, b = principled(name, (0.3, 0.26, 0.2), 0.78 if not wet else 0.58)
    nt = m.node_tree; N_, L_ = nt.nodes, nt.links
    tc = N_.new("ShaderNodeTexCoord"); oi = N_.new("ShaderNodeObjectInfo")
    # every board is shifted to a different part of the log
    cmb = N_.new("ShaderNodeCombineXYZ")
    for i, mul_, add_ in ((0, 3.1, 0.0), (1, 0.09, 0.035), (2, 0.1, -0.05)):
        h1 = N_.new("ShaderNodeMath"); h1.operation = "MULTIPLY"; h1.inputs[1].default_value = 7.13 * (i + 1)
        h2 = N_.new("ShaderNodeMath"); h2.operation = "FRACT"
        mm = N_.new("ShaderNodeMath"); mm.operation = "MULTIPLY_ADD"; mm.inputs[1].default_value = mul_; mm.inputs[2].default_value = add_
        L_.new(oi.outputs["Random"], h1.inputs[0]); L_.new(h1.outputs[0], h2.inputs[0]); L_.new(h2.outputs[0], mm.inputs[0])
        L_.new(mm.outputs[0], cmb.inputs[i])
    vec = N_.new("ShaderNodeVectorMath"); vec.operation = "ADD"
    L_.new(tc.outputs["Object"], vec.inputs[0]); L_.new(cmb.outputs[0], vec.inputs[1])
    # growth rings: cylinders along the board (x), cut by its face into flame-shaped grain
    sq = N_.new("ShaderNodeVectorMath"); sq.operation = "MULTIPLY"; sq.inputs[1].default_value = (0.12, 1.0, 1.0)
    L_.new(vec.outputs[0], sq.inputs[0])
    wv = N_.new("ShaderNodeTexWave"); wv.wave_type = "RINGS"
    wv.inputs["Scale"].default_value = 22.0; wv.inputs["Distortion"].default_value = 9.0
    wv.inputs["Detail"].default_value = 4.0; wv.inputs["Detail Scale"].default_value = 1.5
    L_.new(sq.outputs[0], wv.inputs["Vector"])
    # fine streaks along the grain, and broad weathering patches
    st_ = N_.new("ShaderNodeVectorMath"); st_.operation = "MULTIPLY"; st_.inputs[1].default_value = (0.6, 30.0, 30.0)
    L_.new(vec.outputs[0], st_.inputs[0])
    sn = N_.new("ShaderNodeTexNoise"); sn.inputs["Scale"].default_value = 2.0; sn.inputs["Detail"].default_value = 8.0
    L_.new(st_.outputs[0], sn.inputs["Vector"])
    wn = N_.new("ShaderNodeTexNoise"); wn.inputs["Scale"].default_value = 1.6; wn.inputs["Detail"].default_value = 3.0
    L_.new(vec.outputs[0], wn.inputs["Vector"])
    # tone: brown where the board is newer, silver-grey where the weather has had it
    tone = N_.new("ShaderNodeMath"); tone.operation = "MULTIPLY_ADD"; tone.inputs[1].default_value = 1.2; tone.inputs[2].default_value = -0.45
    L_.new(oi.outputs["Random"], tone.inputs[0])
    tone2 = N_.new("ShaderNodeMath"); tone2.operation = "ADD"; tone2.use_clamp = True
    L_.new(tone.outputs[0], tone2.inputs[0]); L_.new(wn.outputs["Fac"], tone2.inputs[1])
    k_ = 0.72 if wet else 1.0
    base = N_.new("ShaderNodeMix"); base.data_type = "RGBA"
    base.inputs[6].default_value = (0.27 * k_, 0.175 * k_, 0.105 * k_, 1)
    base.inputs[7].default_value = (0.36 * k_, 0.34 * k_, 0.31 * k_, 1)
    L_.new(tone2.outputs[0], base.inputs[0])
    # the grain darkens it in lines
    gr = N_.new("ShaderNodeMapRange"); gr.inputs[3].default_value = 0.8; gr.inputs[4].default_value = 1.0
    L_.new(wv.outputs["Fac"], gr.inputs[0])
    sr = N_.new("ShaderNodeMapRange"); sr.inputs[3].default_value = 0.7; sr.inputs[4].default_value = 1.15
    L_.new(sn.outputs["Fac"], sr.inputs[0])
    dk = N_.new("ShaderNodeMath"); dk.operation = "MULTIPLY"
    L_.new(gr.outputs[0], dk.inputs[0]); L_.new(sr.outputs[0], dk.inputs[1])
    col = N_.new("ShaderNodeVectorMath"); col.operation = "SCALE"
    L_.new(base.outputs[2], col.inputs[0]); L_.new(dk.outputs[0], col.inputs["Scale"])
    L_.new(col.outputs[0], b.inputs["Base Color"])
    hb = N_.new("ShaderNodeMath"); hb.operation = "ADD"
    L_.new(wv.outputs["Fac"], hb.inputs[0]); L_.new(sn.outputs["Fac"], hb.inputs[1])
    bump = N_.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.4; bump.inputs["Distance"].default_value = 0.0015
    L_.new(hb.outputs[0], bump.inputs["Height"]); L_.new(bump.outputs[0], b.inputs["Normal"])
    if wet:
        # dew on the boards: a thin clear film, broken up, not a varnish
        b.inputs["Coat IOR"].default_value = 1.33; b.inputs["Coat Roughness"].default_value = 0.2
        dn = N_.new("ShaderNodeTexNoise"); dn.inputs["Scale"].default_value = 60.0; dn.inputs["Detail"].default_value = 4.0
        dr = N_.new("ShaderNodeMapRange"); dr.inputs[1].default_value = 0.45; dr.inputs[2].default_value = 0.62
        dr.inputs[3].default_value = 0.04; dr.inputs[4].default_value = 0.25
        L_.new(tc.outputs["Object"], dn.inputs["Vector"]); L_.new(dn.outputs["Fac"], dr.inputs[0])
        L_.new(dr.outputs[0], b.inputs["Coat Weight"])
    return m


wood_side = wood("wood", False); wood_top = wood("wood_wet", True)
# brush-painted numerals, chalky and worn through to the wood in places
paint, pb = principled("paint", (0.78, 0.77, 0.73), 0.82)
pn = paint.node_tree; pout = pn.nodes["Material Output"]
tr = pn.nodes.new("ShaderNodeBsdfTransparent"); mix = pn.nodes.new("ShaderNodeMixShader")
wn = pn.nodes.new("ShaderNodeTexNoise"); wn.inputs["Scale"].default_value = 38.0; wn.inputs["Detail"].default_value = 8.0
wr = pn.nodes.new("ShaderNodeMapRange"); wr.inputs[1].default_value = 0.30; wr.inputs[2].default_value = 0.36
ptc = pn.nodes.new("ShaderNodeTexCoord"); pn.links.new(ptc.outputs["Object"], wn.inputs["Vector"])
pn.links.new(wn.outputs["Fac"], wr.inputs[0]); pn.links.new(wr.outputs[0], mix.inputs[0])
pn.links.new(tr.outputs[0], mix.inputs[1]); pn.links.new(pb.outputs[0], mix.inputs[2]); pn.links.new(mix.outputs[0], pout.inputs["Surface"])

gold, gb = principled("gold", (1.0, 0.74, 0.36), 0.22, **{"Metallic": 1.0})
gnt = gold.node_tree
gnz = gnt.nodes.new("ShaderNodeTexNoise"); gnz.inputs["Scale"].default_value = 140.0
gbm = gnt.nodes.new("ShaderNodeBump"); gbm.inputs["Strength"].default_value = 0.08
gnt.links.new(gnz.outputs["Fac"], gbm.inputs["Height"]); gnt.links.new(gbm.outputs[0], gb.inputs["Normal"])
ribbon, rb = principled("ribbon", (0.30, 0.035, 0.045), 0.55, **{"Sheen Weight": 0.6, "Sheen Roughness": 0.4})

soil, sb = principled("soil", (0.05, 0.055, 0.03), 0.9)
snt = soil.node_tree
snz = snt.nodes.new("ShaderNodeTexNoise"); snz.inputs["Scale"].default_value = 3.0; snz.inputs["Detail"].default_value = 6.0
sramp = snt.nodes.new("ShaderNodeValToRGB"); sramp.color_ramp.elements[0].color = (0.03, 0.04, 0.02, 1); sramp.color_ramp.elements[1].color = (0.11, 0.12, 0.06, 1)
snt.links.new(snz.outputs["Fac"], sramp.inputs[0]); snt.links.new(sramp.outputs[0], sb.inputs["Base Color"])

# grass: colour per blade (a vertex colour), lit through from behind
grass = bpy.data.materials.new("grass"); grass.use_nodes = True
gn = grass.node_tree; gpb = gn.nodes["Principled BSDF"]; gout = gn.nodes["Material Output"]
att = gn.nodes.new("ShaderNodeAttribute"); att.attribute_name = "col"
gn.links.new(att.outputs["Color"], gpb.inputs["Base Color"])
gpb.inputs["Roughness"].default_value = 0.42
gpb.inputs["Coat IOR"].default_value = 1.33; gpb.inputs["Coat Roughness"].default_value = 0.04
dew = gn.nodes.new("ShaderNodeTexNoise"); dew.inputs["Scale"].default_value = 180.0; dew.inputs["Detail"].default_value = 2.0
dwr = gn.nodes.new("ShaderNodeMapRange"); dwr.inputs[1].default_value = 0.6; dwr.inputs[2].default_value = 0.7
gn.links.new(dew.outputs["Fac"], dwr.inputs[0]); gn.links.new(dwr.outputs[0], gpb.inputs["Coat Weight"])
tl = gn.nodes.new("ShaderNodeBsdfTranslucent")
hsv = gn.nodes.new("ShaderNodeHueSaturation"); hsv.inputs["Saturation"].default_value = 1.25; hsv.inputs["Value"].default_value = 1.6
gn.links.new(att.outputs["Color"], hsv.inputs["Color"]); gn.links.new(hsv.outputs[0], tl.inputs["Color"])
gmix = gn.nodes.new("ShaderNodeMixShader"); gmix.inputs[0].default_value = 0.35
gn.links.new(gpb.outputs[0], gmix.inputs[1]); gn.links.new(tl.outputs[0], gmix.inputs[2]); gn.links.new(gmix.outputs[0], gout.inputs["Surface"])

# ---------------------------------------------------------------- the podium (x across, y away from the camera, z up)
# seen from the front: second place on the left, the winner in the middle, third on the right
D = 0.72                                   # depth of every block
BLOCKS = [(-1.38, -0.46, 0.40, "2"), (-0.46, 0.46, 0.58, "1"), (0.46, 1.38, 0.28, "3")]
GAP = 0.006; BOARD = 0.022
for x0, x1, h, label in BLOCKS:
    box(f"core{label}", x0 + 0.02, x1 - 0.02, 0.02, D - 0.02, 0.0, h - BOARD, wood_side)
    # front boards, horizontal, with a small gap between them (the bottom one sits in the grass)
    n = max(2, round(h / 0.13)); bh = (h - BOARD) / n
    for k in range(n):
        board(f"front{label}{k}", x0 + 0.004, x1 - 0.004, -0.002, 0.02 + 0.002, k * bh + GAP / 2, (k + 1) * bh - GAP / 2, wood_side)
    # side boards
    for s, xs in ((-1, x0), (1, x1)):
        for k in range(n):
            board(f"side{label}{s}{k}", xs - 0.012 if s < 0 else xs - 0.02, xs + 0.02 if s < 0 else xs + 0.012, 0.02, D - 0.004,
                  k * bh + GAP / 2, (k + 1) * bh - GAP / 2, wood_side, along_y=True)
    # top boards run across, front to back, wet; a slight overhang at the front
    nb = 5; tw = D / nb
    for k in range(nb):
        board(f"top{label}{k}", x0 - 0.006, x1 + 0.006, -0.018 + k * tw + GAP / 2, (k + 1) * tw - GAP / 2 - (0.0 if k < nb - 1 else -0.01),
              h - BOARD, h, wood_top, bevel=0.004)
    # the place number, painted on the front
    cu = bpy.data.curves.new(f"num{label}", "FONT"); cu.body = label
    try:
        cu.font = bpy.data.fonts.load(FONT)
    except (RuntimeError, OSError):
        pass
    cu.size = min(0.32, h * 0.66); cu.align_x = "CENTER"; cu.align_y = "CENTER"
    t = bpy.data.objects.new(f"num{label}", cu); sc.collection.objects.link(t)
    t.location = ((x0 + x1) / 2, -0.0032, h - BOARD - cu.size * 0.56); t.rotation_euler = (math.radians(90), 0, 0)
    t.data.materials.append(paint)

TOP = BLOCKS[1][2]

# ---------------------------------------------------------------- the medal on the top step
# the ribbon is a flattened loop: two bands lying apart on the top boards, coming together over the
# front edge and hanging straight down from the overhang to the medal
RW = 0.022; ROFF = 0.24
def ribbon_strip(name, pts):
    bm = bmesh.new(); rows = []
    for (x, y, z) in pts:
        rows.append((bm.verts.new((x - RW / 2, y, z)), bm.verts.new((x + RW / 2, y, z))))
    for i in range(len(rows) - 1):
        bm.faces.new((rows[i][0], rows[i][1], rows[i + 1][1], rows[i + 1][0]))
    o = obj(name, bm, ribbon, smooth=True)
    sd = o.modifiers.new("t", "SOLIDIFY"); sd.thickness = 0.0012
    return o


MZ = TOP - 0.19; EY, EZ, ER = -0.012, TOP - 0.006, 0.0078       # the rounded front edge of the top board
for side in (-1, 1):
    pts = []
    spread = lambda u: ROFF + side * (0.026 * (1 - u) + 0.004 * u)
    for k in range(10):                                # along the top, towards the front edge
        u = k / 9; pts.append((ROFF + side * (0.06 - 0.03 * u), 0.2 - 0.21 * u, TOP + 0.0016 + 0.0012 * math.sin(k * 1.7 + side)))
    for k in range(1, 8):                              # over the edge
        th = math.radians(90 + 90 * k / 7)
        pts.append((ROFF + side * 0.028, EY + (ER + 0.0012) * math.cos(th), EZ + (ER + 0.0012) * math.sin(th)))
    for k in range(1, 12):                             # hanging, the two bands closing towards the medal
        u = k / 11
        pts.append((spread(u) if k > 0 else ROFF + side * 0.028, EY - ER - 0.0012 - 0.004 * u * u - 0.001 * side, EZ - (EZ - (MZ + 0.046)) * u))
    ribbon_strip(f"ribbon{side}", pts)
# the medal: a disc with a raised rim and a raised centre, turned a little on its ribbon
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=96, radius1=0.036, radius2=0.036, depth=0.005)
md = obj("medal", bm, gold)
bv = md.modifiers.new("b", "BEVEL"); bv.width = 0.0012; bv.segments = 3
for p in md.data.polygons: p.use_smooth = True
md.modifiers.new("w", "WEIGHTED_NORMAL")
bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=96, radius1=0.022, radius2=0.021, depth=0.0024)
mc = obj("medal_c", bm, gold, smooth=True)
bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=48, radius1=0.006, radius2=0.006, depth=0.003)
ring = obj("medal_loop", bm, gold, smooth=True)
MY = EY - ER - 0.009
for o_, dy in ((md, 0.0), (mc, -0.0028)):
    o_.location = (ROFF, MY + dy, MZ); o_.rotation_euler = (math.radians(90), 0, math.radians(float(E("MEDALTURN", 14))))
ring.location = (ROFF, MY + 0.0, MZ + 0.04); ring.rotation_euler = (0, math.radians(90), 0)

# ---------------------------------------------------------------- the meadow
# the floor: a large grid following ground_z
N = 220; S = 140.0
xs = np.linspace(-S / 2, S / 2, N + 1); ys = np.linspace(-20, S - 20, N + 1)
gx, gy = np.meshgrid(xs, ys); gz = ground_z(gx, gy)
me = bpy.data.meshes.new("ground")
verts = np.stack([gx.ravel(), gy.ravel(), gz.ravel()], 1)
ii = np.arange(N); jj = np.arange(N)
I, J = np.meshgrid(ii, jj); base = (J * (N + 1) + I).ravel()
quads = np.stack([base, base + 1, base + N + 2, base + N + 1], 1)
me.vertices.add(len(verts)); me.vertices.foreach_set("co", verts.astype(np.float32).ravel())
me.loops.add(quads.size); me.loops.foreach_set("vertex_index", quads.astype(np.int32).ravel())
me.polygons.add(len(quads)); me.polygons.foreach_set("loop_start", (np.arange(len(quads)) * 4).astype(np.int32)); me.polygons.foreach_set("loop_total", np.full(len(quads), 4, np.int32))
me.update(calc_edges=True); me.validate()
go = bpy.data.objects.new("ground", me); sc.collection.objects.link(go); go.data.materials.append(soil)

# camera first: the grass is scattered over what it can see
cam = bpy.data.cameras.new("cam"); cam.lens = float(E("LENS", 30)); cam.sensor_fit = "VERTICAL"; cam.sensor_height = 24
cam.dof.use_dof = True; cam.dof.aperture_fstop = float(E("FSTOP", 4.0))
c = bpy.data.objects.new("cam", cam); sc.collection.objects.link(c); sc.camera = c
c.location = Vector((float(E("CAMX", -1.5)), float(E("CAMY", -4.5)), float(E("CAMZ", 0.74))))
target = Vector((float(E("TX", 0.1)), float(E("TY", 0.3)), float(E("TZ", 0.72))))
c.rotation_euler = (target - c.location).to_track_quat("-Z", "Y").to_euler()
cam.dof.focus_distance = (Vector((0.0, -0.05, TOP * 0.6)) - c.location).length
fwd = (target - c.location); heading = math.atan2(fwd.y, fwd.x)
hfov = 2 * math.atan(12 * W / H / cam.lens)

# blade count by distance from the camera: dense close up, thinning out where the mist hides it
R0, R1 = 0.9, 75.0
rr = np.linspace(R0, R1, 4000); dens = np.where(rr < 6, 1.0, (6 / rr) ** 1.25)
cdf = np.cumsum(rr * dens); cdf /= cdf[-1]
r = np.interp(rng.random(BLADES), cdf, rr)
ph = heading + (rng.random(BLADES) - 0.5) * (hfov + 0.5)
bx = c.location.x + r * np.cos(ph); by = c.location.y + r * np.sin(ph)
# no grass inside the podium's footprint
inside = (bx > -1.39) & (bx < 1.39) & (by > -0.012) & (by < D + 0.005)
bx, by, r = bx[~inside], by[~inside], r[~inside]; nb = len(bx)
bz = ground_z(bx, by) - 0.01
near_podium = np.clip(np.hypot(np.clip(np.abs(bx) - 1.38, 0, None), np.clip(np.abs(by - D / 2) - D / 2, 0, None)) / 1.2, 0, 1)
clump = 0.5 + 0.5 * np.sin(bx * 1.7 + np.sin(by * 0.9) * 2.0) * np.cos(by * 1.3 + np.sin(bx * 0.7) * 1.5)
h = (0.07 + 0.15 * rng.random(nb) ** 1.6) * (0.6 + 0.75 * clump) * (0.75 + 0.25 * near_podium)
tall = (rng.random(nb) < 0.035) & (r > 2.5); h[tall] *= 1.7 + 0.8 * rng.random(tall.sum())
wd = (0.0032 + 0.0028 * rng.random(nb)) * np.maximum(1.0, r / 9.0)
yaw = rng.random(nb) * 2 * np.pi
lean = (0.15 + 0.55 * rng.random(nb) ** 2) * np.where(tall, 0.35, 1.0)
wind = 1.1 + 0.9 * np.sin(bx * 0.35 + by * 0.21)
lean_dir = np.where(rng.random(nb) < 0.55, wind + rng.normal(0, 0.5, nb), rng.random(nb) * 2 * np.pi)
T = np.array([0.0, 0.3, 0.58, 0.82]); TT = np.append(T, 1.0)
P = np.zeros((nb, 5, 3))
for k, t in enumerate(TT):
    P[:, k, 0] = bx + np.cos(lean_dir) * lean * h * t * t
    P[:, k, 1] = by + np.sin(lean_dir) * lean * h * t * t
    P[:, k, 2] = bz + h * (t - 0.35 * lean * lean * t * t)
wvec = np.stack([np.cos(yaw), np.sin(yaw), np.zeros(nb)], 1)
V = np.zeros((nb, 9, 3))
for k, t in enumerate(T):
    half = (wd * (1 - t ** 1.6) / 2)[:, None]
    V[:, 2 * k] = P[:, k] - wvec * half; V[:, 2 * k + 1] = P[:, k] + wvec * half
V[:, 8] = P[:, 4]
off = (np.arange(nb) * 9)[:, None]
qf = np.array([[0, 1, 3, 2], [2, 3, 5, 4], [4, 5, 7, 6]])
quads = (off[:, None, :] + qf[None]).reshape(-1, 4)
tris = off + np.array([[6, 7, 8]])
me = bpy.data.meshes.new("grass")
me.vertices.add(nb * 9); me.vertices.foreach_set("co", V.astype(np.float32).ravel())
loops = np.concatenate([quads.ravel(), tris.ravel()]).astype(np.int32)
me.loops.add(len(loops)); me.loops.foreach_set("vertex_index", loops)
starts = np.concatenate([np.arange(len(quads)) * 4, len(quads) * 4 + np.arange(len(tris)) * 3]).astype(np.int32)
totals = np.concatenate([np.full(len(quads), 4), np.full(len(tris), 3)]).astype(np.int32)
me.polygons.add(len(starts)); me.polygons.foreach_set("loop_start", starts); me.polygons.foreach_set("loop_total", totals)
me.update(calc_edges=True)
# colour: green with a little straw, darker at the root
hue = rng.random(nb)
base_c = np.stack([0.05 + 0.08 * hue, 0.18 + 0.08 * rng.random(nb), 0.035 + 0.02 * rng.random(nb)], 1)
straw = rng.random(nb) < 0.08; base_c[straw] = np.array([0.30, 0.26, 0.12]) * (0.7 + 0.3 * rng.random((straw.sum(), 1)))
shade = np.array([0.5, 0.5, 0.7, 0.7, 0.9, 0.9, 1.0, 1.0, 1.08])
col = base_c[:, None, :] * shade[None, :, None]
col = np.concatenate([col, np.ones((nb, 9, 1))], 2)
ca = me.color_attributes.new("col", "FLOAT_COLOR", "POINT"); ca.data.foreach_set("color", col.astype(np.float32).ravel())
for p in me.polygons: p.use_smooth = True
gro = bpy.data.objects.new("grass", me); sc.collection.objects.link(gro); gro.data.materials.append(grass)

# a few seed heads on the tall stalks
seed, _ = principled("seed", (0.32, 0.27, 0.15), 0.6, **{"Sheen Weight": 0.5})
bm = bmesh.new()
tips = np.where(tall)[0]
tips = tips[r[tips] < 14][:1400]
for i in tips:
    tip = Vector(P[i, 4]); below = Vector(P[i, 3])
    d = (tip - below).normalized(); L = 0.035 + 0.03 * rnd.random()
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.0035, radius2=0.0012, depth=L)
    q = d.to_track_quat("Z", "Y")
    for v in res["verts"]:
        v.co = q @ v.co + tip + d * (L / 2 - 0.01)
obj("seeds", bm, seed, smooth=True)


# ---------------------------------------------------------------- the trees, far back in the mist
leaf, _ = principled("leaf", (0.03, 0.045, 0.03), 0.8)
def crown(bm, cx, cy, base, hh, wide, n, sub=3):
    for j in range(n):
        rad = hh * wide * rnd.uniform(0.18, 0.32)
        res = bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=rad)
        ox, oy, oz = cx + rnd.uniform(-1, 1) * hh * wide * 0.35, cy + rnd.uniform(-1, 1) * hh * 0.2, base + hh * rnd.uniform(0.35, 0.85)
        for v in res["verts"]:
            j_ = 1 + 0.18 * (rnd.random() - 0.5)
            v.co = Vector((v.co.x * j_ + ox, v.co.y * j_ + oy, v.co.z * j_ * 1.15 + oz))


bm = bmesh.new()
x = -70.0
while x < 70:
    hh = rnd.uniform(4.5, 9.5); y = 95 + rnd.uniform(-8, 8)
    if rnd.random() < 0.8:
        crown(bm, x, y, 0.0, hh, rnd.uniform(0.7, 1.1), 8)
    x += rnd.uniform(2.5, 6.0)
# the lone tree, nearer: a broad, uneven crown of many small clumps on a forked trunk
LTX, LTY = float(E("LTX", 4.5)), float(E("LTY", 46.0))
for j in range(46):
    u = rnd.random() * 2 * math.pi; rr_ = math.sqrt(rnd.random())
    ox = LTX + math.cos(u) * rr_ * 4.2; oy = LTY + math.sin(u) * rr_ * 2.5
    oz = 4.6 + rnd.uniform(-1.0, 1.0) * 1.6 * (1 - 0.6 * rr_) + (1 - rr_) * 1.4
    res = bmesh.ops.create_icosphere(bm, subdivisions=3, radius=rnd.uniform(0.7, 1.35))
    for v in res["verts"]:
        v.co = Vector((v.co.x + ox, v.co.y + oy, v.co.z * 0.85 + oz))
for (dx, dz, tilt) in ((0, 0, 0), (-1.0, 2.6, -0.42), (1.2, 2.4, 0.5), (0.2, 2.8, 0.08)):
    L = 2.6 if dz == 0 else 2.4
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.32 if dz == 0 else 0.15, radius2=0.2 if dz == 0 else 0.06, depth=L)
    q = Vector((math.sin(tilt), 0, math.cos(tilt))).to_track_quat("Z", "Y")
    for v in res["verts"]:
        v.co = q @ (v.co + Vector((0, 0, L / 2))) + Vector((LTX + dx * 0.0, LTY, dz if dz == 0 else 2.4))
# leafy, broken edges: push every crown vertex in or out with a fractal noise
from mathutils import noise
bm.normal_update()
for v in bm.verts:
    if v.co.z > 1.0:
        n_ = noise.fractal(v.co * 0.9, 0.7, 2.2, 4) + 0.6 * noise.noise(v.co * 3.5)
        v.co += v.normal * n_ * 0.75
tro = obj("trees", bm, leaf, smooth=True)

# ---------------------------------------------------------------- light: a low sun behind the mist, and the dawn sky
SUNAZ = math.radians(float(E("SUNAZ", 58))); SUNEL = math.radians(float(E("SUNEL", 7)))
sd_ = Vector((math.cos(SUNEL) * math.cos(SUNAZ), math.cos(SUNEL) * math.sin(SUNAZ), math.sin(SUNEL)))
bpy.ops.object.light_add(type="SUN"); sun = bpy.context.object
sun.rotation_euler = (-sd_).to_track_quat("-Z", "Y").to_euler()
sun.data.energy = 18.0 * SUN; sun.data.angle = math.radians(2.5); sun.data.color = (1.0, 0.76, 0.56)

w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
wn_ = w.node_tree; bg = wn_.nodes["Background"]
geo = wn_.nodes.new("ShaderNodeNewGeometry")
vdir = wn_.nodes.new("ShaderNodeVectorMath"); vdir.operation = "SCALE"; vdir.inputs["Scale"].default_value = -1.0
wn_.links.new(geo.outputs["Incoming"], vdir.inputs[0])
sep = wn_.nodes.new("ShaderNodeSeparateXYZ"); wn_.links.new(vdir.outputs[0], sep.inputs[0])
grad = wn_.nodes.new("ShaderNodeValToRGB"); g = grad.color_ramp
g.elements[0].position = 0.0; g.elements[0].color = (0.62, 0.65, 0.78, 1)
g.elements[1].position = 0.55; g.elements[1].color = (0.33, 0.38, 0.6, 1)
e = g.elements.new(0.12); e.color = (0.52, 0.56, 0.72, 1)
wn_.links.new(sep.outputs["Z"], grad.inputs[0])
# the sun behind the mist: a wide warm glow, a tighter halo, and a small pale disc (added, not clamped)
dp = wn_.nodes.new("ShaderNodeVectorMath"); dp.operation = "DOT_PRODUCT"; dp.inputs[1].default_value = sd_
wn_.links.new(vdir.outputs[0], dp.inputs[0])
mx = wn_.nodes.new("ShaderNodeMath"); mx.operation = "MAXIMUM"; mx.inputs[1].default_value = 0.0
wn_.links.new(dp.outputs["Value"], mx.inputs[0])
acc = None
for pwr, gain in ((6.0, float(E("GLOW", 0.6))), (140.0, float(E("HALO", 3.0))), (9000.0, float(E("DISC", 30.0)))):
    pw = wn_.nodes.new("ShaderNodeMath"); pw.operation = "POWER"; pw.inputs[1].default_value = pwr
    wn_.links.new(mx.outputs[0], pw.inputs[0])
    gm = wn_.nodes.new("ShaderNodeMath"); gm.operation = "MULTIPLY"; gm.inputs[1].default_value = gain
    wn_.links.new(pw.outputs[0], gm.inputs[0])
    if acc is None:
        acc = gm
    else:
        ad = wn_.nodes.new("ShaderNodeMath"); ad.operation = "ADD"
        wn_.links.new(acc.outputs[0], ad.inputs[0]); wn_.links.new(gm.outputs[0], ad.inputs[1]); acc = ad
glow = wn_.nodes.new("ShaderNodeMix"); glow.data_type = "RGBA"; glow.blend_type = "ADD"; glow.clamp_factor = False
glow.inputs[7].default_value = (1.6, 0.9, 0.52, 1)
wn_.links.new(acc.outputs[0], glow.inputs[0])
wn_.links.new(grad.outputs[0], glow.inputs[6]); wn_.links.new(glow.outputs[2], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 0.4 * SKY

# the mist: one layer lying over the meadow, clear sky above it, so the far grass and the trees fade out
# while the sun (low, behind it) still gets through
def fog_box(name, z1, dens, col):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.remove(nt.nodes["Principled BSDF"])
    pv = nt.nodes.new("ShaderNodeVolumePrincipled")
    pv.inputs["Density"].default_value = dens; pv.inputs["Anisotropy"].default_value = float(E("ANISO", 0.4))
    pv.inputs["Color"].default_value = (*col, 1)
    nt.links.new(pv.outputs[0], nt.nodes["Material Output"].inputs["Volume"])
    return box(name, -110, 110, -30, 115, -1.0, z1, m)


fog_box("mist", FOGH, FOG, (0.86, 0.9, 1.0))

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.max_bounces = 6; cy.volume_bounces = 1; cy.transmission_bounces = 4; cy.transparent_max_bounces = 8
sc.render.resolution_x = W; sc.render.resolution_y = H; sc.render.resolution_percentage = 100
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = E("LOOK", "AgX - Medium High Contrast"); sc.view_settings.exposure = EXPO
sc.render.filepath = OUT; sc.render.image_settings.file_format = "PNG"
# where the sun lands in the frame (0..1 from the bottom left), for tuning SUNAZ / SUNEL
from bpy_extras.object_utils import world_to_camera_view
print("sun in frame at", tuple(round(v, 3) for v in world_to_camera_view(sc, c, c.location + sd_ * 200)))
bpy.ops.render.render(write_still=True)
print("wrote", OUT)
