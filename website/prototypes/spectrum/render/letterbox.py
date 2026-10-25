# Contact cover, "Questions, collaboration, or project feedback": a brass letter plate in a painted
# panelled door, a handwritten postcard halfway through the slot (textures from letterbox_tex.py).
# Light: soft overcast daylight from the open side, cool, with a gentle warm bounce from below.
# usage: python letterbox.py TEX_DIR OUT.png [W H SPP]
# tuning (env): EXPO FSTOP KEY KEYPOS FILL SKY PAINT CAM TGT LENS
import math, sys, os
import bpy, bmesh, addon_utils
from mathutils import Vector

a = sys.argv[1:]; TEX = os.path.abspath(a[0]); OUT = os.path.abspath(a[1])
W = int(a[2]) if len(a) > 2 else 900; H = int(a[3]) if len(a) > 3 else 1100; SPP = int(a[4]) if len(a) > 4 else 192
env = lambda k, d: os.environ.get(k, d)
vec = lambda k, d: Vector([float(v) for v in env(k, d).split(",")])
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene; MM = 0.001

def mat(name, col=(0.8, 0.8, 0.8), rough=0.5, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True; p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*col, 1); p.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): p.inputs[k].default_value = v
    return m, m.node_tree, p

def box(name, c, s, m, bevel=0.0, seg=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=tuple(v * MM for v in c)); o = bpy.context.object; o.name = name
    o.scale = tuple(v * MM for v in s); bpy.ops.object.transform_apply(scale=True)
    if bevel: bv = o.modifiers.new("b", "BEVEL"); bv.width = bevel * MM; bv.segments = seg
    o.data.materials.append(m); return o

# ---- painted door: eggshell paint over wood, faint brush texture; the door face is the XZ plane, y = 0
paint, pnt, pp = mat("paint", tuple(float(v) for v in env("PAINT", "0.17,0.22,0.31").split(",")), 0.42)
bn = pnt.nodes.new("ShaderNodeTexWave"); bn.inputs["Scale"].default_value = 6; bn.inputs["Distortion"].default_value = 6; bn.inputs["Detail"].default_value = 6
bn.bands_direction = "Z"
nb = pnt.nodes.new("ShaderNodeBump"); nb.inputs["Strength"].default_value = 0.05
pnt.links.new(bn.outputs["Fac"], nb.inputs["Height"]); pnt.links.new(nb.outputs["Normal"], pp.inputs["Normal"])
box("door", (0, 25, 0), (900, 50, 1400), paint)
# a raised panel above the letter plate and the rail it sits in, with mouldings
box("rail_top", (0, -2, 92), (900, 4, 6), paint, 2.0)
box("panel", (0, -4, 330), (560, 8, 420), paint, 6.0, 5)
box("rail_bot", (0, -2, -92), (900, 4, 6), paint, 2.0)

# ---- the brass letter plate: a frame with a slot, and a flap hinged at the top, pushed in by the card
brass, bnt, bp = mat("brass", (0.86, 0.66, 0.36), 0.24, Metallic=1.0)
sn = bnt.nodes.new("ShaderNodeTexNoise"); sn.inputs["Scale"].default_value = 800; sn.inputs["Detail"].default_value = 3
smr = bnt.nodes.new("ShaderNodeMapRange"); smr.inputs["To Min"].default_value = 0.24; smr.inputs["To Max"].default_value = 0.42
bnt.links.new(sn.outputs["Fac"], smr.inputs["Value"]); bnt.links.new(smr.outputs["Result"], bp.inputs["Roughness"])
PW, PH = 280, 92; SW, SH = 230, 34
plate = box("plate", (0, -2.5, 0), (PW, 5, PH), brass, 2.5, 4)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0)); cut = bpy.context.object; cut.scale = (SW * MM, 0.2, SH * MM); cut.hide_render = True; cut.hide_viewport = True
bo = plate.modifiers.new("slot", "BOOLEAN"); bo.object = cut; bo.operation = "DIFFERENCE"; plate.modifiers.move(1, 0)
door = bpy.data.objects["door"]; bo2 = door.modifiers.new("slot", "BOOLEAN"); bo2.object = cut; bo2.operation = "DIFFERENCE"
# dark inside of the slot
dark, _, _ = mat("inside", (0.01, 0.01, 0.012), 0.8)
box("throat", (0, 30, 0), (SW + 10, 4, SH + 10), dark)
# flap: engraved, hinged along its top edge, swung inward by the card
fm, fnt, fp = mat("flap brass", (0.86, 0.66, 0.36), 0.22, Metallic=1.0)
fi = fnt.nodes.new("ShaderNodeTexImage"); fi.image = bpy.data.images.load(os.path.join(TEX, "flap_height.png")); fi.image.colorspace_settings.name = "Non-Color"
fb = fnt.nodes.new("ShaderNodeBump"); fb.inputs["Strength"].default_value = 0.8; fb.inputs["Distance"].default_value = 0.0008
fnt.links.new(fi.outputs["Color"], fb.inputs["Height"]); fnt.links.new(fb.outputs["Normal"], fp.inputs["Normal"])
fcol = fnt.nodes.new("ShaderNodeMix"); fcol.data_type = "RGBA"; fcol.inputs[6].default_value = (0.08, 0.05, 0.02, 1); fcol.inputs[7].default_value = (0.86, 0.66, 0.36, 1)
fnt.links.new(fi.outputs["Color"], fcol.inputs["Factor"]); fnt.links.new(fcol.outputs[2], fp.inputs["Base Color"])
bpy.ops.mesh.primitive_plane_add(size=1); flap = bpy.context.object
flap.scale = ((SW + 8) * MM, (SH + 16) * MM, 1); bpy.ops.object.transform_apply(scale=True)
for v in flap.data.vertices: v.co.y -= (SH + 16) / 2 * MM        # hinge line at the plane's top edge
flap.rotation_euler = (math.radians(90 + float(env("FLAP", 10))), 0, 0); flap.location = (0, -5.5 * MM, (SH / 2 + 8) * MM)
so = flap.modifiers.new("t", "SOLIDIFY"); so.thickness = 2.0 * MM
uv = flap.data.uv_layers.active
flap.data.materials.append(fm)
# hinge pin
bpy.ops.mesh.primitive_cylinder_add(radius=3.0 * MM, depth=(SW + 14) * MM, location=(0, -6 * MM, (SH / 2 + 8) * MM), rotation=(0, math.radians(90), 0)); bpy.context.object.data.materials.append(brass)

# ---- the postcard, half through the slot, tilted a little
cm, cnt, cp = mat("card", (1, 1, 1), 0.55)
ct_ = cnt.nodes.new("ShaderNodeTexImage"); ct_.image = bpy.data.images.load(os.path.join(TEX, "postcard.png")); cnt.links.new(ct_.outputs["Color"], cp.inputs["Base Color"])
bpy.ops.mesh.primitive_grid_add(x_subdivisions=30, y_subdivisions=20, size=1); card = bpy.context.object
card.scale = (148 * MM, 105 * MM, 1); bpy.ops.object.transform_apply(scale=True)
for v in card.data.vertices: v.co.z += 0.9 * MM * (1 - (2 * v.co.x / (148 * MM)) ** 2)     # a slight bow
card.rotation_euler = (math.radians(float(env("CARDTILT", -8))), 0, math.radians(float(env("CARDROT", 3))))
card.location = (float(env("CARDX", 12)) * MM, -40 * MM, -6 * MM)
so = card.modifiers.new("t", "SOLIDIFY"); so.thickness = 0.35 * MM; card.data.materials.append(cm)

# ---- light: soft cool daylight from the open side (left), a weak warm bounce from below
bpy.ops.object.light_add(type="AREA", location=tuple(vec("KEYPOS", "-1.1,-0.9,0.6"))); key = bpy.context.object
key.data.shape = "RECTANGLE"; key.data.size = 1.6; key.data.size_y = 2.2; key.data.energy = float(env("KEY", 40)); key.data.color = (0.9, 0.95, 1.0)
key.rotation_mode = "QUATERNION"; key.rotation_quaternion = (Vector((0, 0, 0)) - key.location).to_track_quat("-Z", "Y")
bpy.ops.object.light_add(type="AREA", location=(0.3, -0.8, -0.9)); fill = bpy.context.object
fill.data.size = 1.5; fill.data.energy = float(env("FILL", 6)); fill.data.color = (1.0, 0.86, 0.72)
fill.rotation_mode = "QUATERNION"; fill.rotation_quaternion = (Vector((0, 0, 0)) - fill.location).to_track_quat("-Z", "Y")
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.75, 0.8, 0.9, 1); w.node_tree.nodes["Background"].inputs[1].default_value = float(env("SKY", 0.03))

cd = bpy.data.cameras.new("c"); cd.lens = float(env("LENS", 60)); cd.clip_start = 0.01
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = vec("CAM", "-0.17,-0.40,0.27")
ctg = bpy.data.objects.new("ct", None); sc.collection.objects.link(ctg); ctg.location = vec("TGT", "0.0,-0.04,-0.01")
tr = cam.constraints.new("TRACK_TO"); tr.target = ctg; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
cd.dof.use_dof = True; cd.dof.focus_distance = (cam.location - Vector((0.0, -0.03, 0.0))).length; cd.dof.aperture_fstop = float(env("FSTOP", 4.5))

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.max_bounces = 8; cy.sample_clamp_indirect = 20
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = float(env("EXPO", 0.0))
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
