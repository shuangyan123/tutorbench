# Journal cover, "Why Good Learning Resources Fail to Reach the People Who Need Them": a wall of
# library shelves and a rolling ladder hooked onto its brass rail. High up, one book has been drawn
# half out of its row, and the last of the daylight, cool and blue, falls across that shelf through
# a tall window off to the left. The books are there; the question is the way up to them.
# usage: python ladder.py OUT.png [W H SPP]
# tuning (env): EXPO SUN SKY SEED
import math, sys, os, random
import bpy, bmesh, addon_utils
from mathutils import Vector, Matrix, Euler

a = sys.argv[1:]; OUT = os.path.abspath(a[0])
W = int(a[1]) if len(a) > 1 else 900; H = int(a[2]) if len(a) > 2 else 1100; SPP = int(a[3]) if len(a) > 3 else 160
EXPO = float(os.environ.get("EXPO", -2.4)); SUN = float(os.environ.get("SUN", 1.0)); SKY = float(os.environ.get("SKY", 0.0))
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene; rnd = random.Random(int(os.environ.get("SEED", 11)))


def mat(name, col, rough=0.5, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): b.inputs[k].default_value = v
    return m, b


# every box goes into one mesh per material (thousands of books as separate objects make Blender crawl)
MESHES = {}


def box(name, loc, size, m, bevel=0.0, rot=(0, 0, 0)):
    bm = MESHES.setdefault(m.name, (bmesh.new(), m))[0]
    M = Matrix.Translation(loc) @ Euler(rot).to_matrix().to_4x4() @ Matrix.Diagonal((*size, 1))
    verts = bmesh.ops.create_cube(bm, size=1, matrix=M)["verts"]
    if bevel:
        vs = set(verts); edges = [e for e in bm.edges if e.verts[0] in vs and e.verts[1] in vs]
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=2, affect="EDGES", profile=0.5)
    return Vector(loc)


def flush():
    for name, (bm, m) in MESHES.items():
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
        for poly in me.polygons: poly.use_smooth = False
        o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); me.materials.append(m)


def oak(name, base=(0.36, 0.22, 0.12), scale=(1, 1, 1)):
    """oiled oak: streaked grain along the board, low contrast, a soft sheen"""
    m, b = mat(name, base, 0.48, **{"Coat Weight": 0.18, "Coat Roughness": 0.3}); t = m.node_tree
    tc = t.nodes.new("ShaderNodeTexCoord"); mp = t.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = scale
    t.links.new(tc.outputs["Object"], mp.inputs[0])
    wv = t.nodes.new("ShaderNodeTexWave"); wv.wave_type = "BANDS"; wv.inputs["Scale"].default_value = 3.0
    wv.inputs["Distortion"].default_value = 4.0; wv.inputs["Detail"].default_value = 3; t.links.new(mp.outputs[0], wv.inputs[0])
    nz = t.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 60; nz.inputs["Detail"].default_value = 6; t.links.new(mp.outputs[0], nz.inputs[0])
    mix = t.nodes.new("ShaderNodeMix"); mix.data_type = "FLOAT"; mix.inputs[0].default_value = 0.35
    t.links.new(wv.outputs[1], mix.inputs[2]); t.links.new(nz.outputs[0], mix.inputs[3])
    rp = t.nodes.new("ShaderNodeValToRGB")
    rp.color_ramp.elements[0].color = (base[0] * 0.72, base[1] * 0.70, base[2] * 0.68, 1)
    rp.color_ramp.elements[1].color = (base[0] * 1.18, base[1] * 1.15, base[2] * 1.1, 1)
    t.links.new(mix.outputs[0], rp.inputs[0]); t.links.new(rp.outputs[0], b.inputs["Base Color"])
    bp = t.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.08
    t.links.new(nz.outputs[0], bp.inputs["Height"]); t.links.new(bp.outputs[0], b.inputs["Normal"])
    return m


# ---------------------------------------------------------------- the shelf wall (x along the wall, y depth, z up)
case = oak("case", (0.19, 0.105, 0.05), (0.4, 0.4, 6.0))
case_h = oak("case_h", (0.19, 0.105, 0.05), (6.0, 0.4, 0.4))
DEPTH = 0.34; TOP = 3.62; BAYS = [-2.7, -1.8, -0.9, 0.0, 0.9, 1.8, 2.7]   # upright centres
SHELF_Z = [0.08 + 0.33 * i for i in range(11)]                             # shelf tops
box("back", (0, DEPTH + 0.01, TOP / 2), (6.0, 0.02, TOP), oak("backboard", (0.12, 0.07, 0.035), (6, 6, 6)))
for x in BAYS:
    box(f"upright{x}", (x, DEPTH / 2, TOP / 2), (0.035, DEPTH, TOP), case, 0.004)
for z in SHELF_Z:
    box(f"shelf{z:.2f}", (0, DEPTH / 2, z - 0.012), (5.6, DEPTH, 0.024), case_h, 0.003)
box("cornice", (0, DEPTH / 2 - 0.02, TOP + 0.04), (5.7, DEPTH + 0.06, 0.08), case_h, 0.01)

# the brass rail the ladder hangs from, on small standoffs
brass, bb = mat("brass", (0.80, 0.58, 0.30), 0.28, **{"Metallic": 1.0})
RAIL_Z = 3.42; RAIL_Y = -0.07
bpy.ops.mesh.primitive_cylinder_add(radius=0.014, depth=5.6, location=(0, RAIL_Y, RAIL_Z), rotation=(0, math.radians(90), 0), vertices=32)
bpy.context.object.data.materials.append(brass)
for x in BAYS:
    bpy.ops.mesh.primitive_cylinder_add(radius=0.008, depth=0.08, location=(x, RAIL_Y + 0.04, RAIL_Z), rotation=(math.radians(90), 0, 0), vertices=16)
    bpy.context.object.data.materials.append(brass)

# ---------------------------------------------------------------- books
# library cloth and buckram: navy, oxblood, bottle green, slate, black, faded blue, tan, plum, rust,
# grey board, and a few pale paperbacks
CLOTH = [(0.035, 0.045, 0.09), (0.15, 0.03, 0.03), (0.035, 0.07, 0.045), (0.07, 0.07, 0.075), (0.022, 0.02, 0.02),
         (0.10, 0.11, 0.14), (0.20, 0.12, 0.055), (0.07, 0.035, 0.05), (0.15, 0.055, 0.025), (0.24, 0.22, 0.19),
         (0.05, 0.055, 0.11), (0.10, 0.10, 0.055), (0.42, 0.38, 0.30), (0.12, 0.07, 0.04), (0.30, 0.10, 0.05)]
paper, _ = mat("paper", (0.80, 0.78, 0.72), 0.85)
gilt, _ = mat("gilt", (0.75, 0.55, 0.26), 0.35, **{"Metallic": 1.0})
mats = []
label, _ = mat("label", (0.55, 0.50, 0.40), 0.8)
for i in range(len(CLOTH) * 3):   # each binding in three slightly different dyes and fades
    c = tuple(max(0.0, v * rnd.uniform(0.75, 1.25)) for v in CLOTH[i % len(CLOTH)])
    m, b = mat(f"cloth{i}", c, rnd.uniform(0.55, 0.85), **{"Sheen Weight": 0.04, "Specular IOR Level": 0.3})
    t = m.node_tree; nz = t.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 400; nz.inputs["Detail"].default_value = 3
    bp = t.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.12
    t.links.new(nz.outputs[0], bp.inputs["Height"]); t.links.new(bp.outputs[0], b.inputs["Normal"])
    mats.append(m)


def book(x, z, w, h, d, m, pull=0.0, lean=0.0):
    """one book standing on a shelf at z, spine facing the room (y = 0 side), x is its left edge"""
    cx = x + w / 2; y0 = 0.02 - pull
    rot = (0, lean, 0)
    # lean about the bottom corner, so a leaning book still rests on the shelf
    piv = Vector((x + (w if lean < 0 else 0), 0, z)); R = Euler(rot).to_matrix()
    at = lambda v: tuple(piv + R @ (Vector(v) - piv))
    c = box("book", at((cx, y0 + d / 2, z + h / 2)), (w, d, h), m, min(0.004, w * 0.12), rot)
    # page block shows as a pale edge at the top, set in from the boards
    box("pages", at((cx, y0 + d / 2 + 0.004, z + h - 0.004)), (w * 0.86, d - 0.012, 0.01), paper, 0, rot)
    if rnd.random() < 0.55:   # two thin gilt bands across the spine
        for bz in (h - 0.03, 0.03):
            box("band", at((cx, y0 - 0.0012, z + bz)), (w * 0.9, 0.002, 0.004), gilt, 0, rot)
    elif rnd.random() < 0.4:  # or a paper label with the shelf mark, low on the spine
        box("label", at((cx, y0 - 0.0012, z + 0.045)), (w * 0.7, 0.002, 0.03), label, 0, rot)
    if rnd.random() < 0.35:   # a leather title piece near the head
        box("title", at((cx, y0 - 0.0014, z + h - 0.06)), (w * 0.82, 0.002, 0.035), rnd.choice(mats), 0, rot)
    return c


PULLED = None
for si, z in enumerate(SHELF_Z[:-1]):
    for bi, (x0, x1) in enumerate(zip(BAYS, BAYS[1:])):
        x = x0 + 0.03; end = x1 - 0.03; run = rnd.randrange(len(mats))
        clear = SHELF_Z[si + 1] - z - 0.03
        while x < end - 0.02:
            if rnd.random() < 0.05: x += rnd.uniform(0.03, 0.12); continue   # a gap where something is out
            w = rnd.choice([0.022, 0.028, 0.032, 0.038, 0.045, 0.055]) * rnd.uniform(0.9, 1.1)
            h = min(clear, rnd.uniform(0.17, 0.30)); d = rnd.uniform(0.15, 0.24)
            if x + w > end: break
            if rnd.random() < 0.35: run = rnd.randrange(len(mats))          # sets share a binding
            pull = 0.0
            # the drawn-out book: top shelf in reach of the ladder, in the window light
            if si == 9 and bi == 2 and PULLED is None and x > x0 + 0.56:
                pull = 0.14; w = 0.045; h = min(clear, 0.275); m = mats[1]
                PULLED = book(x, z, w, h, d, m, pull)
            else:
                book(x, z, w, h, d, mats[run], rnd.uniform(0.0, 0.018) if rnd.random() < 0.3 else 0.0, rnd.choice([0.0] * 8 + [0.015, -0.02]))
            x += w + rnd.uniform(0.0005, 0.003)
        # a couple of books leaning into the gap at the end of a row
        if end - x > 0.05 and rnd.random() < 0.5:
            book(x + 0.01, z, 0.03, min(clear, 0.24), 0.2, mats[rnd.randrange(len(mats))], 0, -0.16)

# ---------------------------------------------------------------- the ladder (oak rails, flat treads, hooks on the rail)
lad = oak("ladder", (0.26, 0.15, 0.07), (0.4, 0.4, 6.0))
LX = 0.22; LW = 0.46; FOOT_Y = -1.05; TOP_Y = RAIL_Y - 0.03
rail_len = math.hypot(RAIL_Z - 0.0, TOP_Y - FOOT_Y); tilt = math.atan2(TOP_Y - FOOT_Y, RAIL_Z)
mid = Vector((0, (FOOT_Y + TOP_Y) / 2, RAIL_Z / 2))
for sx in (-LW / 2, LW / 2):
    box("stile", (LX + sx, mid.y, mid.z), (0.035, 0.07, rail_len), lad, 0.006, (-tilt, 0, 0))
for k in range(1, 12):
    t = k / 12; zz = t * RAIL_Z; yy = FOOT_Y + t * (TOP_Y - FOOT_Y)
    box(f"tread{k}", (LX, yy - 0.01, zz), (LW, 0.11, 0.024), lad, 0.004)
for sx in (-LW / 2, LW / 2):   # hooks over the rail
    bpy.ops.mesh.primitive_torus_add(major_radius=0.026, minor_radius=0.007, location=(LX + sx, RAIL_Y, RAIL_Z + 0.006), rotation=(0, math.radians(90), 0))
    bpy.context.object.data.materials.append(brass)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=0.02, location=(LX + sx, FOOT_Y, 0.03), rotation=(0, math.radians(90), 0), vertices=24)
    bpy.context.object.data.materials.append(brass)

flush()

# floor: worn boards
floor = oak("floor", (0.30, 0.19, 0.11), (0.25, 3.0, 1))
bpy.ops.mesh.primitive_plane_add(size=20, location=(0, -4, 0)); bpy.context.object.data.materials.append(floor)

# ---------------------------------------------------------------- the room: a side wall with a tall window, a ceiling
plaster, _ = mat("plaster", (0.62, 0.62, 0.64), 0.9)
WX = -2.86; WY0, WY1, WZ0, WZ1 = -1.25, -0.05, 1.1, 3.6        # window opening in the side wall
def slab(loc, size):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.object; o.scale = size; o.data.materials.append(plaster)
slab((WX - 0.1, (0.4 + WY1) / 2, 2.0), (0.2, 0.4 - WY1, 4.0))           # between window and the shelves
slab((WX - 0.1, (WY0 - 7.0) / 2, 2.0), (0.2, WY0 + 7.0, 4.0))           # towards the camera
slab((WX - 0.1, (WY0 + WY1) / 2, WZ0 / 2), (0.2, WY1 - WY0, WZ0))        # sill wall
slab((WX - 0.1, (WY0 + WY1) / 2, (WZ1 + 4.0) / 2), (0.2, WY1 - WY0, 4.0 - WZ1))
slab((0, -3.0, 3.83), (7.0, 7.0, 0.1))                                     # ceiling
slab((0, -6.5, 2.0), (7.0, 0.2, 4.0))                                      # the wall behind the camera
slab((3.0, -3.0, 2.0), (0.2, 7.0, 4.0))                                    # and to the right

# ---------------------------------------------------------------- light: blue hour through the window
# no sun: the sky after sunset, a broad cool source filling the opening, so the light rakes along
# the shelves from the left, brightest on the upper rows, and the uprights and ladder throw long soft
# shadows to the right. A faint neutral bounce from the room keeps the far shadows from going black.
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.45, 0.55, 0.85, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.6 * SKY
bpy.ops.object.light_add(type="AREA", location=(WX - 0.6, (WY0 + WY1) / 2, (WZ0 + WZ1) / 2 + 0.3)); win = bpy.context.object
win.data.shape = "RECTANGLE"; win.data.size = WY1 - WY0; win.data.size_y = WZ1 - WZ0; win.data.energy = 900 * SUN
win.data.color = (0.86, 0.90, 1.0); win.data.spread = math.radians(45)
win.rotation_euler = (math.radians(90), 0, math.radians(-90))
win.rotation_euler = (Vector((1.2, 0.4, 2.4)) - win.location).to_track_quat("-Z", "Y").to_euler()
# the transom above the window: the last bright patch of sky lays a soft pool on the top rows,
# across the drawn-out book
bpy.ops.object.light_add(type="SPOT", location=(WX - 0.4, (WY0 + WY1) / 2, WZ1 + 0.1)); pool = bpy.context.object
pool.data.energy = float(os.environ.get("POOL", 900)); pool.data.color = (0.88, 0.92, 1.0); pool.data.spot_size = math.radians(16); pool.data.spot_blend = 0.85
pool.data.shadow_soft_size = 0.35
pool.rotation_euler = ((Vector((PULLED.x, -0.05, PULLED.z + 0.1)) if PULLED else Vector((0, 0, 3))) - pool.location).to_track_quat("-Z", "Y").to_euler()
bpy.ops.object.light_add(type="AREA", location=(2.6, -3.6, 2.2)); fill = bpy.context.object
fill.data.size = 3.0; fill.data.energy = 25 * SKY; fill.data.color = (0.95, 0.93, 0.98)
fill.rotation_euler = (Vector((0.0, 0.2, 2.0)) - fill.location).to_track_quat("-Z", "Y").to_euler()

# ---------------------------------------------------------------- camera: level, shifted up, a little from the right
V = lambda k, d: Vector([float(x) for x in os.environ.get(k, d).split(",")])
cd = bpy.data.cameras.new("c"); cd.lens = float(os.environ.get("LENS", 52)); cd.sensor_width = 36; cd.shift_y = float(os.environ.get("SHIFT", 0.0))
cd.dof.use_dof = True; cd.dof.aperture_fstop = 5.6
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = V("CAM", "1.55,-2.75,2.62")
look = V("LOOK", "-0.3,0.1,2.62")
cam.rotation_euler = (look - cam.location).to_track_quat("-Z", "Y").to_euler()
cd.dof.focus_distance = (Vector((PULLED.x, 0, PULLED.z)) - cam.location).length if PULLED else 3.6

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.max_bounces = 8; cy.diffuse_bounces = 4; cy.glossy_bounces = 4; cy.caustics_refractive = False; cy.caustics_reflective = False
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = os.environ.get("VT", "AgX"); sc.view_settings.look = os.environ.get("LOOK_T", "AgX - Medium High Contrast"); sc.view_settings.exposure = EXPO
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
