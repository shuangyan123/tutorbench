# Models cover, "A transparent catalog of model evidence": a glass display cloche on a slate base,
# empty but for the brass specimen pin that waits for its object, and a typed museum label
# (cloche_tex.py). No model is shown because no public model run exists yet.
# Light: one narrow museum spot from high in front, a dim grey-blue gallery wall behind.
# usage: python cloche.py TEX_DIR OUT.png [W H SPP]
# tuning (env): EXPO FSTOP SPOT SPOTPOS FILL SKY WALL CAM TGT LENS
import math, sys, os
import bpy, bmesh, addon_utils
from mathutils import Vector

a = sys.argv[1:]; TEX = os.path.abspath(a[0]); OUT = os.path.abspath(a[1])
W = int(a[2]) if len(a) > 2 else 900; H = int(a[3]) if len(a) > 3 else 1100; SPP = int(a[4]) if len(a) > 4 else 256
env = lambda k, d: os.environ.get(k, d)
vec = lambda k, d: Vector([float(v) for v in env(k, d).split(",")])
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene; MM = 0.001

def mat(name, col=(0.8, 0.8, 0.8), rough=0.5, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True; p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*col, 1); p.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): p.inputs[k].default_value = v
    return m, m.node_tree, p

def revolve(name, prof, seg=128):
    bm = bmesh.new(); rings = []
    for r, z in prof:
        if r <= 1e-6: rings.append([bm.verts.new((0, 0, z * MM))])
        else: rings.append([bm.verts.new((r * MM * math.cos(2 * math.pi * k / seg), r * MM * math.sin(2 * math.pi * k / seg), z * MM)) for k in range(seg)])
    for A, B in zip(rings[:-1], rings[1:]):
        for k in range(seg):
            if len(A) == 1: bm.faces.new((A[0], B[k], B[(k + 1) % seg]))
            elif len(B) == 1: bm.faces.new((A[k], A[(k + 1) % seg], B[0]))
            else: bm.faces.new((A[k], A[(k + 1) % seg], B[(k + 1) % seg], B[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); return o

# ---- slate base: a turned disc with a moulded edge
slate, snt, sp = mat("slate", (0.012, 0.013, 0.016), 0.3)
sn = snt.nodes.new("ShaderNodeTexNoise"); sn.inputs["Scale"].default_value = 220; sn.inputs["Detail"].default_value = 10
sb = snt.nodes.new("ShaderNodeBump"); sb.inputs["Strength"].default_value = 0.08
snt.links.new(sn.outputs["Fac"], sb.inputs["Height"]); snt.links.new(sb.outputs["Normal"], sp.inputs["Normal"])
base_prof = [(0, 0), (112, 0), (112, 10), (110, 14), (104, 16), (102, 22), (0, 22)]
revolve("base", base_prof).data.materials.append(slate)

# ---- the cloche: blown glass, a soft dome with a knob, rim resting in a groove on the base
glass, _, gp = mat("glass", (1, 1, 1), 0.0, **{"Transmission Weight": 1.0, "IOR": 1.5})
R0, HH, T = 92.0, 230.0, 2.4
outer = []
for k in range(0, 41):
    t = k / 40; ang = t * math.pi / 2
    r = R0 * math.cos(ang) ** 0.8; z = 21 + (HH - 40) * (1 - (1 - math.sin(ang)) ** 1.0) * 1.0
    outer.append((r, z))
# knob
top_z = outer[-1][1]
knob = [(9, top_z + 2), (11, top_z + 10), (13, top_z + 18), (10, top_z + 26), (0, top_z + 28)]
# the inner surface: the outer one moved in along its normal by the wall thickness
inner = []
for i, (r, z) in enumerate(outer):
    r0, z0 = outer[max(i - 1, 0)]; r1, z1 = outer[min(i + 1, len(outer) - 1)]
    tr_, tz = r1 - r0, z1 - z0; L = math.hypot(tr_, tz) or 1.0
    inner.append((max(r - T * tz / L, 0.0), z + T * tr_ / L))
inner = inner[::-1]
prof = [(R0 - T, 21)] + [(R0, 21)] + outer[1:-1] + [(9, top_z)] + knob
o_out = revolve("cloche_out", [(r, z) for r, z in prof])
o_in = revolve("cloche_in", [(0, inner[0][1])] + inner[1:] + [(R0 - T, 21)])
for o in (o_out, o_in): o.data.materials.append(glass)
# flip the inner surface so the glass is a closed shell
bpy.context.view_layer.objects.active = o_in; o_in.select_set(True)
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.mesh.flip_normals(); bpy.ops.object.mode_set(mode="OBJECT")

# ---- the empty specimen pin: a short brass rod on a small round foot
brass, _, _ = mat("brass", (0.88, 0.68, 0.38), 0.22, Metallic=1.0)
revolve("pin", [(0, 22), (14, 22), (14, 25), (10, 27), (2.0, 28), (1.6, 70), (2.4, 72), (0, 73)]).data.materials.append(brass)

# ---- the label card leaning on a small brass easel at the base's front
lm, lnt, lp = mat("label", (1, 1, 1), 0.5)
lt = lnt.nodes.new("ShaderNodeTexImage"); lt.image = bpy.data.images.load(os.path.join(TEX, "label.png")); lnt.links.new(lt.outputs["Color"], lp.inputs["Base Color"])
bpy.ops.mesh.primitive_plane_add(size=1); card = bpy.context.object
card.scale = (0.070, 0.040, 1); bpy.ops.object.transform_apply(scale=True)
card.location = (0.045, -0.150, 0.0182); card.rotation_euler = (math.radians(62), 0, math.radians(-8))
so = card.modifiers.new("t", "SOLIDIFY"); so.thickness = 0.6 * MM; card.data.materials.append(lm)
bpy.ops.mesh.primitive_cylinder_add(radius=1.0 * MM, depth=0.05, location=(0.045, -0.140, 0.012), rotation=(0, math.radians(90), math.radians(-8))); bpy.context.object.data.materials.append(brass)

# ---- plinth top (pale stone) and the gallery wall
plinth, _, _ = mat("plinth", (0.34, 0.34, 0.33), 0.55)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -0.2)); pl = bpy.context.object; pl.scale = (0.7, 0.55, 0.4); pl.data.materials.append(plinth)
wall, _, _ = mat("wall", tuple(float(v) for v in env("WALL", "0.22,0.25,0.33").split(",")), 0.9)
bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0.9, 1.0), rotation=(math.radians(90), 0, 0)); bpy.context.object.data.materials.append(wall)
bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, -0.4)); bpy.context.object.data.materials.append(wall)

# ---- light: a narrow warm spot from high in front, a faint cool fill
bpy.ops.object.light_add(type="SPOT", location=tuple(vec("SPOTPOS", "-0.35,-0.9,1.5"))); spot = bpy.context.object
spot.data.energy = float(env("SPOT", 1100)); spot.data.spot_size = math.radians(13); spot.data.spot_blend = 0.5; spot.data.shadow_soft_size = 0.02
spot.data.color = (1.0, 0.93, 0.84)
spot.rotation_mode = "QUATERNION"; spot.rotation_quaternion = (Vector((0, 0, 0.08)) - spot.location).to_track_quat("-Z", "Y")
bpy.ops.object.light_add(type="AREA", location=(0.8, -0.4, 0.6)); fill = bpy.context.object
fill.data.size = 1.0; fill.data.energy = float(env("FILL", 14)); fill.data.color = (0.8, 0.86, 1.0)
fill.rotation_mode = "QUATERNION"; fill.rotation_quaternion = (Vector((0, 0, 0.1)) - fill.location).to_track_quat("-Z", "Y")
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.55, 0.65, 1); w.node_tree.nodes["Background"].inputs[1].default_value = float(env("SKY", 0.08))

cd = bpy.data.cameras.new("c"); cd.lens = float(env("LENS", 65)); cd.clip_start = 0.01
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = vec("CAM", "-0.10,-0.66,0.20")
ct = bpy.data.objects.new("ct", None); sc.collection.objects.link(ct); ct.location = vec("TGT", "0.0,-0.02,0.105")
tr = cam.constraints.new("TRACK_TO"); tr.target = ct; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
cd.dof.use_dof = True; cd.dof.focus_distance = (cam.location - Vector((0, -0.05, 0.08))).length; cd.dof.aperture_fstop = float(env("FSTOP", 5.6))

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.max_bounces = 16; cy.transmission_bounces = 16; cy.glossy_bounces = 8; cy.sample_clamp_indirect = 20
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = float(env("EXPO", 0.0))
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
