// Game B ·《雀宴》—— 验收剧本薄适配契约（REQ-ACCEPT ③·PE 落·纯接线零规则）。
// 对接 Lead 通用 runner（scripts/acceptance-run.mjs）契约：
//   createWorld(seed,config) → world（须 .tick() / .getAllEntities() / .getComponent(id,type)）
//   applySignal(world, signal, args, by) → void（把剧本信号翻成 sim 操作）
//   readWorld(world) → worldLike（标准=返回 world 自身）
// 规则真相全在 core/*（sim）；本文件只把 MatchState 投影成引擎协议标量（Resource/Flag/StringVar）+
// 转发信号——**零规则判断**（读者/信号都只搬运，不算番不判和·那是 sim 的事）。
import {
  startMatch, discard, declareTsumo, declareRiichi, aiTurn, nextRound, runUntilPlayerOrEnd,
  isWinLikeEnd, type MatchState,
} from './core/game-state.js';
import { tenpai } from './core/hand-eval.js';

// ── 机读态读者：MatchState → 引擎协议标量（每个事实一个"实体"·id=事实名）─────────────────
const RES: Record<string, (m: MatchState) => number> = {
  score_sum: (m) => m.scores.reduce((a, b) => a + b, 0),
  score_0: (m) => m.scores[0]!, score_1: (m) => m.scores[1]!, score_2: (m) => m.scores[2]!, score_3: (m) => m.scores[3]!,
  kyotaku: (m) => m.kyotaku, honba: (m) => m.honba, round_no: (m) => m.roundNo, dealer: (m) => m.dealer, turn: (m) => m.cur.turn,
  wall: (m) => m.cur.wall.length,
  hero_clothing: (m) => m.clothing[0]!, clothing_1: (m) => m.clothing[1]!, clothing_2: (m) => m.clothing[2]!, clothing_3: (m) => m.clothing[3]!,
  clothing_sum: (m) => m.clothing.reduce((a, b) => a + b, 0),
  delta_sum: (m) => (m.cur.result ? m.cur.result.delta.reduce((a, b) => a + b, 0) : 0),
  win_tile: (m) => (m.cur.result && m.cur.result.winTile !== null ? m.cur.result.winTile : -1),
  tenpai_count: (m) => m.cur.hands.filter((h) => tenpai(h).length > 0).length,
};
const FLAG: Record<string, (m: MatchState) => boolean> = {
  over: (m) => m.over,
  win_end: (m) => isWinLikeEnd(m),
  riichi_0: (m) => m.cur.riichi[0]!, riichi_1: (m) => m.cur.riichi[1]!, riichi_2: (m) => m.cur.riichi[2]!, riichi_3: (m) => m.cur.riichi[3]!,
};
const SV: Record<string, (m: MatchState) => string> = {
  phase: (m) => m.cur.phase,
  result_type: (m) => (m.cur.result ? m.cur.result.type : 'none'),
  winner_name: (m) => (m.cur.result && m.cur.result.winner !== null ? m.seatNames[m.cur.result.winner]! : 'none'),
  loser_name: (m) => (m.cur.result && m.cur.result.loser !== null ? m.seatNames[m.cur.result.loser]! : 'none'),
};

interface Comp { type: string; id: string; current?: number; active?: boolean; value?: string }
export interface BWorld {
  m: MatchState;
  tick(): void;
  getAllEntities(): string[];
  getComponent(id: string, type: string): Comp | undefined;
}

export interface AcceptConfig { seatNames?: string[] }

/** 开一场（seed 派生·config.seatNames 可覆盖席名）→ 引擎协议 world-like。 */
export function createWorld(seed: number, config?: AcceptConfig): BWorld {
  const m = startMatch(seed, config?.seatNames);
  return {
    m,
    tick() { if (m.cur.phase === 'playing') aiTurn(m); }, // {tick:N} = 推 N 步 AI
    getAllEntities() { return [...Object.keys(RES), ...Object.keys(FLAG), ...Object.keys(SV)]; },
    getComponent(id, type) {
      if (type === 'Resource' && RES[id]) return { type: 'Resource', id, current: RES[id]!(m) };
      if (type === 'Flag' && FLAG[id]) return { type: 'Flag', id, active: FLAG[id]!(m) };
      if (type === 'StringVar' && SV[id]) return { type: 'StringVar', id, value: SV[id]!(m) };
      return undefined;
    },
  };
}

/** 喂一个操作信号（纯转发到 sim·零规则）。 */
export function applySignal(world: BWorld, signal: string, args: unknown[] = [], _by?: number): void {
  const m = world.m;
  switch (signal) {
    case 'discard': discard(m, Number(args[0])); break;      // 打一张（args=[牌码]）
    case 'tsumo': declareTsumo(m); break;                    // 宣自摸
    case 'riichi': declareRiichi(m); break;                  // 宣立直
    case 'ai': if (m.cur.phase === 'playing') aiTurn(m); break; // 当前家一步
    case 'auto': runUntilPlayerOrEnd(m); break;              // AI 推进到玩家/局终
    case 'play-round': { let g = 0; while (m.cur.phase === 'playing' && g++ < 400) aiTurn(m); break; } // 全 AI 打完一局
    case 'next-round': nextRound(m); break;                  // 进下一局/终局判定
    case 'play-match': { let g = 0; while (!m.over && g++ < 80) { let s = 0; while (m.cur.phase === 'playing' && s++ < 400) aiTurn(m); nextRound(m); } break; } // 打穿整场
    default: break;                                          // 未知信号=剧本笔误·静默（adapter 不判规则）
  }
}

/** 读视图（标准=返回 world 自身·机读态提取集中在 runner 的 snapshotScalars）。 */
export function readWorld(world: BWorld): BWorld { return world; }
