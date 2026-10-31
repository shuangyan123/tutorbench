# Shared helpers for the promo-film keyframes (Blender 5.2 bpy, Cycles). Units: metres, MM = 0.001.
import math, os, sys
import bpy, bmesh, addon_utils
from mathutils import Vector

MM = 0.001
HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.environ.get("FONTS", os.path.join(HERE, "fonts"))
env = lambda k, d: os.environ.get(k, d)
fenv = lambda k, d: float(env(k, d))
vec = lambda k, d: Vector([float(v) for v in env(k, d).split(",")])
lin = lambda c: tuple(((v / 255 + 0.055) / 1.055) ** 2.4 if v / 255 > 0.04045 else v / 255 / 12.92 for v in c)
hexc = lambda h: lin((int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)))


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
    return bpy.context.scene


def sc():
    return bpy.context.scene


def link(o):
    sc().collection.objects.link(o); return o


def principled(name, col, rough=0.5, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*col, 1); p.inputs["Roughness"].default_value = rough
    for k, v in kw.items(): p.inputs[k].default_value = v
    return m, p


def noise_bump(m, p, scale=800, strength=0.1, dist=0.0002, detail=6):
    t = m.node_tree; n = t.nodes
    tc = n.new("ShaderNodeTexCoord"); nz = n.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale; nz.inputs["Detail"].default_value = detail
    t.links.new(tc.outputs["Object"], nz.inputs[0])
    bp = n.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = strength; bp.inputs["Distance"].default_value = dist
    t.links.new(nz.outputs["Fac"], bp.inputs["Height"]); t.links.new(bp.outputs[0], p.inputs["Normal"])
    return nz


def image_mat(name, path, rough=0.6, bump=0.0, alpha=False, metallic=0.0, colorspace="sRGB", rough_map=None):
    """Material whose base colour is an image (UV mapped). Optional bump from the image luminance."""
    m, p = principled(name, (1, 1, 1), rough, Metallic=metallic)
    t = m.node_tree; n = t.nodes
    img = n.new("ShaderNodeTexImage"); img.image = bpy.data.images.load(path); img.interpolation = "Cubic"
    img.image.colorspace_settings.name = colorspace; img.extension = "EXTEND"
    t.links.new(img.outputs["Color"], p.inputs["Base Color"])
    if alpha:
        t.links.new(img.outputs["Alpha"], p.inputs["Alpha"])
    if bump:
        bw = n.new("ShaderNodeRGBToBW"); t.links.new(img.outputs["Color"], bw.inputs[0])
        bp = n.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = bump; bp.inputs["Distance"].default_value = 0.0003
        t.links.new(bw.outputs[0], bp.inputs["Height"]); t.links.new(bp.outputs[0], p.inputs["Normal"])
    return m, p, img


def glass(name, col=(1, 1, 1), ior=1.5, rough=0.0, absorb=None, dens=0.0):
    m, p = principled(name, col, rough, **{"Transmission Weight": 1.0, "IOR": ior})
    if absorb is not None:
        t = m.node_tree; va = t.nodes.new("ShaderNodeVolumeAbsorption")
        va.inputs["Color"].default_value = (*absorb, 1); va.inputs["Density"].default_value = dens
        t.links.new(va.outputs[0], t.nodes["Material Output"].inputs["Volume"])
    return m


def finish_bm(bm, name, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = smooth
    return link(bpy.data.objects.new(name, me))


def box(name, size, loc, mat=None, bevel=0.0, seg=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.object; o.name = name
    o.scale = size; bpy.ops.object.transform_apply(scale=True)
    if bevel:
        b = o.modifiers.new("b", "BEVEL"); b.width = bevel; b.segments = seg; b.harden_normals = True
        for poly in o.data.polygons: poly.use_smooth = True
    if mat: o.data.materials.append(mat)
    return o


def poly_curve(name, splines, bevel, mat, res=2, bevel_res=4, cyclic=False):
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"
    cu.bevel_depth = bevel; cu.bevel_resolution = bevel_res; cu.resolution_u = res; cu.use_fill_caps = True
    for pts in splines:
        sp = cu.splines.new("POLY"); sp.points.add(len(pts) - 1)
        for i, q in enumerate(pts):
            if len(q) == 4: sp.points[i].co = (q[0], q[1], q[2], 1); sp.points[i].radius = q[3]
            else: sp.points[i].co = (*q, 1)
        sp.use_cyclic_u = cyclic
    o = link(bpy.data.objects.new(name, cu)); cu.materials.append(mat)
    return o


def aim(o, target):
    o.rotation_mode = "QUATERNION"; o.rotation_quaternion = (Vector(target) - o.location).to_track_quat("-Z", "Y")


def area(loc, target, energy, size=0.3, size_y=None, col=(1, 1, 1), spread=180):
    bpy.ops.object.light_add(type="AREA", location=loc); l = bpy.context.object
    l.data.energy = energy; l.data.color = col
    if size_y: l.data.shape = "RECTANGLE"; l.data.size = size; l.data.size_y = size_y
    else: l.data.size = size
    l.data.spread = math.radians(spread)
    aim(l, target); return l


def spot(loc, target, energy, cone=20, blend=0.5, radius=0.01, col=(1, 1, 1)):
    bpy.ops.object.light_add(type="SPOT", location=loc); l = bpy.context.object
    l.data.energy = energy; l.data.spot_size = math.radians(cone); l.data.spot_blend = blend; l.data.shadow_soft_size = radius; l.data.color = col
    aim(l, target); return l


def world(col, strength):
    w = bpy.data.worlds.new("w"); sc().world = w; w.use_nodes = True
    bg = w.node_tree.nodes["Background"]; bg.inputs[0].default_value = (*col, 1); bg.inputs[1].default_value = strength
    return w


def camera(loc, target, lens=50, fstop=None, focus=None, shift=(0, 0)):
    cd = bpy.data.cameras.new("cam"); cd.lens = lens; cd.clip_start = 0.005; cd.shift_x, cd.shift_y = shift
    cam = link(bpy.data.objects.new("cam", cd)); sc().camera = cam; cam.location = loc
    ct = link(bpy.data.objects.new("ct", None)); ct.location = target
    tr = cam.constraints.new("TRACK_TO"); tr.target = ct; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
    if fstop:
        cd.dof.use_dof = True; cd.dof.aperture_fstop = fstop
        cd.dof.focus_distance = (Vector(loc) - Vector(focus if focus is not None else target)).length
    return cam


def sweep(name, col, width=4.0, depth=3.0, height=2.5, radius=0.6, z0=0.0, y_back=1.0, rough=0.85):
    """A photographer's paper sweep: floor running into a curved cove and up a back wall."""
    m, p = principled(name, col, rough)
    noise_bump(m, p, scale=300, strength=0.03)
    pts = []
    for i in range(0, 13):
        y = -depth + i * (depth - radius) / 12; pts.append((y, z0))
    for i in range(1, 17):
        a = -math.pi / 2 + i * (math.pi / 2) / 16
        pts.append((y_back - radius + radius * math.cos(a) + 0 * 1, z0 + radius + radius * math.sin(a)))
    pts.append((y_back, z0 + height))
    bm = bmesh.new()
    L = [bm.verts.new((-width / 2, y, z)) for y, z in pts]; R = [bm.verts.new((width / 2, y, z)) for y, z in pts]
    for i in range(len(pts) - 1): bm.faces.new((L[i], R[i], R[i + 1], L[i + 1]))
    o = finish_bm(bm, name, True); o.data.materials.append(m)
    return o, m, p


def render(out, w, h, spp, expo=0.0, look="AgX - Medium High Contrast", bounces=12, caustics=True, clamp=10):
    s = sc(); s.render.engine = "CYCLES"; cy = s.cycles
    dev = env("DEVICE", "CPU")
    if dev != "CPU":
        pr = bpy.context.preferences.addons["cycles"].preferences; pr.compute_device_type = dev; pr.get_devices()
        for d in pr.devices: d.use = True
        cy.device = "GPU"
    else:
        cy.device = "CPU"
    cy.samples = spp; cy.use_denoising = True; cy.use_adaptive_sampling = True
    cy.max_bounces = bounces; cy.transmission_bounces = bounces; cy.glossy_bounces = 8; cy.volume_bounces = 2
    cy.caustics_refractive = caustics; cy.caustics_reflective = caustics; cy.blur_glossy = 0.5; cy.sample_clamp_indirect = clamp
    s.render.resolution_x = w; s.render.resolution_y = h; s.render.resolution_percentage = 100
    s.view_settings.view_transform = "AgX"; s.view_settings.look = look; s.view_settings.exposure = expo
    s.render.image_settings.file_format = "PNG"; s.render.filepath = os.path.abspath(out)
    s.render.threads_mode = "AUTO"
    an = env("ANIM", "")
    if an:
        # animation: a driver module poses the scene for each frame; frames go to OUT as a directory
        import importlib.util
        spec = importlib.util.spec_from_file_location("animdrv", an); mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
        s.render.use_persistent_data = True
        os.makedirs(out, exist_ok=True)
        mod.setup()
        for f in range(int(env("F0", "0")), int(env("F1", "1")), int(env("FSTEP", "1"))):
            fp = os.path.join(os.path.abspath(out), "%04d.png" % f)
            if os.path.exists(fp) and env("SKIP", "1") == "1": continue
            mod.drive(f); bpy.context.view_layer.update()
            s.render.filepath = fp; bpy.ops.render.render(write_still=True)
        return
    bpy.ops.render.render(write_still=True)
