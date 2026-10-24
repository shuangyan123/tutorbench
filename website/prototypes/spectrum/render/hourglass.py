# Journal cover for "Why Teaching Does Not Scale": an hourglass on a wooden desk at night, under
# one warm desk lamp. Attention is the scarce resource; the sand is time running through one neck.
# usage: python hourglass.py OUT.png [W H SPP]
import math, sys, os
import bpy, bmesh, addon_utils

a = sys.argv[1:]; OUT = os.path.abspath(a[0])
W = int(a[1]) if len(a) > 1 else 900; H = int(a[2]) if len(a) > 2 else 1100; SPP = int(a[3]) if len(a) > 3 else 128

bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene

def bulb_r(z):
    """outer radius of the glass at height z in [-1, 1] (neck at 0)"""
    t = min(1.0, abs(z) / 0.97)
    return 0.055 + 0.47 * math.sin(math.pi * t) ** 0.75 if t < 1 else 0.2

def lathe(profile, name, seg=72):
    """profile: list of (r, z) from bottom to top; closes at both ends"""
    bm = bmesh.new(); rings = []
    for r, z in profile:
        rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), z)) for i in range(seg)])
    for A, B in zip(rings, rings[1:]):
        for i in range(seg):
            bm.faces.new((A[i], A[(i + 1) % seg], B[(i + 1) % seg], B[i]))
    bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    return o

def mat(name, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    for k, v in kw.items(): b.inputs[k].default_value = v
    return m, b

# glass: a closed lathe shell with thickness
zs = [-0.97 + 1.94 * i / 80 for i in range(81)]
glass = lathe([(bulb_r(z), z) for z in zs], "glass")
sol = glass.modifiers.new("t", "SOLIDIFY"); sol.thickness = 0.018; sol.offset = -1
mg, _ = mat("glass", **{"Base Color": (1, 0.99, 0.97, 1), "Transmission Weight": 1.0, "Roughness": 0.01, "IOR": 1.5})
# shadow rays pass straight through the glass, so the lamp reaches the sand without caustics
gt = mg.node_tree; gout = gt.nodes["Material Output"]; gbsdf = gt.nodes["Principled BSDF"]
lp = gt.nodes.new("ShaderNodeLightPath"); tr_ = gt.nodes.new("ShaderNodeBsdfTransparent"); mix = gt.nodes.new("ShaderNodeMixShader")
gt.links.new(lp.outputs["Is Shadow Ray"], mix.inputs[0]); gt.links.new(gbsdf.outputs[0], mix.inputs[1]); gt.links.new(tr_.outputs[0], mix.inputs[2])
gt.links.new(mix.outputs[0], gout.inputs["Surface"])
glass.data.materials.append(mg)

# sand: a heap in the lower bulb, a funnel left in the upper one, and one thin falling thread
inner = lambda z: bulb_r(z) - 0.03
low = [(0.001, -0.95)] + [(inner(z), z) for z in [-0.95 + 0.02 * i for i in range(23)]] + [(0.16, -0.43), (0.06, -0.37), (0.001, -0.355)]
up = [(0.001, 0.07)] + [(inner(z), z) for z in [0.07 + 0.02 * i for i in range(20)]] + [(0.25, 0.47), (0.08, 0.40), (0.001, 0.37)]
ms, sb = mat("sand", **{"Base Color": (0.82, 0.54, 0.24, 1), "Roughness": 0.85})
nt = ms.node_tree; nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 900
bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.35
nt.links.new(nz.outputs[0], bump.inputs["Height"]); nt.links.new(bump.outputs[0], sb.inputs["Normal"])
for prof, nm in ((low, "sand_low"), (up, "sand_up")):
    o = lathe(prof, nm); o.data.materials.append(ms)
bpy.ops.mesh.primitive_cylinder_add(radius=0.005, depth=0.42, location=(0, 0, -0.14), vertices=12)
bpy.context.object.data.materials.append(ms)

# walnut frame: two caps and three turned posts
mw, wb = mat("walnut", **{"Roughness": 0.38, "Coat Weight": 0.4, "Coat Roughness": 0.15})
wn = mw.node_tree; wave = wn.nodes.new("ShaderNodeTexWave"); wave.inputs["Scale"].default_value = 2.2; wave.inputs["Distortion"].default_value = 6
ramp = wn.nodes.new("ShaderNodeValToRGB"); ramp.color_ramp.elements[0].color = (0.10, 0.045, 0.02, 1); ramp.color_ramp.elements[1].color = (0.26, 0.13, 0.06, 1)
wn.links.new(wave.outputs[1], ramp.inputs[0]); wn.links.new(ramp.outputs[0], wb.inputs["Base Color"])
for z in (-1.02, 1.02):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.64, depth=0.09, location=(0, 0, z), vertices=96)
    c = bpy.context.object; c.data.materials.append(mw)
    bev = c.modifiers.new("b", "BEVEL"); bev.width = 0.02; bev.segments = 4
for i in range(3):
    ang = 2 * math.pi * i / 3 + 0.5
    prof = [(0.032 + 0.012 * math.sin(math.pi * (k / 20)) ** 2 * (1 + 0.6 * math.cos(6 * math.pi * k / 20)), -0.98 + 1.96 * k / 20) for k in range(21)]
    p = lathe(prof, f"post{i}", 24); p.location = (0.57 * math.cos(ang), 0.57 * math.sin(ang), 0); p.data.materials.append(mw)

# desk and the dark room behind it
md, db = mat("desk", **{"Roughness": 0.45, "Coat Weight": 0.25, "Coat Roughness": 0.2})
dn = md.node_tree; tc = dn.nodes.new("ShaderNodeTexCoord"); mp = dn.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (0.12, 1.6, 1)
dw = dn.nodes.new("ShaderNodeTexWave"); dw.wave_type = "BANDS"; dw.inputs["Scale"].default_value = 1.6; dw.inputs["Distortion"].default_value = 2.5; dw.inputs["Detail"].default_value = 2
dr = dn.nodes.new("ShaderNodeValToRGB"); dr.color_ramp.elements[0].color = (0.2, 0.1, 0.045, 1); dr.color_ramp.elements[1].color = (0.3, 0.16, 0.07, 1)
dn.links.new(tc.outputs["Object"], mp.inputs[0]); dn.links.new(mp.outputs[0], dw.inputs[0]); dn.links.new(dw.outputs[1], dr.inputs[0]); dn.links.new(dr.outputs[0], db.inputs["Base Color"])
bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, -1.065)); bpy.context.object.data.materials.append(md)
mwall, _ = mat("wall", **{"Base Color": (0.32, 0.27, 0.22, 1), "Roughness": 0.9})
bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 6, 0), rotation=(math.radians(90), 0, 0)); bpy.context.object.data.materials.append(mwall)

# the desk lamp: one warm spot from upper left, nothing else but a trace of room light
bpy.ops.object.light_add(type="SPOT", location=(-2.4, -2.2, 3.8)); L = bpy.context.object
L.data.energy = 2000; L.data.color = (1.0, 0.70, 0.42); L.data.spot_size = math.radians(55); L.data.spot_blend = 0.7; L.data.shadow_soft_size = 0.25
L.rotation_euler = (-L.location).to_track_quat("-Z", "Y").to_euler()
# the lamp's own spill on the wall behind, which is what the glass shows at its edges
bpy.ops.object.light_add(type="AREA", location=(0.6, 3.2, 0.6)); B = bpy.context.object
B.data.shape = "DISK"; B.data.size = 3.0; B.data.energy = 260; B.data.color = (1.0, 0.66, 0.38)
B.rotation_euler = (math.radians(90), 0, math.radians(180))
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.012, 0.012, 0.016, 1)

cd = bpy.data.cameras.new("c"); cd.lens = 58; cd.dof.use_dof = True; cd.dof.aperture_fstop = 3.2
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (2.6, -7.2, 0.9); cd.dof.focus_distance = (cam.location.length)
tgt = bpy.data.objects.new("t", None); sc.collection.objects.link(tgt); tgt.location = (0, 0, -0.08)
tr = cam.constraints.new("TRACK_TO"); tr.target = tgt; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.transmission_bounces = 16; cy.glossy_bounces = 8; cy.max_bounces = 20; cy.caustics_refractive = False; cy.caustics_reflective = False
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = 0.4
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
