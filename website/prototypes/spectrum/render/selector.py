# Micro-Review cover, "One conversation. One judgment.": a three-way selector on an instrument panel.
# The knob is a cut citrine in a knurled steel collar; its pointer rests on the open ring at six
# o'clock, so no choice has been made. The legend names the live demo's three choices (legend from selector_labels.py).
# Light: a broad softbox low on the far left grades the panel from light to shade and fills the
# facets; a small lamp low behind the knob shines through the stone; two tiny lamps make glints.
# usage: python selector.py TEX_DIR OUT.png [W H SPP]
# tuning (env, defaults are the published frame): EXPO FSTOP KEY KEYPOS KEYW BACK BACKPOS CONE GLINT SKY ROOM
#   PANEL DENS CG CB FOIL STEELR CAM TGT LENS
import math, sys, os
import bpy, bmesh, addon_utils
import numpy as np
from mathutils import Vector

a = sys.argv[1:]; TEX = os.path.abspath(a[0]); OUT = os.path.abspath(a[1])
W = int(a[2]) if len(a) > 2 else 900; H = int(a[3]) if len(a) > 3 else 1100; SPP = int(a[4]) if len(a) > 4 else 192
env = lambda k, d: os.environ.get(k, d)
vec = lambda k, d: Vector([float(v) for v in env(k, d).split(",")])
bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
sc = bpy.context.scene; MM = 0.001

def principled(name, col, rough=0.5, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]; p.inputs["Base Color"].default_value = (*col, 1); p.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): p.inputs[k].default_value = v
    return m, p

# ---- the knob: a cut citrine set in a knurled steel collar; millimetres, panel top at z = 0
def finish(bm, name, smooth):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = smooth
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); return o

# the collar, turned and knurled, with a pointer tab
SEG = 720; th = np.linspace(0, 2 * np.pi, SEG, endpoint=False)
knurl = 1 - 0.014 * np.abs(np.sin(36 * th)); one = np.ones_like(th)
prof = [(19.8, 0.05, one), (20.6, 0.6, knurl), (20.6, 3.2, knurl), (20.1, 3.8, one), (15.6, 4.3, one), (14.9, 4.3, one), (14.9, 3.4, one)]
bm = bmesh.new(); rings = [[bm.verts.new((r * m[k] * MM * math.cos(th[k]), r * m[k] * MM * math.sin(th[k]), z * MM)) for k in range(SEG)] for r, z, m in prof]
for A, B in zip(rings, rings[1:]):
    for k in range(SEG): bm.faces.new((A[k], A[(k + 1) % SEG], B[(k + 1) % SEG], B[k]))
c0 = bm.verts.new((0, 0, 0.05 * MM)); c1 = bm.verts.new((0, 0, 3.4 * MM))
for k in range(SEG): bm.faces.new((rings[0][(k + 1) % SEG], rings[0][k], c0)); bm.faces.new((rings[-1][k], rings[-1][(k + 1) % SEG], c1))
collar = finish(bm, "collar", True)
steel, sp = principled("satin steel", (0.78, 0.79, 0.81), float(env("STEELR", 0.22)), **{"Metallic": 1.0, "Anisotropic": 0.5})
collar.data.materials.append(steel)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -21.6 * MM, 2.0 * MM)); tab = bpy.context.object
tab.scale = (2.6 * MM, 4.2 * MM, 3.0 * MM); tab.data.materials.append(steel)
bv = tab.modifiers.new("b", "BEVEL"); bv.width = 0.35 * MM; bv.segments = 3
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -22.0 * MM, 3.52 * MM)); line = bpy.context.object
line.scale = (0.55 * MM, 4.4 * MM, 0.08 * MM)
em, _ = principled("enamel", (0.93, 0.93, 0.91), 0.35); line.data.materials.append(em)

# a foil seat under the stone, as rhinestones are backed: light that falls in comes back out
bpy.ops.mesh.primitive_cylinder_add(radius=14.85 * MM, depth=0.3 * MM, location=(0, 0, 3.5 * MM), vertices=128); seat = bpy.context.object
seat_m, _ = principled("foil seat", (0.96, 0.95, 0.92), float(env("FOIL", 0.04)), **{"Metallic": 1.0}); seat.data.materials.append(seat_m)

# the stone: twelve sides, a stepped crown and a flat table
N = 12; RG, ZG0, ZG, RM, ZM, RTB, ZTB = 14.2, 3.6, 12.8, 11.4, 16.6, 6.8, 19.4
ang = lambda k, off=0: 2 * math.pi * (k + off) / N + math.pi / N
bm = bmesh.new()
base = [bm.verts.new((RG * MM * math.cos(ang(k)), RG * MM * math.sin(ang(k)), ZG0 * MM)) for k in range(N)]
gird = [bm.verts.new((RG * MM * math.cos(ang(k)), RG * MM * math.sin(ang(k)), ZG * MM)) for k in range(N)]
mid = [bm.verts.new((RM * MM * math.cos(ang(k, 0.5)), RM * MM * math.sin(ang(k, 0.5)), ZM * MM)) for k in range(N)]
tbl = [bm.verts.new((RTB * MM * math.cos(ang(k)), RTB * MM * math.sin(ang(k)), ZTB * MM)) for k in range(N)]
for k in range(N):
    k1 = (k + 1) % N
    bm.faces.new((base[k], base[k1], gird[k1], gird[k]))
    bm.faces.new((gird[k], gird[k1], mid[k])); bm.faces.new((gird[k1], mid[k1], mid[k]))
    bm.faces.new((mid[k], mid[k1], tbl[k1])); bm.faces.new((mid[k], tbl[k1], tbl[k]))
bm.faces.new(tbl); bm.faces.new(base[::-1])
stone = finish(bm, "stone", False)
bv = stone.modifiers.new("b", "BEVEL"); bv.width = 0.18 * MM; bv.segments = 2; bv.harden_normals = True
cm = bpy.data.materials.new("citrine"); cm.use_nodes = True; t = cm.node_tree; n = t.nodes
cp = n["Principled BSDF"]; cp.inputs["Base Color"].default_value = (1.0, 0.82, 0.42, 1); cp.inputs["Roughness"].default_value = 0.0
cp.inputs["Transmission Weight"].default_value = 1.0; cp.inputs["IOR"].default_value = 1.55
va = n.new("ShaderNodeVolumeAbsorption"); va.inputs["Color"].default_value = (1.0, float(env("CG", 0.76)), float(env("CB", 0.18)), 1); va.inputs["Density"].default_value = float(env("DENS", 14))
t.links.new(va.outputs[0], n["Material Output"].inputs["Volume"])
stone.data.materials.append(cm)

# ---- the panel: powder-coated steel in misty blue with the screen-printed legend
PW, PHt = 1000 * MM, 1000 * MM
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0)); panel = bpy.context.object
panel.scale = (PW, PHt, 1); bpy.ops.object.transform_apply(scale=True)
uv = panel.data.uv_layers.active
for poly in panel.data.polygons:
    for li in poly.loop_indices:
        v = panel.data.vertices[panel.data.loops[li].vertex_index].co
        uv.data[li].uv = ((v.x / MM + 80) / 160, (v.y / MM + 80) / 200)       # legend: 160 x 200 mm, knob at (80, 120) from top left
PANEL = tuple(float(v) for v in env("PANEL", "0.2,0.25,0.38").split(","))
pm, pp = principled("powder coat", PANEL, 0.7)
t = pm.node_tree; n = t.nodes
img = n.new("ShaderNodeTexImage"); img.image = bpy.data.images.load(os.path.join(TEX, "legend.png")); img.extension = "EXTEND"; img.image.colorspace_settings.name = "Non-Color"; img.interpolation = "Cubic"
mix = n.new("ShaderNodeMix"); mix.data_type = "RGBA"
mix.inputs[6].default_value = (0.012, 0.013, 0.016, 1); mix.inputs[7].default_value = (*PANEL, 1)
t.links.new(img.outputs["Color"], mix.inputs[0]); t.links.new(mix.outputs[2], pp.inputs["Base Color"])
rmix = n.new("ShaderNodeMapRange"); rmix.inputs["To Min"].default_value = 0.45; rmix.inputs["To Max"].default_value = 0.72
t.links.new(img.outputs["Color"], rmix.inputs["Value"]); t.links.new(rmix.outputs["Result"], pp.inputs["Roughness"])
tc = n.new("ShaderNodeTexCoord"); nz = n.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 2200; nz.inputs["Detail"].default_value = 4
t.links.new(tc.outputs["Object"], nz.inputs[0])
bp = n.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.18; bp.inputs["Distance"].default_value = 0.00005
t.links.new(nz.outputs["Fac"], bp.inputs["Height"]); t.links.new(bp.outputs[0], pp.inputs["Normal"])
panel.data.materials.append(pm)

# ---- light
bpy.ops.object.light_add(type="AREA", location=tuple(vec("KEYPOS", "-0.18,0.12,0.10"))); key = bpy.context.object
key.data.shape = "RECTANGLE"; key.data.size = float(env("KEYW", 0.2)); key.data.size_y = 0.32; key.data.energy = float(env("KEY", 1.6)); key.data.color = (1.0, 0.98, 0.95)
key.rotation_mode = "QUATERNION"; key.rotation_quaternion = (Vector((0, 0, 0.01)) - key.location).to_track_quat("-Z", "Y")
bpy.ops.object.light_add(type="SPOT", location=tuple(vec("BACKPOS", "-0.02,0.07,0.014"))); back = bpy.context.object
back.data.energy = float(env("BACK", 1.5)); back.data.spot_size = math.radians(float(env("CONE", 10))); back.data.spot_blend = 0.6; back.data.shadow_soft_size = 0.004; back.data.color = (1.0, 0.95, 0.86)
back.rotation_mode = "QUATERNION"; back.rotation_quaternion = (Vector((0, 0, 0.008)) - back.location).to_track_quat("-Z", "Y")
# two small lamps that only show as glints in the facets
for loc, e in (((-0.09, -0.04, 0.16), 0.12), ((0.03, -0.12, 0.09), 0.08)):
    bpy.ops.object.light_add(type="AREA", location=loc); g = bpy.context.object; g.data.size = 0.012; g.data.energy = float(env("GLINT", 4.0)) * e
    g.rotation_mode = "QUATERNION"; g.rotation_quaternion = (Vector((0, 0, 0.012)) - g.location).to_track_quat("-Z", "Y")
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = tuple(float(v) for v in env("ROOM", "0.92,0.92,0.94").split(",")) + (1,); w.node_tree.nodes["Background"].inputs[1].default_value = float(env("SKY", 0.22))

cd = bpy.data.cameras.new("c"); cd.lens = float(env("LENS", 42)); cd.clip_start = 0.01
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = vec("CAM", "0.01,-0.075,0.135")
ct = bpy.data.objects.new("ct", None); sc.collection.objects.link(ct); ct.location = vec("TGT", "0.0,0.014,0.0")
tr = cam.constraints.new("TRACK_TO"); tr.target = ct; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
cd.dof.use_dof = True; cd.dof.focus_distance = (cam.location - Vector((0, 0.0, 0.01))).length; cd.dof.aperture_fstop = float(env("FSTOP", 8.0))

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.max_bounces = 16; cy.transmission_bounces = 16; cy.volume_bounces = 2; cy.caustics_refractive = True; cy.caustics_reflective = True; cy.blur_glossy = 0.5
cy.sample_clamp_indirect = 20
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = float(env("EXPO", -0.3))
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
