"""
Gera TODOS os personagens (herói, capangas, chefes) -> assets/models/*.glb  (+ .blend em tools/blender/blend)

    python tools/blender/build_characters.py [--only=hero,soldier_volcano] [--out=<pasta>]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from common import *
import rig as R
import humanoid as H
import anim_lib

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.abspath(os.path.join(HERE, '..', '..'))

# ---------------------------------------------------------------------------
# Estilos
# ---------------------------------------------------------------------------
HERO = dict(
    name="Hero", kx=1.0, kz=1.0, bulk=1.0,
    skin=(0.47, 0.30, 0.60), armor=(0.13, 0.13, 0.18), armor2=(0.22, 0.20, 0.29), trim=(0.96, 0.72, 0.22),
    cloth=(0.50, 0.05, 0.09), glow=(0.78, 0.32, 1.0), eye=(1.0, 0.55, 0.15),
    chest='cuirass', pauldron='spiked', bracer='plate', helmet='crown', gauntlet=True, weapon='spear', cape=True,
)

# Paletas dos mundos
PALETTES = {
    'volcano': dict(skin=(0.22, 0.15, 0.14), armor=(0.075, 0.06, 0.06), armor2=(0.14, 0.10, 0.09), trim=(0.62, 0.22, 0.08),
                    cloth=(0.13, 0.05, 0.04), glow=(1.0, 0.42, 0.05), eye=(1.0, 0.55, 0.1)),
    'city':    dict(skin=(0.40, 0.43, 0.50), armor=(0.74, 0.76, 0.82), armor2=(0.30, 0.33, 0.40), trim=(0.12, 0.85, 0.95),
                    cloth=(0.10, 0.12, 0.20), glow=(0.15, 0.95, 1.0), eye=(0.2, 1.0, 1.0)),
    'ice':     dict(skin=(0.55, 0.66, 0.80), armor=(0.60, 0.75, 0.92), armor2=(0.34, 0.46, 0.64), trim=(0.88, 0.95, 1.0),
                    cloth=(0.16, 0.28, 0.50), glow=(0.45, 0.85, 1.0), eye=(0.6, 0.95, 1.0)),
}


def unit(world, kind):
    P = PALETTES[world]
    if kind == 'soldier':
        return dict(name=f"Soldier_{world}", kx=0.60, kz=0.64, bulk=1.0, chest='leather', pauldron='plate', bracer='plate',
                    helmet='spiked' if world != 'city' else 'visor', gauntlet=False, weapon='sword', cape=False,
                    legs='cloth', arms='skin', **P)
    if kind == 'shooter':
        return dict(name=f"Shooter_{world}", kx=0.58, kz=0.62, bulk=0.85, chest='leather', pauldron='round', bracer='plate',
                    helmet='hood' if world != 'city' else 'visor', gauntlet=False, weapon='rifle', cape=False,
                    legs='cloth', arms='cloth', **P)
    if kind == 'brute':
        return dict(name=f"Brute_{world}", kx=0.95, kz=0.86, bulk=1.45, chest='heavy', pauldron='spiked', bracer='plate',
                    helmet='spiked', gauntlet=False, weapon='hammer', cape=False, cover_abs=True, legs='armor', arms='skin', **P)
    if kind == 'boss':
        wk = {'volcano': 'greatsword', 'city': 'halberd', 'ice': 'greatsword'}[world]
        helm = {'volcano': 'horned', 'city': 'visor', 'ice': 'crown'}[world]
        return dict(name=f"Boss_{world}", kx=1.40, kz=1.46, bulk=1.18, chest='heavy', pauldron='spiked', bracer='plate',
                    helmet=helm, gauntlet=False, weapon=wk, cape=True, cover_abs=True, legs='armor', arms='skin', **P)
    raise KeyError(kind)


CHARACTERS = {'hero': HERO}
for w in PALETTES:
    for k in ('soldier', 'shooter', 'brute', 'boss'):
        CHARACTERS[f"{k}_{w}"] = unit(w, k)


# Clips necessários por tipo (reduz o tamanho dos GLBs)
CLIPS_COMMON = ['idle-loop', 'walk-loop', 'run-loop', 'hurt', 'hurt_big', 'stun-loop', 'death', 'spawn', 'rage', 'jump', 'fall-loop', 'land']
CLIP_SETS = {
    'hero': None,   # todos
    'soldier': CLIPS_COMMON + ['attack_l1', 'attack_l2', 'attack_l3', 'attack_h', 'block-loop', 'parry'],
    'shooter': CLIPS_COMMON + ['shoot', 'aim_shoot-loop', 'attack_l1', 'dodge'],
    'brute': CLIPS_COMMON + ['attack_l1', 'attack_l3', 'attack_h', 'attack_spin', 'power_slam', 'block-loop'],
    'boss': CLIPS_COMMON + ['attack_l1', 'attack_l2', 'attack_l3', 'attack_h', 'attack_spin', 'attack_launcher', 'power_slam',
                            'power_cast', 'power_raise', 'power_channel-loop', 'dodge', 'victory', 'block-loop', 'shoot', 'aim_shoot-loop'],
}


def build(name, out_dir, blend_dir=None):
    st = CHARACTERS[name]
    clear_scene()
    p = R.scaled(R.HERO, kz=st['kz'], kx=st['kx'])
    p['grip_y'] = 0.0
    arm = R.build_armature(p, "Armature")
    objs = H.build_all(p, st, arm, "Body")
    anim_lib.add_all_clips(arm, p, only=CLIP_SETS.get(name.split('_')[0]))
    os.makedirs(out_dir, exist_ok=True)
    export_glb(os.path.join(out_dir, name + ".glb"), [arm] + objs, animations=True)
    if blend_dir:
        os.makedirs(blend_dir, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(blend_dir, name + ".blend"))


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    opts = {a.split('=')[0]: (a.split('=', 1)[1] if '=' in a else '1') for a in argv if a.startswith('--')}
    out = opts.get('--out', os.path.join(PROJECT, 'assets', 'models'))
    blend = None if '--noblend' in opts else os.path.join(HERE, 'blend')
    names = opts['--only'].split(',') if '--only' in opts else list(CHARACTERS.keys())
    for n in names:
        print(f"[personagem] {n}")
        build(n, out, blend)
