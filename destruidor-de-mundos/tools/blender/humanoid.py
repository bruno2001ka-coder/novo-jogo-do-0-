"""
Construtor paramétrico de humanoides (herói, capangas, chefes).

Todas as medidas internas estão em "unidades do herói" (3 m de altura); o estilo (`style`)
reescala altura (kz) e largura (kx) e escolhe peças de armadura.
"""
import math
from mathutils import Vector
from common import *
import rig as R
import weapons as W

# cores de joias (poder, espaço, realidade, tempo, alma, mente)
GEM_COLORS = {
    'power':   (0.62, 0.10, 0.95),
    'space':   (0.10, 0.45, 1.00),
    'reality': (1.00, 0.08, 0.10),
    'time':    (0.15, 0.95, 0.35),
    'soul':    (1.00, 0.50, 0.05),
    'mind':    (1.00, 0.90, 0.10),
}


def make_materials(style):
    s = style
    M = {}
    M['skin'] = material(s['name'] + "_Skin", s['skin'], 0.0, 0.55)
    M['skin_dark'] = material(s['name'] + "_SkinDark", [c * 0.35 for c in s['skin']], 0.0, 0.7)
    M['armor'] = material(s['name'] + "_Armor", s['armor'], s.get('armor_metal', 0.85), s.get('armor_rough', 0.38))
    M['armor2'] = material(s['name'] + "_Armor2", s.get('armor2', s['armor']), s.get('armor_metal', 0.85), 0.5)
    M['trim'] = material(s['name'] + "_Trim", s['trim'], 1.0, 0.26)
    M['cloth'] = material(s['name'] + "_Cloth", s['cloth'], 0.0, 0.85)
    M['leather'] = material(s['name'] + "_Leather", (0.2, 0.13, 0.1), 0.0, 0.7)
    M['glow'] = material(s['name'] + "_Glow", s['glow'], 0.0, 0.25, emit=s['glow'], emit_strength=s.get('glow_strength', 6.0))
    M['eye'] = material(s['name'] + "_Eye", s['eye'], 0.0, 0.3, emit=s['eye'], emit_strength=10.0)
    M['steel'] = material(s['name'] + "_Steel", (0.72, 0.74, 0.8), 1.0, 0.28)
    M['wood'] = material(s['name'] + "_Wood", (0.3, 0.2, 0.14), 0.0, 0.6)
    for k, c in GEM_COLORS.items():
        M['gem_' + k] = material("Gem_" + k, c, 0.0, 0.15, emit=c, emit_strength=9.0)
    return M


class Ctx:
    """Transforma coordenadas em 'unidades do herói' para as do personagem."""

    def __init__(self, style):
        self.kx = style.get('kx', 1.0)
        self.kz = style.get('kz', 1.0)
        self.bulk = style.get('bulk', 1.0)

    def P(self, x, y, z):
        return Vector((x * self.kx, y * self.kx, z * self.kz))

    def r(self, v):               # raio de espessura
        return v * self.kx * self.bulk

    def rz(self, v):              # medida vertical
        return v * self.kz


def cover_mat(M, kind):
    return {'skin': M['skin'], 'dark': M['skin_dark'], 'cloth': M['cloth'], 'leather': M['leather'],
            'armor': M['armor2']}.get(kind, M['skin'])


def side_name(sx, base):
    return ("Left" if sx > 0 else "Right") + base


# ----------------------------------------------------------------------------
# Corpo
# ----------------------------------------------------------------------------
def build_torso(B, c, M, st):
    P, r = c.P, c.r
    zs = [
        (1.28, 0.34, 0.22), (1.45, 0.36, 0.23), (1.62, 0.31, 0.21), (1.85, 0.38, 0.24),
        (2.08, 0.47, 0.27), (2.28, 0.50, 0.26), (2.40, 0.26, 0.19),
    ]
    path = [P(0, 0, z) for z, _, _ in zs]
    wf = blend3('Hips', 'Spine', 'Chest', P(0, 0, 1.58), P(0, 0, 1.95), UP, c.rz(0.12), c.rz(0.12))
    B.loft(path, [r(a) for _, a, _ in zs], [r(b) for _, _, b in zs], M['skin'], wfn=wf, n=18, power=2.7)
    # trapézios, peitorais e abdômen
    for sx in (1, -1):
        B.ellipsoid(P(sx * 0.22, 0.02, 2.37), (r(0.19), r(0.14), c.rz(0.10)), M['skin'], bone='Chest', rings=6, n=10)
        B.ellipsoid(P(sx * 0.20, -0.20, 2.07), (r(0.21), r(0.13), c.rz(0.15)), M['skin'], bone='Chest', rings=6, n=12)
        for zi, zz in enumerate((1.62, 1.74, 1.86)):
            B.ellipsoid(P(sx * 0.09, -0.225, zz), (r(0.082), r(0.05), c.rz(0.058)), M['skin'], bone='Spine', rings=5, n=10)
    # costas largas (dorsais)
    for sx in (1, -1):
        B.ellipsoid(P(sx * 0.26, 0.2, 2.0), (r(0.2), r(0.1), c.rz(0.26)), M['skin'], bone='Chest', rings=6, n=10)


def build_legs(B, c, M, st):
    P, r = c.P, c.r
    for sx in (1, -1):
        up, lo = side_name(sx, 'UpperLeg'), side_name(sx, 'LowerLeg')
        pts = [(0.25, 1.46), (0.255, 1.20), (0.26, 0.96), (0.27, 0.72), (0.275, 0.50), (0.28, 0.30), (0.28, 0.16)]
        rxs = [0.25, 0.27, 0.24, 0.19, 0.20, 0.15, 0.11]
        rys = [0.23, 0.26, 0.23, 0.18, 0.21, 0.15, 0.11]
        path = [P(sx * a, 0, z) for a, z in pts]
        wf = blend3('Hips', up, lo, P(sx * 0.25, 0, 1.40), P(sx * 0.27, 0, 0.72), -UP, c.rz(0.10), c.rz(0.11))
        B.loft(path, [r(a) for a in rxs], [r(a) for a in rys], cover_mat(M, st.get('legs', 'skin')),
               wfn=wf, n=16, power=2.2, hint=LAT)


def build_arms(B, c, M, st):
    P, r = c.P, c.r
    for sx in (1, -1):
        up, lo = side_name(sx, 'UpperArm'), side_name(sx, 'LowerArm')
        pts = [(0.48, 2.30), (0.54, 2.10), (0.58, 1.90), (0.63, 1.72), (0.67, 1.55), (0.71, 1.38), (0.745, 1.22)]
        rxs = [0.19, 0.205, 0.20, 0.15, 0.17, 0.145, 0.115]
        rys = [0.19, 0.21, 0.20, 0.15, 0.17, 0.14, 0.115]
        path = [P(sx * a, 0, z) for a, z in pts]
        wf = blend_weights(up, lo, P(sx * 0.63, 0, 1.72), -UP, c.rz(0.10))
        amat = cover_mat(M, st.get('arms', 'skin'))
        B.loft(path, [r(a) for a in rxs], [r(a) for a in rys], amat, wfn=wf, n=14, power=2.1, hint=FWD)
        # deltoide
        B.ellipsoid(P(sx * 0.52, 0, 2.27), (r(0.2), r(0.2), c.rz(0.17)), amat, bone=up, rings=6, n=12)


def build_hands(B, c, M, st):
    P, r = c.P, c.r
    for sx in (1, -1):
        hand = side_name(sx, 'Hand')
        cx, cz = 0.76, 1.08
        left = sx > 0
        if left and st.get('gauntlet', False):
            build_gauntlet(B, c, M, st)
            continue
        # punho fechado (palma + dedos enrolados)
        B.box(P(sx * cx, 0, cz), (r(0.22), r(0.21), c.rz(0.2)), M['skin'], bone=hand, round_r=r(0.05), smooth=True, sharp_angle=None, power=3.5)
        for i in range(4):
            y = -0.075 + i * 0.05
            B.ellipsoid(P(sx * (cx + 0.085), y, cz - 0.01), (r(0.045), r(0.027), c.rz(0.085)), M['skin'], bone=hand, rings=4, n=8)
        B.ellipsoid(P(sx * (cx - 0.02), -0.12, cz + 0.07), (r(0.05), r(0.06), c.rz(0.05)), M['skin'], bone=hand, rings=4, n=8)
        if st.get('hand_armor', True):
            B.box(P(sx * (cx + 0.1), 0, cz + 0.05), (r(0.05), r(0.22), c.rz(0.12)), M['trim'], bone=hand, round_r=r(0.012))


def build_gauntlet(B, c, M, st):
    """Manopla cósmica da mão esquerda, com as 6 joias."""
    P, r = c.P, c.r
    hand = 'LeftHand'
    cx, cz = 0.76, 1.07
    # corpo da manopla
    B.box(P(cx, 0, cz), (r(0.27), r(0.30), c.rz(0.30)), M['trim'], bone=hand, round_r=r(0.05), sharp_angle=40)
    B.box(P(cx - 0.02, 0, cz + 0.17), (r(0.25), r(0.26), c.rz(0.1)), M['armor'], bone=hand, round_r=r(0.03))
    # dedos (blindados) e polegar
    for i in range(4):
        y = -0.105 + i * 0.07
        B.box(P(cx + 0.04, y, cz - 0.20), (r(0.15), r(0.058), c.rz(0.17)), M['trim'], bone=hand, round_r=r(0.014))
        B.box(P(cx + 0.04, y, cz - 0.27), (r(0.14), r(0.05), c.rz(0.07)), M['armor'], bone=hand, round_r=r(0.012))
    B.box(P(cx - 0.13, -0.12, cz - 0.02), (r(0.07), r(0.07), c.rz(0.17)), M['trim'], bone=hand, round_r=r(0.012), hint=LAT, axis=Vector((0, -0.3, 1)))
    # arco de joias no dorso da mão (lado de fora = +X para o braço esquerdo)
    gem_keys = ['power', 'space', 'reality', 'time', 'soul', 'mind']
    for i, key in enumerate(gem_keys):
        t = i / 5.0
        y = -0.115 + t * 0.23
        zz = cz + 0.10 - (abs(t - 0.5) * 2.0) ** 2 * 0.07 - 0.0
        pos = P(cx + 0.145, y, zz - 0.02)
        B.ellipsoid(pos, (r(0.032), r(0.036), c.rz(0.036)), M['trim'], bone=hand, rings=4, n=8, hint=FWD, axis=LAT)
        B.ellipsoid(pos + Vector((0.025 * c.kx, 0, 0)), (r(0.026), r(0.03), c.rz(0.03)), M['gem_' + key], bone=hand, rings=4, n=8, hint=FWD, axis=LAT)


# ----------------------------------------------------------------------------
# Armaduras
# ----------------------------------------------------------------------------
def build_armor_chest(B, c, M, st):
    P, r = c.P, c.r
    kind = st.get('chest', 'cuirass')
    if kind == 'none':
        return
    wf = blend_weights('Spine', 'Chest', P(0, 0, 1.93), UP, c.rz(0.05))
    if kind in ('cuirass', 'heavy'):
        zs = [(1.87, 0.40, 0.275), (2.0, 0.46, 0.29), (2.15, 0.53, 0.30), (2.30, 0.55, 0.28), (2.37, 0.40, 0.23)]
        if st.get('cover_abs'):
            zs = [(1.50, 0.385, 0.262), (1.68, 0.34, 0.24)] + zs
        path = [P(0, 0, z) for z, _, _ in zs]
        B.loft(path, [r(a) for _, a, _ in zs], [r(b) for _, _, b in zs], M['armor'], wfn=wf, n=20, power=3.2, sharp_angle=50)
        # frisos dourados
        B.loft([P(0, 0, 1.86), P(0, 0, 1.915)], [r(0.415), r(0.415)], [r(0.285), r(0.285)], M['trim'], wfn=wf, n=20, power=3.2, sharp_angle=60)
        B.loft([P(0, 0, 2.355), P(0, 0, 2.395)], [r(0.43), r(0.41)], [r(0.25), r(0.235)], M['trim'], bone='Chest', n=20, power=3.0, sharp_angle=60)
        # nervura central
        B.box(P(0, -0.305, 2.10), (r(0.05), r(0.035), c.rz(0.46)), M['trim'], bone='Chest', round_r=r(0.012))
        # placas peitorais com bordas
        for sx in (1, -1):
            B.box(P(sx * 0.23, -0.285, 2.10), (r(0.32), r(0.045), c.rz(0.30)), M['armor2'], bone='Chest', round_r=r(0.02), hint=LAT, axis=Vector((sx * 0.25, 0, 1)))
            B.box(P(sx * 0.23, -0.30, 1.97), (r(0.30), r(0.03), c.rz(0.04)), M['trim'], bone='Chest', round_r=r(0.01))
        # joia do peito
        B.ellipsoid(P(0, -0.31, 2.12), (r(0.085), r(0.04), c.rz(0.115)), M['trim'], bone='Chest', rings=5, n=10, hint=LAT)
        B.ellipsoid(P(0, -0.33, 2.12), (r(0.06), r(0.03), c.rz(0.09)), M['glow'], bone='Chest', rings=5, n=10, hint=LAT)
        # gorjal
        B.loft([P(0, 0.0, 2.33), P(0, 0.0, 2.50)], [r(0.31), r(0.2)], [r(0.25), r(0.18)], M['trim'], bone='Chest', n=18, power=3.0, sharp_angle=50)
    elif kind == 'leather':
        zs = [(1.46, 0.385, 0.262), (1.68, 0.335, 0.238), (1.9, 0.405, 0.262), (2.1, 0.485, 0.288), (2.3, 0.515, 0.272), (2.38, 0.36, 0.22)]
        path = [P(0, 0, z) for z, _, _ in zs]
        wf3 = blend3('Hips', 'Spine', 'Chest', P(0, 0, 1.58), P(0, 0, 1.95), UP, c.rz(0.12), c.rz(0.12))
        B.loft(path, [r(a) for _, a, _ in zs], [r(b) for _, _, b in zs], M['leather'], wfn=wf3, n=18, power=2.6)
        B.box(P(0, -0.285, 2.05), (r(0.07), r(0.03), c.rz(0.6)), M['trim'], bone='Chest', round_r=r(0.01))
        B.loft([P(0, 0, 1.9), P(0, 0, 1.94)], [r(0.41), r(0.41)], [r(0.266), r(0.266)], M['trim'], wfn=wf, n=18, power=2.6)
    # costas
    B.box(P(0, 0.27, 2.12), (r(0.46), r(0.05), c.rz(0.38)), M['armor2'], bone='Chest', round_r=r(0.02))


def build_armor_shoulders(B, c, M, st):
    P, r = c.P, c.r
    kind = st.get('pauldron', 'spiked')
    if kind == 'none':
        return
    for sx in (1, -1):
        up = side_name(sx, 'UpperArm')
        tilt = Vector((sx * 0.38, 0, 0.93))
        if kind in ('spiked', 'plate', 'round'):
            B.ellipsoid(P(sx * 0.56, 0, 2.38), (r(0.27), r(0.29), c.rz(0.17)), M['armor'], bone=up, rings=7, n=16, axis=tilt, hint=FWD, sharp_angle=45)
            B.ellipsoid(P(sx * 0.585, 0, 2.27), (r(0.28), r(0.30), c.rz(0.10)), M['armor2'], bone=up, rings=6, n=16, axis=tilt, hint=FWD)
            B.ellipsoid(P(sx * 0.61, 0, 2.16), (r(0.26), r(0.28), c.rz(0.075)), M['armor'], bone=up, rings=6, n=16, axis=tilt, hint=FWD)
            B.ellipsoid(P(sx * 0.56, 0, 2.395), (r(0.30), r(0.32), c.rz(0.03)), M['trim'], bone=up, rings=4, n=18, axis=tilt, hint=FWD)
        if kind == 'spiked':
            for i, (ox, oy, oz, ln) in enumerate(((0.43, 0.0, 2.54, 0.42), (0.57, -0.10, 2.53, 0.34), (0.57, 0.10, 2.53, 0.34), (0.70, 0.0, 2.45, 0.30))):
                B.horn(P(sx * ox, oy, oz), Vector((sx * 0.45, oy * 0.8, 1.0)), c.kz * ln, 0.18, r(0.055), M['trim'], bone=up,
                       side=Vector((sx * 1.0, 0, 0)), steps=6, n=8)
        elif kind == 'round':
            B.ellipsoid(P(sx * 0.57, 0, 2.5), (r(0.09), r(0.09), c.rz(0.09)), M['glow'], bone=up, rings=4, n=8)


def build_armor_arms(B, c, M, st):
    P, r = c.P, c.r
    kind = st.get('bracer', 'plate')
    if kind == 'none':
        return
    for sx in (1, -1):
        lo = side_name(sx, 'LowerArm')
        # braçadeira: tubo cônico do cotovelo ao pulso
        path = [P(sx * 0.655, 0, 1.64), P(sx * 0.70, 0, 1.46), P(sx * 0.735, 0, 1.29)]
        B.loft(path, [r(0.185), r(0.16), r(0.135)], [r(0.185), r(0.16), r(0.135)], M['armor'], bone=lo, n=14, power=2.6, sharp_angle=50)
        B.loft([P(sx * 0.66, 0, 1.655), P(sx * 0.665, 0, 1.62)], [r(0.2), r(0.2)], [r(0.2), r(0.2)], M['trim'], bone=lo, n=14)
        B.loft([P(sx * 0.742, 0, 1.31), P(sx * 0.746, 0, 1.26)], [r(0.145), r(0.145)], [r(0.145), r(0.145)], M['trim'], bone=lo, n=14)
        B.horn(P(sx * 0.66, 0.1, 1.72), Vector((sx * 0.2, 1.0, 0.1)), c.kz * 0.2, 0.0, r(0.05), M['trim'], bone=lo, side=Vector((sx, 0, 0)), steps=4, n=8)
        # cotoveleira
        B.ellipsoid(P(sx * 0.655, 0.02, 1.72), (r(0.14), r(0.15), c.rz(0.1)), M['armor2'], bone=side_name(sx, 'UpperArm'), rings=5, n=10)


def build_armor_legs(B, c, M, st):
    P, r = c.P, c.r
    for sx in (1, -1):
        up, lo, foot, toes = side_name(sx, 'UpperLeg'), side_name(sx, 'LowerLeg'), side_name(sx, 'Foot'), side_name(sx, 'Toes')
        # coxote
        B.box(P(sx * 0.27, -0.215, 1.04), (r(0.30), r(0.06), c.rz(0.44)), M['armor'], bone=up, round_r=r(0.025), hint=LAT, sharp_angle=40)
        B.box(P(sx * 0.27, -0.235, 1.28), (r(0.30), r(0.04), c.rz(0.04)), M['trim'], bone=up, round_r=r(0.01))
        # joelheira com espinho
        B.ellipsoid(P(sx * 0.275, -0.17, 0.72), (r(0.185), r(0.12), c.rz(0.15)), M['armor'], bone=lo, rings=6, n=12)
        B.horn(P(sx * 0.275, -0.26, 0.72), Vector((0, -1.0, 0.25)), c.kz * 0.24, 0.0, r(0.06), M['trim'], bone=lo, side=Vector((sx, 0, 0)), steps=4, n=8)
        # grevas
        B.box(P(sx * 0.28, -0.1, 0.42), (r(0.25), r(0.09), c.rz(0.50)), M['armor'], bone=lo, round_r=r(0.03), hint=LAT, sharp_angle=40, taper=(0.8, 0.8))
        B.box(P(sx * 0.28, -0.14, 0.2), (r(0.22), r(0.04), c.rz(0.04)), M['trim'], bone=lo, round_r=r(0.01))
        # bota
        B.box(P(sx * 0.28, -0.02, 0.27), (r(0.30), r(0.30), c.rz(0.26)), M['armor2'], bone=lo, round_r=r(0.04), hint=LAT, sharp_angle=40)
        B.box(P(sx * 0.28, -0.22, 0.08), (r(0.30), r(0.50), c.rz(0.16)), M['armor'], bone=foot, round_r=r(0.045), hint=LAT, axis=UP, sharp_angle=40)
        B.box(P(sx * 0.28, -0.47, 0.055), (r(0.26), r(0.12), c.rz(0.11)), M['trim'], bone=toes, round_r=r(0.03), hint=LAT, axis=UP)


def build_belt(B, c, M, st):
    P, r = c.P, c.r
    if st.get('belt', True) is False:
        return
    B.loft([P(0, 0, 1.38), P(0, 0, 1.52)], [r(0.385), r(0.385)], [r(0.26), r(0.26)], M['leather'], bone='Hips', n=20, power=3.5, sharp_angle=50)
    B.loft([P(0, 0, 1.51), P(0, 0, 1.54)], [r(0.395), r(0.395)], [r(0.27), r(0.27)], M['trim'], bone='Hips', n=20, power=3.5, sharp_angle=60)
    B.box(P(0, -0.275, 1.45), (r(0.22), r(0.05), c.rz(0.17)), M['trim'], bone='Hips', round_r=r(0.015))
    B.ellipsoid(P(0, -0.30, 1.45), (r(0.05), r(0.03), c.rz(0.06)), M['glow'], bone='Hips', rings=4, n=8, hint=LAT)
    # faldas
    B.box(P(0, -0.27, 1.14), (r(0.30), r(0.03), c.rz(0.50)), M['cloth'], bone='Hips', round_r=r(0.01), taper=(0.75, 1.0))
    B.box(P(0, 0.25, 1.12), (r(0.40), r(0.03), c.rz(0.56)), M['cloth'], bone='Hips', round_r=r(0.01), taper=(0.7, 1.0))
    for sx in (1, -1):
        B.box(P(sx * 0.37, 0.0, 1.22), (r(0.04), r(0.28), c.rz(0.34)), M['armor'], bone='Hips', round_r=r(0.012), hint=LAT, taper=(1.0, 0.8))


# ----------------------------------------------------------------------------
# Cabeça
# ----------------------------------------------------------------------------
def build_head(B, c, M, st):
    P, r = c.P, c.r
    face_fn = st.get('face', 'titan')
    # pescoço
    B.loft([P(0, 0, 2.36), P(0, 0.01, 2.62)], [r(0.15), r(0.13)], [r(0.14), r(0.13)], M['skin'], wfn=blend_weights('Neck', 'Head', P(0, 0, 2.54), UP, c.rz(0.05)), n=12)
    hz = 2.74
    # crânio, mandíbula, queixo, sobrancelha, bochechas
    B.ellipsoid(P(0, 0.025, hz + 0.04), (r(0.19), r(0.215), c.rz(0.23)), M['skin'], bone='Head', rings=8, n=16)
    B.ellipsoid(P(0, -0.07, hz - 0.12), (r(0.165), r(0.165), c.rz(0.115)), M['skin'], bone='Head', rings=6, n=14)
    B.ellipsoid(P(0, -0.145, hz - 0.185), (r(0.095), r(0.075), c.rz(0.075)), M['skin'], bone='Head', rings=5, n=10)
    B.ellipsoid(P(0, -0.15, hz + 0.065), (r(0.20), r(0.06), c.rz(0.045)), M['skin_dark'], bone='Head', rings=5, n=12)
    for sx in (1, -1):
        B.ellipsoid(P(sx * 0.115, -0.13, hz - 0.03), (r(0.075), r(0.06), c.rz(0.05)), M['skin'], bone='Head', rings=5, n=10)
        B.ellipsoid(P(sx * 0.20, 0.03, hz + 0.0), (r(0.03), r(0.045), c.rz(0.06)), M['skin'], bone='Head', rings=4, n=8)     # orelhas
        # olhos brilhantes
        B.box(P(sx * 0.07, -0.195, hz + 0.02), (r(0.08), r(0.02), c.rz(0.028)), M['eye'], bone='Head', round_r=r(0.006), hint=Vector((1, 0, sx * -0.25)), n=10)
    # nariz e boca
    B.prism([(-0.03, -0.06), (0.03, -0.06), (0.012, 0.07), (-0.012, 0.07)], r(0.04), P(0, -0.2, hz - 0.045), M['skin'], bone='Head', normal=LAT, up=UP)
    B.box(P(0, -0.178, hz - 0.115), (r(0.12), r(0.02), c.rz(0.014)), M['skin_dark'], bone='Head', round_r=r(0.004), n=10)
    # elmo / coroa
    helm = st.get('helmet', 'crown')
    if helm == 'none':
        return
    if helm in ('crown', 'horned'):
        B.ellipsoid(P(0, 0.05, hz + 0.115), (r(0.215), r(0.235), c.rz(0.16)), M['trim'] if helm == 'crown' else M['armor'], bone='Head', rings=7, n=18, sharp_angle=None)
        B.loft([P(0, -0.0, hz + 0.075), P(0, 0.0, hz + 0.115)], [r(0.215), r(0.215)], [r(0.235), r(0.235)], M['armor'], bone='Head', n=18)
        # aba lateral (bochechas do elmo)
        for sx in (1, -1):
            B.box(P(sx * 0.2, -0.05, hz - 0.01), (r(0.045), r(0.2), c.rz(0.26)), M['trim'], bone='Head', round_r=r(0.012), hint=LAT)
        # crista central
        B.prism([(-0.22, 0.0), (0.18, 0.0), (0.12, 0.2), (-0.02, 0.27), (-0.16, 0.2)], r(0.03), P(0, 0.06, hz + 0.27), M['armor'], bone='Head', normal=LAT, up=UP)
        # asas / chifres varridos para trás
        for sx in (1, -1):
            B.horn(P(sx * 0.19, 0.0, hz + 0.17), Vector((sx * 0.55, 0.45, 0.8)), c.kz * 0.62, 0.55 if helm == 'crown' else 0.2, r(0.065), M['trim'], bone='Head',
                   side=Vector((-sx * 0.1, 1.0, 0.0)), steps=9, n=8)
        B.ellipsoid(P(0, -0.20, hz + 0.19), (r(0.04), r(0.03), c.rz(0.05)), M['glow'], bone='Head', rings=4, n=8, hint=LAT)
    elif helm == 'visor':
        B.ellipsoid(P(0, 0.03, hz + 0.08), (r(0.215), r(0.235), c.rz(0.22)), M['armor'], bone='Head', rings=8, n=18, sharp_angle=45)
        B.box(P(0, -0.19, hz + 0.02), (r(0.30), r(0.05), c.rz(0.055)), M['eye'], bone='Head', round_r=r(0.01))
        B.prism([(-0.2, 0.0), (0.2, 0.0), (0.0, 0.2)], r(0.03), P(0, 0.05, hz + 0.27), M['trim'], bone='Head', normal=LAT, up=UP)
    elif helm == 'hood':
        B.ellipsoid(P(0, 0.06, hz + 0.05), (r(0.235), r(0.27), c.rz(0.27)), M['cloth'], bone='Head', rings=8, n=16)
    elif helm == 'spiked':
        B.ellipsoid(P(0, 0.03, hz + 0.1), (r(0.215), r(0.235), c.rz(0.19)), M['armor'], bone='Head', rings=7, n=16, sharp_angle=45)
        for i in range(5):
            a = (i - 2) * 0.35
            B.horn(P(math.sin(a) * 0.14, 0.04, hz + 0.26), Vector((math.sin(a) * 0.5, 0.15, 1.0)), c.kz * 0.2, 0.0, r(0.05), M['trim'], bone='Head', steps=4, n=8)
        B.box(P(0, -0.19, hz + 0.02), (r(0.30), r(0.04), c.rz(0.05)), M['eye'], bone='Head', round_r=r(0.01))


# ----------------------------------------------------------------------------
# Armas
# ----------------------------------------------------------------------------
def build_spear(B, c, M, st, length_front=None):
    """Lança colocada no punho direito, apontando para a FRENTE (-Y) em repouso."""
    P, r = c.P, c.r
    bone = 'RightHand'
    gx, gz = -0.755, 1.08
    y_butt, y_blade, y_tip = 0.95, -1.62, -2.20
    # haste
    B.loft([P(gx, y_butt, gz), P(gx, y_blade, gz)], [r(0.034)] * 2, [r(0.034)] * 2, M['wood'], bone=bone, n=10, hint=LAT)
    # braçadeiras douradas
    for y in (0.7, 0.2, -0.3, -0.9, -1.45):
        B.loft([P(gx, y, gz), P(gx, y - 0.05, gz)], [r(0.043)] * 2, [r(0.043)] * 2, M['trim'], bone=bone, n=10, hint=LAT)
    # contrapeso
    B.cone(P(gx, y_butt, gz), P(gx, y_butt + 0.28, gz), r(0.05), M['trim'], bone=bone, n=8, hint=LAT)
    # lâmina em folha (plano XY: horizontal em repouso); y>0 = distância para a frente
    fwd0 = -y_blade
    leaf = [(0.0, 0.0), (0.075, 0.07), (0.115, 0.22), (0.095, 0.40), (0.05, 0.50), (0.0, 0.58),
            (-0.05, 0.50), (-0.095, 0.40), (-0.115, 0.22), (-0.075, 0.07)]
    B.prism([(x * c.kx, (fwd0 + y) * c.kx) for x, y in leaf], r(0.022), P(gx, 0, gz), M['steel'],
            bone=bone, normal=UP, up=Vector((0, -1, 0)), sharp_angle=25)
    # nervura/gume brilhante central
    core = [(0.0, 0.03), (0.028, 0.12), (0.03, 0.30), (0.0, 0.50), (-0.03, 0.30), (-0.028, 0.12)]
    B.prism([(x * c.kx, (fwd0 + y) * c.kx) for x, y in core], r(0.032), P(gx, 0, gz), M['glow'],
            bone=bone, normal=UP, up=Vector((0, -1, 0)), sharp_angle=25)
    # guarda curva
    for sx in (1, -1):
        B.horn(P(gx + sx * 0.03, y_blade + 0.02, gz), Vector((sx * 1.0, 0.3, 0.0)), c.kx * 0.2, -0.5, r(0.03), M['trim'], bone=bone, side=Vector((0, 0.0, 1.0)), steps=5, n=8)
    B.ellipsoid(P(gx, y_blade - 0.02, gz), (r(0.045), r(0.06), r(0.045)), M['glow'], bone=bone, rings=4, n=8, hint=LAT, axis=Vector((0, -1, 0)))


def build_cape(B, c, M, st):
    P = c.P
    bone = 'Chest'
    top_z = 2.36
    length = (2.36 - 0.42)
    w = 1.0 * c.kx
    B.grid(P(0, 0.30, top_z), LAT, Vector((0, 0.18, -1.0)), w, length * c.kz, 10, 18, M['cape'], bone=bone,
           sag=lambda t: 1.0 + 0.45 * t)


def build_all(p, style, arm_obj, name="Body"):
    """Constrói a malha principal do humanoide (corpo + armaduras + cabeça). Retorna objetos."""
    st = dict(style)
    M = make_materials(st)
    c = Ctx(st)
    names = R.deform_bone_names(p)
    B = Builder(names)
    build_torso(B, c, M, st)
    build_legs(B, c, M, st)
    build_arms(B, c, M, st)
    build_hands(B, c, M, st)
    build_belt(B, c, M, st)
    build_armor_chest(B, c, M, st)
    build_armor_shoulders(B, c, M, st)
    build_armor_arms(B, c, M, st)
    build_armor_legs(B, c, M, st)
    build_head(B, c, M, st)
    body = B.finish(name, arm_obj)
    objs = [body]
    # arma como objeto separado (pode ser escondida, p.ex. quando a lança é arremessada)
    wk = st.get('weapon', 'spear')
    if wk == 'spear':
        B2 = Builder(names)
        build_spear(B2, c, M, st)
        objs.append(B2.finish("Spear", arm_obj))
    elif wk in W.WEAPONS:
        B2 = Builder(names)
        W.WEAPONS[wk](B2, c, M, st)
        objs.append(B2.finish("Weapon", arm_obj))
    if st.get('cape', True):
        M['cape'] = material(st['name'] + "_Cape", st['cloth'], 0.0, 0.8)
        B3 = Builder(names)
        build_cape(B3, c, M, st)
        objs.append(B3.finish("Cape", arm_obj, recalc=False))
    return objs
