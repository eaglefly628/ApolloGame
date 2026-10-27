"""Blender 4.5 LTS data worker. Run with --python-exit-code 1 --python worker.py -- payload.json."""
import hashlib
import importlib.util
import json
import math
import re
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

OPS = {'normalize', 'rig-arp', 'retarget-arp', 'build-scene', 'render-views', 'motion-import', 'skin-import', 'motion-variant'}
# Engine/glTF Y-up metres -> Blender Z-up, a proper rotation (determinant +1).
BASIS = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


def log(level, message):
    print(f'[blender-worker] {level}: {message}', flush=True)


def finished(result, operation):
    if 'FINISHED' not in result:
        raise RuntimeError(f'{operation} did not finish: {result}')


def reset_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    scene.frame_set(1)
    return scene


def transform(data):
    # Three.js default Euler XYZ is Rx @ Ry @ Rz; basis-convert the whole matrix.
    rx, ry, rz = data['rotation']
    rotation = Matrix.Rotation(rx, 4, 'X') @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rz, 4, 'Z')
    engine = Matrix.Translation(Vector(data['position'])) @ rotation @ Matrix.Scale(data['scale'], 4)
    return BASIS @ engine @ BASIS.inverted()


def import_glb(path):
    if Path(path).suffix.lower() != '.glb':
        raise ValueError('model input must be GLB')
    before = set(bpy.data.objects)
    finished(bpy.ops.import_scene.gltf(filepath=path, import_pack_images=True), 'GLB import')
    objects = sorted(set(bpy.data.objects) - before, key=lambda obj: obj.name)
    if not any(obj.type == 'MESH' and len(obj.data.vertices) for obj in objects):
        raise ValueError('GLB input contains no nonempty mesh')
    return objects


def glb_document(path):
    data = Path(path).read_bytes()
    if len(data) < 20 or struct.unpack_from('<4sII', data) != (b'glTF', 2, len(data)):
        raise ValueError('normalize requires a valid GLB 2.0 container')
    length, kind = struct.unpack_from('<II', data, 12)
    if kind != 0x4E4F534A or length > len(data) - 20:
        raise ValueError('GLB is missing its JSON chunk')
    document = json.loads(data[20:20 + length])
    for item in document.get('buffers', []) + document.get('images', []):
        if 'uri' in item and not item['uri'].startswith('data:'):
            raise ValueError('normalize requires a self-contained GLB; external URI found')
    return document, len(data)


def mesh_bounds(meshes, matrix):
    minimum, maximum = [math.inf] * 3, [-math.inf] * 3
    count = 0
    for mesh, world in meshes:
        conversion = matrix @ world
        for vertex in mesh.vertices:
            point = conversion @ vertex.co
            if not all(math.isfinite(value) for value in point):
                raise ValueError('mesh contains nonfinite world coordinates')
            for axis in range(3):
                minimum[axis] = min(minimum[axis], point[axis])
                maximum[axis] = max(maximum[axis], point[axis])
            count += 1
    if not count:
        raise ValueError('GLB input contains no vertices')
    return [minimum, maximum]


def validate_normalize_samplers(document, stage):
    supported = {'wrapS': 10497, 'wrapT': 10497, 'magFilter': 9729, 'minFilter': 9987}
    for index, sampler in enumerate(document.get('samplers', [])):
        if not isinstance(sampler, dict):
            raise ValueError(f'normalize rejects unsupported sampler: {stage} samplers[{index}] must be an object')
        for field, expected in supported.items():
            if field in sampler and (type(sampler[field]) is not int or sampler[field] != expected):
                raise ValueError(f'normalize rejects unsupported sampler: {stage} samplers[{index}].{field}={sampler[field]!r}; supported value is {expected} or omitted default')


def normalize(job):
    params = job['params']
    if len(job['inputs']) != 1 or len(job['outputs']) != 2:
        raise ValueError('normalize requires one GLB input and outputs [GLB, JSON]')
    if Path(job['outputs'][0]).suffix.lower() != '.glb' or Path(job['outputs'][1]).suffix.lower() != '.json':
        raise ValueError('normalize outputs must be [GLB, JSON]')
    if set(params) != {'sourceUp', 'targetHeightMeters', 'maxTris', 'maxTextureSize'}:
        raise ValueError('normalize requires exactly sourceUp, targetHeightMeters, maxTris, maxTextureSize')
    source_up, height = params['sourceUp'], params['targetHeightMeters']
    max_tris, max_texture = params['maxTris'], params['maxTextureSize']
    if source_up not in {'Y', 'Z'}:
        raise ValueError('sourceUp must be Y or Z; source semantic up is never guessed')
    if isinstance(height, bool) or not isinstance(height, (int, float)) or not math.isfinite(height) or height <= 0:
        raise ValueError('targetHeightMeters must be a finite positive number')
    if type(max_tris) is not int or max_tris <= 0:
        raise ValueError('maxTris must be a positive integer')
    if type(max_texture) is not int or not 1 <= max_texture <= 2048:
        raise ValueError('maxTextureSize must be an integer from 1 to 2048')
    document, _ = glb_document(job['inputs'][0])
    validate_normalize_samplers(document, 'input')
    for mesh in document.get('meshes', []):
        for primitive_data in mesh.get('primitives', []):
            mode = primitive_data.get('mode', 4)
            if type(mode) is not int or mode != 4:
                raise ValueError(f'normalize rejects unsupported topology: primitive mode={mode!r}; only TRIANGLES (mode=4) is supported')
    if document.get('skins') or document.get('animations'):
        raise ValueError('normalize rejects armature/animation input; use the T5 rig/animation pipeline')
    from io_scene_gltf2 import is_draco_available
    if not is_draco_available():
        raise RuntimeError('Draco encoder missing; normalize refuses an uncompressed export')
    log('decision', f'normalize sourceUp={source_up} height={height}m; Draco level=6 position=20 normal=10 texcoord=12 color=10 generic=12')
    reset_scene()
    previous_images = set(bpy.data.images)
    imported = import_glb(job['inputs'][0])
    images = sorted(set(bpy.data.images) - previous_images, key=lambda image: image.name)
    if any(obj.type == 'ARMATURE' or obj.animation_data is not None for obj in imported):
        raise ValueError('normalize rejects imported armature/animation; use T5')
    if any(obj.type == 'MESH' and obj.data.shape_keys is not None for obj in imported):
        raise ValueError('normalize rejects morph targets/shape keys, including static weights; explicit morph handling is required')
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    meshes = []
    for obj in imported:
        if obj.type == 'MESH' and len(obj.data.vertices):
            evaluated = obj.evaluated_get(depsgraph)
            mesh = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=depsgraph)
            mesh.calc_loop_triangles()
            meshes.append((obj, mesh, obj.matrix_world.copy()))
    triangles_in = sum(len(mesh.loop_triangles) for _, mesh, _ in meshes)
    if triangles_in <= 0:
        raise ValueError('normalize requires triangle geometry')
    if triangles_in > max_tris:
        raise ValueError(f'triangle budget exceeded: {triangles_in} > maxTris={max_tris}; automatic decimation is disabled')
    source_bounds = mesh_bounds([(mesh, world) for _, mesh, world in meshes], BASIS.inverted())
    # Input is encoded as glTF Y-up, but sourceUp describes the model's semantic up.
    rotation = (Matrix.Identity(4) if source_up == 'Y'
                else Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1))))
    bounds = mesh_bounds([(mesh, world) for _, mesh, world in meshes], rotation @ BASIS.inverted())
    source_height = bounds[1][1] - bounds[0][1]
    if source_height <= 0:
        raise ValueError(f'model has zero height along sourceUp={source_up}')
    applied_scale = height / source_height
    if not math.isfinite(applied_scale) or applied_scale <= 0:
        raise ValueError('normalization scale is not finite and positive')
    pivot = Vector(((bounds[0][0] + bounds[1][0]) / 2, bounds[0][1], (bounds[0][2] + bounds[1][2]) / 2))
    conversion = BASIS @ Matrix.Scale(applied_scale, 4) @ Matrix.Translation(-pivot) @ rotation @ BASIS.inverted()
    members = {obj for obj, _, _ in meshes}
    custom_normal_meshes = 0
    for obj, mesh, world in meshes:
        baked = conversion @ world
        corner_normals = None
        if mesh.has_custom_normals:
            # Mesh.transform changes the geometry-relative custom-normal encoding
            # without preserving authored directions, even for positive scales.
            # Retain each polygon corner before baking and use the normal matrix.
            try:
                normal_matrix = baked.to_3x3().inverted().transposed()
            except ValueError as error:
                raise ValueError(f'cannot preserve authored normals under singular mesh transform: {obj.name}') from error
            corner_normals = {
                (polygon.index, mesh.loops[index].vertex_index):
                    (normal_matrix @ mesh.corner_normals[index].vector).normalized()
                for polygon in mesh.polygons for index in polygon.loop_indices
            }
            custom_normal_meshes += 1
        mesh.transform(baked)
        if baked.to_3x3().determinant() < 0:
            mesh.flip_normals()
        mesh.update()
        if corner_normals is not None:
            # flip_normals reorders loops; polygon + vertex identity keeps split
            # normals attached to their original corners after winding reversal.
            mesh.normals_split_custom_set([
                corner_normals[(polygon.index, mesh.loops[index].vertex_index)]
                for polygon in mesh.polygons for index in polygon.loop_indices
            ])
            mesh.update()
        obj.parent = None
        obj.matrix_parent_inverse = Matrix.Identity(4)
        obj.matrix_world = Matrix.Identity(4)
        obj.data = mesh
    omitted = [obj for obj in list(bpy.context.scene.objects) if obj not in members]
    for obj in omitted:
        bpy.data.objects.remove(obj, do_unlink=True)
    log('transition', f'baked {len(meshes)} meshes to metres, identity transforms and bottom-center pivot; tris={triangles_in}; preserved custom-normal meshes={custom_normal_meshes}; omitted nonmesh nodes={len(omitted)}')
    texture_sizes = []
    resized = 0
    for image in images:
        width, image_height = image.size[:]
        if width <= 0 or image_height <= 0:
            raise ValueError(f'texture has no decodable pixels: {image.name}')
        ratio = min(1, max_texture / max(width, image_height))
        if ratio < 1:
            width, image_height = max(1, round(width * ratio)), max(1, round(image_height * ratio))
            image.scale(width, image_height)
            # scale() alone does not mark dirty (Blender T95616); otherwise the
            # exporter may reuse the original oversized packed PNG/JPEG bytes.
            image.pixels[0] = image.pixels[0]
            image.update()
            if not image.is_dirty:
                raise RuntimeError(f'cannot mark resized texture dirty: {image.name}')
            resized += 1
        texture_sizes.append({'name': image.name, 'width': width, 'height': image_height})
    log('transition', f'textures={len(images)} resized={resized} unchanged={len(images) - resized}; limit={max_texture}; material nodes and color spaces preserved')
    bpy.context.view_layer.update()
    finished(bpy.ops.export_scene.gltf(
        filepath=job['outputs'][0], export_format='GLB', export_yup=True,
        export_cameras=False, export_lights=False, export_animations=False,
        export_extras=False, export_apply=False, use_selection=False,
        export_materials='EXPORT', export_image_format='AUTO', export_keep_originals=False,
        use_mesh_edges=False, use_mesh_vertices=False,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=20, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12, export_draco_color_quantization=10,
        export_draco_generic_quantization=12,
    ), 'normalized Draco GLB export')
    exported, byte_count = glb_document(job['outputs'][0])
    validate_normalize_samplers(exported, 'output')
    extension = 'KHR_draco_mesh_compression'
    if extension not in exported.get('extensionsUsed', []):
        raise RuntimeError('Draco export missing KHR_draco_mesh_compression declaration; refusing uncompressed output')
    triangles_out = 0
    primitives = 0
    for mesh in exported.get('meshes', []):
        for primitive_data in mesh.get('primitives', []):
            if primitive_data.get('mode', 4) != 4:
                raise RuntimeError('normalized export contains unsupported nontriangle geometry')
            compressed = primitive_data.get('extensions', {}).get(extension)
            if not isinstance(compressed, dict) or 'bufferView' not in compressed or not compressed.get('attributes'):
                raise RuntimeError('normalized triangle primitive is missing actual Draco compression')
            if 'indices' not in primitive_data:
                raise RuntimeError('normalized Draco primitive is missing triangle indices')
            count = exported['accessors'][primitive_data['indices']]['count']
            if count <= 0 or count % 3:
                raise RuntimeError('normalized export has invalid triangle index count')
            triangles_out += count // 3
            primitives += 1
    if not primitives or triangles_out != triangles_in or triangles_out > max_tris:
        raise RuntimeError(f'export triangle count changed or exceeded budget: in={triangles_in} out={triangles_out} budget={max_tris}')
    if any('bufferView' not in image or 'uri' in image for image in exported.get('images', [])):
        raise RuntimeError('normalized GLB did not embed all material textures')
    # Import the result to exercise the real Draco decoder and measure the final
    # glTF geometry, including compression quantization rather than only intent.
    reset_scene()
    previous_images = set(bpy.data.images)
    decoded = import_glb(job['outputs'][0])
    for image in set(bpy.data.images) - previous_images:
        if min(image.size) <= 0 or max(image.size) > max_texture:
            raise RuntimeError(f'exported texture violates size limit: {image.name} {tuple(image.size)} > {max_texture}')
    bpy.context.view_layer.update()
    bounds = mesh_bounds([(obj.data, obj.matrix_world) for obj in decoded if obj.type == 'MESH'], BASIS.inverted())
    tolerance = max(1e-6, height * 1e-5)
    if (abs(bounds[0][1]) > tolerance or abs(bounds[1][1] - height) > tolerance
            or abs(bounds[0][0] + bounds[1][0]) > 2 * tolerance
            or abs(bounds[0][2] + bounds[1][2]) > 2 * tolerance):
        raise RuntimeError(f'Draco-decoded bounds fail height/pivot contract: {bounds}')
    report = {
        'spec': {'scale': 1, 'up': 'Y', 'pivot': 'bottom-center', 'tris': triangles_out, 'bytes': byte_count},
        'normalization': {
            'sourceUp': source_up, 'targetHeightMeters': height, 'appliedScale': applied_scale,
            'sourceBounds': source_bounds, 'bounds': bounds,
            'trianglesIn': triangles_in, 'trianglesOut': triangles_out,
            'maxTextureSize': max_texture, 'textureSizes': texture_sizes, 'compression': 'draco',
        },
    }
    Path(job['outputs'][1]).write_text(json.dumps(report, sort_keys=True, indent=2, allow_nan=False) + '\n')
    log('commit', f'normalized and Draco-decoded primitives={primitives} tris={triangles_out} bytes={byte_count}; report emitted')


def primitive(data):
    name, source = data['name'], data['source']
    kind = source['primitive']
    if kind == 'empty':
        return bpy.data.objects.new(name, None)
    x, y, z = (component / 2 for component in source['size'])
    if kind == 'box':
        vertices = [(-x, -y, -z), (x, -y, -z), (x, y, -z), (-x, y, -z),
                    (-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]
        faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
                 (2, 3, 7, 6), (0, 4, 7, 3), (1, 2, 6, 5)]
    elif kind == 'plane':
        if y != 0:
            raise ValueError('plane size must be [width,0,depth] in engine XZ')
        vertices, faces = [(-x, 0, -z), (x, 0, -z), (x, 0, z), (-x, 0, z)], [(0, 3, 2, 1)]
    else:
        raise ValueError(f'unknown primitive: {kind}')
    mesh = bpy.data.meshes.new('geometry__' + name)
    mesh.from_pydata([BASIS.to_3x3() @ Vector(v) for v in vertices], [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    material = bpy.data.materials.new('material__' + name)
    material.use_nodes = True
    material.diffuse_color = data.get('color', [0.7, 0.7, 0.7, 1])
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = material.diffuse_color
    bsdf.inputs['Roughness'].default_value = 0.65
    obj.data.materials.append(material)
    return obj


def build_scene(job):
    scene = reset_scene()
    for data in sorted(job['params']['objects'], key=lambda item: item['name']):
        source, name = data['source'], data['name']
        if 'primitive' in source:
            obj = primitive(data)
            scene.collection.objects.link(obj)
        else:
            if 'color' in data:
                raise ValueError('model color override is unsupported; preserve imported materials')
            obj = bpy.data.objects.new(name, None)
            scene.collection.objects.link(obj)
            imported = import_glb(job['inputs'][source['input']])
            members = set(imported)
            for index, child in enumerate(imported):
                # Only the anchor has an E5 prefix. Preserve internal hierarchy/materials/animation.
                child.name = f'part__{name}__{index:04d}'
                if child.parent not in members:
                    child.parent = obj
                    child.matrix_parent_inverse = Matrix.Identity(4)
        if obj.name != name:
            raise ValueError(f'node name collision: {name}')
        obj.matrix_world = transform(data)
        log('transition', f'assembled {name}')
    if not any(obj.type == 'MESH' and len(obj.data.vertices) for obj in scene.objects):
        raise ValueError('refusing empty scene export')
    bpy.context.view_layer.update()
    finished(bpy.ops.export_scene.gltf(
        filepath=job['outputs'][0], export_format='GLB', export_yup=True,
        export_cameras=False, export_lights=False, export_animations=True,
        export_extras=False, export_apply=False, use_selection=False,
        export_current_frame=False,
    ), 'GLB export')


def aim(obj, target):
    delta = BASIS.to_3x3() @ Vector(target) - obj.location
    if delta.length_squared < 1e-12:
        raise ValueError('camera/light target coincides with position')
    obj.rotation_euler = delta.to_track_quat('-Z', 'Y').to_euler()


def canonical_png(path):
    # Blender embeds Date/RenderTime/Cycles timing even with use_stamp=False.
    # Drop metadata chunks only; preserve all pixel/compression/color chunks byte-for-byte.
    data, offset, chunks = Path(path).read_bytes(), 8, []
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('render did not produce PNG')
    while offset < len(data):
        size = struct.unpack('>I', data[offset:offset + 4])[0] + 12
        if offset + size > len(data):
            raise ValueError('truncated render PNG')
        if data[offset + 4:offset + 8] not in {b'tEXt', b'zTXt', b'iTXt', b'tIME', b'eXIf'}:
            chunks.append(data[offset:offset + size])
        offset += size
    Path(path).write_bytes(data[:8] + b''.join(chunks))


def render_views(job):
    scene = reset_scene()
    import_glb(job['inputs'][0])
    # Imported scene lights/cameras never influence the fixed review setup.
    for obj in list(scene.objects):
        if obj.type in {'CAMERA', 'LIGHT'}:
            bpy.data.objects.remove(obj, do_unlink=True)
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 16
    scene.cycles.seed = 0
    scene.cycles.use_animated_seed = False
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.use_denoising = False
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 1
    scene.render.use_persistent_data = False
    scene.render.film_transparent = False
    scene.render.use_stamp = False
    scene.render.dither_intensity = 0
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.render.image_settings.compression = 15
    scene.render.use_file_extension = False
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    world = bpy.data.worlds.new('review_world')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.05, 0.05, 0.05, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1
    scene.world = world
    light = bpy.data.lights.new('review_light', 'AREA')
    light.energy, light.size = 1000, 5
    lamp = bpy.data.objects.new('review_light', light)
    scene.collection.objects.link(lamp)
    lamp.location = BASIS.to_3x3() @ Vector((4, 6, 5))
    aim(lamp, (0, 0, 0))
    camera = bpy.data.objects.new('review_camera', bpy.data.cameras.new('review_camera'))
    scene.collection.objects.link(camera)
    scene.camera = camera
    for view, output in zip(job['params']['views'], job['outputs']):
        camera.location = BASIS.to_3x3() @ Vector(view['position'])
        aim(camera, view['target'])
        camera.data.angle = math.radians(view['fov'])
        camera.data.clip_start, camera.data.clip_end = 0.01, 10000
        scene.render.resolution_x, scene.render.resolution_y = view['width'], view['height']
        scene.render.resolution_percentage = 100
        scene.render.filepath = output
        finished(bpy.ops.render.render(write_still=True), 'PNG render')
        canonical_png(output)
        log('transition', f'rendered view {view["id"]}; normalized PNG metadata, pixels unchanged')


def arp_available():
    for name in ('auto_rig_pro', 'auto_rig_pro_master'):
        try:
            if importlib.util.find_spec(name) is not None:
                return True
        except (ModuleNotFoundError, ValueError):
            continue
    import addon_utils
    for module in addon_utils.modules():
        label = getattr(module, 'bl_info', {}).get('name', '').lower()
        if module.__name__.startswith(('auto_rig_pro', 'auto_rig_pro_master')) or 'auto-rig pro' in label or 'auto rig pro' in label:
            return True
    return False


def standard_bone_name(name):
    name = name.split(':')[-1]
    if name.startswith('mixamorig'):
        name = re.sub(r'^mixamorig[0-9]*_?', '', name)
    mapping = {'Spine2': 'Chest'}
    for side in ('Left', 'Right'):
        for source, target in (('Arm', 'UpperArm'), ('ForeArm', 'LowerArm'), ('UpLeg', 'UpperLeg'), ('Leg', 'LowerLeg')):
            mapping[side + source] = side + target
    return mapping.get(name, name)


def motion_import(job):
    scene = reset_scene()
    motion = job['op'] == 'motion-import'
    source = job['inputs'][0]
    if Path(source).suffix.lower() == '.fbx':
        finished(bpy.ops.import_scene.fbx(filepath=source, use_anim=motion, automatic_bone_orientation=False), 'FBX import')
    else:
        finished(bpy.ops.import_scene.gltf(filepath=source, import_pack_images=True), 'GLB import')
    armatures = [obj for obj in scene.objects if obj.type == 'ARMATURE']
    if len(armatures) != 1:
        raise ValueError('import requires exactly one armature')
    rig = armatures[0]
    names = [standard_bone_name(bone.name) for bone in rig.data.bones]
    if len(names) != len(set(names)):
        raise ValueError('standard skeleton name collision')
    for bone, name in zip(list(rig.data.bones), names):
        bone.name = name
    required = {'Hips', 'Spine', 'Chest', 'Neck', 'Head'}
    for side in ('Left', 'Right'):
        required.update(side + part for part in ('UpperArm', 'LowerArm', 'Hand', 'UpperLeg', 'LowerLeg', 'Foot'))
    if not required.issubset(set(names)):
        raise ValueError('missing required humanoid bones: ' + str(sorted(required - set(names))))
    if motion:
        if not rig.animation_data or not rig.animation_data.action:
            raise ValueError('motion input has no active action')
        action = rig.animation_data.action
        start, end = action.frame_range
        fps = job['params']['fps']
        source_fps = scene.render.fps / scene.render.fps_base
        frames = round((end - start) / source_fps * fps) + 1
        if not 2 <= frames <= 36001:
            raise ValueError('motion frame budget exceeded')
        samples = []
        for index in range(frames):
            time = start + index / fps * source_fps
            scene.frame_set(math.floor(time), subframe=time % 1)
            samples.append({bone.name: bone.matrix_basis.copy() for bone in rig.pose.bones})
        rig.animation_data_clear()
        scene.render.fps, scene.render.fps_base = fps, 1
        scene.frame_start, scene.frame_end = 0, frames - 1
        for index, sample in enumerate(samples):
            scene.frame_set(index)
            for bone in rig.pose.bones:
                bone.rotation_mode = 'QUATERNION'
                bone.matrix_basis = sample[bone.name]
                for path in ('location', 'rotation_quaternion', 'scale'):
                    bone.keyframe_insert(data_path=path, frame=index, group=bone.name)
        rig.animation_data.action.name = job['params']['clipId']
        for obj in list(scene.objects):
            if obj != rig:
                bpy.data.objects.remove(obj, do_unlink=True)
        # Existing engine validation requires skin-backed bones. This authored
        # triangle carries the skeleton; no source character mesh is exported.
        mesh = bpy.data.meshes.new('MotionValidationCarrier')
        mesh.from_pydata([(0, 0, 0), (0.01, 0, 0), (0, 0.01, 0)], [], [(0, 1, 2)])
        carrier = bpy.data.objects.new('MotionValidationCarrier', mesh)
        scene.collection.objects.link(carrier)
        group = carrier.vertex_groups.new(name='Hips')
        group.add([0, 1, 2], 1, 'REPLACE')
        modifier = carrier.modifiers.new('ValidationSkin', 'ARMATURE')
        modifier.object = rig
        carrier.parent = rig
        carrier['motionValidationCarrier'] = True
        rig['motionValidationCarrier'] = True
    else:
        for obj in list(scene.objects):
            obj.animation_data_clear()
        for bone in rig.pose.bones:
            bone.matrix_basis = Matrix.Identity(4)
    scene.frame_set(0)
    bpy.context.view_layer.update()
    finished(bpy.ops.export_scene.gltf(
        filepath=job['outputs'][0], export_format='GLB', export_yup=True,
        export_cameras=False, export_lights=False, export_animations=motion,
        export_animation_mode='ACTIVE_ACTIONS', export_force_sampling=True,
        export_nla_strips_merged_animation_name=job['params'].get('clipId', 'Animation'),
        export_frame_range=True, export_frame_step=1, export_optimize_animation_size=False,
        export_anim_slide_to_zero=True, export_extras=True, export_def_bones=False,
        export_rest_position_armature=True, export_current_frame=False,
        export_apply=False, export_materials='NONE' if motion else 'EXPORT',
    ), 'standard humanoid GLB export')
    log('commit', 'standard humanoid exported; motion carrier=' + str(motion))


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    if len(args) != 1:
        raise ValueError('worker requires exactly one payload.json after --')
    job = json.loads(Path(args[0]).read_text())
    op = job['op']
    if op not in OPS:
        raise ValueError(f'unknown op: {op}')
    log('decision', f'op={op}; inputs={len(job["inputs"])} outputs={len(job["outputs"])}')
    if op in {'rig-arp', 'retarget-arp'}:
        contract = 'typed apollo-humanoid-v1' if job.get('params', {}).get('profile') == 'apollo-humanoid-v1' else 'legacy T7 recognized-only'
        message = (f'{contract}: Auto-Rig Pro plugin missing; install licensed plugin for T5; real execution pending'
                   if not arp_available() else
                   f'{contract}: Auto-Rig Pro plugin found; T5 executor not ready; tested Smart/Remap adapter not ready; real execution pending')
        print(f'[blender-worker] reject: {message}', file=sys.stderr, flush=True)
        raise RuntimeError(message)
    if not job['outputs'] or (op == 'build-scene' and len(job['outputs']) != 1):
        raise ValueError('invalid output count')
    if op == 'render-views' and len(job['params']['views']) != len(job['outputs']):
        raise ValueError('views/output count mismatch')
    for output in job['outputs']:
        Path(output).parent.mkdir(parents=True, exist_ok=True)
    if op == 'motion-variant':
        sys.path.insert(0, str(Path(__file__).parent))
        from motion_variant import motion_variant
        motion_variant(job)
    else:
        {'normalize': normalize, 'build-scene': build_scene, 'render-views': render_views, 'motion-import': motion_import, 'skin-import': motion_import}[op](job)
    for output in job['outputs']:
        path = Path(output)
        if not path.is_file() or path.stat().st_size == 0:
            raise RuntimeError(f'missing/empty output: {output}')
        log('commit', f'{path.name} sha256={hashlib.sha256(path.read_bytes()).hexdigest()} bytes={path.stat().st_size}')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        log('reject', str(error))
        raise SystemExit(1)
