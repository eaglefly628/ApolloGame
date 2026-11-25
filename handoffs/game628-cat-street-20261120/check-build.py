"""Check the isolated change scope, and make a static build checksum list."""
from hashlib import sha256
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
SITE = ROOT / 'site'
BASE = ROOT.parent / 'game628-activity-ik-20261120' / 'site'
FROZEN = Path('/private/tmp/game628-final.xQX8h8/extracted/site')
SCENES = ('crowd-navigation','crowd-street','reference-street','reference-walk')
SCENE_FILES = {f'scenes/{name}.json' for name in SCENES}
ART = Path('art/reference-rebuild-20261120/scene')
def digest(path):
    return sha256(path.read_bytes()).hexdigest()
def load(path):
    return json.loads(path.read_text())

changed = set()
for old in BASE.rglob('*'):
    if old.is_file():
        rel = old.relative_to(BASE)
        assert (SITE/rel).is_file(), str(rel)
        if digest(old) != digest(SITE/rel):
            changed.add(str(rel))
assert changed == SCENE_FILES, changed
for name in SCENES:
    path = f'scenes/{name}.json'
    before, after = load(BASE/path), load(SITE/path)
    old, new = before['manifest']['entities'], after['manifest']['entities']
    assert set(new)-set(old) == {'cat-cafe-low-platform'}
    scoped = {k for k in old if before['manifest']['entities'][k] != new[k]}
    assert scoped == {'cat-sleep-idle','cat-ginger-idle','cat-floor-idle','lamp-catcafe'}
    assert before['characters'] == after['characters']
    assert before['layout'] == after['layout'] and before['keys'] == after['keys']
    assert before.get('wideStreetFrame') == after.get('wideStreetFrame')
    assert any(item['action']=='pose.martial' for item in next(r for r in after['characters'] if r['entity']=='player')['performances'])
old_hashes = {}
for cat in ('sleep','ginger','floor'):
    rel = ART/f'cat-{cat}-idle.glb'
    old_hashes[cat] = digest(BASE/rel)
    assert old_hashes[cat] == digest(SITE/rel)
    if (FROZEN/rel).is_file():
        assert old_hashes[cat] == digest(FROZEN/rel)
files = sorted(path for path in SITE.rglob('*') if path.is_file())
manifest = ROOT/'site.sha256'
manifest.write_text(''.join(f'{digest(path)}  {path.relative_to(SITE)}\n' for path in files))
report={'buildId':'G628-CAT-STREET-VIS-20261120','base':'18849 / game628-activity-ik-20261120','appProjectId':'22c64537-de6b-4a09-9739-d4812eceb7f3',
    'projectThread':'6af81270-74b0-8191-9057-ef70f62e7001','branch':'codex/mainbranch','baseCommit':'3e6569c260eada56d3ec4ae9f3b96390c2503301','files':len(files),'manifestSha256':digest(manifest),'changed':sorted(changed),'unchangedIdleSha256':old_hashes}
(ROOT/'evidence'/'build.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
