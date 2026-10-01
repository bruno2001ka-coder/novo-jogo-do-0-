"""
Armas seguradas na mão direita.  Todas são construídas no "quadro do punho":
o centro do punho direito é (gx, 0, gz) e a arma aponta para a FRENTE (-Y) em repouso,
exatamente como a lança do herói — assim os mesmos clips e o mesmo solver de arma funcionam.
As medidas estão em unidades do herói e são escaladas por Ctx.
"""
from mathutils import Vector
from common import *

GX, GZ = -0.755, 1.08
FWDV = Vector((0, -1, 0))


def _blade(B, c, M, mat, pts, thick, y0, bone='RightHand'):
    """Lâmina plana (plano XY, normal Z). pts = [(x, distancia_a_frente)], y0 = onde começa à frente do punho."""
    P, r = c.P, c.r
    B.prism([(x * c.kx, (y0 + y) * c.kx) for x, y in pts], r(thick), P(GX, 0, GZ), mat,
            bone=bone, normal=UP, up=FWDV, sharp_angle=25)


def build_sword(B, c, M, st):
    P, r = c.P, c.r
    bone = 'RightHand'
    B.loft([P(GX, 0.30, GZ), P(GX, -0.12, GZ)], [r(0.036)] * 2, [r(0.036)] * 2, M['leather'], bone=bone, n=8, hint=LAT)
    B.ellipsoid(P(GX, 0.33, GZ), (r(0.05), r(0.05), r(0.05)), M['trim'], bone=bone, rings=4, n=8)
    B.box(P(GX, -0.14, GZ), (r(0.34), r(0.06), r(0.07)), M['trim'], bone=bone, round_r=r(0.015), hint=LAT, axis=UP)
    blade = [(0.0, 0.0), (0.075, 0.03), (0.08, 0.9), (0.045, 1.3), (0.0, 1.52), (-0.045, 1.3), (-0.08, 0.9), (-0.075, 0.03)]
    _blade(B, c, M, M['steel'], blade, 0.022, 0.14)
    core = [(0.0, 0.05), (0.018, 0.2), (0.018, 1.2), (0.0, 1.38), (-0.018, 1.2), (-0.018, 0.2)]
    _blade(B, c, M, M['glow'], core, 0.03, 0.14)


def build_greatsword(B, c, M, st):
    P, r = c.P, c.r
    bone = 'RightHand'
    B.loft([P(GX, 0.4, GZ), P(GX, -0.15, GZ)], [r(0.045)] * 2, [r(0.045)] * 2, M['leather'], bone=bone, n=8, hint=LAT)
    B.ellipsoid(P(GX, 0.45, GZ), (r(0.07), r(0.07), r(0.07)), M['trim'], bone=bone, rings=4, n=8)
    B.box(P(GX, -0.18, GZ), (r(0.5), r(0.09), r(0.1)), M['trim'], bone=bone, round_r=r(0.02), hint=LAT, axis=UP)
    for sx in (1, -1):
        B.horn(P(GX + sx * 0.25 * c.kx, -0.18, GZ), Vector((sx, 0.4, 0)), c.kz * 0.3, -0.4, r(0.05), M['trim'], bone=bone,
               side=Vector((0, 0, 1)), steps=5, n=8)
    blade = [(0.0, 0.0), (0.16, 0.05), (0.17, 0.5), (0.13, 0.7), (0.19, 1.0), (0.14, 1.5), (0.0, 2.2), (-0.14, 1.5), (-0.19, 1.0), (-0.13, 0.7), (-0.17, 0.5), (-0.16, 0.05)]
    _blade(B, c, M, M['armor'], blade, 0.04, 0.2)
    core = [(0.0, 0.1), (0.05, 0.5), (0.04, 1.4), (0.0, 2.0), (-0.04, 1.4), (-0.05, 0.5)]
    _blade(B, c, M, M['glow'], core, 0.05, 0.2)


def build_hammer(B, c, M, st):
    P, r = c.P, c.r
    bone = 'RightHand'
    B.loft([P(GX, 0.7, GZ), P(GX, -1.0, GZ)], [r(0.05)] * 2, [r(0.05)] * 2, M['wood'], bone=bone, n=10, hint=LAT)
    for y in (0.5, 0.0, -0.5):
        B.loft([P(GX, y, GZ), P(GX, y - 0.06, GZ)], [r(0.065)] * 2, [r(0.065)] * 2, M['trim'], bone=bone, n=10, hint=LAT)
    B.box(P(GX, -1.25, GZ), (r(0.85), r(0.5), r(0.42)), M['armor'], bone=bone, round_r=r(0.05), hint=LAT, axis=UP, sharp_angle=40)
    for sx in (1, -1):
        B.box(P(GX + sx * 0.44 * c.kx, -1.25, GZ), (r(0.08), r(0.54), r(0.46)), M['trim'], bone=bone, round_r=r(0.02), hint=LAT, axis=UP)
        B.ellipsoid(P(GX + sx * 0.2 * c.kx, -1.25, GZ + 0.215 * c.kz), (r(0.1), r(0.1), r(0.03)), M['glow'], bone=bone, rings=4, n=8)
    B.cone(P(GX, -1.0, GZ), P(GX, -0.8, GZ), r(0.07), M['trim'], bone=bone, n=8, hint=LAT)


def build_rifle(B, c, M, st):
    P, r = c.P, c.r
    bone = 'RightHand'
    B.box(P(GX, -0.05, GZ), (r(0.10), r(0.8), r(0.15)), M['armor'], bone=bone, round_r=r(0.02), hint=LAT, axis=UP)
    B.box(P(GX, 0.38, GZ - 0.02 * c.kz), (r(0.09), r(0.22), r(0.2)), M['armor2'], bone=bone, round_r=r(0.02), hint=LAT, axis=UP)
    B.loft([P(GX, -0.45, GZ), P(GX, -1.05, GZ)], [r(0.035)] * 2, [r(0.035)] * 2, M['steel'], bone=bone, n=10, hint=LAT)
    B.loft([P(GX, -1.0, GZ), P(GX, -1.1, GZ)], [r(0.05)] * 2, [r(0.05)] * 2, M['trim'], bone=bone, n=10, hint=LAT)
    B.ellipsoid(P(GX, -1.13, GZ), (r(0.04), r(0.04), r(0.04)), M['glow'], bone=bone, rings=4, n=8)
    B.box(P(GX, -0.12, GZ + 0.115 * c.kz), (r(0.06), r(0.34), r(0.06)), M['armor2'], bone=bone, round_r=r(0.012), hint=LAT, axis=UP)
    B.ellipsoid(P(GX, -0.28, GZ + 0.115 * c.kz), (r(0.03), r(0.03), r(0.03)), M['glow'], bone=bone, rings=4, n=8)
    B.box(P(GX, -0.1, GZ - 0.15 * c.kz), (r(0.07), r(0.14), r(0.17)), M['armor2'], bone=bone, round_r=r(0.015), hint=LAT, axis=UP)
    B.box(P(GX, -0.4, GZ), (r(0.12), r(0.22), r(0.12)), M['glow'], bone=bone, round_r=r(0.02), hint=LAT, axis=UP)


def build_halberd(B, c, M, st):
    P, r = c.P, c.r
    bone = 'RightHand'
    y_butt, y_head = 1.1, -1.7
    B.loft([P(GX, y_butt, GZ), P(GX, y_head, GZ)], [r(0.04)] * 2, [r(0.04)] * 2, M['armor'], bone=bone, n=10, hint=LAT)
    for y in (0.8, 0.2, -0.4, -1.0):
        B.loft([P(GX, y, GZ), P(GX, y - 0.06, GZ)], [r(0.052)] * 2, [r(0.052)] * 2, M['trim'], bone=bone, n=10, hint=LAT)
    B.cone(P(GX, y_butt, GZ), P(GX, y_butt + 0.3, GZ), r(0.05), M['trim'], bone=bone, n=8, hint=LAT)
    # lâmina de machado (crescente) para um lado e ponta
    axe = [(0.0, 0.0), (0.12, 0.05), (0.42, -0.1), (0.5, 0.3), (0.36, 0.62), (0.12, 0.5), (0.0, 0.55)]
    _blade(B, c, M, M['steel'], [(-x, y) for x, y in axe], 0.03, -y_head - 0.35)
    _blade(B, c, M, M['glow'], [(-x * 0.7 - 0.04, y * 0.8 + 0.05) for x, y in axe[1:5]], 0.04, -y_head - 0.35)
    spike = [(0.0, 0.0), (0.06, 0.05), (0.05, 0.6), (0.0, 0.9), (-0.05, 0.6), (-0.06, 0.05)]
    _blade(B, c, M, M['steel'], spike, 0.035, -y_head - 0.05)
    B.ellipsoid(P(GX, y_head - 0.05, GZ), (r(0.06), r(0.08), r(0.06)), M['glow'], bone=bone, rings=4, n=8)


WEAPONS = {
    'sword': build_sword,
    'greatsword': build_greatsword,
    'hammer': build_hammer,
    'rifle': build_rifle,
    'halberd': build_halberd,
}
