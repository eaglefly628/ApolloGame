"""生产流程板（八阶段机器门/人门）。"""
import subprocess
import json
import re

from .paths import _valid_slug
from .sysutil import ROOT, _spawn, c

# ── 生产流程板（owner 2026-07-10「N 步拆分·每步 review·不能只靠手册」）────────────
# 大脑在 scripts/game-pipeline.mjs（八阶段·机器门证据带内容指纹·人门 signoff 落账）；
# 本端点薄胶水 shell 调。gate 会真跑 vitest/tsc/build（S8 最重）→ 单独长超时。

_PIPE_STAGE_RE = re.compile(r'S[1-8]')

def _pipeline_cli(args: list, timeout: int = 120) -> dict:
    """shell scripts/game-pipeline.mjs → 解析末行 JSON。"""
    try:
        proc = subprocess.run(**_spawn(['node', 'scripts/game-pipeline.mjs', *args]), cwd=ROOT, capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return {'ok': False, 'error': '生产流程板执行超时'}
    out = proc.stdout.decode('utf-8', 'replace').strip()
    line = out.splitlines()[-1] if out else ''
    try:
        return json.loads(line)
    except Exception:
        err = proc.stderr.decode('utf-8', 'replace').strip() or out
        return {'ok': False, 'error': f'解析失败: {err[:400]}'}

def handle_pipeline_board(slug: str) -> dict:
    """GET /api/pipeline?slug=<slug>。八阶段看板（纯推导·不跑重活）。"""
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    res = _pipeline_cli(['board', slug, '--json'])
    return {'success': bool(res.get('ok')), **res}

def handle_pipeline_gate(body: dict) -> dict:
    """POST /api/pipeline/gate {slug, stage}。真跑该阶段机器门→记证据（S8=tsc+vitest+build·最长 15 分钟）。"""
    slug = str(body.get('slug', '')).strip(); stage = str(body.get('stage', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if not _PIPE_STAGE_RE.fullmatch(stage):
        return {'success': False, 'error': f'非法阶段: {stage or "(空)"}'}
    res = _pipeline_cli(['gate', slug, stage], timeout=900)
    if res.get('ok'):
        print(c("  [PIPE]", 'g'), f"gate {slug} {stage} → {res.get('summary', '')[:80]}")
    return {'success': bool(res.get('ok')), **res}

def handle_pipeline_concept(body: dict) -> dict:
    """POST /api/pipeline/concept {slug, name?, pitch?, refs?, style?, planWaiver?}。写/改立项卡
    （≥1 个字段·REQ-WORKSHOP C1：S1 从此有 UI 通道·CLI 同语义）。"""
    slug = str(body.get('slug', '')).strip()
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    fields = [('name', '--name', 80), ('pitch', '--pitch', 300), ('refs', '--refs', 300),
              ('style', '--style', 300), ('planWaiver', '--plan-waiver', 300)]
    args = ['concept', slug]
    for key, flag, cap in fields:
        if key not in body:
            continue
        val = str(body.get(key) or '').strip()
        if len(val) > cap:
            return {'success': False, 'error': f'{key} 过长（≤{cap} 字）'}
        args += [flag, val]
    if len(args) == 2:
        return {'success': False, 'error': '至少提供一个立项卡字段（name/pitch/refs/style/planWaiver）'}
    res = _pipeline_cli(args)
    return {'success': bool(res.get('ok')), **res}

def handle_pipeline_signoff(body: dict) -> dict:
    """POST /api/pipeline/signoff {slug, stage, note, by?}。人门落账（note 必填=review 内容）。"""
    slug = str(body.get('slug', '')).strip(); stage = str(body.get('stage', '')).strip()
    note = str(body.get('note', '')).strip(); by = str(body.get('by', '')).strip() or 'owner'
    if not _valid_slug(slug):
        return {'success': False, 'error': f'非法 slug: {slug or "(空)"}'}
    if not _PIPE_STAGE_RE.fullmatch(stage):
        return {'success': False, 'error': f'非法阶段: {stage or "(空)"}'}
    if not note:
        return {'success': False, 'error': '人门必须带 note（review 内容落账·不许空签）'}
    if len(note) > 500 or len(by) > 40:
        return {'success': False, 'error': 'note ≤500 字 · by ≤40 字'}
    res = _pipeline_cli(['signoff', slug, stage, '--note', note, '--by', by])
    return {'success': bool(res.get('ok')), **res}
