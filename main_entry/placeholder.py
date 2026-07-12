"""占位图解析（art: 引擎真解析）。"""
import subprocess
import json
import hashlib

from .paths import LIBRARY_DIR, _valid_slug
from .sysutil import ROOT, _spawn

# ── 占位图解析（owner 07-12「占位符应显示游戏当前实际在用的图」）────────────────
# art: 查询在运行器里被 resolveArtRefs 确定性解析到免费库第一名——台账也该显示同一张。
# 走 vite-node 跑引擎真解析器（scripts/art-resolve.mjs·与运行器同一套 rankRecords），
# 结果按 manifest 指纹缓存（同稿同图·重复打开零成本）。
_ART_RESOLVE_CACHE: dict = {}

def handle_art_resolve(slug: str) -> dict:
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    mf_path = LIBRARY_DIR / slug / 'manifest.json'
    if not mf_path.is_file():
        mf_path = ROOT / 'public' / 'games' / slug / 'manifest.json'
    if not mf_path.is_file():
        return {'success': False, 'error': f'无 manifest: {slug}'}
    try:
        mh = hashlib.sha1(mf_path.read_bytes()).hexdigest()[:16]
    except Exception as e:
        return {'success': False, 'error': str(e)}
    hit = _ART_RESOLVE_CACHE.get(slug)
    if hit and hit[0] == mh:
        return {'success': True, 'cached': True, **hit[1]}
    try:
        proc = subprocess.run(
            **_spawn(['npx', 'vite-node', 'scripts/art-resolve.mjs', slug]),
            cwd=ROOT, capture_output=True, encoding='utf-8', errors='replace', timeout=120,
        )
    except subprocess.TimeoutExpired:
        return {'success': False, 'error': '解析超时（120s）'}
    if proc.returncode != 0:
        return {'success': False, 'error': (proc.stderr or proc.stdout or '解析失败').strip()[:500]}
    try:
        data = json.loads((proc.stdout or '').strip().splitlines()[-1])
    except Exception as e:
        return {'success': False, 'error': f'解析输出坏形: {e}'}
    _ART_RESOLVE_CACHE[slug] = (mh, data)
    return {'success': True, 'cached': False, **data}
