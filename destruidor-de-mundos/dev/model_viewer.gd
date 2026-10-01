extends Node3D
## Ferramenta de desenvolvimento: carrega um GLB, enquadra e salva capturas (PNG).
##
## Exemplo:
##   godot --path destruidor-de-mundos res://dev/model_viewer.tscn -- \
##       --model=/caminho/hero.glb --out=/tmp/prev --views=front,three,side,back
##   (animações)  --clip=attack_l1 --frames=1,6,9,12 --views=three
##
## Sem argumentos, apenas mostra o modelo padrão.

var args := {}
var model: Node3D
var ap: AnimationPlayer
var cam: Camera3D
var bounds := AABB()


func _parse_args() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--") and a.contains("="):
			var kv := a.substr(2).split("=", true, 1)
			args[kv[0]] = kv[1]
		elif a.begins_with("--"):
			args[a.substr(2)] = "1"


func _collect_aabb(n: Node, acc: Array) -> void:
	if n is MeshInstance3D and (n as MeshInstance3D).mesh != null:
		var mi := n as MeshInstance3D
		var bb := mi.get_aabb()
		var gt := mi.global_transform
		for i in 8:
			var corner := bb.position + Vector3(bb.size.x * (i & 1), bb.size.y * ((i >> 1) & 1), bb.size.z * ((i >> 2) & 1))
			acc.append(gt * corner)
	for c in n.get_children():
		_collect_aabb(c, acc)


func _ready() -> void:
	_parse_args()
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.25, 0.28, 0.4)
	sky_mat.sky_horizon_color = Color(0.7, 0.6, 0.6)
	sky_mat.ground_horizon_color = Color(0.4, 0.35, 0.35)
	sky_mat.ground_bottom_color = Color(0.1, 0.1, 0.12)
	var sky := Sky.new()
	sky.sky_material = sky_mat
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.16, 0.16, 0.2)
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.ambient_light_energy = 1.0
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.glow_enabled = true
	env.glow_intensity = 0.8
	env.glow_hdr_threshold = 1.0
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-35, 35, 0)
	key.light_energy = 1.6
	key.shadow_enabled = true
	add_child(key)
	var rim := DirectionalLight3D.new()
	rim.rotation_degrees = Vector3(-20, 200, 0)
	rim.light_energy = 0.9
	rim.light_color = Color(0.6, 0.5, 1.0)
	add_child(rim)

	var floor_mesh := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(40, 40)
	floor_mesh.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.22, 0.22, 0.25)
	fm.roughness = 0.9
	floor_mesh.material_override = fm
	add_child(floor_mesh)

	cam = Camera3D.new()
	cam.fov = 28.0
	add_child(cam)

	if args.has("models"):
		_lineup()
		return
	var path: String = args.get("model", "")
	if path == "":
		return
	var scene_root: Node3D
	if path.begins_with("res://"):
		scene_root = (load(path) as PackedScene).instantiate()
	else:
		var doc := GLTFDocument.new()
		var state := GLTFState.new()
		var err := doc.append_from_file(path, state)
		if err != OK:
			push_error("Falha ao carregar " + path)
			get_tree().quit(1)
			return
		scene_root = doc.generate_scene(state) as Node3D
	model = scene_root
	add_child(model)
	ap = _find_ap(model)
	if ap:
		var names := ap.get_animation_list()
		print("ANIMS(", names.size(), "): ", ", ".join(names))
	var sk := _find_skeleton(model)
	if sk:
		print("BONES(", sk.get_bone_count(), ")")
	_run.call_deferred()


func _find_ap(n: Node) -> AnimationPlayer:
	if n is AnimationPlayer:
		return n
	for c in n.get_children():
		var r := _find_ap(c)
		if r:
			return r
	return null


func _find_skeleton(n: Node) -> Skeleton3D:
	if n is Skeleton3D:
		return n
	for c in n.get_children():
		var r := _find_skeleton(c)
		if r:
			return r
	return null


func _frame_camera(view: String) -> void:
	var pts := []
	_collect_aabb(model, pts)
	var mn := Vector3(1e9, 1e9, 1e9)
	var mx := Vector3(-1e9, -1e9, -1e9)
	for p in pts:
		mn = mn.min(p)
		mx = mx.max(p)
	if args.has("fixed_box"):
		mn = Vector3(-1.6, 0.0, -1.6)
		mx = Vector3(1.6, 3.2, 1.6)
	var center := (mn + mx) * 0.5
	var radius := (mx - mn).length() * 0.5
	if args.has("close"):
		var parts: PackedStringArray = String(args["close"]).split(",")
		center = Vector3(float(parts[0]), float(parts[1]), float(parts[2]))
		radius = float(parts[3])
	var dist := radius / sin(deg_to_rad(cam.fov * 0.5)) * 1.0
	var dir := Vector3(0, 0, 1)
	match view:
		"front": dir = Vector3(0, 0.08, 1)
		"back": dir = Vector3(0, 0.1, -1)
		"side": dir = Vector3(1, 0.08, 0)
		"side_l": dir = Vector3(-1, 0.08, 0)
		"three": dir = Vector3(0.7, 0.25, 0.8)
		"three_b": dir = Vector3(-0.8, 0.3, -0.7)
		"top": dir = Vector3(0.0, 1.0, 0.15)
	cam.position = center + dir.normalized() * dist
	cam.look_at(center, Vector3.UP)


func _wait_frames(n: int = 3) -> void:
	for i in n:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw


func _run() -> void:
	var size: int = int(args.get("size", "720"))
	get_window().size = Vector2i(size, size)
	get_viewport().size = Vector2i(size, size)
	var out: String = args.get("out", "/tmp/preview")
	var views: PackedStringArray = String(args.get("views", "front,three,side,back")).split(",")
	var clip: String = args.get("clip", "")
	var frames: PackedStringArray = String(args.get("frames", "")).split(",", false)
	var fps := 30.0
	if clip != "" and ap:
		var real := clip
		if not ap.has_animation(real):
			real = clip.trim_suffix("-loop")
			if not ap.has_animation(real) and ap.has_animation(clip + "-loop"):
				real = clip + "-loop"
		if not ap.has_animation(real):
			push_error("Clip inexistente: " + clip)
			get_tree().quit(1)
			return
		ap.play(real)
		ap.pause()
		clip = real
	if frames.is_empty():
		frames = PackedStringArray(["0"])
	for fr in frames:
		if clip != "" and ap:
			ap.seek(float(fr) / fps, true)
		for v in views:
			_frame_camera(v)
			await _wait_frames(3)
			var img := get_viewport().get_texture().get_image()
			var name := "%s_%s_%s.png" % [out, v, fr] if clip != "" else "%s_%s.png" % [out, v]
			img.save_png(name)
			print("SAVED ", name)
	get_tree().quit()


func _load_model(path: String) -> Node3D:
	if path.begins_with("res://"):
		return (load(path) as PackedScene).instantiate()
	var doc := GLTFDocument.new()
	var state := GLTFState.new()
	if doc.append_from_file(path, state) != OK:
		return null
	return doc.generate_scene(state) as Node3D


func _lineup() -> void:
	var paths: PackedStringArray = String(args["models"]).split(",")
	var x := 0.0
	var first := true
	for p in paths:
		var m := _load_model(p)
		if m == null:
			continue
		add_child(m)
		m.position.x = x
		x += float(args.get("gap", "3.6"))
		var a := _find_ap(m)
		if a and a.has_animation(String(args.get("clip", "idle"))):
			a.play(String(args.get("clip", "idle")))
			a.seek(float(args.get("t", "0.3")), true)
			a.pause()
	var size: int = int(args.get("size", "1200"))
	get_window().size = Vector2i(size, int(size * 0.5))
	get_viewport().size = Vector2i(size, int(size * 0.5))
	cam.fov = 40.0
	var cx := (x - float(args.get("gap", "3.6"))) * 0.5
	var view: String = args.get("view", "front")
	var dir := Vector3(0, 0.18, 1)
	if view == "three":
		dir = Vector3(0.5, 0.25, 1)
	cam.position = Vector3(cx, 2.4, 0) + dir.normalized() * float(args.get("dist", "15"))
	cam.look_at(Vector3(cx, 2.1, 0), Vector3.UP)
	await _wait_frames(4)
	var out: String = args.get("out", "/tmp/lineup")
	get_viewport().get_texture().get_image().save_png(out + ".png")
	print("SAVED ", out, ".png")
	get_tree().quit()
