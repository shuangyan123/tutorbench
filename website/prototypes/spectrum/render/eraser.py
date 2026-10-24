# Journal cover, "When Learning Starts to Feel Like Failure": a worn eraser resting on an exercise
# page whose first attempt has been rubbed out, crumbs around it, in flat overcast daylight.
# usage: python eraser.py PAGE_TEXTURE.png OUT.png [W H SPP]
import math, sys, os, random
import bpy, addon_utils

a = sys.argv[1:]; TEX = os.path.abspath(a[0]); OUT = os.path.abspath(a[1])
W = int(a[2]) if len(a) > 2 else 900; H = int(a[3]) if len(a) > 3 else 1100; SPP = int(a[4]) if len(a) > 4 else 128
random.seed(5)
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene

def mat(name, col, rough=0.6, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): b.inputs[k].default_value = v
    return m, b

# the page: a slightly curled sheet carrying the pencil texture
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0)); page = bpy.context.object
page.scale = (2.1, 2.8, 1); bpy.ops.object.transform_apply(scale=True)
sub = page.modifiers.new("s", "SUBSURF"); sub.levels = 4; sub.subdivision_type = "SIMPLE"
bend = page.modifiers.new("b", "SIMPLE_DEFORM"); bend.deform_method = "BEND"; bend.angle = math.radians(8); bend.deform_axis = "Y"
pm, pb = mat("paper", (1, 1, 1), 0.7, **{"Subsurface Weight": 0.05})
img = pm.node_tree.nodes.new("ShaderNodeTexImage"); img.image = bpy.data.images.load(TEX)
pm.node_tree.links.new(img.outputs[0], pb.inputs["Base Color"])
page.data.materials.append(pm)
# the table under it: pale grey linoleum
bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, -0.004)); tm, _ = mat("table", (0.42, 0.43, 0.44), 0.55)
bpy.context.object.data.materials.append(tm)

# the eraser: a white block, one end worn round and grey with graphite
bpy.ops.mesh.primitive_cube_add(size=1, location=(0.3, -0.25, 0.09), rotation=(0, 0, math.radians(-28))); er = bpy.context.object
er.scale = (0.62, 0.24, 0.17); bpy.ops.object.transform_apply(scale=True)
bev = er.modifiers.new("b", "BEVEL"); bev.width = 0.035; bev.segments = 6
em, eb = mat("eraser", (0.9, 0.89, 0.86), 0.62)
gc = em.node_tree.nodes.new("ShaderNodeTexGradient"); gc.gradient_type = "LINEAR"
co = em.node_tree.nodes.new("ShaderNodeTexCoord"); mp = em.node_tree.nodes.new("ShaderNodeMapping"); mp.inputs["Location"].default_value = (0.5, 0, 0)
rp = em.node_tree.nodes.new("ShaderNodeValToRGB"); rp.color_ramp.elements[0].position = 0.72; rp.color_ramp.elements[0].color = (0.9, 0.89, 0.86, 1)
rp.color_ramp.elements[1].position = 1.0; rp.color_ramp.elements[1].color = (0.36, 0.36, 0.37, 1)
L_ = em.node_tree.links
L_.new(co.outputs["Object"], mp.inputs[0]); L_.new(mp.outputs[0], gc.inputs[0]); L_.new(gc.outputs[0], rp.inputs[0]); L_.new(rp.outputs[0], eb.inputs["Base Color"])
er.data.materials.append(em)
# a paper sleeve around the other end
bpy.ops.mesh.primitive_cube_add(size=1, location=(0.19, -0.19, 0.09), rotation=(0, 0, math.radians(-28))); sl = bpy.context.object
sl.scale = (0.32, 0.25, 0.18); sm, _ = mat("sleeve", (0.2, 0.22, 0.26), 0.5); sl.data.materials.append(sm)
bv = sl.modifiers.new("b", "BEVEL"); bv.width = 0.01; bv.segments = 3

# crumbs: small rolled curls of rubber and graphite, gathered near the rubbed-out lines
cm, _ = mat("crumb", (0.6, 0.6, 0.6), 0.92)
for i in range(40):
    x = random.gauss(0.05, 0.3); y = random.gauss(0.75, 0.22)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=12, ring_count=8, location=(x, y, 0.01), rotation=(0, 0, random.uniform(0, math.pi)))
    c = bpy.context.object; L = random.uniform(0.018, 0.05); r = random.uniform(0.006, 0.011)
    c.scale = (L, r, r * 0.8); c.data.materials.append(cm)
    tx = bpy.data.textures.new(f"n{i}", "CLOUDS"); tx.noise_scale = 0.4
    dsp = c.modifiers.new("d", "DISPLACE"); dsp.texture = tx; dsp.strength = 0.25
    for p_ in c.data.polygons: p_.use_smooth = True

# overcast daylight: one big soft window, a dim fill, a grey sky
bpy.ops.object.light_add(type="AREA", location=(-3.5, 2.5, 4.0)); k = bpy.context.object
k.data.shape = "RECTANGLE"; k.data.size = 5; k.data.size_y = 3.5; k.data.energy = 700; k.data.color = (0.93, 0.96, 1.0)
k.rotation_euler = (-k.location).to_track_quat("-Z", "Y").to_euler()
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.57, 0.6, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.25

cd = bpy.data.cameras.new("c"); cd.lens = 85; cd.dof.use_dof = True; cd.dof.aperture_fstop = 2.8
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (1.1, -2.4, 2.9)
tgt = bpy.data.objects.new("t", None); sc.collection.objects.link(tgt); tgt.location = (0.1, 0.25, 0)
tr = cam.constraints.new("TRACK_TO"); tr.target = tgt; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
cd.dof.focus_object = er

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True; cy.max_bounces = 8
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Base Contrast"; sc.view_settings.exposure = -0.3
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
