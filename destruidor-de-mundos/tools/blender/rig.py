"""
Esqueleto humanoide compartilhado por TODOS os personagens (herói, capangas, chefes).

Os nomes dos ossos seguem o perfil humanoide do Godot (Hips, Spine, Chest, Neck, Head,
LeftUpperArm ...), o que facilita muito trocar o corpo por um personagem do Mixamo /
Tripo / Kimodo e reaproveitar animações com o retarget do Godot.

Também define o "Poser": um tradutor de ângulos semânticos (flexão / abdução / torção)
para as rotações locais de cada osso, de modo que as animações sejam escritas de forma
intuitiva ("flexionar o cotovelo 90°") independentemente da orientação do osso.
"""
import math
import bpy
from mathutils import Vector, Matrix
from common import FWD, UP, LAT

# ----------------------------------------------------------------------------
# Proporções (metros).  Lado esquerdo (+X); o direito é espelhado.
# ----------------------------------------------------------------------------
HERO = dict(
    hips_z=1.45, spine_z=1.58, chest_z=1.95, neck_z=2.35, head_z=2.52, top_z=2.98,
    shoulder_z=2.26, clav_x0=0.08, clav_x1=0.38, shoulder_x=0.50,
    elbow=(0.63, 1.72), wrist=(0.74, 1.22), hand_tip=(0.77, 0.94),
    hip_x=0.24, hip_z=1.40, knee=(0.27, 0.72), ankle=(0.28, 0.14),
    ball_y=-0.30, ball_z=0.06, toe_y=-0.46, toe_z=0.04,
    grip_y=0.0,            # posição Y do centro do punho direito
    spear_front=2.05,      # distância do punho até a ponta da arma (para o osso WeaponTip_R)
)


def scaled(p, kz=1.0, kx=1.0):
    """Reescala proporções: kz = altura, kx = largura/profundidade."""
    q = {}
    for k, v in p.items():
        if k.endswith('_z') or k in ('top_z',):
            q[k] = v * kz
        elif k in ('elbow', 'wrist', 'hand_tip', 'knee', 'ankle'):
            q[k] = (v[0] * kx, v[1] * kz)
        elif k.endswith('_x') or k.endswith('_x0') or k.endswith('_x1'):
            q[k] = v * kx
        elif k.endswith('_y'):
            q[k] = v * kx
        elif k == 'spear_front':
            q[k] = v * kz
        else:
            q[k] = v
    return q


def V(x, y, z):
    return Vector((x, y, z))


def bone_table(p):
    """[(nome, pai, cabeça, cauda, referência de roll)]"""
    B = []
    B.append(("Hips", None, V(0, 0, p['hips_z']), V(0, 0, p['spine_z']), FWD))
    B.append(("Spine", "Hips", V(0, 0, p['spine_z']), V(0, 0, p['chest_z']), FWD))
    B.append(("Chest", "Spine", V(0, 0, p['chest_z']), V(0, 0, p['neck_z']), FWD))
    B.append(("Neck", "Chest", V(0, 0, p['neck_z']), V(0, 0, p['head_z']), FWD))
    B.append(("Head", "Neck", V(0, 0, p['head_z']), V(0, 0, p['top_z']), FWD))
    for side, sx in (("Left", 1.0), ("Right", -1.0)):
        sh = V(sx * p['shoulder_x'], 0, p['shoulder_z'])
        el = V(sx * p['elbow'][0], 0, p['elbow'][1])
        wr = V(sx * p['wrist'][0], 0, p['wrist'][1])
        ht = V(sx * p['hand_tip'][0], 0, p['hand_tip'][1])
        B.append((f"{side}Shoulder", "Chest", V(sx * p['clav_x0'], -0.02, p['shoulder_z']),
                  V(sx * p['clav_x1'], -0.02, p['shoulder_z'] + 0.01), FWD))
        B.append((f"{side}UpperArm", f"{side}Shoulder", sh, el, FWD))
        B.append((f"{side}LowerArm", f"{side}UpperArm", el, wr, FWD))
        B.append((f"{side}Hand", f"{side}LowerArm", wr, ht, FWD))
        hip = V(sx * p['hip_x'], 0, p['hip_z'])
        kn = V(sx * p['knee'][0], 0, p['knee'][1])
        an = V(sx * p['ankle'][0], 0, p['ankle'][1])
        ball = V(sx * p['ankle'][0], p['ball_y'], p['ball_z'])
        toe = V(sx * p['ankle'][0], p['toe_y'], p['toe_z'])
        B.append((f"{side}UpperLeg", "Hips", hip, kn, FWD))
        B.append((f"{side}LowerLeg", f"{side}UpperLeg", kn, an, FWD))
        B.append((f"{side}Foot", f"{side}LowerLeg", an, ball, UP))
        B.append((f"{side}Toes", f"{side}Foot", ball, toe, UP))
    # --- ossos auxiliares (sem pele): âncoras para armas / efeitos ---
    fist = V(-(p['wrist'][0] + p['hand_tip'][0]) / 2.0, p['grip_y'], (p['wrist'][1] + p['hand_tip'][1]) / 2.0)
    B.append(("WeaponBase_R", "RightHand", fist, fist + V(0, -0.2, 0), UP))
    B.append(("WeaponTip_R", "RightHand", fist + V(0, -p['spear_front'], 0),
              fist + V(0, -p['spear_front'] - 0.15, 0), UP))
    gfist = V((p['wrist'][0] + p['hand_tip'][0]) / 2.0 + 0.04, p['grip_y'], (p['wrist'][1] + p['hand_tip'][1]) / 2.0)
    B.append(("GauntletCore_L", "LeftHand", gfist, gfist + V(0, -0.15, 0), UP))
    B.append(("CoreAnchor", "Chest", V(0, -0.3, p['chest_z'] + 0.2), V(0, -0.45, p['chest_z'] + 0.2), UP))
    B.append(("EyeAnchor", "Head", V(0, -0.2, (p['head_z'] + p['top_z']) / 2.0 + 0.0),
              V(0, -0.3, (p['head_z'] + p['top_z']) / 2.0), UP))
    return B


DEFORM_BONES = None


def deform_bone_names(p):
    return [b[0] for b in bone_table(p)
            if b[0] not in ("WeaponBase_R", "WeaponTip_R", "GauntletCore_L", "CoreAnchor", "EyeAnchor")]


def build_armature(p, name="Armature"):
    arm_data = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones
    table = bone_table(p)
    for (n, parent, head, tail, roll_ref) in table:
        b = eb.new(n)
        b.head = head
        b.tail = tail
        if parent:
            b.parent = eb[parent]
    for (n, parent, head, tail, roll_ref) in table:
        try:
            eb[n].align_roll(roll_ref)
        except Exception:
            pass
    bpy.ops.object.mode_set(mode='OBJECT')
    arm_data.display_type = 'OCTAHEDRAL'
    return arm


# ----------------------------------------------------------------------------
# Poser semântico
# ----------------------------------------------------------------------------
def _axis_toward(d, target):
    """Eixo de rotação que, com ângulo positivo, move a ponta do osso (direção d) em direção a `target`."""
    a = d.cross(target)
    if a.length < 0.35:
        return None
    return a.normalized()


class Poser:
    """
    Converte (flex, abd, twist) em graus -> quaternion local do osso (rotation_quaternion).

    flex  > 0 : a ponta do osso vai para a FRENTE (cotovelo/joelho: dobra para frente; para pernas
                e braços isso significa levantar à frente; nos pés, ponta sobe).
    abd   > 0 : a ponta vai para FORA do corpo (para ossos centrais, positivo = lado esquerdo).
    twist > 0 : giro em torno do eixo do osso (regra da mão direita em torno da direção cabeça→cauda).
    Cada rotação é aplicada nos eixos do esqueleto em repouso (ordem: twist, abd, flex).
    """

    def __init__(self, arm_obj):
        self.arm = arm_obj
        self.info = {}
        for b in arm_obj.data.bones:
            M = b.matrix_local.to_3x3()
            d = (M @ Vector((0, 1, 0))).normalized()
            fa = _axis_toward(d, FWD)
            if fa is None:                       # osso apontando para frente (pés)
                fa = _axis_toward(d, UP) or LAT.copy()
            if b.name.startswith("Left"):
                out = LAT.copy()
            elif b.name.startswith("Right"):
                out = -LAT
            else:
                out = LAT.copy()
            aa = _axis_toward(d, out)
            if aa is None:
                aa = _axis_toward(d, UP) or FWD.copy()
            self.info[b.name] = (M, d, fa, aa)

    def quat(self, bone, flex=0.0, abd=0.0, twist=0.0):
        M, d, fa, aa = self.info[bone]
        A = (Matrix.Rotation(math.radians(flex), 3, fa)
             @ Matrix.Rotation(math.radians(abd), 3, aa)
             @ Matrix.Rotation(math.radians(twist), 3, d))
        Q = M.inverted() @ A @ M
        return Q.to_quaternion()

    def loc(self, bone, v):
        M = self.info[bone][0]
        return M.inverted() @ Vector(v)


def mirror_name(n):
    if n.startswith("Left"):
        return "Right" + n[4:]
    if n.startswith("Right"):
        return "Left" + n[5:]
    if n.endswith("_R"):
        return n[:-2] + "_L"
    if n.endswith("_L"):
        return n[:-2] + "_R"
    return n


def mirror_pose(pose):
    """Espelha uma pose {osso: {flex,abd,twist,loc}} trocando esquerda/direita."""
    out = {}
    for bone, vals in pose.items():
        nb = mirror_name(bone)
        nv = dict(vals)
        if 'twist' in nv:
            nv['twist'] = -nv['twist']
        if 'abd' in nv and nb == bone:           # ossos centrais: inclinação lateral inverte
            nv['abd'] = -nv['abd']
        if 'loc' in nv:
            x, y, z = nv['loc']
            nv['loc'] = (-x, y, z)
        out[nb] = nv
    return out
