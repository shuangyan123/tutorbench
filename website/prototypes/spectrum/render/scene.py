# Teachometry cover: a real three-mirror kaleidoscope, rendered in Cycles.
# usage: python scene.py SEQ FRAME OUT.png [W H SAMPLES]
#   SEQ = L (loop: camera at the eyepiece, cell turning) or P (pull-out to the desk)
import bpy, bmesh, math, random, sys, os, addon_utils
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, "tex")
args = sys.argv[1:]
SEQ, FRAME, OUT = args[0], int(args[1]), args[2]
W = int(args[3]) if len(args) > 3 else 960
H = int(args[4]) if len(args) > 4 else 600
SPP = int(args[5]) if len(args) > 5 else 64
NL, NP = 30, 48  # frames per sequence

bpy.ops.wm.read_factory_settings(use_empty=True)
addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene
random.seed(11)

R, L = 0.32, 3.0          # tube radius, length (axis along +Y, eyepiece at y=0)
AX = Vector((0, 0, R))    # axis point at the eyepiece

# ------------------------------------------------------------------ materials
def principled(name, base=(1, 1, 1), rough=0.5, metal=0.0, trans=0.0, ior=1.45, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*base, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Transmission Weight"].default_value = trans
    b.inputs["IOR"].default_value = ior
    b.inputs["Coat Weight"].default_value = coat
    return m

def img(path, non_color=False):
    i = bpy.data.images.load(path)
    if non_color: i.colorspace_settings.name = "Non-Color"
    return i

def paper_mat(name, path, glow=0.72):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; Lk = nt.links
    N.clear()
    out = N.new("ShaderNodeOutputMaterial")
    t = N.new("ShaderNodeTexImage"); t.image = img(path)
    dif = N.new("ShaderNodeBsdfDiffuse"); tr = N.new("ShaderNodeBsdfTranslucent")
    mix = N.new("ShaderNodeMixShader"); mix.inputs[0].default_value = glow
    tp = N.new("ShaderNodeBsdfTransparent"); mx2 = N.new("ShaderNodeMixShader")
    Lk.new(t.outputs["Color"], dif.inputs["Color"]); Lk.new(t.outputs["Color"], tr.inputs["Color"])
    Lk.new(dif.outputs[0], mix.inputs[1]); Lk.new(tr.outputs[0], mix.inputs[2])
    Lk.new(t.outputs["Alpha"], mx2.inputs[0]); Lk.new(tp.outputs[0], mx2.inputs[1]); Lk.new(mix.outputs[0], mx2.inputs[2])
    Lk.new(mx2.outputs[0], out.inputs[0])
    m.blend_method = "HASHED" if hasattr(m, "blend_method") else None
    return m

def look(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

def shade_smooth(o):
    for p in o.data.polygons: p.use_smooth = True

lacquer = principled("frosted", (0.93, 0.95, 1.0), 0.32, trans=1.0, ior=1.49)
alu = principled("chrome", (0.93, 0.94, 0.96), 0.07, metal=1.0)
mirror = principled("mirror", (0.9, 0.9, 0.93), 0.01, metal=1.0)
black = principled("black", (0.02, 0.02, 0.025), 0.45)

# eyepiece cap: aluminium with an engraved ring (texture drives colour + roughness)
cap = principled("cap", (0.95, 0.95, 0.97), 0.12, metal=1.0)
nt = cap.node_tree; bsdf = nt.nodes["Principled BSDF"]
t = nt.nodes.new("ShaderNodeTexImage"); t.image = img(os.path.join(TEX, "capring.png"), True)
mc = nt.nodes.new("ShaderNodeMix"); mc.data_type = "RGBA"
mc.inputs["A"].default_value = (0.9, 0.91, 0.92, 1); mc.inputs["B"].default_value = (0.08, 0.085, 0.1, 1)
nt.links.new(t.outputs["Color"], mc.inputs["Factor"]); nt.links.new(mc.outputs["Result"], bsdf.inputs["Base Color"])
mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["To Min"].default_value = 0.12; mr.inputs["To Max"].default_value = 0.6
nt.links.new(t.outputs["Color"], mr.inputs["Value"]); nt.links.new(mr.outputs["Result"], bsdf.inputs["Roughness"])
mm = nt.nodes.new("ShaderNodeMapRange"); mm.inputs["To Min"].default_value = 1.0; mm.inputs["To Max"].default_value = 0.2
nt.links.new(t.outputs["Color"], mm.inputs["Value"]); nt.links.new(mm.outputs["Result"], bsdf.inputs["Metallic"])

# ------------------------------------------------------------------ the tube
def cyl(name, r, depth, y, verts=128, fill="NGON", mat=None, z=R):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, end_fill_type=fill,
                                        location=(0, y, z), rotation=(math.radians(90), 0, 0))
    o = bpy.context.object; o.name = name
    if mat: o.data.materials.append(mat)
    return o

body = cyl("body", R, L - 0.04, L / 2 + 0.02, fill="NOTHING", mat=lacquer)
sol = body.modifiers.new("s", "SOLIDIFY"); sol.thickness = 0.022; sol.offset = -1
shade_smooth(body)
for y in (0.1, L - 0.16):
    ring = cyl("ring", R + 0.006, 0.07, y, fill="NOTHING", mat=alu); shade_smooth(ring)

RC, RH, CT = R + 0.012, 0.085, 0.05   # cap radius, eyepiece hole, thickness
bm = bmesh.new(); NV = 128
def ring_v(r, y): return [bm.verts.new((r * math.cos(2 * math.pi * i / NV), y, R + r * math.sin(2 * math.pi * i / NV))) for i in range(NV)]
of, inf, ob, ib = ring_v(RC, -CT + 0.005), ring_v(RH, -CT + 0.005), ring_v(RC, 0.005), ring_v(RH, 0.005)
for i in range(NV):
    j = (i + 1) % NV
    bm.faces.new((of[i], of[j], inf[j], inf[i]))      # front face (towards the viewer, -Y)
    bm.faces.new((ob[i], ib[i], ib[j], ob[j]))        # back face
    bm.faces.new((of[i], ob[i], ob[j], of[j]))        # outer rim
    bm.faces.new((inf[i], inf[j], ib[j], ib[i]))      # hole wall
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
uvl = bm.loops.layers.uv.new("UV")
for f in bm.faces:
    for lp in f.loops:
        v = lp.vert.co; lp[uvl].uv = (v.x / (2 * RC) + 0.5, (v.z - R) / (2 * RC) + 0.5)
me = bpy.data.meshes.new("cap"); bm.to_mesh(me); bm.free()
capo = bpy.data.objects.new("cap", me); sc.collection.objects.link(capo); capo.data.materials.append(cap)
for p_ in capo.data.polygons: p_.use_smooth = False
# a thin black throat behind the eyepiece hole
throat = cyl("throat", 0.087, 0.05, 0.02, fill="NOTHING", mat=black)

# three mirrors, triangle inscribed in the tube
rt = 0.272
pts = [AX + Vector((rt * math.cos(math.radians(a)), 0, rt * math.sin(math.radians(a)))) for a in (90, 210, 330)]
bm = bmesh.new()
for i in range(3):
    a, b = pts[i], pts[(i + 1) % 3]
    vs = [bm.verts.new(a + Vector((0, 0.03, 0))), bm.verts.new(b + Vector((0, 0.03, 0))),
          bm.verts.new(b + Vector((0, L - 0.13, 0))), bm.verts.new(a + Vector((0, L - 0.13, 0)))]
    bm.faces.new(vs)
mm_ = bpy.data.meshes.new("mirrors"); bm.to_mesh(mm_); bm.free()
mir = bpy.data.objects.new("mirrors", mm_); sc.collection.objects.link(mir); mir.data.materials.append(mirror)

# ------------------------------------------------------------------ object cell
cellY = L - 0.075
frost = bpy.data.materials.new("frost"); frost.use_nodes = True
fn = frost.node_tree.nodes; fn.clear()
o_ = fn.new("ShaderNodeOutputMaterial"); tr_ = fn.new("ShaderNodeBsdfTranslucent"); df_ = fn.new("ShaderNodeBsdfDiffuse")
mx_ = fn.new("ShaderNodeMixShader"); mx_.inputs[0].default_value = 0.25
tr_.inputs["Color"].default_value = (0.8, 0.85, 1.0, 1); df_.inputs["Color"].default_value = (0.95, 0.95, 0.97, 1)
frost.node_tree.links.new(tr_.outputs[0], mx_.inputs[1]); frost.node_tree.links.new(df_.outputs[0], mx_.inputs[2])
frost.node_tree.links.new(mx_.outputs[0], o_.inputs[0])
cyl("frost", R - 0.02, 0.008, L - 0.02, mat=frost)

cell = bpy.data.objects.new("cell", None); sc.collection.objects.link(cell)
cell.location = (0, cellY, R)

GLASS = [  # the five dimensions, as glass
    (1.0, 0.16, 0.07), (1.0, 0.55, 0.02), (0.03, 0.62, 0.25), (0.05, 0.2, 1.0), (0.33, 0.08, 1.0),
]
def glass(i, rough=0.03):
    c = GLASS[i] if i < 5 else (0.95, 0.97, 1.0)
    return principled(f"glass{i}_{rough}", c, rough, trans=1.0, ior=1.52)
glasses = [glass(i) for i in range(6)] + [glass(3, 0.3), glass(4, 0.3), glass(1, 0.3)]

def shard(mat, size, pos, rot):
    n = random.randint(4, 7); bm = bmesh.new(); vs = []
    ang = sorted(random.uniform(0, 2 * math.pi) for _ in range(n))
    sx, sz = size * random.uniform(0.5, 1.0), size * random.uniform(0.35, 1.0)
    for a in ang: vs.append(bm.verts.new((sx * math.cos(a), 0, sz * math.sin(a))))
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    bmesh.ops.translate(bm, vec=(0, random.uniform(0.008, 0.016), 0),
                        verts=[v for v in ext["geom"] if isinstance(v, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("shard"); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("shard", me); sc.collection.objects.link(o); o.data.materials.append(mat)
    o.parent = cell; o.location = pos; o.rotation_euler = rot
    bv = o.modifiers.new("bv", "BEVEL"); bv.width = 0.0025; bv.segments = 2
    return o

def in_cell(rmax):
    while True:
        x, z = random.uniform(-rmax, rmax), random.uniform(-rmax, rmax)
        if x * x + z * z < rmax * rmax: return x, z

for i in range(44):
    x, z = in_cell(0.25)
    shard(glasses[i % len(glasses)], random.uniform(0.05, 0.13),
          (x, random.uniform(-0.05, 0.035), z),
          (random.uniform(-0.35, 0.35), random.uniform(0, 6.28), random.uniform(-0.35, 0.35)))
for i in range(16):  # beads
    x, z = in_cell(0.24)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=random.uniform(0.01, 0.022), location=(0, 0, 0), segments=24, ring_count=12)
    o = bpy.context.object; shade_smooth(o); o.data.materials.append(glasses[random.randrange(6)])
    o.parent = cell; o.location = (x, random.uniform(-0.04, 0.03), z)

for i in range(6):
    x, z = in_cell(0.22)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=random.uniform(0.006, 0.01), depth=random.uniform(0.08, 0.16))
    o = bpy.context.object; shade_smooth(o); o.data.materials.append(glasses[5])
    o.parent = cell; o.location = (x, random.uniform(-0.04, 0.02), z); o.rotation_euler = (random.uniform(0, 3.14), 0, random.uniform(0, 3.14))
for name, sz, pos, rz in [("scrap27", 0.15, (0.03, -0.045, 0.02), 0.25), ("scrap14", 0.11, (-0.13, -0.035, -0.1), -0.6),
                          ("scrap13", 0.11, (0.12, -0.03, -0.12), 1.1)]:
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0), rotation=(math.radians(90), 0, 0))
    o = bpy.context.object; o.scale = (sz, sz * 0.7, 1)
    o.data.materials.append(paper_mat(name, os.path.join(TEX, name + ".png")))
    o.parent = cell; o.location = pos; o.rotation_euler = (math.radians(90), rz, 0)
    # plane faces -Y after the 90° turn; flip UV so writing reads from the eyepiece
    for d in o.data.uv_layers[0].data: d.uv = (1 - d.uv[0], d.uv[1])

# ------------------------------------------------------------------ desk, notebook, pencil
desk = principled("cyc", (0.47, 0.56, 0.86), 0.72)   # periwinkle seamless backdrop (#CAD6ED-ish)
bm = bmesh.new(); prof = [(-6.0, 0.0)]
for i in range(0, 41): prof.append((6.0 + 3.0 * math.sin(math.pi / 2 * i / 40), 3.0 - 3.0 * math.cos(math.pi / 2 * i / 40)))
prof.append((9.0, 12.0))
rows = [[bm.verts.new((x, y, z)) for (y, z) in prof] for x in (-14.0, 14.0)]
for i in range(len(prof) - 1): bm.faces.new((rows[0][i], rows[1][i], rows[1][i + 1], rows[0][i + 1]))
me_ = bpy.data.meshes.new("cyc"); bm.to_mesh(me_); bm.free()
cyc = bpy.data.objects.new("cyc", me_); sc.collection.objects.link(cyc); cyc.data.materials.append(desk)
for p_ in cyc.data.polygons: p_.use_smooth = True
bpy.ops.mesh.primitive_cube_add(size=1, location=(1.4, 0.95, 0.024)); nb = bpy.context.object
nb.scale = (1.7, 1.15, 0.048); nb.rotation_euler = (0, 0, math.radians(18))
nb.data.materials.append(principled("pages", (0.93, 0.93, 0.92), 0.8))
bpy.ops.mesh.primitive_plane_add(size=1, location=(1.4, 0.95, 0.0485)); pg = bpy.context.object
pg.scale = (1.68, 1.13, 1); pg.rotation_euler = (0, 0, math.radians(18))
pm = principled("page", (1, 1, 1), 0.85); pt = pm.node_tree.nodes.new("ShaderNodeTexImage")
pt.image = img(os.path.join(TEX, "notebook.png"))
pm.node_tree.links.new(pt.outputs["Color"], pm.node_tree.nodes["Principled BSDF"].inputs["Base Color"])
pg.data.materials.append(pm)
bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.034, depth=1.15, location=(1.2, -0.2, 0.034),
                                    rotation=(0, math.radians(90), math.radians(-28)))
pc = bpy.context.object; pc.scale = (1.3, 1.3, 1); pc.data.materials.append(principled("pencil", (0.2, 0.26, 0.92), 0.3, coat=0.8))

# ------------------------------------------------------------------ light
bpy.ops.object.light_add(type="AREA", location=(0, L + 0.45, R))
bl = bpy.context.object; bl.data.size = 0.9; bl.data.energy = float(os.environ.get("BACK", 14)); bl.data.color = (1.0, 0.98, 0.95)
look(bl, (0, L, R)); bl.visible_camera = False

bpy.ops.object.light_add(type="SUN", location=(0, 0, 5))
sun = bpy.context.object; sun.data.energy = 4.5; sun.data.angle = math.radians(3); sun.data.color = (1.0, 0.97, 0.92)
sun.rotation_euler = Vector((0.5, -0.72, -0.48)).normalized().to_track_quat("-Z", "Y").to_euler()

bpy.ops.object.light_add(type="AREA", location=(-3.2, 3.5, 3.0))
pk = bpy.context.object; pk.data.size = 4.0; pk.data.energy = 900; pk.data.color = (1.0, 0.72, 0.7)
look(pk, (0, 1.4, 0.3)); pk.visible_camera = False
for nm, loc, size, en, tgt in [("strip_top", (0.2, 1.2, 2.6), (4.0, 0.35), 160, (0, 1.4, 0.3)),
                                ("strip_right", (2.6, -0.6, 1.2), (0.4, 2.4), 160, (0, 1.0, 0.3)),
                                ("rim", (1.2, 4.6, 1.4), (2.0, 1.0), 220, (0, 1.6, 0.3))]:
    bpy.ops.object.light_add(type="AREA", location=loc); o = bpy.context.object
    o.data.shape = "RECTANGLE"; o.data.size, o.data.size_y = size; o.data.energy = en; o.data.color = (0.98, 0.98, 1.0)
    look(o, tgt); o.visible_camera = False
world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.62, 0.68, 0.86, 1); bg.inputs[1].default_value = 0.8

# ------------------------------------------------------------------ camera
cam_d = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam_d.sensor_width = 36; cam_d.clip_start = 0.002
aim = bpy.data.objects.new("aim", None); sc.collection.objects.link(aim)
tc = cam.constraints.new("TRACK_TO"); tc.target = aim; tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"

def ease(t): return t * t * (3 - 2 * t)
def lerp(a, b, t): return a + (b - a) * t
def path(keys, t):
    for i in range(len(keys) - 1):
        t0, v0 = keys[i]; t1, v1 = keys[i + 1]
        if t <= t1: return lerp(v0, v1, ease((t - t0) / (t1 - t0)))
    return keys[-1][1]

def V(*a): return Vector(a)
if SEQ == "L":
    t = FRAME / NL
    cam.location = V(0, -0.004, R); aim.location = V(0, 1, R); cam_d.lens = float(os.environ.get("LENS", 60))
    cell.rotation_euler = (0, math.radians(36) * t, 0)
else:
    t = FRAME / (NP - 1)
    cam.location = path([(0, V(0, -0.004, R)), (0.38, V(0, -1.75, R)), (0.68, V(-1.0, -2.7, 0.95)), (1, V(-1.75, -2.35, 2.35))], t)
    aim.location = path([(0, V(0, 1, R)), (0.38, V(0, 1, R)), (1, V(0.45, 0.85, 0.15))], t)
    cam_d.lens = path([(0, 60.0), (0.38, 50.0), (1, 38.0)], t)
    cell.rotation_euler = (0, math.radians(-30) * t, 0)

# ------------------------------------------------------------------ render
sc.render.engine = "CYCLES"; cy = sc.cycles
cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = os.environ.get("NODN") is None
cy.max_bounces = 18; cy.glossy_bounces = 14; cy.transmission_bounces = 10; cy.diffuse_bounces = 2; cy.transparent_max_bounces = 8
cy.use_adaptive_sampling = True; cy.adaptive_threshold = 0.03
cy.caustics_reflective = False; cy.caustics_refractive = False; cy.blur_glossy = 0.0
sc.render.resolution_x = W; sc.render.resolution_y = H; sc.render.resolution_percentage = 100
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = float(os.environ.get("EXPO", -0.35))
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
