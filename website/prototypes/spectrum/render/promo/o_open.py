# Promo direction A, opening montage ("AI 解题的新闻，几乎每周都有"): three quick still-lifes for three
# headlines, in the film's brass-glass-paper world, each a picture of the problem and never a verdict.
#   unit   : Erdős unit distances: glass beads joined by brass rods all of one length (a Moser spindle)
#   vortex : Navier–Stokes: a ring of indigo ink turning in a glass tank of water
#   papers : 722 manuscripts: stacks of printed paper on the plinth
# usage: python o_open.py SHOT OUT.png [W H SPP]
import math, sys, os, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import *
from PIL import Image, ImageDraw, ImageFilter

a = sys.argv[1:]; SHOT = a[0]; OUT = os.path.abspath(a[1])
W = int(a[2]) if len(a) > 2 else 1280; H = int(a[3]) if len(a) > 3 else 720; SPP = int(a[4]) if len(a) > 4 else 128
TEX = os.path.join(os.path.dirname(OUT), "tex_o"); os.makedirs(TEX, exist_ok=True)
reset()
m3 = lambda x, y, z: (x * MM, y * MM, z * MM)
random.seed(4)

world(hexc("#c9d3ea"), fenv("SKY", 0.35))
sweep("sweep", hexc(env("BG", "#97a9dc")), width=3.0, depth=2.2, height=1.6, radius=0.45, z0=-0.034, y_back=0.55)
paint, pp = principled("plinth paint", hexc(env("PLINTH", "#8495c6")), 0.62); noise_bump(paint, pp, scale=900, strength=0.05)
box("plinth", (400 * MM, 260 * MM, 34 * MM), m3(0, 0, -17), paint, bevel=1.2 * MM)
brass, bp = principled("brass", hexc("#cf9f52"), 0.2, Metallic=1.0); noise_bump(brass, bp, scale=4000, strength=0.04)

def lights(target=(0, 0, 0.03)):
    area((-0.55, -0.45, 0.75), target, fenv("KEY", 30), size=0.9, size_y=0.6, col=(1.0, 0.97, 0.93), spread=fenv("SPREAD", 70))
    area((0.65, -0.35, 0.25), target, fenv("FILL", 5), size=0.8, col=(0.86, 0.9, 1.0))
    spot((0.45, 0.55, 0.55), target, fenv("RIM", 30), cone=30, blend=0.7, radius=0.05, col=(1.0, 0.85, 0.74))
    area((0.25, 0.25, 0.35), (0.35, 0.55, 0.5), fenv("GLOW", 25), size=0.5, col=(1.0, 0.72, 0.78))

if SHOT == "unit":
    U = 78.0                                              # the unit, mm
    # Moser spindle: two rhombi of equilateral triangles sharing a vertex, tips one unit apart
    alpha = 2 * math.asin(1 / (2 * math.sqrt(3)))
    def rhombus(rot):
        A = Vector((0, 0)); dirs = [rot - math.pi / 6, rot + math.pi / 6]
        P1 = A + Vector((math.cos(dirs[0]), math.sin(dirs[0]))) * U
        P2 = A + Vector((math.cos(dirs[1]), math.sin(dirs[1]))) * U
        T = A + Vector((math.cos(rot), math.sin(rot))) * U * math.sqrt(3)
        return P1, P2, T
    base = math.pi / 2 - alpha / 2
    a1, b1, t1 = rhombus(base); a2, b2, t2 = rhombus(base + alpha)
    O = Vector((0, 0))
    pts = [O, a1, b1, t1, a2, b2, t2]
    edges = [(0, 1), (0, 2), (1, 2), (1, 3), (2, 3), (0, 4), (0, 5), (4, 5), (4, 6), (5, 6), (3, 6)]
    cen = sum(pts, Vector((0, 0))) / len(pts)
    pts = [p - cen for p in pts]
    Z = 9.0
    beadm = glass("bead glass", (1, 1, 1), 1.52, 0.0, absorb=(0.8, 0.78, 1.0), dens=30)
    for p in pts:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=7.5 * MM, location=m3(p.x, p.y, Z), segments=64, ring_count=32)
        bpy.context.object.data.materials.append(beadm)
        for poly in bpy.context.object.data.polygons: poly.use_smooth = True
    rods = []
    for i, j in edges:
        p, q = pts[i], pts[j]; dv = (q - p).normalized()
        a_ = p + dv * 7.0; b_ = q - dv * 7.0
        rods.append([m3(a_.x, a_.y, Z), m3(b_.x, b_.y, Z)])
    poly_curve("rods", rods, 1.3 * MM, brass, bevel_res=3)
    lights((0, 0, 0.01))
    camera(tuple(vec("CAM", "-0.10,-0.34,0.24")), tuple(vec("TGT", "0.0,0.0,0.0")), lens=fenv("LENS", 50), fstop=fenv("FSTOP", 5.6), focus=m3(0, -30, Z))

elif SHOT == "vortex":
    # glass tank of clear water on the plinth, an ink vortex ring descending through it
    TW, TD, TH = 220.0, 140.0, 170.0
    gl = glass("tank glass", (1, 1, 1), 1.5, 0.0)
    water = glass("water", (1, 1, 1), 1.333, 0.0, absorb=(0.92, 0.96, 1.0), dens=0.8)
    th = 4.0
    for sx, sy, w_, d_ in ((0, -1, TW, th), (0, 1, TW, th), (-1, 0, th, TD), (1, 0, th, TD)):
        box("pane", (w_ * MM, d_ * MM, TH * MM), m3(sx * (TW - th) / 2, sy * (TD - th) / 2, TH / 2), gl, bevel=0.6 * MM)
    box("bottom", (TW * MM, TD * MM, th * MM), m3(0, 0, th / 2), gl, bevel=0.6 * MM)
    box("water", ((TW - 2 * th - 0.2) * MM, (TD - 2 * th - 0.2) * MM, (TH * 0.86) * MM), m3(0, 0, th + TH * 0.43), water)
    ink = bpy.data.materials.new("ink"); ink.use_nodes = True
    t = ink.node_tree; n = t.nodes
    n.remove(n["Principled BSDF"])
    pv = n.new("ShaderNodeVolumePrincipled"); pv.inputs["Color"].default_value = (*hexc("#3b2f8f"), 1)
    pv.inputs["Density"].default_value = fenv("INKD", 1500); pv.inputs["Absorption Color"].default_value = (*hexc("#4a3aa8"), 1)
    t.links.new(pv.outputs[0], n["Material Output"].inputs["Volume"])
    # vortex ring: a torus of ink whose density is broken up by noise, and a fainter wake rising to the surface
    RC, RT, ZC = 34.0, 13.0, 88.0
    def inkvol(name, obj, dens, scale, thresh):
        m = bpy.data.materials.new(name); m.use_nodes = True; t = m.node_tree; n = t.nodes
        n.remove(n["Principled BSDF"])
        pv = n.new("ShaderNodeVolumePrincipled"); pv.inputs["Color"].default_value = (*hexc("#3b2f8f"), 1)
        pv.inputs["Absorption Color"].default_value = (*hexc(env("INKC", "#8a7fd0")), 1)
        tc = n.new("ShaderNodeTexCoord"); nz = n.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = scale; nz.inputs["Detail"].default_value = 8; nz.inputs["Roughness"].default_value = 0.6
        t.links.new(tc.outputs["Object"], nz.inputs[0])
        mr = n.new("ShaderNodeMapRange"); mr.inputs["From Min"].default_value = thresh; mr.inputs["From Max"].default_value = 0.75; mr.inputs["To Max"].default_value = dens
        t.links.new(nz.outputs["Fac"], mr.inputs["Value"]); t.links.new(mr.outputs["Result"], pv.inputs["Density"])
        t.links.new(pv.outputs[0], n["Material Output"].inputs["Volume"])
        obj.data.materials.append(m)
    bpy.ops.mesh.primitive_torus_add(major_radius=RC * MM, minor_radius=RT * MM, major_segments=96, minor_segments=32, location=m3(0, 0, ZC))
    tor = bpy.context.object; tor.scale = (1, 1, 0.8)
    inkvol("ink", tor, fenv("INKD", 2500), fenv("INKS", 60), fenv("INKT", 0.42))
    bpy.ops.mesh.primitive_cone_add(radius1=RC * 0.9 * MM, radius2=6 * MM, depth=(TH * 0.86 - ZC - 4) * MM, location=m3(0, 0, ZC + (TH * 0.86 - ZC) / 2 + 2), vertices=64)
    wake = bpy.context.object
    inkvol("wake", wake, fenv("INKD", 2500) * 0.25, fenv("INKS", 60) * 0.6, 0.52)
    lights((0, 0, 0.08))
    area((0, 0.5, 0.15), (0, 0, 0.09), fenv("BACKL", 30), size=0.4, size_y=0.25, col=(1.0, 0.96, 0.95))
    camera(tuple(vec("CAM", "-0.12,-0.46,0.16")), tuple(vec("TGT", "0.0,0.0,0.085")), lens=fenv("LENS", 50), fstop=fenv("FSTOP", 5.6), focus=m3(0, -30, ZC))

else:
    # stacks of printed manuscripts; the pages carry only lines of grey text, never titles
    pg = Image.new("RGB", (850, 1100), (246, 247, 251)); d = ImageDraw.Draw(pg)
    y = 90
    d.rectangle([180, y, 670, y + 18], fill=(70, 72, 96)); y += 70
    d.rectangle([300, y, 550, y + 10], fill=(150, 152, 172)); y += 60
    while y < 1010:
        if random.random() < 0.12:
            d.rectangle([260, y + 6, 590, y + 16], fill=(90, 92, 116)); y += 46; continue
        x1 = 820 - 90 - (random.randint(0, 260) if random.random() < 0.15 else 0)
        d.rectangle([90, y, x1, y + 8], fill=(150, 152, 172)); y += 22
    pg.filter(ImageFilter.GaussianBlur(1.0)).save(os.path.join(TEX, "page.png"))
    side = Image.new("RGB", (64, 1024), (240, 241, 246)); d = ImageDraw.Draw(side)
    for yy in range(0, 1024, 3): d.line([(0, yy), (64, yy)], fill=(222, 224, 234) if random.random() < 0.5 else (232, 234, 242))
    side.save(os.path.join(TEX, "side.png"))
    sm, sp_, si = image_mat("pageedge", os.path.join(TEX, "side.png"), rough=0.9)
    pm, ppp, pi = image_mat("page", os.path.join(TEX, "page.png"), rough=0.85)
    stacks = [(-95, 10, 118, -4), (0, 25, 86, 3), (88, 0, 132, -7), (-30, -60, 46, 9), (60, -70, 64, -2)]
    for x, y, hgt, rot in stacks:
        n_ = max(3, int(hgt / 11)); hh = hgt / n_
        for r_ in range(n_):
            o = box("ream", (85 * MM, 110 * MM, (hh - 0.15) * MM), m3(x + random.uniform(-1.6, 1.6), y + random.uniform(-1.6, 1.6), hh * r_ + hh / 2), sm, bevel=0.5 * MM)
            o.rotation_euler = (0, 0, math.radians(rot + random.uniform(-1.4, 1.4)))
        # side texture via generated box projection
        bpy.ops.mesh.primitive_plane_add(size=1); top = bpy.context.object
        top.scale = (85 * MM, 110 * MM, 1); bpy.ops.object.transform_apply(scale=True)
        top.location = m3(x, y, hgt + 0.15); top.rotation_euler = (0, 0, math.radians(rot + random.uniform(-2, 2))); top.data.materials.append(pm)
    for mat_ in (sm,):
        t = mat_.node_tree; tc = t.nodes.new("ShaderNodeTexCoord"); img = [nd for nd in t.nodes if nd.type == "TEX_IMAGE"][0]
        img.projection = "BOX"; img.projection_blend = 0.1; img.extension = "REPEAT"
        mp = t.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (12, 12, 12)
        t.links.new(tc.outputs["Object"], mp.inputs[0]); t.links.new(mp.outputs[0], img.inputs[0])
    lights((0, 0, 0.05))
    camera(tuple(vec("CAM", "-0.16,-0.48,0.22")), tuple(vec("TGT", "0.0,0.0,0.05")), lens=fenv("LENS", 50), fstop=fenv("FSTOP", 4.0), focus=m3(-30, -60, 46))

render(OUT, W, H, SPP, expo=fenv("EXPO", -0.6))
