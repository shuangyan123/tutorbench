# Methodology cover, "How do you measure teaching?": gauge blocks, the reference standard of length.
# Four steel blocks wrung into one column (50 + 20 + 1.4 + 1.005 = 72.405 mm) stand on a black granite
# surface plate; three loose blocks lie beside it. Cool window light from behind left, a white card
# and a black flag to draw lines in the steel, a blue-grey paper sweep far behind.
# usage: python gauge_blocks.py LABEL_DIR OUT.png [W H SPP]   (env EXPO, FSTOP to tune)
import math, sys, os
import bpy, addon_utils
from mathutils import Vector

a = sys.argv[1:]; LBL = os.path.abspath(a[0]); OUT = os.path.abspath(a[1])
W = int(a[2]) if len(a) > 2 else 900; H = int(a[3]) if len(a) > 3 else 1100; SPP = int(a[4]) if len(a) > 4 else 192
EXPO = float(os.environ.get("EXPO", 0.0)); KEY = float(os.environ.get("KEY", 60)); STRIP = float(os.environ.get("STRIP", 14)); FSTOP = float(os.environ.get("FSTOP", 8))
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene

def mat(name, col, rough=0.5, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): b.inputs[k].default_value = v
    return m, b

# ---- steel: lapped measuring faces are mirrors, the ground sides carry a fine lengthwise grain
lapped, _ = mat("lapped", (0.8, 0.8, 0.82), 0.035, Metallic=1.0)
ground, gb = mat("ground", (0.74, 0.75, 0.77), 0.16, Metallic=1.0, Anisotropic=0.6)
gn = ground.node_tree; nz = gn.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 900; nz.inputs["Detail"].default_value = 2
mp = gn.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1, 1, 60); tc = gn.nodes.new("ShaderNodeTexCoord")
gn.links.new(tc.outputs["Object"], mp.inputs[0]); gn.links.new(mp.outputs[0], nz.inputs[0])
bm = gn.nodes.new("ShaderNodeBump"); bm.inputs["Strength"].default_value = 0.04
gn.links.new(nz.outputs[0], bm.inputs["Height"]); gn.links.new(bm.outputs[0], gb.inputs["Normal"])

def etched(path):
    m = bpy.data.materials.new(os.path.basename(path)); m.use_nodes = True; t = m.node_tree
    out = t.nodes["Material Output"]; pr = t.nodes["Principled BSDF"]
    pr.inputs["Base Color"].default_value = (0.42, 0.43, 0.45, 1); pr.inputs["Roughness"].default_value = 0.75; pr.inputs["Metallic"].default_value = 0.0
    tx = t.nodes.new("ShaderNodeTexImage"); tx.image = bpy.data.images.load(path); tx.interpolation = "Cubic"
    tr = t.nodes.new("ShaderNodeBsdfTransparent"); mx = t.nodes.new("ShaderNodeMixShader")
    t.links.new(tx.outputs["Alpha"], mx.inputs[0]); t.links.new(tr.outputs[0], mx.inputs[1]); t.links.new(pr.outputs[0], mx.inputs[2]); t.links.new(mx.outputs[0], out.inputs["Surface"])
    return m

def block(L, base, rotz, label, lie=False, tilt=0.0):
    """a 35 x 9 mm block of length L (mm); standing on a measuring face, or lying on its etched side"""
    L /= 1000; size = (0.035, L, 0.009) if lie else (0.035, 0.009, L)
    bpy.ops.mesh.primitive_cube_add(size=1); o = bpy.context.object; o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(ground); o.data.materials.append(lapped)
    axis = 1 if lie else 2                                   # the measuring faces are normal to this axis
    for p in o.data.polygons: p.material_index = 1 if abs(p.normal[axis]) > 0.9 else 0
    bv = o.modifiers.new("b", "BEVEL"); bv.width = min(0.00025, L / 5); bv.segments = 2; bv.limit_method = "ANGLE"
    o.data.polygons.foreach_set("use_smooth", [False] * len(o.data.polygons))
    o.rotation_euler = (tilt, 0, rotz); o.location = base + Vector((0, 0, size[2] / 2))
    # the etched face: the -Y side when standing, the top when lying
    bpy.ops.mesh.primitive_plane_add(size=1); lb = bpy.context.object
    if lie: lb.scale = (0.035, L, 1); lb.location = (0, 0, size[2] / 2 + 2e-6)
    else: lb.scale = (0.035, L, 1); lb.rotation_euler = (math.radians(90), 0, 0); lb.location = (0, -size[1] / 2 - 2e-6, 0)
    lb.data.materials.append(etched(os.path.join(LBL, label + ".png"))); lb.parent = o
    return o, size[2]

# the wrung column: largest at the bottom, each block wrung square onto the one below
R0 = math.radians(-55); z = 0.0
for L, name in ((50, "b50"), (20, "b20"), (1.4, "b1_4"), (1.005, "b1_005")):
    _, h = block(L, Vector((0, 0, z)), R0, name); z += h
# loose blocks on the plate
block(25, Vector((0.046, -0.024, 0)), math.radians(22), "b25", lie=True)
block(10, Vector((-0.04, -0.03, 0)), math.radians(-14), "b10")
block(2.5, Vector((0.004, -0.05, 0)), math.radians(-30), "b2_5")

# ---- the surface plate: honed black granite, flecked grey
gr, grb = mat("granite", (0.5, 0.5, 0.5), 0.3)
g = gr.node_tree; vo = g.nodes.new("ShaderNodeTexVoronoi"); vo.inputs["Scale"].default_value = 1500
n2 = g.nodes.new("ShaderNodeTexNoise"); n2.inputs["Scale"].default_value = 260; n2.inputs["Detail"].default_value = 6
mixc = g.nodes.new("ShaderNodeMix"); mixc.data_type = "RGBA"; mixc.blend_type = "OVERLAY"; mixc.inputs["Factor"].default_value = 0.55
g.links.new(n2.outputs["Color"], mixc.inputs[6]); g.links.new(vo.outputs["Color"], mixc.inputs[7])
bw = g.nodes.new("ShaderNodeRGBToBW"); g.links.new(mixc.outputs[2], bw.inputs[0])
ramp = g.nodes.new("ShaderNodeValToRGB"); el = ramp.color_ramp.elements
el[0].position = 0.5; el[0].color = (0.008, 0.008, 0.009, 1); el[1].position = 0.8; el[1].color = (0.3, 0.3, 0.31, 1)
e2 = el.new(0.66); e2.color = (0.03, 0.03, 0.033, 1)
g.links.new(bw.outputs[0], ramp.inputs[0]); g.links.new(ramp.outputs[0], grb.inputs["Base Color"])
gbm = g.nodes.new("ShaderNodeBump"); gbm.inputs["Strength"].default_value = 0.05; g.links.new(bw.outputs[0], gbm.inputs["Height"]); g.links.new(gbm.outputs[0], grb.inputs["Normal"])
bpy.ops.mesh.primitive_cube_add(size=1, location=(0.02, 0.06, -0.04)); pl = bpy.context.object; pl.scale = (0.7, 0.5, 0.08)
pl.data.materials.append(gr); b2 = pl.modifiers.new("b", "BEVEL"); b2.width = 0.004; b2.segments = 4

# ---- a blue-grey paper sweep far behind, out of focus
sw, _ = mat("sweep", (0.42, 0.47, 0.58), 0.9)
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.75, 0.3)); bg = bpy.context.object; bg.scale = (3, 1.2, 1); bg.rotation_euler = (math.radians(90), 0, 0)
bg.data.materials.append(sw)
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.4, -0.081)); fl = bpy.context.object; fl.scale = (3, 1.2, 1); fl.data.materials.append(sw)

# ---- light, as for a product table: a softbox overhead and behind, a narrow strip card low left that
# draws one bright line down the steel, a dim room so the faces read dark around it, the sweep lit apart
def area(loc, size, energy, col=(1, 1, 1), target=(0, 0, 0.035)):
    bpy.ops.object.light_add(type="AREA", location=loc); l = bpy.context.object; l.data.shape = "RECTANGLE"
    l.data.size, l.data.size_y = size; l.data.energy = energy; l.data.color = col
    t = bpy.data.objects.new("t", None); sc.collection.objects.link(t); t.location = target
    c = l.constraints.new("TRACK_TO"); c.target = t; c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"
    return l
area((0.02, 0.22, 0.5), (0.6, 0.35), KEY, (0.95, 0.97, 1.0))
area((-0.26, -0.24, 0.14), (0.05, 0.42), STRIP, (1.0, 0.98, 0.95))
area((0.3, -0.35, 0.25), (0.3, 0.3), 3, (1.0, 0.96, 0.92))
area((0.0, 0.42, 0.55), (1.2, 0.4), 55, (0.92, 0.95, 1.0), target=(0, 0.75, 0.1))
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.6, 0.65, 0.75, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.04

cd = bpy.data.cameras.new("c"); cd.lens = 135; cd.clip_start = 0.01
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (-0.12, -0.6, 0.2)
ct = bpy.data.objects.new("ct", None); sc.collection.objects.link(ct); ct.location = (0.004, -0.012, 0.026)
tr = cam.constraints.new("TRACK_TO"); tr.target = ct; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
cd.dof.use_dof = True; cd.dof.focus_distance = (Vector(cam.location) - Vector((0, -0.005, 0.036))).length; cd.dof.aperture_fstop = FSTOP

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.max_bounces = 12; cy.glossy_bounces = 8; cy.sample_clamp_indirect = 10
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = EXPO
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
