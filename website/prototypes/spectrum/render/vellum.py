# Docs cover, "Evidence you can trace": a printed page of docs/quickstart.md on a drafting mat, with a
# sheet of vellum laid over it on which someone has traced the page's structure in pencil (title,
# code, section, table) and numbered it in the margin. The site is that tracing: a map laid over the
# repository's own documents, never a replacement for them. Textures from vellum_tex.py.
# usage: python vellum.py TEX_DIR OUT.png [W H SPP]
# tuning (env): EXPO FSTOP KEY KEYPOS KEYS FILL SKY CAM TGT LENS FOCUS CURL VEIL
import math, sys, os
import bpy, bmesh, addon_utils
from mathutils import Vector

a = sys.argv[1:]; TEX = os.path.abspath(a[0]); OUT = os.path.abspath(a[1])
W = int(a[2]) if len(a) > 2 else 1600; H = int(a[3]) if len(a) > 3 else 560; SPP = int(a[4]) if len(a) > 4 else 192
env = lambda k, d: os.environ.get(k, d)
vec = lambda k, d: Vector([float(v) for v in env(k, d).split(",")])
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene; MM = 0.001

def image_node(m, file, extension="REPEAT"):
    n = m.node_tree.nodes.new("ShaderNodeTexImage"); n.image = bpy.data.images.load(os.path.join(TEX, file)); n.extension = extension
    return n

def principled(name, col=(1, 1, 1), rough=0.5, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]; p.inputs["Base Color"].default_value = (*col, 1); p.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): p.inputs[k].default_value = v
    return m, p

def grid(name, x0, x1, y0, y1, nx, ny, z=lambda x, y: 0.0, uv=None):
    """a subdivided sheet in mm; uv(x, y) gives texture coordinates"""
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new()
    vs = [[bm.verts.new(((x0 + (x1 - x0) * i / nx) * MM, (y0 + (y1 - y0) * j / ny) * MM, z(x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny) * MM)) for j in range(ny + 1)] for i in range(nx + 1)]
    for i in range(nx):
        for j in range(ny):
            f = bm.faces.new((vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1]))
            for l in f.loops:
                x, y = l.vert.co.x / MM, l.vert.co.y / MM
                l[uvl].uv = uv(x, y) if uv else ((x - x0) / (x1 - x0), (y - y0) / (y1 - y0))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); return o

PW, PH = 210, 297
page_uv = lambda x, y: ((x + PW / 2) / PW, (y + PH / 2) / PH)

# ---- the mat
mm, mp = principled("drafting mat", rough=0.8)
t = image_node(mm, "mat.png"); mm.node_tree.links.new(t.outputs[0], mp.inputs["Base Color"])
grid("mat", -350, 350, -350, 350, 1, 1).data.materials.append(mm)

# ---- the printed page (a hair above the mat)
pgm, pgp = principled("paper", rough=0.85)
t = image_node(pgm, "page.png", "CLIP"); pgm.node_tree.links.new(t.outputs[0], pgp.inputs["Base Color"])
pg = grid("page", -PW / 2, PW / 2, -PH / 2, PH / 2, 1, 1, z=lambda x, y: 0.15, uv=page_uv); pg.data.materials.append(pgm)

# ---- the vellum: frosted, see-through where it lies on the page, its near-left corner lifting
CURL = float(env("CURL", 9.0)); VEIL = float(env("VEIL", 0.5))
vx0, vx1, vy0, vy1 = -62, 118, -162, 140
def lift(x, y):
    u = max(0.0, 1 - (x - vx0) / 45) * (0.55 + 0.45 * (y - vy0) / (vy1 - vy0))  # the left edge lifts, more toward the top
    return 0.45 + CURL * u ** 2.2
vm = bpy.data.materials.new("vellum"); vm.use_nodes = True; nt = vm.node_tree; N = nt.nodes; Lk = nt.links
out = N["Material Output"]; N.remove(N["Principled BSDF"])
diff = N.new("ShaderNodeBsdfPrincipled"); diff.inputs["Base Color"].default_value = (0.93, 0.95, 0.97, 1); diff.inputs["Roughness"].default_value = 0.42
diff.inputs["Subsurface Weight"].default_value = 0.0
trn = N.new("ShaderNodeBsdfTranslucent"); trn.inputs["Color"].default_value = (0.9, 0.93, 0.96, 1)
see = N.new("ShaderNodeBsdfTransparent"); see.inputs["Color"].default_value = (0.97, 0.98, 1.0, 1)
m1 = N.new("ShaderNodeMixShader"); m1.inputs[0].default_value = 0.35; Lk.new(diff.outputs[0], m1.inputs[1]); Lk.new(trn.outputs[0], m1.inputs[2])
m2 = N.new("ShaderNodeMixShader"); m2.inputs[0].default_value = VEIL; Lk.new(m1.outputs[0], m2.inputs[1]); Lk.new(see.outputs[0], m2.inputs[2])
# graphite on top
tt = image_node(vm, "trace.png", "CLIP")
gra = N.new("ShaderNodeBsdfPrincipled"); gra.inputs["Base Color"].default_value = (0.05, 0.055, 0.065, 1); gra.inputs["Roughness"].default_value = 0.38; gra.inputs["Metallic"].default_value = 0.35
m3 = N.new("ShaderNodeMixShader"); Lk.new(tt.outputs["Alpha"], m3.inputs[0]); Lk.new(m2.outputs[0], m3.inputs[1]); Lk.new(gra.outputs[0], m3.inputs[2])
Lk.new(m3.outputs[0], out.inputs[0])
vel = grid("vellum", vx0, vx1, vy0, vy1, 70, 100, z=lift, uv=page_uv); vel.data.materials.append(vm)
sol = vel.modifiers.new("t", "SOLIDIFY"); sol.thickness = 0.08 * MM

# ---- a pencil, its body in the section's glass slate
def hexprism(name, length, flats, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=flats / 2 / math.cos(math.pi / 6) * MM, depth=length * MM); o = bpy.context.object; o.name = name
    bv = o.modifiers.new("b", "BEVEL"); bv.width = 0.35 * MM; bv.segments = 2; o.data.materials.append(mat)
    for p in o.data.polygons: p.use_smooth = False
    return o
body_m, _ = principled("lacquer", (0.06, 0.16, 0.2), 0.28, **{"Coat Weight": 0.6})
wood_m, _ = principled("cedar", (0.62, 0.45, 0.3), 0.7)
lead_m, _ = principled("graphite", (0.04, 0.04, 0.045), 0.32, **{"Metallic": 0.6})
pencil = bpy.data.objects.new("pencil", None); sc.collection.objects.link(pencil)
b = hexprism("body", 150, 7.0, body_m); b.parent = pencil
bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=3.6 * MM, radius2=0.9 * MM, depth=17 * MM, location=(0, 0, (75 + 8.5) * MM)); c = bpy.context.object; c.data.materials.append(wood_m); c.parent = pencil
bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=0.9 * MM, radius2=0.12 * MM, depth=3.2 * MM, location=(0, 0, (75 + 17 + 1.6) * MM)); g = bpy.context.object; g.data.materials.append(lead_m); g.parent = pencil
for o in (c, g):
    for p in o.data.polygons: p.use_smooth = True
pencil.location = vec("PENCIL", "0.07,-0.115,0.0042"); pencil.rotation_euler = (0, math.radians(90), math.radians(float(env("PENROT", 152))))

# ---- light: a big soft window to the upper left, a low fill from the right
bpy.ops.object.light_add(type="AREA", location=tuple(vec("KEYPOS", "-0.55,0.35,0.55"))); key = bpy.context.object
key.data.shape = "DISK"; key.data.size = float(env("KEYS", 0.5)); key.data.energy = float(env("KEY", 40)); key.data.color = (1.0, 0.98, 0.95)
key.rotation_mode = "QUATERNION"; key.rotation_quaternion = (Vector((0, 0, 0)) - key.location).to_track_quat("-Z", "Y")
bpy.ops.object.light_add(type="AREA", location=(0.6, -0.3, 0.25)); fill = bpy.context.object
fill.data.size = 0.8; fill.data.energy = float(env("FILL", 8)); fill.data.color = (0.9, 0.93, 1.0)
fill.rotation_mode = "QUATERNION"; fill.rotation_quaternion = (Vector((0, 0, 0)) - fill.location).to_track_quat("-Z", "Y")
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.8, 0.84, 0.92, 1); w.node_tree.nodes["Background"].inputs[1].default_value = float(env("SKY", 0.35))

cd = bpy.data.cameras.new("c"); cd.lens = float(env("LENS", 50)); cd.clip_start = 0.01
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = vec("CAM", "0.03,-0.40,0.25")
ct = bpy.data.objects.new("ct", None); sc.collection.objects.link(ct); ct.location = vec("TGT", "0.01,-0.01,0.0")
tr = cam.constraints.new("TRACK_TO"); tr.target = ct; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
cd.dof.use_dof = True; cd.dof.focus_distance = (cam.location - vec("FOCUS", "0.01,-0.03,0.0")).length; cd.dof.aperture_fstop = float(env("FSTOP", 4))

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.max_bounces = 12; cy.transparent_max_bounces = 16; cy.sample_clamp_indirect = 20
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = float(env("EXPO", 0.0))
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
