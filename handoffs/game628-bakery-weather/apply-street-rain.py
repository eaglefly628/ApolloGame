"""Install the bakery rain recipes in a local Game628 street candidate."""
import argparse
import json
from pathlib import Path
from shutil import copyfile

HERE = Path(__file__).resolve().parent
PREFIX = 'weather-bakery-'
RAIN = 'weather.rain'
MATERIAL_FIELDS = " Material3D:{emissive:'color',emissiveIntensity:'scalar',opacity:'scalar',roughness:'scalar',color:'color'},"
DECAL_FIELDS = " Decal3D:{opacity:'scalar'},"


def bakery_zone(actor):
    pose = actor.get('Transform3D')
    if not pose:
        return False
    # The old drop origin is skewed west of its ground impact.
    x, z = pose['x'], pose['z']
    margin = .55 if 'Anim3D' in actor and 'Decal3D' not in actor else 0
    return -7.8 - margin <= x <= -.3 and -1.2 <= z <= 4.1


def apply(candidate):
    site = candidate / 'site'
    path = site / 'scenes/crowd-street.json'
    scene = json.loads(path.read_text())
    entities = scene['manifest']['entities']
    environment = scene['environment']
    presets = environment['presets']
    if RAIN not in presets or entities['reference-street']['Transform3D'] != {'x': 0, 'y': 0, 'z': 0}:
        raise ValueError('Expected the original world-space Wutong Street and its rain preset')

    host = candidate / 'environment.ts'
    source = host.read_text()
    if DECAL_FIELDS not in source:
        if source.count(MATERIAL_FIELDS) != 1:
            raise ValueError('Cannot locate the RenderEnvironment field table')
        source = source.replace(MATERIAL_FIELDS, MATERIAL_FIELDS + '\n' + DECAL_FIELDS, 1)

    removed = {
        name for name, actor in entities.items()
        if name.startswith(PREFIX)
        or (name.startswith(('weather-rain-', 'weather-ripple-', 'weather-puddle-')) and bakery_zone(actor))
    }
    for name in removed:
        del entities[name]
    for preset in presets.values():
        preset['patches'] = [patch for patch in preset['patches'] if patch['entity'] not in removed]

    recipes = json.loads((HERE / 'street-rain-layer.json').read_text())
    for name, entity in recipes.items():
        entity_id = PREFIX + name
        decal = entity.get('Decal3D')
        if decal is not None:
            intensity = decal.get('opacity', 1)
            decal['opacity'] = intensity if environment['initial'] == RAIN else 0
        else:
            entity['Visibility'] = {'visible': environment['initial'] == RAIN}
        entities[entity_id] = entity
        for key, preset in presets.items():
            raining = key == RAIN
            if decal is not None:
                patch = {'component': 'Decal3D', 'values': {'opacity': intensity if raining else 0}}
            else:
                patch = {'component': 'Visibility', 'values': {'visible': raining}}
            preset['patches'].append({'entity': entity_id, **patch})

    textures = HERE / 'public/assets'
    entries = json.loads((textures / 'index.json').read_text())['assets']
    texture_ids = {entry['id'] for entry in entries}
    scene['assets'] = [asset for asset in scene['assets'] if asset['key'] not in texture_ids]
    output = site / 'art/bakery-weather'
    output.mkdir(parents=True, exist_ok=True)
    for entry in entries:
        copyfile(textures / entry['path'], output / entry['path'])
        scene['assets'].append({
            'kind': 'texture', 'key': entry['id'], 'src': '/art/bakery-weather/' + entry['path'],
            'colorSpace': entry['spec']['colorSpace'],
        })
    host.write_text(source)
    path.write_text(json.dumps(scene, ensure_ascii=False, indent=2) + '\n')
    print(f'Applied {len(recipes)} bakery rain entities to {path}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('candidate', type=Path, help='Wutong Street candidate directory with site/ and environment.ts')
    apply(parser.parse_args().candidate)
