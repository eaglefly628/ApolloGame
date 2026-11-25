"""Independent read-only verification of scene controls, preserved sources and GLB payloads."""
import argparse
import copy
import hashlib
import json
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCENES = ROOT / 'public/scenes'
VARIANTS = {
    'grocery': ('housing-e', 'housing-e-detail'),
    'bakery': ('housing-a', 'housing-a-bakery'),
    'noodles': ('housing-d', 'housing-d-noodles'),
    'catcafe': ('housing-h', 'housing-h-catcafe'),
    'bikeshop': ('housing-a', 'housing-a-bikeshop'),
}

def read(path):
    return json.loads(path.read_text())

def verify_scenes():
    plan = read(ROOT / 'material-study-20261119/study-plan.json')
    for relative, expected in plan['baselineSha256'].items():
        assert hashlib.sha256((ROOT / relative).read_bytes()).hexdigest() == expected, f'Preserved source changed: {relative}'
    pairs = {name: read(SCENES / f'material-{name}.json') for name in ('original-day', 'detail-day', 'original-evening', 'detail-evening')}
    cameras = [c['manifest']['entities']['camera'] for c in pairs.values()]
    assert all(c == cameras[0] for c in cameras), 'Comparison cameras differ'
    for time in ('day', 'evening'):
        before, after = copy.deepcopy(pairs[f'original-{time}']), copy.deepcopy(pairs[f'detail-{time}'])
        assert before['manifest']['entities']['grocery-residence']['Model3D']['modelKey'] == 'k-housing-e'
        assert after['manifest']['entities']['grocery-residence']['Model3D']['modelKey'] == 'mat-grocery'
        after['manifest']['entities']['grocery-residence']['Model3D']['modelKey'] = 'k-housing-e'
        for c in (before, after):
            c.pop('assets'); c.pop('layout')
        assert before == after, f'Unexpected original/detail scene difference: {time}'
    day, evening = pairs['original-day']['manifest']['entities'], pairs['original-evening']['manifest']['entities']
    assert day.keys() == evening.keys()
    for entity in day:
        for component in ('Transform', 'Transform3D', 'Mesh3D', 'Model3D'):
            assert day[entity].get(component) == evening[entity].get(component), f'Day/evening geometry changed: {entity}/{component}'
    close = {name: read(SCENES / f'material-close-{name}.json') for name in pairs}
    close_cameras = [c['manifest']['entities']['camera'] for c in close.values()]
    assert all(c == close_cameras[0] for c in close_cameras), 'Close comparison cameras differ'
    for name, c in close.items():
        candidate = copy.deepcopy(c)
        camera = candidate['manifest']['entities']['camera']['Camera3D']
        assert camera['distance'] == 8.3 and camera['pivotY'] == 4.65
        camera['distance'] = pairs[name]['manifest']['entities']['camera']['Camera3D']['distance']
        camera['pivotY'] = pairs[name]['manifest']['entities']['camera']['Camera3D']['pivotY']
        assert candidate['manifest'] == pairs[name]['manifest'], f'Close view changes beyond camera: {name}'
        assert candidate['assets'] == pairs[name]['assets']
    baseline, candidate = read(SCENES / 'art-overview.json'), read(SCENES / 'material-street.json')
    for shop in VARIANTS:
        target = candidate['manifest']['entities'][shop + '-residence']['Model3D']
        assert target['modelKey'] == 'mat-' + shop
        target['modelKey'] = baseline['manifest']['entities'][shop + '-residence']['Model3D']['modelKey']
    for c in (baseline, candidate):
        for name in ('assets', 'layout', 'links'):
            c.pop(name)
    assert baseline == candidate, 'Five-shop scene changed beyond assets/layout/links and five model keys'
    return {'baselineHashes': len(plan['baselineSha256']), 'controlledScenes': 8, 'fiveShopScene': 'unchanged except approved keys/UI/assets'}

def glb(path):
    data = path.read_bytes()
    magic, version, size = struct.unpack_from('<III', data)
    assert magic == 0x46546C67 and version == 2 and size == len(data), f'Invalid GLB header: {path}'
    chunks = {}; offset = 12
    while offset < size:
        length, kind = struct.unpack_from('<II', data, offset); offset += 8
        chunks[kind] = data[offset:offset + length]; offset += length
    return json.loads(chunks[0x4E4F534A]), chunks.get(0x004E4942, b'')

def payload(g, binary, index):
    accessor = g['accessors'][index]
    assert 'sparse' not in accessor, 'Sparse accessors need an explicit verifier'
    view = g['bufferViews'][accessor['bufferView']]
    size = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}[accessor['componentType']]
    width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[accessor['type']] * size
    stride = view.get('byteStride', width)
    start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    output = b''.join(binary[start + i * stride:start + i * stride + width] for i in range(accessor['count']))
    assert len(output) == accessor['count'] * width
    return tuple(accessor.get(k) for k in ('componentType', 'type', 'count', 'normalized')), output

def png(data):
    assert data.startswith(b'\x89PNG\r\n\x1a\n'), 'Expected a PNG texture'
    offset = 8; idat = []; dimensions = None
    while offset < len(data):
        size = struct.unpack_from('>I', data, offset)[0]
        kind = data[offset + 4:offset + 8]; body = data[offset + 8:offset + 8 + size]
        crc = struct.unpack_from('>I', data, offset + 8 + size)[0]
        assert zlib.crc32(kind + body) & 0xFFFFFFFF == crc, 'PNG checksum mismatch'
        if kind == b'IHDR':
            w, h, depth, color, compression, filtering, interlace = struct.unpack('>IIBBBBB', body)
            assert w > 0 and h > 0 and compression == 0 and filtering == 0
            dimensions = (w, h, depth, color, interlace)
        if kind == b'IDAT': idat.append(body)
        offset += size + 12
        if kind == b'IEND': break
    assert dimensions and idat
    unpacked = zlib.decompress(b''.join(idat))
    w, h, depth, color, interlace = dimensions
    if interlace == 0:
        channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[color]
        assert len(unpacked) == h * (1 + (w * channels * depth + 7) // 8), 'PNG decompressed size mismatch'
    return dimensions

def verify_model(shop, source_name, output_name):
    source = ROOT / f'public/art/neighborhood-v1/k-library/{source_name}.glb'
    output = ROOT / f'public/art/material-study-20261119/{output_name}.glb'
    if not output.exists(): return {'shop': shop, 'status': 'pending'}
    a, ab = glb(source); b, bb = glb(output)
    for field in ('nodes', 'scenes', 'scene', 'skins', 'animations'):
        assert a.get(field) == b.get(field), f'{shop}: changed {field}'
    assert len(a['meshes']) == len(b['meshes'])
    primitive_count = 0
    for old, new in zip(a['meshes'], b['meshes']):
        assert len(old['primitives']) == len(new['primitives'])
        for p, q in zip(old['primitives'], new['primitives']):
            primitive_count += 1
            assert p.get('mode', 4) == q.get('mode', 4)
            for semantic in ('POSITION', 'NORMAL'):
                assert (semantic in p['attributes']) == (semantic in q['attributes'])
                if semantic in p['attributes']:
                    assert payload(a, ab, p['attributes'][semantic]) == payload(b, bb, q['attributes'][semantic]), f'{shop}: changed {semantic}'
            assert ('indices' in p) == ('indices' in q)
            if 'indices' in p: assert payload(a, ab, p['indices']) == payload(b, bb, q['indices']), f'{shop}: changed indices'
            for semantic in ('TEXCOORD_0', 'TEXCOORD_1'):
                if semantic not in q['attributes']: continue
                uv = b['accessors'][q['attributes'][semantic]]
                assert uv['count'] == b['accessors'][q['attributes']['POSITION']]['count']
                _, uv_data = payload(b, bb, q['attributes'][semantic])
                assert uv['componentType'] == 5126 and uv['type'] == 'VEC2'
                assert all(__import__('math').isfinite(v[0]) for v in struct.iter_unpack('<f', uv_data)), f'{shop}: non-finite UV'
            if 'TANGENT' in q['attributes']:
                tangent = b['accessors'][q['attributes']['TANGENT']]
                assert tangent['componentType'] == 5126 and tangent['type'] == 'VEC4'
                assert tangent['count'] == b['accessors'][q['attributes']['POSITION']]['count']
                _, tangent_data = payload(b, bb, q['attributes']['TANGENT'])
                for x, y, z, w in struct.iter_unpack('<ffff', tangent_data):
                    assert all(__import__('math').isfinite(v) for v in (x, y, z, w))
                    assert abs(x*x + y*y + z*z - 1) < 1e-4 and abs(abs(w) - 1) < 1e-6, f'{shop}: invalid tangent basis'
            material = b['materials'][q.get('material', 0)]
            maps = [material.get('normalTexture'), material.get('occlusionTexture'), material.get('emissiveTexture')]
            maps.extend(material.get('pbrMetallicRoughness', {}).get(k) for k in ('baseColorTexture', 'metallicRoughnessTexture'))
            for texture in filter(None, maps):
                assert 0 <= texture['index'] < len(b['textures'])
                channel = texture.get('extensions', {}).get('KHR_texture_transform', {}).get('texCoord', texture.get('texCoord', 0))
                assert 'TEXCOORD_' + str(channel) in q['attributes'], f'{shop}: texture refers to missing UV channel'
    for material in b.get('materials', []):
        assert material.get('emissiveFactor', [0, 0, 0]) == [0, 0, 0], f'{shop}: emissive color introduced'
        assert 'emissiveTexture' not in material, f'{shop}: emissive map introduced'
        assert material.get('extensions', {}).get('KHR_materials_emissive_strength', {}).get('emissiveStrength', 0) == 0
    sizes = []
    for image in b.get('images', []):
        if 'bufferView' in image:
            view = b['bufferViews'][image['bufferView']]; start = view.get('byteOffset', 0)
            image_data = bb[start:start + view['byteLength']]
        else:
            assert not image['uri'].startswith(('http:', 'https:', 'data:')), 'Expected a local/embedded image'
            image_data = (output.parent / image['uri']).read_bytes()
        sizes.append(png(image_data))
    for texture in b.get('textures', []): assert 0 <= texture['source'] < len(b['images'])
    for material in b.get('materials', []):
        for key in ('baseColorTexture', 'metallicRoughnessTexture'):
            item = material.get('pbrMetallicRoughness', {}).get(key)
            if item is not None: assert 0 <= item['index'] < len(b['textures'])
    return {'shop': shop, 'status': 'pass', 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
            'preserved': ['POSITION', 'NORMAL', 'indices', 'nodes', 'scenes', 'skins', 'animations'],
            'primitives': primitive_count, 'pngImages': len(sizes), 'imageSizes': sizes}

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--allow-pending', action='store_true'); args = parser.parse_args()
    report = {'scenes': verify_scenes(), 'models': [verify_model(shop, *names) for shop, names in VARIANTS.items()]}
    print(json.dumps(report, indent=2))
    if not args.allow_pending: assert all(m['status'] == 'pass' for m in report['models']), 'Material assets still pending'

if __name__ == '__main__': main()
