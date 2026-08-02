// Game B ·《雀宴》—— 验收剧本薄适配契约（REQ-ACCEPT ③·PE 落·纯接线零规则）。
// 对接 Lead 通用 runner（scripts/acceptance-run.mjs）契约：
//   createWorld(seed,config) → world（须 .tick() / .getAllEntities() / .getComponent(id,type)）
//   applySignal(world, signal, args, by) → void（把剧本信号翻成 sim 操作）
//   readWorld(world) → worldLike（标准=返回 world 自身）
// 规则真相全在 core/*（sim）；本文件只把 MatchState 投影成引擎协议标量（Resource/Flag/StringVar）+
// 转发信号——**零规则判断**（读者/信号都只搬运，不算番不判和·那是 sim 的事）。
import {
  startMatch, discard, declareTsumo, declareRiichi, aiTurn, nextRound, runUntilPlayerOrEnd,
  isWinLikeEnd, playerCall, playerPass, declareAnkan, declareKakan, type MatchState,
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
  // ── 鸣牌/杠/真算分 机读投影（naki-design 复审剧本用·纯投影零算番）─────────────────────
  melds_sum: (m) => meldTiles(m, -1), // 四家副露牌总枚数
  melds_0: (m) => meldTiles(m, 0), melds_1: (m) => meldTiles(m, 1), melds_2: (m) => meldTiles(m, 2), melds_3: (m) => meldTiles(m, 3),
  kan_count: (m) => m.cur.kanCount,
  dora_count: (m) => m.cur.doraInd.length,
  dead_len: (m) => m.cur.dead.length,
  tile_total: (m) => tileTotal(m), // 手+副露+河+活山+王牌+摸 全和（守恒恒 136）
  win_placeholder: (m) => (m.cur.result ? (String(m.cur.result.scoreLabel ?? '').includes('占位') ? 1 : 0) : -1),
  forbidden_count: (m) => m.cur.forbiddenDiscard.length,
  forbidden_sum: (m) => m.cur.forbiddenDiscard.reduce((a, b) => a + b, 0),
};
/** 副露牌枚数（seat<0=四家合计·否则单席）。 */
function meldTiles(m: MatchState, seat: number): number {
  const seats = seat < 0 ? [0, 1, 2, 3] : [seat];
  return seats.reduce((a, s) => a + m.cur.melds[s]!.reduce((b, md) => b + md.tiles.length, 0), 0);
}
/** 全局牌数（守恒恒 136·= 单测 totalTiles 同式）。 */
function tileTotal(m: MatchState): number {
  const rs = m.cur;
  let t = rs.wall.length + rs.dead.length + (rs.drawn !== null ? 1 : 0);
  for (let s = 0; s < 4; s++) t += rs.hands[s]!.length + rs.rivers[s]!.length + meldTiles(m, s);
  return t;
}
const FLAG: Record<string, (m: MatchState) => boolean> = {
  over: (m) => m.over,
  win_end: (m) => isWinLikeEnd(m),
  riichi_0: (m) => m.cur.riichi[0]!, riichi_1: (m) => m.cur.riichi[1]!, riichi_2: (m) => m.cur.riichi[2]!, riichi_3: (m) => m.cur.riichi[3]!,
  win_has_yaku: (m) => !!m.cur.result?.yakuLabel, // 闭手真算分必有役种明细（占位=无）
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
    // ── 鸣牌信号（纯转发·零规则·naki-design 复审剧本用）──────────────────────────────
    case 'interactive': m.interactiveCalls = true; break;    // 开鸣牌总闸
    case 'call-chi': {                                       // 玩家吃（args 可选 [consumeLo]·缺则首候选）
      const chi = m.cur.callWindow?.options.chi ?? [];
      if (chi.length > 0) {
        const cand = args.length > 0 ? (chi.find((c) => c.consume[0] === Number(args[0])) ?? chi[0]!) : chi[0]!;
        playerCall(m, { type: 'chi', chi: cand });
      }
      break;
    }
    case 'call-pon': playerCall(m, { type: 'pon' }); break;
    case 'call-minkan': playerCall(m, { type: 'minkan' }); break;
    case 'call-ron': playerCall(m, { type: 'ron' }); break;
    case 'pass': playerPass(m); break;                       // 玩家过（不鸣）
    case 'ankan': declareAnkan(m, Number(args[0])); break;   // 自家暗杠（args=[牌种]）
    case 'kakan': declareKakan(m, Number(args[0])); break;   // 自家加杠（args=[牌种]）
    // 未知信号=剧本笔误 → 抛错暴露（game-c 先例·防静默吞信号=少跑几步却照绿的假绿·harness 完整性）。
    default: throw new Error(`未知信号 ${JSON.stringify(signal)}（game-b 认 discard/tsumo/riichi/ai/auto/play-round/next-round/play-match/interactive/call-chi/call-pon/call-minkan/call-ron/pass/ankan/kakan·{tick:N} 走 world.tick()）`);
  }
}

/** 读视图（标准=返回 world 自身·机读态提取集中在 runner 的 snapshotScalars）。 */
export function readWorld(world: BWorld): BWorld { return world; }
