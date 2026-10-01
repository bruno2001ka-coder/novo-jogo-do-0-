"""
Pré-visualização rápida de poses/animações no Blender (Workbench) e montagem de folhas de contato.

Rodar com xvfb (precisa de um contexto OpenGL):
  xvfb-run -a python tools/preview/pose_sheet.py OUT_DIR --calib
  xvfb-run -a python tools/preview/pose_sheet.py OUT_DIR --clips=idle-loop,attack_l1 [--views=three,side] [--char=hero]
"""
import sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'blender'))
import bpy
from mathutils import Vector
from common import *
import rig as R
import humanoid as H
import anim_lib as A


def setup_scene(size=420):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.render.resolution_x = size
    sc.render.resolution_y = size
    sc.render.film_transparent = False
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'MATERIAL'
    sc.display.shading.show_cavity = False
    sc.display.shading.show_object_outline = True
    sc.display.shading.object_outline_color = (0, 0, 0)
    sc.display.render_aa = '8'
    w = bpy.data.worlds.new("W")
    w.color = (0.18, 0.18, 0.24)
    sc.world = w
    # chão com grade para ver contato dos pés
    bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 0, -0.005))
    floor = bpy.context.active_object
    m = material("FloorGrid", (0.30, 0.30, 0.34), 0.0, 0.9)
    floor.data.materials.append(m)
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 4.4
    cam = bpy.data.objects.new("Cam", cam_data)
    sc.collection.objects.link(cam)
    sc.camera = cam
    return cam


def aim_camera(cam, view, target=Vector((0, 0, 1.55)), dist=12.0, scale=4.4):
    dirs = {
        'front': Vector((0, -1, 0.05)),
        'back': Vector((0, 1, 0.05)),
        'side': Vector((-1, 0, 0.05)),       # lado direito do personagem (onde fica a lança)
        'side_l': Vector((1, 0, 0.05)),
        'three': Vector((-0.65, -0.75, 0.22)),
        'three_l': Vector((0.65, -0.75, 0.22)),
        'top': Vector((0, -0.05, 1.0)),
    }
    d = dirs[view].normalized()
    cam.location = target + d * dist
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.ortho_scale = scale


def render(path):
    sc = bpy.context.scene
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def build_char(char='hero'):
    clear_scene()
    p = R.HERO
    arm = R.build_armature(p, "Armature")
    if char == 'hero':
        import build_hero as BH
        objs = H.build_all(p, BH.HERO_STYLE, arm, "Body")
    else:
        raise SystemExit("personagem desconhecido: " + char)
    skel = A.Skel(arm, p)
    return arm, skel, objs


CALIB = [
    ("rest", {}),
    ("RUpperArm flex+80", {'RightUpperArm': A.J(flex=80)}),
    ("RUpperArm abd+80", {'RightUpperArm': A.J(abd=80)}),
    ("RLowerArm flex+90", {'RightLowerArm': A.J(flex=90)}),
    ("Spine twist+40 (vira p/ esquerda)", {'Spine': A.J(twist=40)}),
    ("Spine flex+30 (inclina p/ frente)", {'Spine': A.J(flex=30)}),
    ("Spine abd+25 (inclina p/ esquerda)", {'Spine': A.J(abd=25)}),
    ("Head twist+40", {'Head': A.J(twist=40)}),
    ("LUpperLeg flex+50 (chuta p/ frente)", {'LeftUpperLeg': A.J(flex=50), '_plant': False, '_ground': False}),
    ("LLowerLeg flex-70 (dobra joelho)", {'LeftUpperLeg': A.J(flex=40), 'LeftLowerLeg': A.J(flex=-70), '_plant': False, '_ground': False}),
    ("LUpperLeg abd+40", {'LeftUpperLeg': A.J(abd=40), '_plant': False, '_ground': False}),
    ("Head flex+30 (olha p/ baixo)", {'Head': A.J(flex=30)}),
]


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out_dir = argv[0]
    os.makedirs(out_dir, exist_ok=True)
    opts = {a.split('=')[0]: (a.split('=', 1)[1] if '=' in a else '1') for a in argv[1:] if a.startswith('--')}
    size = int(opts.get('--size', 420))
    views = opts.get('--views', 'three').split(',')
    arm, skel, objs = build_char(opts.get('--char', 'hero'))
    cam = setup_scene(size)
    from clips import CLIPS
    jobs = []
    if '--calib' in opts:
        for i, (label, pose) in enumerate(CALIB):
            jobs.append((f"calib_{i:02d}", label, pose))
    if '--clips' in opts:
        for cname in opts['--clips'].split(','):
            c = CLIPS[cname]
            sel = opts.get('--keys')
            for (frame, pose) in c['keys']:
                if sel and str(frame) not in sel.split(','):
                    continue
                jobs.append((f"{cname}_{frame:03d}", f"{cname} f{frame}", pose))
    scale = float(opts.get('--scale', 4.4))
    target = Vector((float(opts.get('--cx', 0)), 0, float(opts.get('--cz', 1.55))))
    prev = {}
    for (fname, label, pose) in jobs:
        A.pose_to_armature(arm, skel, pose)
        bpy.context.view_layer.update()
        for v in views:
            aim_camera(cam, v, target=target, scale=scale)
            render(os.path.join(out_dir, f"{fname}__{v}.png"))
        print("rendered", fname, "|", label)


if __name__ == '__main__':
    main()
