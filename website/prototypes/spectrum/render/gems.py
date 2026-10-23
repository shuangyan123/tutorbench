# Five cut gems (λ1–λ5) for the site, transparent background: ruby, citrine, emerald, sapphire,
# amethyst, one per dimension colour, all in the same round brilliant cut.
# usage: python gems.py OUT_PREFIX [SIZE SPP]
import bpy, bmesh, math, sys, os, addon_utils
from mathutils import Vector
a = sys.argv[1:]; OUT = os.path.abspath(a[0]); S = int(a[1]) if len(a) > 1 else 160; SPP = int(a[2]) if len(a) > 2 else 128
GLASS = [(1, .1, .1), (1, .55, .02), (.03, .62, .25), (.05, .2, 1), (.6, .14, 1)]
IOR = [1.76, 1.55, 1.57, 1.76, 1.54]   # ruby, citrine, emerald, sapphire, amethyst

def brilliant(n=16):
    # round brilliant, standard-ish proportions: table 57 %, crown 16 %, pavilion 43 % of diameter (2)
    bm = bmesh.new()
    def ring(r, z, off=0.0): return [bm.verts.new((r * math.cos(2 * math.pi * (i + off) / n), r * math.sin(2 * math.pi * (i + off) / n), z)) for i in range(n)]
    table = ring(0.57, 0.32); crown = ring(0.82, 0.18, 0.5); gt = ring(1.0, 0.02); gb = ring(1.0, -0.02); pav = ring(0.45, -0.5, 0.5)
    culet = bm.verts.new((0, 0, -0.86))
    bm.faces.new(table)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((table[i], crown[i], table[j]))            # star facets
        bm.faces.new((table[i], crown[(i - 1) % n], crown[i]))
        bm.faces.new((crown[i], gt[i], gt[j]))                    # upper girdle facets
        bm.faces.new((crown[(i - 1) % n], gt[i], crown[i]))
        bm.faces.new((gt[i], gb[i], gb[j], gt[j]))                # girdle
        bm.faces.new((gb[i], pav[i], gb[j]))                      # lower girdle facets
        bm.faces.new((gb[i], pav[(i - 1) % n], pav[i]))
        bm.faces.new((pav[(i - 1) % n], culet, pav[i]))           # pavilion mains
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("gem"); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("gem", me); bpy.context.scene.collection.objects.link(o)
    return o
for k, col in enumerate(GLASS):
    bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
    sc = bpy.context.scene
    o = brilliant(); o.rotation_euler = (0, 0, math.radians(11.25))
    m = bpy.data.materials.new("g"); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*(0.55 + 0.45 * c for c in col), 1)
    b.inputs["Transmission Weight"].default_value = 1.0; b.inputs["Roughness"].default_value = 0.0; b.inputs["IOR"].default_value = IOR[k]
    va = nt.nodes.new("ShaderNodeVolumeAbsorption"); va.inputs["Color"].default_value = (*col, 1); va.inputs["Density"].default_value = 2.2
    nt.links.new(va.outputs[0], nt.nodes["Material Output"].inputs["Volume"])
    o.data.materials.append(m)
    def area(loc, sx, sy, en, col=(1, 1, 1)):
        bpy.ops.object.light_add(type="AREA", location=loc); l = bpy.context.object
        l.data.shape = "RECTANGLE"; l.data.size = sx; l.data.size_y = sy; l.data.energy = en; l.data.color = col
        l.rotation_euler = (-l.location).to_track_quat("-Z", "Y").to_euler()
    area((-2.4, 2.2, 3.2), 1.6, 1.0, 260)              # key window, top left (the bead's catch-light)
    area((3.0, -1.0, 1.0), 0.4, 3.0, 90, (1, .9, .9))  # warm strip, right
    area((0, -3.2, -1.5), 3.0, 0.5, 40)                # low fill under the bead
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    # studio environment with a horizon, so the glass has something to bend: bright above, slate below
    wn = w.node_tree.nodes; wl = w.node_tree.links; bg = wn["Background"]; bg.inputs[1].default_value = 1.0
    tc = wn.new("ShaderNodeTexCoord"); sep = wn.new("ShaderNodeSeparateXYZ"); ramp = wn.new("ShaderNodeValToRGB")
    wl.new(tc.outputs["Generated"], sep.inputs[0]); wl.new(sep.outputs["Z"], ramp.inputs[0])
    cr = ramp.color_ramp; cr.elements[0].position = 0.34; cr.elements[0].color = (0.22, 0.24, 0.33, 1)
    cr.elements[1].position = 0.5; cr.elements[1].color = (0.95, 0.96, 1.0, 1)
    wl.new(ramp.outputs[0], bg.inputs[0])
    # a ring of small softboxes overhead: a cut stone's fire is many small lights broken up by its facets
    for i in range(8):
        a_ = 2 * math.pi * i / 8 + 0.3
        area((2.2 * math.cos(a_), 2.2 * math.sin(a_), 3.0 + 0.6 * (i % 2)), 0.35, 0.12, 70)
    # and a dim card underneath, so the body colour still glows a little
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, -1.4)); fl = bpy.context.object; fl.visible_camera = False
    em = bpy.data.materials.new("e"); em.use_nodes = True; eb = em.node_tree.nodes["Principled BSDF"]
    eb.inputs["Emission Color"].default_value = (1, 1, 1, 1); eb.inputs["Emission Strength"].default_value = 0.45
    fl.data.materials.append(em)
    cd = bpy.data.cameras.new("c"); cd.type = "ORTHO"; cd.ortho_scale = 2.5
    c = bpy.data.objects.new("c", cd); sc.collection.objects.link(c); sc.camera = c; c.location = (0, -3.0, 5.2); c.rotation_euler = (math.radians(30), 0, 0)
    sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
    cy.transmission_bounces = 16; cy.max_bounces = 24; cy.volume_bounces = 2
    sc.render.film_transparent = True; cy.film_transparent_glass = False
    sc.render.resolution_x = S; sc.render.resolution_y = S
    sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
    sc.render.filepath = f"{OUT}{k}.png"; bpy.ops.render.render(write_still=True)
