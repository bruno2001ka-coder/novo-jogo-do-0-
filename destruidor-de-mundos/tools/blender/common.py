"""
Biblioteca comum de modelagem procedural para o Blender (bpy).

Tudo é construído por código: lofts (anéis ligados entre si), caixas
chanfradas, esferas/elipsoides, cones, chifres, etc.  Cada primitiva já
recebe os pesos de skin (osso rígido ou função de mistura), de modo que o
personagem inteiro vira uma única malha "skinned" pronta para exportar em GLB.

Convenções (iguais às do Blender):
    +X = lado ESQUERDO do personagem, -Y = FRENTE, +Z = cima.
Ao exportar para glTF/Godot a frente vira +Z (o Godot corrige com um pivô).
"""
import math
import bpy
import bmesh
from mathutils import Vector, Matrix, Quaternion, Euler

FWD = Vector((0.0, -1.0, 0.0))
UP = Vector((0.0, 0.0, 1.0))
LAT = Vector((1.0, 0.0, 0.0))


# ----------------------------------------------------------------------------
# Cena / materiais
# ----------------------------------------------------------------------------
_materials = {}


def clear_scene():
    """Começa de uma cena completamente vazia."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _materials.clear()
    scene = bpy.context.scene
    scene.render.fps = 30
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0


def srgb_to_linear(c):
    c = max(0.0, min(1.0, c))
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lin(color):
    """Converte uma cor sRGB (0..1) na cor linear que o Blender/glTF esperam."""
    return tuple(srgb_to_linear(c) for c in color[:3])


def material(name, color, metallic=0.0, rough=0.5, emit=None, emit_strength=1.0):
    """
    Cria (ou reaproveita) um material PBR simples compatível com glTF.
    As cores são dadas em sRGB (como num seletor de cores) e convertidas para linear aqui.
    """
    if name in _materials:
        return _materials[name]
    color = lin(color)
    if emit is not None:
        emit = lin(emit)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (color[0], color[1], color[2], 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    if emit is not None:
        sock = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        sock.default_value = (emit[0], emit[1], emit[2], 1.0)
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emit_strength
    m.diffuse_color = (color[0], color[1], color[2], 1.0)
    _materials[name] = m
    return m


# ----------------------------------------------------------------------------
# Matemática auxiliar
# ----------------------------------------------------------------------------
def smoothstep(a, b, x):
    if b == a:
        return 0.0 if x < a else 1.0
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3.0 - 2.0 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def vlerp(a, b, t):
    return Vector(a) * (1.0 - t) + Vector(b) * t


def bezier(p0, p1, p2, p3, t):
    u = 1.0 - t
    return (Vector(p0) * (u * u * u) + Vector(p1) * (3 * u * u * t)
            + Vector(p2) * (3 * u * t * t) + Vector(p3) * (t * t * t))


def mirror_x(v):
    v = Vector(v)
    return Vector((-v.x, v.y, v.z))


def orthonormal_frame(t, hint):
    """Devolve (u, v) ortogonais a t, com u o mais próximo possível de `hint`."""
    t = Vector(t).normalized()
    h = Vector(hint)
    u = h - t * h.dot(t)
    if u.length < 1e-4:
        h = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
        u = h - t * h.dot(t)
    u.normalize()
    v = t.cross(u).normalized()
    return u, v


# ----------------------------------------------------------------------------
# Construtor de malha com pesos
# ----------------------------------------------------------------------------
class Builder:
    """Acumula geometria em um bmesh, com material e pesos de skin por primitiva."""

    def __init__(self, bone_names):
        self.bm = bmesh.new()
        self.bone_names = list(bone_names)
        self.group_index = {n: i for i, n in enumerate(self.bone_names)}
        self.deform = self.bm.verts.layers.deform.verify()
        self.materials = []          # lista de objetos material (slots)
        self._slot = {}              # nome -> índice
        self.uv_layer = None

    # ---- materiais ----
    def slot(self, mat):
        name = mat.name
        if name not in self._slot:
            self._slot[name] = len(self.materials)
            self.materials.append(mat)
        return self._slot[name]

    # ---- pesos ----
    def _apply_weights(self, verts, bone, wfn):
        for v in verts:
            if wfn is not None:
                w = wfn(v.co.copy())
            else:
                w = {bone: 1.0}
            total = sum(w.values())
            if total <= 1e-6:
                continue
            for b, val in w.items():
                if val <= 1e-4:
                    continue
                v[self.deform][self.group_index[b]] = val / total

    def _finish_prim(self, verts, faces, mat, bone, wfn, smooth, sharp_angle):
        ms = self.slot(mat)
        for f in faces:
            f.material_index = ms
            f.smooth = smooth
        if sharp_angle is not None:
            lim = math.radians(sharp_angle)
            edges = set()
            for f in faces:
                for e in f.edges:
                    edges.add(e)
            for e in edges:
                try:
                    ang = e.calc_face_angle(None)
                except Exception:
                    ang = None
                if ang is None or ang > lim:
                    e.smooth = False
        self._apply_weights(verts, bone, wfn)

    # ------------------------------------------------------------------
    # Loft: anéis (elipses / super-elipses) ao longo de uma trilha
    # ------------------------------------------------------------------
    def loft(self, path, rx, ry, mat, bone=None, wfn=None, hint=LAT, n=14,
             power=2.0, cap_start=True, cap_end=True, smooth=True, sharp_angle=None,
             twist=None, offset_y=None):
        """
        path : lista de pontos (centros dos anéis)
        rx, ry : raios por anel (listas ou escalar). rx segue `hint`, ry é perpendicular.
        power : expoente da super-elipse (2 = elipse, 4+ = quase retangular).
        Raio 0 numa ponta vira um ápice (ponta de cone / esfera fechada).
        """
        k = len(path)
        if not isinstance(rx, (list, tuple)):
            rx = [rx] * k
        if not isinstance(ry, (list, tuple)):
            ry = [ry] * k
        if not isinstance(power, (list, tuple)):
            power = [power] * k
        pts = [Vector(p) for p in path]
        rings = []
        verts_all = []
        for i in range(k):
            if i == 0:
                t = pts[1] - pts[0]
            elif i == k - 1:
                t = pts[-1] - pts[-2]
            else:
                t = pts[i + 1] - pts[i - 1]
            if t.length < 1e-6:
                t = Vector((0, 0, 1))
            u, v = orthonormal_frame(t, hint)
            if twist is not None and twist[i]:
                q = Quaternion(t.normalized(), math.radians(twist[i]))
                u = q @ u
                v = q @ v
            apex = (rx[i] <= 1e-5 and ry[i] <= 1e-5)
            if apex:
                bv = self.bm.verts.new(pts[i])
                verts_all.append(bv)
                rings.append(('apex', bv))
                continue
            ring = []
            pw = max(0.8, power[i])
            for j in range(n):
                a = 2.0 * math.pi * j / n
                c, s = math.cos(a), math.sin(a)
                x = rx[i] * math.copysign(abs(c) ** (2.0 / pw), c)
                y = ry[i] * math.copysign(abs(s) ** (2.0 / pw), s)
                if offset_y is not None:
                    y += offset_y[i]
                bv = self.bm.verts.new(pts[i] + u * x + v * y)
                ring.append(bv)
                verts_all.append(bv)
            rings.append(('ring', ring))
        faces = []
        for i in range(k - 1):
            a, b = rings[i], rings[i + 1]
            if a[0] == 'apex' and b[0] == 'apex':
                continue
            for j in range(n):
                j2 = (j + 1) % n
                try:
                    if a[0] == 'apex':
                        faces.append(self.bm.faces.new((a[1], b[1][j2], b[1][j])))
                    elif b[0] == 'apex':
                        faces.append(self.bm.faces.new((a[1][j], a[1][j2], b[1])))
                    else:
                        faces.append(self.bm.faces.new((a[1][j], a[1][j2], b[1][j2], b[1][j])))
                except ValueError:
                    pass
        if cap_start and rings[0][0] == 'ring':
            try:
                faces.append(self.bm.faces.new(list(reversed(rings[0][1]))))
            except ValueError:
                pass
        if cap_end and rings[-1][0] == 'ring':
            try:
                faces.append(self.bm.faces.new(rings[-1][1]))
            except ValueError:
                pass
        self._finish_prim(verts_all, faces, mat, bone, wfn, smooth, sharp_angle)
        return verts_all

    # ------------------------------------------------------------------
    # Primitivas derivadas do loft
    # ------------------------------------------------------------------
    def ellipsoid(self, center, size, mat, bone=None, wfn=None, rings=8, n=14,
                  axis=UP, hint=LAT, smooth=True, sharp_angle=None, power=2.0):
        """Elipsoide: size = (sx, sy, sz) semi-eixos ao longo de hint, perp, axis."""
        c = Vector(center)
        axis = Vector(axis).normalized()
        u, v = orthonormal_frame(axis, hint)
        sx, sy, sz = size
        path, rxl, ryl = [], [], []
        for i in range(rings + 1):
            t = -1.0 + 2.0 * i / rings
            r = math.sqrt(max(0.0, 1.0 - t * t))
            path.append(c + axis * (t * sz))
            rxl.append(sx * r)
            ryl.append(sy * r)
        return self.loft(path, rxl, ryl, mat, bone, wfn, hint=u, n=n, power=power,
                         smooth=smooth, sharp_angle=sharp_angle)

    def box(self, center, size, mat, bone=None, wfn=None, axis=UP, hint=LAT,
            round_r=0.02, n=16, smooth=False, sharp_angle=35.0, taper=None, power=6.0):
        """
        Caixa chanfrada. size = (sx, sy, sz) dimensões TOTAIS ao longo de hint, perp, axis.
        taper = (fx, fy) escala do anel final em relação ao inicial (para formas cônicas).
        """
        c = Vector(center)
        axis = Vector(axis).normalized()
        u, v = orthonormal_frame(axis, hint)
        sx, sy, sz = size
        hx, hy, hz = sx / 2.0, sy / 2.0, sz / 2.0
        ch = min(round_r, hz * 0.45)
        tx, ty = (1.0, 1.0) if taper is None else taper
        # anéis: ponta chanfrada (menor), corpo, corpo, ponta chanfrada
        stations = [(-hz, True), (-hz + ch, False), (hz - ch, False), (hz, True)]
        shrink_amt = max(0.35, 1.0 - ch / max(1e-6, min(hx, hy)))
        path, rxl, ryl = [], [], []
        for z, is_edge in stations:
            f = (z + hz) / (2 * hz) if hz > 0 else 0.0
            sc_x = lerp(1.0, tx, f)
            sc_y = lerp(1.0, ty, f)
            shrink = shrink_amt if is_edge else 1.0
            path.append(c + axis * z)
            rxl.append(hx * sc_x * shrink)
            ryl.append(hy * sc_y * shrink)
        return self.loft(path, rxl, ryl, mat, bone, wfn, hint=u, n=n, power=power,
                         smooth=smooth, sharp_angle=sharp_angle)

    def cone(self, base, tip, r0, mat, bone=None, wfn=None, n=10, r1=0.0, hint=LAT,
             smooth=True, sharp_angle=None, cap_base=True):
        """Cone/cilindro cônico da base até a ponta."""
        return self.loft([base, tip], [r0, r1], [r0, r1], mat, bone, wfn, hint=hint, n=n,
                         smooth=smooth, sharp_angle=sharp_angle, cap_start=cap_base,
                         cap_end=(r1 > 1e-5))

    def tube(self, path, r0, r1, mat, bone=None, wfn=None, n=10, hint=LAT, smooth=True,
             sharp_angle=None, bulge=0.0, cap_start=True, cap_end=True):
        """Tubo afinando de r0 a r1 ao longo de uma trilha (chifres, caudas, cabos)."""
        k = len(path)
        rr = []
        for i in range(k):
            t = i / max(1, k - 1)
            r = lerp(r0, r1, t) * (1.0 + bulge * math.sin(math.pi * t))
            rr.append(r)
        return self.loft(path, rr, rr, mat, bone, wfn, hint=hint, n=n, smooth=smooth,
                         sharp_angle=sharp_angle, cap_start=cap_start, cap_end=cap_end)

    def horn(self, base, direction, length, curl, r0, mat, bone=None, wfn=None,
             steps=9, side=Vector((1, 0, 0)), n=9):
        """
        Chifre/espinho curvo. `curl` curva a ponta na direção `side`.
        """
        d = Vector(direction).normalized()
        sd = Vector(side)
        path = []
        for i in range(steps + 1):
            t = i / steps
            p = Vector(base) + d * (length * t) + sd * (curl * t * t * length)
            path.append(p)
        rr = [r0 * (1.0 - 0.92 * (i / steps)) ** 0.85 for i in range(steps + 1)]
        rr[-1] = 0.0
        return self.loft(path, rr, rr, mat, bone, wfn, hint=sd if sd.length > 0 else LAT, n=n,
                         smooth=True, cap_start=True, cap_end=False)

    def prism(self, pts_xy, depth, origin, mat, bone=None, wfn=None, normal=FWD,
              up=UP, smooth=False, sharp_angle=20.0):
        """
        Extrusão de um polígono 2D (plano formado por `up` x `normal`) com espessura `depth`
        (centrada). pts_xy: lista de (x,y) no plano (x = lateral, y = up).
        """
        n = Vector(normal).normalized()
        upv = Vector(up)
        u, v = orthonormal_frame(n, Vector((1, 0, 0)) if abs(n.x) < 0.9 else Vector((0, 1, 0)))
        # eixo "up" do polígono: tenta alinhar v com `up`
        if v.dot(upv) < 0:
            v = -v
        o = Vector(origin)
        top, bot = [], []
        for (x, y) in pts_xy:
            top.append(self.bm.verts.new(o + u * x + v * y + n * (depth / 2.0)))
            bot.append(self.bm.verts.new(o + u * x + v * y - n * (depth / 2.0)))
        faces = []
        k = len(pts_xy)
        try:
            faces.append(self.bm.faces.new(top))
            faces.append(self.bm.faces.new(list(reversed(bot))))
        except ValueError:
            pass
        for i in range(k):
            j = (i + 1) % k
            try:
                faces.append(self.bm.faces.new((top[i], bot[i], bot[j], top[j])))
            except ValueError:
                pass
        verts = top + bot
        self._finish_prim(verts, faces, mat, bone, wfn, smooth, sharp_angle)
        return verts

    def grid(self, origin, width_dir, height_dir, w, h, nx, ny, mat, bone=None, wfn=None,
             uv_top_to_bottom=True, sag=None):
        """Plano subdividido (capa/tecido). UV.v vai de 0 (topo) a 1 (base)."""
        o = Vector(origin)
        wd = Vector(width_dir).normalized()
        hd = Vector(height_dir).normalized()
        uv = self.bm.loops.layers.uv.verify()
        grid = []
        for iy in range(ny + 1):
            row = []
            ty = iy / ny
            for ix in range(nx + 1):
                tx = ix / nx
                width_here = w * (sag(ty) if sag else 1.0)
                p = o + wd * ((tx - 0.5) * width_here) + hd * (ty * h)
                row.append(self.bm.verts.new(p))
            grid.append(row)
        faces = []
        for iy in range(ny):
            for ix in range(nx):
                f = self.bm.faces.new((grid[iy][ix], grid[iy][ix + 1], grid[iy + 1][ix + 1], grid[iy + 1][ix]))
                faces.append(f)
                coords = [((ix) / nx, iy / ny), ((ix + 1) / nx, iy / ny),
                          ((ix + 1) / nx, (iy + 1) / ny), ((ix) / nx, (iy + 1) / ny)]
                for loop, (uu, vv) in zip(f.loops, coords):
                    loop[uv].uv = (uu, vv)
        verts = [v for row in grid for v in row]
        self._finish_prim(verts, faces, mat, bone, wfn, True, None)
        return verts

    # ------------------------------------------------------------------
    def mirror_last(self, verts_start_len, faces_start_len=None):
        """(reservado)"""
        pass

    def finish(self, name, armature_obj=None, collection=None, recalc=True):
        """Converte o bmesh num objeto Blender com grupos de vértices e modificador de armature."""
        bm = self.bm
        if recalc:
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        mesh = bpy.data.meshes.new(name)
        bm.to_mesh(mesh)
        bm.free()
        for m in self.materials:
            mesh.materials.append(m)
        obj = bpy.data.objects.new(name, mesh)
        (collection or bpy.context.scene.collection).objects.link(obj)
        for bname in self.bone_names:
            obj.vertex_groups.new(name=bname)
        if armature_obj is not None:
            mod = obj.modifiers.new("Armature", 'ARMATURE')
            mod.object = armature_obj
            obj.parent = armature_obj
        return obj


# ----------------------------------------------------------------------------
# Funções de peso prontas
# ----------------------------------------------------------------------------
def blend_weights(bone_a, bone_b, joint, axis, half_width):
    """
    Mistura suave entre dois ossos ao longo de `axis` a partir do ponto `joint`.
    Antes do joint -> bone_a, depois -> bone_b, com transição de ±half_width.
    """
    joint = Vector(joint)
    axis = Vector(axis).normalized()

    def fn(co):
        t = (co - joint).dot(axis)
        s = smoothstep(-half_width, half_width, t)
        return {bone_a: 1.0 - s, bone_b: s}
    return fn


def blend3(bone_a, bone_b, bone_c, j1, j2, axis, hw1, hw2):
    """Três ossos em sequência (ex.: Hips -> Spine -> Chest)."""
    j1, j2 = Vector(j1), Vector(j2)
    axis = Vector(axis).normalized()

    def fn(co):
        t1 = (co - j1).dot(axis)
        t2 = (co - j2).dot(axis)
        s1 = smoothstep(-hw1, hw1, t1)
        s2 = smoothstep(-hw2, hw2, t2)
        return {bone_a: 1.0 - s1, bone_b: s1 * (1.0 - s2), bone_c: s1 * s2}
    return fn


# ----------------------------------------------------------------------------
# Exportação
# ----------------------------------------------------------------------------
def export_glb(path, objects, animations=True):
    """Exporta os objetos selecionados como GLB (com animações em NLA tracks)."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    kwargs = dict(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_apply=False,
        export_yup=True,
        export_materials='EXPORT',
        export_skins=True,
        export_animations=animations,
        export_animation_mode='NLA_TRACKS',
        export_force_sampling=True,
        export_optimize_animation_size=True,
        export_normals=True,
        export_texcoords=True,
        export_cameras=False,
        export_lights=False,
    )
    # opções que mudam de nome entre versões do Blender: filtramos o que existe
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    kwargs = {k: v for k, v in kwargs.items() if k in props}
    bpy.ops.export_scene.gltf(**kwargs)
    print("[export] ->", path)
