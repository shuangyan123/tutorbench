# Teachometry cover study: a two-mirror kaleidoscope seen from the eyepiece.
# Two front-surface mirrors meet at ANGLE degrees along the tube axis (36 = five-fold rosette,
# 30 = six-fold). The object chamber holds curated pieces: cathedral glass, dichroic glass,
# millefiori slices, twisted cane, beads and cut crystals, backlit through opal glass.
# usage: python mandala.py OUT.png [SIZE SAMPLES]   env: ANGLE, SEED, PAL (five|cool|warm), TURN (deg)
import bpy, bmesh, math, random, sys, os, addon_utils
from mathutils import Vector

args = sys.argv[1:]
OUT = os.path.abspath(args[0])
SIZE = int(args[1]) if len(args) > 1 else 1200
SPP = int(args[2]) if len(args) > 2 else 64
ANGLE = float(os.environ.get("ANGLE", 36))
SEED = int(os.environ.get("SEED", 1))
PAL = os.environ.get("PAL", "five")
MIX = os.environ.get("MIX", "light")         # light: mostly pale tints with a few saturated accents; bold: saturated
TURN = float(os.environ.get("TURN", 0))
SWEEP = float(os.environ.get("SWEEP", 0))     # degrees the chamber will turn over a sequence (fills that arc)       # turning the object chamber: the only motion a scroll would drive

bpy.ops.wm.read_factory_settings(use_empty=True)
addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene
random.seed(SEED)

MW, LM = 0.12, 1.0          # mirror width (= radius of the image circle), mirror length
TH = math.radians(ANGLE)

# ------------------------------------------------------------------ materials
def bsdf(name, base=(1, 1, 1), rough=0.0, metal=0.0, trans=0.0, ior=1.52, film=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*base, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Transmission Weight"].default_value = trans
    b.inputs["IOR"].default_value = ior
    if film:
        b.inputs["Thin Film Thickness"].default_value = film
        b.inputs["Thin Film IOR"].default_value = 2.1
    return m

def glass(c, rough=0.0, film=0.0, name="g"):
    return bsdf(f"{name}{c}{rough}{film}", c, rough, trans=1.0, ior=1.52, film=film)

PALS = {
    # the five TutorBench colours (red, amber, green, blue, violet) + clear
    "five": [(1.0, 0.16, 0.07), (1.0, 0.55, 0.02), (0.03, 0.62, 0.25), (0.05, 0.2, 1.0), (0.33, 0.08, 1.0)],
    # the site's own light: periwinkle, violet, rose, peach, ice
    "cool": [(0.35, 0.45, 1.0), (0.45, 0.2, 1.0), (1.0, 0.35, 0.55), (1.0, 0.62, 0.42), (0.6, 0.85, 1.0)],
    # misty: the page's periwinkle, lilac, rose, pale gold and ice, most of it pale
    "mist": [(0.55, 0.62, 1.0), (0.7, 0.55, 1.0), (1.0, 0.55, 0.68), (1.0, 0.82, 0.45), (0.7, 0.92, 1.0)],
    "warm": [(1.0, 0.25, 0.12), (1.0, 0.62, 0.1), (0.95, 0.2, 0.45), (0.2, 0.35, 1.0), (0.9, 0.85, 0.3)],
}
P = PALS[PAL]
sat = [glass(c, name="sat") for c in P]
tint = [glass(tuple(0.5 + 0.5 * v for v in c), name="tint") for c in P]
frosted = [glass(c, 0.16, name="sea") for c in P]
clear = glass((0.97, 0.98, 1.0), name="clear")
dichro = [glass((0.92, 0.95, 1.0), film=f, name="di") for f in (380, 520, 640)]
gold = glass((1.0, 0.62, 0.1), name="gold")
latticino = bsdf("latticino", (0.97, 0.96, 0.94), 0.35, trans=0.25)   # the opaque white thread of Venetian cane
mirror = bsdf("mirror", (0.96, 0.96, 0.97), 0.0, metal=1.0)
black = bsdf("black", (0.12, 0.12, 0.14), 0.6)   # tube lining: dark grey, so cut crystals do not go muddy

# ------------------------------------------------------------------ mirrors and tube
bm = bmesh.new()
for a in (0.0, TH):
    d = Vector((math.cos(a), 0, math.sin(a)))
    v = [bm.verts.new(Vector((0, 0, 0))), bm.verts.new(d * MW * 1.15),
         bm.verts.new(d * MW * 1.15 + Vector((0, LM, 0))), bm.verts.new(Vector((0, LM, 0)))]
    bm.faces.new(v)
me = bpy.data.meshes.new("mirrors"); bm.to_mesh(me); bm.free()
mo = bpy.data.objects.new("mirrors", me); sc.collection.objects.link(mo); mo.data.materials.append(mirror)

bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=MW * 1.2, depth=LM + 0.2, location=(0, LM / 2, 0), rotation=(math.radians(90), 0, 0), end_fill_type="NOTHING")
tube = bpy.context.object; tube.data.materials.append(black)

# ------------------------------------------------------------------ object chamber
cham = bpy.data.objects.new("chamber", None); sc.collection.objects.link(cham)
cham.location = (0, LM + 0.012, 0); cham.rotation_euler = (0, math.radians(TURN), 0)

def link(o):
    o.parent = cham
    return o

ZONE = "wedge"
def place(rmin=0.0, rmax=MW * 0.98, pad=0.15):
    # a point in the wedge (with a little overhang, so pieces cross the mirror seams),
    # or, for ZONE "out", in the arcs either side of it that a turn of SWEEP degrees brings into view
    if ZONE == "out":
        sw = math.radians(SWEEP); a = random.uniform(0, sw)
        a = -pad * TH - a if random.random() < 0.5 else (1 + pad) * TH + a
    else:
        a = random.uniform(-pad * TH, (1 + pad) * TH)
    r = math.sqrt(random.uniform((rmin / MW) ** 2, (rmax / MW) ** 2)) * MW
    return r * math.cos(a), r * math.sin(a)

def depth(): return random.uniform(0.0, 0.05)

def smooth(o):
    for p in o.data.polygons: p.use_smooth = True

def slab(mat, verts2d, th, pos, rot, bevel=0.35):
    bm = bmesh.new(); f = bm.faces.new([bm.verts.new((x, 0, z)) for x, z in verts2d])
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    bmesh.ops.translate(bm, vec=(0, th, 0), verts=[v for v in ext["geom"] if isinstance(v, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("slab"); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("slab", me); sc.collection.objects.link(o); o.data.materials.append(mat)
    bv = o.modifiers.new("bv", "BEVEL"); bv.width = th * bevel; bv.segments = 4; bv.limit_method = "ANGLE"
    smooth(o); wn = o.modifiers.new("wn", "WEIGHTED_NORMAL"); wn.keep_sharp = True
    o.location = pos; o.rotation_euler = rot
    return link(o)

def shard_shape(s):
    n = random.choice([3, 4, 4, 5, 6]); ang = sorted(random.uniform(0, 2 * math.pi) for _ in range(n))
    ex = random.uniform(0.45, 1.0)
    return [(s * math.cos(a), s * ex * math.sin(a)) for a in ang]

def petal_shape(s):   # a tear / petal: the kind of cut piece makers put in a chamber
    pts = []
    for i in range(24):
        t = 2 * math.pi * i / 24
        pts.append((s * math.sin(t) * (0.55 + 0.45 * math.cos(t)) * 0.55, s * math.cos(t)))
    return pts

def tilt(): return (random.uniform(-0.2, 0.2), random.uniform(0, 6.28), random.uniform(-0.2, 0.2))

def fill(scale=1.0):
    """Builds the chamber's pieces; scale multiplies every count (used for the extra pieces a turn needs)."""
    def n(c): return int(round(c * scale))
    # cathedral glass shards and petals
    for i in range(n(14)):
        x, z = place()
        mat = [tint, sat, frosted, tint][i % 4][random.randrange(5)] if MIX == "light" else [sat, tint, frosted][i % 3][random.randrange(5)]
        shape = petal_shape(random.uniform(0.024, 0.04)) if i % 3 == 1 else shard_shape(random.uniform(0.022, 0.042))
        slab(mat, shape, random.uniform(0.003, 0.006), (x, depth(), z), tilt())

    # dichroic glass: clear with a thin film, colour shifts with angle
    for i in range(n(4)):
        x, z = place()
        slab(dichro[i % 3], shard_shape(random.uniform(0.012, 0.022)), 0.004, (x, depth(), z), tilt())

    # millefiori slices: a star cane inside rings of colour
    def star(r_out, r_in, n=6):
        return [((r_out if k % 2 == 0 else r_in) * math.cos(math.pi * k / n), (r_out if k % 2 == 0 else r_in) * math.sin(math.pi * k / n)) for k in range(2 * n)]
    def disc(r, n=48): return [(r * math.cos(2 * math.pi * k / n), r * math.sin(2 * math.pi * k / n)) for k in range(n)]
    for i in range(n(3)):
        x, z = place(rmin=MW * 0.2); y = depth(); rot = (0, random.uniform(0, 6.28), 0); r = random.uniform(0.01, 0.015)
        cs = random.sample(range(5), 3)
        slab(tint[cs[0]], disc(r), 0.005, (x, y, z), rot, bevel=0.3)
        slab(sat[cs[1]], disc(r * 0.72), 0.0055, (x, y - 0.0003, z), rot, bevel=0.25)
        slab(clear if i % 2 else sat[cs[2]], star(r * 0.55, r * 0.25, random.choice([5, 6, 8])), 0.006, (x, y - 0.0006, z), rot, bevel=0.2)

    # twisted cane: a clear rod with a coloured thread wound inside
    for i in range(n(2)):
        x, z = place(rmin=MW * 0.15); y = depth(); ln = random.uniform(0.05, 0.08); rr = random.uniform(0.0035, 0.005)
        rot = (random.uniform(-0.15, 0.15), random.uniform(0, 3.14), 0)
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=rr, depth=ln, location=(0, 0, 0))
        rod = bpy.context.object; smooth(rod); rod.data.materials.append(clear); rod.location = (x, y, z); rod.rotation_euler = rot; link(rod)
        cu = bpy.data.curves.new("thread", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = rr * 0.28; cu.bevel_resolution = 3
        sp = cu.splines.new("POLY"); N = 160; sp.points.add(N - 1)
        turns = random.uniform(5, 8)
        for k in range(N):
            t = k / (N - 1); a = 2 * math.pi * turns * t
            sp.points[k].co = (rr * 0.55 * math.cos(a), rr * 0.55 * math.sin(a), (t - 0.5) * ln * 0.96, 1)
        th = bpy.data.objects.new("thread", cu); sc.collection.objects.link(th); th.data.materials.append(random.choice([gold, latticino]))
        th.location = (x, y, z); th.rotation_euler = rot; link(th)
        # canes trap the dark tube lining by internal reflection and read as black ladders: off by default
        # (still built, so the random sequence and every other piece's place stay the same)
        if os.environ.get("CANES", "0") != "1": rod.hide_render = th.hide_render = True

    # beads and cut crystals
    for i in range(n(7)):
        x, z = place()
        bpy.ops.mesh.primitive_uv_sphere_add(radius=random.uniform(0.004, 0.008), segments=48, ring_count=24, location=(0, 0, 0))
        o = bpy.context.object; smooth(o); o.data.materials.append([clear, sat[i % 5], tint[i % 5]][i % 3]); o.location = (x, depth(), z); link(o)
    for i in range(n(4)):
        x, z = place()
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=random.uniform(0.006, 0.01), location=(0, 0, 0))
        o = bpy.context.object; o.scale = (1, 0.7, 1); o.data.materials.append(clear if i % 2 else dichro[1]); o.location = (x, depth(), z)
        o.rotation_euler = tuple(random.uniform(0, 6.28) for _ in range(3)); link(o)

    # air bubbles trapped in the oil: tiny clear spheres, the fine sparkle real chambers have
    for i in range(n(int(os.environ.get("BUBBLES", 26)))):
        x, z = place()
        bpy.ops.mesh.primitive_uv_sphere_add(radius=random.uniform(0.0008, 0.0022), segments=24, ring_count=12, location=(0, 0, 0))
        o = bpy.context.object; smooth(o); o.data.materials.append(clear); o.location = (x, depth(), z); link(o)


fill()
# a turn of the chamber brings in pieces from beside the wedge, so fill the arc the turn sweeps
# (built after the first fill, so the opening frame is unchanged)
if SWEEP > 0:
    ZONE = "out"
    fill(2 * SWEEP / (1.3 * ANGLE))

# opal back glass, faintly uneven
op = bpy.data.materials.new("opal"); op.use_nodes = True; nt = op.node_tree; N_ = nt.nodes; N_.clear()
out = N_.new("ShaderNodeOutputMaterial"); tr = N_.new("ShaderNodeBsdfTranslucent"); df = N_.new("ShaderNodeBsdfDiffuse"); mx = N_.new("ShaderNodeMixShader")
tr.inputs["Color"].default_value = (0.86, 0.88, 1.0, 1); df.inputs["Color"].default_value = (0.95, 0.95, 0.98, 1)
nz = N_.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 60; nz.inputs["Detail"].default_value = 4
rm = N_.new("ShaderNodeMapRange"); rm.inputs["To Min"].default_value = 0.15; rm.inputs["To Max"].default_value = 0.26
nt.links.new(nz.outputs["Fac"], rm.inputs["Value"]); nt.links.new(rm.outputs["Result"], mx.inputs[0])
nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(df.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], out.inputs[0])
bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=MW * 1.25, depth=0.004, location=(0, LM + 0.075, 0), rotation=(math.radians(90), 0, 0))
bpy.context.object.data.materials.append(op)

# ------------------------------------------------------------------ light: from behind only, like holding it to a window
bpy.ops.object.light_add(type="AREA", location=(0, LM + 0.35, 0))
bl = bpy.context.object; bl.data.size = 0.5; bl.data.energy = float(os.environ.get("BACK", 4)); bl.data.color = (1.0, 0.98, 0.96)
bl.rotation_euler = (math.radians(-90), 0, 0); bl.visible_camera = False
world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs[1].default_value = 0.0

# ------------------------------------------------------------------ camera at the eyepiece, on the mirrors' meeting line
cd = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cd); sc.collection.objects.link(cam); sc.camera = cam
# a pinhole exactly on the meeting line would see both mirrors edge-on, so sit a hair inside the wedge, as an eye does
EPS = float(os.environ.get("EPS", 0.0025))
# and start inside the mirrors, so no ray slips past their near end
cam.location = (EPS * math.cos(TH / 2), 0.01, EPS * math.sin(TH / 2)); cam.rotation_euler = (math.radians(90), 0, 0)
D = LM + 0.04
cd.sensor_fit = "HORIZONTAL"; cd.sensor_width = 36; cd.lens = 18 / (MW * 1.04 / D); cd.clip_start = 0.001
# no depth of field: a lens aperture wider than the eye's offset would look past the mirrors
cd.dof.use_dof = False; cd.dof.focus_distance = LM + 0.035; cd.dof.aperture_fstop = float(os.environ.get("FSTOP", 16))

# ------------------------------------------------------------------ render
sc.render.engine = "CYCLES"; cy = sc.cycles
cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = os.environ.get("NODN") is None
cy.max_bounces = 32; cy.glossy_bounces = 24; cy.transmission_bounces = 16; cy.diffuse_bounces = 2; cy.transparent_max_bounces = 8
cy.use_adaptive_sampling = True; cy.adaptive_threshold = 0.02
cy.caustics_reflective = False; cy.caustics_refractive = False; cy.blur_glossy = 0.0
sc.render.resolution_x = SIZE; sc.render.resolution_y = SIZE; sc.render.resolution_percentage = 100
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = float(os.environ.get("EXPO", -0.4))
# WEDGE=1: render only the direct view of one wedge, without mirrors; fold.py mirrors it into the
# full rosette. Two flat mirrors through the eye give exact reflections across their lines in the
# image, so the fold matches the mirror render while costing a fraction of it.
if os.environ.get("WEDGE") == "1":
    mo.hide_render = True
    cam.location = (0, 0.01, 0)
    sc.render.use_border = True; sc.render.use_crop_to_border = True
    sc.render.border_min_x, sc.render.border_max_x = 0.5, 1.0
    sc.render.border_min_y, sc.render.border_max_y = 0.5 - 0.004, min(1.0, 0.5 + 0.5 * math.sin(TH) + 0.012)
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
