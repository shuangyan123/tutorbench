# Five glass beads (λ1–λ5) for the site, transparent background.
# usage: python beads.py OUT_PREFIX [SIZE SPP]
import bpy, math, sys, os, addon_utils
from mathutils import Vector
a = sys.argv[1:]; OUT = os.path.abspath(a[0]); S = int(a[1]) if len(a) > 1 else 160; SPP = int(a[2]) if len(a) > 2 else 128
GLASS = [(1, .16, .07), (1, .55, .02), (.03, .62, .25), (.05, .2, 1), (.33, .08, 1)]
for k, col in enumerate(GLASS):
    bpy.ops.wm.read_factory_settings(use_empty=True); addon_utils.enable("cycles", default_set=True)
    sc = bpy.context.scene
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=96, ring_count=48); o = bpy.context.object
    for p in o.data.polygons: p.use_smooth = True
    m = bpy.data.materials.new("g"); m.use_nodes = True; nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*(0.6 + 0.4 * c for c in col), 1)
    b.inputs["Transmission Weight"].default_value = 1.0; b.inputs["Roughness"].default_value = 0.0; b.inputs["IOR"].default_value = 1.52
    va = nt.nodes.new("ShaderNodeVolumeAbsorption"); va.inputs["Color"].default_value = (*col, 1); va.inputs["Density"].default_value = 1.6
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
    # a white card below the bead, seen only through the glass (gives the bright caustic floor)
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, -1.6)); fl = bpy.context.object; fl.visible_camera = False
    em = bpy.data.materials.new("e"); em.use_nodes = True; eb = em.node_tree.nodes["Principled BSDF"]
    eb.inputs["Emission Color"].default_value = (1, 1, 1, 1); eb.inputs["Emission Strength"].default_value = 1.2
    fl.data.materials.append(em)
    cd = bpy.data.cameras.new("c"); cd.type = "ORTHO"; cd.ortho_scale = 2.16
    c = bpy.data.objects.new("c", cd); sc.collection.objects.link(c); sc.camera = c; c.location = (0, -4.2, 4.2); c.rotation_euler = (math.radians(45), 0, 0)
    sc.render.engine = "CYCLES"; cy = sc.cycles; cy.device = "CPU"; cy.samples = SPP; cy.use_denoising = True
    cy.transmission_bounces = 16; cy.max_bounces = 24; cy.volume_bounces = 2
    sc.render.film_transparent = True; cy.film_transparent_glass = False
    sc.render.resolution_x = S; sc.render.resolution_y = S
    sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
    sc.render.filepath = f"{OUT}{k}.png"; bpy.ops.render.render(write_still=True)
