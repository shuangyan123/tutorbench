# Methodology plate, "Why we evaluate this way": a white card price tag on a linen cloth, tied with
# amethyst cotton twine, a violet pencil beside it. In pencil on the tag is the learner's sum from the
# case mc-percent-reversal (200, up 20 %, down 20 %) and an equals sign with the price left open: in
# that case the tutor may hint but must not write the answer in. Tag face from pricetag_tex.py.
# Light: soft north-window daylight low from the upper left, a cool sky filling the shadows.
# usage: python pricetag.py TEX_DIR OUT.png [W H SPP]
# tuning (env, defaults are the published frame): EXPO FSTOP SKY POWER LAMP CAM TGT LENS TAGROT
import math, sys, os
import bpy, bmesh, addon_utils
import numpy as np
from mathutils import Vector, Matrix, Euler

a = sys.argv[1:]; TEX = os.path.abspath(a[0]); OUT = os.path.abspath(a[1])
W = int(a[2]) if len(a) > 2 else 1600; H = int(a[3]) if len(a) > 3 else 1000; SPP = int(a[4]) if len(a) > 4 else 160
env = lambda k, d: os.environ.get(k, d)
vec = lambda k, d: Vector([float(v) for v in env(k, d).split(",")])
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene; MM = 0.001

def principled(name, col, rough=0.5, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]; p.inputs["Base Color"].default_value = (*col, 1); p.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): p.inputs[k].default_value = v
    return m, p

# ---- the tag: 120 x 60 mm card, corners clipped at the eyelet end, a 5 mm hole
TW, TH, CUT, HOLE, HX = 120 * MM, 60 * MM, 13 * MM, 2.6 * MM, -50 * MM
T = 0.32 * MM
cu = bpy.data.curves.new("tag", "CURVE"); cu.dimensions = "2D"; cu.fill_mode = "BOTH"; cu.extrude = T / 2
outline = [(-TW / 2, -TH / 2 + CUT), (-TW / 2 + CUT, -TH / 2), (TW / 2, -TH / 2), (TW / 2, TH / 2), (-TW / 2 + CUT, TH / 2), (-TW / 2, TH / 2 - CUT)]
for pts in (outline, [(HX + HOLE * math.cos(t), HOLE * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 48, endpoint=False)]):
    sp = cu.splines.new("POLY"); sp.points.add(len(pts) - 1); sp.use_cyclic_u = True
    for p, (x, y) in zip(sp.points, pts): p.co = (x, y, 0, 1)
tag = bpy.data.objects.new("tag", cu); sc.collection.objects.link(tag)
bpy.context.view_layer.objects.active = tag; tag.select_set(True); bpy.ops.object.convert(target="MESH")
bm = bmesh.new(); bm.from_mesh(tag.data)
for x in np.linspace(-TW / 2 + 2 * MM, TW / 2 - 2 * MM, 40):         # cut lines so the card can bend
    g = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=g, plane_co=(x, 0, 0), plane_no=(1, 0, 0))
bmesh.ops.triangulate(bm, faces=bm.faces[:])
uv = bm.loops.layers.uv.active or bm.loops.layers.uv.new("UV")
for f in bm.faces:
    for l in f.loops: l[uv].uv = ((l.vert.co.x + TW / 2) / TW, (l.vert.co.y + TH / 2) / TH)
for v in bm.verts:                                                    # the free end lifts a little off the cloth
    s = max(0.0, (v.co.x - 10 * MM) / (TW / 2 - 10 * MM))
    v.co.z += T / 2 + 1.6 * MM * s * s + 0.25 * MM * math.sin(v.co.y / TH * math.pi)
bm.to_mesh(tag.data); bm.free()
ROT = math.radians(float(env("TAGROT", -9)))
tag.rotation_euler = (0, 0, ROT)
card, cp = principled("card", (0.85, 0.86, 0.88), 0.78, **{"Subsurface Weight": 0.08})
cp.inputs["Subsurface Radius"].default_value = (0.003, 0.003, 0.003)
t = card.node_tree
tx = t.nodes.new("ShaderNodeTexImage"); tx.image = bpy.data.images.load(os.path.join(TEX, "tag.png")); tx.interpolation = "Cubic"
t.links.new(tx.outputs["Color"], cp.inputs["Base Color"])
gm = t.nodes.new("ShaderNodeTexImage"); gm.image = bpy.data.images.load(os.path.join(TEX, "tag_graphite.png")); gm.image.colorspace_settings.name = "Non-Color"
rr = t.nodes.new("ShaderNodeMapRange"); rr.inputs["To Min"].default_value = 0.78; rr.inputs["To Max"].default_value = 0.42   # graphite shines
t.links.new(gm.outputs["Color"], rr.inputs["Value"]); t.links.new(rr.outputs["Result"], cp.inputs["Roughness"])
fib = t.nodes.new("ShaderNodeTexNoise"); fib.inputs["Scale"].default_value = 3200; fib.inputs["Detail"].default_value = 6
tc = t.nodes.new("ShaderNodeTexCoord"); t.links.new(tc.outputs["Object"], fib.inputs[0])
bp = t.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.06; bp.inputs["Distance"].default_value = 0.0003
t.links.new(fib.outputs["Fac"], bp.inputs["Height"]); t.links.new(bp.outputs[0], cp.inputs["Normal"])
tag.data.materials.append(card)

def world(x, y, z=0.0):
    """tag-local mm point to world, following the tag's turn"""
    c, s = math.cos(ROT), math.sin(ROT)
    return Vector((c * x - s * y, s * x + c * y, z))

# the reinforcing ring: a thinner card washer glued round the hole, and a brass eyelet in it
cu = bpy.data.curves.new("ring", "CURVE"); cu.dimensions = "2D"; cu.fill_mode = "BOTH"; cu.extrude = 0.08 * MM
for r in (7.2 * MM, HOLE):
    sp = cu.splines.new("POLY"); n = 64; sp.points.add(n - 1); sp.use_cyclic_u = True
    for k, p in enumerate(sp.points): p.co = (HX + r * math.cos(2 * math.pi * k / n), r * math.sin(2 * math.pi * k / n), 0, 1)
ring = bpy.data.objects.new("ring", cu); sc.collection.objects.link(ring); ring.location = (0, 0, T + 0.1 * MM); ring.rotation_euler = (0, 0, ROT)
rm, _ = principled("ringcard", (0.80, 0.80, 0.83), 0.85); ring.data.materials.append(rm)
bpy.ops.mesh.primitive_torus_add(major_radius=HOLE + 0.55 * MM, minor_radius=0.55 * MM, major_segments=64, minor_segments=16, location=world(HX, 0, T + 0.25 * MM))
eye = bpy.context.object; eye.scale = (1, 1, 0.55)
em, _ = principled("brass", (0.80, 0.62, 0.38), 0.28, **{"Metallic": 1.0}); eye.data.materials.append(em)

# ---- the twine: a doubled cotton string looped through the eyelet and round the end of the tag
R = 0.66 * MM                       # one strand: two plies twisted together
PLY, PO, PITCH = 0.37 * MM, 0.29 * MM, 2.4 * MM
def catmull(pts, step=0.2 * MM):
    P = [pts[0] * 2 - pts[1]] + list(pts) + [pts[-1] * 2 - pts[-2]]; out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        n = max(2, int((p2 - p1).length / step))
        for k in range(n):
            u = k / n
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3))
    out.append(P[-2]); return out
def twine(name, pts, phase=0.0):
    path = catmull(pts); objs = []
    c = bpy.data.curves.new(name, "CURVE"); c.dimensions = "3D"; c.bevel_depth = PLY; c.bevel_resolution = 3
    run = 0.0
    for ply in range(2):
        sp = c.splines.new("POLY"); sp.points.add(len(path) - 1); run = 0.0
        for i, p in enumerate(path):
            if i: run += (p - path[i - 1]).length
            tg = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
            nn = tg.cross(Vector((0, 0, 1))); nn = nn.normalized() if nn.length > 1e-6 else Vector((1, 0, 0))
            bb = tg.cross(nn)
            th = 2 * math.pi * run / PITCH + ply * math.pi + phase
            q = p + (nn * math.cos(th) + bb * math.sin(th)) * PO
            sp.points[i].co = (q.x, q.y, q.z, 1)
    o = bpy.data.objects.new(name, c); sc.collection.objects.link(o); return o
strands = []
for side in (-1, 1):
    o = side * 1.25 * MM
    pts = [world(HX + 0.6 * MM, o * 0.6, T - 0.6 * MM), world(HX - 2.2 * MM, o, T + R + 0.1 * MM), world(-TW / 2 - 0.4 * MM, o * 1.3, T + R * 0.7),
           world(-TW / 2 - 3.5 * MM, o * 1.6, R + 0.05 * MM)]
    # off across the cloth in a slack S, out of frame at the top left
    run = [(-80, 6, 0), (-100, 22, 0), (-112, 46, 0), (-104, 70, 0), (-118, 96, 0), (-150, 120, 0)]
    for k, (x, y, _) in enumerate(run):
        pts.append(Vector((x * MM, y * MM, R + 0.05 * MM)) + Vector((side * 1.1 * MM * (1 - k / 8), side * 0.7 * MM, 0)))
    strands.append(twine(f"twine{side}", pts, side))
tm, tp = principled("twine", (0.12, 0.05, 0.36), 0.92, **{"Sheen Weight": 0.6, "Sheen Roughness": 0.4})
t = tm.node_tree; tc = t.nodes.new("ShaderNodeTexCoord")
wv = t.nodes.new("ShaderNodeTexWave"); wv.wave_type = "BANDS"; wv.bands_direction = "DIAGONAL"; wv.inputs["Scale"].default_value = 5000; wv.inputs["Distortion"].default_value = 6; wv.inputs["Detail"].default_value = 6
t.links.new(tc.outputs["Object"], wv.inputs[0])
bp = t.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.5; bp.inputs["Distance"].default_value = 0.0002
t.links.new(wv.outputs["Fac"], bp.inputs["Height"]); t.links.new(bp.outputs[0], tp.inputs["Normal"])
for s in strands: s.data.materials.append(tm)

# ---- the pencil: hexagonal, violet lacquer, sharpened, lying on a flat with its point near the blank
PR = 3.7 * MM                       # across corners / 2
APO = PR * math.cos(math.pi / 6)
TIP = world(30 * MM, -36 * MM)      # where the point rests
DIR = Vector((math.cos(math.radians(-24)), math.sin(math.radians(-24)), 0))   # from the point back along the body
LB, LW, LG = 160 * MM, 17 * MM, 4.5 * MM        # lacquered body, bare wood cone, graphite
def along(d): return TIP + DIR * d + Vector((0, 0, APO))
bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=PR, depth=LB, location=along(LW + LG + LB / 2)); body = bpy.context.object
q_axis = Vector((0, 0, 1)).rotation_difference(DIR)                  # cylinder axis onto the pencil direction
spin = Matrix.Rotation(math.radians(30), 4, "Z")
def place(o): o.rotation_mode = "QUATERNION"; o.rotation_quaternion = (q_axis.to_matrix().to_4x4() @ spin).to_quaternion()
place(body)
bv = body.modifiers.new("b", "BEVEL"); bv.width = 0.35 * MM; bv.segments = 3
lac, lp = principled("lacquer", (0.06, 0.012, 0.20), 0.22, **{"Coat Weight": 0.7, "Coat Roughness": 0.08})
body.data.materials.append(lac)
# the sharpened wood: a cone cut by the same hexagon, so the lacquer ends in six scallops
bpy.ops.mesh.primitive_cone_add(vertices=96, radius1=PR * 1.02, radius2=0.95 * MM, depth=LW, location=along(LG + LW / 2)); wood = bpy.context.object
wood.rotation_mode = "QUATERNION"; wood.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(-DIR)
bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=PR, depth=LW + 2 * MM, location=along(LG + LW / 2)); cut = bpy.context.object; place(cut)
bo = wood.modifiers.new("hex", "BOOLEAN"); bo.operation = "INTERSECT"; bo.object = cut; bo.solver = "EXACT"; cut.hide_render = True; cut.hide_viewport = True
wm, wp = principled("cedar", (0.62, 0.40, 0.25), 0.7)
t = wm.node_tree; tc = t.nodes.new("ShaderNodeTexCoord")
wv = t.nodes.new("ShaderNodeTexWave"); wv.inputs["Scale"].default_value = 500; wv.inputs["Distortion"].default_value = 4; wv.inputs["Detail"].default_value = 4
t.links.new(tc.outputs["Object"], wv.inputs[0])
rp = t.nodes.new("ShaderNodeValToRGB"); rp.color_ramp.elements[0].color = (0.52, 0.32, 0.19, 1); rp.color_ramp.elements[1].color = (0.70, 0.48, 0.30, 1)
t.links.new(wv.outputs["Fac"], rp.inputs[0]); t.links.new(rp.outputs[0], wp.inputs["Base Color"])
wood.data.materials.append(wm)
bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=0.95 * MM, radius2=0.12 * MM, depth=LG, location=along(LG / 2)); lead = bpy.context.object
lead.rotation_mode = "QUATERNION"; lead.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(-DIR)
gm, _ = principled("graphite", (0.05, 0.05, 0.055), 0.38, **{"Metallic": 0.6}); lead.data.materials.append(gm)
for o in (body, wood, lead): o.location.z = APO; [setattr(o.data.polygons[i], "use_smooth", False) for i in range(len(o.data.polygons))]

# ---- the cloth: pale periwinkle linen with soft folds
cw = 0.9
xs = np.linspace(-cw / 2, cw / 2, 360); ys = np.linspace(-cw / 2, cw / 2, 360)
X, Y = np.meshgrid(xs, ys)
rng = np.random.default_rng(3)
Z = sum(rng.uniform(0.2, 0.6) * MM * np.sin(X * rng.uniform(8, 30) * math.cos(th) + Y * rng.uniform(8, 30) * math.sin(th) + rng.uniform(0, 6.3))
        for th in rng.uniform(0, math.pi, 7))
Z -= 0.9 * MM                                                       # folds sit under the objects
Z = np.where(np.hypot(X, Y) < 0.11, Z * np.clip(np.hypot(X, Y) / 0.11, 0, 1) ** 2 - 0.0 * MM, Z)   # flat where things lie
verts = np.stack([X, Y, Z], -1).reshape(-1, 3); nx = len(xs)
faces = [(j * nx + i, j * nx + i + 1, (j + 1) * nx + i + 1, (j + 1) * nx + i) for j in range(nx - 1) for i in range(nx - 1)]
me = bpy.data.meshes.new("cloth"); me.from_pydata(verts.tolist(), [], faces); me.update()
for p in me.polygons: p.use_smooth = True
cloth = bpy.data.objects.new("cloth", me); sc.collection.objects.link(cloth)
lm, lp = principled("linen", (0.5, 0.55, 0.72), 0.9, **{"Sheen Weight": 0.35})
t = lm.node_tree; tc = t.nodes.new("ShaderNodeTexCoord")
w1 = t.nodes.new("ShaderNodeTexWave"); w1.inputs["Scale"].default_value = 1500; w1.bands_direction = "X"; w1.inputs["Distortion"].default_value = 3
w2 = t.nodes.new("ShaderNodeTexWave"); w2.inputs["Scale"].default_value = 1500; w2.bands_direction = "Y"; w2.inputs["Distortion"].default_value = 3
sl = t.nodes.new("ShaderNodeTexNoise"); sl.inputs["Scale"].default_value = 60; sl.inputs["Detail"].default_value = 10   # slubs in the yarn
for x in (w1, w2, sl): t.links.new(tc.outputs["Object"], x.inputs[0])
mx = t.nodes.new("ShaderNodeMath"); mx.operation = "ADD"; t.links.new(w1.outputs["Fac"], mx.inputs[0]); t.links.new(w2.outputs["Fac"], mx.inputs[1])
bp = t.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.6; bp.inputs["Distance"].default_value = 0.0004
t.links.new(mx.outputs[0], bp.inputs["Height"]); t.links.new(bp.outputs[0], lp.inputs["Normal"])
ramp = t.nodes.new("ShaderNodeValToRGB"); e = ramp.color_ramp.elements
e[0].color = (0.40, 0.45, 0.62, 1); e[1].color = (0.50, 0.55, 0.72, 1)
t.links.new(sl.outputs["Fac"], ramp.inputs[0]); t.links.new(ramp.outputs[0], lp.inputs["Base Color"])
cloth.data.materials.append(lm)

# ---- light: a north window low on the upper left, and a cool sky
bpy.ops.object.light_add(type="AREA", location=tuple(vec("LAMP", "-0.55,0.10,0.14"))); win = bpy.context.object
win.data.shape = "RECTANGLE"; win.data.size = 0.5; win.data.size_y = 0.32; win.data.energy = float(env("POWER", 4)); win.data.color = (0.97, 0.98, 1.0); win.data.spread = math.radians(float(env("SPREAD", 35)))
win.rotation_mode = "QUATERNION"; win.rotation_quaternion = (Vector((0, 0, 0)) - win.location).to_track_quat("-Z", "Y")
bpy.ops.object.light_add(type="AREA", location=(0.45, 0.35, 0.12)); bounce = bpy.context.object   # a faint peach glow from the far right
bounce.data.size = 0.3; bounce.data.energy = float(env("GLOW", 1)); bounce.data.color = (1.0, 0.78, 0.68); bounce.data.spread = math.radians(70)
bounce.rotation_mode = "QUATERNION"; bounce.rotation_quaternion = (Vector((0, 0, 0)) - bounce.location).to_track_quat("-Z", "Y")
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.62, 0.68, 0.86, 1); w.node_tree.nodes["Background"].inputs[1].default_value = float(env("SKY", 0.03))

cd = bpy.data.cameras.new("c"); cd.lens = float(env("LENS", 85)); cd.clip_start = 0.01
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = vec("CAM", "0.02,-0.30,0.40")
ct = bpy.data.objects.new("ct", None); sc.collection.objects.link(ct); ct.location = vec("TGT", "-0.012,-0.006,0")
tr = cam.constraints.new("TRACK_TO"); tr.target = ct; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
cd.dof.use_dof = True; cd.dof.focus_distance = (cam.location - world(0, -8 * MM, 0)).length; cd.dof.aperture_fstop = float(env("FSTOP", 4.5))

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.max_bounces = 8; cy.sample_clamp_indirect = 10
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = float(env("EXPO", 0.0))
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
