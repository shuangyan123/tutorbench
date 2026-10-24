# Journal cover, "Teaching and Supervision Are Different Jobs": a stick of chalk on the ledge of a
# dark green board, and across the board the shadow of the wall clock. Cool early-morning side light.
# usage: python chalk.py OUT.png [W H SPP]
import math, sys, os, random
import bpy, addon_utils

a = sys.argv[1:]; OUT = os.path.abspath(a[0])
W = int(a[1]) if len(a) > 1 else 900; H = int(a[2]) if len(a) > 2 else 1100; SPP = int(a[3]) if len(a) > 3 else 128
random.seed(3)
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene

def mat(name, col, rough=0.6, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): b.inputs[k].default_value = v
    return m, b

# the board, with the grey ghost of yesterday's lesson wiped across it
bm_, bb = mat("board", (0.05, 0.11, 0.09), 0.8)
nt = bm_.node_tree; tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (0.6, 1, 3.5)
nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 3.5; nz.inputs["Detail"].default_value = 6
rp = nt.nodes.new("ShaderNodeValToRGB"); rp.color_ramp.elements[0].position = 0.5; rp.color_ramp.elements[0].color = (0.05, 0.11, 0.09, 1)
rp.color_ramp.elements[1].position = 0.78; rp.color_ramp.elements[1].color = (0.2, 0.25, 0.23, 1)
nt.links.new(tc.outputs["Object"], mp.inputs[0]); nt.links.new(mp.outputs[0], nz.inputs[0]); nt.links.new(nz.outputs[0], rp.inputs[0]); nt.links.new(rp.outputs[0], bb.inputs["Base Color"])
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.6), rotation=(math.radians(90), 0, 0)); bd = bpy.context.object
bd.scale = (4, 1.3, 1); bd.data.materials.append(bm_)

# the painted wall below the board
wl, _ = mat("wall", (0.55, 0.57, 0.55), 0.85)
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.01, -0.6), rotation=(math.radians(90), 0, 0)); wo = bpy.context.object
wo.scale = (6, 1.1, 1); wo.data.materials.append(wl)
# the ledge: pale aluminium, chalk dust along it
al, _ = mat("alu", (0.72, 0.73, 0.74), 0.38, Metallic=1.0)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.05, -0.04)); lg = bpy.context.object
lg.scale = (4, 0.1, 0.02); lg.data.materials.append(al)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.1, -0.02)); lip = bpy.context.object
lip.scale = (4, 0.008, 0.035); lip.data.materials.append(al)
dust, _ = mat("dust", (0.85, 0.86, 0.84), 0.95)
for i in range(160):
    bpy.ops.mesh.primitive_ico_sphere_add(radius=random.uniform(0.0007, 0.0018), subdivisions=1,
                                          location=(random.gauss(0.05, 0.25), random.uniform(-0.09, -0.01), -0.027))
    bpy.context.object.data.materials.append(dust)

# the chalk: one white stick, one end worn to a slant
bpy.ops.mesh.primitive_cylinder_add(radius=0.0115, depth=0.082, vertices=32, location=(0.06, -0.05, -0.017), rotation=(0, math.radians(90), math.radians(12)))
ch = bpy.context.object; cm, cb = mat("chalk", (0.93, 0.93, 0.9), 0.95)
cn = cm.node_tree; cz = cn.nodes.new("ShaderNodeTexNoise"); cz.inputs["Scale"].default_value = 400
cbp = cn.nodes.new("ShaderNodeBump"); cbp.inputs["Strength"].default_value = 0.4
cn.links.new(cz.outputs[0], cbp.inputs["Height"]); cn.links.new(cbp.outputs[0], cb.inputs["Normal"])
ch.data.materials.append(cm)
bv = ch.modifiers.new("b", "BEVEL"); bv.width = 0.003; bv.segments = 3

# the wall clock is out of frame; only its shadow reaches the board
def occ(o): o.visible_camera = False; o.visible_glossy = False
bpy.ops.mesh.primitive_torus_add(major_radius=0.3, minor_radius=0.025, location=(-0.25, -0.4, 0.5), rotation=(math.radians(90), 0, 0)); occ(bpy.context.object)
for ang, ln, wd in ((math.radians(-60), 0.2, 0.018), (math.radians(35), 0.27, 0.011)):   # hour and minute hands
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.25 + math.sin(ang) * ln / 2, -0.4, 0.5 + math.cos(ang) * ln / 2), rotation=(0, ang, 0))
    h = bpy.context.object; h.scale = (wd, 0.005, ln); occ(h)
for k in range(12):   # hour ticks
    an = 2 * math.pi * k / 12
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.25 + math.sin(an) * 0.25, -0.4, 0.5 + math.cos(an) * 0.25), rotation=(0, an, 0))
    t_ = bpy.context.object; t_.scale = (0.008, 0.005, 0.04); occ(t_)

# early morning: a cool low light from the window side, small enough for a clean shadow
bpy.ops.object.light_add(type="SPOT", location=(-1.3, -2.6, 1.25)); L = bpy.context.object
L.data.energy = 380; L.data.color = (0.82, 0.9, 1.0); L.data.spot_size = math.radians(70); L.data.spot_blend = 0.6; L.data.shadow_soft_size = 0.03
tg = bpy.data.objects.new("lt", None); sc.collection.objects.link(tg); tg.location = (0.1, 0, 0.45)
c_ = L.constraints.new("TRACK_TO"); c_.target = tg; c_.track_axis = "TRACK_NEGATIVE_Z"; c_.up_axis = "UP_Y"
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.2, 0.22, 0.26, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.3

cd = bpy.data.cameras.new("c"); cd.lens = 42; cd.dof.use_dof = True; cd.dof.aperture_fstop = 2.0
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0.26, -0.5, 0.26)
tgt = bpy.data.objects.new("t", None); sc.collection.objects.link(tgt); tgt.location = (-0.06, 0, 0.06)
tr = cam.constraints.new("TRACK_TO"); tr.target = tgt; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
cd.dof.focus_object = ch

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True; cy.max_bounces = 8
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Base Contrast"; sc.view_settings.exposure = 0.0
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
