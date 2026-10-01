"""
Biblioteca de animações dos humanoides (herói, capangas, chefes).

Cada clip: CLIPS[nome] = {'keys': [(frame, pose), ...], 'loop': bool}
Frames a 30 fps; clips começam no frame 1.  Para loop, o último key repete o primeiro.
Nomes terminados em "-loop" viram animações em loop no Godot (o sufixo é removido).

Convenções (ver anim_lib):
  _rw/_lw = alvo do punho (fora, frente, cima) em unidades de alcance do braço, relativo ao ombro.
  _lf/_rf = alvo do pé (fora, frente, elevação) em metros (escala do herói), relativo à posição de repouso.
  _spear  = (direção, normal) da arma na mão direita (espaço do personagem: frente = -Y, esquerda = +X).
  Torso: twist > 0 gira para a ESQUERDA; flex > 0 inclina para a frente (cabeça: olha para baixo).
"""
import math
from anim_lib import J, mix, lerp_pose

CLIPS = {}


def clip(name, keys, loop=False):
    CLIPS[name] = {'keys': keys, 'loop': loop}


def flat(h, ul, ll):
    return h - ul - ll


UPN = (0.0, 0.0, 1.0)

# ----------------------------------------------------------------------------
# Postura base (guarda com lança)
# ----------------------------------------------------------------------------
READY = {
    'Hips': J(flex=6, twist=-4),
    'Spine': J(flex=5, twist=-5),
    'Chest': J(flex=3, twist=-7),
    'Neck': J(flex=-7),
    'Head': J(flex=-3, twist=14),
    '_lf': (0.06, 0.38, 0.0), '_rf': (0.12, -0.32, 0.0),
    '_rw': (-0.12, 0.45, -0.52), '_lw': (0.14, 0.58, -0.36),
    '_spear': ((0.0, -0.55, 0.83), (0.0, 0.83, 0.55)),
}

# ----------------------------------------------------------------------------
# Idle
# ----------------------------------------------------------------------------
_idle_b = mix(READY, Chest=J(flex=5, twist=-7), Spine=J(flex=6, twist=-5), Head=J(flex=-4, twist=14),
              _lw=(0.15, 0.6, -0.34), _rw=(-0.12, 0.47, -0.5), Hips=J(flex=6, twist=-4, loc=(0, 0, 0.0)))
clip('idle-loop', [(1, READY), (41, _idle_b), (81, READY)], loop=True)


# ----------------------------------------------------------------------------
# Caminhada / corrida (fórmulas)
# ----------------------------------------------------------------------------
def gait_pose(phi, hip_amp, knee_amp, knee_stance, lean, arm_fwd, arm_up, spear_dir, lift_amp=0.0,
              swing_foot=-22.0, twist_amp=6.0, spine_lean=4.0, rarm=(-0.1, 0.45, -0.5)):
    def leg(ph):
        h = hip_amp * math.sin(ph) + 3.0
        swing = max(0.0, math.cos(ph))
        k = -(knee_stance + knee_amp * swing ** 1.3)
        return h, k, swing
    lh, lk, lsw = leg(phi)
    rh, rk, rsw = leg(phi + math.pi)
    s = math.sin(phi)
    return {
        'Hips': J(flex=lean),
        'Spine': J(flex=spine_lean, twist=-twist_amp * s - 3),
        'Chest': J(flex=spine_lean * 0.6, twist=-twist_amp * 0.8 * s - 3),
        'Neck': J(flex=-lean * 0.7),
        'Head': J(flex=-lean * 0.4, twist=8 + twist_amp * 1.4 * s),
        'LeftUpperLeg': J(flex=lh, abd=4),
        'LeftLowerLeg': J(flex=lk),
        'RightUpperLeg': J(flex=rh, abd=4),
        'RightLowerLeg': J(flex=rk),
        'LeftFoot': J(flex=flat(lean, lh, lk) + swing_foot * lsw),
        'RightFoot': J(flex=flat(lean, rh, rk) + swing_foot * rsw),
        '_lw': (0.16, 0.18 - arm_fwd * s, arm_up + 0.14 * max(0.0, -s)),
        '_rw': (rarm[0], rarm[1] + 0.05 * s, rarm[2]),
        '_spear': spear_dir,
        '_plant': False,
        '_lift': lift_amp * math.cos(phi) ** 2,
    }


_keys = []
for i in range(9):
    _keys.append((1 + i * 4, gait_pose(2 * math.pi * i / 8, hip_amp=22, knee_amp=36, knee_stance=8, lean=5,
                                       arm_fwd=0.42, arm_up=-0.62, spear_dir=((0.0, -0.6, 0.8), (0.0, 0.8, 0.6)),
                                       twist_amp=5, spine_lean=4, rarm=(-0.1, 0.45, -0.5))))
clip('walk-loop', _keys, loop=True)

_keys = []
for i in range(9):
    _keys.append((1 + i * 3, gait_pose(2 * math.pi * i / 8, hip_amp=40, knee_amp=78, knee_stance=14, lean=14,
                                       arm_fwd=0.55, arm_up=-0.38, spear_dir=((0.0, -0.85, 0.5), (0.0, 0.5, 0.85)),
                                       lift_amp=0.10, twist_amp=9, spine_lean=8, rarm=(-0.05, 0.55, -0.42))))
clip('run-loop', _keys, loop=True)

# ----------------------------------------------------------------------------
# Ataques com lança
# ----------------------------------------------------------------------------
# --- L1: corte horizontal direita -> esquerda -------------------------------
_a1_w = mix(READY, Hips=J(flex=2, twist=-8), Spine=J(flex=-2, twist=-22), Chest=J(flex=-3, twist=-26), Neck=J(flex=-4), Head=J(flex=-3, twist=44),
            _lf=(0.10, 0.12, 0.0), _rf=(0.16, -0.50, 0.0), _rw=(0.95, -0.12, -0.02), _lw=(0.12, 0.62, -0.30),
            _spear=((-0.62, -0.75, 0.12), UPN))
_a1_s = mix(READY, Hips=J(flex=12, twist=6), Spine=J(flex=6, twist=12), Chest=J(flex=4, twist=16), Head=J(flex=-3, twist=-12),
            _lf=(0.06, 0.78, 0.0), _rf=(0.14, -0.35, 0.0), _rw=(0.30, 0.90, -0.05), _lw=(0.25, -0.05, -0.55),
            _spear=((0.45, -0.85, 0.0), UPN))
_a1_e = mix(_a1_s, Hips=J(flex=12, twist=14), Spine=J(flex=6, twist=26), Chest=J(flex=4, twist=34), Head=J(flex=-3, twist=-45),
            _rw=(-0.35, 0.70, 0.0), _spear=((0.95, -0.30, 0.0), UPN))
_a1_f = mix(_a1_e, Hips=J(flex=8, twist=8), Spine=J(flex=5, twist=18), Chest=J(flex=3, twist=22), _rw=(-0.2, 0.6, -0.25),
            _spear=((0.6, -0.7, 0.3), (0.0, 0.7, 0.7)), _lw=(0.2, 0.2, -0.5), _lf=(0.06, 0.65, 0.0), _rf=(0.14, -0.25, 0.0))
clip('attack_l1', [(1, READY), (8, _a1_w), (11, _a1_s), (14, _a1_e), (20, _a1_f), (32, READY)])

# --- L2: corte de costas esquerda -> direita --------------------------------
_a2_w = mix(READY, Hips=J(flex=4, twist=6), Spine=J(flex=3, twist=26), Chest=J(flex=2, twist=30), Head=J(flex=-3, twist=-40),
            _lf=(0.10, 0.20, 0.0), _rf=(0.14, -0.25, 0.0), _rw=(-0.30, 0.75, -0.05), _lw=(0.25, 0.1, -0.5),
            _spear=((0.95, -0.30, 0.15), UPN))
_a2_s = mix(READY, Hips=J(flex=12, twist=-4), Spine=J(flex=6, twist=-8), Chest=J(flex=4, twist=-10), Head=J(flex=-3, twist=10),
            _lf=(0.12, -0.30, 0.0), _rf=(0.10, 0.65, 0.0), _rw=(0.45, 0.80, 0.05), _lw=(0.35, 0.2, -0.45),
            _spear=((-0.25, -0.95, 0.1), UPN))
_a2_e = mix(_a2_s, Hips=J(flex=12, twist=-14), Spine=J(flex=6, twist=-30), Chest=J(flex=4, twist=-36), Head=J(flex=-3, twist=42),
            _rw=(0.97, 0.10, 0.05), _spear=((-0.97, -0.20, 0.1), UPN))
_a2_f = mix(_a2_e, Hips=J(flex=8, twist=-8), Spine=J(flex=5, twist=-20), Chest=J(flex=3, twist=-24), _rw=(0.7, 0.2, -0.2),
            _spear=((-0.7, -0.5, 0.3), (0.0, 0.7, 0.7)), _lw=(0.3, 0.3, -0.5))
clip('attack_l2', [(1, READY), (7, _a2_w), (10, _a2_s), (13, _a2_e), (19, _a2_f), (31, READY)])

# --- L3: estocada com avanço -------------------------------------------------
_a3_w = mix(READY, Hips=J(flex=6, twist=-10), Spine=J(flex=4, twist=-28), Chest=J(flex=2, twist=-30), Head=J(flex=-3, twist=46),
            _lf=(0.08, 0.15, 0.0), _rf=(0.15, -0.55, 0.0), _rw=(0.25, -0.30, -0.50), _lw=(0.15, 0.8, -0.10),
            _spear=((0.0, -1.0, 0.05), UPN))
_a3_s = mix(READY, Hips=J(flex=22, twist=6), Spine=J(flex=8, twist=16), Chest=J(flex=5, twist=18), Head=J(flex=-4, twist=-30),
            _lf=(0.06, 0.95, 0.0), _rf=(0.16, -0.30, 0.0), _rw=(-0.08, 0.98, -0.12), _lw=(0.35, -0.10, -0.50),
            _spear=((0.0, -1.0, 0.0), UPN))
_a3_h = mix(_a3_s, _rw=(-0.06, 0.88, -0.10), Hips=J(flex=20, twist=4))
clip('attack_l3', [(1, READY), (10, _a3_w), (13, _a3_s), (19, _a3_h), (36, READY)])

# --- Pesado: golpe de cima para baixo (onda de choque) ------------------------
_h_up = mix(READY, Hips=J(flex=0, twist=-4), Spine=J(flex=-12, twist=-4), Chest=J(flex=-10, twist=-4), Neck=J(flex=-12), Head=J(flex=-4, twist=10),
            _lf=(0.14, 0.22, 0.0), _rf=(0.20, -0.22, 0.0), _rw=(-0.05, 0.25, 0.92), _lw=(0.0, 0.2, 0.85),
            _spear=((0.0, -0.9, 0.45), (1.0, 0.0, 0.0)))
_h_top = mix(_h_up, Spine=J(flex=-17, twist=-4), Chest=J(flex=-14, twist=-4), _rw=(-0.05, 0.15, 0.98), _lw=(0.0, 0.1, 0.92),
             _spear=((0.0, -0.7, 0.7), (1.0, 0.0, 0.0)))
_h_slam = mix(READY, Hips=J(flex=28, twist=0), Spine=J(flex=24, twist=0), Chest=J(flex=14), Neck=J(flex=-20), Head=J(flex=-6, twist=0),
              _lf=(0.14, 0.62, 0.0), _rf=(0.22, -0.35, 0.0), _rw=(0.0, 0.82, -0.55), _lw=(0.0, 0.8, -0.5),
              _spear=((0.0, -0.7, -0.7), (1.0, 0.0, 0.0)))
_h_hold = mix(_h_slam, Hips=J(flex=26), Spine=J(flex=22), _rw=(0.0, 0.8, -0.5), _lw=(0.0, 0.78, -0.45))
clip('attack_h', [(1, READY), (11, _h_up), (24, _h_top), (27, _h_top), (30, _h_slam), (38, _h_hold), (58, READY)])

# --- Lançador: corte ascendente ----------------------------------------------
_l_low = mix(READY, Hips=J(flex=22, twist=-6), Spine=J(flex=20, twist=-24), Chest=J(flex=10, twist=-24), Head=J(flex=-8, twist=40),
             _lf=(0.10, 0.50, 0.0), _rf=(0.22, -0.40, 0.0), _rw=(0.70, 0.25, -0.85), _lw=(0.2, 0.5, -0.4),
             _spear=((-0.2, -0.9, -0.4), UPN))
_l_rise = mix(READY, Hips=J(flex=8, twist=4), Spine=J(flex=4, twist=24), Chest=J(flex=2, twist=28), Head=J(flex=-4, twist=-30),
              _lf=(0.10, 0.55, 0.0), _rf=(0.20, -0.40, 0.0), _rw=(-0.05, 0.55, 0.55), _lw=(0.3, 0.1, -0.5),
              _spear=((0.0, -0.55, 0.83), (1.0, 0.0, 0.0)))
_l_top = mix(_l_rise, Spine=J(flex=-4, twist=22), Chest=J(flex=-6, twist=26), _lf=(0.10, 0.5, 0.14), _rf=(0.2, -0.4, 0.2),
             _rw=(-0.15, 0.35, 0.9), _spear=((0.2, -0.4, 0.9), (1.0, 0.0, 0.0)), _lw=(0.4, 0.0, -0.3), _ground=False)
clip('attack_launcher', [(1, READY), (9, _l_low), (13, _l_rise), (17, _l_top), (22, _l_top), (38, READY)])

# --- Giro (a rotação de 360° é feita pelo código; o clip é a postura) ------------
_s_w = mix(READY, Hips=J(flex=12, twist=-10), Spine=J(flex=6, twist=-35), Chest=J(flex=4, twist=-40), Head=J(flex=-3, twist=55),
           _lf=(0.30, 0.20, 0.0), _rf=(0.40, -0.10, 0.0), _rw=(0.97, 0.0, 0.0), _lw=(0.3, 0.5, -0.2),
           _spear=((-1.0, 0.0, 0.0), UPN))
_s_spin = mix(_s_w, Hips=J(flex=10, twist=0), Spine=J(flex=6, twist=-10), Chest=J(flex=3, twist=-10), Head=J(twist=10, flex=-3),
              _rw=(0.98, 0.0, 0.02), _lw=(0.45, 0.35, -0.1))
clip('attack_spin', [(1, READY), (9, _s_w), (13, _s_spin), (34, _s_spin), (42, READY), (50, READY)])

# --- Mergulho (no ar) ---------------------------------------------------------
_pl_a = {
    'Hips': J(flex=10), 'Spine': J(flex=-8), 'Chest': J(flex=-10), 'Neck': J(flex=-10), 'Head': J(flex=-2),
    '_lf': (0.10, 0.10, 0.35), '_rf': (0.16, -0.10, 0.30),
    '_rw': (-0.05, 0.15, 0.85), '_lw': (0.0, 0.15, 0.80), '_spear': ((0.0, -0.3, -0.95), (1.0, 0.0, 0.0)),
}
_pl_b = mix(_pl_a, _lf=(0.12, 0.14, 0.4), _rf=(0.2, -0.14, 0.34), Spine=J(flex=-9))
clip('plunge-loop', [(1, _pl_a), (11, _pl_b), (21, _pl_a)], loop=True)

# ----------------------------------------------------------------------------
# Movimentação aérea e esquiva
# ----------------------------------------------------------------------------
_j_crouch = mix(READY, Hips=J(flex=26, twist=0), Spine=J(flex=18), Chest=J(flex=10), Neck=J(flex=-14),
                _lf=(0.12, 0.25, 0.0), _rf=(0.18, -0.2, 0.0), _rw=(0.25, -0.25, -0.65), _lw=(0.25, -0.25, -0.65),
                _spear=((0.0, -0.9, 0.3), UPN))
_j_launch = mix(READY, Hips=J(flex=4), Spine=J(flex=-4), Chest=J(flex=-4), Neck=J(flex=-8),
                _lf=(0.10, 0.2, 0.0), _rf=(0.14, -0.2, 0.0), _rw=(0.1, 0.5, 0.65), _lw=(0.2, 0.45, 0.6),
                _spear=((0.0, -0.8, 0.6), UPN))
_j_air = mix(_j_launch, _lf=(0.12, 0.25, 0.25), _rf=(0.16, -0.25, 0.3), _rw=(0.2, 0.4, 0.4), _lw=(0.3, 0.4, 0.35))
clip('jump', [(1, READY), (5, _j_crouch), (9, _j_launch), (14, _j_air)])

_f_a = {
    'Hips': J(flex=8, twist=-4), 'Spine': J(flex=6), 'Chest': J(flex=4), 'Neck': J(flex=-10), 'Head': J(flex=-4),
    '_lf': (0.15, 0.25, 0.22), '_rf': (0.20, -0.25, 0.28),
    '_rw': (0.65, 0.2, -0.05), '_lw': (0.7, 0.2, -0.05), '_spear': ((-0.5, -0.8, 0.3), UPN),
}
_f_b = mix(_f_a, _lf=(0.2, 0.3, 0.28), _rf=(0.25, -0.3, 0.2), _rw=(0.6, 0.15, 0.05), _lw=(0.65, 0.18, 0.0))
clip('fall-loop', [(1, _f_a), (11, _f_b), (21, _f_a)], loop=True)

_land = mix(READY, Hips=J(flex=30), Spine=J(flex=20), Chest=J(flex=10), Neck=J(flex=-16),
            _lf=(0.14, 0.3, 0.0), _rf=(0.2, -0.25, 0.0), _rw=(0.3, 0.3, -0.8), _lw=(0.3, 0.3, -0.8), _spear=((0.0, -0.9, 0.1), UPN))
clip('land', [(1, _f_a), (4, _land), (9, mix(_land, Hips=J(flex=20), Spine=J(flex=14))), (15, READY)])

_d_dive = mix(READY, Hips=J(flex=34), Spine=J(flex=26), Chest=J(flex=14), Neck=J(flex=-16),
              _lf=(0.14, 0.4, 0.0), _rf=(0.2, -0.3, 0.0), _rw=(0.1, 0.8, -0.45), _lw=(0.1, 0.8, -0.45),
              _spear=((0.0, -0.9, 0.2), UPN))
_d_ball = {
    'Hips': J(flex=50), 'Spine': J(flex=50), 'Chest': J(flex=40), 'Neck': J(flex=40), 'Head': J(flex=20),
    '_lf': (0.12, 0.25, 0.75), '_rf': (0.16, 0.15, 0.7),
    '_rw': (0.0, 0.5, -0.6), '_lw': (0.0, 0.5, -0.6), '_spear': ((0.0, -0.5, 0.8), UPN), '_ground': False,
}
_d_land = mix(READY, Hips=J(flex=28), Spine=J(flex=18), Chest=J(flex=10), _lf=(0.14, 0.45, 0.0), _rf=(0.2, -0.25, 0.0),
              _rw=(0.2, 0.5, -0.6), _lw=(0.2, 0.5, -0.6))
clip('dodge', [(1, READY), (5, _d_dive), (8, _d_ball), (16, _d_ball), (19, _d_land), (25, READY)])

# ----------------------------------------------------------------------------
# Defesa
# ----------------------------------------------------------------------------
_b_a = mix(READY, Hips=J(flex=10, twist=-6), Spine=J(flex=8, twist=-8), Chest=J(flex=5, twist=-10), Head=J(flex=-4, twist=20),
           _lf=(0.14, 0.34, 0.0), _rf=(0.2, -0.28, 0.0), _rw=(-0.38, 0.55, -0.12), _lw=(-0.22, 0.52, -0.2),
           _spear=((1.0, -0.12, 0.05), UPN))
_b_b = mix(_b_a, Chest=J(flex=6, twist=-10), Spine=J(flex=9, twist=-8), _rw=(-0.36, 0.57, -0.1), _lw=(-0.2, 0.54, -0.18))
clip('block-loop', [(1, _b_a), (21, _b_b), (41, _b_a)], loop=True)

_p_shove = mix(READY, Hips=J(flex=12, twist=4), Spine=J(flex=6, twist=14), Chest=J(flex=4, twist=14), Head=J(flex=-4, twist=-20),
               _lf=(0.1, 0.62, 0.0), _rf=(0.16, -0.3, 0.0), _rw=(-0.2, 0.95, -0.05), _lw=(0.3, 0.1, -0.5),
               _spear=((0.5, -0.85, 0.1), UPN))
clip('parry', [(1, _b_a), (4, _p_shove), (8, _p_shove), (16, READY)])

# ----------------------------------------------------------------------------
# Lança arremessada / chamada de volta
# ----------------------------------------------------------------------------
_aim = mix(READY, Hips=J(flex=8, twist=-10), Spine=J(flex=4, twist=-22), Chest=J(flex=2, twist=-26), Neck=J(flex=-8), Head=J(flex=-3, twist=44),
           _lf=(0.10, 0.62, 0.0), _rf=(0.2, -0.45, 0.0), _rw=(-0.05, -0.2, 0.32), _lw=(0.15, 0.95, -0.05),
           _spear=((0.0, -1.0, 0.12), UPN))
_aim_b = mix(_aim, Chest=J(flex=3, twist=-26), Head=J(flex=-4, twist=44), _lw=(0.15, 0.97, -0.03))
clip('aim-loop', [(1, _aim), (16, _aim_b), (31, _aim)], loop=True)

_t_back = mix(_aim, Spine=J(flex=-2, twist=-34), Chest=J(flex=-2, twist=-36), Hips=J(flex=6, twist=-12), _rw=(0.0, -0.55, 0.25),
              _spear=((0.0, -1.0, 0.1), UPN))
_t_rel = mix(READY, Hips=J(flex=14, twist=6), Spine=J(flex=8, twist=18), Chest=J(flex=5, twist=22), Head=J(flex=-4, twist=-30),
             _lf=(0.10, 0.88, 0.0), _rf=(0.20, -0.40, 0.0), _rw=(-0.10, 1.0, 0.25), _lw=(0.4, 0.2, -0.5),
             _spear=((0.0, -1.0, 0.1), UPN))
_t_fol = mix(_t_rel, Hips=J(flex=20, twist=8), _rw=(-0.05, 0.9, -0.35), _spear=((0.0, -0.9, -0.3), UPN))
clip('throw', [(1, _aim), (4, _t_back), (7, _t_rel), (11, _t_fol), (19, READY)])

_rc_a = mix(READY, Hips=J(flex=2, twist=0), Spine=J(flex=-8, twist=-4), Chest=J(flex=-6, twist=-4), Neck=J(flex=-10), Head=J(flex=-4, twist=8),
            _lf=(0.14, 0.40, 0.0), _rf=(0.2, -0.4, 0.0), _rw=(-0.02, 0.97, 0.12), _lw=(0.28, 0.6, -0.3), _spear=None)
_rc_a.pop('_spear')
_rc_a['RightHand'] = J(flex=-10)
_rc_b = mix(_rc_a, _rw=(-0.04, 0.99, 0.14), Spine=J(flex=-9, twist=-4))
clip('recall-loop', [(1, _rc_a), (11, _rc_b), (21, _rc_a)], loop=True)

_ct_a = mix(_rc_a)
_ct_b = mix(READY, Hips=J(flex=4), Spine=J(flex=-4, twist=-4), _rw=(0.0, 0.35, -0.3), _spear=((0.0, -0.7, 0.7), (0.0, 0.7, 0.7)))
clip('catch', [(1, _ct_a), (4, _ct_b), (9, mix(READY, Spine=J(flex=6, twist=-5))), (16, READY)])

# ----------------------------------------------------------------------------
# Socos (sem arma)
# ----------------------------------------------------------------------------
_pr_w = mix(READY, Hips=J(flex=6, twist=-8), Spine=J(flex=3, twist=-25), Chest=J(flex=2, twist=-28), Head=J(flex=-3, twist=44),
            _lf=(0.1, 0.35, 0.0), _rf=(0.18, -0.4, 0.0), _rw=(0.3, 0.0, -0.38), _lw=(0.1, 0.6, -0.2))
_pr_w.pop('_spear')
_pr_s = mix(_pr_w, Hips=J(flex=14, twist=6), Spine=J(flex=7, twist=20), Chest=J(flex=5, twist=22), Head=J(flex=-3, twist=-30),
            _lf=(0.08, 0.7, 0.0), _rf=(0.15, -0.3, 0.0), _rw=(-0.12, 1.0, -0.1), _lw=(0.3, 0.0, -0.5))
clip('punch_r', [(1, READY), (5, _pr_w), (8, _pr_s), (11, _pr_s), (20, READY)])

_pl_w = mix(READY, Hips=J(flex=6, twist=8), Spine=J(flex=3, twist=22), Chest=J(flex=2, twist=26), Head=J(flex=-3, twist=-40),
            _lf=(0.12, 0.2, 0.0), _rf=(0.15, -0.3, 0.0), _lw=(0.3, 0.0, -0.38), _rw=(-0.1, 0.6, -0.3))
_pl_w.pop('_spear')
_pl_s = mix(_pl_w, Hips=J(flex=14, twist=-8), Spine=J(flex=7, twist=-18), Chest=J(flex=5, twist=-20), Head=J(flex=-3, twist=26),
            _lf=(0.08, 0.2, 0.0), _rf=(0.15, 0.7, 0.0), _lw=(-0.1, 1.0, -0.1), _rw=(0.3, 0.0, -0.5))
clip('punch_l', [(1, READY), (5, _pl_w), (8, _pl_s), (11, _pl_s), (20, READY)])

# ----------------------------------------------------------------------------
# Poderes
# ----------------------------------------------------------------------------
_ps_up = mix(READY, Hips=J(flex=0), Spine=J(flex=-14), Chest=J(flex=-12), Neck=J(flex=-14), Head=J(flex=-4, twist=0),
             _lf=(0.18, 0.18, 0.0), _rf=(0.25, -0.18, 0.0), _rw=(0.0, 0.15, 0.95), _lw=(0.0, 0.15, 0.95), _spear=((0.0, -0.5, 0.85), (1.0, 0.0, 0.0)))
_ps_hit = mix(READY, Hips=J(flex=34), Spine=J(flex=42), Chest=J(flex=20), Neck=J(flex=-28), Head=J(flex=-6, twist=0),
              _lf=(0.18, 0.5, 0.0), _rf=(0.25, -0.35, 0.0), _rw=(0.05, 0.55, -0.95), _lw=(0.05, 0.55, -0.95), _spear=((0.0, -1.0, -0.2), UPN))
clip('power_slam', [(1, READY), (13, _ps_up), (19, _ps_up), (23, _ps_hit), (32, _ps_hit), (46, READY)])

_pc_w = mix(READY, Hips=J(flex=6, twist=-6), Spine=J(flex=3, twist=-15), Chest=J(flex=2, twist=-18), Head=J(flex=-3, twist=32),
            _lf=(0.1, 0.4, 0.0), _rf=(0.18, -0.38, 0.0), _lw=(0.2, 0.1, -0.55), _rw=(-0.05, 0.1, -0.4),
            _spear=((0.0, -0.4, 0.9), (0.0, 0.9, 0.4)))
_pc_c = mix(READY, Hips=J(flex=10, twist=6), Spine=J(flex=5, twist=10), Chest=J(flex=3, twist=12), Head=J(flex=-4, twist=-14),
            _lf=(0.1, 0.65, 0.0), _rf=(0.18, -0.35, 0.0), _lw=(0.05, 1.0, 0.0), _rw=(0.1, 0.0, -0.5),
            _spear=((0.0, -0.4, 0.9), (0.0, 0.9, 0.4)))
clip('power_cast', [(1, READY), (9, _pc_w), (13, _pc_c), (26, _pc_c), (38, READY)])

_pr_a = mix(READY, Hips=J(flex=-2), Spine=J(flex=-18), Chest=J(flex=-14), Neck=J(flex=-26), Head=J(flex=-4, twist=0),
            _lf=(0.25, 0.2, 0.0), _rf=(0.3, -0.2, 0.0), _rw=(0.38, 0.1, 0.95), _lw=(0.38, 0.1, 0.95),
            _spear=((0.1, -0.2, 0.97), (1.0, 0.0, 0.0)))
_pr_b = mix(_pr_a, Spine=J(flex=-20), Chest=J(flex=-15), Neck=J(flex=-30), _rw=(0.36, 0.08, 0.98), _lw=(0.4, 0.08, 0.98))
clip('power_raise', [(1, READY), (14, _pr_a), (24, _pr_b), (34, _pr_a), (46, _pr_b), (62, READY)])

_pch_a = mix(READY, Hips=J(flex=8, twist=-4), Spine=J(flex=5, twist=-8), Chest=J(flex=3, twist=-10), Head=J(flex=-3, twist=20),
             _lf=(0.12, 0.55, 0.0), _rf=(0.2, -0.4, 0.0), _lw=(0.1, 0.96, -0.04), _rw=(0.05, 0.15, -0.45),
             _spear=((0.0, -0.5, 0.86), (0.0, 0.86, 0.5)))
_pch_b = mix(_pch_a, _lw=(0.12, 0.94, -0.02), Chest=J(flex=4, twist=-10))
clip('power_channel-loop', [(1, _pch_a), (6, _pch_b), (11, _pch_a), (16, _pch_b), (21, _pch_a)], loop=True)

_sn_up = mix(READY, Hips=J(flex=2, twist=-6), Spine=J(flex=-2, twist=-10), Chest=J(flex=-2, twist=-12), Head=J(flex=-4, twist=24),
             _lf=(0.12, 0.3, 0.0), _rf=(0.2, -0.3, 0.0), _lw=(0.0, 0.5, 0.4), _rw=(0.05, 0.1, -0.55),
             _spear=((0.0, -0.3, 0.95), (0.0, 0.95, 0.3)))
_sn_snap = mix(_sn_up, _lw=(0.05, 0.7, 0.28), Head=J(flex=2, twist=14), Spine=J(flex=4, twist=-4), Chest=J(flex=3, twist=-6))
_sn_drop = mix(READY, Hips=J(flex=8, twist=-2), Spine=J(flex=8, twist=-2), Chest=J(flex=5, twist=-4), Head=J(flex=6, twist=10),
               _lw=(0.2, 0.3, -0.6), _rw=(0.05, 0.1, -0.6), _spear=((0.0, -0.3, 0.95), (0.0, 0.95, 0.3)))
clip('snap', [(1, READY), (12, _sn_up), (30, _sn_up), (33, _sn_snap), (38, _sn_drop), (52, _sn_drop), (66, READY)])

_rg_in = mix(READY, Hips=J(flex=16), Spine=J(flex=20), Chest=J(flex=14), Neck=J(flex=-4), Head=J(flex=4, twist=0),
             _lf=(0.22, 0.2, 0.0), _rf=(0.3, -0.2, 0.0), _rw=(0.15, 0.3, -0.7), _lw=(0.15, 0.3, -0.7), _spear=((0.0, -0.7, 0.3), UPN))
_rg_out = mix(READY, Hips=J(flex=-4), Spine=J(flex=-18), Chest=J(flex=-14), Neck=J(flex=-34), Head=J(flex=-2, twist=0),
              _lf=(0.3, 0.2, 0.0), _rf=(0.36, -0.2, 0.0), _rw=(0.92, -0.2, 0.28), _lw=(0.92, -0.2, 0.28),
              _spear=((-0.3, -0.4, 0.86), (1.0, 0.0, 0.0)))
_rg_out2 = mix(_rg_out, Neck=J(flex=-26), Spine=J(flex=-14), Chest=J(flex=-10), _rw=(0.88, -0.15, 0.2), _lw=(0.88, -0.15, 0.2))
_rg_out3 = mix(_rg_out, Neck=J(flex=-38), Spine=J(flex=-20), _rw=(0.95, -0.22, 0.32), _lw=(0.95, -0.22, 0.32))
clip('rage', [(1, READY), (14, _rg_in), (21, _rg_out), (24, _rg_out2), (27, _rg_out3), (30, _rg_out2), (33, _rg_out3),
              (36, _rg_out2), (40, _rg_out3), (46, _rg_out), (58, _rg_out2), (74, READY)])

_ex_reach = mix(READY, Hips=J(flex=14), Spine=J(flex=15, twist=0), Chest=J(flex=8), Head=J(flex=-6),
                _lf=(0.1, 0.78, 0.0), _rf=(0.18, -0.35, 0.0), _lw=(0.1, 0.97, -0.12), _rw=(-0.05, 0.4, -0.4),
                _spear=((0.0, -0.8, 0.5), UPN))
_ex_lift = mix(READY, Hips=J(flex=-2), Spine=J(flex=-10), Chest=J(flex=-8), Neck=J(flex=-14),
               _lf=(0.14, 0.5, 0.0), _rf=(0.2, -0.3, 0.0), _lw=(0.05, 0.55, 0.92), _rw=(0.0, 0.3, 0.5),
               _spear=((0.0, -0.8, 0.5), UPN))
_ex_slam = mix(READY, Hips=J(flex=30), Spine=J(flex=26), Chest=J(flex=14), Neck=J(flex=-18),
               _lf=(0.14, 0.62, 0.0), _rf=(0.22, -0.3, 0.0), _lw=(0.05, 0.7, -0.78), _rw=(0.0, 0.5, -0.6),
               _spear=((0.0, -0.9, -0.1), UPN))
clip('execute', [(1, READY), (9, _ex_reach), (13, _ex_reach), (22, _ex_lift), (27, _ex_lift), (31, _ex_slam), (40, _ex_slam), (54, READY)])

# ----------------------------------------------------------------------------
# Reações
# ----------------------------------------------------------------------------
_hu = mix(READY, Hips=J(flex=-4), Spine=J(flex=-10, twist=-2), Chest=J(flex=-8), Neck=J(flex=-14), Head=J(flex=-6, twist=6),
          _lf=(0.1, 0.3, 0.0), _rf=(0.16, -0.35, 0.0), _rw=(0.45, 0.15, -0.45), _lw=(0.5, 0.15, -0.45), _spear=((-0.2, -0.7, 0.6), UPN))
clip('hurt', [(1, READY), (4, _hu), (8, mix(_hu, Spine=J(flex=-5), Chest=J(flex=-4))), (17, READY)])

_hb = mix(READY, Hips=J(flex=-14), Spine=J(flex=-14), Chest=J(flex=-12), Neck=J(flex=-20), Head=J(flex=-8),
          _lf=(0.14, -0.1, 0.12), _rf=(0.2, -0.65, 0.0), _rw=(0.8, -0.1, 0.1), _lw=(0.8, -0.1, 0.1), _spear=((-0.5, -0.6, 0.6), UPN))
_hb2 = mix(READY, Hips=J(flex=-6), Spine=J(flex=-6), Chest=J(flex=-5), Neck=J(flex=-10),
           _lf=(0.14, 0.0, 0.0), _rf=(0.2, -0.55, 0.0), _rw=(0.5, 0.1, -0.4), _lw=(0.5, 0.1, -0.4))
clip('hurt_big', [(1, READY), (6, _hb), (13, _hb), (20, _hb2), (34, READY)])

_st_a = mix(READY, Hips=J(flex=18, twist=0), Spine=J(flex=24, twist=0), Chest=J(flex=14), Neck=J(flex=10), Head=J(flex=24, twist=-6),
            _lf=(0.14, 0.25, 0.0), _rf=(0.2, -0.25, 0.0), _rw=(0.18, 0.15, -0.9), _lw=(0.18, 0.15, -0.9), _spear=((0.0, -0.2, -0.98), UPN))
_st_b = mix(_st_a, Spine=J(flex=22, abd=9), Chest=J(flex=12, abd=6), Head=J(flex=22, twist=10, abd=0))
_st_c = mix(_st_a, Spine=J(flex=22, abd=-9), Chest=J(flex=12, abd=-6), Head=J(flex=22, twist=-18))
clip('stun-loop', [(1, _st_a), (11, _st_b), (21, _st_a), (31, _st_c), (41, _st_a)], loop=True)

_dt_hit = mix(_hb)
_dt_knee = mix(READY, Hips=J(flex=20), Spine=J(flex=18), Chest=J(flex=12), Neck=J(flex=0), Head=J(flex=10),
               _lf=(0.14, 0.35, 0.0), _rf=(0.2, -0.55, 0.0), _rw=(0.3, 0.2, -0.8), _lw=(0.3, 0.2, -0.8), _spear=((0.0, -0.9, -0.2), UPN))
_dt_tip = {
    'Hips': J(flex=-40, loc=(0.0, 0.25, -0.9)), 'Spine': J(flex=-12), 'Chest': J(flex=-10), 'Neck': J(flex=-8), 'Head': J(flex=-4),
    '_lf': (0.14, 0.2, 0.25), '_rf': (0.2, -0.1, 0.1),
    '_rw': (0.6, 0.0, -0.4), '_lw': (0.6, 0.0, -0.4), '_spear': ((-0.5, -0.8, 0.2), UPN), '_ground': False,
}
_dt_lie = {
    'Hips': J(flex=-88, loc=(0.0, 0.9, -1.12)), 'Spine': J(flex=-4), 'Chest': J(flex=-3), 'Neck': J(flex=-6), 'Head': J(flex=-2, twist=18),
    '_lf': (0.16, 0.55, 0.55), '_rf': (0.22, 0.25, 0.3),
    '_rw': (0.7, -0.25, -0.15), '_lw': (0.7, -0.15, -0.2), '_spear': ((-1.0, 0.1, 0.0), UPN), '_ground': False,
}
clip('death', [(1, READY), (7, _dt_hit), (22, _dt_knee), (40, _dt_tip), (58, _dt_lie), (72, _dt_lie)])

_sp_land = mix(READY, Hips=J(flex=36), Spine=J(flex=30), Chest=J(flex=18), Neck=J(flex=-12),
               _lf=(0.14, 0.45, 0.0), _rf=(0.24, -0.4, 0.0), _rw=(0.35, 0.55, -0.95), _lw=(0.3, 0.5, -0.95), _spear=((0.0, -1.0, 0.0), UPN))
_sp_rise = mix(READY, Hips=J(flex=14), Spine=J(flex=10), Chest=J(flex=6),
               _lf=(0.14, 0.42, 0.0), _rf=(0.2, -0.35, 0.0), _rw=(0.6, 0.2, -0.3), _lw=(0.6, 0.2, -0.3), _spear=((-0.4, -0.8, 0.3), UPN))
clip('spawn', [(1, _sp_land), (22, _sp_land), (36, _sp_rise), (48, READY)])

_vc_up = mix(READY, Hips=J(flex=-2), Spine=J(flex=-12), Chest=J(flex=-10), Neck=J(flex=-22), Head=J(flex=-2, twist=0),
             _lf=(0.2, 0.3, 0.0), _rf=(0.26, -0.3, 0.0), _rw=(0.12, 0.2, 1.0), _lw=(0.38, 0.2, 0.9), _spear=((0.0, -0.2, 0.98), (1.0, 0.0, 0.0)))
clip('victory', [(1, READY), (16, _vc_up), (32, mix(_vc_up, Neck=J(flex=-26))), (66, _vc_up)])

# ----------------------------------------------------------------------------
# Atirador (arma de fogo/besta na mão direita, apoiada pela esquerda)
# ----------------------------------------------------------------------------
_sh_a = mix(READY, Hips=J(flex=6, twist=-8), Spine=J(flex=3, twist=-14), Chest=J(flex=2, twist=-16), Head=J(flex=-2, twist=28),
            _lf=(0.1, 0.45, 0.0), _rf=(0.18, -0.35, 0.0), _rw=(0.02, 0.7, 0.0), _lw=(-0.05, 0.78, -0.1),
            _spear=((0.0, -1.0, 0.02), UPN))
_sh_r = mix(_sh_a, Spine=J(flex=-1, twist=-14), Chest=J(flex=-2, twist=-16), _rw=(0.02, 0.5, -0.04), _lw=(-0.05, 0.6, -0.12),
            _spear=((0.0, -0.95, 0.3), UPN))
clip('shoot', [(1, _sh_a), (3, _sh_r), (7, _sh_a), (15, _sh_a)])
clip('aim_shoot-loop', [(1, _sh_a), (16, mix(_sh_a, Chest=J(flex=3, twist=-16))), (31, _sh_a)], loop=True)
