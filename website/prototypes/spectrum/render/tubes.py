# Run cover, "Same cases. Different Tutors. Comparable evidence.": four identical test tubes in an
# aluminium rack, each filled to the same line and labelled with a public case ID (labels from
# tubes_labels.py). One hard, warm lamp low behind them throws their shadows forward across blue
# paper in long bars; the room is soft and cool.
# usage: python tubes.py TEX_DIR OUT.png [W H SPP]
# tuning (env, defaults are the published frame): EXPO FSTOP LAMP LAMPPOS LAMPR CONE SKY PAPER CAM TGT LENS LEVEL FOCUS
import math, sys, os
import bpy, bmesh, addon_utils
import numpy as np
from mathutils import Vector

a = sys.argv[1:]; TEX = os.path.abspath(a[0]); OUT = os.path.abspath(a[1])
W = int(a[2]) if len(a) > 2 else 900; H = int(a[3]) if len(a) > 3 else 1100; SPP = int(a[4]) if len(a) > 4 else 256
env = lambda k, d: os.environ.get(k, d)
vec = lambda k, d: Vector([float(v) for v in env(k, d).split(",")])
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene; MM = 0.001

def principled(name, col, rough=0.5, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]; p.inputs["Base Color"].default_value = (*col, 1); p.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): p.inputs[k].default_value = v
    return m, p

def revolve(name, prof, seg=96):
    """a closed lathe mesh from an (r, z) polygon in mm; points on the axis become poles"""
    bm = bmesh.new(); rings = []
    for r, z in prof:
        if r <= 1e-6: rings.append([bm.verts.new((0, 0, z * MM))])
        else: rings.append([bm.verts.new((r * MM * math.cos(2 * math.pi * k / seg), r * MM * math.sin(2 * math.pi * k / seg), z * MM)) for k in range(seg)])
    for A, B in zip(rings, rings[1:] + rings[:1]):
        if len(A) == 1 and len(B) == 1: continue
        for k in range(seg):
            if len(A) == 1: bm.faces.new((A[0], B[k], B[(k + 1) % seg]))
            elif len(B) == 1: bm.faces.new((A[k], A[(k + 1) % seg], B[0]))
            else: bm.faces.new((A[k], A[(k + 1) % seg], B[(k + 1) % seg], B[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); return o

# ---- materials
glass, _ = principled("glass and water", (0.98, 0.99, 1.0), 0.0, **{"Transmission Weight": 1.0, "IOR": 1.4})
alu, _ = principled("bead-blasted aluminium", (0.78, 0.79, 0.8), 0.38, **{"Metallic": 1.0})

# ---- four tubes, 16 x 125 mm, filled to the same line
R, T, ZB, ZT = 8.0, 0.9, 4.0, 129.0
LEVEL = float(env("LEVEL", 72))
def arc(r, zc, n, a0, a1):
    return [(r * math.cos(t), zc + r * math.sin(t)) for t in np.linspace(a0, a1, n)]
outer = [(0.0, ZB)] + arc(R, ZB + R, 24, -math.pi / 2, 0)[1:] + [(R, ZT - 1.0), (R + 0.55, ZT - 0.4), (R + 0.55, ZT + 0.2), (R - 0.2, ZT + 0.55)]
# glass and the water in it as one solid below the water line (the thin glass-water boundary is all
# but invisible, and one interface keeps the shadow caustics solvable); an open glass shell above it
ri = R - T
tube_prof = outer + [(ri, ZT), (ri, LEVEL + 0.9)] + [(ri * s, LEVEL + 0.9 * s ** 8) for s in np.linspace(1, 0, 24)[1:]]
XS = [-39, -13, 13, 39]
tubes = []
for k, x in enumerate(XS):
    t = revolve(f"tube{k}", tube_prof); t.location.x = x * MM; t.data.materials.append(glass); tubes.append(t)
    # the label: a paper strip on the side facing the camera, printed up the tube
    img = bpy.data.images.load(os.path.join(TEX, f"label{k}.png"))
    lm, lp = principled(f"label{k}", (1, 1, 1), 0.55)
    tx = lm.node_tree.nodes.new("ShaderNodeTexImage"); tx.image = img
    lm.node_tree.links.new(tx.outputs["Color"], lp.inputs["Base Color"])
    span = 14.0 / R; z0, z1 = 88.0, 126.0; rl = R + 0.06
    bm = bmesh.new(); nz, na = 40, 24; vs = []
    for i in range(nz + 1):
        row = []
        for j in range(na + 1):
            ang = -math.pi / 2 - span / 2 + span * j / na
            row.append(bm.verts.new((x * MM + rl * MM * math.cos(ang), rl * MM * math.sin(ang), (z0 + (z1 - z0) * i / nz) * MM)))
        vs.append(row)
    for i in range(nz):
        for j in range(na): bm.faces.new((vs[i][j], vs[i][j + 1], vs[i + 1][j + 1], vs[i + 1][j]))
    uvl = bm.loops.layers.uv.new("UV")
    for f in bm.faces:
        for lo in f.loops:
            v = lo.vert.co; zz = v.z / MM; ang = math.atan2(v.y, v.x - x * MM)
            lo[uvl].uv = ((zz - z0) / (z1 - z0), 1 - (ang - (-math.pi / 2 - span / 2)) / span)
    me = bpy.data.meshes.new(f"label{k}"); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    lo_ = bpy.data.objects.new(f"label{k}", me); sc.collection.objects.link(lo_); lo_.data.materials.append(lm)

# ---- the rack: a base plate, a drilled top plate below the water line, two end posts
def box(name, c, s):
    bpy.ops.mesh.primitive_cube_add(size=1, location=tuple(v * MM for v in c)); o = bpy.context.object
    o.scale = tuple(v * MM for v in s); o.name = name
    bv = o.modifiers.new("b", "BEVEL"); bv.width = 0.5 * MM; bv.segments = 3
    o.data.materials.append(alu); return o
box("base", (0, 0, 2), (128, 30, 4))
top = box("top", (0, 0, 48), (128, 30, 4))
for x in XS:
    bpy.ops.mesh.primitive_cylinder_add(radius=8.7 * MM, depth=10 * MM, location=(x * MM, 0, 48 * MM), vertices=96); hole = bpy.context.object; hole.hide_render = True; hole.hide_viewport = True
    bo = top.modifiers.new("hole", "BOOLEAN"); bo.object = hole; bo.operation = "DIFFERENCE"
    top.modifiers.move(len(top.modifiers) - 1, 0)
for x in (-58, 58): box("post", (x, 0, 25), (8, 26, 42))  # inset from the plates so faces never coincide

# ---- pale paper sweeping up into the wall
pm, pp = principled("paper", tuple(float(v) for v in env("PAPER", "0.5,0.56,0.7").split(",")), 0.85)
bm = bmesh.new(); prof = [(y, 0.0) for y in np.linspace(-0.8, 0.12, 50)]
prof += [(0.12 + 0.2 * math.sin(k / 29 * math.pi / 2), 0.2 * (1 - math.cos(k / 29 * math.pi / 2))) for k in range(1, 30)] + [(0.32, 1.0)]
cols = [[bm.verts.new((x, y, z)) for y, z in prof] for x in (-1.0, 1.0)]
for i in range(len(prof) - 1): bm.faces.new((cols[0][i], cols[1][i], cols[1][i + 1], cols[0][i + 1]))
me = bpy.data.meshes.new("sweep"); bm.to_mesh(me); bm.free()
for p in me.polygons: p.use_smooth = True
sweep = bpy.data.objects.new("sweep", me); sc.collection.objects.link(sweep); sweep.data.materials.append(pm)

# ---- light: one hard lamp low behind, the room soft and cool
bpy.ops.object.light_add(type="SPOT", location=tuple(vec("LAMPPOS", "0.02,0.30,0.32"))); lamp = bpy.context.object
lamp.data.energy = float(env("LAMP", 45)); lamp.data.spot_size = math.radians(float(env("CONE", 100))); lamp.data.spot_blend = 1.0
lamp.data.shadow_soft_size = float(env("LAMPR", 0.002)); lamp.data.color = (1.0, 0.95, 0.88)
lamp.rotation_mode = "QUATERNION"; lamp.rotation_quaternion = (Vector((0, -0.04, 0)) - lamp.location).to_track_quat("-Z", "Y")
lamp.data.cycles.is_caustics_light = True
for o in tubes: o.cycles.is_caustics_caster = True
sweep.cycles.is_caustics_receiver = True
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.8, 0.84, 0.92, 1); w.node_tree.nodes["Background"].inputs[1].default_value = float(env("SKY", 0.45))

cd = bpy.data.cameras.new("c"); cd.lens = float(env("LENS", 60)); cd.clip_start = 0.01
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = vec("CAM", "0.07,-0.33,0.09")
ct = bpy.data.objects.new("ct", None); sc.collection.objects.link(ct); ct.location = vec("TGT", "0.0,-0.03,0.06")
tr = cam.constraints.new("TRACK_TO"); tr.target = ct; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
cd.dof.use_dof = True; cd.dof.focus_distance = (cam.location - vec("FOCUS", "0,-0.005,0.07")).length; cd.dof.aperture_fstop = float(env("FSTOP", 5.6))

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.max_bounces = 24; cy.transmission_bounces = 24; cy.glossy_bounces = 8; cy.caustics_refractive = True; cy.caustics_reflective = True
cy.blur_glossy = 0.0; cy.sample_clamp_indirect = 40
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = float(env("EXPO", 0.0))
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
