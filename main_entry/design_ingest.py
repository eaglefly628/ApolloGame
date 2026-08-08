"""设计稿收发（REQ-DESIGNLINE 过渡轨②③ + 二期①③④·PST 域 2026-08-04/08-08）：
收稿箱落盘（单文件 .dc.html / 整包 zip）+ 台账登记 + 定稿人门 + 需求单↔收稿对账 + UI 需求单推导器薄封装。

背景：owner 手动在 Claude Design 网页做设计稿，手动搬运进项目——本模块消灭搬运的「收」半边（起草
需求单一键复制的「发」半边纯前端拼装 + `scripts/ui-brief.mjs` 推导，不重复造第二套逻辑）。落点
docs/design/<slug>/（与既有游戏设计稿同目录·非 library/ 子树——沿用仓库既有 `docs/design/<game>/*.dc.html`
摆放先例)；台账每游戏一份 `design-ledger.json`（draft→final 沿 wizardSignoff 先例：note 必须真人手填、
永远空起、不代填）。

二期追加（owner 2026-08-08：Claude Design 真实导出物是 zip 包，不是单 html）：
· 整包收稿：安全解包（zip-slip 防护 + 50MB 上限 + 扩展名白名单，非白名单文件跳过不致命·html 仍拒外链
  `<script src=`）→ 落 `docs/design/<slug>/ui-refs/<稿名>/`（保留包内相对路径结构，图片跟 html 的相对
  引用关系不能因搬家而裂图）→ 台账登记整包（`kind:'pack'` + 入口 html + 逐文件 sha256 清单）。
· 需求单↔收稿对账：ingest 时若 `docs/design/<slug>/ui-briefs/` 下有最新需求单，解析其「② 全动作清单」，
  比对收到的（入口）html 里 `data-action="…"` 标注，缺项记 `briefCheck.missing`——**不拒收**，只是台账
  行 + 响应里亮 ⚠。单文件收稿同样跑这条对账（不止 zip）。
"""
import base64
import hashlib
import io
import json
import re
import subprocess
import zipfile
from pathlib import Path

from .paths import _now_iso, _valid_slug, _write_json
from .sysutil import ROOT, _spawn, c

DESIGN_DOCS_DIR = ROOT / 'docs' / 'design'
_MAX_BYTES = 2 * 1024 * 1024  # 单文件收稿 2MB 上限（设计稿应自包含·非夹带大体积媒体的仓库）
_MAX_ZIP_BYTES = 50 * 1024 * 1024  # 整包收稿 50MB 上限（owner 2026-08-08 定·同时防炸弹地界解压后总量）
_ACCEPT_EXT_RE = re.compile(r'\.(dc\.html|html)$', re.IGNORECASE)  # 上传接受名单（原名判定用）
_STEM_RE_BAD = re.compile(r'[^A-Za-z0-9_-]+')
_EXTERNAL_SCRIPT_RE = re.compile(r'<script\b[^>]*\bsrc\s*=', re.IGNORECASE | re.DOTALL)  # 拒收外链脚本
_PACK_EXT_WHITELIST = {'.html', '.css', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.json'}  # zip 内文件白名单
_DATA_ACTION_RE = re.compile(r'data-action\s*=\s*"([^"]+)"|data-action\s*=\s*\'([^\']+)\'')
_PACK_PREVIEW_EXT_RE = re.compile(r'\.(dc\.html|html|css|png|jpe?g|svg|webp|json)$', re.IGNORECASE)


def _design_dir(slug: str) -> Path:
    """resolve docs/design/<slug> 并断言仍在 docs/design/ 子树内（同 _game_dir 先例）。非法 slug/越界 → ValueError。"""
    if not _valid_slug(slug):
        raise ValueError(f'非法 slug: {slug!r}')
    base = DESIGN_DOCS_DIR.resolve()
    d = (DESIGN_DOCS_DIR / slug).resolve()
    if d != base and base not in d.parents:
        raise ValueError(f'路径越界（必须在 docs/design/ 下）: {slug!r}')
    return d


def _ledger_path(slug: str) -> Path:
    return _design_dir(slug) / 'design-ledger.json'


def _read_ledger(slug: str) -> dict:
    p = _ledger_path(slug)
    if not p.is_file():
        return {'version': 1, 'slug': slug, 'entries': []}
    try:
        data = json.loads(p.read_text(encoding='utf-8'))
        if not isinstance(data, dict) or not isinstance(data.get('entries'), list):
            return {'version': 1, 'slug': slug, 'entries': []}
        return data
    except Exception:
        return {'version': 1, 'slug': slug, 'entries': []}


def _sanitize_stem(raw: str) -> str:
    """原名/screen 名 → 安全 stem（非 [A-Za-z0-9_-] 折成 '-'·去首尾·封顶 80 字·空则兜底）。"""
    s = _STEM_RE_BAD.sub('-', str(raw or '').strip()).strip('-')
    return s[:80] or 'design'


def _dedup_stem(dir_path: Path, stem: str) -> str:
    """重名自动 -v2/-v3…顺延（绝不覆盖）——返回最终不冲突的 `<stem>.dc.html` 文件名。"""
    cand = f'{stem}.dc.html'
    i = 2
    while (dir_path / cand).exists():
        cand = f'{stem}-v{i}.dc.html'
        i += 1
    return cand


def _dedup_dirname(parent: Path, stem: str) -> str:
    """目录版 `_dedup_stem`——重名自动 -v2/-v3…顺延（绝不覆盖已有 pack 目录）。返回最终不冲突的目录名。"""
    cand = stem
    i = 2
    while (parent / cand).exists():
        cand = f'{stem}-v{i}'
        i += 1
    return cand


# ── 需求单↔收稿对账（REQ-DESIGNLINE 二期③）───────────────────────────────────
def _latest_brief_path(slug: str):
    """该游戏最新一份 UI 需求单（`scripts/ui-brief.mjs` 产·docs/design/<slug>/ui-briefs/brief-*.md）——
    文件名含日期、字典序即时间序，取最大者。没有 → None（对账不适用，非错误）。"""
    briefs_dir = DESIGN_DOCS_DIR / slug / 'ui-briefs'
    if not briefs_dir.is_dir():
        return None
    files = sorted(p for p in briefs_dir.glob('brief-*.md') if p.is_file())
    return files[-1] if files else None


def _brief_action_list(brief_text: str) -> list:
    """从需求单正文抠出「## ② 全动作清单」表格的反引号动作名（原样保序去重）。抠不到该节 → []。
    **只认表格行**（以 `|` 起首的行）——该节表格下方还有一行提示文字「`data-action` 原样照抄…」，
    它自己也用反引号包住 `data-action` 四个字，若不限定表格行会把这个字面量误当成一个"动作名"
    （实测踩过：真跑 design-import 时台账多出一条虚假 missing 项 `data-action`，已用此限定修）。"""
    m = re.search(r'^##\s*②.*$', brief_text, re.MULTILINE)
    if not m:
        return []
    rest = brief_text[m.end():]
    nxt = re.search(r'^##\s', rest, re.MULTILINE)
    section = rest[:nxt.start()] if nxt else rest
    names, seen = [], set()
    for line in section.split('\n'):
        if not line.strip().startswith('|'):
            continue
        for cell in re.findall(r'`([^`]+)`', line):
            if cell not in seen:
                seen.add(cell)
                names.append(cell)
    return names


def _check_brief_actions(slug: str, html_text: str) -> dict:
    """需求单↔收稿对账：该游戏 ui-briefs/ 有需求单 → 解析②动作清单，比对 html 里 `data-action="…"`
    标注，缺项列 missing（**不拒收**，只是台账 + 响应里亮 ⚠）。无需求单/需求单无②清单 → applicable:False
    （对账不适用；不是「查出来全齐」，前端应区分展示）。"""
    bp = _latest_brief_path(slug)
    if not bp:
        return {'applicable': False, 'missing': [], 'ok': True}
    try:
        brief_text = bp.read_text(encoding='utf-8')
    except Exception:
        return {'applicable': False, 'missing': [], 'ok': True}
    expected = _brief_action_list(brief_text)
    if not expected:
        return {'applicable': False, 'missing': [], 'ok': True}
    found = set()
    for m in _DATA_ACTION_RE.finditer(html_text or ''):
        found.add(m.group(1) or m.group(2))
    missing = [a for a in expected if a not in found]
    return {'applicable': True, 'briefFile': bp.name, 'expected': len(expected), 'missing': missing, 'ok': len(missing) == 0}


def handle_design_ingest(body: dict) -> dict:
    """POST /api/design/ingest {slug, filename, dataBase64, screenName?}。按 filename 扩展名分派：
    `.zip` → 整包收稿（`handle_design_ingest_zip`·REQ-DESIGNLINE 二期④）；`.html`/`.dc.html` → 单文件
    收稿（过渡轨②原逻辑）。两条路都跑需求单↔收稿对账（二期③）。"""
    orig_name = str(body.get('filename') or '').strip()
    if orig_name.lower().endswith('.zip'):
        return handle_design_ingest_zip(body)
    return _handle_design_ingest_single(body)


def _handle_design_ingest_single(body: dict) -> dict:
    """单文件收稿（过渡轨②）：base64 收稿（JSON body·同 /api/art/upload 先例）——仅收 .html/.dc.html·
    ≤2MB·拒收含 `<script src=` 外链的稿（设计稿应自包含）→ 落 docs/design/<slug>/<原名或
    screenName>.dc.html（重名 -v2 顺延·绝不覆盖，落盘一律统一为 .dc.html 扩展名）+ 登记
    docs/design/<slug>/design-ledger.json（status: draft·带需求单对账 briefCheck）。"""
    slug = str(body.get('slug') or '').strip()
    orig_name = str(body.get('filename') or '').strip()
    screen_name = str(body.get('screenName') or '').strip()
    data_b64 = body.get('dataBase64')
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if not orig_name:
        return {'success': False, 'error': '缺 filename'}
    if not _ACCEPT_EXT_RE.search(orig_name):
        return {'success': False, 'error': '只收 .html / .dc.html / .zip'}
    if not isinstance(data_b64, str) or not data_b64:
        return {'success': False, 'error': '缺 dataBase64'}
    try:
        raw = base64.b64decode(data_b64, validate=True)
    except Exception as e:
        return {'success': False, 'error': f'base64 解码失败: {e}'}
    if not raw:
        return {'success': False, 'error': '上传内容为空'}
    if len(raw) > _MAX_BYTES:
        return {'success': False, 'error': f'超过 2MB 上限（{len(raw)} 字节·多文件请打包 .zip，上限 50MB）'}
    try:
        text = raw.decode('utf-8')
    except Exception as e:
        return {'success': False, 'error': f'非 UTF-8 文本: {e}'}
    if _EXTERNAL_SCRIPT_RE.search(text):
        return {'success': False, 'error': '拒收：含 <script src= 外链——设计稿应自包含（内联脚本/样式）'}
    try:
        d = _design_dir(slug)
    except ValueError as e:
        return {'success': False, 'error': str(e)}
    d.mkdir(parents=True, exist_ok=True)
    stem_source = screen_name or re.sub(r'\.(dc\.html|html)$', '', orig_name, flags=re.IGNORECASE)
    stem = _sanitize_stem(stem_source)
    final_name = _dedup_stem(d, stem)
    target = d / final_name
    target.write_bytes(raw)
    sha256 = hashlib.sha256(raw).hexdigest()
    brief_check = _check_brief_actions(slug, text)
    ledger = _read_ledger(slug)
    ledger['slug'] = slug
    entry = {'filename': final_name, 'kind': 'single', 'sha256': sha256, 'receivedAt': _now_iso(),
              'size': len(raw), 'status': 'draft', 'briefCheck': brief_check}
    ledger['entries'] = list(ledger.get('entries', [])) + [entry]
    _write_json(_ledger_path(slug), ledger)
    warn = f"（⚠ 缺 {len(brief_check['missing'])} 个需求单动作未标注）" if brief_check.get('missing') else ''
    print(c("  [DESIGN]", 'g'), f"收稿 {slug}/{final_name}（{len(raw)}B·sha256={sha256[:12]}…）{warn}")
    return {'success': True, 'slug': slug, 'filename': final_name, 'sha256': sha256, 'entry': entry, 'briefCheck': brief_check}


def _safe_pack_member_path(pack_dir: Path, member_name: str):
    """zip 条目名 → 落盘绝对路径，纵深断言仍在 pack_dir 内（防 zip-slip：绝对路径/`..` 段/空段一律拒）。
    合法返回 Path；非法返回 None（调用方据此整包拒收，不做"跳过这一条继续"——路径越界是安全问题，
    不是"这条格式我不认识"的白名单问题，两者拒收语义必须分开，见类头注）。"""
    name = str(member_name or '').replace('\\', '/')
    if not name or name.startswith('/') or name.endswith('/'):
        return None
    parts = [p for p in name.split('/') if p not in ('', '.')]
    if not parts or any(p == '..' for p in parts):
        return None
    target = pack_dir.joinpath(*parts)
    try:
        target.resolve().relative_to(pack_dir.resolve())
    except ValueError:
        return None
    return target


def _pick_entry_html(html_rels: list):
    """从已收纳的 html 相对路径里选入口。优先 basename 为 index.html/index.dc.html 且路径最浅（同浅按
    字典序）；没有这种命名且唯一一个 html → 就是它；多个候选又判不出 → (None, 错误信息，回喂弄一个
    顶层 index.html)。"""
    if not html_rels:
        return None, 'zip 内无 html 文件（至少要有一个 .html 作为入口）'
    def depth(r):
        return r.count('/')
    idx_candidates = sorted(
        (r for r in html_rels if Path(r).name.lower() in ('index.html', 'index.dc.html')),
        key=lambda r: (depth(r), r),
    )
    if idx_candidates:
        return idx_candidates[0], None
    if len(html_rels) == 1:
        return html_rels[0], None
    return None, (f'zip 内有 {len(html_rels)} 个 html 且无法判定入口（无 index.html）：'
                   + ', '.join(sorted(html_rels)) + '——请在包顶层放一个 index.html')


def handle_design_ingest_zip(body: dict) -> dict:
    """POST /api/design/ingest {slug, filename(.zip), dataBase64, screenName?}。整包收稿（REQ-DESIGNLINE
    二期④·owner 2026-08-08：Claude Design 导出物本就是 zip）：
    ① 安全解包——每条目先过 zip-slip 纵深断言（`_safe_pack_member_path`，越界=整包拒收）；
    ② 50MB 上限（原始包体 + 解压后累计双卡，防炸弹）；
    ③ 扩展名白名单（html/css/png/jpg/jpeg/svg/webp/json）——不在白名单的**单条跳过**（非致命，记
       skippedFiles，因为设计稿包里常有 .DS_Store/.zip 自带的杂项，不该因此整包作废）；
    ④ html 条目仍拒外链 `<script src=`（任一 html 命中即整包拒收——安全策略不因打包而降级）；
    ⑤ 入口 html 判定见 `_pick_entry_html`；
    落 docs/design/<slug>/ui-refs/<稿名>/（保留包内相对路径结构，重名目录 -v2 顺延·绝不覆盖）+ 登记
    design-ledger.json（kind:'pack'·entryHtml·files 逐条 sha256+size）+ 需求单对账（对入口 html 跑）。
    """
    slug = str(body.get('slug') or '').strip()
    orig_name = str(body.get('filename') or '').strip()
    screen_name = str(body.get('screenName') or '').strip()
    data_b64 = body.get('dataBase64')
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if not orig_name.lower().endswith('.zip'):
        return {'success': False, 'error': '文件名须以 .zip 结尾'}
    if not isinstance(data_b64, str) or not data_b64:
        return {'success': False, 'error': '缺 dataBase64'}
    try:
        raw = base64.b64decode(data_b64, validate=True)
    except Exception as e:
        return {'success': False, 'error': f'base64 解码失败: {e}'}
    if not raw:
        return {'success': False, 'error': '上传内容为空'}
    if len(raw) > _MAX_ZIP_BYTES:
        return {'success': False, 'error': f'超过 50MB 上限（{len(raw)} 字节）'}
    try:
        zf = zipfile.ZipFile(io.BytesIO(raw))
    except Exception as e:
        return {'success': False, 'error': f'不是合法 zip: {e}'}
    infos = [i for i in zf.infolist() if not i.filename.endswith('/')]
    if not infos:
        return {'success': False, 'error': 'zip 内无文件'}
    total_uncompressed = sum(i.file_size for i in infos)
    if total_uncompressed > _MAX_ZIP_BYTES:
        return {'success': False, 'error': f'解压后总大小超过 50MB 上限（{total_uncompressed} 字节）'}
    try:
        d = _design_dir(slug)
    except ValueError as e:
        return {'success': False, 'error': str(e)}
    refs_dir = d / 'ui-refs'
    # 注意：这里**不** mkdir——校验（zip-slip/白名单/外链）没通过前不许在磁盘上留任何痕迹（哪怕是空目录）。
    # `_dedup_dirname` 的 `.exists()` 检查对不存在的父目录天然返回 False，不需要 refs_dir 真实存在。
    stem_source = screen_name or re.sub(r'\.zip$', '', orig_name, flags=re.IGNORECASE)
    stem = _sanitize_stem(stem_source)
    final_stem = _dedup_dirname(refs_dir, stem)
    pack_dir = refs_dir / final_stem

    # ── 第一遍：纯校验（zip-slip / 白名单 / html 外链）——全过了才落盘，防半包 ──
    accepted = []       # [(rel, target_path, data_bytes)]
    skipped = []         # 白名单外·非致命
    html_texts = {}      # rel_path -> decoded text（外链脚本检测 + 入口判定 + 对账都要用）
    for info in infos:
        rel = info.filename.replace('\\', '/')
        target = _safe_pack_member_path(pack_dir, info.filename)
        if target is None:
            return {'success': False, 'error': f'拒收：zip 条目路径越界或非法 — {rel}'}
        ext = Path(rel).suffix.lower()
        if ext not in _PACK_EXT_WHITELIST:
            skipped.append(rel)
            continue
        data = zf.read(info)
        if ext == '.html':
            try:
                text = data.decode('utf-8')
            except Exception:
                return {'success': False, 'error': f'非 UTF-8 文本: {rel}'}
            if _EXTERNAL_SCRIPT_RE.search(text):
                return {'success': False, 'error': f'拒收：{rel} 含 <script src= 外链——设计稿应自包含'}
            html_texts[rel] = text
        accepted.append((rel, target, data))
    if not accepted:
        return {'success': False, 'error': '白名单过滤后 zip 内无可收文件（只收 html/css/png/jpg/jpeg/svg/webp/json）'}

    entry_html, err = _pick_entry_html(sorted(html_texts.keys()))
    if err:
        return {'success': False, 'error': err}

    # ── 全部校验通过 → 落盘 ──
    pack_dir.mkdir(parents=True, exist_ok=True)
    files_meta = []
    for rel, target, data in accepted:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        files_meta.append({'path': rel, 'sha256': hashlib.sha256(data).hexdigest(), 'size': len(data)})
    total_size = sum(f['size'] for f in files_meta)

    brief_check = _check_brief_actions(slug, html_texts.get(entry_html, ''))

    ledger = _read_ledger(slug)
    ledger['slug'] = slug
    entry = {
        'filename': final_stem, 'kind': 'pack', 'entryHtml': entry_html, 'files': files_meta,
        'receivedAt': _now_iso(), 'size': total_size, 'status': 'draft',
        'skippedFiles': skipped, 'briefCheck': brief_check,
    }
    ledger['entries'] = list(ledger.get('entries', [])) + [entry]
    _write_json(_ledger_path(slug), ledger)
    warn = f"（⚠ 缺 {len(brief_check['missing'])} 个需求单动作未标注）" if brief_check.get('missing') else ''
    print(c("  [DESIGN]", 'g'),
          f"收稿(zip) {slug}/{final_stem}/（{len(files_meta)} 文件·{total_size}B·入口={entry_html}"
          + (f"·跳过{len(skipped)}" if skipped else '') + f"）{warn}")
    return {'success': True, 'slug': slug, 'filename': final_stem, 'entryHtml': entry_html,
             'entry': entry, 'briefCheck': brief_check}


def handle_design_ledger_get(slug: str) -> dict:
    """GET /api/design/ledger?slug=<slug> → {success, entries:[...]}（该游戏已在档 .dc.html 列表）。"""
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    ledger = _read_ledger(slug)
    return {'success': True, 'slug': slug, 'entries': ledger.get('entries', [])}


def handle_design_finalize(body: dict) -> dict:
    """POST /api/design/finalize {slug, filename, note, by?}。人门定稿：draft→final（note 必填·永远
    真人手填·不代填——沿 wizardSignoff 先例）。final=「在档=1:1 复刻基准」铁律的挂载对象。"""
    slug = str(body.get('slug') or '').strip()
    filename = str(body.get('filename') or '').strip()
    note = str(body.get('note') or '').strip()
    by = str(body.get('by') or '').strip() or 'owner'
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if not filename:
        return {'success': False, 'error': '缺 filename'}
    if not note:
        return {'success': False, 'error': '定稿必须带 note（review 内容落账·不许空签）'}
    if len(note) > 500 or len(by) > 40:
        return {'success': False, 'error': 'note ≤500 字 · by ≤40 字'}
    ledger = _read_ledger(slug)
    entries = ledger.get('entries', [])
    hit = next((e for e in entries if isinstance(e, dict) and e.get('filename') == filename), None)
    if hit is None:
        return {'success': False, 'error': f'台账无此文件: {filename}'}
    hit['status'] = 'final'
    hit['note'] = note
    hit['by'] = by
    hit['finalizedAt'] = _now_iso()
    ledger['entries'] = entries
    _write_json(_ledger_path(slug), ledger)
    print(c("  [DESIGN]", 'g'), f"定稿 {slug}/{filename}（by={by}）")
    return {'success': True, 'slug': slug, 'filename': filename, 'entry': hit}


def design_preview_path(slug: str, filename: str):
    """校验 + 定位 docs/design/<slug>/<filename> 供只读预览伺服。`filename` 可以是：
    ① 单文件收稿的 basename（legacy·docs/design/<slug>/<file>.dc.html）；
    ② pack 内相对路径（`ui-refs/<稿名>/…`·docs/design/<slug>/ui-refs/** 任意深度——预览要能打开
       入口 html 引用的同目录图片，不能只认 basename，否则整包收稿的预览会裂图）。
    两者统一校验：不许绝对路径/`..` 段（防路径穿越）+ 归一化后仍落在该游戏 docs/design/<slug>/ 子树内
    （纵深断言·同 _serve_public_games 先例）+ 扩展名在预览白名单。返回 (ok, Path|错误信息)。"""
    if not _valid_slug(slug):
        return False, f'非法 slug: {slug or "(空)"}'
    filename = str(filename or '').replace('\\', '/')
    if not filename or filename.startswith('/') or any(p == '..' for p in filename.split('/')):
        return False, f'非法文件名: {filename or "(空)"}'
    if not _PACK_PREVIEW_EXT_RE.search(filename):
        return False, f'非法文件类型: {filename}'
    try:
        d = _design_dir(slug)
    except ValueError as e:
        return False, str(e)
    target = (d / filename).resolve()
    try:
        target.relative_to(d.resolve())
    except ValueError:
        return False, '路径越界'
    if not target.is_file():
        return False, '文件不存在'
    return True, target


# ── UI 需求单推导器薄封装（REQ-DESIGNLINE 二期①②·PST 域 2026-08-08）─────────────
# 大脑在 scripts/ui-brief.mjs（三源合并去重推导·纯函数+CLI）；本端点只 shell 调 + 转发（同
# _pipeline_cli / _art_replace_cli 先例，不在 Python 侧另写一份推导逻辑）。
def _ui_brief_cli(args: list, timeout: int = 60) -> dict:
    """shell `node scripts/ui-brief.mjs` → 解析末行 JSON。"""
    try:
        proc = subprocess.run(**_spawn(['node', 'scripts/ui-brief.mjs', *args]), cwd=ROOT, capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return {'ok': False, 'error': 'UI 需求单推导超时'}
    out = proc.stdout.decode('utf-8', 'replace').strip()
    line = out.splitlines()[-1] if out else ''
    try:
        return json.loads(line)
    except Exception:
        err = proc.stderr.decode('utf-8', 'replace').strip() or out
        return {'ok': False, 'error': f'解析失败: {err[:400]}'}


def handle_design_ui_brief(body: dict) -> dict:
    """POST /api/design/ui-brief {slug, taste?}。workshop 步进器「📐 生成 UI 设计需求单」钮调用（S3
    骨架关绿后出现）——薄封装 `node scripts/ui-brief.mjs --game <slug> [--taste …] --json`。落盘于
    docs/design/<slug>/ui-briefs/brief-<日期>.md，原样把 markdown 带回给前端塞进既有一键复制框。"""
    slug = str(body.get('slug') or '').strip()
    taste = str(body.get('taste') or '').strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if len(taste) > 300:
        return {'success': False, 'error': '品味一句话过长（≤300 字）'}
    args = ['--game', slug, '--json']
    if taste:
        args += ['--taste', taste]
    res = _ui_brief_cli(args)
    if not res.get('ok'):
        return {'success': False, 'error': res.get('error') or 'UI 需求单推导失败'}
    print(c("  [DESIGN]", 'g'),
          f"UI 需求单 {slug} → {res.get('path')}（{res.get('screenCount')} 屏 · {res.get('actionCount')} 动作）")
    return {'success': True, **res}
