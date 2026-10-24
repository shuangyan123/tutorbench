# Journal cover, "The Classroom Does Not Need 30 Robots": a classroom coat rail of identical pegs
# running off along a painted block wall, one of them holding a hand-knitted mustard scarf.
# Warm late-afternoon sun through venetian blinds. The scarf is a cloth simulation dropped over its
# peg, with a stockinette height map (knit_texture.py) for the stitches.
# usage: python hooks.py KNIT_HEIGHT.png OUT.png [W H SPP]
import math, sys, os, random
import bpy, bmesh, addon_utils
from mathutils import Vector

a = sys.argv[1:]; KNIT = os.path.abspath(a[0]); OUT = os.path.abspath(a[1])
W = int(a[2]) if len(a) > 2 else 900; H = int(a[3]) if len(a) > 3 else 1100; SPP = int(a[4]) if len(a) > 4 else 128
random.seed(4)
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene

def mat(name, col, rough=0.6, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): b.inputs[k].default_value = v
    return m, b

# ---- the wall: painted concrete block, mortar joints slightly sunk, paint a little uneven
wall_m, wb = mat("wall", (0.6, 0.61, 0.6), 0.8)
nt = wall_m.node_tree; L_ = nt.links
tc = nt.nodes.new("ShaderNodeTexCoord")
br = nt.nodes.new("ShaderNodeTexBrick"); br.offset = 0.5
br.inputs["Scale"].default_value = 1.0; br.inputs["Brick Width"].default_value = 0.4; br.inputs["Row Height"].default_value = 0.2
br.inputs["Mortar Size"].default_value = 0.009; br.inputs["Mortar Smooth"].default_value = 0.4
br.inputs["Color1"].default_value = (0.6, 0.61, 0.6, 1); br.inputs["Color2"].default_value = (0.57, 0.585, 0.575, 1); br.inputs["Mortar"].default_value = (0.4, 0.41, 0.4, 1)
pn = nt.nodes.new("ShaderNodeTexNoise"); pn.inputs["Scale"].default_value = 260; pn.inputs["Detail"].default_value = 10
add = nt.nodes.new("ShaderNodeMath"); add.operation = "MULTIPLY_ADD"; add.inputs[1].default_value = 0.12
bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.8; bp.inputs["Distance"].default_value = 0.006
inv = nt.nodes.new("ShaderNodeMath"); inv.operation = "SUBTRACT"; inv.inputs[0].default_value = 1.0
L_.new(tc.outputs["Object"], br.inputs["Vector"]); L_.new(tc.outputs["Object"], pn.inputs["Vector"])
L_.new(br.outputs["Fac"], inv.inputs[1]); L_.new(pn.outputs[0], add.inputs[0]); L_.new(inv.outputs[0], add.inputs[2])
L_.new(add.outputs[0], bp.inputs["Height"]); L_.new(bp.outputs[0], wb.inputs["Normal"]); L_.new(br.outputs["Color"], wb.inputs["Base Color"])
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0), rotation=(math.radians(90), 0, 0)); wo = bpy.context.object
wo.scale = (40, 8, 1); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True); wo.data.materials.append(wall_m)

# ---- the rail: varnished oak board
wood_m, wdb = mat("rail", (0.4, 0.24, 0.11), 0.42)
wn = wood_m.node_tree; wtc = wn.nodes.new("ShaderNodeTexCoord"); wmp = wn.nodes.new("ShaderNodeMapping"); wmp.inputs["Scale"].default_value = (0.4, 12, 12)
wz = wn.nodes.new("ShaderNodeTexNoise"); wz.inputs["Scale"].default_value = 6; wz.inputs["Detail"].default_value = 10
wr = wn.nodes.new("ShaderNodeValToRGB"); wr.color_ramp.elements[0].color = (0.1, 0.055, 0.03, 1); wr.color_ramp.elements[1].color = (0.24, 0.15, 0.08, 1)
wn.links.new(wtc.outputs["Object"], wmp.inputs[0]); wn.links.new(wmp.outputs[0], wz.inputs[0]); wn.links.new(wz.outputs[0], wr.inputs[0]); wn.links.new(wr.outputs[0], wdb.inputs["Base Color"])
bpy.ops.mesh.primitive_cube_add(size=1, location=(4, -0.03, 1.5)); r = bpy.context.object
r.scale = (16, 0.04, 0.16); r.data.materials.append(wood_m); bv = r.modifiers.new("b", "BEVEL"); bv.width = 0.008; bv.segments = 3

# ---- the pegs: black cast iron, a round boss, an arm angled up, a ball end
iron_m, _ = mat("iron", (0.05, 0.05, 0.055), 0.32, Metallic=1.0)
TILT = math.radians(18)
D = Vector((0, -math.cos(TILT), math.sin(TILT)))        # along the arm, away from the wall
N = Vector((0, math.sin(TILT), math.cos(TILT)))         # the arm's "up"
ARM_R, ARM_L = 0.0095, 0.15
def peg(x, collide=False):
    base = Vector((x, -0.05, 1.47))
    bpy.ops.mesh.primitive_cylinder_add(radius=0.024, depth=0.014, vertices=48, location=base + Vector((0, -0.006, 0)), rotation=(math.radians(90), 0, 0))
    b = bpy.context.object; b.data.materials.append(iron_m); m_ = b.modifiers.new("b", "BEVEL"); m_.width = 0.004; m_.segments = 3
    mid = base + D * (ARM_L / 2)
    bpy.ops.mesh.primitive_cylinder_add(radius=ARM_R, depth=ARM_L, vertices=32, location=mid, rotation=(math.radians(90) - TILT, 0, 0))
    arm = bpy.context.object; arm.data.materials.append(iron_m)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.017, segments=32, ring_count=16, location=base + D * ARM_L); k = bpy.context.object; k.data.materials.append(iron_m)
    for o in (arm, k): o.data.polygons.foreach_set("use_smooth", [True] * len(o.data.polygons))
    if collide:
        for o in (arm, k, b): o.modifiers.new("c", "COLLISION"); o.collision.thickness_outer = 0.003; o.collision.cloth_friction = 12
    return base

XS = [i * 0.42 for i in range(-3, 28)]
HX = XS[5]
for x in XS: peg(x, collide=(x == HX))
BASE = Vector((HX, -0.05, 1.47))

# ---- the scarf: a strip laid across its peg, then dropped (cloth sim) so both ends fall and fold
LEN, WID, NL, NW = 1.4, 0.22, 140, 16
PIN = 0.44                                  # where along its length the scarf rests on the peg
bm = bmesh.new(); uvl = bm.loops.layers.uv.new("UVMap")
grid = []
for i in range(NL + 1):
    v = i / NL; row = []
    for j in range(NW + 1):
        w = j / NW
        s = 0.008 + w * (ARM_L - 0.016)       # position along the arm
        p = BASE + D * s + N * (ARM_R + 0.004) + Vector(((v - PIN) * LEN, 0, 0))
        row.append(bm.verts.new(p))
    grid.append(row)
bm.verts.ensure_lookup_table()
for i in range(NL):
    for j in range(NW):
        f = bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
        for lp, (ii, jj) in zip(f.loops, ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))):
            lp[uvl].uv = (jj / NW, ii / NL)
me = bpy.data.meshes.new("scarf"); bm.to_mesh(me); bm.free()
me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
sf = bpy.data.objects.new("scarf", me); sc.collection.objects.link(sf)
pg = sf.vertex_groups.new(name="pin")
pin_idx = [i * (NW + 1) + j for i in range(NL + 1) for j in range(NW + 1) if abs(i / NL - PIN) * LEN < 0.022]
pg.add(pin_idx, 1.0, "REPLACE")
cl = sf.modifiers.new("cloth", "CLOTH"); cs = cl.settings
cs.quality = 10; cs.mass = 0.35; cs.air_damping = 2.5
cs.tension_stiffness = 10; cs.compression_stiffness = 10; cs.shear_stiffness = 4; cs.bending_stiffness = 0.35
cs.vertex_group_mass = "pin"
cl.collision_settings.distance_min = 0.004; cl.collision_settings.use_self_collision = True; cl.collision_settings.self_distance_min = 0.004
cl.point_cache.frame_start = 1; cl.point_cache.frame_end = 140
ctex = bpy.data.textures.new("lumps", "CLOUDS"); ctex.noise_scale = 0.09
dp = sf.modifiers.new("lumps", "DISPLACE"); dp.texture = ctex; dp.strength = 0.012; dp.mid_level = 0.5; dp.texture_coords = "GLOBAL"
so = sf.modifiers.new("t", "SOLIDIFY"); so.thickness = 0.007; so.offset = 0
ss = sf.modifiers.new("s", "SUBSURF"); ss.levels = 2; ss.render_levels = 2

km, kb = mat("knit", (0.5, 0.28, 0.025), 1.0, **{"Sheen Weight": 1.0, "Sheen Roughness": 0.35})
kn = km.node_tree; kl = kn.links
kuv = kn.nodes.new("ShaderNodeUVMap"); kuv.uv_map = "UVMap"
kmp = kn.nodes.new("ShaderNodeMapping"); kmp.inputs["Scale"].default_value = (19 / 12, (LEN / (WID / 19 * 0.82)) / 16, 1)
kim = kn.nodes.new("ShaderNodeTexImage"); kim.image = bpy.data.images.load(KNIT); kim.image.colorspace_settings.name = "Non-Color"; kim.interpolation = "Cubic"
kbp = kn.nodes.new("ShaderNodeBump"); kbp.inputs["Strength"].default_value = 1.0; kbp.inputs["Distance"].default_value = 0.005
heather = kn.nodes.new("ShaderNodeTexNoise"); heather.inputs["Scale"].default_value = 260; heather.inputs["Detail"].default_value = 4
hr = kn.nodes.new("ShaderNodeValToRGB"); hr.color_ramp.elements[0].color = (0.38, 0.2, 0.015, 1); hr.color_ramp.elements[1].color = (0.6, 0.36, 0.04, 1)
gap = kn.nodes.new("ShaderNodeValToRGB"); gap.color_ramp.elements[0].color = (0.22, 0.13, 0.05, 1); gap.color_ramp.elements[0].position = 0.08; gap.color_ramp.elements[1].position = 0.6; gap.color_ramp.elements[1].color = (1, 1, 1, 1)
mul = kn.nodes.new("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"; mul.inputs["Factor"].default_value = 1.0
kl.new(kuv.outputs[0], kmp.inputs[0]); kl.new(kmp.outputs[0], kim.inputs[0]); kl.new(kim.outputs[0], kbp.inputs["Height"]); kl.new(kbp.outputs[0], kb.inputs["Normal"])
kl.new(kmp.outputs[0], heather.inputs[0]); kl.new(heather.outputs[0], hr.inputs[0]); kl.new(kim.outputs[0], gap.inputs[0])
kl.new(hr.outputs[0], mul.inputs[6]); kl.new(gap.outputs[0], mul.inputs[7]); kl.new(mul.outputs[2], kb.inputs["Base Color"])
sf.data.materials.append(km)

sc.frame_start, sc.frame_end = 1, 140
for f in range(1, 141): sc.frame_set(f)

# fringe: tassels of loose yarn continuing from both ends of the settled scarf
dg = bpy.context.evaluated_depsgraph_get(); ev = sf.evaluated_get(dg)
# read the cloth result (before solidify) from a copy with only the cloth modifier
so.show_viewport = False; ss.show_viewport = False; dp.show_viewport = False; dg.update(); ev = sf.evaluated_get(dg)
vs = [ev.matrix_world @ v.co for v in ev.data.vertices]
so.show_viewport = True; ss.show_viewport = True; dp.show_viewport = True
yarn = bpy.data.materials.new("yarn"); yarn.use_nodes = True
yb = yarn.node_tree.nodes["Principled BSDF"]; yb.inputs["Base Color"].default_value = (0.42, 0.23, 0.02, 1); yb.inputs["Roughness"].default_value = 1.0
yb.inputs["Sheen Weight"].default_value = 1.0
for end, prev in ((0, 1), (NL, NL - 3)):
    for t in range(11):
        w = (t + 0.5) / 11 * NW; j0 = int(w); fr = w - j0; j1 = min(j0 + 1, NW)
        p = vs[end * (NW + 1) + j0].lerp(vs[end * (NW + 1) + j1], fr)
        q = vs[prev * (NW + 1) + j0].lerp(vs[prev * (NW + 1) + j1], fr)
        dirv = (p - q).normalized()
        for s_ in range(3):
            ln = random.uniform(0.065, 0.085)
            cu = bpy.data.curves.new("y", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 0.0024; cu.bevel_resolution = 2
            sp = cu.splines.new("NURBS"); sp.points.add(3)
            off = Vector((random.uniform(-0.004, 0.004), random.uniform(-0.004, 0.004), 0))
            for k in range(4):
                u = k / 3
                g = Vector((0, 0, -1)) * (u * u * 0.3)                # strands droop with gravity
                pt = p + off * (0.3 + u) + (dirv * (1 - u * 0.3) + g).normalized() * (ln * u) + Vector((random.uniform(-1, 1), random.uniform(-1, 1), 0)) * 0.003 * u
                sp.points[k].co = (*pt, 1)
            sp.order_u = 3; sp.use_endpoint_u = True
            o = bpy.data.objects.new("y", cu); sc.collection.objects.link(o); o.data.materials.append(yarn)

# ---- late sun through venetian blinds: a low warm sun, and slats set square to it so the stripes are clean
bpy.ops.object.light_add(type="SUN", location=(0, -5, 5)); sun = bpy.context.object
sun.data.energy = 7.5; sun.data.angle = math.radians(0.5); sun.data.color = (1.0, 0.72, 0.44)
sun.rotation_euler = (math.radians(64), 0, math.radians(-46))
dirv = sun.rotation_euler.to_matrix() @ Vector((0, 0, -1))
from mathutils import Matrix
h = dirv.cross(Vector((0, 0, 1))).normalized()
h = (Matrix.Rotation(math.radians(-14), 3, dirv) @ h).normalized()   # tip the slats so the stripes fall on a slant
u = h.cross(dirv).normalized()
C = Vector((HX + 0.2, 0, 1.15)) - dirv * 4.0
for k in range(-30, 31):
    bpy.ops.mesh.primitive_cube_add(size=1, location=C + u * (k * 0.1)); s_ = bpy.context.object
    s_.rotation_mode = "QUATERNION"; s_.rotation_quaternion = Matrix((h, u, dirv)).transposed().to_quaternion()
    s_.scale = (6, 0.03, 0.003); s_.visible_camera = False; s_.visible_glossy = False
# the room behind the camera: soft cool bounce
bpy.ops.object.light_add(type="AREA", location=(HX + 0.6, -3.0, 1.6)); fl = bpy.context.object
fl.data.size = 3.0; fl.data.energy = 45; fl.data.color = (0.8, 0.86, 1.0); fl.rotation_euler = (math.radians(90), 0, 0)
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.3, 0.3, 0.32, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.15

cd = bpy.data.cameras.new("c"); cd.lens = 50; cd.dof.use_dof = True; cd.dof.aperture_fstop = 2.4
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (HX - 1.25, -0.95, 1.28)
tgt = bpy.data.objects.new("t", None); sc.collection.objects.link(tgt); tgt.location = (HX + 0.12, -0.13, 1.1)
tr = cam.constraints.new("TRACK_TO"); tr.target = tgt; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
foc = bpy.data.objects.new("f", None); sc.collection.objects.link(foc); foc.location = BASE + D * 0.08 + Vector((0, 0, -0.15)); cd.dof.focus_object = foc

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True; cy.max_bounces = 8
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = 0.0
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
