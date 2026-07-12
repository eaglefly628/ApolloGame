"""AI 生成人审门（待审区列表 + 审核）。"""
import subprocess
import json
import re

from .paths import GAME_RE
from .sysutil import ROOT, _spawn, c

# ── AI 生成人审门（M2.5·REQ-ART）：待审区列表 + 审核（approve/reject）────────────────────
# 「大脑」在 scripts/ai-gen.mjs（writePending/reviewPending·登记契约单一真相·PA 会审）；
# 列表=纯数据聚合（读 pending.json）；审核=薄胶水 shell 调脚本（唯一改 index 的门=approve）。

def handle_asset_pending() -> dict:
    """GET /api/assets/pending。聚合共享货架 + 各游戏本地的待审区清单（读各 pending.json·不碰 index）。"""
    out = []
    shared = ROOT / 'assets' / 'ai' / 'pending.json'
    if shared.is_file():
        try:
            out += list(json.loads(shared.read_text('utf-8')).get('pending', []))
        except Exception:
            pass  # 清单损坏不炸端点
    gdir = ROOT / 'public' / 'games'
    if gdir.is_dir():
        for d in sorted(gdir.iterdir()):
            if d.is_dir() and GAME_RE.fullmatch(d.name):
                pj = d / 'art' / 'ai' / 'pending.json'
                if pj.is_file():
                    try:
                        out += list(json.loads(pj.read_text('utf-8')).get('pending', []))
                    except Exception:
                        pass
    return {'pending': out, 'count': len(out)}


def handle_asset_review(body: dict) -> dict:
    """POST /api/assets/review。body = { id:str, action:'approve'|'reject', game?:str }。
    approve=provenance 硬校验过 → 移出待审 + 登记 index；reject=删待审文件 + 清项。经 ai-gen.mjs review 施行。"""
    asset_id = str(body.get('id', '')).strip()
    action = str(body.get('action', '')).strip()
    game = body.get('game')
    if not asset_id or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9/_.\-]*', asset_id) or '..' in asset_id:
        return {'success': False, 'error': f'非法 id: {asset_id or "(空)"}'}
    if action not in ('approve', 'reject'):
        return {'success': False, 'error': f'非法 action: {action or "(空)"}（approve|reject）'}
    cmd = ['node', 'scripts/ai-gen.mjs', 'review', asset_id, action, '--json']
    if game:
        g = str(game)
        if not GAME_RE.fullmatch(g):  # 白名单：防注入/路径穿越
            return {'success': False, 'error': f'非法 game: {g}'}
        cmd += ['--game', g]
    try:
        proc = subprocess.run(**_spawn(cmd), cwd=ROOT, capture_output=True, timeout=60)
    except subprocess.TimeoutExpired:
        return {'success': False, 'error': '审核超时'}
    out = proc.stdout.decode('utf-8', 'replace').strip()
    line = out.splitlines()[-1] if out else ''  # 末行 JSON（reviewPending 失败也打 JSON·退出码 1）
    try:
        res = json.loads(line)
    except Exception:
        err = proc.stderr.decode('utf-8', 'replace').strip() or out
        return {'success': False, 'error': f'审核失败: {err[:400]}'}
    if not res.get('ok'):
        return {'success': False, **res}  # 如 provenance 缺字段拒登记
    print(c("  [AI-GEN]", 'g'), f"review {action} → {asset_id}")
    return {'success': True, **res}
