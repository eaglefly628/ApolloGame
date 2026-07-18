// Game A ·《掼蛋夜宴》—— 验收剧本薄适配契约（REQ-ACCEPT ③·PE 落·纯接线零规则）。
// 对接 Lead 通用 runner（scripts/acceptance-run.mjs）契约：
//   createWorld(seed,config) → world（须 .tick() / .getAllEntities() / .getComponent(id,type)）
//   applySignal(world, signal, args, by) → void（把剧本信号翻成 GuandanSession 操作）
//   readWorld(world) → worldLike（标准=返回 world 自身）
// 规则真相全在 GuandanSession（发牌/进贡/判型/压制/结算/升级/run 终局）；本文件只把 session 状态
// 投影成引擎协议标量（Resource/Flag/StringVar）+ 转发信号——**零规则判断**（不判型/不算番/不定名次·
// 那是 session 的事）。信号名用 GDD 术语（play/pass/进贡走 next-round 自动结算）。
import { GuandanSession, TURN_ORDER, type SeatId } from './guandan-session.js';

// ── 机读态读者：GuandanSession → 引擎协议标量（每个事实一个"实体"·id=事实名）─────────────────
// 纯读投影：只搬运 session 公有字段，不做任何规则计算。
const RES: Record<string, (s: GuandanSession, w: AWorld) => number> = {
  round: (s) => s.round,
  level_ours: (s) => s.levels[0],
  level_theirs: (s) => s.levels[1],
  play_level: (s) => s.playLevel,
  turn_idx: (s) => TURN_ORDER.indexOf(s.turn), // 0=hero 1=west 2=partner 3=east
  hand_hero: (s) => s.hands.hero.length,
  hand_west: (s) => s.hands.west.length,
  hand_partner: (s) => s.hands.partner.length,
  hand_east: (s) => s.hands.east.length,
  hand_sum: (s) => TURN_ORDER.reduce((n, seat) => n + s.hands[seat].length, 0),
  finished_count: (s) => s.finished.length,
  trick_size: (s) => (s.currentTrick ? s.currentTrick.cards.length : 0),
  wallet_hero: (s) => s.wallets.hero,
  dress_hero: (s) => s.dress.hero,
  dress_west: (s) => s.dress.west,
  dress_partner: (s) => s.dress.partner,
  dress_east: (s) => s.dress.east,
  tribute_count: (s) => s.tributes.length,
  tribute0_card: (s) => (s.tributes[0] ? s.tributes[0].card : -1),
  tribute0_return: (s) => (s.tributes[0] && s.tributes[0].returned !== null ? s.tributes[0].returned : -1),
  result_total_mult: (s) => (s.lastResult ? s.lastResult.totalMult : -1),
  result_pay: (s) => (s.lastResult ? s.lastResult.payPerPlayer : -1),
  result_level_up: (s) => (s.lastResult ? s.lastResult.levelUp : -1),
  winners_team: (s) => (s.lastResult ? s.lastResult.winnersTeam : -1),
};
const FLAG: Record<string, (s: GuandanSession, w: AWorld) => boolean> = {
  last_act_ok: (_s, w) => w.lastActOk,   // 上一条 play/pass 信号是否被引擎接收（false=被拒·配「态不变」表达非法）
  has_trick: (s) => s.currentTrick !== null,
  turn_is_hero: (s) => s.turn === 'hero',
  resisted: (s) => s.resisted,
  settled: (s) => s.phase === 'settled',
  run_won: (s) => s.phase === 'run-won',
  run_lost: (s) => s.phase === 'run-lost',
  has_result: (s) => s.lastResult !== null,
};
const SV: Record<string, (s: GuandanSession, w: AWorld) => string> = {
  phase: (s) => s.phase,
  turn: (s) => s.turn,
  combo: (s) => (s.lastResult ? s.lastResult.combo : 'none'),
  a_result: (s) => (s.lastResult ? s.lastResult.aResult : 'none'),
  winner: (s) => (s.lastResult ? s.lastResult.ranking[0] : 'none'),
  last_loser: (s) => (s.lastResult ? s.lastResult.ranking[3] : 'none'),
  tribute0_from: (s) => (s.tributes[0] ? s.tributes[0].from : 'none'),
  tribute0_to: (s) => (s.tributes[0] ? s.tributes[0].to : 'none'),
};

interface Comp { type: string; id: string; current?: number; active?: boolean; value?: string }
export interface AWorld {
  s: GuandanSession;
  lastActOk: boolean;
  tick(): void;
  getAllEntities(): string[];
  getComponent(id: string, type: string): Comp | undefined;
}

export interface AcceptConfig { stake?: number; tier?: 'l1' | 'l2' | 'l3' | 'l4' }

/** 开一 run（seed 派生发牌·config 可覆盖底注/AI 档）→ 引擎协议 world-like。 */
export function createWorld(seed: number, config?: AcceptConfig): AWorld {
  const s = new GuandanSession({ seed, stake: config?.stake, tier: config?.tier });
  const world: AWorld = {
    s,
    lastActOk: true,
    tick() { s.aiStep(); }, // {tick:N} = 推 N 步 AI（轮到 hero/盘终为 no-op）
    getAllEntities() { return [...Object.keys(RES), ...Object.keys(FLAG), ...Object.keys(SV)]; },
    getComponent(id, type) {
      if (type === 'Resource' && RES[id]) return { type: 'Resource', id, current: RES[id]!(s, world) };
      if (type === 'Flag' && FLAG[id]) return { type: 'Flag', id, active: FLAG[id]!(s, world) };
      if (type === 'StringVar' && SV[id]) return { type: 'StringVar', id, value: SV[id]!(s, world) };
      return undefined;
    },
  };
  return world;
}

/** 一整盘全自动打到结算（hero 走提示·AI 走 aiStep）——纯驱动，不含规则。 */
function playRound(s: GuandanSession): void {
  let guard = 0;
  while (s.phase === 'playing' && guard++ < 8000) {
    if (s.turn === 'hero') {
      const h = s.hint('hero');
      if (!s.act('hero', h)) s.act('hero', null); // 提示落空兜底=过（引擎 A-008 注）
    } else {
      s.aiStep();
    }
  }
}

/** 喂一个操作信号（纯转发到 session·零规则）。by=座位 id；args.cards=牌码数组。 */
export function applySignal(world: AWorld, signal: string, args?: Record<string, unknown>, by?: string): void {
  const s = world.s;
  const seat = (by ?? 'hero') as SeatId;
  const cards = Array.isArray(args?.cards) ? (args!.cards as number[]) : null;
  switch (signal) {
    case 'play':                                   // 出牌（by=座位·args.cards=牌码）；记录是否被接收
      world.lastActOk = s.act(seat, cards);
      break;
    case 'pass':                                   // 过（by=座位）
      world.lastActOk = s.act(seat, null);
      break;
    case 'ai-step':                                // 推一步当前 AI 座
      s.aiStep();
      break;
    case 'auto':                                   // AI 连推到轮回 hero 或盘终
      { let g = 0; while (s.phase === 'playing' && s.turn !== 'hero' && g++ < 8000) s.aiStep(); }
      break;
    case 'play-round':                             // 全自动打完当前盘到结算
      playRound(s);
      break;
    case 'next-round':                             // 重开下一盘（settled 才生效·run 终局为 no-op）
      s.nextRound();
      break;
    case 'play-run':                               // 打穿整个 run 到终局（我方/对方过 A）
      { let r = 0; while (s.phase !== 'run-won' && s.phase !== 'run-lost' && r++ < 300) { playRound(s); if (s.phase === 'settled') s.nextRound(); } }
      break;
    default:                                       // 未知信号=剧本笔误·静默（adapter 不判规则）
      break;
  }
}

/** 读视图（标准=返回 world 自身·机读态提取集中在 runner 的 snapshotScalars）。 */
export function readWorld(world: AWorld): AWorld { return world; }
