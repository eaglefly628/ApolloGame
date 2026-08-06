"""美术替换工作流（derive/batch/replace）。"""
import json
import re

from .library import _art_replace_cli
from .paths import _valid_slug, art_root
from .sysutil import ROOT, c
from .t2_replace import GEN_PROVIDER_RE, _put_manifest_anywhere

# ── 美术替换工作流（REQ-DEMO-T1·工作流档 docs/design/art-replacement-workflow.md）───────
# 大脑在 scripts/art-replace.mjs（derive/batch/replace）+ style-packs.mjs·src/assembly 引擎不动。
# 本端点薄胶水 shell 调：derive=扫 manifest 推台账；batch=按风格包批量生成（默认 mock·断点续跑·凭证探针）；
# replace=按编号重钉 manifest 引用，**落盘前过 parseManifest 零 error 铁律**（复用 library_put_manifest）。

def handle_art_packs() -> dict:
    """GET /api/art/style-packs。列风格包（packId/名称/palette/provider/post）。"""
    return _art_replace_cli(['packs'])

def handle_art_derive(body: dict) -> dict:
    """POST /api/art/derive {slug}。扫 library/<slug>/manifest.json 美术槽位 → 台账 art-ledger.json。"""
    slug = str(body.get('slug', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    res = _art_replace_cli(['derive', slug])
    if res.get('ok'):
        print(c("  [ART]", 'g'), f"derive {slug} → {res.get('rows')} 槽位")
    return {'success': bool(res.get('ok')), **res}

def handle_art_ledger(slug: str) -> dict:
    """GET /api/art/ledger?slug=<slug>。读该游戏台账（=替换列表·同一份文件两视角）。"""
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    f = art_root(slug) / 'art-ledger.json'
    if not f.is_file():
        return {'success': False, 'error': '无台账（先 /api/art/derive）'}
    try:
        return {'success': True, **json.loads(f.read_text('utf-8'))}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def handle_art_batch(body: dict) -> dict:
    """POST /api/art/batch {slug, packId, mock?}。按风格包整批生成（默认 mock·断点续跑·无 key 行探针+mock）。"""
    slug = str(body.get('slug', '')).strip()
    pack = str(body.get('packId', '')).strip()
    mock = bool(body.get('mock', False))  # 显式才 mock（R1 ②）；无 key 时脚本探针+mock 兜底
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', pack):  # 白名单：防注入
        return {'success': False, 'error': f'非法 packId: {pack or "(空)"}'}
    args = ['batch', slug, pack] + (['--mock'] if mock else [])
    prov = str(body.get('provider', '')).strip()
    if prov and GEN_PROVIDER_RE.fullmatch(prov):
        args += ['--provider', prov]
    res = _art_replace_cli(args)
    if res.get('ok'):
        s = res.get('summary', {})
        print(c("  [ART]", 'g'), f"batch {slug}·{pack} → 生成 {s.get('generated')} 缓存 {s.get('cached')} mock {s.get('mock')}")
    return {'success': bool(res.get('ok')), **res}

def handle_art_style_save(body: dict) -> dict:
    """POST /api/art/styles {pack:{packId,name,promptZh,promptEn,palette,params,...}}。
    存 owner 自建命名风格进本地库（校验+归一化在 Node·.apollo-styles.json·gitignored·并入风格包供一键换风格选）。"""
    pack = body.get('pack')
    if not isinstance(pack, dict):
        return {'success': False, 'error': '缺 pack 对象'}
    res = _art_replace_cli(['style-save', json.dumps(pack, ensure_ascii=False)])
    if res.get('ok'):
        print(c("  [ART]", 'g'), f"style-save {res.get('packId')}（本地风格库）")
        return {'success': True, 'packId': res.get('packId')}
    return {'success': False, 'error': '·'.join(res.get('errors') or [res.get('error', '保存失败')])}

def handle_art_style_delete(body: dict) -> dict:
    """POST /api/art/styles/delete {packId}。删 owner 自建风格（内置不可删·只动本地库）。"""
    pack_id = str(body.get('packId', '')).strip()
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', pack_id):
        return {'success': False, 'error': f'非法 packId: {pack_id or "(空)"}'}
    res = _art_replace_cli(['style-delete', pack_id])
    if res.get('ok'):
        return {'success': True, 'packId': pack_id}
    return {'success': False, 'error': '·'.join(res.get('errors') or [res.get('error', '删除失败')])}

def handle_art_replace(body: dict) -> dict:
    """POST /api/art/replace {slug}。按编号重钉 manifest 引用 → **过 parseManifest 零 error** → 落盘 + 版本化。"""
    slug = str(body.get('slug', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    res = _art_replace_cli(['replace', slug])
    if not res.get('ok'):
        return {'success': False, **res}
    manifest = res.get('manifest')
    if not isinstance(manifest, dict):
        return {'success': False, 'error': '替换未产出 manifest'}
    data = _put_manifest_anywhere(slug, manifest, '美术批量替换（art-replace）')  # 零 error 铁律（library 版本化/内置直写）
    if data.get('success'):
        print(c("  [ART]", 'g'), f"replace {slug} → 重钉 {res.get('replaced')} 引用·跳过 mock {res.get('skippedMock', 0)}·已落盘")
    return {'success': bool(data.get('success')), 'replaced': res.get('replaced'), 'skippedMock': res.get('skippedMock', 0), **data}
