# Results cover, "No ranking without evidence": the back of an archive envelope, its flap closed
# with ruby sealing wax pressed with the Teachometry seal. The printed form on it carries only public
# facts (dataset cohort, benchmark version, no calibrated runs, not yet published). Light: one warm lamp raking in low from the upper left across the
# paper and the wax relief, on slate-blue bookcloth; a cool dim room fills the shadows.
# usage: python sealed.py TEX_DIR OUT.png [W H SPP]
# tuning (env, defaults are the published frame): EXPO FSTOP SKY LAMP POWER CONE CAM TGT LENS SEALROT
import math, sys, os, random
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

def mesh_from_grid(name, xs, ys, zf, keep=None, ext=None):
    """a grid mesh with heights from zf(x, y); faces kept only where keep(x, y) holds for a corner"""
    nx, ny = len(xs), len(ys)
    X, Y = np.meshgrid(xs, ys); Z = zf(X, Y)
    verts = np.stack([X, Y, Z], -1).reshape(-1, 3)
    faces = []
    K = keep(X, Y) if keep else np.ones_like(X, bool)
    for j in range(ny - 1):
        for i in range(nx - 1):
            if K[j, i] or K[j, i + 1] or K[j + 1, i] or K[j + 1, i + 1]:
                faces.append((j * nx + i, j * nx + i + 1, (j + 1) * nx + i + 1, (j + 1) * nx + i))
    me = bpy.data.meshes.new(name); me.from_pydata(verts.tolist(), [], faces); me.update()
    uv = me.uv_layers.new(name="UV")
    for poly in me.polygons:
        for li in poly.loop_indices:
            v = verts[me.loops[li].vertex_index]; x0, x1, y0, y1 = ext or (xs[0], xs[-1], ys[0], ys[-1]); uv.data[li].uv = ((v[0] - x0) / (x1 - x0), (v[1] - y0) / (y1 - y0))
    for poly in me.polygons: poly.use_smooth = True
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    return o

# ---- the envelope (C5, 229 x 162 mm), back up, a little fat with what is inside
EW, EH = 229 * MM, 162 * MM
TIP = EH / 2 - 0.6 * EH                       # the flap's point, y
_cr = np.random.default_rng(11); _ck = [(_cr.uniform(20, 60), _cr.uniform(20, 60), _cr.uniform(0, 6.3), _cr.uniform(0, 6.3)) for _ in range(5)]
def bulge(X, Y):
    fx = np.clip(1 - (2 * X / EW) ** 6, 0, 1); fy = np.clip(1 - (2 * Y / EH) ** 6, 0, 1)
    inside = np.clip(1 - np.maximum(np.abs(X) / (EW / 2 - 9 * MM), np.abs(Y) / (EH / 2 - 8 * MM)), 0, 1)
    sheet = 0.12 * MM * np.clip(inside * 6, 0, 1) ** 2                       # the folded letter inside
    cockle = sum(np.sin(X * kx + p) * np.sin(Y * ky + q) for kx, ky, p, q in _ck) * 0.06 * MM
    return 0.4 * MM + 1.6 * MM * fx * fy + sheet * fx * fy + cockle * fx * fy
xs = np.linspace(-EW / 2, EW / 2, 230); ys = np.linspace(-EH / 2, EH / 2, 164)
body = mesh_from_grid("envelope", xs, ys, bulge)
paper, pp = principled("paper", (0.8, 0.8, 0.8), 0.82, **{"Subsurface Weight": 0.12})
pp.inputs["Subsurface Radius"].default_value = (0.004, 0.004, 0.004)
t = paper.node_tree
tx = t.nodes.new("ShaderNodeTexImage"); tx.image = bpy.data.images.load(os.path.join(TEX, "envelope.png")); tx.interpolation = "Cubic"
t.links.new(tx.outputs["Color"], pp.inputs["Base Color"])
fib = t.nodes.new("ShaderNodeTexNoise"); fib.inputs["Scale"].default_value = 2600; fib.inputs["Detail"].default_value = 6
cock = t.nodes.new("ShaderNodeTexNoise"); cock.inputs["Scale"].default_value = 30; cock.inputs["Detail"].default_value = 2
tc = t.nodes.new("ShaderNodeTexCoord")
for n in (fib, cock): t.links.new(tc.outputs["Object"], n.inputs[0])
mix = t.nodes.new("ShaderNodeMath"); mix.operation = "MULTIPLY_ADD"; mix.inputs[1].default_value = 0.25
t.links.new(cock.outputs["Fac"], mix.inputs[0]); t.links.new(fib.outputs["Fac"], mix.inputs[2])
bm = t.nodes.new("ShaderNodeBump"); bm.inputs["Strength"].default_value = 0.08; bm.inputs["Distance"].default_value = 0.0004
t.links.new(mix.outputs[0], bm.inputs["Height"]); t.links.new(bm.outputs[0], pp.inputs["Normal"])
body.data.materials.append(paper)
# the paper edge: a thin skirt so the envelope has thickness against the cloth
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.2 * MM)); sk = bpy.context.object; sk.scale = (EW, EH, 0.4 * MM)
bpy.ops.object.transform_apply(scale=True); sk.data.materials.append(paper)

# the flap: a broad V with a rounded point, lying 0.3 mm proud of the body
def in_flap(X, Y):
    k = (EH / 2 - TIP) / (EW / 2)
    return Y >= TIP + k * np.abs(X) - 0.0 * MM
def flap_z(X, Y): return bulge(X, Y) + 0.3 * MM
flap = mesh_from_grid("flap", xs, ys[ys >= TIP - 2 * MM], flap_z, in_flap, (-EW / 2, EW / 2, -EH / 2, EH / 2))
# trim the flap cleanly along its edges: delete vertices outside the V
bpy.context.view_layer.objects.active = flap; flap.select_set(True)
bme = bmesh.new(); bme.from_mesh(flap.data)
k = (EH / 2 - TIP) / (EW / 2)
for v in bme.verts:
    edge_y = TIP + k * abs(v.co.x)
    if v.co.y < edge_y: v.co.y = edge_y          # pull stragglers onto the edge line
    v.co.z = float(flap_z(np.array(v.co.x), np.array(v.co.y)))
bme.to_mesh(flap.data); bme.free()
flap.data.materials.append(paper)
sd = flap.modifiers.new("t", "SOLIDIFY"); sd.thickness = 0.18 * MM; sd.offset = -1

# ---- the wax: a ruby puddle pressed with the seal (relief from the seal's own artwork)
_im = bpy.data.images.load(os.path.join(TEX, "seal_height.png")); SN = _im.size[0]
seal = np.array(_im.pixels[:], dtype=np.float32).reshape(_im.size[1], SN, 4)[::-1, :, 0]   # top row first
SC = (0.0, TIP + 6 * MM)                       # where it sits: over the flap's point
ROT = math.radians(float(env("SEALROT", 28)))   # how far the stamp was turned when pressed
RS = 14 * MM                                 # the seal face radius (the artwork's outer ring)
rng = np.random.default_rng(5); harm = [(n, rng.uniform(0.25, 0.9) / n, rng.uniform(0, 6.3)) for n in range(2, 9)]
def wax_z(X, Y):
    dx, dy = X - SC[0], Y - SC[1]; r = np.hypot(dx, dy); th = np.arctan2(dy, dx)
    redge = 18.5 * MM + sum(amp * np.cos(n * th + ph) for n, amp, ph in harm) * 1.6 * MM
    shoulder = np.clip((redge - r) / (2.6 * MM), 0, 1); shoulder = shoulder * shoulder * (3 - 2 * shoulder)
    z = 2.0 * MM * shoulder
    z += 0.55 * MM * np.exp(-((r - (RS + 1.1 * MM)) / (0.9 * MM)) ** 2) * shoulder        # the squeezed rim
    face = r < RS + 0.4 * MM
    ca, sa = math.cos(ROT), math.sin(ROT); sx, sy = ca * dx + sa * dy, -sa * dx + ca * dy     # turn the stamp to face the camera
    u = np.clip((sx / (RS * 1.02) + 1) / 2 * (SN - 1), 0, SN - 1).astype(int)
    v = np.clip((1 - (sy / (RS * 1.02) + 1) / 2) * (SN - 1), 0, SN - 1).astype(int)
    relief = seal[v, u]
    z = np.where(face, 1.55 * MM + 0.42 * MM * relief, z)
    return np.where(r < redge + 0.3 * MM, z + 0.5 * MM, -1.5 * MM) + bulge(X, Y)
wx = np.linspace(SC[0] - 24 * MM, SC[0] + 24 * MM, 560); wy = np.linspace(SC[1] - 24 * MM, SC[1] + 24 * MM, 560)
wax = mesh_from_grid("wax", wx, wy, wax_z)
wm, wp = principled("wax", (0.2, 0.004, 0.026), 0.34, **{"Subsurface Weight": 0.15, "Coat Weight": 0.12, "Coat Roughness": 0.25})
wp.inputs["Subsurface Radius"].default_value = (0.0016, 0.0003, 0.0003)
t = wm.node_tree; n = t.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 900
rr = t.nodes.new("ShaderNodeMapRange"); rr.inputs["To Min"].default_value = 0.22; rr.inputs["To Max"].default_value = 0.45
t.links.new(n.outputs["Fac"], rr.inputs["Value"]); t.links.new(rr.outputs["Result"], wp.inputs["Roughness"])
wax.data.materials.append(wm)

# ---- the bookcloth it lies on
cloth, cp = principled("bookcloth", (0.16, 0.2, 0.28), 0.88, **{"Sheen Weight": 0.3})
t = cloth.node_tree; tc = t.nodes.new("ShaderNodeTexCoord")
w1 = t.nodes.new("ShaderNodeTexWave"); w1.inputs["Scale"].default_value = 2400; w1.bands_direction = "X"; w1.inputs["Distortion"].default_value = 2
w2 = t.nodes.new("ShaderNodeTexWave"); w2.inputs["Scale"].default_value = 2400; w2.bands_direction = "Y"; w2.inputs["Distortion"].default_value = 2
nn = t.nodes.new("ShaderNodeTexNoise"); nn.inputs["Scale"].default_value = 180; nn.inputs["Detail"].default_value = 8
for x in (w1, w2, nn): t.links.new(tc.outputs["Object"], x.inputs[0])
mx = t.nodes.new("ShaderNodeMath"); mx.operation = "ADD"; t.links.new(w1.outputs["Fac"], mx.inputs[0]); t.links.new(w2.outputs["Fac"], mx.inputs[1])
bmp = t.nodes.new("ShaderNodeBump"); bmp.inputs["Strength"].default_value = 0.25; bmp.inputs["Distance"].default_value = 0.0003
t.links.new(mx.outputs[0], bmp.inputs["Height"]); t.links.new(bmp.outputs[0], cp.inputs["Normal"])
ramp = t.nodes.new("ShaderNodeValToRGB"); e = ramp.color_ramp.elements
e[0].color = (0.035, 0.055, 0.11, 1); e[1].color = (0.055, 0.085, 0.16, 1)
t.links.new(nn.outputs["Fac"], ramp.inputs[0]); t.links.new(ramp.outputs[0], cp.inputs["Base Color"])
bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, 0)); bpy.context.object.data.materials.append(cloth)

# ---- light: one warm lamp raking in from the upper left; the room is dim and cool
bpy.ops.object.light_add(type="SPOT", location=tuple(vec("LAMP", "-0.36,0.2,0.13"))); lamp = bpy.context.object
lamp.data.energy = float(env("POWER", 45)); lamp.data.spot_size = math.radians(float(env("CONE", 55))); lamp.data.spot_blend = 0.8
lamp.data.shadow_soft_size = 0.02; lamp.data.color = (1.0, 0.87, 0.72)
lamp.rotation_mode = "QUATERNION"; lamp.rotation_quaternion = (Vector((SC[0] + 0.01, SC[1], 0)) - lamp.location).to_track_quat("-Z", "Y")
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.42, 0.5, 0.68, 1); w.node_tree.nodes["Background"].inputs[1].default_value = float(env("SKY", 0.06))

cd = bpy.data.cameras.new("c"); cd.lens = float(env("LENS", 75)); cd.clip_start = 0.01
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = vec("CAM", "0.27,-0.21,0.40")
ct = bpy.data.objects.new("ct", None); sc.collection.objects.link(ct); ct.location = vec("TGT", "0.0,-0.035,0")
tr = cam.constraints.new("TRACK_TO"); tr.target = ct; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
cd.dof.use_dof = True; cd.dof.focus_distance = (cam.location - Vector((SC[0], SC[1], 0.004))).length; cd.dof.aperture_fstop = float(env("FSTOP", 4.0))

sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
cy.max_bounces = 8; cy.sample_clamp_indirect = 10
sc.render.resolution_x = W; sc.render.resolution_y = H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = float(env("EXPO", 0.0))
sc.render.image_settings.file_format = "PNG"; sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
