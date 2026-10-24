# Cases cover, "48 teaching situations. One benchmark.": a card-catalogue drawer pulled out of its
# cabinet. Forty-eight index cards on the brass rod, five pressboard guides (the five subjects), a
# follower block holding them up, most of the drawer still empty. One card stands proud of the
# others: fraction-misconception-001, typed as published. Low morning sun from the front left
# through a window (a wall with one opening, a mullion and a transom); a cool sky fills the shadows.
# usage: python catalogue.py TEX_DIR OUT.png [W H SPP]
# tuning (env, defaults are the published frame): EXPO FSTOP SUN SKY TINT STACK LIFT SUNDIR CROSS CAM TGT LENS
import math, sys, os, random
import bpy, addon_utils
from mathutils import Vector

a = sys.argv[1:]; TEX = os.path.abspath(a[0]); OUT = os.path.abspath(a[1])
W = int(a[2]) if len(a) > 2 else 900; H = int(a[3]) if len(a) > 3 else 1100; SPP = int(a[4]) if len(a) > 4 else 192
EXPO = float(os.environ.get("EXPO", -0.6)); FSTOP = float(os.environ.get("FSTOP", 4.0))
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene; rnd = random.Random(7)

def mat(name, col, rough=0.5, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): b.inputs[k].default_value = v
    return m, b

def oak(name, tint=1.0, scale=(1, 1, 1)):
    """quarter-sawn oak: fine streaked grain stretched along the board, low contrast, a satin coat"""
    m, b = mat(name, (0.5, 0.35, 0.2), 0.5); t = m.node_tree
    tc = t.nodes.new("ShaderNodeTexCoord"); mp = t.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = scale
    t.links.new(tc.outputs["Object"], mp.inputs[0])
    g1 = t.nodes.new("ShaderNodeTexNoise"); g1.inputs["Scale"].default_value = 14; g1.inputs["Detail"].default_value = 10; g1.inputs["Roughness"].default_value = 0.62
    g2 = t.nodes.new("ShaderNodeTexNoise"); g2.inputs["Scale"].default_value = 90; g2.inputs["Detail"].default_value = 4
    t.links.new(mp.outputs[0], g1.inputs[0]); t.links.new(mp.outputs[0], g2.inputs[0])
    mx = t.nodes.new("ShaderNodeMix"); mx.data_type = "FLOAT"; mx.inputs["Factor"].default_value = 0.35
    t.links.new(g1.outputs["Fac"], mx.inputs[2]); t.links.new(g2.outputs["Fac"], mx.inputs[3])
    rp = t.nodes.new("ShaderNodeValToRGB"); e = rp.color_ramp.elements
    e[0].position = 0.36; e[0].color = (0.33 * tint, 0.2 * tint, 0.1 * tint, 1); e[1].position = 0.64; e[1].color = (0.56 * tint, 0.38 * tint, 0.21 * tint, 1)
    t.links.new(mx.outputs[0], rp.inputs[0]); t.links.new(rp.outputs[0], b.inputs["Base Color"])
    bm = t.nodes.new("ShaderNodeBump"); bm.inputs["Strength"].default_value = 0.05; t.links.new(mx.outputs[0], bm.inputs["Height"]); t.links.new(bm.outputs[0], b.inputs["Normal"])
    b.inputs["Coat Weight"].default_value = 0.3; b.inputs["Coat Roughness"].default_value = 0.25
    return m

def box(name, lo, hi, m, bevel=0.0008):
    c = [(lo[i] + hi[i]) / 2 for i in range(3)]; s = [hi[i] - lo[i] for i in range(3)]
    bpy.ops.mesh.primitive_cube_add(size=1, location=c); o = bpy.context.object; o.name = name; o.scale = s
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(m)
    if bevel: bv = o.modifiers.new("b", "BEVEL"); bv.width = bevel; bv.segments = 2
    return o

def card_mat(path, rough=0.7):
    m = bpy.data.materials.new(os.path.basename(path)); m.use_nodes = True; t = m.node_tree
    pr = t.nodes["Principled BSDF"]; pr.inputs["Roughness"].default_value = rough
    pr.inputs["Subsurface Weight"].default_value = 0.08; pr.inputs["Subsurface Radius"].default_value = (0.002, 0.002, 0.002)
    tx = t.nodes.new("ShaderNodeTexImage"); tx.image = bpy.data.images.load(path); tx.interpolation = "Cubic"
    t.links.new(tx.outputs["Color"], pr.inputs["Base Color"]); t.links.new(tx.outputs["Alpha"], pr.inputs["Alpha"])
    return m

# ---- the drawer: oak, 134 mm inside, 330 mm deep, pulled out of the cabinet
TINT = float(os.environ.get("TINT", 0.72))
OAK = oak("oak", TINT, (1, 30, 30)); OAK2 = oak("oak2", TINT * 0.92, (30, 1, 30))
IW, IL, SH = 0.134, 0.33, 0.052
box("bottom", (-IW / 2 - 0.008, -0.002, -0.008), (IW / 2 + 0.008, IL, 0.0), OAK2)
box("sideL", (-IW / 2 - 0.008, -0.002, 0.0), (-IW / 2, IL, SH), OAK2)
box("sideR", (IW / 2, -0.002, 0.0), (IW / 2 + 0.008, IL, SH), OAK2)
box("back", (-IW / 2, IL - 0.008, 0.0), (IW / 2, IL, SH), OAK)
box("front", (-0.076, -0.016, -0.01), (0.076, -0.002, 0.083), OAK, 0.0015)
brass, _ = mat("brass", (0.78, 0.6, 0.32), 0.28, Metallic=1.0)
# label holder and pull on the drawer front
box("holder", (-0.026, -0.0172, 0.05), (0.026, -0.016, 0.068), brass, 0.0006)           # backplate
for lo, hi in (((-0.026, -0.0186, 0.05), (0.026, -0.0172, 0.0515)), ((-0.026, -0.0186, 0.0665), (0.026, -0.0172, 0.068)),
               ((-0.026, -0.0186, 0.05), (-0.0245, -0.0172, 0.068)), ((0.0245, -0.0186, 0.05), (0.026, -0.0172, 0.068))):
    box("lip", lo, hi, brass, 0.0003)                                                     # the frame that holds the label
lab, _ = mat("label", (0.9, 0.89, 0.85), 0.8)
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -0.0175, 0.059), rotation=(math.radians(90), 0, 0))
lc = bpy.context.object; lc.scale = (0.046, 0.014, 1)
bpy.ops.mesh.primitive_torus_add(major_radius=0.012, minor_radius=0.0026, location=(0, -0.024, 0.028), rotation=(math.radians(90), 0, 0))
pull = bpy.context.object; pull.scale = (1, 0.55, 1); pull.data.materials.append(brass)
# the rod, through every card, with its knurled nut at the front
bpy.ops.mesh.primitive_cylinder_add(radius=0.0021, depth=IL + 0.02, location=(0, IL / 2 - 0.01, 0.006), rotation=(math.radians(90), 0, 0))
bpy.context.object.data.materials.append(brass)
bpy.ops.mesh.primitive_cylinder_add(radius=0.006, depth=0.008, vertices=12, location=(0, -0.022, 0.006), rotation=(math.radians(90), 0, 0))
bpy.context.object.data.materials.append(brass)

# ---- the cards: five guides, forty-eight cards, leaning back a little against the follower
CW, CH, LEAN = 0.127, 0.076, math.radians(7)
blanks = [card_mat(os.path.join(TEX, f"blank{k}.png")) for k in range(4)]
featured = card_mat(os.path.join(TEX, "featured.png"))
lc.data.materials.append(card_mat(os.path.join(TEX, "label.png"), 0.8))
guides = [card_mat(os.path.join(TEX, f"guide{k}.png"), 0.85) for k in range(5)]
def card(y, m, h=CH, lift=0.0, thick=0.00028, jitter=0.0):
    bpy.ops.mesh.primitive_plane_add(size=1); o = bpy.context.object; o.scale = (CW, h, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    lean = LEAN + jitter
    o.rotation_euler = (math.radians(90) - lean, 0, rnd.uniform(-0.004, 0.004))
    o.location = (rnd.uniform(-0.0006, 0.0006), y + math.sin(lean) * (h / 2 + lift), math.cos(lean) * (h / 2) + lift)
    sd = o.modifiers.new("s", "SOLIDIFY"); sd.thickness = thick; sd.offset = 0
    o.data.materials.append(m); return o
GROUPS = [18, 6, 6, 10, 8]              # mathematics, history or social studies, language, programming, science
y = float(os.environ.get("STACK", 0.03)); n = 0
for g, count in enumerate(GROUPS):
    card(y, guides[g], CH + 0.012, thick=0.0007); y += 0.0012
    for k in range(count):
        is_feat = g == 0 and k == 2          # fraction-misconception-001: third card behind the mathematics guide
        card(y, featured if is_feat else blanks[rnd.randrange(4)], lift=float(os.environ.get("LIFT", 0.058)) if is_feat else 0.0, jitter=rnd.uniform(-0.004, 0.004))
        y += 0.00042 + rnd.uniform(0, 0.00018); n += 1
assert n == 48
# the follower block holds the stack up; it rides the rod
FB = y + 0.0045
blk = box("follower", (-IW / 2 + 0.003, FB, 0.0), (IW / 2 - 0.003, FB + 0.026, 0.05), OAK, 0.0015)
blk.rotation_euler = (-LEAN * 0.6, 0, 0)

# ---- the cabinet the drawer came out of: a grid of fronts, one slot open
CAB_Y = 0.255
dark, _ = mat("inside", (0.03, 0.022, 0.016), 0.8)
box("carcass", (-0.41, CAB_Y + 0.014, -0.13), (0.41, 0.7, 0.42), dark, 0)
for col in (-2, -1, 0, 1, 2):
    for row in range(-1, 4):
        if col == 0 and row == 0: continue
        x0 = col * 0.155; z0 = -0.01 + row * 0.097
        box(f"f{col}{row}", (x0 - 0.075, CAB_Y, z0), (x0 + 0.075, CAB_Y + 0.014, z0 + 0.093), OAK, 0.0015)
        box(f"h{col}{row}", (x0 - 0.026, CAB_Y - 0.0025, z0 + 0.06), (x0 + 0.026, CAB_Y, z0 + 0.078), brass, 0.0006)
        box(f"l{col}{row}", (x0 - 0.023, CAB_Y - 0.0013, z0 + 0.062), (x0 + 0.023, CAB_Y - 0.0007, z0 + 0.076), lab, 0)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.012, minor_radius=0.0026, location=(x0, CAB_Y - 0.008, z0 + 0.038), rotation=(math.radians(90), 0, 0))
        p = bpy.context.object; p.scale = (1, 0.55, 1); p.data.materials.append(brass)
# the slot frame around the open drawer
box("rail", (-0.41, CAB_Y, -0.022), (0.41, CAB_Y + 0.014, -0.012), OAK, 0.001)
# the floor it stands on
fl, _ = mat("floor", (0.32, 0.31, 0.3), 0.7)
bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, -0.13)); bpy.context.object.data.materials.append(fl)
# the room behind: a plaster wall, mostly out of the sun
pl, _ = mat("plaster", (0.62, 0.62, 0.6), 0.9)
box("wall", (-2, 0.72, -0.13), (2, 0.74, 1.5), pl, 0)

# ---- light: low morning sun from the left through a window (its cross bar casts the shadow)
bpy.ops.object.light_add(type="SUN"); sun = bpy.context.object
sun.data.energy = float(os.environ.get("SUN", 11.0)); sun.data.angle = math.radians(0.5); sun.data.color = (1.0, 0.975, 0.95)
d = Vector([float(v) for v in os.environ.get("SUNDIR", "0.75,0.55,-0.55").split(",")]).normalized()                 # the direction the light travels
sun.rotation_mode = "QUATERNION"; sun.rotation_quaternion = d.to_track_quat("-Z", "Y")
# the window: a wall with one opening, a mullion and a transom. It only casts shadow (camera, diffuse
# and gloss rays pass through it), so the sun lands as a pane-shaped patch and the sky still fills.
bar, _ = mat("bar", (0.1, 0.1, 0.1), 0.9)
dh = Vector((d.x, d.y, 0)).normalized(); U = dh.cross(Vector((0, 0, 1))).normalized(); V = Vector((0, 0, 1))
X = Vector([float(v) for v in os.environ.get("CROSS", "-0.075,0.03,0.035").split(",")])     # where the cross's shadow lands
C = X - d * (0.9 / max(0.2, -d.z) * 0.6)                                                  # the cross itself, up-sun
N = U.cross(V)
def slab(cu, cv, su, sv):
    bpy.ops.mesh.primitive_cube_add(size=1); o = bpy.context.object; o.scale = (su, sv, 0.02)
    o.rotation_mode = "QUATERNION"
    from mathutils import Matrix
    o.rotation_quaternion = Matrix((U, V, N)).transposed().to_quaternion()
    o.location = C + U * cu + V * cv; o.data.materials.append(bar)
    o.visible_camera = False; o.visible_diffuse = False; o.visible_glossy = False; o.visible_transmission = False
L0, L1, B0, B1, MW = -0.16, 0.34, -0.3, 0.22, 0.028        # the opening, measured from the cross; bar width
slab(0, 0, MW, B1 - B0)                                          # mullion
slab(0, 0, L1 - L0, MW)                                          # transom
slab(L0 - 1.0, 0, 2.0, 6.0); slab(L1 + 1.0, 0, 2.0, 6.0)         # wall left and right of the opening
slab((L0 + L1) / 2, B1 + 1.0, L1 - L0, 2.0); slab((L0 + L1) / 2, B0 - 1.0, L1 - L0, 2.0)
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.63, 0.8, 1); w.node_tree.nodes["Background"].inputs[1].default_value = float(os.environ.get("SKY", 0.22))

cd = bpy.data.cameras.new("c"); cd.lens = float(os.environ.get("LENS", 48)); cd.clip_start = 0.01
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = Vector([float(v) for v in os.environ.get("CAM", "0.15,-0.18,0.30").split(",")])
ct = bpy.data.objects.new("ct", None); sc.collection.objects.link(ct); ct.location = [float(v) for v in os.environ.get("TGT", "0,0.085,0.055").split(",")]
tr = cam.constraints.new("TRACK_TO"); tr.target = ct; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
cd.dof.use_dof = True; cd.dof.focus_distance = (cam.location - Vector((0, y - 0.015, 0.09))).length; cd.dof.aperture_fstop = FSTOP

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.max_bounces = 10; cy.sample_clamp_indirect = 10
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = EXPO
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
