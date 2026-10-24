# Five cut gems (λ1–λ5) for the site, transparent background. Each stone has its own traditional
# cut, so they read as different stones and not one shape in five colours:
#   λ1 ruby       oval brilliant          λ2 citrine   pear brilliant
#   λ3 emerald    emerald (step) cut      λ4 sapphire  cushion brilliant
#   λ5 amethyst   trillion
# Fire: Cycles has no spectral dispersion, so each stone is rendered three times with the IOR for
# red, green and blue light, and the three channels are recombined (render with a PASS argument,
# then python3 gems.py --combine).
# usage: python gems.py OUT_PREFIX [SIZE SPP]            (renders every stone, all three passes)
#        python3 gems.py --combine OUT_PREFIX [SIZE]     (merges the passes into OUT_PREFIX{k}.png)
import math, sys, os

STONES = [
    # name, cut, body colour (absorption), IOR (green), dispersion (B-R), absorption density
    ("ruby", "oval", (0.95, 0.08, 0.16), 1.77, 0.018, 2.4),
    ("citrine", "pear", (1.0, 0.62, 0.12), 1.55, 0.013, 1.6),
    ("emerald", "step", (0.1, 0.72, 0.4), 1.58, 0.014, 1.5),
    ("sapphire", "cushion", (0.08, 0.22, 0.95), 1.77, 0.018, 2.6),
    ("amethyst", "trillion", (0.72, 0.28, 0.92), 1.55, 0.013, 1.4),
]

if sys.argv[1] == "--combine":
    from PIL import Image
    pre = os.path.abspath(sys.argv[2])
    for k in range(len(STONES)):
        ch = [Image.open(f"{pre}{k}_{c}.png").convert("RGBA") for c in "rgb"]
        r, _, _, a = ch[0].split(); _, g, _, a2 = ch[1].split(); _, _, b, a3 = ch[2].split()
        Image.merge("RGBA", (r, g, b, a2)).save(f"{pre}{k}.png")
    sys.exit()

import bpy, bmesh, addon_utils

a = sys.argv[1:]; OUT = os.path.abspath(a[0]); S = int(a[1]) if len(a) > 1 else 256; SPP = int(a[2]) if len(a) > 2 else 192

def outline(cut, t):
    """Girdle outline, t in [0, 1): a point on the stone's plan, longest axis along x."""
    th = 2 * math.pi * t; c, s = math.cos(th), math.sin(th)
    if cut == "oval": return 1.0 * c, 0.74 * s
    if cut == "pear": return 1.0 * c, 0.78 * s * math.sqrt((1 - c) / 2) ** 0.85 * 1.06
    if cut == "cushion":
        p = 0.55   # superellipse, a square with softened corners
        return math.copysign(abs(c) ** p, c) * 0.9, math.copysign(abs(s) ** p, s) * 0.9
    if cut == "trillion":   # triangle with gently curved sides
        k = (th + math.pi / 2) % (2 * math.pi / 3) - math.pi / 3
        r = 0.5 / math.cos(k) * (1 + 0.12 * math.cos(3 * k)) * 1.12
        r = min(r, 0.92)   # softly truncated points, as trillions are cut
        return r * math.cos(th + math.pi / 2), r * math.sin(th + math.pi / 2)
    raise ValueError(cut)

def brilliant(cut, n=16, h=0.3, d=0.86):
    if cut == "trillion": n = 12   # so the three points land on girdle vertices
    bm = bmesh.new(); N = 2 * n
    P = [outline(cut, i / N) for i in range(N)]
    def V(i, k, z): x, y = P[i % N]; return bm.verts.new((x * k, y * k, z))
    T = [V(2 * i, 0.56, h) for i in range(n)]           # table corners
    C = [V(2 * i + 1, 0.8, h * 0.55) for i in range(n)]  # star / bezel points
    GT = [V(i, 1.0, 0.018) for i in range(N)]; GB = [V(i, 1.0, -0.018) for i in range(N)]
    PV = [V(2 * i + 1, 0.48, -d * 0.48) for i in range(n)]
    cu = bm.verts.new((0, 0, -d))
    F = bm.faces.new
    F(T)
    for i in range(n):
        j = (i + 1) % n
        F((T[i], C[i], T[j]))
        F((T[i], C[i - 1], GT[2 * i])); F((T[i], GT[2 * i], C[i]))
        F((C[i], GT[2 * i], GT[2 * i + 1])); F((C[i], GT[2 * i + 1], GT[(2 * i + 2) % N]))
        F((GB[2 * i], GB[2 * i + 1], PV[i])); F((GB[2 * i + 1], GB[(2 * i + 2) % N], PV[i]))
        F((GB[2 * i], PV[i], cu)); F((GB[2 * i], cu, PV[i - 1]))
    for i in range(N):
        F((GT[i], GB[i], GB[(i + 1) % N], GT[(i + 1) % N]))
    return bm

def step(w=1.0, l=0.72, corner=0.2):
    """Emerald cut: a cut-corner rectangle, terraced in steps above and below, with a keel culet."""
    def ring(k, z, keel=False):
        cw, cl = w * k, l * k if not keel else 0.0
        cc = corner * k
        pts = [(cw, cl - cc), (cw - cc, cl), (-cw + cc, cl), (-cw, cl - cc), (-cw, -cl + cc), (-cw + cc, -cl), (cw - cc, -cl), (cw, -cl + cc)]
        if keel: pts = [(w * k * (1 if x > 0 else -1) * (1 if abs(x) > 0 else 0), 0) for x, _ in pts]
        return [bm.verts.new((x, y, z)) for x, y in pts]
    bm = bmesh.new()
    rings = [ring(0.6, 0.26), ring(0.8, 0.17), ring(0.93, 0.09), ring(1.0, 0.016), ring(1.0, -0.016),
             ring(0.78, -0.24), ring(0.55, -0.46), ring(0.32, -0.62)]
    bm.faces.new(rings[0])
    for A, B in zip(rings, rings[1:]):
        for i in range(8):
            bm.faces.new((A[i], B[i], B[(i + 1) % 8], A[(i + 1) % 8]))
    # keel: the last ring closes to a short ridge
    kl = rings[-1]; z = -0.7
    e1 = bm.verts.new((0.22, 0, z)); e2 = bm.verts.new((-0.22, 0, z))
    for i in range(8):
        x0 = kl[i].co.x; x1 = kl[(i + 1) % 8].co.x
        ea = e1 if x0 >= 0 else e2; eb = e1 if x1 >= 0 else e2
        bm.faces.new((kl[i], kl[(i + 1) % 8], eb) if ea is eb else (kl[i], kl[(i + 1) % 8], eb, ea))
    return bm

def stone(cut):
    bm = step() if cut == "step" else brilliant(cut)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(cut); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(cut, me); bpy.context.scene.collection.objects.link(o)
    return o

for k, (name, cut, col, ior, disp, dens) in enumerate(STONES):
    for ch, dI in zip("rgb", (-disp / 2, 0.0, disp / 2)):
        bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
        sc = bpy.context.scene
        o = stone(cut); o.rotation_euler = (0, 0, math.radians(-18))
        m = bpy.data.materials.new("g"); m.use_nodes = True; nt = m.node_tree; N_ = nt.nodes; N_.clear()
        out = N_.new("ShaderNodeOutputMaterial"); gl = N_.new("ShaderNodeBsdfGlass")
        gl.inputs["Color"].default_value = (1, 1, 1, 1); gl.inputs["Roughness"].default_value = 0.0; gl.inputs["IOR"].default_value = ior + dI
        va = N_.new("ShaderNodeVolumeAbsorption"); va.inputs["Color"].default_value = (*col, 1); va.inputs["Density"].default_value = dens
        nt.links.new(gl.outputs[0], out.inputs["Surface"]); nt.links.new(va.outputs[0], out.inputs["Volume"])
        o.data.materials.append(m)

        def area(loc, sx, sy, en, c=(1, 1, 1)):
            bpy.ops.object.light_add(type="AREA", location=loc); l = bpy.context.object
            l.data.shape = "RECTANGLE"; l.data.size = sx; l.data.size_y = sy; l.data.energy = en; l.data.color = c
            l.rotation_euler = (-l.location).to_track_quat("-Z", "Y").to_euler()
        # a jeweller's light box: one large soft key, a ring of small hard lights for the sparkle,
        # and a dark surround, so the facets break into bright and black (no milky plastic sheen)
        area((-1.8, 1.6, 3.6), 2.2, 1.4, 180)
        for i in range(10):
            a_ = 2 * math.pi * i / 10 + 0.2
            area((2.6 * math.cos(a_), 2.6 * math.sin(a_), 2.4 + 0.8 * (i % 2)), 0.18, 0.08, 55)
        w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
        wn = w.node_tree.nodes; wl = w.node_tree.links; bg = wn["Background"]; bg.inputs[1].default_value = 1.0
        tc = wn.new("ShaderNodeTexCoord"); sep = wn.new("ShaderNodeSeparateXYZ"); ramp = wn.new("ShaderNodeValToRGB")
        wl.new(tc.outputs["Generated"], sep.inputs[0]); wl.new(sep.outputs["Z"], ramp.inputs[0])
        cr = ramp.color_ramp; cr.elements[0].position = 0.42; cr.elements[0].color = (0.015, 0.016, 0.02, 1)
        cr.elements[1].position = 0.62; cr.elements[1].color = (0.5, 0.52, 0.56, 1)
        wl.new(ramp.outputs[0], bg.inputs[0])

        cd = bpy.data.cameras.new("c"); cd.type = "ORTHO"; cd.ortho_scale = 2.35
        cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
        cam.location = (0, -2.6, 5.4); cam.rotation_euler = (math.radians(26), 0, 0)
        sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
        cy.transmission_bounces = 24; cy.glossy_bounces = 16; cy.max_bounces = 32; cy.volume_bounces = 2
        cy.caustics_reflective = True; cy.caustics_refractive = True
        sc.render.film_transparent = True; cy.film_transparent_glass = False
        sc.render.resolution_x = S; sc.render.resolution_y = S
        sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - High Contrast"; sc.view_settings.exposure = 0.3
        sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
        sc.render.filepath = f"{OUT}{k}_{ch}.png"; bpy.ops.render.render(write_still=True)
