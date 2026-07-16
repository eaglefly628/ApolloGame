"""资产导入 + AI 文本生成资产 + Vendor。"""
import subprocess
import os
import json
import base64
import re

from .config import _gen_env
from .paths import GAME_RE
from .sysutil import ROOT, _spawn, c

# ── 资产导入（资源库导入器的写盘端，仅本机 dev 用）──

def handle_asset_import(body: dict) -> dict:
    """文件落 assets/ 子树 + assets/index.json 增量条目。

    body = { files: [{path, dataBase64}], entries: [AssetIndexEntry...] }
    安全：路径必须归一化后仍在 assets/ 下（防穿越）；索引重复 id 整批拒绝（原子性：先校验后写）。
    """
    files = body.get('files', [])
    entries = body.get('entries', [])
    if not isinstance(files, list) or not isinstance(entries, list) or not entries:
        return {'success': False, 'error': 'files/entries 形状非法或为空'}

    # ① 路径安全校验（全部先验，后写）
    for f in files:
        rel = str(f.get('path', ''))
        norm = os.path.normpath(rel).replace('\\', '/')
        if not norm.startswith('assets/') or '..' in norm.split('/'):
            return {'success': False, 'error': f'非法路径（必须在 assets/ 下）: {rel}'}

    # ② 索引校验：重复 id 整批拒绝
    idx_path = ROOT / 'assets' / 'index.json'
    try:
        index = json.loads(idx_path.read_text(encoding='utf-8'))
    except FileNotFoundError:
        index = {'version': 1, 'assets': []}
    existing = {a.get('id') for a in index.get('assets', [])}
    dup = [e.get('id') for e in entries if e.get('id') in existing]
    if dup:
        return {'success': False, 'error': f'索引已有同名 id: {", ".join(map(str, dup))}'}
    for e in entries:
        if not e.get('id') or not e.get('type') or e.get('status') not in ('tbf', 'filled'):
            return {'success': False, 'error': f'条目非法: {json.dumps(e, ensure_ascii=False)[:120]}'}

    # ③ 写文件
    written = 0
    for f in files:
        rel = os.path.normpath(str(f.get('path', ''))).replace('\\', '/')
        target = ROOT / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(base64.b64decode(f.get('dataBase64', '')))
        written += 1

    # ④ 写索引
    index['assets'] = list(index.get('assets', [])) + entries
    idx_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(c("  [ASSETS]", 'g'), f"导入 {written} 文件，索引 +{len(entries)} 条")

    # ⑤ 入库主动扫描（本地像素层，零 API 花费、确定性）：颜色/明暗/体量等事实标签合并进新条目。
    #    失败不影响导入（语义层另有可选的 /api/assets/autotag）。
    try:
        subprocess.run(
            **_spawn(['npx', 'vite-node', 'scripts/scan-pixels.ts', '--assets']),
            cwd=ROOT, capture_output=True, timeout=120,
        )
        print(c("  [ASSETS]", 'g'), "像素扫描标签已合并（本地、免费）")
    except Exception:
        pass
    return {'success': True, 'written': written, 'indexAdded': len(entries)}

# ── AI 文本生成资产（tripo·meshy 文本→3D · qwen 文本→2D）──────────────────────────
# 生成"大脑"在 PA 车道的 scripts/ai-gen.mjs（它落文件 + upsert index.json）；本端点只是薄胶水：
# 校验入参 → shell 调脚本（--mock --json）→ 回机读结果给库刷新。真调 API 走脚本内的 env key + 放宽网络。
# 适配器闭集与脚本 ADAPTERS 对齐（新增 provider 两处同改：脚本注册 + 此白名单）。

GEN_ADAPTERS = ('tripo', 'meshy', 'qwen')

def handle_asset_generate(body: dict) -> dict:
    """POST /api/assets/generate。body = { adapter:'tripo'|'meshy'|'qwen', prompt:str, game?:str }。
    mock 仅在显式 body.mock=true 时传（R1 ②a·去无条件 --mock）；无 key 时脚本自行探针+mock 兜底，绝不静默顶替。
    人审门（M2.5·宪法）：产物**落待审区**（pending.json，不进 index.json）·返回预览 URL；人经
    /api/assets/review approve 才登记入库。生成**绝不**自动入库。"""
    adapter = str(body.get('adapter', '')).strip()
    prompt = str(body.get('prompt', '')).strip()
    game = body.get('game')
    if adapter not in GEN_ADAPTERS:
        return {'success': False, 'error': f'未知适配器: {adapter or "(空)"}（支持 {"/".join(GEN_ADAPTERS)}）'}
    if not prompt:
        return {'success': False, 'error': 'prompt 不能为空'}
    if len(prompt) > 500:
        return {'success': False, 'error': 'prompt 过长（≤500 字）'}
    cmd = ['node', 'scripts/ai-gen.mjs', adapter, prompt, '--json'] + (['--mock'] if body.get('mock') else [])
    if game:
        g = str(game)
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', g):  # 白名单：防注入/路径穿越
            return {'success': False, 'error': f'非法 game 名: {g}'}
        cmd += ['--game', g]
    try:
        proc = subprocess.run(**_spawn(cmd), cwd=ROOT, capture_output=True, timeout=180, env=_gen_env())
    except subprocess.TimeoutExpired:
        return {'success': False, 'error': '生成超时（>180s）'}
    out = proc.stdout.decode('utf-8', 'replace').strip()
    if proc.returncode != 0:
        err = proc.stderr.decode('utf-8', 'replace').strip() or out
        return {'success': False, 'error': f'生成失败: {err[:400]}'}
    line = out.splitlines()[-1] if out else ''  # 末行 JSON（前面可能有 warn）
    try:
        res = json.loads(line)
    except Exception:
        return {'success': False, 'error': f'解析结果失败: {out[:200]}'}
    print(c("  [AI-GEN]", 'g'), f"{adapter} → {res.get('id')} → 待审区 ({res.get('scope')}{' ·mock' if res.get('mock') else ''})")
    return {'success': True, **res}


def handle_asset_generate_providers() -> dict:
    """GET /api/assets/generate/providers。列出各生成 provider 的 envKey / 是否已配 key（脚本打码·绝不回明文）。"""
    try:
        proc = subprocess.run(**_spawn(['node', 'scripts/ai-gen.mjs', 'providers']), cwd=ROOT, capture_output=True, timeout=30, env=_gen_env())
        return {'providers': json.loads(proc.stdout.decode('utf-8', 'replace'))}
    except Exception as e:  # 脚本缺失/解析失败不炸端点
        return {'providers': [], 'error': str(e)}

# ── 抠图/去背 → 真 alpha（REQ-ASSET-导入抠图·PA 能力）─────────────────────────────
# 大脑在 PA 车道的 scripts/asset-matte.mjs（flood-fill 主路 + rembg 兜底·产真 alpha PNG）；本端点薄胶水：
# base64 图 in → shell 调脚本 → base64 图 out + provenance。导入向导调它出 before/after 预览，再走 M2.5
# pending 人审（不静默顶替）。红线：authoring-time·纯像素变换·不碰 sim/hash。


def handle_asset_matte(body: dict) -> dict:
    """POST /api/assets/matte。body = { dataBase64, mode?:'flood'|'rembg', tolerance?:int, despill?:bool, seeds?:[[x,y]], mock?:bool }。"""
    import tempfile
    mode = str(body.get('mode', 'flood'))
    if mode not in ('flood', 'rembg'):
        return {'success': False, 'error': f'非法 mode: {mode}（flood/rembg）'}
    try:
        raw = base64.b64decode(str(body.get('dataBase64', '')))
    except Exception:
        return {'success': False, 'error': 'dataBase64 解码失败'}
    if not raw:
        return {'success': False, 'error': '空图'}
    fd_in, in_path = tempfile.mkstemp(suffix='.png'); os.close(fd_in)
    fd_out, out_path = tempfile.mkstemp(suffix='.png'); os.close(fd_out)
    try:
        with open(in_path, 'wb') as f:
            f.write(raw)
        cmd = ['node', 'scripts/asset-matte.mjs', in_path, out_path, '--mode', mode, '--json']
        tol = body.get('tolerance')
        if isinstance(tol, (int, float)) and not isinstance(tol, bool):
            cmd += ['--tol', str(int(tol))]
        if body.get('despill'):
            cmd.append('--despill')
        if body.get('mock'):
            cmd.append('--mock')
        for s in (body.get('seeds') or []):
            if isinstance(s, (list, tuple)) and len(s) == 2 and all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in s):
                cmd += ['--seed', f'{int(s[0])},{int(s[1])}']
        try:
            proc = subprocess.run(**_spawn(cmd), cwd=ROOT, capture_output=True, timeout=120)
        except subprocess.TimeoutExpired:
            return {'success': False, 'error': '抠图超时（>120s）'}
        if proc.returncode != 0:
            err = proc.stderr.decode('utf-8', 'replace').strip() or proc.stdout.decode('utf-8', 'replace')
            return {'success': False, 'error': f'抠图失败: {err[:400]}'}
        with open(out_path, 'rb') as f:
            out_png = f.read()
        try:
            prov = json.loads(proc.stdout.decode('utf-8', 'replace').splitlines()[-1])
            prov.pop('out', None)  # 临时 out 路径无意义·不回传
        except Exception:
            prov = {}
        print(c("  [MATTE]", 'g'), f"{mode} → {len(out_png)} 字节")
        return {'success': True, 'dataBase64': base64.b64encode(out_png).decode(), 'provenance': prov}
    finally:
        for p in (in_path, out_path):
            try:
                os.unlink(p)
            except Exception:
                pass

# ── Vendor：把共享库资产 copy 进某游戏的本地美术目录（右键"copy 到游戏"入口的后端）─────────
# 能力"大脑"在 PA 车道的 scripts/vendor-asset.mjs（copy 文件 + upsert 本地索引·自动按类型归子目录·
# 携 spec/license/provenance.vendoredFrom·幂等）；本端点只是薄胶水：校验 → shell 调 → 回机读结果。


def handle_asset_vendor(body: dict) -> dict:
    """POST /api/assets/vendor。body = { id:str（共享库资产 id）, game:str, as?:str（本地 id 覆盖）}。"""
    asset_id = str(body.get('id', '')).strip()
    game = str(body.get('game', '')).strip()
    as_id = body.get('as')
    if not asset_id:
        return {'success': False, 'error': 'id 不能为空'}
    if not GAME_RE.fullmatch(game):  # 白名单：防注入/路径穿越
        return {'success': False, 'error': f'非法 game: {game or "(空)"}'}
    cmd = ['node', 'scripts/vendor-asset.mjs', asset_id, game, '--json']
    if as_id:
        a = str(as_id).strip()
        # 本地 id（贴图 key 风格）：首字符 alnum、字符集 [A-Za-z0-9/_.-]、禁 ".." 段
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9/_.\-]*', a) or '..' in a:
            return {'success': False, 'error': f'非法 as id: {a}'}
        cmd += ['--as', a]
    try:
        proc = subprocess.run(**_spawn(cmd), cwd=ROOT, capture_output=True, timeout=60)
    except subprocess.TimeoutExpired:
        return {'success': False, 'error': 'vendor 超时'}
    out = proc.stdout.decode('utf-8', 'replace').strip()
    if proc.returncode != 0:
        err = proc.stderr.decode('utf-8', 'replace').strip() or out
        return {'success': False, 'error': f'vendor 失败: {err[:400]}'}
    line = out.splitlines()[-1] if out else ''
    try:
        res = json.loads(line)
    except Exception:
        return {'success': False, 'error': f'解析结果失败: {out[:200]}'}
    print(c("  [VENDOR]", 'g'), f"{asset_id} → {game}")
    return {'success': True, **res}
