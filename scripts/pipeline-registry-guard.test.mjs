// ═══════════════════════════════════════════════════════════════
//  注册即有板守卫（REQ-GATE-硬化 E·owner 2026-07-16「没进生产线就上不了架」）
//
//  规则：src/launcher.tsx 的 GAMES 注册表里，每款**非冻结**游戏都必须有
//  public/games/<slug>/pipeline.json 且 S1 立项卡字段（name+pitch）非空——否则 FAIL。
//  存量缺板游戏进 LEGACY_NO_BOARD 白名单（逐步清偿·**不许新增**），使今日即绿、新注册必卡。
//
//  为什么解析 launcher 而非 import：launcher.tsx 顶层 `document.getElementById('app')`
//  在 node 环境即抛（无 jsdom）——照 main_entry/games_list.py 同款正则解析（单一真相在 launcher·只读）。
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// 冻结名单（免检）：game-f 冻结（CLAUDE.md「f=冻结」·owner 2026-06-25·冻结勿删勿迁）。
// launcher 无机器可读冻结旗 → 此处按项目宪法硬列；将来 launcher 若加 frozen 标记，改为解析它。
const FROZEN = new Set(['game-f']);

// 存量欠账白名单（2026-07-17 盘点·逐步清偿·**不许新增**）：
// 这些游戏在生产线（八阶段板）建立之前即注册，尚无 pipeline.json 生产板。补板后从本表删除即恢复受检。
// 新注册的游戏一律不得进此表——没进生产线就上不了架（守卫的意义即此）。
const LEGACY_NO_BOARD = new Set(['game-e', 'game-g', 'game-i', 'game-x', 'game-z', 'game-d', 'game-q']);

/** 从 launcher.tsx 源码解析 GAMES 注册表（照 games_list.py 同款正则·只读·无副作用）。 */
export function parseRegisteredGames(src) {
  const m = src.match(/const\s+GAMES\s*:\s*GameEntry\[\]\s*=\s*\[([\s\S]*?)\n\]/);
  const body = m ? m[1] : '';
  const ids = [...body.matchAll(/id\s*:\s*'([a-z0-9-]+)'/g)];
  const games = [];
  for (let i = 0; i < ids.length; i++) {
    const start = ids[i].index;
    const end = i + 1 < ids.length ? ids[i + 1].index : body.length;
    const obj = body.slice(start, end);
    const sm = obj.match(/status\s*:\s*'([a-z-]+)'/);
    games.push({ id: ids[i][1], status: sm ? sm[1] : '' });
  }
  return games;
}

/** 单板判定：pipeline.json 存在且 S1 立项卡 name+pitch 非空 → true；否则返回中文欠因（字符串）。 */
export function boardStatus(root, slug) {
  const pf = join(root, 'public', 'games', slug, 'pipeline.json');
  if (!existsSync(pf)) return '缺 pipeline.json（未进生产线）';
  let json;
  try { json = JSON.parse(readFileSync(pf, 'utf8')); } catch { return 'pipeline.json 解析失败'; }
  const c = json.concept || {};
  if (!c.name || !String(c.name).trim()) return 'S1 立项卡 name 为空';
  if (!c.pitch || !String(c.pitch).trim()) return 'S1 立项卡 pitch 为空';
  return true;
}

/** 核心审计（纯函数·供真仓库守卫与合成点名测试共用）：返回违规清单 [{id, reason}]。 */
export function auditRegistry(games, whitelist, statusFn) {
  const violations = [];
  for (const g of games) {
    if (FROZEN.has(g.id)) continue;
    if (whitelist.has(g.id)) continue;
    const r = statusFn(g.id);
    if (r !== true) violations.push({ id: g.id, reason: r });
  }
  return violations;
}

const withTmp = (fn) => { const r = mkdtempSync(join(tmpdir(), 'reg-guard-')); try { return fn(r); } finally { rmSync(r, { recursive: true, force: true }); } };
const writeBoard = (root, slug, pf) => {
  const d = join(root, 'public', 'games', slug);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'pipeline.json'), JSON.stringify(pf, null, 2));
};

describe('boardStatus — 单板判定（临时目录真验）', () => {
  it('缺 pipeline.json=红·concept 空=红·仅 name=红·name+pitch 齐=绿', () => withTmp((root) => {
    expect(boardStatus(root, 'g')).not.toBe(true);              // 无文件
    writeBoard(root, 'g', { concept: {} });
    expect(boardStatus(root, 'g')).not.toBe(true);              // 空立项卡
    writeBoard(root, 'g', { concept: { name: '某游戏' } });
    expect(boardStatus(root, 'g')).not.toBe(true);              // 缺 pitch
    writeBoard(root, 'g', { concept: { name: '某游戏', pitch: '一句话玩法' } });
    expect(boardStatus(root, 'g')).toBe(true);                  // 齐全
  }));
  it('pitch 全空白字符视为空', () => withTmp((root) => {
    writeBoard(root, 'g', { concept: { name: 'X', pitch: '   ' } });
    expect(boardStatus(root, 'g')).not.toBe(true);
  }));
});

describe('auditRegistry — 合成点名（红/白/冻结三态）', () => {
  const stub = (verdict) => () => verdict;
  it('白名单外新 slug 缺板 → 必红', () => {
    const v = auditRegistry([{ id: 'game-new', status: 'playable' }], new Set(), stub('缺板'));
    expect(v).toHaveLength(1);
    expect(v[0].id).toBe('game-new');
  });
  it('白名单内缺板 → 绿（存量豁免）', () => {
    const v = auditRegistry([{ id: 'game-e', status: 'playable' }], new Set(['game-e']), stub('缺板'));
    expect(v).toEqual([]);
  });
  it('冻结游戏缺板 → 免检绿', () => {
    const v = auditRegistry([{ id: 'game-f', status: 'playable' }], new Set(), stub('缺板'));
    expect(v).toEqual([]);
  });
  it('有板但 S1 空 → 红', () => {
    const v = auditRegistry([{ id: 'x', status: 'playable' }], new Set(), stub('S1 立项卡 pitch 为空'));
    expect(v).toHaveLength(1);
  });
  it('有板且 S1 齐 → 绿', () => {
    const v = auditRegistry([{ id: 'x', status: 'playable' }], new Set(), stub(true));
    expect(v).toEqual([]);
  });
});

describe('parseRegisteredGames — 解析 launcher GAMES', () => {
  it('从真 launcher.tsx 解出的 id 全非空·含已知游戏', () => {
    const games = parseRegisteredGames(readFileSync(join(ROOT, 'src', 'launcher.tsx'), 'utf8'));
    expect(games.length).toBeGreaterThan(0);
    expect(games.every((g) => /^[a-z0-9-]+$/.test(g.id))).toBe(true);
    const ids = new Set(games.map((g) => g.id));
    expect(ids.has('game-t')).toBe(true); // game-t 有板·应被解析到
  });
  it('容错样例：手写小片段解析出 id+status', () => {
    const src = "export const GAMES: GameEntry[] = [\n  { id: 'a', status: 'playable' },\n  { id: 'b', status: 'coming-soon' },\n];\n";
    expect(parseRegisteredGames(src)).toEqual([{ id: 'a', status: 'playable' }, { id: 'b', status: 'coming-soon' }]);
  });
});

describe('注册即有板守卫（真仓库·REQ-GATE-硬化 E）', () => {
  const games = parseRegisteredGames(readFileSync(join(ROOT, 'src', 'launcher.tsx'), 'utf8'));

  it('每款非冻结·非白名单注册游戏都有 pipeline.json 且 S1 立项卡非空', () => {
    const violations = auditRegistry(games, LEGACY_NO_BOARD, (slug) => boardStatus(ROOT, slug));
    // 违规清单为空=绿。若红，报告名犯游戏 + 欠因（便于施工者补板或核对白名单）。
    expect(violations, `缺板/缺立项卡（补 board 或核白名单）：${JSON.stringify(violations)}`).toEqual([]);
  });

  it('白名单/冻结名单卫生：条目都是真注册游戏·两名单不重叠', () => {
    const ids = new Set(games.map((g) => g.id));
    for (const w of LEGACY_NO_BOARD) {
      expect(ids.has(w), `白名单幽灵条目（已非注册游戏·应删）：${w}`).toBe(true);
      expect(FROZEN.has(w), `白名单与冻结名单不得重叠：${w}`).toBe(false);
    }
    for (const f of FROZEN) expect(ids.has(f), `冻结名单幽灵条目：${f}`).toBe(true);
  });

  it('白名单确属「缺板」欠账：名单内游戏此刻确实无有效板（清偿后应移出白名单）', () => {
    // 反向自证——防白名单挂着「其实已补板」的过期条目（棘轮该收紧却没收）。
    for (const w of LEGACY_NO_BOARD) {
      expect(boardStatus(ROOT, w), `${w} 已有有效板→应移出 LEGACY_NO_BOARD 白名单`).not.toBe(true);
    }
  });
});
