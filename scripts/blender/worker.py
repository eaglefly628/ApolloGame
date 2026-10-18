"""Blender 4.5 LTS data worker. Run with --python-exit-code 1 --python worker.py -- payload.json."""
import hashlib
import importlib.util
import json
import math
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

OPS = {'normalize', 'rig-arp', 'retarget-arp', 'build-scene', 'render-views'}
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


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    if len(args) != 1:
        raise ValueError('worker requires exactly one payload.json after --')
    job = json.loads(Path(args[0]).read_text())
    op = job['op']
    if op not in OPS:
        raise ValueError(f'unknown op: {op}')
    log('decision', f'op={op}; inputs={len(job["inputs"])} outputs={len(job["outputs"])}')
    if op == 'normalize':
        raise RuntimeError('normalize executor not ready: implement normalization/budget/compression in T4')
    if op in {'rig-arp', 'retarget-arp'}:
        if not arp_available():
            raise RuntimeError('Auto-Rig Pro plugin missing; install licensed plugin for T5')
        raise RuntimeError('Auto-Rig Pro plugin found; T5 executor/configuration not ready')
    if not job['outputs'] or (op == 'build-scene' and len(job['outputs']) != 1):
        raise ValueError('invalid output count')
    if op == 'render-views' and len(job['params']['views']) != len(job['outputs']):
        raise ValueError('views/output count mismatch')
    for output in job['outputs']:
        Path(output).parent.mkdir(parents=True, exist_ok=True)
    (build_scene if op == 'build-scene' else render_views)(job)
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
