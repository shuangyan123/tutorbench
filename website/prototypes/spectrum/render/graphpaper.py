# Journal, "When Learning Starts to Feel Like Failure", figure: the essay's quadratic example on a
# sheet of graph paper, a cedar pencil laid across it, on a dark desk under soft window light.
# usage: python graphpaper.py PAPER.png GRAPHITE.png OUT.png [W H SPP]
import math, sys, os, random
import bpy, addon_utils
from mathutils import Vector

a = sys.argv[1:]; TEX = os.path.abspath(a[0]); GR = os.path.abspath(a[1]); OUT = os.path.abspath(a[2])
W = int(a[3]) if len(a) > 3 else 1800; H = int(a[4]) if len(a) > 4 else 1000; SPP = int(a[5]) if len(a) > 5 else 128
random.seed(2)
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene

def mat(name, col, rough=0.6, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): b.inputs[k].default_value = v
    return m, b

# ---- the sheet: A4 landscape, one corner lifting a little
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.0004)); pg = bpy.context.object
pg.scale = (0.297, 0.21, 1); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
sub = pg.modifiers.new("s", "SUBSURF"); sub.levels = 5; sub.render_levels = 5; sub.subdivision_type = "SIMPLE"
# lift the far-right corner with a soft weight field
vg = pg.vertex_groups.new(name="lift")
cu = bpy.data.objects.new("lift_c", None); sc.collection.objects.link(cu); cu.location = (0.16, 0.12, 0)
wp = pg.modifiers.new("w", "VERTEX_WEIGHT_PROXIMITY"); wp.vertex_group = "lift"; wp.target = cu; wp.proximity_mode = "OBJECT"
wp.min_dist = 0.09; wp.max_dist = 0.0; wp.falloff_type = "SMOOTH"
pg.vertex_groups["lift"].add(list(range(4)), 1.0, "REPLACE")
dsp = pg.modifiers.new("d", "DISPLACE"); dsp.vertex_group = "lift"; dsp.direction = "Z"; dsp.strength = 0.012; dsp.mid_level = 0.0
pm, pb = mat("paper", (0.94, 0.94, 0.94), 0.85, **{"Subsurface Weight": 0.06})
pt = pm.node_tree
im = pt.nodes.new("ShaderNodeTexImage"); im.image = bpy.data.images.load(TEX)
gm = pt.nodes.new("ShaderNodeTexImage"); gm.image = bpy.data.images.load(GR); gm.image.colorspace_settings.name = "Non-Color"
rr = pt.nodes.new("ShaderNodeMapRange"); rr.inputs[3].default_value = 0.86; rr.inputs[4].default_value = 0.38    # graphite is shinier
fib = pt.nodes.new("ShaderNodeTexNoise"); fib.inputs["Scale"].default_value = 900; fib.inputs["Detail"].default_value = 4
bmp = pt.nodes.new("ShaderNodeBump"); bmp.inputs["Strength"].default_value = 0.22; bmp.inputs["Distance"].default_value = 0.0004
tint = pt.nodes.new("ShaderNodeMix"); tint.data_type = "RGBA"; tint.blend_type = "MULTIPLY"; tint.inputs["Factor"].default_value = 1.0; tint.inputs[7].default_value = (0.93, 0.93, 0.92, 1)
pt.links.new(im.outputs[0], tint.inputs[6]); pt.links.new(tint.outputs[2], pb.inputs["Base Color"]); pt.links.new(gm.outputs[0], rr.inputs[0]); pt.links.new(rr.outputs[0], pb.inputs["Roughness"])
pt.links.new(fib.outputs[0], bmp.inputs["Height"]); pt.links.new(bmp.outputs[0], pb.inputs["Normal"])
pg.data.materials.append(pm)

# ---- the desk: dark charcoal laminate
dm, db = mat("desk", (0.035, 0.037, 0.04), 0.42)
dn = dm.node_tree; dz = dn.nodes.new("ShaderNodeTexNoise"); dz.inputs["Scale"].default_value = 30; dz.inputs["Detail"].default_value = 10
dr = dn.nodes.new("ShaderNodeMapRange"); dr.inputs[3].default_value = 0.34; dr.inputs[4].default_value = 0.55
dn.links.new(dz.outputs[0], dr.inputs[0]); dn.links.new(dr.outputs[0], db.inputs["Roughness"])
bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, 0)); bpy.context.object.data.materials.append(dm)

# ---- the pencil: unpainted cedar hexagon, a sharpened cone and a graphite point
L, R = 0.15, 0.0037
ang = math.radians(152); C = Vector((0.184, -0.066, 0.0))
dirv = Vector((math.cos(ang), math.sin(ang), 0))
cedar, cb = mat("cedar", (0.55, 0.33, 0.18), 0.5)
cn = cedar.node_tree; cw = cn.nodes.new("ShaderNodeTexWave"); cw.wave_type = "BANDS"; cw.bands_direction = "Z"; cw.inputs["Scale"].default_value = 60; cw.inputs["Distortion"].default_value = 4
crp = cn.nodes.new("ShaderNodeValToRGB"); crp.color_ramp.elements[0].color = (0.46, 0.26, 0.13, 1); crp.color_ramp.elements[1].color = (0.6, 0.38, 0.21, 1)
cn.links.new(cw.outputs[1], crp.inputs[0]); cn.links.new(crp.outputs[0], cb.inputs["Base Color"])
graph, _ = mat("lead", (0.05, 0.05, 0.055), 0.3, Metallic=0.6)
q = dirv.to_track_quat("Z", "Y")
body_c = C + Vector((0, 0, R * 0.87))
bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=R, depth=L, location=body_c); bd = bpy.context.object
bd.rotation_mode = "QUATERNION"; bd.rotation_quaternion = q; bd.data.materials.append(cedar)
bv = bd.modifiers.new("b", "BEVEL"); bv.width = 0.0004; bv.segments = 2
cone_c = body_c + dirv * (L / 2 + 0.0095)
bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=R * 0.93, radius2=0.0009, depth=0.019, location=cone_c); cn_ = bpy.context.object
cn_.rotation_mode = "QUATERNION"; cn_.rotation_quaternion = q; cn_.data.materials.append(cedar)
tip_c = body_c + dirv * (L / 2 + 0.019 + 0.0022)
bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.0009, radius2=0.0001, depth=0.0045, location=tip_c); tp = bpy.context.object
tp.rotation_mode = "QUATERNION"; tp.rotation_quaternion = q; tp.data.materials.append(graph)
# the pencil rests on its flats; small rotation about its axis so one face catches the light
bd.rotation_quaternion = q @ __import__("mathutils").Quaternion((0, 0, 1), math.radians(30))
# the far end: cut flat, showing the lead
end_c = body_c - dirv * (L / 2 + 0.0003)
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.0011, depth=0.0008, location=end_c); ed = bpy.context.object
ed.rotation_mode = "QUATERNION"; ed.rotation_quaternion = q; ed.data.materials.append(graph)

# ---- light: a large soft window to the upper left, a faint warm bounce from the right
bpy.ops.object.light_add(type="AREA", location=(-0.7, 0.3, 0.38)); kl = bpy.context.object
kl.data.shape = "RECTANGLE"; kl.data.size = 0.9; kl.data.size_y = 0.6; kl.data.energy = 16; kl.data.color = (0.96, 0.98, 1.0)
t = bpy.data.objects.new("kt", None); sc.collection.objects.link(t); t.location = (0, 0, 0)
c_ = kl.constraints.new("TRACK_TO"); c_.target = t; c_.track_axis = "TRACK_NEGATIVE_Z"; c_.up_axis = "UP_Y"
bpy.ops.object.light_add(type="AREA", location=(0.6, -0.3, 0.3)); fl = bpy.context.object
fl.data.size = 0.8; fl.data.energy = 1.5; fl.data.color = (1.0, 0.88, 0.75)
c2 = fl.constraints.new("TRACK_TO"); c2.target = t; c2.track_axis = "TRACK_NEGATIVE_Z"; c2.up_axis = "UP_Y"
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.5, 0.52, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.05

cd = bpy.data.cameras.new("c"); cd.lens = 62; cd.dof.use_dof = True; cd.dof.aperture_fstop = 7.0
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0.05, -0.37, 0.39)
tg = bpy.data.objects.new("ct", None); sc.collection.objects.link(tg); tg.location = (0.012, -0.012, 0.0)
tr = cam.constraints.new("TRACK_TO"); tr.target = tg; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
fo = bpy.data.objects.new("fo", None); sc.collection.objects.link(fo); fo.location = (0.0, 0.0, 0); cd.dof.focus_object = fo

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True; cy.max_bounces = 8
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = -0.35
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
