extends SceneTree
## Imprime a estrutura de um modelo importado: nós, ossos, animações (nome, duração, loop).
## godot --headless --path destruidor-de-mundos --script res://dev/inspect_model.gd -- res://assets/models/hero.glb

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var path: String = args[0] if args.size() > 0 else "res://assets/models/hero.glb"
	var scene := load(path) as PackedScene
	if scene == null:
		print("ERRO: não consegui carregar ", path)
		quit(1)
		return
	var root := scene.instantiate()
	_dump(root, 0)
	var ap := _find(root, "AnimationPlayer")
	if ap:
		var names: PackedStringArray = (ap as AnimationPlayer).get_animation_list()
		print("ANIMAÇÕES (%d):" % names.size())
		for n in names:
			var a: Animation = (ap as AnimationPlayer).get_animation(n)
			print("  %-22s %6.3fs loop=%d tracks=%d" % [n, a.length, a.loop_mode, a.get_track_count()])
	var sk := _find(root, "Skeleton3D")
	if sk:
		var s := sk as Skeleton3D
		print("OSSOS (%d): " % s.get_bone_count(), ", ".join(Array(range(s.get_bone_count())).map(func(i): return s.get_bone_name(i))))
	root.free()
	quit(0)

func _dump(n: Node, d: int) -> void:
	var extra := ""
	if n is MeshInstance3D:
		var mi := n as MeshInstance3D
		extra = " mesh surfaces=%d" % mi.mesh.get_surface_count()
	print("  ".repeat(d), n.name, " [", n.get_class(), "]", extra)
	for c in n.get_children():
		_dump(c, d + 1)

func _find(n: Node, cls: String) -> Node:
	if n.is_class(cls):
		return n
	for c in n.get_children():
		var r := _find(c, cls)
		if r:
			return r
	return null
