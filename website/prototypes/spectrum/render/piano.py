# Journal cover, "Arrogance Is Not What You Need": an upright piano with its fallboard closed over the
# keys and an open score on the music desk, in soft daylight through a sheer curtain off to the left.
# The essay opens with Newton's tapping study: the tapper hears the whole tune, the listener only
# knocks. Here the tune is printed on the page; through the closed lid there would be only knocks.
# A few faint fingertip marks on the lacquer, where someone has been tapping.
# The camera stands at the treble end, a little above the keys: the black lid mirrors the curtain's folds
# in the upper panel and the score's lower half in the fallboard, where the fingertip marks blur it.
# usage: TEX_DIR=<dir> python piano.py OUT.png [W H SPP]   (textures from piano_tex.py <dir>)
#        the cover is 900 x 1100 at 192 spp, then render/photo_finish.py into assets/journal/piano.webp
# tuning (env): EXPO SUN CURTAIN PAPER WORLD LENS FSTOP FOCUS CAMX CAMY CAMZ TX TY TZ
import math, os, random, sys
import bpy, bmesh, addon_utils
from mathutils import Vector

a = sys.argv[1:]; OUT = os.path.abspath(a[0])
W = int(a[1]) if len(a) > 1 else 900; H = int(a[2]) if len(a) > 2 else 1100; SPP = int(a[3]) if len(a) > 3 else 192
E = os.environ.get
TEX = os.path.abspath(E("TEX_DIR", "."))
EXPO = float(E("EXPO", -0.65)); SUN = float(E("SUN", 1.0)); CURTAIN = float(E("CURTAIN", 1.0)); PAPER = float(E("PAPER", 0.8))
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene; rnd = random.Random(5)


def principled(name, col, rough=.5, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): b.inputs[k].default_value = v
    return m, b


def obj(name, bm, m, smooth=False):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    o.data.materials.append(m)
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
    return o


def box(name, x0, x1, y0, y1, z0, z1, m, bevel=0.0, segs=3):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = x0 if v.co.x < 0 else x1; v.co.y = y0 if v.co.y < 0 else y1; v.co.z = z0 if v.co.z < 0 else z1
    o = obj(name, bm, m)
    if bevel > 0:
        md = o.modifiers.new("b", "BEVEL"); md.width = bevel; md.segments = segs; md.limit_method = "ANGLE"
        o.modifiers.new("w", "WEIGHTED_NORMAL"); [setattr(p, "use_smooth", True) for p in o.data.polygons]
    return o


def profile_extrude(name, pts, x0, x1, m, sharp=(), segs=32):
    """extrude a closed (y, z) profile along x, in short segments so the smooth normals stay local;
    the end caps and the profile corners listed in `sharp` keep hard edges"""
    bm = bmesh.new(); n = len(pts)
    rings = [[bm.verts.new((x0 + (x1 - x0) * k / segs, y, z)) for y, z in pts] for k in range(segs + 1)]
    for k in range(segs):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]))
    caps = [bm.faces.new(list(reversed(rings[0]))), bm.faces.new(rings[-1])]
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces: f.smooth = f not in caps
    for f in caps:
        for e in f.edges: e.smooth = False
    for i in sharp:
        for k in range(segs):
            e = bm.edges.get((rings[k][i], rings[k + 1][i]))
            if e: e.smooth = False
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); o.data.materials.append(m)
    return o


# ---------------------------------------------------------------- materials
# black piano lacquer: a deep base under a hard clear coat; the fallboard's coat carries the fingertip marks
# (the base layer's own specular is off, so all the reflection comes from the coat and stays crisp)
lac, lb = principled("lacquer", (0.005, 0.005, 0.006), 0.3, **{"Specular IOR Level": 0.0, "Coat Weight": 1.0, "Coat Roughness": 0.012, "Coat IOR": 1.52})
fall, fb = principled("fallboard", (0.005, 0.005, 0.006), 0.3, **{"Specular IOR Level": 0.0, "Coat Weight": 1.0, "Coat IOR": 1.52})
nt = fall.node_tree
img = bpy.data.images.load(os.path.join(TEX, "smudge.png")); img.colorspace_settings.name = "Non-Color"
tx = nt.nodes.new("ShaderNodeTexImage"); tx.image = img
mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs[3].default_value = 0.012; mr.inputs[4].default_value = 0.34
nt.links.new(tx.outputs["Color"], mr.inputs[0]); nt.links.new(mr.outputs[0], fb.inputs["Coat Roughness"])



def paper_mat(name, file):
    m, b = principled(name, (1, 1, 1), 0.62, **{"Sheen Weight": 0.15})
    nt_ = m.node_tree
    t = nt_.nodes.new("ShaderNodeTexImage"); t.image = bpy.data.images.load(os.path.join(TEX, file))
    # printed paper is not a perfect white: ~0.8 albedo, very slightly warm
    mul = nt_.nodes.new("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"; mul.inputs[0].default_value = 1.0
    mul.inputs[7].default_value = (PAPER, PAPER * 0.985, PAPER * 0.95, 1)
    nt_.links.new(t.outputs["Color"], mul.inputs[6]); nt_.links.new(mul.outputs[2], b.inputs["Base Color"])
    # a sheet lit from the front lets a little light through
    b.inputs["Subsurface Weight"].default_value = 0.04
    return m


back_paper, _ = principled("paper_back", (0.8 * PAPER, 0.8 * PAPER * 0.985, 0.8 * PAPER * 0.95), 0.62, **{"Sheen Weight": 0.15})
wall, _ = principled("wall", (0.30, 0.32, 0.37), 0.9)
ceiling, _ = principled("ceiling", (0.45, 0.45, 0.46), 0.9)
floor, flb = principled("floor", (0.15, 0.095, 0.06), 0.4)

# ---------------------------------------------------------------- the piano (x along the keys, y into the case, z up)
KX = 0.62            # half the keyboard width
AX = 0.74            # outer face of the arms
# key slip (its felt strip is hidden under the closed fallboard)
box("keyslip", -KX, KX, -0.012, 0.012, 0.648, 0.712, lac, bevel=0.004)
# the closed fallboard: a rounded nose over the key fronts, then a board sloping up to the music desk
nose_r = 0.024; ny, nz = 0.012, 0.742
slope = math.radians(17); L_ = 0.18
top1 = (ny + L_ * math.cos(slope), nz + nose_r + L_ * math.sin(slope))
pts = [(ny + 0.03, nz - nose_r)]
for k in range(0, 19):
    t = math.radians(-90 - k * 10)
    pts.append((ny + nose_r * math.cos(t), nz + nose_r * math.sin(t)))
pts += [top1, (top1[0], top1[1] - 0.022)]
fob = profile_extrude("fallboard", pts, -KX + 0.002, KX - 0.002, fall, sharp=(0, len(pts) - 2, len(pts) - 1))
# uv for the smudge map: x across, along-slope down the board
me = fob.data; uvl = me.uv_layers.new(name="UV")
for poly in me.polygons:
    for li in poly.loop_indices:
        v = me.vertices[me.loops[li].vertex_index].co
        uvl.data[li].uv = ((v.x + KX) / (2 * KX), (v.y - ny + 0.03) / (L_ + 0.06))
# the arms (cheeks) at each end of the keyboard, rounded at the front
for s in (-1, 1):
    x0, x1 = sorted((s * KX, s * AX))
    box(f"arm{s}", x0, x1, -0.05, 0.30, 0.60, 0.80, lac, bevel=0.018, segs=6)
# upper front panel, the music desk ledge, the lid
PY = top1[0] + 0.012
box("panel", -AX, AX, PY, PY + 0.03, top1[1] - 0.03, 1.26, lac, bevel=0.003)
box("panel_frame_l", -AX, -AX + 0.05, PY - 0.012, PY, top1[1], 1.26, lac, bevel=0.004)
box("panel_frame_r", AX - 0.05, AX, PY - 0.012, PY, top1[1], 1.26, lac, bevel=0.004)
DZ = top1[1] + 0.03
box("desk", -0.42, 0.42, PY - 0.055, PY, DZ - 0.012, DZ, lac, bevel=0.003)
box("desk_lip", -0.42, 0.42, PY - 0.058, PY - 0.048, DZ, DZ + 0.018, lac, bevel=0.003)
box("lid", -AX - 0.01, AX + 0.01, PY - 0.03, PY + 0.6, 1.26, 1.29, lac, bevel=0.004)
box("case", -AX, AX, PY + 0.03, PY + 0.6, 0.0, 1.26, lac)
box("lowerpanel", -KX, KX, 0.11, 0.13, 0.04, 0.648, lac, bevel=0.003)
box("keybed", -KX, KX, -0.012, 0.13, 0.62, 0.648, lac)

# ---------------------------------------------------------------- the open score, leaning on the panel
def page(name, file, side):
    w, h = 0.21, 0.297; nx, ny_ = 14, 6
    bm = bmesh.new(); vs = []
    for j in range(ny_ + 1):
        row = []
        for i in range(nx + 1):
            u = i / nx; v = j / ny_
            x = side * u * w
            # pages rise from the spine and flatten towards the edge
            depth = -0.012 * math.sin(math.pi * min(1, u * 1.6)) * (1 - 0.25 * v) + 0.004 * u
            row.append(bm.verts.new((x, depth, v * h)))
        vs.append(row)
    uv = bm.loops.layers.uv.new("UV")
    for j in range(ny_):
        for i in range(nx):
            q = [vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]]
            if side < 0: q = q[::-1]
            f = bm.faces.new(q)
            for lp in f.loops:
                co = lp.vert.co
                lp[uv].uv = ((co.x / w) if side > 0 else 1 + co.x / w, co.z / h)
    o = obj(name, bm, paper_mat(name + "_m", file), smooth=True)
    # the back of each sheet is blank paper (the lacquer panel behind the desk mirrors it)
    o.data.materials.append(back_paper)
    sd = o.modifiers.new("t", "SOLIDIFY"); sd.thickness = 0.0006; sd.material_offset = 1; sd.material_offset_rim = 1
    return o


lean = math.radians(9)
for nm, f, s in (("score_l", "score_l.png", -1), ("score_r", "score_r.png", 1)):
    o = page(nm, f, s)
    o.location = (0.03, PY - 0.044, DZ + 0.002); o.rotation_euler = (lean, 0, 0)

# ---------------------------------------------------------------- the room
box("floor", -4, 4, -4, 1.2, -0.02, 0.0, floor)
box("backwall", -4, 4, PY + 0.62, PY + 0.66, 0, 3, wall)
box("frontwall", -4, 4, -3.2, -3.16, 0, 3, wall)
box("rightwall", 2.4, 2.44, -4, 1.2, 0, 3, wall)
box("ceiling", -4, 4, -4, 1.2, 2.7, 2.74, ceiling)

# the window wall on the left: a sheer curtain glowing with daylight, in soft folds
cur, cb = principled("curtain", (1, 1, 1), 1.0)
cn = cur.node_tree; out = cn.nodes["Material Output"]
em = cn.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (1.0, 0.975, 0.94, 1)
wave = cn.nodes.new("ShaderNodeTexWave"); wave.wave_type = "BANDS"; wave.bands_direction = "Y"
wave.inputs["Scale"].default_value = 3.2; wave.inputs["Distortion"].default_value = 0.35; wave.inputs["Detail"].default_value = 0.0
crr = cn.nodes.new("ShaderNodeMapRange"); crr.inputs[3].default_value = 2.2 * CURTAIN; crr.inputs[4].default_value = 3.6 * CURTAIN
cn.links.new(wave.outputs["Fac"], crr.inputs[0]); cn.links.new(crr.outputs[0], em.inputs["Strength"])
cn.links.new(em.outputs[0], out.inputs["Surface"])
bm = bmesh.new(); grid = []
CX = -1.55; NY, NZ = 90, 2
for j in range(NZ + 1):
    row = []
    for i in range(NY + 1):
        y = -2.6 + 3.4 * i / NY
        row.append(bm.verts.new((CX + 0.035 * math.sin(y * 19) + 0.015 * math.sin(y * 7.3), y, 0.25 + 2.3 * j / NZ)))
    grid.append(row)
for j in range(NZ):
    for i in range(NY):
        bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
co = obj("curtain", bm, cur, smooth=True)
co.visible_shadow = False
box("windowwall", -1.62, -1.58, -4, 1.2, 0, 3, wall)

# daylight through the curtain: a large soft source at the window, warm-neutral
bpy.ops.object.light_add(type="AREA", location=(CX + 0.08, -0.7, 1.45))
L1 = bpy.context.object; L1.data.shape = "RECTANGLE"; L1.data.size = 2.6; L1.data.size_y = 1.9
L1.data.energy = 520 * SUN; L1.data.color = (1.0, 0.95, 0.89)
L1.rotation_euler = (0, math.radians(-90), 0)
L1.visible_glossy = False   # in the lacquer you see the curtain's folds, not a flat lamp
# the room's own bounce
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.62, 0.66, 0.74, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = float(E("WORLD", 0.02))

# ---------------------------------------------------------------- camera
cam = bpy.data.cameras.new("cam"); cam.lens = float(E("LENS", 37.5)); cam.sensor_fit = "VERTICAL"; cam.sensor_height = 24
cam.dof.use_dof = True; cam.dof.aperture_fstop = float(E("FSTOP", 8))
c = bpy.data.objects.new("cam", cam); sc.collection.objects.link(c); sc.camera = c
c.location = (float(E("CAMX", 0.55)), float(E("CAMY", -0.80)), float(E("CAMZ", 1.20)))
target = Vector((float(E("TX", 0.0)), float(E("TY", 0.10)), float(E("TZ", 0.935))))
c.rotation_euler = (target - c.location).to_track_quat("-Z", "Y").to_euler()
# focus between the score and the fingertip marks on the lid (FOCUS 0 = score, 1 = marks)
ft = float(E("FOCUS", 0.4))
fpt = Vector((0.0, PY - 0.04, DZ + 0.13)).lerp(Vector((0.12, 0.06, 0.78)), ft)
cam.dof.focus_distance = (fpt - c.location).length

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.max_bounces = 8; cy.glossy_bounces = 4
sc.render.resolution_x = W; sc.render.resolution_y = H; sc.render.resolution_percentage = 100
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = EXPO
sc.render.filepath = OUT; sc.render.image_settings.file_format = "PNG"
bpy.ops.render.render(write_still=True)
print("wrote", OUT)
