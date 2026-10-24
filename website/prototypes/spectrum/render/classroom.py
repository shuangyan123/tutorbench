# Journal, "Why Teaching Does Not Scale", Fig. 1: an empty classroom seen from the back row in
# plain daylight. Thirty desks, one teacher's desk at the front: the scale of one room.
# usage: python classroom.py OUT.png [W H SPP]
import math, sys, os, random
import bpy, addon_utils

a = sys.argv[1:]; OUT = os.path.abspath(a[0])
W = int(a[1]) if len(a) > 1 else 1800; H = int(a[2]) if len(a) > 2 else 1000; SPP = int(a[3]) if len(a) > 3 else 96
random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene

def mat(name, col, rough=0.6, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): b.inputs[k].default_value = v
    return m

def box(loc, size, m, rot=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=(0, 0, rot)); o = bpy.context.object
    o.scale = size; o.data.materials.append(m)
    bev = o.modifiers.new("b", "BEVEL"); bev.width = min(0.012, min(size) * 0.3); bev.segments = 2
    return o

birch = mat("birch", (0.62, 0.46, 0.30), 0.45)
steel = mat("steel", (0.18, 0.2, 0.22), 0.35, Metallic=1.0)
seat = mat("seat", (0.24, 0.36, 0.33), 0.5)
wall = mat("wall", (0.78, 0.76, 0.71), 0.85)
floor = mat("floor", (0.42, 0.35, 0.28), 0.5)
board = mat("board", (0.07, 0.13, 0.11), 0.75)
frame = mat("frame", (0.85, 0.85, 0.82), 0.4)

def desk_and_chair(x, y, jit):
    r = jit * 0.06
    box((x, y, 0.72), (1.1, 0.55, 0.03), birch, r)
    for dx in (-0.5, 0.5):
        for dy in (-0.23, 0.23):
            box((x + dx * math.cos(r) - dy * math.sin(r), y + dx * math.sin(r) + dy * math.cos(r), 0.36), (0.03, 0.03, 0.72), steel)
    cy = y - 0.62 + jit * 0.05
    box((x, cy, 0.44), (0.42, 0.4, 0.03), seat, -r)
    box((x, cy - 0.2, 0.72), (0.42, 0.03, 0.32), seat, -r)
    for dx in (-0.18, 0.18):
        for dy in (-0.17, 0.17):
            box((x + dx, cy + dy, 0.22), (0.025, 0.025, 0.44), steel)

# 5 rows of 6: thirty desks
for row in range(5):
    for col in range(6):
        desk_and_chair(-4.5 + col * 1.8, 1.0 + row * 1.6, random.uniform(-1, 1))
# the teacher's desk, front left
box((-3.2, 9.6, 0.76), (1.8, 0.8, 0.04), birch); box((-3.2, 9.25, 0.4), (1.8, 0.04, 0.72), birch)

# room: floor, walls, ceiling, blackboard, windows on the left wall
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 5, 0)); bpy.context.object.data.materials.append(floor)
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 5, 3.4), rotation=(math.pi, 0, 0)); bpy.context.object.data.materials.append(wall)
box((0, 10.6, 1.7), (14, 0.1, 3.4), wall)          # front wall
box((7.0, 5, 1.7), (0.1, 14, 3.4), wall)           # right wall
box((0, -2.2, 1.7), (14, 0.1, 3.4), wall)          # back wall (behind camera)
box((0.4, 10.52, 1.65), (5.6, 0.04, 1.3), board)
box((0.4, 10.48, 0.98), (5.8, 0.12, 0.04), frame)  # chalk ledge
# left wall with three tall windows: wall pieces around the openings
for y0, y1 in ((-2.2, -0.2), (1.6, 3.4), (5.2, 7.0), (8.8, 10.6)):
    box((-7.0, (y0 + y1) / 2, 1.7), (0.1, y1 - y0, 3.4), wall)
for yc in (0.7, 4.3, 7.9):
    box((-7.0, yc, 0.45), (0.1, 1.8, 0.9), wall); box((-7.0, yc, 3.15), (0.1, 1.8, 0.5), wall)
    box((-7.0, yc, 1.9), (0.12, 1.8, 0.05), frame); box((-7.0, yc, 1.9), (0.12, 0.05, 2.0), frame)

# daylight: a low sun through the windows plus the sky beyond them
bpy.ops.object.light_add(type="SUN", location=(0, 0, 10)); s = bpy.context.object
s.data.energy = 6.0; s.data.angle = math.radians(1.5); s.data.color = (1.0, 0.95, 0.88)
s.rotation_euler = (math.radians(58), 0, math.radians(-62))
for yc in (0.7, 4.3, 7.9):
    bpy.ops.object.light_add(type="AREA", location=(-7.3, yc, 1.9)); l = bpy.context.object
    l.data.shape = "RECTANGLE"; l.data.size = 2.2; l.data.size_y = 1.8; l.data.energy = 1800; l.data.color = (0.86, 0.92, 1.0)
    l.rotation_euler = (0, math.radians(90), 0)
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.75, 0.82, 0.95, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 1.0

cd = bpy.data.cameras.new("c"); cd.lens = 24; cd.dof.use_dof = True; cd.dof.aperture_fstop = 5.6; cd.dof.focus_distance = 6.5
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (3.6, -1.7, 1.55)
tgt = bpy.data.objects.new("t", None); sc.collection.objects.link(tgt); tgt.location = (-0.6, 8.5, 0.9)
tr = cam.constraints.new("TRACK_TO"); tr.target = tgt; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.max_bounces = 8; cy.diffuse_bounces = 4
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Base Contrast"; sc.view_settings.exposure = 1.1
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
