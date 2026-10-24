# About cover, "A model can know the answer without being a good tutor.": a composing stick holding
# one line of lead type, ANSWERS ≠ TEACHING, set upside down as compositors set it; its proof,
# pulled split-fountain so the five dimension colours blend across the line; and the brayer and slab
# still wet with the same five inks. Textures from press_tex.py.
# usage: python press.py TEX_DIR OUT.png [W H SPP]
# tuning (env): EXPO FSTOP KEY KEYPOS KEYS FILL SKY STONE CAM TGT LENS FOCUS STICK STICKROT PROOF PROOFROT SLAB BRAYER BRAYROT
# published frame (1600 x 960, 160 spp, then photo_finish 0.08 1.6 86 0.92 -> assets/about/press.webp):
#   KEYPOS=-0.35,0.35,0.15 KEY=12 STICKROT=-8 SLAB=0.13,0.15,0.0 BRAYER=0.115,0.14,0.0224 PROOF=0.03,-0.064,0.0003
#   FOCUS=0,0.025,0.02 CAM=0.03,-0.21,0.29 TGT=0.04,0.022,0 LENS=40
import math, sys, os, json
import bpy, bmesh, addon_utils
from mathutils import Vector

a = sys.argv[1:]; TEX = os.path.abspath(a[0]); OUT = os.path.abspath(a[1])
W = int(a[2]) if len(a) > 2 else 900; H = int(a[3]) if len(a) > 3 else 1100; SPP = int(a[4]) if len(a) > 4 else 256
env = lambda k, d: os.environ.get(k, d)
vec = lambda k, d: Vector([float(v) for v in env(k, d).split(",")])
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene; MM = 0.001
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
LINE = "ANSWERS ≠ TEACHING"
SPEC = [(242, 72, 42), (243, 154, 18), (19, 162, 94), (45, 92, 246), (123, 62, 242)]
lin = lambda c: tuple(((v / 255 + 0.055) / 1.055) ** 2.4 for v in c)

def principled(name, col=(1, 1, 1), rough=0.5, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]; p.inputs["Base Color"].default_value = (*col, 1); p.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): p.inputs[k].default_value = v
    return m, p

def box(name, c, s, mat, parent=None, bevel=0.3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=tuple(v * MM for v in c)); o = bpy.context.object; o.name = name
    o.scale = tuple(v * MM for v in s)
    if bevel:
        bv = o.modifiers.new("b", "BEVEL"); bv.width = bevel * MM; bv.segments = 2
    o.data.materials.append(mat)
    if parent: o.parent = parent
    return o

def spectral_ink(name, axis_min, axis_max, rough=0.32, coord="Object", axis=0):
    """ink whose colour runs through the five spectral colours along one axis (mm)"""
    m = bpy.data.materials.new(name); m.use_nodes = True; N = m.node_tree.nodes; L = m.node_tree.links; p = N["Principled BSDF"]
    p.inputs["Roughness"].default_value = rough; p.inputs["Coat Weight"].default_value = 0.4
    tc = N.new("ShaderNodeTexCoord"); sep = N.new("ShaderNodeSeparateXYZ"); L.new(tc.outputs[coord], sep.inputs[0])
    mr = N.new("ShaderNodeMapRange"); mr.inputs["From Min"].default_value = axis_min * MM; mr.inputs["From Max"].default_value = axis_max * MM
    L.new(sep.outputs[axis], mr.inputs["Value"])
    ramp = N.new("ShaderNodeValToRGB"); cr = ramp.color_ramp; cr.interpolation = "EASE"
    while len(cr.elements) < len(SPEC): cr.elements.new(0.5)
    for k, c in enumerate(SPEC): cr.elements[k].position = k / (len(SPEC) - 1); cr.elements[k].color = (*lin(c), 1)
    L.new(mr.outputs[0], ramp.inputs[0]); L.new(ramp.outputs[0], p.inputs["Base Color"])
    tack(m)
    return m

def tack(m, scale=900.0, strength=0.18):
    """the orange-peel texture of tacky letterpress ink"""
    N = m.node_tree.nodes; p = N["Principled BSDF"]
    no = N.new("ShaderNodeTexNoise"); no.inputs["Scale"].default_value = scale; no.inputs["Detail"].default_value = 4.0
    bu = N.new("ShaderNodeBump"); bu.inputs["Strength"].default_value = strength
    m.node_tree.links.new(no.outputs["Fac"], bu.inputs["Height"]); m.node_tree.links.new(bu.outputs[0], p.inputs["Normal"])

# ---- materials
lead_m, _ = principled("type metal", (0.42, 0.43, 0.45), 0.38, **{"Metallic": 1.0})
steel_m, _ = principled("stick steel", (0.8, 0.81, 0.83), 0.18, **{"Metallic": 1.0, "Anisotropic": 0.5})
nick_m, _ = principled("nick", (0.12, 0.12, 0.13), 0.6, **{"Metallic": 1.0})
quad_m, _ = principled("quad", (0.36, 0.37, 0.39), 0.5, **{"Metallic": 1.0})

# ---- the composing stick and its line of type
stick = bpy.data.objects.new("stick", None); sc.collection.objects.link(stick)
EM = 12.7                                                          # 36 pt body
adv = [a * EM for a in json.load(open(os.path.join(TEX, "advances.json")))]   # from press_tex.py
span = sum(adv); x = -span / 2; LEN = span + 34
box("floor", (0, 0, 1.25), (LEN, 40, 2.5), steel_m, stick)
box("back", (0, 21.25, 11), (LEN, 2.5, 22), steel_m, stick)
box("head", (-LEN / 2 + 1.25, 0, 11), (2.5, 40, 22), steel_m, stick)
knee_x = span / 2 + 4
box("knee", (knee_x, 2, 10), (8, 36, 17), steel_m, stick)
bpy.ops.mesh.primitive_cylinder_add(radius=5 * MM, depth=6 * MM, location=(knee_x * MM, -20 * MM, 12 * MM), rotation=(math.radians(90), 0, 0)); th = bpy.context.object; th.data.materials.append(steel_m); th.parent = stick
def spec_at(t):
    """the split-fountain colour at t in [0, 1] along the line (same smoothstep blend as press_tex.py)"""
    x = min(max(t, 0), 1) * (len(SPEC) - 1); k = min(int(x), len(SPEC) - 2); u = x - k; u = u * u * (3 - 2 * u)
    return tuple(a * (1 - u) + b * u for a, b in zip(lin(SPEC[k]), lin(SPEC[k + 1])))
font = bpy.data.fonts.load(FONT)
yb = 20 - EM / 2                                                   # body centre, against the back wall
for ch, w in zip(LINE, adv):
    cx = x + w / 2
    if ch == " ":
        box("quad", (cx, yb, 2.5 + 8), (w - 0.05, EM - 0.05, 16), quad_m, stick, bevel=0.15)
    else:
        box(f"sort {ch}", (cx, yb, 2.5 + 22.3 / 2), (w - 0.05, EM - 0.05, 22.3), lead_m, stick, bevel=0.15)
        for nz in (7.0, 8.6):   # the nicks on the belly of each sort, which the compositor reads by touch
            box(f"nick {ch}", (cx, yb - EM / 2 + 0.2, 2.5 + nz), (w - 0.3, 0.5, 0.55), nick_m, stick, bevel=0)
        cu = bpy.data.curves.new(f"face {ch}", "FONT"); cu.body = ch; cu.font = font; cu.size = EM * MM
        cu.align_x = "CENTER"; cu.align_y = "CENTER"; cu.extrude = 0.5 * MM
        o = bpy.data.objects.new(f"face {ch}", cu); sc.collection.objects.link(o); o.parent = stick
        o.location = (cx * MM, yb * MM, (2.5 + 22.3 + 0.5) * MM); o.scale = (1, -1, 1)   # set upside down, as in the stick
        # each face carries the ink the fountain left at its place along the line
        o.data.materials.append(principled(f"ink {ch}", spec_at((cx + span / 2) / span), 0.28, **{"Coat Weight": 0.4})[0])
    x += w
stick.location = vec("STICK", "-0.005,0.025,0.0"); stick.rotation_euler = (0, 0, math.radians(float(env("STICKROT", -12))))

# ---- the proof
pm = bpy.data.materials.new("proof"); pm.use_nodes = True; N = pm.node_tree.nodes; L = pm.node_tree.links; pp = N["Principled BSDF"]
pp.inputs["Roughness"].default_value = 0.85
ti = N.new("ShaderNodeTexImage"); ti.image = bpy.data.images.load(os.path.join(TEX, "proof.png")); L.new(ti.outputs[0], pp.inputs["Base Color"])
tb = N.new("ShaderNodeTexImage"); tb.image = bpy.data.images.load(os.path.join(TEX, "proof_bump.png")); tb.image.colorspace_settings.name = "Non-Color"
bu = N.new("ShaderNodeBump"); bu.inputs["Strength"].default_value = 0.35; bu.inputs["Distance"].default_value = 0.0004
L.new(tb.outputs[0], bu.inputs["Height"]); L.new(bu.outputs[0], pp.inputs["Normal"])
bpy.ops.mesh.primitive_plane_add(size=1, location=tuple(vec("PROOF", "0.0,-0.06,0.0003"))); proof = bpy.context.object
proof.scale = (0.22, 0.05, 1); proof.rotation_euler = (0, 0, math.radians(float(env("PROOFROT", 3)))); proof.data.materials.append(pm)

# ---- the slab and the brayer, still wet
gl_m, _ = principled("slab glass", (0.92, 0.95, 0.96), 0.04, **{"Transmission Weight": 1.0, "IOR": 1.5})
sp = vec("SLAB", "0.10,0.13,0.0")
slab = box("slab", (sp.x / MM, sp.y / MM, 3.15), (180, 120, 6), gl_m, bevel=1.0); slab.rotation_euler = (0, 0, math.radians(8))
sm = bpy.data.materials.new("slab ink"); sm.use_nodes = True; N = sm.node_tree.nodes; L = sm.node_tree.links; sp_ = N["Principled BSDF"]
sp_.inputs["Roughness"].default_value = 0.22; sp_.inputs["Coat Weight"].default_value = 0.6
ti = N.new("ShaderNodeTexImage"); ti.image = bpy.data.images.load(os.path.join(TEX, "slab.png")); ti.extension = "CLIP"
L.new(ti.outputs[0], sp_.inputs["Base Color"]); tack(sm, 700.0, 0.25)
tr_ = N.new("ShaderNodeBsdfTransparent"); mx = N.new("ShaderNodeMixShader"); L.new(ti.outputs["Alpha"], mx.inputs[0]); L.new(tr_.outputs[0], mx.inputs[1]); L.new(sp_.outputs[0], mx.inputs[2])
L.new(mx.outputs[0], N["Material Output"].inputs[0])
bpy.ops.mesh.primitive_plane_add(size=1, location=(sp.x, sp.y, 6.3 * MM)); film = bpy.context.object; film.scale = (0.16, 0.11, 1); film.rotation_euler = (0, 0, math.radians(8 + 90)); film.data.materials.append(sm)

bray = bpy.data.objects.new("brayer", None); sc.collection.objects.link(bray)
roller_ink = spectral_ink("roller ink", -50, 50, rough=0.36, axis=0)
bpy.ops.mesh.primitive_cylinder_add(radius=16 * MM, depth=100 * MM, vertices=96, location=(0, 0, 0), rotation=(0, math.radians(90), 0)); rol = bpy.context.object
rol.data.materials.append(roller_ink); rol.parent = bray
for p in rol.data.polygons: p.use_smooth = True
# the cylinder's own z is its axis, so the ramp runs along the roller
roller_ink.node_tree.links.new(roller_ink.node_tree.nodes["Separate XYZ"].outputs[2], roller_ink.node_tree.nodes["Map Range"].inputs["Value"])
blk_m, _ = principled("black handle", (0.02, 0.02, 0.022), 0.35)
def bar(name, pts, r, mat):
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = r * MM; cu.bevel_resolution = 4; cu.use_fill_caps = True
    s = cu.splines.new("POLY"); s.points.add(len(pts) - 1)
    for p, c in zip(s.points, pts): p.co = (c[0] * MM, c[1] * MM, c[2] * MM, 1)
    o = bpy.data.objects.new(name, cu); sc.collection.objects.link(o); o.data.materials.append(mat); o.parent = bray; return o
bar("frame", [(-53, 0, 0), (-56, 0, 0), (-56, -40, 22), (-30, -70, 30), (30, -70, 30), (56, -40, 22), (56, 0, 0), (53, 0, 0)], 2.2, steel_m)
bpy.ops.mesh.primitive_cylinder_add(radius=11 * MM, depth=110 * MM, vertices=48, location=(0, -95 * MM, 38 * MM), rotation=(math.radians(-62), 0, 0)); g = bpy.context.object; g.data.materials.append(blk_m); g.parent = bray
for p in g.data.polygons: p.use_smooth = True
bray.location = vec("BRAYER", "0.085,0.12,0.0224"); bray.rotation_euler = (0, 0, math.radians(float(env("BRAYROT", 98))))   # roller axis across the bands, handle off to the right

# ---- the imposing surface: pale, cool, a little worn
tm = bpy.data.materials.new("stone"); tm.use_nodes = True; N = tm.node_tree.nodes; L = tm.node_tree.links; tp = N["Principled BSDF"]
tp.inputs["Base Color"].default_value = (*[float(v) for v in env("STONE", "0.6,0.64,0.72").split(",")], 1); tp.inputs["Roughness"].default_value = 0.55; tp.inputs["Metallic"].default_value = 0.0
no = N.new("ShaderNodeTexNoise"); no.inputs["Scale"].default_value = 300.0; no.inputs["Detail"].default_value = 8.0
bu = N.new("ShaderNodeBump"); bu.inputs["Strength"].default_value = 0.04; L.new(no.outputs["Fac"], bu.inputs["Height"]); L.new(bu.outputs[0], tp.inputs["Normal"])
bpy.ops.mesh.primitive_plane_add(size=2); bpy.context.object.data.materials.append(tm)

# ---- light
bpy.ops.object.light_add(type="AREA", location=tuple(vec("KEYPOS", "-0.45,0.3,0.35"))); key = bpy.context.object
key.data.shape = "DISK"; key.data.size = float(env("KEYS", 0.25)); key.data.energy = float(env("KEY", 8)); key.data.color = (1.0, 0.97, 0.92)
key.rotation_mode = "QUATERNION"; key.rotation_quaternion = (Vector((0, 0, 0)) - key.location).to_track_quat("-Z", "Y")
bpy.ops.object.light_add(type="AREA", location=(0.5, -0.35, 0.3)); fill = bpy.context.object
fill.data.size = 0.8; fill.data.energy = float(env("FILL", 1.5)); fill.data.color = (0.88, 0.92, 1.0)
fill.rotation_mode = "QUATERNION"; fill.rotation_quaternion = (Vector((0, 0, 0)) - fill.location).to_track_quat("-Z", "Y")
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.8, 0.84, 0.92, 1); w.node_tree.nodes["Background"].inputs[1].default_value = float(env("SKY", 0.25))

cd = bpy.data.cameras.new("c"); cd.lens = float(env("LENS", 50)); cd.clip_start = 0.01
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = vec("CAM", "0.0,-0.22,0.32")
ct = bpy.data.objects.new("ct", None); sc.collection.objects.link(ct); ct.location = vec("TGT", "0.0,0.01,0.0")
tr = cam.constraints.new("TRACK_TO"); tr.target = ct; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
cd.dof.use_dof = True; cd.dof.focus_distance = (cam.location - vec("FOCUS", "0.0,0.02,0.02")).length; cd.dof.aperture_fstop = float(env("FSTOP", 5.6))

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.max_bounces = 12; cy.transmission_bounces = 12; cy.sample_clamp_indirect = 20
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = float(env("EXPO", 0.0))
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
