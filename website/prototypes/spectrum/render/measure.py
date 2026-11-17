# Work with us cover, "made to measure" (量体裁衣): a paper pattern piece pinned to a length of wool
# twill, a tailor's tape measure laid across it with its brass end near the cut edge and a half twist
# showing the inch side, and five glass-headed pins in the five dimension colours: three through the
# seam allowance, two loose. Textures from measure_tex.py.
# Light: soft north-window daylight low from the upper left, a cool sky, a faint peach glow on the right.
# usage: python measure.py TEX_DIR OUT.png [W H SPP]
# tuning (env, defaults are the published frame): EXPO FSTOP SKY POWER GLOW CAM TGT LENS PROT;
# NORENDER=1 builds the scene without rendering it
import json, math, os, sys
import bpy, bmesh, addon_utils
import numpy as np
from mathutils import Vector, Matrix

a = sys.argv[1:]; TEX = os.path.abspath(a[0]); OUT = os.path.abspath(a[1])
W = int(a[2]) if len(a) > 2 else 900; H = int(a[3]) if len(a) > 3 else 1100; SPP = int(a[4]) if len(a) > 4 else 192
env = lambda k, d: os.environ.get(k, d)
vec = lambda k, d: Vector([float(v) for v in env(k, d).split(",")])
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene; MM = 0.001

def principled(name, col, rough=0.5, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]; p.inputs["Base Color"].default_value = (*col, 1); p.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): p.inputs[k].default_value = v
    return m, p

def catmull(pts, step=1.0 * MM):
    P = [pts[0] * 2 - pts[1]] + list(pts) + [pts[-1] * 2 - pts[-2]]; out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        n = max(2, int((p2 - p1).length / step))
        for k in range(n):
            u = k / n
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3))
    out.append(P[-2]); return out

# ---- the pattern piece: dot-and-cross paper cut to the bodice outline from measure_tex.py
spec = json.load(open(os.path.join(TEX, "piece.json")))
PW, PH = spec["sheet_mm"]; outline = spec["outline_mm"]
PROT = math.radians(float(env("PROT", -7)))
POFF = vec("POFF", "-0.024,0.030,0")
PT = 0.11 * MM
cu = bpy.data.curves.new("piece", "CURVE"); cu.dimensions = "2D"; cu.fill_mode = "BOTH"; cu.extrude = PT / 2
sp = cu.splines.new("POLY"); sp.points.add(len(outline) - 1); sp.use_cyclic_u = True
for p, (x, y) in zip(sp.points, outline): p.co = (x * MM, y * MM, 0, 1)
piece = bpy.data.objects.new("piece", cu); sc.collection.objects.link(piece)
bpy.context.view_layer.objects.active = piece; piece.select_set(True); bpy.ops.object.convert(target="MESH")
bm = bmesh.new(); bm.from_mesh(piece.data)
for x in np.linspace(-PW / 2, PW / 2, 56):
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(x * MM, 0, 0), plane_no=(1, 0, 0))
for y in np.linspace(-PH / 2, PH / 2, 70):
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, y * MM, 0), plane_no=(0, 1, 0))
bmesh.ops.triangulate(bm, faces=bm.faces[:])
uv = bm.loops.layers.uv.active or bm.loops.layers.uv.new("UV")
for f in bm.faces:
    for l in f.loops: l[uv].uv = ((l.vert.co.x / MM + PW / 2) / PW, (l.vert.co.y / MM + PH / 2) / PH)
for v in bm.verts:
    x, y = v.co.x / MM, v.co.y / MM
    # the shoulder corner has curled up off the cloth a little; the rest lies flat with a faint ripple
    lift = max(0.0, (y - 95) / 60) ** 2 * max(0.0, (x - 0) / 80) * 2.6
    v.co.z += PT / 2 + lift * MM + 0.06 * MM * math.sin(x / 23) * math.sin(y / 31)
bm.to_mesh(piece.data); bm.free()
for p in piece.data.polygons: p.use_smooth = True
piece.rotation_euler = (0, 0, PROT); piece.location = POFF
pm, pp = principled("paper", (0.9, 0.9, 0.92), 0.82, **{"Subsurface Weight": 0.12})
pp.inputs["Subsurface Radius"].default_value = (0.004, 0.004, 0.004)
t = pm.node_tree
tx = t.nodes.new("ShaderNodeTexImage"); tx.image = bpy.data.images.load(os.path.join(TEX, "piece.png")); tx.interpolation = "Cubic"
t.links.new(tx.outputs["Color"], pp.inputs["Base Color"])
gm = t.nodes.new("ShaderNodeTexImage"); gm.image = bpy.data.images.load(os.path.join(TEX, "piece_graphite.png")); gm.image.colorspace_settings.name = "Non-Color"
rr = t.nodes.new("ShaderNodeMapRange"); rr.inputs["To Min"].default_value = 0.82; rr.inputs["To Max"].default_value = 0.45
t.links.new(gm.outputs["Color"], rr.inputs["Value"]); t.links.new(rr.outputs["Result"], pp.inputs["Roughness"])
fib = t.nodes.new("ShaderNodeTexNoise"); fib.inputs["Scale"].default_value = 2600; fib.inputs["Detail"].default_value = 6
tc = t.nodes.new("ShaderNodeTexCoord"); t.links.new(tc.outputs["Object"], fib.inputs[0])
bp = t.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.05; bp.inputs["Distance"].default_value = 0.0003
t.links.new(fib.outputs["Fac"], bp.inputs["Height"]); t.links.new(bp.outputs[0], pp.inputs["Normal"])
piece.data.materials.append(pm)

def on_piece(x, y, z=0.0):
    """piece-local mm to world"""
    c, s = math.cos(PROT), math.sin(PROT)
    return Vector((c * x * MM - s * y * MM, s * x * MM + c * y * MM, z)) + POFF

# ---- the tape measure: 16 mm glass-fibre tape, cm on the front, inches on the back, brass end
TW, TT = 16 * MM, 0.42 * MM
TL = 760 * MM                                # length of the textures
ctrl = [Vector((x * MM, y * MM, 0)) for x, y in
        [(-34, -98), (8, -103), (50, -100), (88, -88), (114, -60), (124, -22), (114, 18), (94, 50), (90, 86), (106, 122), (138, 152), (178, 186), (232, 236), (282, 290)]]
path = catmull(ctrl, 0.8 * MM)
arc = [0.0]
for i in range(1, len(path)): arc.append(arc[-1] + (path[i] - path[i - 1]).length)
TWIST0, TWIST1 = float(env("TWIST0", 205)) * MM, float(env("TWIST1", 262)) * MM
def roll(s):
    if s <= TWIST0: return 0.0
    if s >= TWIST1: return math.pi
    u = (s - TWIST0) / (TWIST1 - TWIST0); return math.pi * (u * u * (3 - 2 * u))
me = bpy.data.meshes.new("tape"); bm = bmesh.new()
uvl = bm.loops.layers.uv.new("UV")
rings = []
for i, (p, s) in enumerate(zip(path, arc)):
    tg = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]); tg.z = 0; tg.normalize()
    side0 = Vector((0, 0, 1)).cross(tg).normalized()
    r = roll(s)
    side = side0 * math.cos(r) + Vector((0, 0, 1)) * math.sin(r)
    up = tg.cross(side).normalized()
    if up.z < 0 and abs(math.sin(r)) < 0.99: pass
    c = p + Vector((0, 0, PT + TT / 2 + 0.08 * MM + (TW / 2) * abs(math.sin(r))))
    up_ = side.cross(tg) * -1                     # the face normal of the front
    corners = [c + side * TW / 2 + up_ * TT / 2, c - side * TW / 2 + up_ * TT / 2, c - side * TW / 2 - up_ * TT / 2, c + side * TW / 2 - up_ * TT / 2]
    rings.append(([bm.verts.new(q) for q in corners], s))
for (r0, s0), (r1, s1) in zip(rings, rings[1:]):
    u0, u1 = s0 / TL, s1 / TL
    def quad(a, b, mat, uva):
        f = bm.faces.new((r0[a], r1[a], r1[b], r0[b])); f.material_index = mat
        for l, uvv in zip(f.loops, uva): l[uvl].uv = uvv
    quad(1, 0, 0, [(u0, 0), (u1, 0), (u1, 1), (u0, 1)])          # front face
    quad(3, 2, 1, [(u0, 1), (u1, 1), (u1, 0), (u0, 0)])          # back face (mirrored across)
    quad(0, 3, 2, [(u0, 0), (u1, 0), (u1, 1), (u0, 1)])          # edges
    quad(2, 1, 2, [(u0, 0), (u1, 0), (u1, 1), (u0, 1)])
bm.normal_update(); bm.to_mesh(me); bm.free()
tape = bpy.data.objects.new("tape", me); sc.collection.objects.link(tape)
for p in me.polygons: p.use_smooth = True
def tapemat(name, img):
    m, p = principled(name, (0.9, 0.9, 0.88), 0.36, **{"Coat Weight": 0.25, "Coat Roughness": 0.25})
    t = m.node_tree; tx = t.nodes.new("ShaderNodeTexImage"); tx.image = bpy.data.images.load(os.path.join(TEX, img)); tx.interpolation = "Cubic"
    t.links.new(tx.outputs["Color"], p.inputs["Base Color"]); return m
fm = tapemat("tape_cm", "tape_cm.png"); bkm = tapemat("tape_in", "tape_in.png")
edm, _ = principled("tape_edge", (0.86, 0.86, 0.84), 0.45)
for m in (fm, bkm, edm): tape.data.materials.append(m)
# fix the face orientation so the front faces up where the tape lies flat
bpy.context.view_layer.objects.active = tape
bpy.ops.object.select_all(action="DESELECT"); tape.select_set(True)
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode="OBJECT")

# brass end cap, folded over both faces, two rivets
tg0 = (path[3] - path[0]).normalized(); side0 = Vector((0, 0, 1)).cross(tg0).normalized()
CAP = 7.5 * MM
cc = path[0] + tg0 * (CAP / 2 - 0.6 * MM) + Vector((0, 0, PT + TT / 2 + 0.08 * MM))
bpy.ops.mesh.primitive_cube_add(size=1, location=cc); cap = bpy.context.object
cap.scale = (CAP, TW + 0.7 * MM, TT + 0.55 * MM); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
cap.rotation_euler = (0, 0, math.atan2(tg0.y, tg0.x))
bv = cap.modifiers.new("b", "BEVEL"); bv.width = 0.25 * MM; bv.segments = 3
brass, bp_ = principled("brass", (0.80, 0.60, 0.34), 0.3, **{"Metallic": 1.0})
cap.data.materials.append(brass)
for o in (-1, 1):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.1 * MM, location=cc + side0 * o * 4.6 * MM + Vector((0, 0, (TT + 0.55 * MM) / 2 - 0.55 * MM)))
    rv = bpy.context.object; rv.scale = (1, 1, 0.45); rv.data.materials.append(brass)
    for p in rv.data.polygons: p.use_smooth = True

# ---- five glass-headed pins: three through the seam allowance, two loose on the paper
GEMS = [("ruby", (0.62, 0.03, 0.03)), ("citrine", (0.95, 0.52, 0.04)), ("emerald", (0.02, 0.46, 0.20)),
        ("sapphire", (0.04, 0.14, 0.78)), ("amethyst", (0.30, 0.06, 0.72))]
steel, _ = principled("steel", (0.78, 0.79, 0.81), 0.22, **{"Metallic": 1.0})
def glass(name, col):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*col, 1); p.inputs["Roughness"].default_value = 0.04
    p.inputs["Transmission Weight"].default_value = 1.0; p.inputs["IOR"].default_value = 1.52
    vol = nt.nodes.new("ShaderNodeVolumeAbsorption"); vol.inputs["Color"].default_value = (*col, 1); vol.inputs["Density"].default_value = 260
    nt.links.new(vol.outputs[0], nt.nodes["Material Output"].inputs["Volume"]); return m
HEAD, SHAFT, SR = 2.1 * MM, 32 * MM, 0.30 * MM
def pin(head, toward, rise, mat):
    """a pin with its head centre at `head`, its shaft running towards `toward` (xy) and falling `rise`"""
    d = Vector((toward.x - head.x, toward.y - head.y, 0)).normalized()
    d = (d * math.cos(rise) - Vector((0, 0, 1)) * math.sin(rise)).normalized()
    mid = head + d * (SHAFT / 2)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=SR, depth=SHAFT, location=mid); sh = bpy.context.object
    sh.rotation_mode = "QUATERNION"; sh.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    sh.data.materials.append(steel)
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=SR, radius2=0.02 * MM, depth=1.6 * MM, location=head + d * (SHAFT + 0.8 * MM)); tip = bpy.context.object
    tip.rotation_mode = "QUATERNION"; tip.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d); tip.data.materials.append(steel)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=HEAD, location=head); hd = bpy.context.object
    hd.data.materials.append(mat)
    for o in (sh, tip, hd):
        for p in o.data.polygons: p.use_smooth = True
mats = [glass(n, c) for n, c in GEMS]
# pinned: heads outside the cut edge on the cloth, shafts in through the seam allowance
for (lx, ly, ang), m in zip([(118, -85, 181), (119, -40, 178), (118, 5, 183)], (mats[0], mats[2], mats[4])):
    hx, hy = lx, ly
    head = on_piece(hx, hy, HEAD + 0.05 * MM)
    to = on_piece(hx + 30 * math.cos(math.radians(ang)), hy + 30 * math.sin(math.radians(ang)))
    pin(head, to, math.radians(7.5), m)
# loose: lying on the paper, the shaft resting on it
for (x, y, ang), m in zip([(-2, -62, 24), (22, -40, 150)], (mats[1], mats[3])):
    head = Vector((x * MM, y * MM, PT + HEAD + 0.02 * MM)) + Vector((0, 0, 0))
    to = Vector(((x + 30 * math.cos(math.radians(ang))) * MM, (y + 30 * math.sin(math.radians(ang))) * MM, 0))
    pin(head, to, math.atan2(HEAD - SR, SHAFT), m)

# ---- the cloth: a periwinkle wool twill, flat where the work lies, soft folds beyond
cw = 1.2
xs = np.linspace(-cw / 2, cw / 2, 400); ys = np.linspace(-cw / 2, cw / 2, 400)
X, Y = np.meshgrid(xs, ys)
rng = np.random.default_rng(11)
Z = sum(rng.uniform(0.6, 1.6) * MM * np.sin(X * rng.uniform(6, 18) * math.cos(th) + Y * rng.uniform(6, 18) * math.sin(th) + rng.uniform(0, 6.3))
        for th in rng.uniform(0, math.pi, 6))
R = np.hypot(X - 0.0, (Y - 0.02) * 0.8)
Z = Z * np.clip((R - 0.20) / 0.12, 0, 1) ** 2 - 0.02 * MM
verts = np.stack([X, Y, Z], -1).reshape(-1, 3); nx = len(xs)
faces = [(j * nx + i, j * nx + i + 1, (j + 1) * nx + i + 1, (j + 1) * nx + i) for j in range(nx - 1) for i in range(nx - 1)]
me = bpy.data.meshes.new("cloth"); me.from_pydata(verts.tolist(), [], faces); me.update()
for p in me.polygons: p.use_smooth = True
cloth = bpy.data.objects.new("cloth", me); sc.collection.objects.link(cloth)
lm, lp = principled("twill", (0.42, 0.47, 0.66), 0.92, **{"Sheen Weight": 0.5, "Sheen Roughness": 0.35})
t = lm.node_tree; tc = t.nodes.new("ShaderNodeTexCoord")
tw = t.nodes.new("ShaderNodeTexWave"); tw.wave_type = "BANDS"; tw.bands_direction = "DIAGONAL"; tw.inputs["Scale"].default_value = 900; tw.inputs["Distortion"].default_value = 1.5; tw.inputs["Detail"].default_value = 3
yn = t.nodes.new("ShaderNodeTexNoise"); yn.inputs["Scale"].default_value = 4000; yn.inputs["Detail"].default_value = 8
mott = t.nodes.new("ShaderNodeTexNoise"); mott.inputs["Scale"].default_value = 40; mott.inputs["Detail"].default_value = 6
for x in (tw, yn, mott): t.links.new(tc.outputs["Object"], x.inputs[0])
mx = t.nodes.new("ShaderNodeMath"); mx.operation = "ADD"; t.links.new(tw.outputs["Fac"], mx.inputs[0]); t.links.new(yn.outputs["Fac"], mx.inputs[1])
bp = t.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.45; bp.inputs["Distance"].default_value = 0.0004
t.links.new(mx.outputs[0], bp.inputs["Height"]); t.links.new(bp.outputs[0], lp.inputs["Normal"])
ramp = t.nodes.new("ShaderNodeValToRGB"); e = ramp.color_ramp.elements
e[0].color = (0.26, 0.30, 0.52, 1); e[1].color = (0.34, 0.39, 0.62, 1)
t.links.new(mott.outputs["Fac"], ramp.inputs[0]); t.links.new(ramp.outputs[0], lp.inputs["Base Color"])
cloth.data.materials.append(lm)

# ---- light: a north window low on the upper left, a cool sky, a faint peach glow from the right
bpy.ops.object.light_add(type="AREA", location=tuple(vec("LAMP", "-0.55,0.24,0.13"))); win = bpy.context.object
win.data.shape = "RECTANGLE"; win.data.size = 0.55; win.data.size_y = 0.36; win.data.energy = float(env("POWER", 6)); win.data.color = (0.97, 0.98, 1.0); win.data.spread = math.radians(float(env("SPREAD", 40)))
win.rotation_mode = "QUATERNION"; win.rotation_quaternion = (Vector((0, 0, 0)) - win.location).to_track_quat("-Z", "Y")
bpy.ops.object.light_add(type="AREA", location=(0.45, 0.30, 0.14)); bounce = bpy.context.object
bounce.data.size = 0.3; bounce.data.energy = float(env("GLOW", 1.2)); bounce.data.color = (1.0, 0.78, 0.68); bounce.data.spread = math.radians(70)
bounce.rotation_mode = "QUATERNION"; bounce.rotation_quaternion = (Vector((0, 0, 0)) - bounce.location).to_track_quat("-Z", "Y")
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.62, 0.68, 0.86, 1); w.node_tree.nodes["Background"].inputs[1].default_value = float(env("SKY", 0.05))

cd = bpy.data.cameras.new("c"); cd.lens = float(env("LENS", 70)); cd.clip_start = 0.01
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = vec("CAM", "0.05,-0.31,0.40")
ct = bpy.data.objects.new("ct", None); sc.collection.objects.link(ct); ct.location = vec("TGT", "0.035,-0.015,0")
tr = cam.constraints.new("TRACK_TO"); tr.target = ct; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
cd.dof.use_dof = True; cd.dof.focus_distance = (cam.location - vec("FOCUS", "0.03,-0.07,0")).length; cd.dof.aperture_fstop = float(env("FSTOP", 5.6))

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.max_bounces = 10; cy.transmission_bounces = 10; cy.sample_clamp_indirect = 10
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = float(env("EXPO", -0.2))
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
if env("NORENDER", "") == "": bpy.ops.render.render(write_still=True)
