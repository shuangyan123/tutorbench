# Evidence Matrix cover, "48 cases × 0 public runs": a 48-cell seed tray (6 × 8, the 24 public cases
# in English and Chinese) on a galvanised greenhouse bench. Every cell is sown and labelled, nothing
# has come up yet: the matrix is laid out, the runs are still to come (stakes from seedtray_tex.py).
# Light: bright overcast greenhouse daylight, and a low sun through the glazing that lays the
# shadows of the roof bars across the tray.
# usage: python seedtray.py TEX_DIR OUT.png [W H SPP]
# tuning (env): EXPO FSTOP SUN SUNDIR SKY SOFT CAM TGT LENS
import math, sys, os, random
import bpy, bmesh, addon_utils
from mathutils import Vector, Euler

a = sys.argv[1:]; TEX = os.path.abspath(a[0]); OUT = os.path.abspath(a[1])
W = int(a[2]) if len(a) > 2 else 900; H = int(a[3]) if len(a) > 3 else 1100; SPP = int(a[4]) if len(a) > 4 else 192
env = lambda k, d: os.environ.get(k, d)
vec = lambda k, d: Vector([float(v) for v in env(k, d).split(",")])
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene; MM = 0.001

def mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True; return m, m.node_tree, m.node_tree.nodes["Principled BSDF"]

# ---- the tray: black recycled plastic, 6 x 8 tapered cells at 38 mm pitch
NX, NY, P = 6, 8, 38.0
TW, TL, TD = NX * P + 4, NY * P + 4, 44.0
tm, tnt, tp = mat("tray plastic"); tp.inputs["Base Color"].default_value = (0.018, 0.018, 0.02, 1); tp.inputs["Roughness"].default_value = 0.42
tn = tnt.nodes.new("ShaderNodeTexNoise"); tn.inputs["Scale"].default_value = 700; tb = tnt.nodes.new("ShaderNodeBump"); tb.inputs["Strength"].default_value = 0.06
tnt.links.new(tn.outputs["Fac"], tb.inputs["Height"]); tnt.links.new(tb.outputs["Normal"], tp.inputs["Normal"])
# body up to just under the compost, then the cell walls standing proud of it
SOIL = TD - 7.0
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, SOIL / 2 * MM)); tray = bpy.context.object
tray.scale = (TW * MM, TL * MM, SOIL * MM); bpy.ops.object.transform_apply(scale=True); tray.data.materials.append(tm)
cells = [((i - (NX - 1) / 2) * P * MM, (j - (NY - 1) / 2) * P * MM) for i in range(NX) for j in range(NY)]
def wall(x, y, sx, sy, hz=9.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, (SOIL - 2 + hz / 2) * MM)); o = bpy.context.object
    o.scale = (sx, sy, hz * MM); bpy.ops.object.transform_apply(scale=True)
    bv = o.modifiers.new("b", "BEVEL"); bv.width = 0.45 * MM; bv.segments = 3; o.data.materials.append(tm); return o
for i in range(NX + 1):
    x = (i - NX / 2) * P * MM; edge = i in (0, NX)
    wall(x + (-1.0 if i == 0 else 1.0 if i == NX else 0) * MM, 0, (3.0 if edge else 1.3) * MM, TL * MM)
for j in range(NY + 1):
    y = (j - NY / 2) * P * MM; edge = j in (0, NY)
    wall(0, y + (-1.0 if j == 0 else 1.0 if j == NY else 0) * MM, TW * MM, (3.0 if edge else 1.3) * MM)

# ---- compost in every cell: dark, crumbly, with flecks of perlite, a little below the rim
sm, snt, sp = mat("compost")
v = snt.nodes.new("ShaderNodeTexVoronoi"); v.inputs["Scale"].default_value = 1400
vr = snt.nodes.new("ShaderNodeValToRGB"); vr.color_ramp.elements[0].position = 0.0; vr.color_ramp.elements[0].color = (0.85, 0.85, 0.82, 1)
vr.color_ramp.elements[1].position = 0.012; vr.color_ramp.elements[1].color = (0.05, 0.032, 0.02, 1)
n = snt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 300; n.inputs["Detail"].default_value = 8
nr = snt.nodes.new("ShaderNodeValToRGB"); nr.color_ramp.elements[0].color = (0.022, 0.014, 0.009, 1); nr.color_ramp.elements[1].color = (0.085, 0.055, 0.032, 1)
mx = snt.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.blend_type = "LIGHTEN"; mx.inputs["Factor"].default_value = 1.0
snt.links.new(v.outputs["Distance"], vr.inputs["Fac"]); snt.links.new(n.outputs["Fac"], nr.inputs["Fac"])
snt.links.new(nr.outputs["Color"], mx.inputs[6]); snt.links.new(vr.outputs["Color"], mx.inputs[7]); snt.links.new(mx.outputs[2], sp.inputs["Base Color"])
sp.inputs["Roughness"].default_value = 0.95
sb = snt.nodes.new("ShaderNodeBump"); sb.inputs["Strength"].default_value = 0.3; sb.inputs["Distance"].default_value = 0.002
snt.links.new(n.outputs["Fac"], sb.inputs["Height"]); snt.links.new(sb.outputs["Normal"], sp.inputs["Normal"])
crumb = bpy.data.textures.new("crumb", "VORONOI"); crumb.noise_scale = 0.0016; crumb.distance_metric = "DISTANCE"
crumb.weight_1 = -1.0; crumb.weight_2 = 1.0
clod = bpy.data.textures.new("clod", "CLOUDS"); clod.noise_scale = 0.006; clod.noise_depth = 3
rnd = random.Random(5)
for k, (cx, cy) in enumerate(cells):
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=28, y_subdivisions=28, size=37 * MM, location=(cx, cy, (SOIL + 0.6 + rnd.uniform(-0.5, 0.5)) * MM)); s = bpy.context.object
    for vv in s.data.vertices:
        r = max(abs(vv.co.x), abs(vv.co.y)) / (18.5 * MM)
        vv.co.z += (rnd.uniform(-0.8, 0.8) + 2.2 * (1 - min(r, 1) ** 2)) * MM
    s.data.materials.append(sm)
    for p in s.data.polygons: p.use_smooth = True
    sub = s.modifiers.new("sub", "SUBSURF"); sub.subdivision_type = "SIMPLE"; sub.levels = sub.render_levels = 2
    for name, tex, amp in (("crumb", crumb, 0.55), ("clod", clod, 0.9)):
        dm_ = s.modifiers.new(name, "DISPLACE"); dm_.texture = tex; dm_.strength = amp * MM; dm_.texture_coords = "GLOBAL"

# ---- six labelled stakes, pushed in at slightly different angles
for k, (i, j) in enumerate([(0, 6), (1, 3), (2, 7), (3, 1), (4, 4), (5, 6)]):
    cx = (i - (NX - 1) / 2) * P * MM; cy = (j - (NY - 1) / 2) * P * MM
    bm = bmesh.new()
    pts = [(0, 0), (16, 0), (16, 88), (8, 100), (0, 88)]           # mm, the pointed end down
    vs = [bm.verts.new((x * MM - 8 * MM, 0, -y * MM + 100 * MM)) for x, y in pts]
    face = bm.faces.new(vs)
    uv = bm.loops.layers.uv.new("UV")
    for lo in face.loops:
        co = lo.vert.co; lo[uv].uv = ((100 * MM - co.z) / (100 * MM), (co.x + 8 * MM) / (16 * MM))
    me = bpy.data.meshes.new(f"stake{k}"); bm.to_mesh(me); bm.free()
    st = bpy.data.objects.new(f"stake{k}", me); sc.collection.objects.link(st)
    so = st.modifiers.new("t", "SOLIDIFY"); so.thickness = 0.9 * MM
    st.location = (cx, cy - 8 * MM, (SOIL - 30) * MM)
    st.rotation_euler = Euler((math.radians(rnd.uniform(-9, 3)), math.radians(rnd.uniform(-6, 6)), math.radians(rnd.uniform(-12, 12))))
    km, knt, kp = mat(f"stake{k}"); kp.inputs["Roughness"].default_value = 0.4
    kt = knt.nodes.new("ShaderNodeTexImage"); kt.image = bpy.data.images.load(os.path.join(TEX, f"stake_{k}.png"))
    knt.links.new(kt.outputs["Color"], kp.inputs["Base Color"]); kp.inputs["Subsurface Weight"].default_value = 0.15
    st.data.materials.append(km)

# ---- galvanised steel bench top
gm, gnt, gp = mat("galvanised")
gv = gnt.nodes.new("ShaderNodeTexVoronoi"); gv.inputs["Scale"].default_value = 22
gr = gnt.nodes.new("ShaderNodeValToRGB"); gr.color_ramp.elements[0].color = (0.30, 0.31, 0.33, 1); gr.color_ramp.elements[1].color = (0.42, 0.43, 0.45, 1)
gnt.links.new(gv.outputs["Color"], gr.inputs["Fac"]); gnt.links.new(gr.outputs["Color"], gp.inputs["Base Color"])
gro = gnt.nodes.new("ShaderNodeMapRange"); gro.inputs["To Min"].default_value = 0.5; gro.inputs["To Max"].default_value = 0.7
gnt.links.new(gv.outputs["Distance"], gro.inputs["Value"]); gnt.links.new(gro.outputs["Result"], gp.inputs["Roughness"]); gp.inputs["Metallic"].default_value = 0.7
bpy.ops.mesh.primitive_plane_add(size=2.5, location=(0, 0, 0)); bpy.context.object.data.materials.append(gm)

# ---- light: soft overcast from above, and low sun through the glazing bars
bpy.ops.object.light_add(type="AREA", location=(0.2, 0.3, 1.6)); soft = bpy.context.object
soft.data.size = 2.4; soft.data.energy = float(env("SOFT", 12)); soft.data.color = (0.9, 0.95, 1.0)
bpy.ops.object.light_add(type="SUN"); sun = bpy.context.object
sun.data.energy = float(env("SUN", 6.0)); sun.data.angle = math.radians(0.8); sun.data.color = (1.0, 0.9, 0.74)
sd = vec("SUNDIR", "-0.8,-0.3,0.55").normalized()
sun.rotation_mode = "QUATERNION"; sun.rotation_quaternion = (-sd).to_track_quat("-Z", "Y")
# roof bars: long thin boxes high between the sun and the tray, out of the camera's view
across = Vector((-sd.y, sd.x, 0)).normalized()
for k in (range(-8, 9) if env("BARS", "0") == "1" else []):
    along = Vector((sd.x, sd.y, 0)).normalized()
    bpy.ops.mesh.primitive_cube_add(size=1, location=sd * 1.4 + along * (k * 0.085)); bar = bpy.context.object
    bar.scale = (0.012, 3.0, 0.012); bar.rotation_euler = (0, 0, math.atan2(across.y, across.x) - math.pi / 2)
    bar.visible_camera = False; bar.visible_glossy = False; bar.visible_diffuse = False
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.82, 0.87, 0.95, 1); w.node_tree.nodes["Background"].inputs[1].default_value = float(env("SKY", 0.07))

cd = bpy.data.cameras.new("c"); cd.lens = float(env("LENS", 50)); cd.clip_start = 0.01
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = vec("CAM", "-0.12,-0.31,0.25")
ct = bpy.data.objects.new("ct", None); sc.collection.objects.link(ct); ct.location = vec("TGT", "0.02,0.04,0.03")
tr = cam.constraints.new("TRACK_TO"); tr.target = ct; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
cd.dof.use_dof = True; cd.dof.focus_distance = (cam.location - vec("FOCUS", "-0.01,-0.02,0.05")).length; cd.dof.aperture_fstop = float(env("FSTOP", 5.6))

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.max_bounces = 8; cy.sample_clamp_indirect = 20
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = float(env("EXPO", 0.0))
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
