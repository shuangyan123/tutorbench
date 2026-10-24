# Community cover, "Different perspectives. Stronger evidence.": three pairs of reading glasses, each
# somebody else's (black acetate, thin gold wire, tortoiseshell), on one printed review card for a
# public case. The standing pair magnifies the student's message; the five dimension boxes on the
# card are still empty. Card texture from perspectives_tex.py.
# usage: python perspectives.py TEX_DIR OUT.png [W H SPP]
# tuning (env): EXPO FSTOP KEY KEYPOS KEYS FILL SKY CAM TGT LENS FOCUS LINEN APOS ATILT AROT BPOS BROT CPOS CROT CARDPOS CARDROT RF
# published frame (900 x 1100, 224 spp, then photo_finish 0.1 1.6 86 0.9 -> assets/community/glasses.webp):
#   CARDPOS=0.0,0.01,0.0002 APOS=0.0,0.012,0.0255 KEYS=0.15 KEYPOS=-0.45,0.35,0.25 KEY=8 FOCUS=0,0.012,0.02
#   CAM=0.0,-0.19,0.25 TGT=0.0,0.03,0.0 LENS=45 BPOS=-0.075,0.095,0.0108 CPOS=0.065,-0.072,0.0118 CROT=20
import math, sys, os
import bpy, bmesh, addon_utils
from mathutils import Vector, Euler

a = sys.argv[1:]; TEX = os.path.abspath(a[0]); OUT = os.path.abspath(a[1])
W = int(a[2]) if len(a) > 2 else 900; H = int(a[3]) if len(a) > 3 else 1100; SPP = int(a[4]) if len(a) > 4 else 256
env = lambda k, d: os.environ.get(k, d)
vec = lambda k, d: Vector([float(v) for v in env(k, d).split(",")])
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene; MM = 0.001

def principled(name, col=(1, 1, 1), rough=0.5, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]; p.inputs["Base Color"].default_value = (*col, 1); p.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): p.inputs[k].default_value = v
    return m, p

def revolve(name, prof, seg=128, smooth=True):
    """a closed lathe mesh around local z from an (r, z) loop in mm; points on the axis become poles"""
    bm = bmesh.new(); rings = []
    for r, z in prof:
        if r <= 1e-6: rings.append([bm.verts.new((0, 0, z * MM))])
        else: rings.append([bm.verts.new((r * MM * math.cos(2 * math.pi * k / seg), r * MM * math.sin(2 * math.pi * k / seg), z * MM)) for k in range(seg)])
    for A, B in zip(rings, rings[1:] + rings[:1]):
        if len(A) == 1 and len(B) == 1: continue
        for k in range(seg):
            if len(A) == 1: bm.faces.new((A[0], B[k], B[(k + 1) % seg]))
            elif len(B) == 1: bm.faces.new((A[k], A[(k + 1) % seg], B[0]))
            else: bm.faces.new((A[k], A[(k + 1) % seg], B[(k + 1) % seg], B[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = smooth
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); return o

def tube(name, pts, radius, mat, parent):
    """a round bar along points (mm, in the parent's frame)"""
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = radius * MM; cu.bevel_resolution = 6; cu.use_fill_caps = True
    sp = cu.splines.new("NURBS"); sp.points.add(len(pts) - 1)
    for p, c in zip(sp.points, pts): p.co = (c[0] * MM, c[1] * MM, c[2] * MM, 1)
    sp.use_endpoint_u = True; sp.order_u = min(4, len(pts))
    o = bpy.data.objects.new(name, cu); sc.collection.objects.link(o); o.data.materials.append(mat); o.parent = parent; return o

def rounded_rect(r0, r1, z0, z1, c=0.7, n=4):
    pts = []
    for (cx, cz, a0) in ((r1 - c, z0 + c, -90), (r1 - c, z1 - c, 0), (r0 + c, z1 - c, 90), (r0 + c, z0 + c, 180)):
        for k in range(n + 1):
            t = math.radians(a0 + 90 * k / n); pts.append((cx + c * math.cos(t), cz + c * math.sin(t)))
    return pts

# ---- materials
lens_m, lp = principled("lens", (1, 1, 1), 0.0, **{"Transmission Weight": 1.0, "IOR": 1.5})
try:
    lp.inputs["Thin Film Thickness"].default_value = 320.0; lp.inputs["Thin Film IOR"].default_value = 1.38   # anti-reflective coating
except KeyError:
    pass
acetate_m, _ = principled("black acetate", (0.012, 0.012, 0.014), 0.22, **{"Coat Weight": 0.8, "Coat Roughness": 0.05})
gold_m, _ = principled("gold wire", (0.83, 0.66, 0.38), 0.22, **{"Metallic": 1.0})
tort = bpy.data.materials.new("tortoiseshell"); tort.use_nodes = True; N = tort.node_tree.nodes; Lk = tort.node_tree.links
tp = N["Principled BSDF"]; tp.inputs["Roughness"].default_value = 0.18; tp.inputs["Coat Weight"].default_value = 0.9
tp.inputs["Subsurface Weight"].default_value = 0.3; tp.inputs["Subsurface Radius"].default_value = (2.0, 1.0, 0.4)
noi = N.new("ShaderNodeTexNoise"); noi.inputs["Scale"].default_value = 140.0; noi.inputs["Detail"].default_value = 6.0; noi.inputs["Distortion"].default_value = 3.0
ramp = N.new("ShaderNodeValToRGB"); ramp.color_ramp.elements[0].position = 0.42; ramp.color_ramp.elements[0].color = (0.04, 0.012, 0.004, 1)
ramp.color_ramp.elements[1].position = 0.62; ramp.color_ramp.elements[1].color = (0.62, 0.3, 0.07, 1)
Lk.new(noi.outputs["Fac"], ramp.inputs[0]); Lk.new(ramp.outputs[0], tp.inputs["Base Color"]); Lk.new(ramp.outputs[0], tp.inputs["Subsurface Radius"])
pad_m, _ = principled("nose pad", (0.95, 0.95, 0.95), 0.1, **{"Transmission Weight": 0.8})

# ---- a pair of glasses in its own frame: lens axes along y (the wearer at +y), x across, z up
LA, RF, TE = 21.0, float(os.environ.get("RF", 110)), 1.2   # lens radius, front curvature, edge thickness (mm): about +4.5 D
def lens_profile():
    pts = [(0.0, 0.0)] + [(LA * k / 12, 0.0) for k in range(1, 13)] + [(LA, TE)]
    zc = lambda r: TE + math.sqrt(RF * RF - r * r) - math.sqrt(RF * RF - LA * LA)
    pts += [(LA * (1 - k / 24), zc(LA * (1 - k / 24))) for k in range(1, 24)] + [(0.0, zc(0.0))]
    return pts

def glasses(name, style, open_=True):
    root = bpy.data.objects.new(name, None); sc.collection.objects.link(root)
    frame_m = {"acetate": acetate_m, "wire": gold_m, "tortoise": tort}[style]
    cx = LA + (8.5 if style != "wire" else 7.0)
    for s in (-1, 1):
        L = revolve(f"{name}-lens", lens_profile()); L.data.materials.append(lens_m)
        L.rotation_euler = (math.radians(90), 0, 0); L.location = (s * cx * MM, 0, 0); L.parent = root
        if style == "wire":
            rim = revolve(f"{name}-rim", [(LA + 0.45 + 0.65 * math.cos(2 * math.pi * k / 16), 0.8 + 0.65 * math.sin(2 * math.pi * k / 16)) for k in range(16)], seg=128)
        else:
            rim = revolve(f"{name}-rim", rounded_rect(LA - 0.6, LA + 2.5, -1.2, 3.8, c=0.9), seg=128)
        rim.data.materials.append(frame_m); rim.rotation_euler = (math.radians(90), 0, 0); rim.location = (s * cx * MM, 0, 0); rim.parent = root
    hw = cx - LA - (0.6 if style == "wire" else 2.6)
    tube(f"{name}-bridge", [(-hw, -1, 8), (-hw * 0.5, -1.5, 13), (hw * 0.5, -1.5, 13), (hw, -1, 8)], 0.8 if style == "wire" else 1.9, frame_m, root)
    if style == "wire":
        tube(f"{name}-brow", [(-hw - 2, -1, 15), (0, -1.6, 16.5), (hw + 2, -1, 15)], 0.6, frame_m, root)
    hx = cx + LA + (1.0 if style == "wire" else 3.0); r = 0.7 if style == "wire" else 1.5
    for s in (-1, 1):
        if open_:   # temples back and down to the table, ear bends at the end
            pts = [(s * hx, 0.5, 4), (s * (hx + 2), 30, 1), (s * (hx + 4), 100, -12), (s * (hx + 4), 118, -18), (s * (hx + 3), 128, -26)]
        else:       # folded behind the lenses, one over the other
            zz = 2 if s < 0 else 5
            pts = [(s * hx, 3, zz), (s * (hx - 8), 9, zz), (s * (hx - 60), 10, zz), (s * (hx - 120), 9, zz), (s * (hx - 128), 6, zz)]
        tube(f"{name}-temple", pts, r, frame_m, root)
    return root

A = glasses("acetate", "acetate", open_=True)
A.location = vec("APOS", "0.0,-0.035,0.0255"); A.rotation_euler = Euler((math.radians(float(env("ATILT", -8))), 0, math.radians(float(env("AROT", -6)))))
B = glasses("wire", "wire", open_=False)
B.location = vec("BPOS", "-0.06,0.05,0.004"); B.rotation_euler = Euler((math.radians(-88), 0, math.radians(float(env("BROT", 160)))))
C = glasses("tortoise", "tortoise", open_=False)
C.location = vec("CPOS", "0.085,-0.02,0.006"); C.rotation_euler = Euler((math.radians(-86), 0, math.radians(float(env("CROT", 28)))))

# ---- the card on a linen cloth
cm, cp = principled("card", rough=0.85)
t = cm.node_tree.nodes.new("ShaderNodeTexImage"); t.image = bpy.data.images.load(os.path.join(TEX, "card.png")); t.extension = "CLIP"
cm.node_tree.links.new(t.outputs[0], cp.inputs["Base Color"])
bpy.ops.mesh.primitive_plane_add(size=1, location=tuple(vec("CARDPOS", "0.0,0.03,0.0002"))); card = bpy.context.object; card.scale = (0.18, 0.12, 1); card.data.materials.append(cm)
card.rotation_euler = (0, 0, math.radians(float(env("CARDROT", 2))))
lm = bpy.data.materials.new("linen"); lm.use_nodes = True; N = lm.node_tree.nodes; Lk = lm.node_tree.links; lpz = N["Principled BSDF"]
lpz.inputs["Base Color"].default_value = (*[float(v) for v in env("LINEN", "0.6,0.65,0.74").split(",")], 1); lpz.inputs["Roughness"].default_value = 0.9
lpz.inputs["Sheen Weight"].default_value = 0.4
wv = N.new("ShaderNodeTexWave"); wv.inputs["Scale"].default_value = 900.0; wv.inputs["Distortion"].default_value = 2.0; wv.inputs["Detail"].default_value = 3.0
bp = N.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.12; Lk.new(wv.outputs["Fac"], bp.inputs["Height"]); Lk.new(bp.outputs[0], lpz.inputs["Normal"])
bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, 0)); bpy.context.object.data.materials.append(lm)

# ---- light: a soft window high on the left, a cool fill from the right
bpy.ops.object.light_add(type="AREA", location=tuple(vec("KEYPOS", "-0.5,0.25,0.45"))); key = bpy.context.object
key.data.shape = "DISK"; key.data.size = float(env("KEYS", 0.35)); key.data.energy = float(env("KEY", 5)); key.data.color = (1.0, 0.97, 0.92)
key.rotation_mode = "QUATERNION"; key.rotation_quaternion = (Vector((0, 0, 0)) - key.location).to_track_quat("-Z", "Y")
bpy.ops.object.light_add(type="AREA", location=(0.5, -0.35, 0.3)); fill = bpy.context.object
fill.data.size = 0.8; fill.data.energy = float(env("FILL", 1.5)); fill.data.color = (0.88, 0.92, 1.0)
fill.rotation_mode = "QUATERNION"; fill.rotation_quaternion = (Vector((0, 0, 0)) - fill.location).to_track_quat("-Z", "Y")
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.8, 0.84, 0.92, 1); w.node_tree.nodes["Background"].inputs[1].default_value = float(env("SKY", 0.25))

cd = bpy.data.cameras.new("c"); cd.lens = float(env("LENS", 70)); cd.clip_start = 0.01
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = vec("CAM", "0.0,-0.30,0.11")
ct = bpy.data.objects.new("ct", None); sc.collection.objects.link(ct); ct.location = vec("TGT", "0.0,0.0,0.02")
tr = cam.constraints.new("TRACK_TO"); tr.target = ct; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
cd.dof.use_dof = True; cd.dof.focus_distance = (cam.location - vec("FOCUS", "0.0,-0.035,0.025")).length; cd.dof.aperture_fstop = float(env("FSTOP", 5.6))

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.max_bounces = 16; cy.transmission_bounces = 16; cy.glossy_bounces = 8; cy.sample_clamp_indirect = 20
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = float(env("EXPO", 0.0))
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
