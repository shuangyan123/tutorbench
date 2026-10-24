# Journal cover, "The Classroom Does Not Need 30 Robots": a classroom coat rail of identical hooks
# running off along the wall, one of them holding a hand-knitted mustard scarf. Warm late-afternoon
# sun through venetian blinds.
# usage: python hooks.py OUT.png [W H SPP]
import math, sys, os
import bpy, bmesh, addon_utils

a = sys.argv[1:]; OUT = os.path.abspath(a[0])
W = int(a[1]) if len(a) > 1 else 900; H = int(a[2]) if len(a) > 2 else 1100; SPP = int(a[3]) if len(a) > 3 else 128
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene

def mat(name, col, rough=0.6, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): b.inputs[k].default_value = v
    return m, b

wall_m, _ = mat("wall", (0.78, 0.72, 0.6), 0.85)
wood_m, _ = mat("rail", (0.42, 0.26, 0.13), 0.45)
iron_m, _ = mat("iron", (0.12, 0.12, 0.13), 0.35, Metallic=1.0)

# the wall lies in the XZ plane at y = 0; the rail runs along x
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0.0, 0), rotation=(math.radians(90), 0, 0)); bpy.context.object.data.materials.append(wall_m)
bpy.ops.mesh.primitive_cube_add(size=1, location=(4, -0.03, 1.5)); r = bpy.context.object
r.scale = (14, 0.04, 0.16); r.data.materials.append(wood_m); bv = r.modifiers.new("b", "BEVEL"); bv.width = 0.01; bv.segments = 3

def hook(x):
    """a cast double hook: a small plate and a curved arm with an upturned tip"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -0.06, 1.5)); p = bpy.context.object
    p.scale = (0.035, 0.012, 0.11); p.data.materials.append(iron_m)
    bv = p.modifiers.new("b", "BEVEL"); bv.width = 0.004; bv.segments = 2
    pts = [(0, -0.06, 1.47), (0, -0.14, 1.44), (0, -0.2, 1.38), (0, -0.22, 1.31), (0, -0.2, 1.27), (0, -0.17, 1.29)]
    cu = bpy.data.curves.new("h", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 0.009; cu.bevel_resolution = 4
    sp = cu.splines.new("NURBS"); sp.points.add(len(pts) - 1)
    for i, (px, py, pz) in enumerate(pts): sp.points[i].co = (x + px, py, pz, 1)
    sp.order_u = 4; sp.use_endpoint_u = True
    o = bpy.data.objects.new("h", cu); sc.collection.objects.link(o); o.data.materials.append(iron_m)

XS = [i * 0.42 for i in range(-3, 28)]
for x in XS: hook(x)

# the scarf: a knitted strip hung over one hook, two ends falling to different lengths
HX = XS[5]
bm = bmesh.new(); N = 90; WID = 0.2; prev = None
def path(t):
    # t in [0, 1]: front end hanging, over the hook, back end hanging (shorter, tucked toward the wall)
    if t < 0.42:
        u = t / 0.42; return (HX + 0.02 * math.sin(u * 5), -0.26 - 0.02 * u, 0.55 + 0.76 * u)
    if t < 0.58:
        u = (t - 0.42) / 0.16; ang = math.pi * u
        return (HX, -0.215 + 0.055 * math.cos(ang) - 0.0, 1.31 + 0.05 * math.sin(ang))
    u = (t - 0.58) / 0.42; return (HX - 0.03 * math.sin(u * 4), -0.16 + 0.03 * u, 1.31 - 0.62 * u)
rows = []
for k in range(N + 1):
    t = k / N; x, y, z = path(t); tw = 0.25 * math.sin(t * 6.0)
    rows.append([bm.verts.new((x + (s * WID / 2) * math.cos(tw), y + (s * WID / 2) * math.sin(tw) * 0.4, z)) for s in (-1, 0, 1)])
for A, B in zip(rows, rows[1:]):
    for j in range(2): bm.faces.new((A[j], A[j + 1], B[j + 1], B[j]))
me = bpy.data.meshes.new("scarf"); bm.to_mesh(me); bm.free()
for p in me.polygons: p.use_smooth = True
sf = bpy.data.objects.new("scarf", me); sc.collection.objects.link(sf)
so = sf.modifiers.new("t", "SOLIDIFY"); so.thickness = 0.04; ss = sf.modifiers.new("s", "SUBSURF"); ss.levels = 2
km, kb = mat("knit", (0.44, 0.25, 0.02), 0.95, **{"Sheen Weight": 0.6, "Sheen Roughness": 0.4})
kn = km.node_tree; tc = kn.nodes.new("ShaderNodeTexCoord"); wv = kn.nodes.new("ShaderNodeTexWave"); wv.inputs["Scale"].default_value = 140
wv.bands_direction = "X"; bp = kn.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 1.0
nz = kn.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 300; mx = kn.nodes.new("ShaderNodeMath"); mx.operation = "ADD"
kn.links.new(tc.outputs["Object"], wv.inputs[0]); kn.links.new(wv.outputs[1], mx.inputs[0]); kn.links.new(nz.outputs[0], mx.inputs[1])
kn.links.new(mx.outputs[0], bp.inputs["Height"]); kn.links.new(bp.outputs[0], kb.inputs["Normal"])
sf.data.materials.append(km)
# fringe: loose strands at both ends of the scarf
for t in (0.0, 1.0):
    x0, y0, z0 = path(t)
    for j in range(9):
        off = (j - 4) / 4 * WID / 2 * 0.9
        bpy.ops.mesh.primitive_cylinder_add(radius=0.006, depth=0.09, vertices=6, location=(x0 + off, y0, z0 - 0.045))
        fr = bpy.context.object; fr.rotation_euler = (0, math.radians((j - 4) * 1.5), 0); fr.data.materials.append(km)

# late sun through venetian blinds: a low warm sun and a slatted screen off to the left
bpy.ops.object.light_add(type="SUN", location=(0, -5, 5)); sun = bpy.context.object
sun.data.energy = 8.0; sun.data.angle = math.radians(0.8); sun.data.color = (1.0, 0.74, 0.46)
sun.rotation_euler = (math.radians(68), 0, math.radians(-38))
for i in range(40):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-3.2, -3.8, -0.4 + i * 0.13), rotation=(math.radians(-25), 0, math.radians(-38)))
    s = bpy.context.object; s.scale = (6, 0.06, 0.005); s.visible_camera = False
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.32, 0.27, 0.22, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.2

cd = bpy.data.cameras.new("c"); cd.lens = 50; cd.dof.use_dof = True; cd.dof.aperture_fstop = 2.2
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (HX - 1.25, -2.0, 1.15)
tgt = bpy.data.objects.new("t", None); sc.collection.objects.link(tgt); tgt.location = (HX + 0.42, -0.12, 1.02)
tr = cam.constraints.new("TRACK_TO"); tr.target = tgt; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
cd.dof.focus_object = sf

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True; cy.max_bounces = 8
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = 0.0
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
