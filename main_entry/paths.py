"""路径/slug 校验与归一化、库/设计相对路径防护、共享路径常量、引擎 manifest 校验壳。"""
import subprocess
import time
import json
import re
import unicodedata
from pathlib import Path

from .sysutil import ROOT, _spawn

GAME_RE = re.compile(r'game-[a-z0-9]+')

LIBRARY_DIR = ROOT / 'library'
_SLUG_RE = re.compile(r'^[a-z0-9][a-z0-9-]*$')

def _valid_slug(slug) -> bool:
    return isinstance(slug, str) and 0 < len(slug) <= 64 and '..' not in slug and _SLUG_RE.match(slug) is not None

def _slugify(name: str) -> str:
    """名称 → slug：ascii 化 + 小写 + 非字母数字折成 '-' + 去首尾/合并连字符。
    转不出字母（中文名等）→ 唯一数字编号 game-001/002…（owner 07-11：库里要有唯一代号，别落光秃秃的 game）。"""
    s = unicodedata.normalize('NFKD', str(name)).encode('ascii', 'ignore').decode('ascii').lower()
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s or _next_game_no()

def _next_game_no() -> str:
    """下一个空闲编号 slug：扫 library/ 与 public/games/ 的 game-NNN（含裸 game 视为占用），取 max+1。"""
    top = 0
    for base in (LIBRARY_DIR, ROOT / 'public' / 'games'):
        if not base.is_dir():
            continue
        for d in base.iterdir():
            m = re.fullmatch(r'game-(\d{3,})', d.name)
            if m:
                top = max(top, int(m.group(1)))
    return f'game-{top + 1:03d}'

def _dedup_slug(base: str) -> str:
    """已存在则加 -2/-3… 后缀直到不冲突。"""
    if not (LIBRARY_DIR / base).exists():
        return base
    i = 2
    while (LIBRARY_DIR / f'{base}-{i}').exists():
        i += 1
    return f'{base}-{i}'

def _game_dir(slug: str) -> Path:
    """resolve library/<slug> 并断言仍在 library/ 子树内；非法 slug / 越界 → ValueError。"""
    if not _valid_slug(slug):
        raise ValueError(f'非法 slug: {slug!r}')
    lib = LIBRARY_DIR.resolve()
    d = (LIBRARY_DIR / slug).resolve()
    if d != lib and lib not in d.parents:
        raise ValueError(f'路径越界（必须在 library/ 下）: {slug!r}')
    return d

def _lib_parts(path: str):
    """'/api/library[/<slug>[/<action>]]' → (slug|None, action|None)。"""
    segs = [s for s in path.split('/') if s]  # ['api','library',...]
    rest = segs[2:]
    if not rest:
        return (None, None)
    if len(rest) == 1:
        return (rest[0], None)
    return (rest[0], rest[1])

# ── design 目录（设计先行流：pitch/systems/content/capability-plan，与游戏同库同 git 版本化）──
# 路径防护：design/ 子树只许 .md；每个路径段字符白名单 [A-Za-z0-9._-]（堵掉 ../ 与斜杠花招）；
# 形状白名单：顶层 <name>.md 或 systems/<name>.md（深度 ≤2，第二层只能在 systems/ 下）。
_DESIGN_SEG_RE = re.compile(r'^[A-Za-z0-9._-]+$')

def _valid_design_relpath(rel) -> bool:
    if not isinstance(rel, str) or not rel or rel != rel.strip():
        return False
    norm = rel.replace('\\', '/')
    if norm.startswith('/') or norm.endswith('/'):
        return False
    segs = norm.split('/')
    if any(s in ('', '.', '..') or not _DESIGN_SEG_RE.match(s) for s in segs):
        return False
    if not norm.endswith('.md'):
        return False
    if len(segs) == 1:
        return True
    if len(segs) == 2:
        return segs[0] == 'systems'
    return False

def _design_parts(path: str):
    """'/api/library/<slug>/design/<rel...>' → (slug, rel) 或 (None, None)。"""
    segs = [s for s in path.split('/') if s]  # ['api','library',slug,'design',...rel]
    if len(segs) >= 5 and segs[0] == 'api' and segs[1] == 'library' and segs[3] == 'design':
        return segs[2], '/'.join(segs[4:])
    return None, None

def _detect_indent(path: Path, default: int = 2) -> int:
    """探测既有 JSON 文件缩进（首个缩进键行的前导空格数·制表符按 2 计）——回写同格式，避免
    整文件重格式化 churn（owner 2026-07-22「换一张替换图 index/台账全文都 diff」；各工具写这些文件
    缩进不一：game-c-art-gen 用 1 空格·pipeline 用 2）。缺省 2（新文件）。"""
    try:
        for line in path.read_text(encoding='utf-8').splitlines():
            stripped = line.lstrip(' \t')
            if stripped.startswith('"') and len(line) > len(stripped):
                return len(line[:len(line) - len(stripped)].replace('\t', '  '))
    except Exception:
        pass
    return default

def _write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=_detect_indent(path)) + '\n', encoding='utf-8')

def _now_iso() -> str:
    return time.strftime('%Y-%m-%dT%H:%M:%S')

def _run_manifest_check(manifest: dict) -> tuple:
    """跑引擎真校验（scripts/manifest-check.mjs 子进程）。返回 (ok, message)。"""
    proc = subprocess.run(
        **_spawn(['npx', 'vite-node', 'scripts/manifest-check.mjs']),
        cwd=ROOT, input=json.dumps(manifest, ensure_ascii=False),
        capture_output=True, encoding='utf-8', errors='replace', timeout=120,
    )
    if proc.returncode == 0:
        return True, (proc.stderr or '').strip()
    return False, (proc.stderr or proc.stdout or '校验失败（无输出）').strip()
