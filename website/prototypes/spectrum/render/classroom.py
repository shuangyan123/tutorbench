# Journal, "Why Teaching Does Not Scale", Fig. 1: an empty classroom seen from the back corner in
# morning sun. Thirty desks, one teacher's desk at the front: the scale of one room.
# Lit like a photograph: low sun through three tall windows (light portals to a bright sky), sun
# patches across the linoleum, tubular-steel furniture, a little left-behind paper.
# usage: python classroom.py OUT.png [W H SPP]
import math, sys, os, random
import bpy, addon_utils
from mathutils import Vector

a = sys.argv[1:]; OUT = os.path.abspath(a[0])
W = int(a[1]) if len(a) > 1 else 1800; H = int(a[2]) if len(a) > 2 else 1000; SPP = int(a[3]) if len(a) > 3 else 160
random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene

def mat(name, col, rough=0.6, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): b.inputs[k].default_value = v
    return m, b

def box(loc, size, m, rot=(0, 0, 0), bevel=0.006):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot); o = bpy.context.object
    o.scale = size; o.data.materials.append(m)
    if bevel:
        bv = o.modifiers.new("b", "BEVEL"); bv.width = min(bevel, min(size) * 0.45); bv.segments = 2
    return o

def tube(p, q, r, m, verts=12):
    p, q = Vector(p), Vector(q); d = q - p
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d.length, vertices=verts, location=(p + q) / 2)
    o = bpy.context.object; o.rotation_mode = "QUATERNION"; o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.data.materials.append(m); o.data.polygons.foreach_set("use_smooth", [True] * len(o.data.polygons))
    return o

def noisy(m, b, scale, lo, hi, rough=None):
    """colour variation from a noise texture between two tones"""
    nt = m.node_tree; nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = scale; nz.inputs["Detail"].default_value = 8
    rp = nt.nodes.new("ShaderNodeValToRGB"); rp.color_ramp.elements[0].color = (*lo, 1); rp.color_ramp.elements[1].color = (*hi, 1)
    rp.color_ramp.elements[0].position = 0.35; rp.color_ramp.elements[1].position = 0.65
    nt.links.new(nz.outputs[0], rp.inputs[0]); nt.links.new(rp.outputs[0], b.inputs["Base Color"])
    if rough:
        rr = nt.nodes.new("ShaderNodeMapRange"); rr.inputs[3].default_value, rr.inputs[4].default_value = rough
        nt.links.new(nz.outputs[0], rr.inputs[0]); nt.links.new(rr.outputs[0], b.inputs["Roughness"])

# ---- materials
lam, lb = mat("laminate", (0.6, 0.46, 0.31), 0.32); noisy(lam, lb, 40, (0.55, 0.41, 0.27), (0.64, 0.5, 0.34), (0.26, 0.4))
edge, _ = mat("edge", (0.12, 0.1, 0.09), 0.5)
steel, _ = mat("steel", (0.55, 0.56, 0.57), 0.28, Metallic=1.0)
plastic, pb = mat("chair", (0.4, 0.12, 0.05), 0.38); noisy(plastic, pb, 25, (0.37, 0.11, 0.045), (0.43, 0.13, 0.055))
paper, _ = mat("paper", (0.82, 0.82, 0.8), 0.7)
book, _ = mat("book", (0.1, 0.22, 0.16), 0.55)

floor_m, fb = mat("lino", (0.3, 0.28, 0.25), 0.3)
fnt = floor_m.node_tree; ftc = fnt.nodes.new("ShaderNodeTexCoord"); fbk = fnt.nodes.new("ShaderNodeTexBrick"); fbk.offset = 0.0
fbk.inputs["Scale"].default_value = 1.0; fbk.inputs["Brick Width"].default_value = 0.3; fbk.inputs["Row Height"].default_value = 0.3
fbk.inputs["Mortar Size"].default_value = 0.0015
fbk.inputs["Color1"].default_value = (0.31, 0.29, 0.26, 1); fbk.inputs["Color2"].default_value = (0.27, 0.255, 0.23, 1); fbk.inputs["Mortar"].default_value = (0.16, 0.15, 0.14, 1)
fbk.inputs["Bias"].default_value = 0.0
fnz = fnt.nodes.new("ShaderNodeTexNoise"); fnz.inputs["Scale"].default_value = 3; fnz.inputs["Detail"].default_value = 6
frr = fnt.nodes.new("ShaderNodeMapRange"); frr.inputs[3].default_value = 0.16; frr.inputs[4].default_value = 0.42
fnt.links.new(ftc.outputs["Object"], fbk.inputs["Vector"]); fnt.links.new(fbk.outputs["Color"], fb.inputs["Base Color"])
fnt.links.new(ftc.outputs["Object"], fnz.inputs["Vector"]); fnt.links.new(fnz.outputs[0], frr.inputs[0]); fnt.links.new(frr.outputs[0], fb.inputs["Roughness"])

paint, ptb = mat("paint", (0.74, 0.73, 0.69), 0.85); noisy(paint, ptb, 6, (0.72, 0.71, 0.67), (0.76, 0.75, 0.71))
dado, _ = mat("dado", (0.25, 0.3, 0.26), 0.55)
ceil_m, cb = mat("ceiling", (0.78, 0.78, 0.76), 0.9)
cnt = ceil_m.node_tree; ctc = cnt.nodes.new("ShaderNodeTexCoord"); cbk = cnt.nodes.new("ShaderNodeTexBrick"); cbk.offset = 0.0
cbk.inputs["Scale"].default_value = 1.0; cbk.inputs["Brick Width"].default_value = 0.6; cbk.inputs["Row Height"].default_value = 0.6; cbk.inputs["Mortar Size"].default_value = 0.012
cbk.inputs["Color1"].default_value = (0.78, 0.78, 0.76, 1); cbk.inputs["Color2"].default_value = (0.76, 0.76, 0.74, 1); cbk.inputs["Mortar"].default_value = (0.6, 0.6, 0.58, 1)
cnt.links.new(ctc.outputs["Object"], cbk.inputs["Vector"]); cnt.links.new(cbk.outputs["Color"], cb.inputs["Base Color"])
board_m, bb = mat("board", (0.045, 0.085, 0.07), 0.8); noisy(board_m, bb, 2.5, (0.045, 0.08, 0.068), (0.11, 0.14, 0.125))
frame_m, _ = mat("frame", (0.8, 0.8, 0.77), 0.45)
oak, ob = mat("oak", (0.32, 0.2, 0.1), 0.45); noisy(oak, ob, 30, (0.28, 0.17, 0.08), (0.36, 0.23, 0.12))
cork, ckb = mat("cork", (0.36, 0.24, 0.13), 0.9); noisy(cork, ckb, 200, (0.3, 0.19, 0.1), (0.42, 0.29, 0.16))

# ---- furniture
def desk(x, y, rot):
    c, s = math.cos(rot), math.sin(rot)
    R = lambda dx, dy: (x + dx * c - dy * s, y + dx * s + dy * c)
    box((x, y, 0.72), (1.2, 0.55, 0.022), lam, (0, 0, rot), 0.004)
    box((x, y, 0.705), (1.2, 0.55, 0.01), edge, (0, 0, rot), 0.002)
    box((*R(0, 0.06), 0.6), (1.08, 0.36, 0.006), steel, (0, 0, rot), 0)          # book shelf under the top
    for dx in (-0.56, 0.56):
        for dy in (-0.23, 0.23):
            px, py = R(dx, dy); tube((px, py, 0.0), (px, py, 0.7), 0.013, steel)
        p1, p2 = R(dx, -0.23), R(dx, 0.23); tube((*p1, 0.12), (*p2, 0.12), 0.01, steel)

def chair(x, y, rot):
    c, s = math.cos(rot), math.sin(rot)
    R = lambda dx, dy: (x + dx * c - dy * s, y + dx * s + dy * c)
    seat = box((x, y, 0.45), (0.42, 0.4, 0.014), plastic, (0, 0, rot), 0.006)
    sd = seat.modifiers.new("d", "SIMPLE_DEFORM"); sd.deform_method = "BEND"; sd.angle = math.radians(-14); sd.deform_axis = "X"
    bx, by = R(0, -0.21)
    back = box((bx, by, 0.76), (0.4, 0.012, 0.2), plastic, (math.radians(-8), 0, rot), 0.005)
    bd = back.modifiers.new("d", "SIMPLE_DEFORM"); bd.deform_method = "BEND"; bd.angle = math.radians(26); bd.deform_axis = "Z"
    for dx in (-0.18, 0.18):
        f, b_ = R(dx, 0.17), R(dx, -0.18)
        tube((*f, 0.0), (*f, 0.44), 0.011, steel); tube((*b_, 0.0), (*b_, 0.44), 0.011, steel)
        t = R(dx, -0.2); tube((*b_, 0.44), (*t, 0.68), 0.011, steel)

def sheet(x, y, z, rot, m=paper, size=(0.21, 0.297)):
    bpy.ops.mesh.primitive_plane_add(size=1, location=(x, y, z), rotation=(0, 0, rot)); o = bpy.context.object
    o.scale = (*size, 1); o.data.materials.append(m); return o

# 5 rows of 6: thirty desks, each with its chair; most chairs pushed in, a few left out
for row in range(5):
    for col in range(6):
        x, y = -4.6 + col * 1.75, 0.6 + row * 1.65
        r = random.uniform(-1, 1) * 0.03
        desk(x, y, r)
        pull = random.random()
        cy = y - 0.42 - (0.35 if pull < 0.25 else 0.0) - random.uniform(0, 0.06)
        chair(x + random.uniform(-0.06, 0.06), cy, r + random.uniform(-1, 1) * (0.25 if pull < 0.25 else 0.05))
        if random.random() < 0.18: sheet(x + random.uniform(-0.3, 0.3), y + random.uniform(-0.1, 0.1), 0.7325, random.uniform(-0.5, 0.5))
        if random.random() < 0.1: box((x + random.uniform(-0.35, 0.35), y, 0.745), (0.17, 0.24, 0.012), book, (0, 0, random.uniform(-0.6, 0.6)), 0.002)

# the teacher's desk, front left, with a stack of exercise books
box((-3.6, 9.55, 0.76), (1.6, 0.75, 0.035), oak, (0, 0, 0.04)); box((-3.6, 9.88, 0.38), (1.56, 0.03, 0.74), oak, (0, 0, 0.04))
for sx in (-0.78, 0.78): box((-3.6 + sx, 9.55, 0.38), (0.03, 0.72, 0.74), oak, (0, 0, 0.04))
for k in range(9): box((-3.25 + random.uniform(-0.01, 0.01), 9.5, 0.785 + k * 0.009), (0.21, 0.29, 0.008), book if k % 3 else paper, (0, 0, 0.1 + random.uniform(-0.06, 0.06)), 0.001)
chair(-3.4, 10.1, math.pi + 0.3)

# ---- the room: x from -7 (window wall) to 7, y from -2.2 (back) to 10.6 (front)
X0, X1, Y0, Y1, HT = -7.0, 7.0, -2.2, 10.6, 3.3
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, (Y0 + Y1) / 2, 0)); f = bpy.context.object; f.scale = (X1 - X0, Y1 - Y0, 1); f.data.materials.append(floor_m)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, (Y0 + Y1) / 2, HT), rotation=(math.pi, 0, 0)); c_ = bpy.context.object; c_.scale = (X1 - X0, Y1 - Y0, 1); c_.data.materials.append(ceil_m)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
def wall_x(x, ya, yb, za, zb, m=paint, t=0.12):
    box((x, (ya + yb) / 2, (za + zb) / 2), (t, yb - ya, zb - za), m, bevel=0)
def wall_y(y, xa, xb, za, zb, m=paint, t=0.12):
    box(((xa + xb) / 2, y, (za + zb) / 2), (xb - xa, t, zb - za), m, bevel=0)
wall_y(Y1, X0, X1, 0, HT); wall_y(Y0, X0, X1, 0, HT); wall_x(X1, Y0, Y1, 0, HT)
# dado: painted lower band and a wooden rail on the three solid walls
wall_y(Y1 - 0.065, X0, X1, 0, 1.0, dado, 0.01); wall_x(X1 - 0.065, Y0, Y1, 0, 1.0, dado, 0.01); wall_y(Y0 + 0.065, X0, X1, 0, 1.0, dado, 0.01)
box((0, Y1 - 0.08, 1.0), (X1 - X0, 0.03, 0.05), oak, bevel=0.005); box((X1 - 0.08, (Y0 + Y1) / 2, 1.0), (0.03, Y1 - Y0, 0.05), oak, bevel=0.005)
# window wall: solid piers between three tall openings
WINS = (0.6, 4.2, 7.8); WW, SILL, TOP = 2.0, 0.85, 2.95
edges = [Y0] + [v for yc in WINS for v in (yc - WW / 2, yc + WW / 2)] + [Y1]
for ya, yb in zip(edges[0::2], edges[1::2]): wall_x(X0, ya, yb, 0, HT)
for yc in WINS:
    wall_x(X0, yc - WW / 2, yc + WW / 2, 0, SILL); wall_x(X0, yc - WW / 2, yc + WW / 2, TOP, HT)
    box((X0 + 0.1, yc, SILL), (0.3, WW + 0.08, 0.03), frame_m, bevel=0.004)                    # sill
    for dy in (-WW / 2, -WW / 6, WW / 6, WW / 2): box((X0 + 0.02, yc + dy, (SILL + TOP) / 2), (0.08, 0.06, TOP - SILL), frame_m, bevel=0.004)
    for z in (SILL + 0.02, 2.2, TOP - 0.02): box((X0 + 0.02, yc, z), (0.08, WW, 0.05), frame_m, bevel=0.004)
    # radiator under each window
    for k in range(18): box((X0 + 0.16, yc - 0.6 + k * 0.07, 0.42), (0.08, 0.025, 0.5), frame_m, bevel=0.006)
    # a light portal in the opening so the sky lights the room cleanly
    bpy.ops.object.light_add(type="AREA", location=(X0 - 0.07, yc, (SILL + TOP) / 2)); pl = bpy.context.object
    pl.data.shape = "RECTANGLE"; pl.data.size = (TOP - SILL); pl.data.size_y = WW; pl.data.cycles.is_portal = True
    pl.rotation_euler = (0, math.radians(-90), 0)
# blackboard with a wooden frame and a chalk ledge
box((0.4, Y1 - 0.08, 1.75), (5.4, 0.03, 1.25), board_m, bevel=0)
for z in (1.12, 2.38): box((0.4, Y1 - 0.09, z), (5.5, 0.05, 0.05), oak, bevel=0.004)
for x in (-2.33, 3.13): box((x, Y1 - 0.09, 1.75), (0.05, 0.05, 1.31), oak, bevel=0.004)
box((0.4, Y1 - 0.15, 1.1), (5.5, 0.12, 0.025), oak, bevel=0.004)
# corkboard with notices on the right wall
box((X1 - 0.08, 3.2, 1.75), (0.03, 2.6, 1.0), cork, bevel=0.004)
for k in range(9):
    s_ = sheet(X1 - 0.098, 2.1 + (k % 5) * 0.48 + random.uniform(-0.05, 0.05), 1.55 + (k // 5) * 0.42 + random.uniform(-0.04, 0.04), 0)
    s_.rotation_euler = (math.radians(90) + random.uniform(-0.05, 0.05), 0, math.radians(90))
# ceiling: three rows of flat light fittings (off; it's morning)
for yy in (1.5, 5.0, 8.5):
    for xx in (-3.5, 0, 3.5): box((xx, yy, HT - 0.02), (1.2, 0.3, 0.03), frame_m, bevel=0.004)

# ---- light: low morning sun through the windows, a bright sky beyond them
bpy.ops.object.light_add(type="SUN", location=(0, 0, 10)); s = bpy.context.object
s.data.energy = 14; s.data.angle = math.radians(0.6); s.data.color = (1.0, 0.86, 0.68)
s.rotation_mode = "QUATERNION"; s.rotation_quaternion = Vector((0.78, -0.5, -0.3)).normalized().to_track_quat("-Z", "Y")
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
sky = w.node_tree.nodes.new("ShaderNodeTexSky")
try:
    sky.sky_type = "NISHITA"; sky.sun_disc = False; sky.sun_elevation = math.radians(28); sky.sun_rotation = math.radians(-22)
    w.node_tree.links.new(sky.outputs[0], w.node_tree.nodes["Background"].inputs[0]); w.node_tree.nodes["Background"].inputs[1].default_value = 0.35
except Exception:
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.8, 0.85, 0.95, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 1.5

cd = bpy.data.cameras.new("c"); cd.lens = 24; cd.dof.use_dof = True; cd.dof.aperture_fstop = 4.0; cd.dof.focus_distance = 6.0
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (6.1, -1.8, 1.48)
tgt = bpy.data.objects.new("t", None); sc.collection.objects.link(tgt); tgt.location = (-2.6, 7.6, 0.8)
tr = cam.constraints.new("TRACK_TO"); tr.target = tgt; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.max_bounces = 10; cy.diffuse_bounces = 5; cy.glossy_bounces = 4
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Base Contrast"; sc.view_settings.exposure = 1.0
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
