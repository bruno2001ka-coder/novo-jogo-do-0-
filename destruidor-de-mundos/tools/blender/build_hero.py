"""
Gera o herói "Destruidor de Mundos" (malha + esqueleto + animações) e exporta GLB/.blend.

Uso (Blender instalado):
    blender --background --python tools/blender/build_hero.py -- <saida.glb> [--blend <saida.blend>] [--static]
Uso (módulo bpy via pip):
    python tools/blender/build_hero.py <saida.glb> ...
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from common import *
import rig as R
import humanoid as H

HERO_STYLE = dict(
    name="Hero", kx=1.0, kz=1.0, bulk=1.0,
    skin=(0.47, 0.30, 0.60), armor=(0.13, 0.13, 0.18), armor2=(0.22, 0.20, 0.29), trim=(0.96, 0.72, 0.22),
    cloth=(0.50, 0.05, 0.09), glow=(0.78, 0.32, 1.0), eye=(1.0, 0.55, 0.15),
    chest='cuirass', pauldron='spiked', bracer='plate', helmet='crown', gauntlet=True, weapon='spear', cape=True,
)


def build(out_glb, out_blend=None, static=False):
    clear_scene()
    p = R.HERO
    arm = R.build_armature(p, "Armature")
    objs = H.build_all(p, HERO_STYLE, arm, "Body")
    if not static:
        try:
            import anim_lib
            anim_lib.add_all_clips(arm, p)
        except ImportError:
            print("[aviso] anim_lib ainda não existe; exportando sem animações")
    export_glb(out_glb, [arm] + objs, animations=not static)
    if out_blend:
        bpy.ops.wm.save_as_mainfile(filepath=out_blend)
        print("[blend] ->", out_blend)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    out = argv[0]
    blend = argv[argv.index("--blend") + 1] if "--blend" in argv else None
    build(out, blend, static="--static" in argv)
