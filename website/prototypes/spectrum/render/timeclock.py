# Journal cover, "Why Does Technological Progress Make Us Fear the Future?": a workshop time clock on a
# painted brick wall, between two racks of time cards. One card stands in the clock's slot; in the racks
# most pockets still hold a card, some are empty. The light is a single shaft of morning sun from a high
# window, slanting through dusty air across the wall: the dial and a few cards are in it, the rest is in the
# room's cool shade. The clock counts hours; what the hours are for is the question the essay asks.
# usage: python timeclock.py OUT.png [W H SPP]
#        the cover is 900 x 1100 at 160 spp, then render/photo_finish.py into assets/journal/timeclock.webp
# tuning (env): EXPO SUN SKY DUST LOOK FOCAL FSTOP CAMX CAMY CAMZ SUNAZ SUNEL WINX WINZ
import math, os, random, sys, tempfile
import bpy, bmesh, addon_utils
import numpy as np
from mathutils import Vector
from PIL import Image, ImageDraw, ImageFont

a = sys.argv[1:]; OUT = os.path.abspath(a[0])
W = int(a[1]) if len(a) > 1 else 900; H = int(a[2]) if len(a) > 2 else 1100; SPP = int(a[3]) if len(a) > 3 else 160
E = os.environ.get
EXPO = float(E("EXPO", 0.3)); SUN = float(E("SUN", 1.0)); SKY = float(E("SKY", 1.0)); DUST = float(E("DUST", 0.12))
FONT = E("FONT", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
MONO = E("MONO", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf")
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene; rnd = random.Random(7); rng = np.random.default_rng(7)
TMP = tempfile.mkdtemp(prefix="clock_")


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


def box(name, x0, x1, y0, y1, z0, z1, m, bevel=0.0, segs=3):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = x0 if v.co.x < 0 else x1; v.co.y = y0 if v.co.y < 0 else y1; v.co.z = z0 if v.co.z < 0 else z1
    o = obj(name, bm, m)
    if bevel > 0:
        md = o.modifiers.new("b", "BEVEL"); md.width = bevel; md.segments = segs; md.limit_method = "ANGLE"
        o.modifiers.new("w", "WEIGHTED_NORMAL"); [setattr(p, "use_smooth", True) for p in o.data.polygons]
    return o


def cyl(name, r, y0, y1, m, x=0.0, z=0.0, segs=96, bevel=0.0):
    """a disc or tube along -y (towards the camera), centred at (x, z) on the wall"""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r, depth=abs(y1 - y0))
    for v in bm.verts: v.co = Vector((v.co.x + x, (y0 + y1) / 2 + v.co.z, v.co.y + z))
    o = obj(name, bm, m, smooth=True)
    if bevel > 0:
        md = o.modifiers.new("b", "BEVEL"); md.width = bevel; md.segments = 3; md.limit_method = "ANGLE"
        o.modifiers.new("w", "WEIGHTED_NORMAL")
    return o


def textured(name, png, rough=0.6, linear=False, alpha=False, coat=0.0):
    m, b = principled(name, (1, 1, 1), rough)
    nt = m.node_tree; t = nt.nodes.new("ShaderNodeTexImage"); t.image = bpy.data.images.load(png)
    if linear: t.image.colorspace_settings.name = "Non-Color"
    uv = nt.nodes.new("ShaderNodeUVMap"); nt.links.new(uv.outputs[0], t.inputs[0])
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    if coat: b.inputs["Coat Weight"].default_value = coat
    return m, b


def card_plane(name, x0, x1, z0, z1, y, m, lean=0.0):
    """a flat card facing the camera (-y), its UVs covering the texture; lean tips the top towards the camera"""
    bm = bmesh.new()
    vs = [bm.verts.new((x0, y, z0)), bm.verts.new((x1, y, z0)), bm.verts.new((x1, y - lean, z1)), bm.verts.new((x0, y - lean, z1))]
    f = bm.faces.new(vs); uvl = bm.loops.layers.uv.new("UVMap")
    for loop, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): loop[uvl].uv = uv
    o = obj(name, bm, m)
    md = o.modifiers.new("t", "SOLIDIFY"); md.thickness = 0.0006
    return o


# ---------------------------------------------------------------- textures (PIL): the dial and the cards
def dial_png(path, S=1400):
    im = Image.new("RGB", (S, S), (236, 238, 236)); d = ImageDraw.Draw(im); c = S / 2
    f = ImageFont.truetype(FONT, int(S * 0.085)); fs = ImageFont.truetype(FONT, int(S * 0.03))
    for i in range(60):
        th = math.radians(i * 6 - 90); r0 = c * (0.84 if i % 5 else 0.78); r1 = c * 0.9
        w = 10 if i % 5 == 0 else 4
        d.line([(c + r0 * math.cos(th), c + r0 * math.sin(th)), (c + r1 * math.cos(th), c + r1 * math.sin(th))], fill=(22, 22, 24), width=w)
    for h in range(1, 13):
        th = math.radians(h * 30 - 90); r = c * 0.64
        t = str(h); bb = d.textbbox((0, 0), t, font=f)
        d.text((c + r * math.cos(th) - (bb[2] - bb[0]) / 2, c + r * math.sin(th) - (bb[3] - bb[1]) / 2 - bb[1]), t, fill=(18, 18, 20), font=f)
    # a small second register, and the maker's line left blank: only "TIME RECORDER"
    t = "TIME RECORDER"; bb = d.textbbox((0, 0), t, font=fs)
    d.text((c - (bb[2] - bb[0]) / 2, c + S * 0.17), t, fill=(60, 60, 64), font=fs)
    d.ellipse([c - c * 0.93, c - c * 0.93, c + c * 0.93, c + c * 0.93], outline=(70, 70, 74), width=6)
    # age: a faint warm stain round the edge and a few specks
    a_ = np.asarray(im, np.float32)
    yy, xx = np.mgrid[0:S, 0:S]; rr = np.hypot(xx - c, yy - c) / c
    a_ *= (1 - 0.06 * np.clip(rr - 0.6, 0, 1) ** 1.5)[..., None]
    a_ += rng.normal(0, 2.0, (S, S))[..., None]
    Image.fromarray(np.uint8(np.clip(a_, 0, 255))).save(path)


def card_png(path, k, S=(420, 900)):
    """a time card: a printed grid on white board, a number at the top, a column of stamped times"""
    w, h = S; im = Image.new("RGB", S, (232, 236, 240)); d = ImageDraw.Draw(im)
    f = ImageFont.truetype(MONO, 34); fs = ImageFont.truetype(MONO, 20); fh = ImageFont.truetype(FONT, 22)
    blue = (60, 92, 150); red = (170, 50, 60)
    d.rectangle([0, 0, w, 120], fill=(222, 228, 236))
    d.text((24, 14), "No.", fill=blue, font=fh); d.text((80, 6), f"{k:03d}", fill=(30, 34, 44), font=f)
    d.line([(24, 70), (w - 24, 70)], fill=blue, width=2)
    d.text((24, 80), "WEEK ENDING", fill=blue, font=fs)
    for i in range(16):
        y = 140 + i * 46
        d.line([(16, y), (w - 16, y)], fill=blue, width=2)
    for x in (16, 96, 258, w - 16):
        d.line([(x, 140), (x, 140 + 15 * 46)], fill=blue, width=2)
    days = ["MON", "TUE", "WED", "THU", "FRI", "SAT"]
    rows = rnd.randint(4, 11)
    for i in range(rows):
        y = 140 + i * 46 + 9
        d.text((24, y), days[(i // 2) % 6], fill=blue, font=fs)
        hh = (7 if i % 2 == 0 else 16) + rnd.choice((0, 0, 1)); mm = rnd.randint(0, 59)
        col = red if (i % 2 == 0 and hh > 7 and mm > 5) else (70, 60, 110)
        d.text((112 + rnd.randint(-4, 4), y + rnd.randint(-2, 2)), f"{hh:02d}:{mm:02d}", fill=col, font=f if False else fs)
    a_ = np.asarray(im, np.float32)
    # handling: grey thumb marks along the top edge, a softer tone overall
    yy, xx = np.mgrid[0:h, 0:w]
    a_ *= (1 - 0.08 * np.exp(-((yy - 30) / 60.0) ** 2) * (0.5 + 0.5 * np.sin(xx / 37.0 + k)))[..., None]
    a_ += rng.normal(0, 2.5, (h, w))[..., None]
    Image.fromarray(np.uint8(np.clip(a_, 0, 255))).save(path)


dial_png(os.path.join(TMP, "dial.png"))
NCARD = 14
for k in range(NCARD): card_png(os.path.join(TMP, f"card{k}.png"), 101 + k * 7 % 97)

# ---------------------------------------------------------------- the wall: brick, painted a cool pale grey-blue, worn
wall, wb = principled("wall", (0.6, 0.63, 0.66), 0.9)
nt = wall.node_tree; Nn, Ln = nt.nodes, nt.links
tc = Nn.new("ShaderNodeTexCoord")
mp = Nn.new("ShaderNodeMapping"); mp.inputs["Rotation"].default_value = (math.radians(90), 0, 0)
Ln.new(tc.outputs["Object"], mp.inputs[0])
br = Nn.new("ShaderNodeTexBrick"); br.inputs["Scale"].default_value = 1.0
br.inputs["Mortar Size"].default_value = 0.011; br.inputs["Mortar Smooth"].default_value = 0.4
br.inputs["Brick Width"].default_value = 0.23; br.inputs["Row Height"].default_value = 0.077; br.offset = 0.5
br.inputs["Color1"].default_value = (0.62, 0.65, 0.68, 1); br.inputs["Color2"].default_value = (0.56, 0.6, 0.64, 1)
br.inputs["Mortar"].default_value = (0.5, 0.52, 0.55, 1)
Ln.new(mp.outputs[0], br.inputs["Vector"])
nz = Nn.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 3.0; nz.inputs["Detail"].default_value = 10.0
Ln.new(mp.outputs[0], nz.inputs["Vector"])
# where the paint has worn through, the old red-brown brick shows
wear = Nn.new("ShaderNodeMapRange"); wear.inputs[1].default_value = 0.66; wear.inputs[2].default_value = 0.7
Ln.new(nz.outputs["Fac"], wear.inputs[0])
mx = Nn.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.inputs[7].default_value = (0.34, 0.17, 0.12, 1)
Ln.new(wear.outputs[0], mx.inputs[0]); Ln.new(br.outputs["Color"], mx.inputs[6])
fn = Nn.new("ShaderNodeTexNoise"); fn.inputs["Scale"].default_value = 90.0; fn.inputs["Detail"].default_value = 6.0
Ln.new(mp.outputs[0], fn.inputs["Vector"])
fm = Nn.new("ShaderNodeMapRange"); fm.inputs[3].default_value = 0.85; fm.inputs[4].default_value = 1.08
Ln.new(fn.outputs["Fac"], fm.inputs[0])
cs = Nn.new("ShaderNodeVectorMath"); cs.operation = "SCALE"
Ln.new(mx.outputs[2], cs.inputs[0]); Ln.new(fm.outputs[0], cs.inputs["Scale"]); Ln.new(cs.outputs[0], wb.inputs["Base Color"])
hb_ = Nn.new("ShaderNodeMath"); hb_.operation = "MULTIPLY_ADD"; hb_.inputs[1].default_value = 0.25
Ln.new(fn.outputs["Fac"], hb_.inputs[0]); Ln.new(br.outputs["Fac"], hb_.inputs[2])
wbump = Nn.new("ShaderNodeBump"); wbump.inputs["Strength"].default_value = 0.5; wbump.inputs["Distance"].default_value = 0.006
Ln.new(hb_.outputs[0], wbump.inputs["Height"]); Ln.new(wbump.outputs[0], wb.inputs["Normal"])
box("wall", -2.5, 2.5, 0.0, 0.2, -1.0, 3.5, wall)
floor_m, _ = principled("floor", (0.22, 0.22, 0.23), 0.7)
box("floor", -3, 3, -4, 0, -1.05, -1.0, floor_m)

# ---------------------------------------------------------------- the clock: a green enamel cabinet, a dial, a slot with a card
enamel, eb = principled("enamel", (0.06, 0.16, 0.14), 0.32, **{"Coat Weight": 0.5, "Coat Roughness": 0.18})
nt = enamel.node_tree; tcn = nt.nodes.new("ShaderNodeTexCoord")
en = nt.nodes.new("ShaderNodeTexNoise"); en.inputs["Scale"].default_value = 14.0; en.inputs["Detail"].default_value = 8.0
nt.links.new(tcn.outputs["Object"], en.inputs["Vector"])
er = nt.nodes.new("ShaderNodeMapRange"); er.inputs[3].default_value = 0.25; er.inputs[4].default_value = 0.45
nt.links.new(en.outputs["Fac"], er.inputs[0]); nt.links.new(er.outputs[0], eb.inputs["Roughness"])
chrome, _ = principled("chrome", (0.8, 0.8, 0.8), 0.12, **{"Metallic": 1.0})
black, _ = principled("black", (0.02, 0.02, 0.022), 0.45)
dark, _ = principled("dark", (0.012, 0.012, 0.014), 0.8)
brass, _ = principled("brass", (0.72, 0.55, 0.3), 0.3, **{"Metallic": 1.0})
CW, CD = 0.17, 0.2          # half width, depth of the cabinet
# lower body, upper dial housing (a little narrower), and a top cap
box("body", -CW, CW, -CD, 0.0, 0.0, 0.42, enamel, bevel=0.012)
box("head", -CW + 0.01, CW - 0.01, -CD + 0.015, 0.0, 0.42, 0.78, enamel, bevel=0.014)
box("cap", -CW - 0.006, CW + 0.006, -CD + 0.005, 0.0, 0.78, 0.8, enamel, bevel=0.006)
DZ = 0.6; DR = 0.125
cyl("bezel", DR + 0.012, -CD + 0.012, -CD + 0.0, chrome, z=DZ, bevel=0.004)
dm, _ = textured("dialface", os.path.join(TMP, "dial.png"), 0.4)
bm = bmesh.new(); bmesh.ops.create_circle(bm, cap_ends=True, segments=128, radius=DR)
uvl = bm.loops.layers.uv.new("UVMap")
for f in bm.faces:
    for loop in f.loops:
        loop[uvl].uv = (0.5 + loop.vert.co.x / (2 * DR) * (1 / 0.93) * 0.93 + 0.0, 0.5 + loop.vert.co.y / (2 * DR))
for v in bm.verts: v.co = Vector((v.co.x, -CD - 0.001, v.co.y + DZ))
dial = obj("dial", bm, dm)
# hands at 7:58, the minute hand nearly on the hour
def hand(name, ang_deg, L, w, y):
    th = math.radians(90 - ang_deg)
    pts = [(-w, -0.02), (w, -0.02), (w * 0.5, L), (-w * 0.5, L)]
    bm = bmesh.new()
    ux, uz = math.cos(th), math.sin(th); px_, pz_ = -uz, ux
    vs = [bm.verts.new((px_ * sx + ux * sy, y, DZ + pz_ * sx + uz * sy)) for (sx, sy) in pts]
    bm.faces.new(vs)
    o = obj(name, bm, black); md = o.modifiers.new("t", "SOLIDIFY"); md.thickness = 0.0015
    return o
hand("hour", (7 + 58 / 60) * 30, DR * 0.5, 0.006, -CD - 0.004)
hand("minute", 58 * 6, DR * 0.78, 0.004, -CD - 0.006)
cyl("pin", 0.007, -CD - 0.008, -CD - 0.002, black, z=DZ)
# the crystal over the dial
glass = bpy.data.materials.new("glass"); glass.use_nodes = True
gn = glass.node_tree; gn.nodes.remove(gn.nodes["Principled BSDF"])
gg = gn.nodes.new("ShaderNodeBsdfGlass"); gg.inputs["IOR"].default_value = 1.5
lp = gn.nodes.new("ShaderNodeLightPath"); gt = gn.nodes.new("ShaderNodeBsdfTransparent"); gm = gn.nodes.new("ShaderNodeMixShader")
gn.links.new(lp.outputs["Is Shadow Ray"], gm.inputs[0]); gn.links.new(gg.outputs[0], gm.inputs[1]); gn.links.new(gt.outputs[0], gm.inputs[2])
gn.links.new(gm.outputs[0], gn.nodes["Material Output"].inputs["Surface"])
cyl("crystal", DR + 0.002, -CD - 0.016, -CD - 0.012, glass, z=DZ)
# a small brass plate under the dial, and the slot plate in the body with its lever
box("plate", -0.05, 0.05, -CD - 0.002, -CD + 0.001, 0.445, 0.465, brass, bevel=0.002)
box("slotplate", -0.11, 0.11, -CD - 0.004, -CD + 0.002, 0.25, 0.36, chrome, bevel=0.004)
box("slot", -0.065, 0.065, -CD - 0.006, -CD - 0.0035, 0.3, 0.31, dark)
box("lever", 0.12, 0.135, -CD - 0.03, -CD, 0.15, 0.32, chrome, bevel=0.005)
cyl("knob", 0.016, -CD - 0.05, -CD - 0.028, black, x=0.1275, z=0.15)
# the card standing in the slot: its lower half inside the clock, the top above the slot
cm0, _ = textured("card_in", os.path.join(TMP, "card0.png"), 0.65)
card_plane("card_in", -0.055, 0.055, 0.12, 0.355, -CD - 0.0048, cm0)

# ---------------------------------------------------------------- the racks: steel pockets either side, cards in most of them
steel, _ = principled("steel", (0.42, 0.44, 0.45), 0.42, **{"Metallic": 0.85})
cards = [textured(f"card{k}", os.path.join(TMP, f"card{k}.png"), 0.65)[0] for k in range(NCARD)]
def rack(x0, rows=9, cols=2, empty=()):
    pw, ph = 0.118, 0.11      # pocket width, pocket pitch
    z_top = 0.95
    box(f"rackback{x0}", x0, x0 + cols * pw + 0.012, -0.012, 0.0, z_top - rows * ph - 0.03, z_top + 0.03, steel, bevel=0.003)
    k = 0
    for r_ in range(rows):
        zb = z_top - (r_ + 1) * ph
        for c_ in range(cols):
            x = x0 + 0.006 + c_ * pw
            # the pocket front: a folded strip
            box(f"lip{x0}_{r_}_{c_}", x + 0.004, x + pw - 0.004, -0.032, -0.026, zb, zb + 0.05, steel, bevel=0.002)
            box(f"lipb{x0}_{r_}_{c_}", x + 0.004, x + pw - 0.004, -0.032, -0.012, zb - 0.002, zb + 0.002, steel)
            if (r_, c_) in empty: continue
            m = cards[rnd.randrange(NCARD)]
            tall = 0.2 + rnd.uniform(-0.01, 0.01); lean = rnd.uniform(0.004, 0.012)
            card_plane(f"c{x0}_{r_}_{c_}", x + 0.009 + rnd.uniform(-0.002, 0.002), x + pw - 0.009, zb + 0.004, zb + tall * 0.55, -0.02, m, lean)
            k += 1
LX = -CW - 0.05 - 2 * 0.118 - 0.012
rack(LX, empty={(1, 0), (3, 1), (4, 0), (6, 1), (7, 0), (8, 1)})
rack(CW + 0.05, empty={(0, 1), (2, 0), (2, 1), (5, 0), (6, 0), (7, 1)})

# ---------------------------------------------------------------- light: one shaft of sun from a high window, dust in the air
SUNAZ = math.radians(float(E("SUNAZ", -128))); SUNEL = math.radians(float(E("SUNEL", 34)))
sd_ = Vector((math.cos(SUNEL) * math.cos(SUNAZ), math.cos(SUNEL) * math.sin(SUNAZ), math.sin(SUNEL)))
bpy.ops.object.light_add(type="SUN"); sun = bpy.context.object
sun.rotation_euler = (-sd_).to_track_quat("-Z", "Y").to_euler()
sun.data.energy = 12.0 * SUN; sun.data.angle = math.radians(0.6); sun.data.color = (1.0, 0.86, 0.66)
# the room: a high ceiling with one skylight stops the sun everywhere but the shaft
shade, _ = principled("room", (0.5, 0.52, 0.55), 0.9)
WX, WZ = float(E("WINX", -0.02)), float(E("WINZ", 0.6))       # where the shaft's centre lands on the clock's face
WW, WH = float(E("WINW", 0.62)), float(E("WINH", 0.85))          # the skylight, across and along the room
CZ = 3.2
t = (CZ - WZ) / sd_.z
t = (CZ - WZ) / sd_.z
wc = Vector((WX, -CD, WZ)) + sd_ * t
print("skylight centre", tuple(round(v, 2) for v in wc))
def slab(name, x0, x1, y0, y1):
    o = box(name, x0, x1, y0, y1, CZ, CZ + 0.05, shade); o.visible_camera = False; return o
slab("c_left", -8, wc.x - WW / 2, -8, 0.2)
slab("c_right", wc.x + WW / 2, 8, -8, 0.2)
slab("c_front", wc.x - WW / 2, wc.x + WW / 2, -8, wc.y - WH / 2)
slab("c_back", wc.x - WW / 2, wc.x + WW / 2, wc.y + WH / 2, 0.2)
for i in (1, 2):    # glazing bars
    yy = wc.y - WH / 2 + i * WH / 3
    o = box(f"bar{i}", wc.x - WW / 2, wc.x + WW / 2, yy - 0.014, yy + 0.014, CZ - 0.01, CZ + 0.04, shade); o.visible_camera = False
o = box("barv", wc.x - 0.014, wc.x + 0.014, wc.y - WH / 2, wc.y + WH / 2, CZ - 0.01, CZ + 0.04, shade); o.visible_camera = False
# the rest of the room, out of sight: side walls and the wall behind the camera close it in
for (nm, x0, x1, y0, y1) in (("r_left", -4.2, -4.0, -8, 0.2), ("r_right", 4.0, 4.2, -8, 0.2), ("r_back", -4.2, 4.2, -6.2, -6.0)):
    o = box(nm, x0, x1, y0, y1, -1.0, CZ + 0.05, shade); o.visible_camera = False
# dust: a thin haze filling the room, so the shaft shows
dm_ = bpy.data.materials.new("dust"); dm_.use_nodes = True
dn = dm_.node_tree; dn.nodes.remove(dn.nodes["Principled BSDF"])
pv = dn.nodes.new("ShaderNodeVolumePrincipled"); pv.inputs["Density"].default_value = DUST; pv.inputs["Anisotropy"].default_value = 0.45
pv.inputs["Color"].default_value = (0.95, 0.94, 0.92, 1)
dn.links.new(pv.outputs[0], dn.nodes["Material Output"].inputs["Volume"])
box("haze", -4, 4, -6, -0.001, -0.99, CZ - 0.02, dm_)

w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes["Background"]; bg.inputs["Color"].default_value = (0.62, 0.7, 0.86, 1)
bg.inputs["Strength"].default_value = 0.1 * SKY
# soft fill from the room behind the camera: daylight bounced off the opposite wall
bpy.ops.object.light_add(type="AREA"); fill = bpy.context.object
fill.data.shape = "RECTANGLE"; fill.data.size = 3.0; fill.data.size_y = 2.0; fill.data.energy = 11.0 * SKY
fill.data.color = (0.78, 0.84, 0.96); fill.location = (0.6, -3.2, 1.2)
fill.rotation_euler = (Vector((0, 0, 0.5)) - fill.location).to_track_quat("-Z", "Y").to_euler()
fill.visible_camera = False

# ---------------------------------------------------------------- camera
cam = bpy.data.cameras.new("cam"); c = bpy.data.objects.new("cam", cam); sc.collection.objects.link(c); sc.camera = c
cam.lens = float(E("FOCAL", 50)); cam.sensor_width = 36
c.location = (float(E("CAMX", -0.22)), float(E("CAMY", -1.85)), float(E("CAMZ", 0.42)))
target = Vector((float(E("TX", 0.0)), 0.0, float(E("TZ", 0.47))))
c.rotation_euler = (target - c.location).to_track_quat("-Z", "Y").to_euler()
cam.dof.use_dof = True; cam.dof.focus_distance = (Vector((0, -CD, 0.5)) - c.location).length; cam.dof.aperture_fstop = float(E("FSTOP", 5.6))

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.max_bounces = 8; cy.volume_bounces = 1; cy.transmission_bounces = 6; cy.transparent_max_bounces = 8
cy.caustics_refractive = False; cy.caustics_reflective = False
sc.render.resolution_x = W; sc.render.resolution_y = H; sc.render.resolution_percentage = 100
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = E("LOOK", "AgX - Medium High Contrast"); sc.view_settings.exposure = EXPO
sc.render.filepath = OUT; sc.render.image_settings.file_format = "PNG"
bpy.ops.render.render(write_still=True)
print("wrote", OUT)
