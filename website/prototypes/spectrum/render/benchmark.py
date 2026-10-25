# Benchmark cover, "The benchmark, made observable": a surveyor's bench mark, the fixed brass disc
# every height in a survey is read from, set in a weathered granite kerb. Its rim names the
# benchmark (engraving from benchmark_tex.py). Light: low early sun raking across the stone from the
# left, so the engraving and the grain stand out; a clear cool sky fills the shadows.
# usage: python benchmark.py TEX_DIR OUT.png [W H SPP]
# tuning (env): EXPO FSTOP SUN SUNDIR SKY CAM TGT LENS
import math, sys, os, random
import bpy, bmesh, addon_utils
from mathutils import Vector, Euler

a = sys.argv[1:]; TEX = os.path.abspath(a[0]); OUT = os.path.abspath(a[1])
W = int(a[2]) if len(a) > 2 else 900; H = int(a[3]) if len(a) > 3 else 1100; SPP = int(a[4]) if len(a) > 4 else 192
env = lambda k, d: os.environ.get(k, d)
vec = lambda k, d: Vector([float(v) for v in env(k, d).split(",")])
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene; MM = 0.001

def node_mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; p = nt.nodes["Principled BSDF"]; return m, nt, p

# ---- granite kerb: speckled grey stone, slightly rough and pitted
gm, nt, gp = node_mat("granite")
tc = nt.nodes.new("ShaderNodeTexCoord")
# crystals 2-6 mm: black mica, grey quartz, white and faintly pink feldspar
v1 = nt.nodes.new("ShaderNodeTexVoronoi"); v1.inputs["Scale"].default_value = 260; v1.inputs["Randomness"].default_value = 1.0
wob = nt.nodes.new("ShaderNodeTexNoise"); wob.inputs["Scale"].default_value = 90
wmix = nt.nodes.new("ShaderNodeMix"); wmix.data_type = "VECTOR"; wmix.inputs["Factor"].default_value = 0.012
nt.links.new(tc.outputs["Object"], wmix.inputs[4]); nt.links.new(wob.outputs["Color"], wmix.inputs[5]); nt.links.new(wmix.outputs[1], v1.inputs["Vector"])
sep = nt.nodes.new("ShaderNodeSeparateColor"); nt.links.new(v1.outputs["Color"], sep.inputs["Color"])
ramp = nt.nodes.new("ShaderNodeValToRGB"); ramp.color_ramp.interpolation = "CONSTANT"
els = ramp.color_ramp.elements
els[0].position = 0.0; els[0].color = (0.035, 0.033, 0.036, 1)
els[1].position = 0.22; els[1].color = (0.30, 0.30, 0.31, 1)
for pos, c in ((0.55, (0.55, 0.53, 0.52, 1)), (0.80, (0.74, 0.70, 0.67, 1)), (0.93, (0.66, 0.52, 0.48, 1))):
    el = els.new(pos); el.color = c
nt.links.new(sep.outputs[0], ramp.inputs["Fac"]); nt.links.new(ramp.outputs["Color"], gp.inputs["Base Color"])
n2 = nt.nodes.new("ShaderNodeTexNoise"); n2.inputs["Scale"].default_value = 160; n2.inputs["Detail"].default_value = 8; n2.inputs["Roughness"].default_value = 0.65
bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.35; bump.inputs["Distance"].default_value = 0.0015
nt.links.new(tc.outputs["Object"], n2.inputs["Vector"])
hsum = nt.nodes.new("ShaderNodeMath"); hsum.operation = "MULTIPLY_ADD"; hsum.inputs[1].default_value = 0.35
nt.links.new(v1.outputs["Distance"], hsum.inputs[0]); nt.links.new(n2.outputs["Fac"], hsum.inputs[2]); nt.links.new(hsum.outputs[0], bump.inputs["Height"])
nt.links.new(bump.outputs["Normal"], gp.inputs["Normal"]); gp.inputs["Roughness"].default_value = 0.72

def slab(name, x0, x1, chamfer=6):
    bpy.ops.mesh.primitive_cube_add(size=1); o = bpy.context.object; o.name = name
    o.scale = ((x1 - x0) * MM, 0.70, 0.15); o.location = ((x0 + x1) / 2 * MM, 0.27, -0.075)
    bv = o.modifiers.new("b", "BEVEL"); bv.width = chamfer * MM; bv.segments = 4
    o.data.materials.append(gm); return o
kerb = slab("kerb", -330, 72)
slab("kerb2", 76, 520)                       # the next kerb stone, a 4 mm joint away
# a recess for the disc
bpy.ops.mesh.primitive_cylinder_add(radius=44 * MM, depth=0.03, location=(0, 0, 0), vertices=160); cut = bpy.context.object; cut.hide_render = True; cut.hide_viewport = True
bo = kerb.modifiers.new("recess", "BOOLEAN"); bo.object = cut; bo.operation = "DIFFERENCE"; kerb.modifiers.move(1, 0)

# dark lead/mortar ring the disc is caulked into
mm_, mnt, mp = node_mat("caulk"); mp.inputs["Base Color"].default_value = (0.06, 0.06, 0.065, 1); mp.inputs["Roughness"].default_value = 0.9
bpy.ops.mesh.primitive_cylinder_add(radius=43.8 * MM, depth=6 * MM, location=(0, 0, -3.4 * MM), vertices=160); ring = bpy.context.object; ring.data.materials.append(mm_)

# ---- the brass disc: a low dome, engraved, its polish worn bright on the face and dull in the cuts
bm = bmesh.new(); seg = 192; rings = []
prof = [(0.0, 1.6)] + [(r, 1.6 * (1 - (r / 41) ** 2) + 0.2) for r in (8, 16, 24, 32, 38, 40.5)] + [(41.5, 0.0), (41.5, -4.0), (0.0, -4.0)]
for r, z in prof:
    if r < 1e-6: rings.append([bm.verts.new((0, 0, z * MM))])
    else: rings.append([bm.verts.new((r * MM * math.cos(2 * math.pi * k / seg), r * MM * math.sin(2 * math.pi * k / seg), z * MM)) for k in range(seg)])
for A, B in zip(rings[:-1], rings[1:]):
    for k in range(seg):
        if len(A) == 1: bm.faces.new((A[0], B[k], B[(k + 1) % seg]))
        elif len(B) == 1: bm.faces.new((A[k], A[(k + 1) % seg], B[0]))
        else: bm.faces.new((A[k], A[(k + 1) % seg], B[(k + 1) % seg], B[k]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
uv = bm.loops.layers.uv.new("UV")
for f in bm.faces:
    for lo in f.loops:
        v = lo.vert.co; lo[uv].uv = (0.5 + v.x / (2 * 41 * MM), 0.5 + v.y / (2 * 41 * MM))
me = bpy.data.meshes.new("disc"); bm.to_mesh(me); bm.free()
for p in me.polygons: p.use_smooth = True
disc = bpy.data.objects.new("disc", me); sc.collection.objects.link(disc)
disc.location.z = 1.2 * MM; disc.rotation_euler.z = math.radians(float(env("DISCROT", 0)))

bm_, bnt, bp = node_mat("brass")
img = bpy.data.images.load(os.path.join(TEX, "disc_height.png")); img.colorspace_settings.name = "Non-Color"
tx = bnt.nodes.new("ShaderNodeTexImage"); tx.image = img; tx.interpolation = "Cubic"
bb = bnt.nodes.new("ShaderNodeBump"); bb.inputs["Strength"].default_value = 1.0; bb.inputs["Distance"].default_value = 0.0012
bnt.links.new(tx.outputs["Color"], bb.inputs["Height"])
# fine wear scratches on top of the engraving
ns = bnt.nodes.new("ShaderNodeTexNoise"); ns.inputs["Scale"].default_value = 2600; ns.inputs["Detail"].default_value = 4
ns2 = bnt.nodes.new("ShaderNodeBump"); ns2.inputs["Strength"].default_value = 0.08
bnt.links.new(ns.outputs["Fac"], ns2.inputs["Height"]); bnt.links.new(ns2.outputs["Normal"], bb.inputs["Normal"])
bnt.links.new(bb.outputs["Normal"], bp.inputs["Normal"])
# polished face vs tarnished cuts and edge
col = bnt.nodes.new("ShaderNodeMix"); col.data_type = "RGBA"
col.inputs[6].default_value = (0.20, 0.12, 0.05, 1); col.inputs[7].default_value = (0.95, 0.72, 0.38, 1)
pat = bnt.nodes.new("ShaderNodeTexNoise"); pat.inputs["Scale"].default_value = 45; pat.inputs["Detail"].default_value = 6
pr = bnt.nodes.new("ShaderNodeValToRGB"); pr.color_ramp.elements[0].position = 0.35; pr.color_ramp.elements[1].position = 0.7
mul = bnt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
bnt.links.new(pat.outputs["Fac"], pr.inputs["Fac"]); bnt.links.new(tx.outputs["Color"], mul.inputs[0]); bnt.links.new(pr.outputs["Color"], mul.inputs[1])
pw = bnt.nodes.new("ShaderNodeMath"); pw.operation = "MULTIPLY_ADD"; pw.inputs[1].default_value = 0.5; pw.inputs[2].default_value = 0.5
bnt.links.new(mul.outputs[0], pw.inputs[0])
bnt.links.new(tx.outputs["Color"], col.inputs["Factor"]); bnt.links.new(col.outputs[2], bp.inputs["Base Color"])
rough = bnt.nodes.new("ShaderNodeMapRange"); rough.inputs["To Min"].default_value = 0.62; rough.inputs["To Max"].default_value = 0.2
bnt.links.new(pw.outputs[0], rough.inputs["Value"]); bnt.links.new(rough.outputs["Result"], bp.inputs["Roughness"])
bp.inputs["Metallic"].default_value = 1.0
disc.data.materials.append(bm_)

# the road below the kerb: dark, fine asphalt
am, ant, ap = node_mat("asphalt")
an = ant.nodes.new("ShaderNodeTexVoronoi"); an.inputs["Scale"].default_value = 700
ar = ant.nodes.new("ShaderNodeValToRGB"); ar.color_ramp.elements[0].color = (0.02, 0.02, 0.022, 1); ar.color_ramp.elements[1].color = (0.12, 0.115, 0.11, 1)
ant.links.new(an.outputs["Distance"], ar.inputs["Fac"]); ant.links.new(ar.outputs["Color"], ap.inputs["Base Color"]); ap.inputs["Roughness"].default_value = 0.85
ab = ant.nodes.new("ShaderNodeBump"); ab.inputs["Strength"].default_value = 0.6; ant.links.new(an.outputs["Distance"], ab.inputs["Height"]); ant.links.new(ab.outputs["Normal"], ap.inputs["Normal"])
bpy.ops.mesh.primitive_plane_add(size=2, location=(0, -0.6, -0.12)); road = bpy.context.object; road.data.materials.append(am)

# ---- grit: a few grains of sand and small stone chips on the kerb
grain_m, _, gpp = node_mat("grit"); gpp.inputs["Base Color"].default_value = (0.36, 0.33, 0.29, 1); gpp.inputs["Roughness"].default_value = 0.9
rnd = random.Random(4)
for i in range(140):
    r = rnd.uniform(52, 190) * MM; t = rnd.uniform(0, 2 * math.pi)
    x, y = r * math.cos(t) * 1.6, r * math.sin(t)
    if y < -0.075 or y > 0.2 or abs(x - 0.074) < 0.004: continue
    s = rnd.uniform(0.4, 1.6) * MM
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=s, location=(x, y, s * 0.4)); g = bpy.context.object
    g.scale = (rnd.uniform(0.7, 1.3), rnd.uniform(0.7, 1.3), rnd.uniform(0.4, 0.8)); g.rotation_euler = Euler([rnd.uniform(0, 6.3) for _ in range(3)])
    g.data.materials.append(grain_m)

# ---- light: low warm sun from the left, clear cool sky
bpy.ops.object.light_add(type="SUN"); sun = bpy.context.object
sun.data.energy = float(env("SUN", 7.0)); sun.data.angle = math.radians(0.9); sun.data.color = (1.0, 0.86, 0.68)
sun.rotation_mode = "QUATERNION"; sun.rotation_quaternion = (-vec("SUNDIR", "-0.7,0.6,0.32")).normalized().to_track_quat("-Z", "Y")
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.66, 0.9, 1); w.node_tree.nodes["Background"].inputs[1].default_value = float(env("SKY", 0.28))

cd = bpy.data.cameras.new("c"); cd.lens = float(env("LENS", 85)); cd.clip_start = 0.01
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = vec("CAM", "0.0,-0.36,0.26")
ct = bpy.data.objects.new("ct", None); sc.collection.objects.link(ct); ct.location = vec("TGT", "0.0,0.025,-0.01")
tr = cam.constraints.new("TRACK_TO"); tr.target = ct; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
cd.dof.use_dof = True; cd.dof.focus_distance = (cam.location - Vector((0, 0, 0.002))).length; cd.dof.aperture_fstop = float(env("FSTOP", 4.0))

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.max_bounces = 8; cy.sample_clamp_indirect = 20
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = float(env("EXPO", 0.0))
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
