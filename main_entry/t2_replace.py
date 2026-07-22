"""T2 点名替换（regenerate/swap/upload）+ 换皮 + 风格锚 + 落盘门。"""
import json
import shutil
import base64
import re

from .library import _art_replace_cli
from .library_api import library_put_manifest
from .paths import LIBRARY_DIR, _dedup_slug, _game_dir, _run_manifest_check, _valid_slug, _write_json
from .pipeline_board import _pipeline_cli
from .sysutil import ROOT, c

# ── T2 点名替换（三式）+ 换皮（REQ-DEMO-T2）───────────────────────────────────────
# 单槽重解析地基：regenerate=重新生成(可改prompt)·swap=从共享库选换·upload=上传替换；三式都过
# parseManifest 零 error 落盘（复用 library_put_manifest）。reskin=同玩法换风格包 → 存新卡带(reskinOf)。

_ART_NO_RE = re.compile(r'art-\d+')
_ASSET_ID_RE = re.compile(r'[A-Za-z0-9][A-Za-z0-9/_.\-]*')

def _put_manifest_anywhere(slug: str, manifest: dict, note: str) -> dict:
    """统一落盘门：library 卡带走 library_put_manifest（校验+版本化）；内置纯数据游戏
    （public/games/<slug>/manifest.json·tracked·owner 2026-07-10）同过 parseManifest 零 error 门后直写。"""
    if (LIBRARY_DIR / slug).is_dir():
        status, data = library_put_manifest(slug, {'manifest': manifest, 'note': note})
        return data
    pub = ROOT / 'public' / 'games' / slug / 'manifest.json'
    if not pub.is_file():
        return {'success': False, 'error': f'游戏不存在（library 与 public 均无 manifest）: {slug}'}
    ok, msg = _run_manifest_check(manifest)
    if not ok:
        return {'success': False, 'error': msg}
    _write_json(pub, manifest)
    try:  # 内置数据游戏同享「落盘即台账刷新」（REQ-WORKSHOP C1·library 线在 library_put_manifest 已加）
        _art_replace_cli(['derive', slug])
    except Exception:
        pass
    return {'success': True, 'builtin': True}

def _art_save_manifest(slug: str, res: dict, note: str, extra: dict) -> dict:
    """CLI 产出 manifest → 过 parseManifest 零 error 落盘（library 版本化 / 内置直写）。"""
    if not res.get('ok'):
        return {'success': False, **res}
    manifest = res.get('manifest')
    if not isinstance(manifest, dict):
        return {'success': False, 'error': '未产出 manifest'}
    data = _put_manifest_anywhere(slug, manifest, note)
    return {'success': bool(data.get('success')), **extra, **data}

def handle_art_style(body: dict) -> dict:
    """POST /api/art/style {slug, stylePrompt?, packId?}。设该游戏的整体美术风格锚（台账头 artStyle·
    owner 07-09 review ②「整体美术风格提示词没地方设置」）。空串=清除。批量/单槽生成自动拼进每行 prompt。"""
    slug = str(body.get('slug', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    f = ROOT / 'public' / 'games' / slug / 'art' / 'art-ledger.json'
    if not f.is_file():
        return {'success': False, 'error': '无台账（先初始化该游戏的美术库）'}
    try:
        ledger = json.loads(f.read_text('utf-8'))
    except Exception as e:
        return {'success': False, 'error': f'台账读取失败: {e}'}
    style = ledger.get('artStyle') if isinstance(ledger.get('artStyle'), dict) else {}
    if 'stylePrompt' in body:
        sp = body.get('stylePrompt')
        if isinstance(sp, str) and sp.strip():
            if len(sp) > 500:
                return {'success': False, 'error': 'stylePrompt 过长（≤500 字）'}
            style['stylePrompt'] = sp.strip()
        else:
            style.pop('stylePrompt', None)
    if 'packId' in body:
        pk = body.get('packId')
        if isinstance(pk, str) and re.fullmatch(r'[a-z0-9][a-z0-9-]*', pk):
            style['packId'] = pk
        else:
            style.pop('packId', None)
    ledger['artStyle'] = style
    f.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(c("  [ART]", 'g'), f"style {slug} → 锚更新")
    return {'success': True, 'artStyle': style}

GEN_PROVIDER_RE = re.compile(r'qwen|seedream|tripo|meshy')  # 2D:qwen/seedream · 3D:tripo/meshy（owner 2026-07-21 加 seedream·否则选 seedream 被拒→退回 qwen→无 key→mock 噪声图）

def handle_art_approve(body: dict) -> dict:
    """POST /api/art/approve {slug, no|'all'}。人审复核（double verify 第二道门·owner 2026-07-10）：
    replaced/filled 行 → approved。只许已写回的行复核；'all'=批量过全部可复核行。"""
    slug = str(body.get('slug', '')).strip()
    no = str(body.get('no', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    f = ROOT / 'public' / 'games' / slug / 'art' / 'art-ledger.json'
    if not f.is_file():
        return {'success': False, 'error': '无台账'}
    ledger = json.loads(f.read_text('utf-8'))
    hit = 0
    for r in ledger.get('rows', []):
        if no != 'all' and r.get('no') != no:
            continue
        if r.get('status') in ('replaced', 'filled'):
            if (r.get('gen') or {}).get('mock'):
                if no != 'all':
                    return {'success': False, 'error': f'{no} 是 mock 占位——mock 产物不可复核（真图生成后再过人门）'}
                continue
            r['status'] = 'approved'
            r.setdefault('history', []).append({'action': 'approve'})
            hit += 1
        elif no != 'all':
            return {'success': False, 'error': f"{no} 状态={r.get('status')}——只有已写回（replaced/filled）的行可复核"}
    f.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(c("  [ART]", 'g'), f"approve {slug} {no} → {hit} 行复核通过")
    return {'success': True, 'approved': hit}

def handle_art_regenerate(body: dict) -> dict:
    """POST /api/art/regenerate {slug, no, packId, query?, mock?}。点名单槽重新生成（可改 prompt）。"""
    slug = str(body.get('slug', '')).strip(); no = str(body.get('no', '')).strip()
    pack = str(body.get('packId', '')).strip(); query = body.get('query'); mock = bool(body.get('mock', False))
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if not _ART_NO_RE.fullmatch(no):
        return {'success': False, 'error': f'非法编号: {no or "(空)"}'}
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', pack):
        return {'success': False, 'error': f'非法 packId: {pack or "(空)"}'}
    # 平台双数据源（R1 ①）：library 卡带走 regen（重钉 manifest）；编译期游戏（无 manifest·有台账）走 fill
    # （写回=skinKey 别名登记本地 index·蓝图零改动）。同一端点同一 UI，差异收在这里。
    has_manifest = (LIBRARY_DIR / slug / 'manifest.json').is_file() or \
        (ROOT / 'public' / 'games' / slug / 'manifest.json').is_file()  # 内置数据游戏也走 manifest 线
    is_game = (not has_manifest) and (ROOT / 'public' / 'games' / slug / 'art' / 'art-ledger.json').is_file()
    cmdname = 'fill' if is_game else 'regen'
    args = [cmdname, slug, no, pack]
    if isinstance(query, str) and query.strip():
        args += ['--query', query.strip()]
    prov = str(body.get('provider', '')).strip()
    if prov and GEN_PROVIDER_RE.fullmatch(prov):
        args += ['--provider', prov]
    if mock:
        args.append('--mock')
    res = _art_replace_cli(args)
    if is_game:
        if res.get('ok'):
            print(c("  [ART]", 'g'), f"fill {slug} {no}·{pack}")
        return {'success': bool(res.get('ok')), 'no': no, 'row': res.get('row'), 'summary': res.get('summary'),
                **({} if res.get('ok') else {'error': res.get('error', 'fill 失败')})}
    return _art_save_manifest(slug, res, f'美术点名重生成 {no}', {'no': no, 'row': res.get('row'), 'summary': res.get('summary')})

def handle_art_swap(body: dict) -> dict:
    """POST /api/art/swap {slug, no, assetId}。从共享库/已有资产选换某槽（不重生成）。"""
    slug = str(body.get('slug', '')).strip(); no = str(body.get('no', '')).strip(); asset_id = str(body.get('assetId', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if not _ART_NO_RE.fullmatch(no):
        return {'success': False, 'error': f'非法编号: {no or "(空)"}'}
    if not asset_id or not _ASSET_ID_RE.fullmatch(asset_id) or '..' in asset_id:
        return {'success': False, 'error': f'非法 assetId: {asset_id or "(空)"}'}
    res = _art_replace_cli(['swap', slug, no, asset_id])
    return _art_save_manifest(slug, res, f'美术换库 {no}→{asset_id}', {'no': no, 'row': res.get('row')})

def _upsert_asset(assets: list, entry: dict) -> None:
    """原地更新同 id 条目（无则末尾追加）——不整份重排 index.json，换一张图只动那一行（owner 07-15「换两个图改一堆」）。"""
    eid = entry.get('id')
    for i, a in enumerate(assets):
        if a.get('id') == eid:
            assets[i] = entry
            return
    assets.append(entry)

def handle_art_upload(body: dict) -> dict:
    """POST /api/art/upload {slug, no, dataBase64, ext}。上传一张图/模型替换某槽（写盘+登记本地 index+钉引用）。"""
    slug = str(body.get('slug', '')).strip(); no = str(body.get('no', '')).strip(); ext = str(body.get('ext', 'png')).strip().lower()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if not _ART_NO_RE.fullmatch(no):
        return {'success': False, 'error': f'非法编号: {no or "(空)"}'}
    if ext not in ('png', 'webp', 'jpg', 'jpeg', 'glb'):
        return {'success': False, 'error': f'非法扩展名: {ext}（png/webp/jpg/glb）'}
    try:
        raw = base64.b64decode(str(body.get('dataBase64', '')))
    except Exception:
        return {'success': False, 'error': 'dataBase64 解码失败'}
    if not raw:
        return {'success': False, 'error': '上传内容为空'}
    # 内容嗅探（R1 ④·非仅扩展名）：magic bytes 与扩展名不符即拒。
    magic_ok = {
        'png': raw.startswith(b'\x89PNG\r\n\x1a\n'),
        'webp': raw.startswith(b'RIFF') and raw[8:12] == b'WEBP',
        'jpg': raw.startswith(b'\xff\xd8\xff'),
        'jpeg': raw.startswith(b'\xff\xd8\xff'),
        'glb': raw.startswith(b'glTF'),
    }.get(ext, False)
    if not magic_ok:
        return {'success': False, 'error': f'文件内容与扩展名 .{ext} 不符（magic bytes 校验失败）'}
    rel = f'gen/{no}-up.{ext}'
    abs_path = ROOT / 'public' / 'games' / slug / 'art' / rel
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_bytes(raw)
    # 登记本地 index（上传物 = filled·provenance 记 user-upload）
    idx_f = ROOT / 'public' / 'games' / slug / 'art' / 'index.json'
    idx = json.loads(idx_f.read_text('utf-8')) if idx_f.is_file() else {'version': 1, 'assets': []}
    if not isinstance(idx.get('assets'), list):
        idx['assets'] = []
    local_id = f'gen/{no}-up'
    _upsert_asset(idx['assets'], {
        'id': local_id, 'type': 'mesh' if ext == 'glb' else 'texture', 'description': f'上传替换 {no}',
        'status': 'filled', 'path': f'/games/{slug}/art/{rel}', 'category': 'ai-gen', 'tags': ['upload', no],
        'license': '用户上传', 'source': 'upload',
        'provenance': {'generator': 'upload', 'prompt': '', 'model': 'user-upload', 'mock': False, 'generatedAt': ''},
    })
    # 编译期游戏（无 manifest·有台账）：写回=skinKey 别名登记 + 台账行直更（无 manifest 可钉）。
    is_game = not (LIBRARY_DIR / slug / 'manifest.json').is_file()
    led_f = ROOT / 'public' / 'games' / slug / 'art' / 'art-ledger.json'
    if is_game:
        if not led_f.is_file():
            return {'success': False, 'error': '无台账（编译期游戏需先产 art-ledger.json）'}
        ledger = json.loads(led_f.read_text('utf-8'))
        row = next((r for r in ledger.get('rows', []) if r.get('no') == no), None)
        if row is None:
            return {'success': False, 'error': f'台账无 {no}'}
        skin = row.get('skinKey')
        # 首次写回快照原始态（供「一键还原」·保存原 status/gen + 原 index 皮肤条目·此刻 idx 里 skin 仍是原条目）。
        if 'orig' not in row:
            _orig_entry = next((a for a in idx['assets'] if a.get('id') == skin), None) if skin else None
            row['orig'] = {'status': row.get('status'), 'gen': row.get('gen'),
                           'indexEntry': json.loads(json.dumps(_orig_entry)) if _orig_entry else None}
        if skin:  # 别名=游戏消费的皮肤 key → 贴图即上画面
            _upsert_asset(idx['assets'], {
                'id': skin, 'type': 'mesh' if ext == 'glb' else 'texture', 'description': f'上传替换 {no}（皮肤槽 {skin}）',
                'status': 'filled', 'path': f'/games/{slug}/art/{rel}', 'category': 'ai-gen', 'tags': ['upload', no, 'skin'],
                'license': '用户上传', 'source': 'upload',
                'provenance': {'generator': 'upload', 'prompt': '', 'model': 'user-upload', 'mock': False, 'generatedAt': ''},
            })
        _write_json(idx_f, idx)  # 不再整份 sort（owner 07-15「换两个图改一堆」：原地 upsert·只动那一行·diff 干净）
        hist = row.setdefault('history', [])
        if not (hist and hist[-1].get('assetId') == local_id):  # 重传同图不重复记（去重）
            hist.append({'action': 'upload', 'assetId': local_id})
        row['status'] = 'replaced'
        row['gen'] = {'source': 'upload', 'localId': local_id, 'servedPath': f'/games/{slug}/art/{rel}'}
        row['provenance'] = {'model': 'user-upload', 'prompt': row.get('query', ''), 'date': '', 'license': '用户上传'}
        led_f.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        return {'success': True, 'no': no, 'localId': local_id, 'row': row}
    _write_json(idx_f, idx)  # 原地 upsert·不整份 sort（diff 干净）
    res = _art_replace_cli(['swap', slug, no, local_id, '--upload'])
    return _art_save_manifest(slug, res, f'美术上传替换 {no}', {'no': no, 'localId': local_id, 'row': res.get('row')})

def handle_art_restore(body: dict) -> dict:
    """POST /api/art/restore {slug, no}。一键还原某槽到原始（撤销 upload/AI 生成写回·owner 07-15）。
    去掉本地 index 覆盖别名 + gen 产物条目 → 游戏回退内置美术（程序化立绘 / emoji 图标）；台账行按
    首次写回快照 row.orig 精确复位（含工作台缩略图）；无快照（本更新前写回的行）=回退占位、游戏仍正确。
    编译期游戏（无 manifest·有台账）线。上传的原图文件不删（保留原始图·仅解除引用）。"""
    slug = str(body.get('slug', '')).strip(); no = str(body.get('no', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if not _ART_NO_RE.fullmatch(no):
        return {'success': False, 'error': f'非法编号: {no or "(空)"}'}
    led_f = ROOT / 'public' / 'games' / slug / 'art' / 'art-ledger.json'
    if not led_f.is_file():
        return {'success': False, 'error': '无台账'}
    if (LIBRARY_DIR / slug / 'manifest.json').is_file():
        return {'success': False, 'error': '数据卡带请用 manifest 版本回退（还原=编译期游戏台账线）'}
    ledger = json.loads(led_f.read_text('utf-8'))
    row = next((r for r in ledger.get('rows', []) if r.get('no') == no), None)
    if row is None:
        return {'success': False, 'error': f'台账无 {no}'}
    skin = row.get('skinKey')
    idx_f = ROOT / 'public' / 'games' / slug / 'art' / 'index.json'
    idx = json.loads(idx_f.read_text('utf-8')) if idx_f.is_file() else {'version': 1, 'assets': []}
    if not isinstance(idx.get('assets'), list):
        idx['assets'] = []
    drop_ids = {f'gen/{no}-up', f'gen/{no}'}  # 上传/生成的本地产物条目（删）
    idx['assets'] = [a for a in idx['assets'] if a.get('id') not in drop_ids]
    orig = row.get('orig')
    if isinstance(orig, dict):  # 有快照 → 精确复位
        row['status'] = orig.get('status')
        row['gen'] = orig.get('gen')
        oe = orig.get('indexEntry')
        if isinstance(oe, dict):  # 原皮肤条目（多为程序化图）原地复位 → 工作台缩略图也回原样
            _upsert_asset(idx['assets'], oe)
        elif skin:  # 原本无该皮肤条目 → 删覆盖别名
            idx['assets'] = [a for a in idx['assets'] if a.get('id') != skin]
        row.pop('orig', None)
    else:  # 无快照（本更新前写回）→ 删覆盖别名·回退占位；游戏无覆盖=内置程序化/emoji 正确
        if skin:
            idx['assets'] = [a for a in idx['assets'] if a.get('id') != skin]
        row['status'] = 'needs-art'
        row['gen'] = None
    row.pop('history', None)
    _write_json(idx_f, idx)  # 原地·不整份 sort（diff 干净）
    led_f.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return {'success': True, 'no': no, 'row': row, 'restored': 'snapshot' if isinstance(orig, dict) else 'fallback'}

def handle_art_reskin(body: dict) -> dict:
    """POST /api/art/reskin {slug, packId, newSlug?, mock?}。同玩法换风格包 → 存新卡带（meta.reskinOf 谱系）。"""
    slug = str(body.get('slug', '')).strip(); pack = str(body.get('packId', '')).strip()
    new_slug = str(body.get('newSlug', '')).strip(); mock = bool(body.get('mock', False))
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', pack):
        return {'success': False, 'error': f'非法 packId: {pack or "(空)"}'}
    src = _game_dir(slug)
    if not src.is_dir():
        if (ROOT / 'public' / 'games' / slug / 'manifest.json').is_file():
            return {'success': False, 'error': '内置数据游戏暂不支持一键换皮（先在创作台另存为卡带）'}
        return {'success': False, 'error': f'源卡带不存在: {slug}'}
    new_slug = _dedup_slug(new_slug if _valid_slug(new_slug) else f'{slug}-{pack}')
    dst = LIBRARY_DIR / new_slug
    try:
        shutil.copytree(src, dst)  # 复制玩法 manifest + meta（玩法一字不改）
    except Exception as e:
        return {'success': False, 'error': f'复制卡带失败: {e}'}
    try:
        meta = json.loads((dst / 'meta.json').read_text('utf-8')) if (dst / 'meta.json').is_file() else {}
    except Exception:
        meta = {}
    meta['reskinOf'] = slug
    _write_json(dst / 'meta.json', meta)
    # 确保源有台账（提供 slot 定义），复制给新卡带
    src_led = ROOT / 'public' / 'games' / slug / 'art' / 'art-ledger.json'
    if not src_led.is_file():
        _art_replace_cli(['derive', slug])
    if src_led.is_file():
        dst_led = ROOT / 'public' / 'games' / new_slug / 'art' / 'art-ledger.json'
        dst_led.parent.mkdir(parents=True, exist_ok=True)
        dst_led.write_bytes(src_led.read_bytes())
    args = ['reskin', new_slug, pack] + (['--mock'] if mock else [])
    res = _art_replace_cli(args)
    out = _art_save_manifest(new_slug, res, f'换皮 {pack}（reskinOf {slug}）', {'newSlug': new_slug, 'summary': res.get('summary')})
    if out.get('success'):
        print(c("  [ART]", 'g'), f"reskin {slug}·{pack} → {new_slug}")
        try:  # 换皮谱系立项卡（REQ-WORKSHOP C1）：新皮卡带 S1 开箱绿·谱系可读
            src_pf = ROOT / 'public' / 'games' / slug / 'pipeline.json'
            src_pitch = ''
            if src_pf.is_file():
                src_pitch = str((json.loads(src_pf.read_text('utf-8')).get('concept') or {}).get('pitch') or '')
            pitch = (f'{src_pitch}（换皮·{pack}·源 {slug}）' if src_pitch else f'换皮自 {slug}（{pack}）')[:300]
            _pipeline_cli(['concept', new_slug, '--name', str(meta.get('name') or new_slug), '--pitch', pitch])
        except Exception:
            pass  # 谱系立项卡失败不回滚换皮
    else:
        shutil.rmtree(dst, ignore_errors=True)  # 失败回滚新卡带
    return out
