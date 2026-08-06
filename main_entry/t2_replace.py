"""T2 点名替换（regenerate/swap/upload）+ 换皮 + 风格锚 + 落盘门。"""
import json
import shutil
import base64
import re

from .library import _art_replace_cli
from .library_api import library_put_manifest
from .paths import LIBRARY_DIR, _dedup_slug, _game_dir, _run_manifest_check, _valid_slug, _write_json, art_root
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
    f = art_root(slug) / 'art-ledger.json'
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
    _write_json(f, ledger)  # 保留既有缩进·不重格式化（owner 2026-07-22 churn 修）
    print(c("  [ART]", 'g'), f"style {slug} → 锚更新")
    return {'success': True, 'artStyle': style}

GEN_PROVIDER_RE = re.compile(r'qwen|seedream|tripo|meshy')  # 2D:qwen/seedream · 3D:tripo/meshy（owner 2026-07-21 加 seedream·否则选 seedream 被拒→退回 qwen→无 key→mock 噪声图）

def handle_art_approve(body: dict) -> dict:
    """POST /api/art/approve {slug, no|'all', note?, by?}。人审复核（double verify 第二道门·owner
    2026-07-10）：replaced/filled 行 → approved。只许已写回的行复核；'all'=批量过全部可复核行。
    note/by 可选（REQ-ARTPIPE2 A4「逐行人审」加·沿 wizardSignoff/design_finalize 先例记进 history——
    **不在本端点强制**：既有调用方（ArtLedgerPanel doApprove/「全部复核」）从不传 note，若改成强制会
    破坏现有零逻辑重写承诺；「note 空起不代填」这条铁律由调用方 UI 自行把关（起始态永远空、按钮按
    `!note.trim()` 禁用），后端只负责——传了就如实记账，不传也照旧放行。"""
    slug = str(body.get('slug', '')).strip()
    no = str(body.get('no', '')).strip()
    note = str(body.get('note', '') or '').strip()
    by = str(body.get('by', '') or '').strip()
    if note and len(note) > 500:
        return {'success': False, 'error': 'note ≤500 字'}
    if by and len(by) > 40:
        return {'success': False, 'error': 'by ≤40 字'}
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    f = art_root(slug) / 'art-ledger.json'
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
            entry = {'action': 'approve'}
            if note:
                entry['note'] = note
            if by:
                entry['by'] = by
            r.setdefault('history', []).append(entry)
            hit += 1
        elif no != 'all':
            return {'success': False, 'error': f"{no} 状态={r.get('status')}——只有已写回（replaced/filled）的行可复核"}
    _write_json(f, ledger)  # 保留既有缩进·不重格式化（owner 2026-07-22 churn 修）
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
    is_game = (not has_manifest) and (art_root(slug) / 'art-ledger.json').is_file()
    cmdname = 'fill' if is_game else 'regen'
    args = [cmdname, slug, no, pack]
    if isinstance(query, str) and query.strip():
        args += ['--query', query.strip()]
    prov = str(body.get('provider', '')).strip()
    if prov and GEN_PROVIDER_RE.fullmatch(prov):
        args += ['--provider', prov]
    # 手动尺寸覆盖（owner 2026-07-22）：{size:'WxH'} → 该行 targetSize（生成放大到面积线·回缩到此）；防注入=严格 WxH。
    size = str(body.get('size', '')).strip()
    if size and re.fullmatch(r'\d{1,5}x\d{1,5}', size):
        args += ['--size', size]
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

def _backup_orig(slug: str, no: str, orig_entry, gen):
    """首次替换前把原图文件拷到永不被覆盖的备份 art/orig/<no>.<ext>（owner 2026-07-27「回退就没了这张图·要备份」）：
    gen/upload 复用同名 gen/art-NN·gen/NN-up → 新图覆盖原文件·orig.indexEntry 的 path 内容被顶掉·还原找不回。
    拷独立备份 → 还原从备份精确复原。返回备份 served 路径；原本无图片文件（程序化槽）=None。"""
    served = None
    if isinstance(orig_entry, dict) and orig_entry.get('path'):
        served = orig_entry.get('path')
    elif isinstance(gen, dict) and gen.get('servedPath'):
        served = gen.get('servedPath')
    prefix = f'/games/{slug}/art/'
    if not (isinstance(served, str) and served.startswith(prefix)):
        return None
    rel = served[len(prefix):]
    if '..' in rel or rel.startswith('/'):
        return None
    src = art_root(slug) / rel
    if not src.is_file():
        return None
    ext = (src.suffix.lstrip('.') or 'png').lower()
    bak_rel = f'orig/{no}.{ext}'
    bak_abs = art_root(slug) / bak_rel
    bak_abs.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, bak_abs)
    return f'{prefix}{bak_rel}'


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
    abs_path = art_root(slug) / rel
    idx_f = art_root(slug) / 'index.json'
    idx = json.loads(idx_f.read_text('utf-8')) if idx_f.is_file() else {'version': 1, 'assets': []}
    if not isinstance(idx.get('assets'), list):
        idx['assets'] = []
    local_id = f'gen/{no}-up'
    # 编译期游戏（无 manifest·有台账）：写回=skinKey 别名登记 + 台账行直更（无 manifest 可钉）。
    is_game = not (LIBRARY_DIR / slug / 'manifest.json').is_file()
    led_f = art_root(slug) / 'art-ledger.json'
    ledger = row = skin = None
    # ⚠ 备份必须在写新文件**之前**：上传目标 gen/{no}-up 可能正是原图路径·先写就把原图冲掉了（owner 2026-07-27 报 restore 得到新图）。
    if is_game:
        if not led_f.is_file():
            return {'success': False, 'error': '无台账（编译期游戏需先产 art-ledger.json）'}
        ledger = json.loads(led_f.read_text('utf-8'))
        row = next((r for r in ledger.get('rows', []) if r.get('no') == no), None)
        if row is None:
            return {'success': False, 'error': f'台账无 {no}'}
        skin = row.get('skinKey')
        # 首次写回快照原始态（供「一键还原」·保存原 status/gen + 原 index 皮肤条目 + 原图文件备份·此刻磁盘上仍是原图）。
        if 'orig' not in row:
            _orig_entry = next((a for a in idx['assets'] if a.get('id') == skin), None) if skin else None
            _bak = _backup_orig(slug, no, _orig_entry, row.get('gen'))  # 原图文件独立备份（永不被覆盖）
            row['orig'] = {'status': row.get('status'), 'gen': row.get('gen'),
                           'indexEntry': json.loads(json.dumps(_orig_entry)) if _orig_entry else None,
                           'backupPath': _bak}
    # 备份妥了才落新文件（覆盖原图路径安全）。登记本地 index（上传物 = filled·provenance 记 user-upload）
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_bytes(raw)
    _upsert_asset(idx['assets'], {
        'id': local_id, 'type': 'mesh' if ext == 'glb' else 'texture', 'description': f'上传替换 {no}',
        'status': 'filled', 'path': f'/games/{slug}/art/{rel}', 'category': 'ai-gen', 'tags': ['upload', no],
        'license': '用户上传', 'source': 'upload',
        'provenance': {'generator': 'upload', 'prompt': '', 'model': 'user-upload', 'mock': False, 'generatedAt': ''},
    })
    if is_game:
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
        _write_json(led_f, ledger)  # 保留既有缩进·不重格式化
        return {'success': True, 'no': no, 'localId': local_id, 'row': row}
    _write_json(idx_f, idx)  # 原地 upsert·不整份 sort（diff 干净）
    res = _art_replace_cli(['swap', slug, no, local_id, '--upload'])
    if res.get('ok'):
        # 顺修存量 bug（A2 资产浏览器验证时发现·REQ-ARTPIPE2 A4 收单）：library 卡带线过
        # art-replace.mjs swapSlot() 只知 assetId 不知服务路径 → 落账后 gen 缺 servedPath
        # （scripts/ 域不在本单范围·不改 swapSlot 契约，这里补写我们本来就已知的量）。
        # 回填后浏览器缩略图/详情栏不再对 library 卡带退化为图标占位。
        try:
            _led_now = json.loads(led_f.read_text('utf-8')) if led_f.is_file() else None
            if _led_now:
                _row_now = next((r for r in _led_now.get('rows', []) if r.get('no') == no), None)
                if isinstance(_row_now, dict) and isinstance(_row_now.get('gen'), dict) and not _row_now['gen'].get('servedPath'):
                    _row_now['gen']['servedPath'] = f'/games/{slug}/art/{rel}'
                    _write_json(led_f, _led_now)
                    if isinstance(res.get('row'), dict):
                        res['row'] = dict(res['row'], gen=dict(res['row'].get('gen') or {}, servedPath=_row_now['gen']['servedPath']))
        except Exception:
            pass  # 回填是补充信息·失败不影响主流程已落盘的替换结果
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
    led_f = art_root(slug) / 'art-ledger.json'
    if not led_f.is_file():
        return {'success': False, 'error': '无台账'}
    if (LIBRARY_DIR / slug / 'manifest.json').is_file():
        return {'success': False, 'error': '数据卡带请用 manifest 版本回退（还原=编译期游戏台账线）'}
    ledger = json.loads(led_f.read_text('utf-8'))
    row = next((r for r in ledger.get('rows', []) if r.get('no') == no), None)
    if row is None:
        return {'success': False, 'error': f'台账无 {no}'}
    skin = row.get('skinKey')
    idx_f = art_root(slug) / 'index.json'
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
        bak = orig.get('backupPath')
        prefix = f'/games/{slug}/art/'
        bak_abs = (art_root(slug) / bak[len(prefix):]) if isinstance(bak, str) and bak.startswith(prefix) and '..' not in bak else None
        if bak_abs is not None and bak_abs.is_file() and skin:  # 有原图备份 → 皮肤别名指向备份（文件永不被覆盖·原图精确复原·工作台预览也回来）
            e = json.loads(json.dumps(oe)) if isinstance(oe, dict) else {'id': skin, 'type': 'texture', 'category': 'ai-gen', 'tags': ['orig']}
            e['id'] = skin; e['path'] = bak; e['status'] = 'filled'
            _upsert_asset(idx['assets'], e)
            row['status'] = 'replaced'; row['gen'] = {'source': 'orig-restore', 'servedPath': bak}
        elif isinstance(oe, dict):  # 无备份·有原皮肤条目 → 原地复位
            _upsert_asset(idx['assets'], oe)
        elif skin:  # 原本无图片文件（程序化/emoji 槽）→ 删覆盖别名·游戏回退内置绘制
            idx['assets'] = [a for a in idx['assets'] if a.get('id') != skin]
        row.pop('orig', None)
    else:  # 无快照（本更新前写回）→ 删覆盖别名·回退占位；游戏无覆盖=内置程序化/emoji 正确
        if skin:
            idx['assets'] = [a for a in idx['assets'] if a.get('id') != skin]
        row['status'] = 'needs-art'
        row['gen'] = None
    row.pop('history', None)
    _write_json(idx_f, idx)  # 原地·不整份 sort（diff 干净）
    _write_json(led_f, ledger)  # 保留既有缩进·不重格式化
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
    src_led = art_root(slug) / 'art-ledger.json'
    if not src_led.is_file():
        _art_replace_cli(['derive', slug])
    if src_led.is_file():
        dst_led = art_root(new_slug) / 'art-ledger.json'
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
