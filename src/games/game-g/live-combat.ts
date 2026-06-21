// live-combat.ts —— doc 17/18/19 核心：确定性逐拍 live 战斗 sim。
// owner 模型(钉死)：**一张牌一张牌、一格格慢慢往前爬**（不是一堆牌刷过去，doc18 §一 L14）——
//   基础布局预铺 → 牌从己家 pos 沿路每拍 +MARCH_STEP 往敌家爬（保队形间距）→ **最前两张相邻才对决**
//   （doc19 §三 pairwise logistic 定生死）→ 赢家前进·续航−1(尽则退场沉底)、输家弃堆 → 突破到敌大本营 −1 血(3 血)先破者胜。
// outcome-first：单一 seeded PRNG 按 lane 序消费、逐拍 hash 稳；favor/buff 遭遇拍读 → 中途投放/干预只影响未遭遇牌。
// 纯 game-side 解释器、零引擎；复用 clash-resolve（decideFaceUp 升级为 pairwise）+ seeded PRNG。
import { winrate, pEff, cardPoints, CLASH_K } from './clash-resolve.js';
import { nextRandom } from '@atom-skills/index.js';
import type { RandomSeed } from '@engine/protocol/components.js';

// ── 调参（初版锚点，doc 18 §八 / 19；真机 + 仿真台调入 14）──
export const LANE_LEN = 100;   // 路长：A 家 pos 0 ↔ B 家 pos LANE_LEN
export const MARCH_STEP = 2;   // 每拍每张牌往敌家爬几格（慢 = 决策窗，doc18 §一/19 §二 一格格）
export const SPACING = 5;      // 同侧相邻牌最小间距（保队形、不重叠、一张张排着走）
export const ENC_PERIOD = 6;   // 最前两张相邻后每多少拍一次对决（成波·可读·给决策窗）
export const HOME_BLOOD = 3;   // 大本营 3 滴血（doc19 §六，替 home_hp 8；防无限拖、保节奏）
const MORALE_PTS = 2, ROUT_PTS = 4; // 主将在→下属 +战力 / 主将亡→溃散 −战力（点数空间·bounded，doc 06）
// 续航（doc19 §五）：数字 1 / 人头(A·J·Q·K) 2 / 大小王(JOKER 牌·非天罡) 3 场 → 神牌也得回家歇、逼牌组轮转。
export function cardStamina(rank: string): number {
  if (rank === 'JOKER' || rank === '★' || rank === '王') return 3;
  if (rank === 'A' || rank === 'K' || rank === 'Q' || rank === 'J') return 2;
  return 1;
}

// fogged = 出场带迷雾（面朝下行军、过线才 3D 翻显形）。owner 2026-06-18：**默认无迷雾(false)**，仅附魔牌为 true（乙的养成写、契约①+）。纯表现位、不进 hash/不改判定。
export interface LiveUnit { id: string; rank: string; suit: string; points: number; buff: number; general: boolean; dead: boolean; stamina: number; staminaLeft: number; pos: number; fogged: boolean }
export interface LiveLane { a: LiveUnit[]; b: LiveUnit[]; aGenDead: boolean; bGenDead: boolean; spentA: number; spentB: number; encT: number }
// 对决事件（doc19 §三「胜率可读」+ 命运一掷 · 给战斗表演特写读数）：双方点数/经营加成/有效战力 P_eff、胜率、所掷点 roll、谁胜。
// 纯记录（不进 liveHash、不改判定）：roll = clash 那一掷的 nextRandom 值，aWins = roll < winrate ——把"算出概率→掷→落在区间定生死"如实暴露。
export interface ClashCard { rank: string; suit: string; general: boolean; points: number; buff: number; morale: number; tengang: number; pEff: number; tgBreak?: [string, number][]; nearDef?: number } // tgBreak：天罡逐张贡献 [天罡id, 加成]（owner 2026-06-21·对决明细溯源）；nearDef：地煞·隘口守军固守 +战力
// tie：50:50 平局如何裁定（owner）—— null=正常概率掷命(战力不等) / 'points'=战力相等·点数大者胜 / 'stamina'=点数也同·续航高者胜 / 'roll'=全同·这一掷定(重揉)。
export interface ClashEvent { tick: number; lane: number; winrate: number; roll: number; aWins: boolean; tie: 'points' | 'stamina' | 'roll' | null; a: ClashCard; b: ClashCard }
// 已施天罡 → 玩家侧(a)持续战斗修正（A-JOKER · cast 后整局生效·一种牌算一次不叠）。
// 聚合(aggregateTengang)在 game-g 读 GAME_G_TIANGANGS 算（避免 live-combat ← blueprint 环依赖）；live-combat 只持有这份扁平修正、在 clash/deploy 钩子读。
// v1 实装：odds(巧手 pEffAdd / 稳手 winFloor) · power(虎符 all / 寡兵 LE3 / 同花魁 sameSuit) · combo(对子诀 pair) · morale(令旗 leader) · stamina(铁汉) · draw(广纳 handMax)。
// flat 批补（doc20 §二·确定生效·无 live 挂点）：odds(灌铅骰 kHard 变硬 / 铁骰 noUpset 占优免爆冷) · combo(鼎立 trips 三条) · stamina(老兵 stamFaces 人头牌续航)。
// power 4 锁（doc20 §二「实装细则」·apply 顺序 add→mul→floor→clamp）：锋矢 powerFront(每路最前+) · 擎天 powerMulHighest(全军 base 点数最高单张 ×mul)。虎符 powerAll / 寡兵 powerLE3 即 v1。
// 10 维度天罡聚合修正（doc20 §二·全锁）。前段=clash 系(power/odds/combo/morale)·后段=经济/续航/攻守(stamina/draw/siege)。tempo/lane 主动定向 + arcane 流派印记另接。
export interface TengangFx { pEffAdd: number; winFloor: number; powerAll: number; powerLE3: number; powerSameSuit: number; powerFront: number; powerMulHighest: number; comboPair: number; comboTrips: number; moraleLeader: number; stamPlus: number; stamFaces: number; handMaxAdd: number; kHard: number; noUpset: number; revenge: number; noRout: number; relay: number; clashElixir: number; onPlay: number; siegeDefend: number; siegeChip: number }
export const NO_TENGANG: TengangFx = { pEffAdd: 0, winFloor: 0, powerAll: 0, powerLE3: 0, powerSameSuit: 0, powerFront: 0, powerMulHighest: 0, comboPair: 0, comboTrips: 0, moraleLeader: 0, stamPlus: 0, stamFaces: 0, handMaxAdd: 0, kHard: 0, noUpset: 0, revenge: 0, noRout: 0, relay: 0, clashElixir: 0, onPlay: 0, siegeDefend: 0, siegeChip: 0 };
export interface LiveBattle { tick: number; lanes: [LiveLane, LiveLane, LiveLane]; homeA: number; homeB: number; homeMax: number; winner: 'a' | 'b' | 'draw' | 'pending'; rng: RandomSeed; lastClash: ClashEvent | null; clashSeq: number; clashLog: ClashEvent[]; tengangA: TengangFx }
// 投放指令：第 tick 拍把 unit 投进 lane 的 side 侧（确定性输入流；预布阵 = tick 1 投放）。
// 点数=公平骨架（cardPoints 由 rank 算·双方同副）；buff=经营（天罡/附魔/协同/路…聚合，缺省 0）。
export interface DeployCmd { tick: number; side: 'a' | 'b'; lane: number; unit: { id: string; rank: string; suit: string; general: boolean; buff?: number; fogged?: boolean } }

const mkLane = (): LiveLane => ({ a: [], b: [], aGenDead: false, bGenDead: false, spentA: 0, spentB: 0, encT: 0 });
export function initLiveBattle(seed: number, homeMax: number = HOME_BLOOD): LiveBattle {
  return { tick: 0, lanes: [mkLane(), mkLane(), mkLane()], homeA: homeMax, homeB: homeMax, homeMax, winner: 'pending', rng: { type: 'RandomSeed', seed, sequence: 0 }, lastClash: null, clashSeq: 0, clashLog: [], tengangA: NO_TENGANG };
}

// 人头牌(JQKA)判定（老兵 stamFaces：只这些牌吃续航加成）。
const isFaceRank = (r: string): boolean => r === 'A' || r === 'K' || r === 'Q' || r === 'J';
function applyDeploy(b: LiveBattle, c: DeployCmd): void {
  const L = b.lanes[c.lane];
  const q = c.side === 'a' ? L.a : L.b;
  const stam = cardStamina(c.unit.rank) + (c.side === 'a' ? b.tengangA.stamPlus + (isFaceRank(c.unit.rank) ? b.tengangA.stamFaces : 0) : 0); // 天罡·铁汉(全军)/老兵(人头牌)：己方续航 +
  // 入场位 = 己家边 + 已有同侧牌往后错开间距（一张张排队 staging，front=index0=先投者在最前）。
  const pos = c.side === 'a' ? -q.length * SPACING : LANE_LEN + q.length * SPACING;
  q.push({ id: c.unit.id, rank: c.unit.rank, suit: c.unit.suit, points: cardPoints(c.unit.rank), buff: c.unit.buff ?? 0, general: c.unit.general, dead: false, stamina: stam, staminaLeft: stam, pos, fogged: c.unit.fogged ?? false });
}

// 三路兵力迁移（doc21 ⭐ owner「兵力可跨路调度」）：把某路己侧**后备**(队尾·离敌最远·未接敌)一张移到另一路，
//   从目标路家边重新排队入列。**确定性**（只搬队列·不消耗 rng）；只动队尾后备 → 不抽走正在遭遇的前锋、不改已决对决（outcome-first 安全）。
//   返回是否成功（同路/源空 → false）。哪一拍迁移由输入流决定 → 同输入可回放、逐拍 hash 稳。
export function migrateRear(b: LiveBattle, side: 'a' | 'b', fromLane: number, toLane: number): boolean {
  if (fromLane === toLane || b.winner !== 'pending') return false;
  const src = side === 'a' ? b.lanes[fromLane].a : b.lanes[fromLane].b;
  const dst = side === 'a' ? b.lanes[toLane].a : b.lanes[toLane].b;
  if (src.length === 0) return false;
  const u = src.pop()!; // 后备 = 队尾（己 side 离敌最远的一张·未接敌）
  u.pos = side === 'a' ? -dst.length * SPACING : LANE_LEN + dst.length * SPACING; // 目标路家边重新 staging（同 applyDeploy）
  dst.push(u);
  return true;
}

// 擎天「最强单张」：side a 全军(跨三路) base 点数最高的一张 id（按 base points 判·防 buff 循环；ties 取 lane 序+队首 = 确定性）。仅 powerMulHighest 激活时算。
function highestBaseIdA(lanes: readonly LiveLane[]): string | undefined {
  let best: LiveUnit | undefined;
  for (const L of lanes) for (const u of L.a) if (!best || u.points > best.points) best = u;
  return best?.id;
}

// 遭遇拍的有效战力 P_eff（doc19 §三）：基础点数 + 经营 buff + 本路士气（主将在 +MORALE_PTS / 亡 −ROUT_PTS）。读当下 → live。
// 返回拆解（供对决特写「主 Buff 明细」）：pEff 终值 + shift（士气/溃散分量）。经营 buff = u.buff（养成/干预聚合）。
// championId = 擎天「最强单张」目标 id（caller 跨三路算·只 side a）；命中则该牌 ×powerMulHighest（apply add→mul→floor→clamp 由 pEff 落实）。
function effPowerBreak(u: LiveUnit, lane: LiveLane, side: 'a' | 'b', fx: TengangFx, championId?: string): { pEff: number; shift: number; tg: number } {
  // 天罡(玩家 a 施法·持续·只己方)：点数加成 = 全军(虎符) + 每路最前(锋矢) + 巧手掷命点 + 本路≤3张(寡兵) + 同花伙伴(同花魁) + 本路含对子/三条(对子诀/鼎立)。
  let tg = 0;
  if (side === 'a') {
    tg += fx.powerAll + fx.pEffAdd;
    if (fx.powerFront && lane.a.length && u.id === lane.a[0].id) tg += fx.powerFront; // 锋矢：每路最前一张(index0 = pos 最大 = 前锋)；非最前不加
    if (lane.a.length <= 3) tg += fx.powerLE3;
    if (fx.powerSameSuit && lane.a.filter((x) => x.suit === u.suit).length >= 2) tg += fx.powerSameSuit;
    if (fx.comboPair || fx.comboTrips) { const rc = new Map<string, number>(); for (const x of lane.a) rc.set(x.rank, (rc.get(x.rank) ?? 0) + 1); const vals = [...rc.values()]; if (fx.comboPair && vals.some((n) => n >= 2)) tg += fx.comboPair; if (fx.comboTrips && vals.some((n) => n >= 3)) tg += fx.comboTrips; } // 对子诀(≥2同点)/鼎立(≥3同点)
  }
  const mul = side === 'a' && fx.powerMulHighest > 1 && u.id === championId ? fx.powerMulHighest : 1; // 擎天：仅全军最强单张 ×mul
  if (u.general) return { pEff: pEff(u.points, u.buff + tg, mul), shift: 0, tg }; // 主将自身=士气源、不再吃士气分量（仍吃天罡点数加成）
  const genDead = side === 'a' ? lane.aGenDead : lane.bGenDead;
  const genHere = (side === 'a' ? lane.a : lane.b).some((x) => x.general && !x.dead);
  const moraleBonus = side === 'a' && genHere ? fx.moraleLeader : 0; // 令旗：主将在 → 下属士气额外 +（计入 士气 分量）
  const shift = genDead ? -ROUT_PTS : genHere ? MORALE_PTS + moraleBonus : 0;
  return { pEff: pEff(u.points, u.buff + tg + shift, mul), shift, tg };
}

function killFront(lane: LiveLane, side: 'a' | 'b'): void {
  const q = side === 'a' ? lane.a : lane.b;
  const u = q.shift();
  if (u) { u.dead = true; if (u.general) { if (side === 'a') lane.aGenDead = true; else lane.bGenDead = true; } }
}

// 一张张往敌家爬一拍：front(index0) 受 frontLimit 卡停（贴敌前锋/抵敌家），其余受前一张间距 SPACING 卡停（排队）。
function marchSide(q: LiveUnit[], dir: 1 | -1, frontLimit: number | null): void {
  for (let i = 0; i < q.length; i++) {
    let t = q[i].pos + dir * MARCH_STEP;
    if (i > 0) { const ahead = q[i - 1].pos; t = dir > 0 ? Math.min(t, ahead - SPACING) : Math.max(t, ahead + SPACING); } // 别撞上前一张
    else if (frontLimit !== null) t = dir > 0 ? Math.min(t, frontLimit) : Math.max(t, frontLimit); // 前锋：贴线/抵家停
    q[i].pos = dir > 0 ? Math.min(t, LANE_LEN) : Math.max(t, 0);
  }
}

// 一路推进一拍：未相邻→一格格爬；最前两张相邻→成波对决；一侧清空→另侧一张张爬向敌家、抵家 chip。
function stepLane(b: LiveBattle, li: number): void {
  const lane = b.lanes[li];
  const A = lane.a, B = lane.b;
  if (A.length && B.length) {
    const fa = A[0], fb = B[0];
    if (fa.pos + 1 < fb.pos) { marchSide(A, 1, fb.pos - 1); marchSide(B, -1, fa.pos + 1); lane.encT = 0; return; } // 还没碰面 → 慢慢爬
    lane.encT += 1; // 相邻 → 成波对决（每 ENC_PERIOD 一掷）
    if (lane.encT % ENC_PERIOD !== 0) return;
    // doc19 §三 pairwise logistic：算 P_eff → 胜率 → 掷一点 roll 落在区间定生死。内联 clashResolve 同序消费 rng（hash 不变），且暴露 roll/明细供特写。
    const champId = b.tengangA.powerMulHighest > 1 ? highestBaseIdA(b.lanes) : undefined; // 擎天：跨三路定全军最强单张
    const ba = effPowerBreak(fa, lane, 'a', b.tengangA, champId), bb = effPowerBreak(fb, lane, 'b', NO_TENGANG); // 天罡只己方(a)
    const ea = ba.pEff, eb = bb.pEff;
    let wr = winrate(ea, eb, Math.max(2, CLASH_K - b.tengangA.kHard)); // 灌铅骰：kHard 让 logistic 变硬(k↓)→点数差更决定胜负·强者愈强
    if (b.tengangA.winFloor > 0) wr = Math.min(0.97, Math.max(wr, 0.03 + b.tengangA.winFloor)); // 稳手：玩家胜率下限抬高（少翻车）
    const roll = nextRandom(b.rng); // 同序消费 rng（天罡只改阈值/pEff·不改 rng 消费 → 逐拍 hash 仍确定）
    // 50:50 平局阶梯（owner）：战力相等 → 不纯靠运气，按 点数大者胜 → 续航高者胜 → 全同则这一掷定(重揉)。战力不等 → 正常概率掷命(含爆冷缝)。
    let aWins: boolean, tie: ClashEvent['tie'] = null;
    if (ea === eb) {
      if (fa.points !== fb.points) { aWins = fa.points > fb.points; tie = 'points'; }
      else if (fa.staminaLeft !== fb.staminaLeft) { aWins = fa.staminaLeft > fb.staminaLeft; tie = 'stamina'; }
      else { aWins = roll < 0.5; tie = 'roll'; }
    } else {
      aWins = roll < wr;
      if (b.tengangA.noUpset > 0 && wr >= 0.5) aWins = true; // 铁骰：占优(胜率≥50%)免疫爆冷·占优就稳拿（不改 rng 消费·仅覆盖结果·lockstep 安全）
    }
    const ev: ClashEvent = { tick: b.tick, lane: li, winrate: wr, roll, aWins, tie, a: { rank: fa.rank, suit: fa.suit, general: fa.general, points: fa.points, buff: fa.buff, morale: ba.shift, tengang: ba.tg, pEff: ea }, b: { rank: fb.rank, suit: fb.suit, general: fb.general, points: fb.points, buff: fb.buff, morale: bb.shift, tengang: bb.tg, pEff: eb } };
    b.lastClash = ev; b.clashSeq += 1; b.clashLog.push(ev);
    killFront(lane, aWins ? 'b' : 'a'); // 输家翻反·阵亡 → 本局弃堆
    const wq = aWins ? A : B; const wf = wq[0]; // 赢家翻正·前进，续航 −1；尽则退场（沉牌底·3D-1 再部署轮转）
    if (wf) { wf.staminaLeft -= 1; if (wf.staminaLeft <= 0) { wq.shift(); if (aWins) lane.spentA += 1; else lane.spentB += 1; } }
  } else if (A.length) { // B 清空 → A 一张张爬向 B 家、抵家 −1 血
    marchSide(A, 1, null);
    for (let i = A.length - 1; i >= 0; i--) if (A[i].pos >= LANE_LEN) { A.splice(i, 1); b.homeB = Math.max(0, b.homeB - 1); }
  } else if (B.length) {
    marchSide(B, -1, null);
    for (let i = B.length - 1; i >= 0; i--) if (B[i].pos <= 0) { B.splice(i, 1); b.homeA = Math.max(0, b.homeA - 1); }
  }
}

// 推进整局一拍：投放 → 三路 step（爬/对决/突破到家 chip）→ 判胜负。
export function stepLiveBattle(b: LiveBattle, deploys: DeployCmd[] = []): void {
  if (b.winner !== 'pending') return;
  b.tick += 1;
  for (const c of deploys) if (c.tick === b.tick) applyDeploy(b, c);
  for (const li of [0, 1, 2]) stepLane(b, li);
  if (b.homeB <= 0 && b.homeA <= 0) b.winner = 'draw';
  else if (b.homeB <= 0) b.winner = 'a';
  else if (b.homeA <= 0) b.winner = 'b';
}

// 战局是否还有未决（用于跑到底）：任一路还有牌。
export function liveActive(b: LiveBattle): boolean {
  if (b.winner !== 'pending') return false;
  return b.lanes.some((l) => l.a.length || l.b.length);
}

// 跑到分胜负或 maxTicks（无人破家但都打完 → 比残血定，平则 draw）。
export function runLiveBattle(b: LiveBattle, deploys: DeployCmd[] = [], maxTicks = 6000): void {
  while (b.winner === 'pending' && b.tick < maxTicks && (liveActive(b) || deploys.some((c) => c.tick > b.tick))) stepLiveBattle(b, deploys);
  if (b.winner === 'pending') b.winner = b.homeB < b.homeA ? 'a' : b.homeA < b.homeB ? 'b' : 'draw';
}

// 确定性状态指纹（逐拍对比；含最前两张位置·队长·续航退场·老家血·rng 序）。
export function liveHash(b: LiveBattle): string {
  const lane = (l: LiveLane): string => `${l.a.length}@${l.a[0]?.pos ?? '_'},${l.b.length}@${l.b[0]?.pos ?? '_'},${l.aGenDead ? 1 : 0}${l.bGenDead ? 1 : 0},${l.spentA},${l.spentB},${l.encT}`;
  return `t${b.tick}|hA${b.homeA}|hB${b.homeB}|w${b.winner}|s${b.rng.sequence}|${b.lanes.map(lane).join('|')}`;
}

// ── A1 战潮抽牌·事件脉冲（doc18 §10.3 乙 · owner 北极星 Balatro「啪嗒啪嗒」心流）──
// 抽牌非线性：底流保底慢抽（showMatch 每 DRAW_PERIOD_TICKS +1），叠**战斗事件脉冲**——该来牌时"哗"一把：
//   遭遇(每场对决) +1 / 斩将(主将阵亡) +1 / 告急(我家被 chip 1 血) +CRISIS 援牌(张力峰值·绝境涌牌) / 破阵(敌家被 chip) +1 趁胜追击。
// 纯函数·确定性：吃「本拍新生对决 + 我家/敌家被 chip 血量」→ 返回本拍事件应抽张数（底流另加）。手牌满则 showMatch 自然停抽=节流。
export const TIDE_PULSE = { encounter: 1, decap: 1, crisis: 2, breach: 1 } as const;
export function tideDrawPulse(newClashes: ClashEvent[], homeAChipped: number, homeBChipped: number): number {
  let n = 0;
  for (const ev of newClashes) {
    n += TIDE_PULSE.encounter; // 一波遭遇翻牌 +1
    if (ev.aWins ? ev.b.general : ev.a.general) n += TIDE_PULSE.decap; // 主将阵亡(被斩) +1
  }
  n += Math.max(0, homeAChipped) * TIDE_PULSE.crisis; // 我家每掉 1 血 → 绝境援牌（峰值）
  n += Math.max(0, homeBChipped) * TIDE_PULSE.breach; // 敌家每掉 1 血 → 趁胜追击
  return n;
}

