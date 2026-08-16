"""资产自动标注（Claude 视觉打语义标签）。"""
import subprocess
import os
import time
import json
import base64
import tempfile
import urllib.request
import urllib.parse
from pathlib import Path

from .llm_transport import get_api_key
from .sysutil import ROOT, _spawn, c

# ── 资产自动标注（入库主动扫描 / 存量回填共用一条管线；Claude 视觉打语义标签）──

AUTOTAG_SYSTEM = """You tag 2D game sprites for an asset library's search index.
You will see one pixel-art asset, upscaled with nearest-neighbor on a checkerboard (checkerboard = transparency).
Output ONLY a JSON array of 4-10 lowercase english snake_case tags. No prose, no markdown.
Tag what is VISUALLY evident, in priority order:
1. subject kind: creature / humanoid / item / weapon / armor / tile / icon / fx / decal / portrait
2. element or material by palette & motifs: fire / ice / poison / lightning / holy / dark / metal / wood / stone / gold / crystal
3. notable features: wings / horns / weapon / shield / glow / translucent / skeleton / undead_look / armored / robed / hooded
4. body/shape: quadruped / biped / flying / serpentine / blob / large / small
5. for tiles: floor / wall / walkable_look / pattern words (grass / lava / water / brick / sand)
Rules: do not invent game lore; if unsure about a tag, omit it; never output generic words (pixel, game, sprite, art, image, asset)."""

def _autotag_one(image_path: Path, model: str, api_key: str) -> list[str]:
    """单张：放大 6×（复用 scripts/contact-sheet.mjs）→ Claude 视觉 → JSON 标签数组。"""
    fd, tmp_name = tempfile.mkstemp(suffix='.png')
    os.close(fd)
    tmp = Path(tmp_name)
    try:
        subprocess.run(
            **_spawn(['node', 'scripts/contact-sheet.mjs', '--out', str(tmp), '--cols', '1', '--scale', '6', str(image_path)]),
            cwd=ROOT, capture_output=True, check=True, timeout=30,
        )
        data = base64.standard_b64encode(tmp.read_bytes()).decode()
    finally:
        tmp.unlink(missing_ok=True)

    req_body = json.dumps({
        'model': model,
        'max_tokens': 300,
        'system': AUTOTAG_SYSTEM,
        'messages': [{
            'role': 'user',
            'content': [
                {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/png', 'data': data}},
                {'type': 'text', 'text': 'Tag this asset. JSON array only.'},
            ],
        }],
    }).encode()
    req = urllib.request.Request(
        'https://api.anthropic.com/v1/messages',
        data=req_body,
        headers={'x-api-key': api_key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        out = json.loads(resp.read().decode())
    text = ''.join(b.get('text', '') for b in out.get('content', []) if b.get('type') == 'text').strip()
    # 防御：剥掉可能的 ```json 围栏后解析
    text = text.strip('`').removeprefix('json').strip()
    tags = json.loads(text)
    return [str(t).strip().lower() for t in tags if isinstance(t, str) and t.strip()][:12]

def handle_asset_autotag(body: dict) -> dict:
    """对 assets/index.json 里的条目跑视觉标注，tags 合并写回（带 provenance.autotag 溯源）。

    body = { entries: [{id, path}], model? }   path 相对仓库根（assets/ 开头）。
    单张失败不拖死整批（results 里逐条给 error）。
    """
    entries = body.get('entries', [])
    if not isinstance(entries, list) or not entries:
        return {'success': False, 'error': 'entries 为空'}
    api_key = get_api_key('anthropic')
    if not api_key:
        return {'success': False, 'error': '缺 ANTHROPIC_API_KEY（写进 .env 后重启 apollo）'}
    model = str(body.get('model') or 'claude-opus-5')

    idx_path = ROOT / 'assets' / 'index.json'
    index = json.loads(idx_path.read_text(encoding='utf-8'))
    by_id = {a.get('id'): a for a in index.get('assets', [])}

    results = []
    tagged = 0
    for e in entries:
        eid = str(e.get('id', ''))
        rel = os.path.normpath(str(e.get('path', ''))).replace('\\', '/')
        if not rel.startswith('assets/') or '..' in rel.split('/'):
            results.append({'id': eid, 'error': f'非法路径: {rel}'})
            continue
        if eid not in by_id:
            results.append({'id': eid, 'error': '索引里无此 id'})
            continue
        target = ROOT / rel
        if not target.is_file():
            results.append({'id': eid, 'error': '文件不存在'})
            continue
        try:
            tags = _autotag_one(target, model, api_key)
            entry = by_id[eid]
            old = [t for t in entry.get('tags', []) if isinstance(t, str)]
            entry['tags'] = old + [t for t in tags if t not in old]
            prov = entry.get('provenance') or {}
            prov['autotag'] = {'model': model, 'at': time.strftime('%Y-%m-%d')}
            entry['provenance'] = prov
            tagged += 1
            results.append({'id': eid, 'tags': tags})
            print(c("  [AUTOTAG]", 'g'), f"{eid}: {', '.join(tags)}")
        except Exception as ex:  # 单张失败不拖死整批
            results.append({'id': eid, 'error': str(ex)[:200]})
            print(c("  [AUTOTAG]", 'r'), f"{eid}: {str(ex)[:80]}")

    if tagged:
        idx_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return {'success': True, 'tagged': tagged, 'results': results}
