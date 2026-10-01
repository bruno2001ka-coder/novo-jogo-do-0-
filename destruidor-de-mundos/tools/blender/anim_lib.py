"""
Infraestrutura de animação procedural.

* Pose  = {osso: {flex, abd, twist, loc}} em graus / metros (ver rig.Poser) + metas "_xxx".
* FK próprio (sem depender do depsgraph) -> permite:
    - "ancorar" o corpo no chão automaticamente (o pé mais baixo toca o solo),
    - achatar os pés (plant) quando apoiados,
    - IK de 2 ossos nos braços (alvo = posição do punho relativa ao ombro),
    - orientar a arma (lança/espada/arma de fogo) para uma direção do mundo (solver de punho).
* Cada clip vira uma Action gravada com keyframes e é empurrada para uma NLA track
  (o exportador glTF transforma cada track numa animação).

Metas por pose:
  _rw / _lw   : (fora, frente, cima) posição do punho em unidades de "alcance do braço"
                (fora = para longe do corpo, frente = para frente, cima = para cima), relativa ao ombro.
  _rpole/_lpole: direção do cotovelo (opcional, mesma convenção fora/trás/cima? ver abaixo).
  _spear      : (direção, normal|None) orienta a arma da mão direita (espaço do personagem).
  _ground     : True/False (padrão True)  mantém o pé mais baixo no chão
  _lift       : metros acima do chão (corrida/voo)
  _plant      : True/False/('Left',) pés paralelos ao chão
"""
import math
import bpy
from mathutils import Matrix, Vector, Quaternion
import rig as R

FWD = Vector((0, -1, 0))
UP = Vector((0, 0, 1))


# ----------------------------------------------------------------------------
# Esqueleto / FK
# ----------------------------------------------------------------------------
class Skel:
    def __init__(self, arm, p):
        self.arm = arm
        self.p = p
        self.poser = R.Poser(arm)
        bones = list(arm.data.bones)

        def depth(b):
            d = 0
            while b.parent:
                b = b.parent
                d += 1
            return d
        bones.sort(key=depth)
        self.names = [b.name for b in bones]
        self.idx = {n: i for i, n in enumerate(self.names)}
        self.parent = [self.idx[b.parent.name] if b.parent else -1 for b in bones]
        self.rest = [b.matrix_local.copy() for b in bones]
        self.rest_inv = [m.inverted() for m in self.rest]
        self.local_rest = [(self.rest_inv[self.parent[i]] @ self.rest[i]) if self.parent[i] >= 0 else self.rest[i].copy()
                           for i in range(len(bones))]
        self.length = [b.length for b in bones]
        self._qcache = {}

    # ---- rotação local de um osso a partir dos parâmetros ----
    def _semantic(self, name, v):
        key = (name, round(v.get('flex', 0.0), 3), round(v.get('abd', 0.0), 3), round(v.get('twist', 0.0), 3))
        m = self._qcache.get(key)
        if m is None:
            m = self.poser.quat(name, v.get('flex', 0.0), v.get('abd', 0.0), v.get('twist', 0.0)).to_matrix().to_4x4()
            if len(self._qcache) > 200000:
                self._qcache.clear()
            self._qcache[key] = m
        return m

    def rot4(self, name, v):
        """Matriz 4x4 de rotação local (matrix_basis sem translação)."""
        if 'Q' in v:
            q = v['Q'].to_4x4()
        else:
            q = self._semantic(name, v)
        if v.get('ytw'):
            q = q @ Matrix.Rotation(math.radians(v['ytw']), 4, 'Y')
        return q

    def basis(self, name, v):
        q = self.rot4(name, v)
        loc = v.get('loc')
        if loc is not None:
            q = Matrix.Translation(self.poser.loc(name, loc)) @ q
        return q

    def local_quat(self, name, v):
        return self.rot4(name, v).to_quaternion()

    def pose_mats(self, params):
        mats = [None] * len(self.names)
        for i, name in enumerate(self.names):
            v = params.get(name)
            q = self.basis(name, v) if v else Matrix.Identity(4)
            par = self.parent[i]
            mats[i] = (self.rest[i] @ q) if par < 0 else (mats[par] @ self.local_rest[i] @ q)
        return mats

    def point(self, mats, bone, rest_point):
        """Posição (espaço do esqueleto) de um ponto fixo no osso, dado em coordenadas de repouso."""
        i = self.idx[bone]
        return mats[i] @ (self.rest_inv[i] @ Vector(rest_point))


# ----------------------------------------------------------------------------
# Auxiliares de pose
# ----------------------------------------------------------------------------
def J(flex=0.0, abd=0.0, twist=0.0, loc=None):
    d = {}
    if flex:
        d['flex'] = float(flex)
    if abd:
        d['abd'] = float(abd)
    if twist:
        d['twist'] = float(twist)
    if loc is not None:
        d['loc'] = tuple(loc)
    return d


def mix(base, **over):
    """Cópia de `base` com os ossos/metas de `over` substituídos (cada osso é substituído por inteiro)."""
    out = {k: (dict(v) if isinstance(v, dict) else v) for k, v in base.items()}
    for key, vals in over.items():
        out[key] = dict(vals) if isinstance(vals, dict) else vals
    return out


def lerp_pose(a, b, t):
    out = {}
    bones = set(k for k in list(a.keys()) + list(b.keys()) if not k.startswith('_'))
    for bone in bones:
        va, vb = a.get(bone, {}), b.get(bone, {})
        d = {}
        for k in ('flex', 'abd', 'twist'):
            x, y = va.get(k, 0.0), vb.get(k, 0.0)
            if x or y:
                d[k] = x + (y - x) * t
        la, lb = va.get('loc'), vb.get('loc')
        if la is not None or lb is not None:
            la = la or (0, 0, 0)
            lb = lb or (0, 0, 0)
            d['loc'] = tuple(la[i] + (lb[i] - la[i]) * t for i in range(3))
        out[bone] = d
    return out


# ----------------------------------------------------------------------------
# Pés, chão
# ----------------------------------------------------------------------------
def _plant_feet(pose, sides):
    """Deixa a sola dos pés paralela ao chão compensando a flexão do quadril/coxa/canela."""
    h = pose.get('Hips', {}).get('flex', 0.0)
    for s in sides:
        ul = pose.get(s + 'UpperLeg', {})
        ll = dict(pose.get(s + 'LowerLeg', {}))
        ft = dict(pose.get(s + 'Foot', {}))
        ft['flex'] = h - ul.get('flex', 0.0) - ll.get('flex', 0.0)
        pose[s + 'Foot'] = ft
        if ul.get('abd', 0.0) and 'abd' not in ll:
            ll['abd'] = -ul['abd']          # joelho para fora, canela vertical
            pose[s + 'LowerLeg'] = ll


def _contacts(skel):
    p = skel.p
    pts = []
    for side, sx in (('Left', 1.0), ('Right', -1.0)):
        ax = sx * p['ankle'][0]
        pts.append((side + 'Foot', (ax, 0.10, 0.0)))
        pts.append((side + 'Foot', (ax, p['ball_y'], 0.0)))
        pts.append((side + 'Toes', (ax, p['toe_y'] - 0.04, 0.0)))
    return pts


def ground_offset(skel, params):
    mats = skel.pose_mats(params)
    z = 1e9
    for bone, pt in _contacts(skel):
        z = min(z, skel.point(mats, bone, pt).z)
    return z


# ----------------------------------------------------------------------------
# IK dos braços
# ----------------------------------------------------------------------------
def aim_basis(skel, mats, i, t, twist_deg=0.0):
    """Rotação local (3x3) que faz o eixo Y do osso i apontar para a direção t (espaço do esqueleto)."""
    t = Vector(t).normalized()
    d_rest = (skel.rest[i].to_3x3() @ Vector((0, 1, 0))).normalized()
    rot = d_rest.rotation_difference(t).to_matrix()
    A = Matrix.Rotation(math.radians(twist_deg), 3, t) @ rot
    R_target = A @ skel.rest[i].to_3x3()
    par = skel.parent[i]
    R_par = mats[par].to_3x3()
    R_L = skel.local_rest[i].to_3x3()
    return R_L.inverted() @ R_par.inverted() @ R_target


def orient_basis(skel, mats, i, R_target):
    """Rotação local (3x3) que leva o osso i à orientação absoluta R_target (3x3, espaço do esqueleto)."""
    par = skel.parent[i]
    R_par = mats[par].to_3x3()
    R_L = skel.local_rest[i].to_3x3()
    return R_L.inverted() @ R_par.inverted() @ R_target


def ik2(S, l1, l2, W, pole):
    """IK analítico de 2 ossos. Retorna (direção osso 1, direção osso 2). pole = vetor para onde aponta o joelho/cotovelo."""
    v = W - S
    d = v.length
    dmax = (l1 + l2) * 0.999
    dmin = abs(l1 - l2) * 1.05 + 0.02
    d = max(dmin, min(dmax, d))
    u = v.normalized() if v.length > 1e-6 else Vector((0, 0, -1))
    a = (d * d + l1 * l1 - l2 * l2) / (2.0 * d)
    h = math.sqrt(max(0.0, l1 * l1 - a * a))
    pv = Vector(pole)
    pv = pv - u * pv.dot(u)
    if pv.length < 1e-4:
        pv = Vector((1, 0, 0)) - u * Vector((1, 0, 0)).dot(u)
    pv.normalize()
    E = S + u * a + pv * h
    Wc = S + u * d
    return (E - S).normalized(), (Wc - E).normalized()


def arm_ik(skel, mats, side, target, pole):
    """Resolve ombro->cotovelo->punho. target = (fora, frente, cima) em unidades de alcance."""
    iu, il = skel.idx[side + 'UpperArm'], skel.idx[side + 'LowerArm']
    sx = 1.0 if side == 'Left' else -1.0
    S = mats[iu].translation.copy()
    l1, l2 = skel.length[iu], skel.length[il]
    out, fwd, up = target
    W = S + Vector((sx * out, -fwd, up)) * (l1 + l2)
    po, pb, pu = pole
    return ik2(S, l1, l2, W, Vector((sx * po, pb, pu)))


def leg_ik(skel, mats, side, target, pole):
    """Posiciona o tornozelo. target = (fora, frente, elevação) em metros na escala do herói (multiplicado por kz)."""
    iu, il, ifoot = skel.idx[side + 'UpperLeg'], skel.idx[side + 'LowerLeg'], skel.idx[side + 'Foot']
    sx = 1.0 if side == 'Left' else -1.0
    S = mats[iu].translation.copy()
    l1, l2 = skel.length[iu], skel.length[il]
    kz = skel.p['top_z'] / R.HERO['top_z']
    out, fwd, lift = target
    W = skel.rest[ifoot].translation + Vector((sx * out, -fwd, lift)) * kz
    po, pb, pu = pole
    return ik2(S, l1, l2, W, Vector((sx * po, pb, pu)))


# ----------------------------------------------------------------------------
# Solver da arma (mão direita)
# ----------------------------------------------------------------------------
def solve_weapon(skel, M_lower, target_dir, target_normal=None, prev=None):
    """
    Acha torção + flexão + abdução do PUNHO (osso RightHand) para apontar a arma
    (osso WeaponBase_R) para `target_dir`, com a face da lâmina virada para `target_normal`.
    """
    ih, iw = skel.idx['RightHand'], skel.idx['WeaponBase_R']
    target_dir = Vector(target_dir).normalized()
    tn = Vector(target_normal).normalized() if target_normal is not None else None
    wb_local = skel.local_rest[iw]
    blade_n_local = skel.rest[iw].to_3x3().inverted() @ UP
    base = M_lower @ skel.local_rest[ih]
    prev_tw = prev.get('tw') if prev else None
    cache = {}

    def evaluate(tw, hf, ha):
        k = (tw, hf, ha)
        if k in cache:
            return cache[k]
        Mh = base @ skel.poser.quat('RightHand', hf, ha, tw).to_matrix().to_4x4()
        Mw = Mh @ wb_local
        r3 = Mw.to_3x3()
        d = r3 @ Vector((0, 1, 0))
        cost = math.acos(max(-1.0, min(1.0, d.dot(target_dir))))
        if tn is not None:
            n = r3 @ blade_n_local
            cost += 0.30 * math.acos(max(-1.0, min(1.0, n.dot(tn))))
        cost += 0.20 * (abs(hf) + abs(ha)) / 70.0
        if prev_tw is not None:
            dt = (tw - prev_tw + 180.0) % 360.0 - 180.0
            cost += 0.25 * abs(dt) / 180.0
        cache[k] = cost
        return cost

    best = (1e9, 0, 0, 0)
    for tw in range(-180, 180, 20):
        for hf in range(-60, 61, 20):
            for ha in range(-40, 41, 20):
                c = evaluate(tw, hf, ha)
                if c < best[0]:
                    best = (c, tw, hf, ha)
    _, tw0, hf0, ha0 = best
    for tw in range(tw0 - 20, tw0 + 21, 5):
        for hf in range(hf0 - 20, hf0 + 21, 5):
            for ha in range(ha0 - 20, ha0 + 21, 5):
                if abs(hf) > 75 or abs(ha) > 50:
                    continue
                c = evaluate(tw, hf, ha)
                if c < best[0]:
                    best = (c, tw, hf, ha)
    _, tw, hf, ha = best
    return tw, hf, ha, best[0]


# ----------------------------------------------------------------------------
# Resolução da pose
# ----------------------------------------------------------------------------
DEFAULT_POLE = {'Right': (0.45, 0.55, -0.7), 'Left': (0.45, 0.55, -0.7)}   # braços: (fora, trás, cima)
LEG_POLE = (0.12, -1.0, 0.0)                                                    # pernas: joelho para a frente


def resolve_pose(skel, pose, prev_state=None):
    params = {k: dict(v) for k, v in pose.items() if not k.startswith('_') and isinstance(v, dict)}
    arm_keys = {'Right': '_rw', 'Left': '_lw'}
    leg_keys = {'Left': '_lf', 'Right': '_rf'}
    ik_arms = [s for s in ('Right', 'Left') if pose.get(arm_keys[s]) is not None]
    ik_legs = [s for s in ('Left', 'Right') if pose.get(leg_keys[s]) is not None]
    plant = pose.get('_plant', True)
    if plant:
        sides = [s for s in (('Left', 'Right') if plant is True else tuple(plant)) if s not in ik_legs]
        _plant_feet(params, sides)
    spear = pose.get('_spear')
    state = {}
    mats = None
    if ik_arms or ik_legs or spear is not None:
        excl = set()
        for s in ik_arms:
            excl |= {s + 'UpperArm', s + 'LowerArm', s + 'Hand'}
        for s in ik_legs:
            excl |= {s + 'UpperLeg', s + 'LowerLeg', s + 'Foot', s + 'Toes'}
        mats = skel.pose_mats({k: v for k, v in params.items() if k not in excl})
    # --- agachamento automático: o quadril desce o necessário para os pés alcançarem os alvos ---
    if ik_legs:
        kz = skel.p['top_z'] / R.HERO['top_z']
        need = 0.0
        for side in ik_legs:
            iu, il, ifoot = skel.idx[side + 'UpperLeg'], skel.idx[side + 'LowerLeg'], skel.idx[side + 'Foot']
            sx = 1.0 if side == 'Left' else -1.0
            out, fwd, lift = pose[leg_keys[side]]
            Wt = skel.rest[ifoot].translation + Vector((sx * out, -fwd, lift)) * kz
            S0 = mats[iu].translation
            L = (skel.length[iu] + skel.length[il]) * 0.975
            hx = math.hypot(Wt.x - S0.x, Wt.y - S0.y)
            vz = S0.z - Wt.z
            if vz > 0:
                reach_v = math.sqrt(max(0.0, L * L - hx * hx))
                need = max(need, vz - reach_v)
        hips = dict(params.get('Hips', {}))
        loc = hips.get('loc', (0.0, 0.0, 0.0))
        hips['loc'] = (loc[0], loc[1], loc[2] * kz - need)
        params['Hips'] = hips
        mats = skel.pose_mats({k: v for k, v in params.items() if k not in excl})
    # --- pernas por IK ---
    for side in ik_legs:
        iu, il, ifoot = skel.idx[side + 'UpperLeg'], skel.idx[side + 'LowerLeg'], skel.idx[side + 'Foot']
        pole = pose.get('_' + side[0].lower() + 'fpole', LEG_POLE)
        d1, d2 = leg_ik(skel, mats, side, pose[leg_keys[side]], pole)
        Q1 = aim_basis(skel, mats, iu, d1, params.get(side + 'UpperLeg', {}).get('twist', 0.0))
        mats[iu] = mats[skel.parent[iu]] @ skel.local_rest[iu] @ Q1.to_4x4()
        Q2 = aim_basis(skel, mats, il, d2, 0.0)
        mats[il] = mats[iu] @ skel.local_rest[il] @ Q2.to_4x4()
        fyaw = pose.get('_' + side[0].lower() + 'fyaw', 0.0)
        fpitch = pose.get('_' + side[0].lower() + 'fpitch', 0.0)
        Rt = (Matrix.Rotation(math.radians(fyaw), 3, 'Z') @ skel.rest[ifoot].to_3x3())
        if fpitch:
            ax = skel.poser.info[side + 'Foot'][2]
            Rt = Matrix.Rotation(math.radians(fpitch), 3, ax) @ Rt
        Q3 = orient_basis(skel, mats, ifoot, Rt)
        mats[ifoot] = mats[il] @ skel.local_rest[ifoot] @ Q3.to_4x4()
        params[side + 'UpperLeg'] = {'Q': Q1}
        params[side + 'LowerLeg'] = {'Q': Q2}
        params[side + 'Foot'] = {'Q': Q3}
        params.pop(side + 'Toes', None)
    # --- braços por IK ---
    for side in ik_arms:
        iu, il, ih = skel.idx[side + 'UpperArm'], skel.idx[side + 'LowerArm'], skel.idx[side + 'Hand']
        pole = pose.get('_' + side[0].lower() + 'pole', DEFAULT_POLE[side])
        d1, d2 = arm_ik(skel, mats, side, pose[arm_keys[side]], pole)
        tw1 = params.get(side + 'UpperArm', {}).get('twist', 0.0)
        Q1 = aim_basis(skel, mats, iu, d1, tw1)
        mats[iu] = mats[skel.parent[iu]] @ skel.local_rest[iu] @ Q1.to_4x4()
        Q2 = aim_basis(skel, mats, il, d2, params.get(side + 'LowerArm', {}).get('twist', 0.0))
        mats[il] = mats[iu] @ skel.local_rest[il] @ Q2.to_4x4()
        params[side + 'UpperArm'] = {'Q': Q1}
        params[side + 'LowerArm'] = {'Q': Q2}
        hand_sem = params.get(side + 'Hand', {})
        mats[ih] = mats[il] @ skel.local_rest[ih] @ skel.rot4(side + 'Hand', hand_sem)
    # --- arma ---
    if spear is not None:
        il = skel.idx['RightLowerArm']
        if isinstance(spear[0], (tuple, list, Vector)):
            d, n = spear
        else:
            d, n = spear, None
        tw, hf, ha, cost = solve_weapon(skel, mats[il], d, n, prev=prev_state)
        params['RightHand'] = {k: v for k, v in {'flex': float(hf), 'abd': float(ha), 'twist': float(tw)}.items() if v}
        state['tw'] = tw
        state['cost'] = cost
    # --- chão (apenas pernas em FK) ---
    if pose.get('_ground', True) and not ik_legs:
        hips = dict(params.get('Hips', {}))
        loc = hips.get('loc', (0.0, 0.0, 0.0))
        hips['loc'] = (loc[0], loc[1], 0.0)
        params['Hips'] = hips
        z = ground_offset(skel, params)
        hips['loc'] = (loc[0], loc[1], -z + pose.get('_lift', 0.0))
        params['Hips'] = hips
    return params, state


# ----------------------------------------------------------------------------
# Gravação
# ----------------------------------------------------------------------------
def bake_clip(arm, skel, name, keys, loop=False):
    """keys: lista de (frame, pose). Frames começam em 1. Para loop, a última pose repete a primeira."""
    keys = sorted(keys, key=lambda k: k[0])
    anim = arm.animation_data or arm.animation_data_create()
    act = bpy.data.actions.new(name)
    anim.action = act
    resolved = []
    prev_state = None
    for frame, pose in keys:
        params, state = resolve_pose(skel, pose, prev_state)
        prev_state = state or prev_state
        resolved.append((frame, params))
    bones = set()
    for _, params in resolved:
        bones.update(params.keys())
    bones.add('Hips')
    bones = [b for b in skel.names if b in bones]
    for b in bones:
        arm.pose.bones[b].rotation_mode = 'QUATERNION'
    last_q = {}
    for frame, params in resolved:
        for b in bones:
            v = params.get(b, {})
            pb = arm.pose.bones[b]
            q = skel.local_quat(b, v)
            # mantém continuidade de sinal entre quaternions consecutivos
            if b in last_q and q.dot(last_q[b]) < 0.0:
                q.negate()
            last_q[b] = q.copy()
            pb.rotation_quaternion = q
            pb.keyframe_insert('rotation_quaternion', frame=frame)
            if 'loc' in v or b == 'Hips':
                pb.location = skel.poser.loc(b, v.get('loc', (0, 0, 0)))
                pb.keyframe_insert('location', frame=frame)
    anim.action = None
    track = anim.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, int(keys[0][0]), act)
    if loop and len(keys) > 1:
        # a última pose repete a primeira: descartamos esse quadro para o loop fechar sem "travadinha"
        strip.action_frame_end = float(keys[-1][0] - 1)
    return act


def reset_pose(arm):
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)


def pose_to_armature(arm, skel, pose, prev_state=None):
    """Aplica uma pose resolvida direto no armature (para pré-visualização)."""
    params, state = resolve_pose(skel, pose, prev_state)
    reset_pose(arm)
    for b, v in params.items():
        pb = arm.pose.bones[b]
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = skel.local_quat(b, v)
        if 'loc' in v:
            pb.location = skel.poser.loc(b, v['loc'])
    return state


def add_all_clips(arm, p, only=None):
    """Grava todos os clips de clips.py no armature (cada um numa NLA track)."""
    from clips import CLIPS
    skel = Skel(arm, p)
    reset_pose(arm)
    for name, c in CLIPS.items():
        if only and name not in only:
            continue
        bake_clip(arm, skel, name, c['keys'], loop=c['loop'])
    reset_pose(arm)
    print(f"[anim] {len(CLIPS)} clips gravados")
