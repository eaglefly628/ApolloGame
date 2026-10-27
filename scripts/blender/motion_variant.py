"""M5 deterministic local GLB animation transforms, executed by the typed Blender bridge.
Only animation channels are replaced. Source hierarchy, rest, inverse binds, carrier,
materials and original BIN bytes are retained. No texture/network access or bpy import.
"""
import copy
import json
import math
import struct
from pathlib import Path
from mathutils import Matrix, Quaternion, Vector


def _check(value, message):
    if not value:
        raise ValueError(message)


def load_glb(path):
    data = Path(path).read_bytes()
    _check(len(data) >= 28 and data[:4] == b'glTF', 'variant input requires GLB')
    magic, version, length = struct.unpack_from('<III', data)
    _check(version == 2 and length == len(data), 'invalid GLB header')
    size, kind = struct.unpack_from('<II', data, 12)
    _check(kind == 0x4E4F534A, 'GLB JSON chunk required')
    doc = json.loads(data[20:20 + size])
    offset = 20 + size
    _check(offset + 8 <= len(data), 'GLB BIN chunk required')
    binary_size, binary_kind = struct.unpack_from('<II', data, offset)
    _check(binary_kind == 0x004E4942 and offset + 8 + binary_size == len(data), 'single GLB BIN required')
    _check(len(doc.get('buffers', [])) == 1 and 'uri' not in doc['buffers'][0], 'one embedded buffer required')
    return doc, bytearray(data[offset + 8:])


def _array(doc, binary, index):
    accessor = doc['accessors'][index]
    _check(accessor['componentType'] == 5126 and 'sparse' not in accessor, 'animation accessor must be dense float32')
    width = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[accessor['type']]
    view = doc['bufferViews'][accessor['bufferView']]
    _check(view.get('buffer', 0) == 0, 'external animation buffer')
    stride = view.get('byteStride', width * 4)
    offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    _check(stride >= width * 4, 'invalid accessor stride')
    end = view.get('byteOffset', 0) + view['byteLength']
    _check(accessor['count'] > 0 and offset + (accessor['count'] - 1) * stride + width * 4 <= end <= len(binary), 'animation accessor bounds')
    result = [struct.unpack_from('<' + 'f' * width, binary, offset + i * stride) for i in range(accessor['count'])]
    _check(all(math.isfinite(v) for row in result for v in row), 'nonfinite animation')
    return result


def _matrix(node):
    if 'matrix' in node:
        return Matrix([node['matrix'][i:i + 4] for i in range(0, 16, 4)]).transposed()
    q = node.get('rotation', [0, 0, 0, 1])
    return Matrix.LocRotScale(Vector(node.get('translation', [0, 0, 0])), Quaternion((q[3], *q[:3])), Vector(node.get('scale', [1, 1, 1])))


def _quat(values):
    return Quaternion((values[3], *values[:3])).normalized()


def _xyzw(q):
    return [q.x, q.y, q.z, q.w]


def sample_clip(doc, binary, fps):
    _check(len(doc.get('animations', [])) == 1, 'exactly one source animation required')
    animation = doc['animations'][0]
    nodes = doc['nodes']
    tracks = {}
    duration = 0
    for channel in animation['channels']:
        target = channel['target']
        _check(target['path'] in ('translation', 'rotation', 'scale'), 'only TRS animation supported')
        key = (target['node'], target['path'])
        _check(key not in tracks, 'duplicate animation channel')
        sampler = animation['samplers'][channel['sampler']]
        mode = sampler.get('interpolation', 'LINEAR')
        _check(mode == 'LINEAR', 'variant requires LINEAR source interpolation; STEP/CUBICSPLINE are not silently resampled')
        times = [row[0] for row in _array(doc, binary, sampler['input'])]
        values = _array(doc, binary, sampler['output'])
        _check(len(times) == len(values) and len(times) >= 2 and abs(times[0]) <= 1e-7, 'invalid sample count/start')
        _check(all(a < b for a, b in zip(times, times[1:])), 'nonincreasing times')
        tracks[key] = (times, values, mode)
        duration = max(duration, times[-1])
    frames = round(duration * fps) + 1
    _check(2 <= frames <= 36001 and abs((frames - 1) / fps - duration) <= 2e-5, 'nonuniform source duration')
    rest = []
    for node in nodes:
        p, q, s = _matrix(node).decompose()
        rest.append({'translation': list(p), 'rotation': _xyzw(q), 'scale': list(s)})
    result = []
    for frame in range(frames):
        time = frame / fps
        pose = copy.deepcopy(rest)
        for (index, path), (times, values, mode) in tracks.items():
            hi = next((i for i, at in enumerate(times) if at > time + 1e-7), len(times))
            lo = max(0, hi - 1)
            if hi == len(times) or mode == 'STEP':
                value = list(values[lo])
            else:
                weight = max(0, min(1, (time - times[lo]) / (times[hi] - times[lo])))
                value = _xyzw(_quat(values[lo]).slerp(_quat(values[hi]), weight)) if path == 'rotation' else [a + weight * (b - a) for a, b in zip(values[lo], values[hi])]
            pose[index][path] = value
        result.append(pose)
    return result, rest


def _parents(nodes):
    parent = {}
    for i, node in enumerate(nodes):
        for child in node.get('children', []):
            _check(child not in parent, 'multiple node parents')
            parent[child] = i
    return parent


def _world(pose, nodes):
    parent = _parents(nodes)
    world = {}
    active = set()
    def visit(i):
        if i in world:
            return world[i]
        _check(i not in active, 'cyclic node hierarchy')
        active.add(i)
        local = Matrix.LocRotScale(Vector(pose[i]['translation']), _quat(pose[i]['rotation']), Vector(pose[i]['scale']))
        world[i] = visit(parent[i]) @ local if i in parent else local
        active.remove(i)
        return world[i]
    for i in range(len(nodes)):
        visit(i)
    return world


def mirror_samples(samples, rest, nodes, joints):
    """Reflect world-space rest-relative rotation deltas, then solve destination locals.
    Destination rest translations/scales stay intact, preserving its bone lengths.
    Only Hips translation delta is reflected (x -> -x) and converted through parent.
    Non-Hips animated translation/scale is rejected rather than silently discarded.
    """
    names = {nodes[i].get('name'): i for i in joints}
    _check(len(names) == len(joints), 'unique joint names required')
    mirror = {}
    for name, i in names.items():
        other = name
        for left,right in (('Left','Right'),('L_','R_'),('l_','r_')):
            if name.startswith(left):
                other = right + name[len(left):]
                break
            if name.startswith(right):
                other = left + name[len(right):]
                break
        _check(other in names, 'mirror missing counterpart: ' + name)
        mirror[i] = names[other]
    _check('Hips' in names, 'mirror requires Hips')
    hips = names['Hips']
    parent = _parents(nodes)
    _check(all(min(p['scale']) > 0 and max(p['scale'])-min(p['scale']) < 1e-6 for p in rest), 'mirror nonuniform rest scale unsupported')
    rest_world = _world(rest, nodes)
    reflect = Matrix.Diagonal(Vector((-1, 1, 1)))
    output = []
    for sample in samples:
        for i in joints:
            _check(all(abs(a - b) <= 1e-5 for a, b in zip(sample[i]['scale'], rest[i]['scale'])), 'mirror animated scale unsupported; preserve target lengths')
            if i != hips:
                _check(all(abs(a - b) <= 1e-5 for a, b in zip(sample[i]['translation'], rest[i]['translation'])), 'mirror animated non-Hips translation unsupported')
        animated_world = _world(sample, nodes)
        result = copy.deepcopy(rest)
        desired = {}
        for i in joints:
            source = mirror[i]
            delta = animated_world[source].to_quaternion().to_matrix() @ rest_world[source].to_quaternion().to_matrix().inverted()
            desired[i] = (reflect @ delta @ reflect) @ rest_world[i].to_quaternion().to_matrix()
        solved_world = {}
        active = set()
        def solve(i):
            if i in solved_world:
                return solved_world[i]
            _check(i not in active, 'cyclic skeleton')
            active.add(i)
            pw = solve(parent[i]) if i in parent else Matrix.Identity(4)
            if i in desired:
                local_rotation = pw.to_quaternion().inverted() @ desired[i].to_quaternion()
                result[i]['rotation'] = _xyzw(local_rotation.normalized())
                if i == hips:
                    delta = animated_world[hips].translation - rest_world[hips].translation
                    delta.x = -delta.x
                    desired_position = rest_world[hips].translation + delta
                    result[i]['translation'] = list(pw.inverted() @ desired_position)
            # Non-joint animation on ancestors would make rest-relative mirroring ambiguous.
            else:
                _check(all(abs(a-b) <= 1e-5 for path in ('translation','rotation','scale') for a,b in zip(sample[i][path], rest[i][path])), 'mirror animated non-joint node unsupported')
            solved_world[i] = pw @ Matrix.LocRotScale(Vector(result[i]['translation']), _quat(result[i]['rotation']), Vector(result[i]['scale']))
            active.remove(i)
            return solved_world[i]
        for i in range(len(nodes)):
            solve(i)
        output.append(result)
    return output


def loop_fix_samples(samples, joints):
    """Smoothly correct the final quarter toward the first sample; no contact solver.
    Corrections have smoothstep weights in [0,1], shortest quaternion slerp and
    linear position/scale deltas. Final frame equals first, earlier 75% unchanged.
    """
    output = copy.deepcopy(samples)
    end = len(samples) - 1
    seam = max(1, math.ceil(end / 4))
    start = end - seam
    for frame in range(start + 1, end + 1):
        x = (frame - start) / seam
        weight = x * x * (3 - 2 * x)
        for i in joints:
            for path in ('translation', 'scale'):
                output[frame][i][path] = [value + weight * (a - b) for value, a, b in zip(samples[frame][i][path], samples[0][i][path], samples[-1][i][path])]
            correction = _quat(samples[0][i]['rotation']) @ _quat(samples[-1][i]['rotation']).inverted()
            output[frame][i]['rotation'] = _xyzw(Quaternion().slerp(correction, weight) @ _quat(samples[frame][i]['rotation']))
            _check(all(v > 0 for v in output[frame][i]['scale']), 'loop correction produced nonpositive scale')
    for i in joints:
        output[-1][i] = copy.deepcopy(samples[0][i])
    return output


def _append(doc, binary, values, width):
    while len(binary) % 4:
        binary.append(0)
    start = len(binary)
    for row in values:
        binary.extend(struct.pack('<' + 'f' * width, *row))
    view = len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': start, 'byteLength': len(binary) - start})
    index = len(doc['accessors'])
    accessor = {'bufferView': view, 'componentType': 5126, 'count': len(values), 'type': {1:'SCALAR',3:'VEC3',4:'VEC4'}[width]}
    if width == 1:
        accessor.update(min=[values[0][0]], max=[values[-1][0]])
    doc['accessors'].append(accessor)
    return index


def write_samples(doc, binary, samples, fps, clip_id, joints, output):
    times = _append(doc, binary, [[i / fps] for i in range(len(samples))], 1)
    animation = {'name': clip_id, 'samplers': [], 'channels': []}
    for joint in joints:
        for path, width in (('translation',3),('rotation',4),('scale',3)):
            values = [frame[joint][path] for frame in samples]
            if path == 'rotation':
                for i in range(1,len(values)):
                    if sum(a*b for a,b in zip(values[i-1],values[i])) < 0:
                        values[i] = [-v for v in values[i]]
            accessor = _append(doc, binary, values, width)
            sampler = len(animation['samplers'])
            animation['samplers'].append({'input': times, 'output': accessor, 'interpolation': 'LINEAR'})
            animation['channels'].append({'sampler': sampler, 'target': {'node': joint, 'path': path}})
    doc['animations'] = [animation]
    doc['buffers'][0]['byteLength'] = len(binary)
    encoded = json.dumps(doc, separators=(',', ':'), allow_nan=False).encode()
    encoded += b' ' * ((-len(encoded)) % 4)
    binary += b'\0' * ((-len(binary)) % 4)
    total = 28 + len(encoded) + len(binary)
    data = struct.pack('<III',0x46546C67,2,total) + struct.pack('<II',len(encoded),0x4E4F534A) + encoded + struct.pack('<II',len(binary),0x004E4942) + binary
    with Path(output).open('xb') as stream:
        stream.write(data)


def motion_variant(job):
    params = job['params']
    allowed = {'profile','clipId','fps','kind','trim'}
    _check(isinstance(params.get('fps'),int) and 1 <= params['fps'] <= 120, 'invalid fps')
    _check(isinstance(params.get('clipId'),str) and __import__('re').fullmatch(r'[a-z0-9][a-z0-9-]{0,119}',params['clipId']), 'invalid clipId')
    _check(set(params) <= allowed and params['profile'] == 'apollo-humanoid-v1', 'invalid variant params')
    _check(params['kind'] in ('trim','mirror','loop-fix'), 'unknown variant kind')
    _check(len(job['inputs']) == len(job['outputs']) == 1, 'variant needs one input/output')
    doc, binary = load_glb(job['inputs'][0])
    _check(len(doc.get('skins',[])) == 1, 'one source skin required')
    joints = doc['skins'][0]['joints']
    _check(all(c['target']['node'] in joints for a in doc.get('animations',[]) for c in a['channels']), 'animated non-joint channels unsupported')
    samples, rest = sample_clip(doc,binary,params['fps'])
    if params['kind'] == 'trim':
        a,b = params['trim']
        start,end = round(a*params['fps']),round(b*params['fps'])
        _check(0 <= start < end < len(samples), 'trim range outside source')
        _check(abs(start/params['fps']-a)<1e-7 and abs(end/params['fps']-b)<1e-7, 'trim must align to sample grid')
        samples = samples[start:end+1]
    else:
        _check('trim' not in params, 'trim only belongs to trim variant')
        samples = mirror_samples(samples,rest,doc['nodes'],joints) if params['kind']=='mirror' else loop_fix_samples(samples,joints)
    write_samples(doc,binary,samples,params['fps'],params['clipId'],joints,job['outputs'][0])
    print('[motion-variant] commit: kind=' + params['kind'] + ' frames=' + str(len(samples)) + '; source rest/bind/carrier retained', flush=True)
