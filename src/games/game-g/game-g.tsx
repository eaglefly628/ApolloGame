import { mountBattle, type BattleView, type BattleUnit, type BattleLane, type BattleLever, type HandCardView, type TengangCardView, type BattleActions, type ClashView, type BattleFx } from './battle-screen.js';
import { mountLobby, type LobbyView, type LobbyShopItem } from './lobby-screen.js';
import { prepareArmies, quartermasterEnergy, FORMATION_PRESETS, PRESET_NAMES, LEVER_CATALOG, LEVER_START, battleSpec, RUN_BATTLES, RUN_LIVES, BETWEEN_BUFFS, applyBuff, tiangangKeyBuffs, BOSS_ROSTER, bossFor, GAME_G_TIANGANGS, TIANGANG_BY_ID, ARCHETYPES, detectArchetype, archetypeMatchup, activeArchetype, pickAiFormation, GAME_G_PLANETS, GAME_G_FOILS, effectiveLives, effectiveLeverCap, effectiveLeverRegen, type Formation, type Intervention, type LeverKind, type RunBuff, type ArmyCard } from './index.js';
import { initLiveBattle, stepLiveBattle, liveActive, migrateRear, NO_TENGANG, LANE_LEN, HOME_BLOOD, type LiveBattle, type DeployCmd, type ClashEvent, type TengangFx } from './live-combat.js';
import { cardPoints, P_MAX } from './clash-resolve.js';

// Game G ·《翻命扑克》—— 大厅 ↔ 出征 闭环（launcher 卡带槽：export mount(container)→cleanup）。自包含于本目录。
// outcome-first：每张牌按 favor 跑确定性种子硬币**先定生死**，3D 翻牌是**反推的表现**（抛飞→相撞→落定翻面）。
// 闭环：大厅看材料/牌组 → 花材料改造牌组(升 favor) → 出征打一关(buildGameGMatch) → 赢取材料、关卡递增 → 再改造。
// 进度本地存档；胜负=数据决策（不回灌）；3D 只在 ThreeRenderer 表现层。是 gameF 大厅式挂载编排，复用现成能力。
const W = 600;
const H = 540;
const DECK_SIZE = 52;
const SAVE_KEY = 'gameG-save-v1';
// 大厅根容器样式：默认屏(布阵/备战/战斗)居中竖排；大厅屏改顶对齐可滚动(承载 5 tab 古风布局)。
const DEFAULT_ROOT_CSS = 'position:absolute;inset:0;background:#0a0a14;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#cbd5e1;font:13px system-ui';
const LOBBY_ROOT_CSS = 'position:absolute;inset:0;overflow:auto';
// WIRE-MARCH 节奏（owner 钉死「一格格慢慢走」，doc18 §八）：sim 每 LIVE_STEP_MS 走一拍（MARCH_STEP=2 格），
// 渲染按真拍间 frac 平滑滑行（~RENDER_MS 一帧）。owner 反馈「太快来不及看」→ 600ms/拍（比首版慢 1 倍），更从容观察；
// 每场对决再叠加特写表演（PERF_MS 冻结战场细看）。SEC_PER_TICK 派生读秒。
const LIVE_STEP_MS = 600;   // 一拍真实时长（owner 要更慢：300→600 慢一倍；慢=决策窗）
const RENDER_MS = 33;       // 重渲间隔（~30fps 平滑）
const SEC_PER_TICK = LIVE_STEP_MS / 1000;
const PERF_MS = 1700;       // 对决特写表演时长（冻结战场·放大两牌·读数·掷点定生死，owner：拉到屏幕前看为什么胜败）
// 迷雾显形（owner 2026-06-18 改：**默认无迷雾**，仅附魔牌 fogged 才面朝下 → 过线 3D 翻显形）。迷雾时间缩短：早点翻。
// 非 fogged 牌一律即显形(face-up)；fogged 牌越过本侧短线(0.18/0.82·比旧 0.34/0.66 短)即翻。
const FOG_A_EDGE = 0.18;    // A 的 fogged 兵越过此线 → 显形（pos01 ≥）
const FOG_B_EDGE = 0.82;    // B 的 fogged 兵越过此线 → 显形（pos01 ≤）
// 出牌控盘层（doc18 §10 · 布局阶段 base 打底 + 抽牌堆 + 手牌实时派三路 + 读秒暂停银行）。数值初版、待真机/仿真台磨。
const BASE_PER_LANE = 3;        // 布局阶段每路预铺张数（共 9 打底，doc18 §10.2）
const AI_PERIOD_TICKS = 16;     // 敌方滴投：每 N 拍从其牌库投一张（入该牌原路 → 随阵型分布）
// ── CR 局内经济 TUNE（doc21 · owner 抄皇室战争）：点数(圣水)随真实时间回复 → 花点数摸牌(玩家选库) → 普通部署/天罡施法。砍读秒暂停。──
// 改这一处即调手感。owner 2026-06-19 反馈「圣水涨太快·看不到心流·点数太多」→ 池砍半(5) + regen 大幅放慢(2000ms) + 起手压低。
// 派生节奏（当前 regen 2000ms · 池 5）：≈0.5 点/秒 → 每 2s 摸 1 普通 / 4s 摸 1 天罡；满池 5 点从起手 2 攒满 ≈ 6s。心流＝攒→花的取舍张力。
// 想再调：更慢/更少手感 = REGEN 调大、MAX/START 调小；更快 = 反之。CR 原版 regen≈2800ms 可作参考上界。
const POINTS_MAX = 5;           // 点数池上限（owner：max 5·制造稀缺=心流；原 10 太满、无取舍）
const POINTS_START = 2;         // 起手点数（须 ≤MAX·压低开局；靠起手手牌先免费铺路，点数攒着摸新牌）
const POINTS_REGEN_MS = 2000;   // 每回 1 点真实时长（owner：放慢·看得见涨；原 800 太快近乎常满）
const NORMAL_DRAW_COST = 1;     // 摸普通库花点数（doc21 §二.5 ~1）
const TENGANG_DRAW_COST = 2;    // 摸天罡库花点数（~2·更贵 = 故意限流 + 一次点数投资）
const NORMAL_HAND_CAP = 7;      // 普通手牌可囤积上限（攒一波"哗"出·doc21 ~7）
const TENGANG_CAP = 5;          // 天罡在手上限（打掉一张才能再摸 · play-to-draw）
const OPENING_NORMAL = 5;       // 起手普通手牌（快档：5·更快有牌打）
type BattleControl = { hand: HandCardView[]; selectedCard: number; deckCount: number; tengang: TengangCardView[]; selectedTengang: number; tengangDeckCount: number; points: number; pointsMax: number; normalDrawCost: number; tengangDrawCost: number; canDrawNormal: boolean; canDrawTengang: boolean; migrateSource: number };
const NO_CONTROL: BattleControl = { hand: [], selectedCard: -1, deckCount: 0, tengang: [], selectedTengang: -1, tengangDeckCount: 0, points: 0, pointsMax: 0, normalDrawCost: 0, tengangDrawCost: 0, canDrawNormal: false, canDrawTengang: false, migrateSource: -1 }; // 看帧/无控盘默认

interface Save {
  materials: number;
  stage: number;
  deck: number[]; // 我方 52 张的 favor（0..95）
  lastOfficers: number[]; // 上次布阵的三路军官数 [上,中,下]（默认选中 + AI 克制依据）
  leverEnergy: number; // 干预能量◈（开局 3 / 每胜 +2 / 上限 6）
  lives: number; // 战役命线（开 run 3 命，输一场 −1，命尽=run 结束）
  bossIdx: number; // 本 run 终局 Boss（每 run 轮换一名，开 run 随机定，供针对性布阵）
  ownedTiangangs: string[]; // 已买入小丑 id（全部拥有集·跨 run 不清零）
  tiangangs: string[]; // 战库 ≤5 张（从 ownedTiangangs 选入·契约②·甲读）
  planets: Record<string, number>; // 星球牌等级（局外持久 · 可叠加升档 · 第二养成轴）
  foils: string[]; // 已收集的 foil 闪艺皮肤 id（纯表现收集 · 零 gameplay）
}

const rollBoss = (): number => Math.floor(Math.random() * BOSS_ROSTER.length);
export function freshSave(): Save {
  return { materials: 0, stage: 1, deck: Array.from({ length: DECK_SIZE }, (_, i) => 44 + (i % 10) * 2), lastOfficers: [10, 10, 10], leverEnergy: LEVER_START, lives: RUN_LIVES, bossIdx: rollBoss(), ownedTiangangs: [], tiangangs: [], planets: {}, foils: [] }; // 44..62 起步；stage=当前战 1..5
}
function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Save;
      if (Array.isArray(s.deck) && s.deck.length === DECK_SIZE) {
        if (!Array.isArray(s.lastOfficers) || s.lastOfficers.length !== 3) s.lastOfficers = [10, 10, 10]; // 旧存档兼容
        if (typeof s.leverEnergy !== 'number') s.leverEnergy = LEVER_START;
        if (typeof s.bossIdx !== 'number') s.bossIdx = rollBoss();
        // 重命名(joker→天罡)迁移 + owner 拍「清空老存档战库」：老存档键为 jokers/ownedJokers → 战库(tiangangs)清空、收藏(ownedTiangangs)沿用旧 ownedJokers；丢弃遗留键。
        const legacy = s as unknown as { jokers?: unknown; ownedJokers?: unknown };
        if (legacy.jokers !== undefined || legacy.ownedJokers !== undefined || !Array.isArray(s.tiangangs) || !Array.isArray(s.ownedTiangangs)) {
          if (!Array.isArray(s.ownedTiangangs)) s.ownedTiangangs = Array.isArray(legacy.ownedJokers) ? (legacy.ownedJokers as string[]) : [];
          s.tiangangs = []; // 老存档战库清空（owner）
          delete legacy.jokers; delete legacy.ownedJokers;
        }
        if (s.tiangangs.length > 5) s.tiangangs = s.tiangangs.slice(0, 5); // 战库上限 5
        if (typeof s.planets !== 'object' || s.planets === null) s.planets = {};
        if (!Array.isArray(s.foils)) s.foils = [];
        if (typeof s.lives !== 'number') s.lives = effectiveLives(s.planets);
        if (s.stage < 1 || s.stage > RUN_BATTLES) s.stage = 1;
        return s;
      }
    }
  } catch {
    /* localStorage 不可用 → 用全新存档 */
  }
  return freshSave();
}
function persist(s: Save): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* 忽略 */
  }
}

const clampFavor = (f: number): number => Math.max(5, Math.min(95, Math.round(f)));
const avg = (xs: number[]): number => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
// 牌组均 favor → 全军 favor 偏置（改造越多越强）；敌方偏置随关卡递增。
const myBias = (deck: number[]): number => avg(deck) - 50;
const enemyBias = (stage: number): number => -8 + stage * 2;
// AI 暗布阵：低关固定均衡 / 中关变化 / 高关克制你上局阵型（石头剪刀布闭环）。对玩家隐藏，开战揭晓。
// 布阵 → 名称（命中预设则用预设名，否则"自定义 x/y/z"），用于战后揭晓敌阵。
function describeFormation(off: number[]): string {
  for (const n of PRESET_NAMES) {
    const p = FORMATION_PRESETS[n].officers;
    if (p[0] === off[0] && p[1] === off[1] && p[2] === off[2]) return n;
  }
  return `自定义 ${off[0]}/${off[1]}/${off[2]}`;
}
// 场间三选一：从增益池随机取 3 张（Fisher–Yates；元层奖励，非确定性 gameplay，用 Math.random 即可）。
function pick3<T>(xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, 3);
}

// 干预卡字形（设计稿同款图标）；对手花色（从 Boss/阵名推）。
const LEVER_GLYPH: Record<LeverKind, string> = { bless: '🎯', curse: '☠', shield: '🛡', decapitate: '🗡', reinforce: '🚩', flush: '♣' };
const suitOf = (n: string): 's' | 'h' | 'd' | 'c' => (/黑桃|♠/.test(n) ? 's' : /红桃|♥/.test(n) ? 'h' : /方块|方片|♦/.test(n) ? 'd' : /梅花|♣/.test(n) ? 'c' : 'h');
const LANE_NAME3 = ['上路', '中路', '下路'];

// WIRE-MARCH 桥：把揭晓前编排好的 ArmyCard（favor=军衔+经营+干预 聚成的单一强度标量）映射成 live-combat 投放令。
// 公平骨架（doc19）：rank→points(fair) 走 cardPoints；该牌全部强度经 favor 折算进 buff，使 P_eff=clamp(favorToP(favor))
//   单调随 favor（军衔已在 favor 里）——buff 抵消 cardPoints 噪声，让既有 favor 经济无缝驱动新 pairwise 对决核、不改既测的 live-combat。
//   （3D-CLASH 深水区会用 doc19 公平 points + 经营 buff 正式替掉 favor；此为 W1 接线桥，FAVOR/scale 待仿真台调。）
const FAVOR_LO = 5, FAVOR_HI = 95; // favor 钳域（blueprint clampFavor）
const favorToP = (favor: number): number => ((Math.max(FAVOR_LO, Math.min(FAVOR_HI, favor)) - FAVOR_LO) / (FAVOR_HI - FAVOR_LO)) * P_MAX; // favor → P_eff 空间 [0,30]
const cardRank = (c: ArmyCard): string => (c.rank === 'JOKER' ? '★' : c.rank); // 显示 + cardPoints/cardStamina 同口径（★≡JOKER：点数15/续航3）
const toUnit = (c: ArmyCard): DeployCmd['unit'] => ({ id: c.id, rank: cardRank(c), suit: c.suit, general: c.general, buff: Math.round(favorToP(c.favor) - cardPoints(cardRank(c))) });
export function armyToDeploys(army: ArmyCard[], side: 'a' | 'b'): DeployCmd[] {
  return army.map((c) => ({ tick: 1, side, lane: c.lane, unit: toUnit(c) }));
}
// 逐拍位置快照（驱动层插值用：真拍间按 frac 滑行，渲染才「慢慢走」而非每拍瞬跳）。
function snapLivePos(live: LiveBattle): Map<string, number> {
  const m = new Map<string, number>();
  for (const L of live.lanes) { for (const u of L.a) m.set(u.id, u.pos); for (const u of L.b) m.set(u.id, u.pos); }
  return m;
}
// CR 摸牌可行性（doc21 §二.5 · 纯函数·便于测）：点数够 & 该手牌未到上限 & 该库还有牌。普通/天罡两库共用此判。
export function canDrawFrom(points: number, cost: number, handLen: number, cap: number, deckLen: number): boolean {
  return points >= cost && handLen < cap && deckLen > 0;
}
// A-JOKER：已施天罡(契约②·玩家施法集) → 聚合扁平战斗修正（live-combat 钩子读·只己方）。读 GAME_G_TIANGANGS 的 {kind,params}（契约③）。
// 一种牌算一次（不叠）。v1 实装 6 kind；v2 待接（背水 reroll / 顺子阵 straight / 擒王 decapCost·依干预 / tempo / lane 一次性 / siege / arcane 印记 / 战潮 pulse·CR 已取代被动涌牌）—— 未实装 kind 返回零修正、不崩。
export function aggregateTengang(castIds: readonly string[]): TengangFx {
  const fx: TengangFx = { ...NO_TENGANG };
  for (const id of castIds) {
    const j = TIANGANG_BY_ID.get(id); const p = j?.params as Record<string, unknown> | undefined;
    if (!j || !p) continue;
    const v = typeof p.value === 'number' ? p.value : 0;
    if (j.kind === 'odds') { if (p.op === 'add') fx.pEffAdd += v; else if (p.op === 'winFloor') fx.winFloor += v / 100; }
    else if (j.kind === 'power' && p.op === 'add') { if (p.filter === 'countLE3') fx.powerLE3 += v; else if (p.filter === 'sameSuit') fx.powerSameSuit += v; else fx.powerAll += v; }
    else if (j.kind === 'combo' && p.op === 'pair') fx.comboPair += typeof p.bonus === 'number' ? p.bonus : 0;
    else if (j.kind === 'morale' && p.op === 'leaderBuff') fx.moraleLeader += v;
    else if (j.kind === 'stamina' && p.op === 'stamPlus') fx.stamPlus += v;
    else if (j.kind === 'draw' && p.op === 'handMax') fx.handMaxAdd += v;
  }
  return fx;
}

// 从 live-combat 逐拍 sim + save 派生战场视图（喂 battle-screen 渲染设计稿）。纯读 sim 真相、不回灌。
// owner「一格格慢慢走」：兵位 = 真 slot pos01（live pos/LANE_LEN）；最前两张相邻(接敌)才 revealed 翻开。
// 导出供无头看帧/视觉回归测试用（battle-screen.frame.test.ts 真 live sim → 真 view → 真渲染器 → HTML golden）。
export function buildBattleViewLive(live: LiveBattle, save: Save, oppName: string, oppPersona: string, oppSuit: 's' | 'h' | 'd' | 'c', control: BattleControl = NO_CONTROL, clash: ClashView | null = null, fx: BattleFx[] = []): BattleView {
  const sv = (s: string): 's' | 'h' | 'd' | 'c' => s.toLowerCase() as 's' | 'h' | 'd' | 'c';
  const units: BattleUnit[] = [];
  for (const li of [0, 1, 2]) {
    const L = live.lanes[li];
    // 默认即显形(face-up)；仅 fogged(附魔)牌面朝下、越过本侧短线才翻（owner：默认无迷雾、迷雾=附魔专属）。
    L.a.forEach((u) => { const pos01 = u.pos / LANE_LEN; units.push({ id: u.id, lane: li, side: 'a', pos01, revealed: !u.fogged || pos01 >= FOG_A_EDGE, faceUp: true, rank: u.rank, suit: sv(u.suit), general: u.general, fogged: u.fogged }); });
    L.b.forEach((u) => { const pos01 = u.pos / LANE_LEN; units.push({ id: u.id, lane: li, side: 'b', pos01, revealed: !u.fogged || pos01 <= FOG_B_EDGE, faceUp: true, rank: u.rank, suit: sv(u.suit), general: u.general, fogged: u.fogged }); });
  }
  const lanes: BattleLane[] = [0, 1, 2].map((li) => {
    const L = live.lanes[li];
    const mine = L.a.length, enemy = L.b.length;
    const lead: 'a' | 'b' | 'n' = mine > enemy ? 'a' : enemy > mine ? 'b' : 'n';
    return { name: LANE_NAME3[li], mine, enemy, lead, state: lead === 'a' ? '我方推进' : lead === 'b' ? '敌方压制' : '僵持', mineText: `存活 ${mine}`, enemyText: `存活 ${enemy}` };
  });
  const levers: BattleLever[] = (Object.keys(LEVER_CATALOG) as LeverKind[]).map((k) => ({ key: k, glyph: LEVER_GLYPH[k], name: LEVER_CATALOG[k].name, cost: LEVER_CATALOG[k].cost, desc: LEVER_CATALOG[k].desc }));
  const secs = Math.round(live.tick * SEC_PER_TICK); // 读秒（确定性，由拍数派生）
  return {
    homeA: live.homeA, homeAMax: live.homeMax, homeB: live.homeB, homeBMax: live.homeMax,
    oppName, oppPersona, oppSuit, energy: save.leverEnergy, energyMax: effectiveLeverCap(save.planets), materials: save.materials,
    phaseText: '占领敌方老家 · 即胜', timeText: `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`,
    levers, lanes, units,
    hand: control.hand, selectedCard: control.selectedCard, deckCount: control.deckCount,
    tengang: control.tengang, selectedTengang: control.selectedTengang, tengangDeckCount: control.tengangDeckCount,
    points: control.points, pointsMax: control.pointsMax, normalDrawCost: control.normalDrawCost, tengangDrawCost: control.tengangDrawCost, canDrawNormal: control.canDrawNormal, canDrawTengang: control.canDrawTengang, migrateSource: control.migrateSource,
    clash, fx,
  };
}
// live-combat 对决事件 → 特写视图（a=我方/b=敌方；点数/加成/战力/胜率/掷点 如实透出）。
function clashToView(ev: ClashEvent): ClashView {
  const card = (c: ClashEvent['a']): ClashView['a'] => ({ rank: c.rank, suit: c.suit.toLowerCase() as 's' | 'h' | 'd' | 'c', general: c.general, points: c.points, buff: c.buff, morale: c.morale, tengang: c.tengang, pEff: c.pEff });
  return { lane: ev.lane, winrate: ev.winrate, roll: ev.roll, aWins: ev.aWins, tie: ev.tie, a: card(ev.a), b: card(ev.b) };
}

export function mount(container: HTMLElement): () => void {
  const save = loadSave();
  let stopLoop: (() => void) | null = null; // live-combat rAF 驱动停手（替掉旧 Engine 时钟）
  let battle: { update: () => void; destroy: () => void } | null = null;
  let lobby: { update: () => void; destroy: () => void } | null = null; // 大厅忠实港挂载句柄
  let lobbySkin: 'onyx' | 'rosy' = 'onyx'; // 双皮：玄铁(暗)/锦霞(亮)，纯表现、不入存档

  const root = document.createElement('div');
  root.style.cssText = DEFAULT_ROOT_CSS;
  container.appendChild(root);

  const teardownMatch = (): void => {
    if (stopLoop) stopLoop();
    if (battle) battle.destroy();
    stopLoop = null;
    battle = null;
  };
  const clear = (): void => {
    teardownMatch();
    if (lobby) { lobby.destroy(); lobby = null; }
    root.replaceChildren();
    root.style.cssText = DEFAULT_ROOT_CSS; // 离开大厅时还原默认屏样式
  };

  // ───────────────────────── 大厅（5 tab IA · 顶栏 · 玄铁/锦霞双皮 · 对齐 UI/Game G 大厅.dc.html）─────────────────────────
  // owner 指「裸按钮堆 ≠ 设计稿」(design/16 §十一)：重做成 大厅/牌组/收藏/改造坊/天梯 五屏 + 顶栏 + 古风双皮。
  // 真实存档数据驱动；未接网的(好友/天梯1v1/全服榜)诚实标「占位」，绝不伪造功能。
  function showLobby(): void {
    clear();
    root.style.cssText = LOBBY_ROOT_CSS;
    const host = document.createElement('div');
    root.appendChild(host);
    // 大厅视图：真实存档（材料/能量/牌组 favor/小丑/星球/闪艺/战役进度/流派↔Boss 克制）→ 喂忠实港渲染器。未接网项渲染器内诚实占位。
    const buildLobbyView = (): LobbyView => {
      const boss = bossFor(save.bossIdx);
      const arch = detectArchetype(save.tiangangs);
      const activated = activeArchetype(save.tiangangs);
      const bossArchName = ARCHETYPES.find((a) => a.id === boss.archetype)?.name ?? boss.archetype;
      let archLine: string;
      if (arch) {
        const m = archetypeMatchup(arch.id, boss.archetype);
        const rel = m === 'counter' ? '<b style="color:var(--club)">⮞ 克制 Boss</b>' : m === 'countered' ? '<b style="color:var(--heart)">⮜ 被 Boss 克</b>' : '<span class="ghost">≈ 互不克</span>';
        const act = activated === arch.id ? '　<b style="color:var(--gold)">🔥 招牌已激活</b>' : `　<span class="ghost">集齐 ${arch.keyTiangangs.map((k) => TIANGANG_BY_ID.get(k)?.name ?? k).join('+')} 激活招牌</span>`;
        archLine = `你的流派 <b>${arch.name}</b>（${arch.desc}）　${rel}${act}`;
      } else {
        archLine = `流派 <span class="ghost">未成型</span> —— 去<b>改造坊</b>融天罡牌确立身份（克制本 run Boss【${bossArchName}】）`;
      }
      const cap = effectiveLeverCap(save.planets);
      // B3: owned=已买入(ownedTiangangs)；inDeck=已选入战库(jokers ≤5)；buyable=未买且材料够
      const tiangangs: LobbyShopItem[] = GAME_G_TIANGANGS.map((j) => { const owned = save.ownedTiangangs.includes(j.id); return { id: j.id, name: j.name, sub: j.text, cost: j.cost, owned, inDeck: save.tiangangs.includes(j.id), buyable: !owned && save.materials >= j.cost, power: j.power, phat: j.phat }; });
      const planets: LobbyShopItem[] = GAME_G_PLANETS.map((p) => ({ id: p.id, name: p.name, sub: p.text, cost: p.cost, owned: false, level: save.planets[p.id] ?? 0, buyable: save.materials >= p.cost }));
      const foils: LobbyShopItem[] = GAME_G_FOILS.map((f) => { const owned = save.foils.includes(f.id); return { id: f.id, name: f.name, sub: f.desc, cost: f.cost, owned, buyable: !owned && save.materials >= f.cost }; });
      const heart = save.lives > 0 ? '❤'.repeat(save.lives) : '—';
      return {
        skin: lobbySkin, coin: save.materials, energy: save.leverEnergy, energyMax: cap, foilCount: save.foils.length,
        name: '不翻就赢_07', mainCard: '黑桃A「掷命尖兵」', rankText: `战役 ${save.stage}/${RUN_BATTLES}`,
        stageLabel: `第 ${save.stage} 战 / 共 ${RUN_BATTLES} · 终局 Boss【${boss.name}】`,
        archLine, bossLine: `${boss.persona} · 流派【${bossArchName}】— 据其针对布阵`,
        deckAvg: avg(save.deck), deckMin: Math.min(...save.deck), deckMax: Math.max(...save.deck), deck: save.deck,
        tiangangs, planets, foils,
        deckArchName: arch?.name ?? null, deckArchActivated: activated !== null,
        ladderLines: [
          `<h2>⚔️ 战役进度</h2><div class="bigrank">第 ${save.stage} / ${RUN_BATTLES} 战</div><div class="meta" style="margin-top:6px">命 ${heart} · 能量 ◈${save.leverEnergy}/${cap} · 材料 🪙${save.materials}</div>`,
          `<h2>🏆 终局 Boss</h2><div class="bigrank" style="color:var(--heart)">${boss.name}</div><div class="meta" style="margin-top:6px">${boss.persona} · 流派【${bossArchName}】</div>`,
        ],
      };
    };
    const buy = (cost: number, apply: () => void): void => { if (save.materials < cost) return; save.materials -= cost; apply(); persist(save); };
    lobby = mountLobby(host, {
      getView: buildLobbyView,
      onPlay: () => startBattle(),
      // B3: 买入 → ownedTiangangs；战库未满时自动选入（方便新手无需手动选）
      onBuyTiangang: (id) => { const j = TIANGANG_BY_ID.get(id); if (!j || save.ownedTiangangs.includes(id)) return; buy(j.cost, () => { save.ownedTiangangs.push(id); if (save.tiangangs.length < 5) save.tiangangs.push(id); }); },
      onBuyPlanet: (id) => { const p = GAME_G_PLANETS.find((x) => x.id === id); if (!p) return; buy(p.cost, () => { save.planets[id] = (save.planets[id] ?? 0) + 1; }); },
      onBuyFoil: (id) => { const f = GAME_G_FOILS.find((x) => x.id === id); if (!f || save.foils.includes(id)) return; buy(f.cost, () => save.foils.push(id)); },
      // B3: 选入/踢出战库（需已拥有；战库上限 5）
      onToggleTiangang: (id) => { if (!save.ownedTiangangs.includes(id)) return; const in5 = save.tiangangs.includes(id); if (in5) { save.tiangangs = save.tiangangs.filter((j) => j !== id); } else if (save.tiangangs.length < 5) { save.tiangangs.push(id); } persist(save); },
      onReset: () => { Object.assign(save, freshSave()); persist(save); },
      onSkin: (s) => { lobbySkin = s; },
    });
  }

  // ───────────────────────── 出征前置 · AI 暗布阵（showMatch 用）─────────────────────────
  // AI 暗布阵：纯逻辑下沉到 pickAiFormation（可测）；committed=玩家集齐招牌流派 → AI 全程反制攻你最弱一路。
  const aiFormation = (): Formation => pickAiFormation(save.stage, save.materials, save.lastOfficers, activeArchetype(save.tiangangs) !== null);

  // 出征：旧「布阵分兵 / 备战干预」两屏已废弃（CR 实时出牌模型：派路 + 干预改在战斗中实时做）→ 点出征直接进战斗。
  // 默认用上次布阵（初始均衡 10/10/10），开战前无预置干预。
  function startBattle(): void {
    const off = [...save.lastOfficers] as [number, number, number];
    showMatch({ officers: off }, describeFormation(off), []);
  }

  // ───────────────────────── 场间整备 · 三选一增益（roguelike 养成核 · 胜后短窗）─────────────────────────
  // 胜一场后进军前的短窗：三随机里选一项 → 选择即流派。池=资源增益 + **流派钥匙(白嫖未拥有小丑)**，
  // 后者把场间选择做成 StS/Balatro 式构筑分叉（design reply#10），不只 +stat。改后落存档、回大厅看下一战。
  function showBetween(nextLabel: string): void {
    clear();
    const title = el('div', 'font:600 18px system-ui;color:#22c55e', '🎉 战间整备 · 三选一');
    const sub = el('div', 'max-width:520px;text-align:center;opacity:.82;line-height:1.6',
      `胜一场！<b>${nextLabel}</b>前选<b>一项</b>——资源增益，或<b style="color:#c4b5fd">🃏流派钥匙</b>(白嫖天罡牌、定你的构筑分叉)。`);
    const pool: RunBuff[] = [...BETWEEN_BUFFS, ...tiangangKeyBuffs(save.tiangangs)]; // 资源增益 + 未拥有小丑钥匙
    const cardsBox = el('div', 'display:flex;gap:12px;justify-content:center;flex-wrap:wrap');
    cardsBox.replaceChildren(...pick3(pool).map((bf: RunBuff) => {
      const isKey = bf.kind === 'tiangang';
      const accent = isKey ? '#a78bfa' : '#22c55e';
      const card = el('div', `width:158px;padding:14px 10px;border:1px solid ${isKey ? '#4c1d95' : '#334155'};border-radius:10px;text-align:center;cursor:pointer;line-height:1.55;background:${isKey ? '#160f24' : '#10161f'}`,
        `<div style="font:600 15px system-ui;color:${isKey ? '#c4b5fd' : '#eab308'}">${bf.name}</div><div style="opacity:.85;font-size:12px;margin-top:6px">${bf.desc}</div>`);
      card.onmouseenter = () => { card.style.borderColor = accent; };
      card.onmouseleave = () => { card.style.borderColor = isKey ? '#4c1d95' : '#334155'; };
      card.onclick = () => { applyBuff(save, bf); persist(save); showLobby(); };
      return card;
    }));
    const skip = mkBtn('跳过，直接回大厅');
    skip.style.cssText += ';opacity:.6;font-size:11px';
    skip.onclick = showLobby;
    root.append(title, sub, cardsBox, skip);
  }

  // ───────────────────────── 出征（一局 · live-combat 实时三路行军）─────────────────────────
  // WIRE-MARCH：兵沿三路一格格慢慢爬（每 LIVE_STEP_MS 一拍）→ 最前两张相邻才翻牌成波对决 → 续航退场 →
  //   突破到敌 3 血老家先破者胜。胜负仍 outcome-first（live-combat 种子化、可回放）；battle-screen 只如实画真 slot 位置。
  function showMatch(formation: Formation, myName: string, interventions: Intervention[]): void {
    clear();
    const spec = battleSpec(save.stage - 1); // stage 1→战 0
    const boss = spec.boss ? bossFor(save.bossIdx) : null; // 终局 → 本 run 的牌王座
    const aiForm = boss ? boss.formation : aiFormation();
    const enemyBias = boss ? boss.favorBias : spec.enemyBias;
    const aiName = boss ? boss.name : describeFormation(aiForm.officers);
    // 战斗屏 = 设计稿三路战场（battle-screen，1280×720）。运行上下文(战次/命/Boss 台词)收进下方细条，不挡设计 HUD。
    const stage = document.createElement('div');
    // 占屏比更大（owner）：撑满容器宽（受 153vh 高约束保 16:9），battle-screen 内层用 container-query 随之缩放、不再锁 1280。
    stage.style.cssText = 'width:min(100%, 153vh);aspect-ratio:16 / 9;max-width:100%;margin:0 auto;border-radius:12px;overflow:hidden';
    const label = el('div', 'min-width:300px;text-align:center;font-weight:600;opacity:.85',
      `第 ${save.stage}/${RUN_BATTLES} 战 · ${spec.label} ｜ 命 ${'❤'.repeat(save.lives)} ｜ 你的阵 ${myName}${boss ? ` ｜ ⚔ ${boss.name}：「${boss.taunt}」` : ''}`);
    const back = mkBtn('← 返回大厅');
    back.onclick = showLobby;
    const bar = el('div', 'display:flex;gap:10px;align-items:center;max-width:1280px;flex-wrap:wrap;justify-content:center');
    bar.append(label, back);
    root.append(stage, bar);

    // 揭晓前完整编排（融天罡→玩家干预→Boss 起手→士气倍率+结局联动），与测试共用 prepareArmies、杜绝漂移；均 outcome-first。
    const { a, b } = prepareArmies({ formation, deckBias: myBias(save.deck), tiangangs: save.tiangangs, planets: save.planets, interventions, enemyForm: aiForm, enemyBias, boss });
    const oppPersona = boss ? boss.persona : '伺机而动 · 见招拆招';
    const oppSuit = suitOf(aiName);
    // 布局阶段 → 实时出牌（doc18 §10）：每路 base 打底（共 9）tick1 预铺，余牌洗成抽牌堆，起手摸 OPENING_HAND；
    // 战斗中实时从手牌派三路（live-combat 逐拍一格格爬、接敌对决、攻克 3 血老家）。替掉旧「54 张全 tick1 瞬铺」。
    const live = initLiveBattle(Math.floor(Math.random() * 1e9), HOME_BLOOD);
    const splitBaseDeck = (army: ArmyCard[]): { base: ArmyCard[]; deck: ArmyCard[] } => {
      const base: ArmyCard[] = [], deck: ArmyCard[] = [];
      for (const lane of [0, 1, 2]) { const lc = army.filter((c) => c.lane === lane); base.push(...lc.slice(0, BASE_PER_LANE)); deck.push(...lc.slice(BASE_PER_LANE)); }
      return { base, deck };
    };
    const seededShuffle = <T,>(xs: T[], seed: number): T[] => { // 确定性洗牌（mulberry32 · 抽序可回放、不破 outcome-first）
      const arr = [...xs]; let t = seed >>> 0;
      const rnd = (): number => { t += 0x6d2b79f5; let x = t; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      return arr;
    };
    const aSplit = splitBaseDeck(a), bSplit = splitBaseDeck(b);
    const aDeck = seededShuffle(aSplit.deck, live.rng.seed ^ 0x9e37);
    const bDeck = seededShuffle(bSplit.deck, live.rng.seed ^ 0x51ed); // 敌抽牌堆（滴投顺序确定）
    const aHand: ArmyCard[] = aDeck.splice(0, OPENING_NORMAL); // 起手普通手牌（CR 起手 4）
    const deploys: DeployCmd[] = [
      ...aSplit.base.map((c): DeployCmd => ({ tick: 1, side: 'a', lane: c.lane, unit: toUnit(c) })),
      ...bSplit.base.map((c): DeployCmd => ({ tick: 1, side: 'b', lane: c.lane, unit: toUnit(c) })),
    ];
    // CR 出牌控盘运行时态（doc21）：普通/天罡手牌 + 选中 + 点数池（圣水·浮点·真实时间回复）。
    let selectedCard = -1, selectedTengang = -1;
    let migrateSource = -1; // 三路兵力迁移：已选的迁出路（-1 无·无选中牌时点路 = 迁移模式）
    let points = POINTS_START;
    // 天罡库（法术·≤5·读 save.tiangangs 契约②）：cycle 队列 —— 摸牌从库顶取、施法回库底；cap5 打掉才补。
    const tDeck: { id: string; name: string }[] = save.tiangangs.map((id) => ({ id, name: TIANGANG_BY_ID.get(id)?.name ?? id }));
    const tHand: { id: string; name: string }[] = [];
    const castIds = new Set<string>(); // A-JOKER：已施天罡集（施法即加入 → 聚合持续修正 live.tengangA·一种算一次）
    let aiNext = bDeck.length ? AI_PERIOD_TICKS : Infinity; // 敌下次滴投拍
    const canDrawNormal = (): boolean => live.winner === 'pending' && canDrawFrom(points, NORMAL_DRAW_COST, aHand.length, NORMAL_HAND_CAP + live.tengangA.handMaxAdd, aDeck.length);
    const canDrawTengang = (): boolean => live.winner === 'pending' && canDrawFrom(points, TENGANG_DRAW_COST, tHand.length, TENGANG_CAP, tDeck.length);
    const control = (): BattleControl => ({
      hand: aHand.map((c): HandCardView => ({ id: c.id, rank: cardRank(c), suit: c.suit.toLowerCase() as 's' | 'h' | 'd' | 'c', general: c.general })),
      selectedCard, deckCount: aDeck.length,
      tengang: tHand.map((c): TengangCardView => ({ id: c.id, name: c.name })), selectedTengang, tengangDeckCount: tDeck.length,
      points, pointsMax: POINTS_MAX, normalDrawCost: NORMAL_DRAW_COST, tengangDrawCost: TENGANG_DRAW_COST, canDrawNormal: canDrawNormal(), canDrawTengang: canDrawTengang(), migrateSource,
    });
    let prevPos = snapLivePos(live); // 真拍间插值锚（渲染层据此平滑滑行）
    let frac = 1;
    // 对决特写表演队列（owner：每场对决拉到屏幕前·看为什么胜败）：每拍新生对决进队，逐个冻结战场演 PERF_MS。
    const perfQueue: ClashEvent[] = [];
    let perfClash: ClashEvent | null = null;
    let perfUntil = 0;
    let drained = 0; // 已收进特写队列的 clashLog 下标
    // ── A6 死亡闪帧 + A2 出牌啪嗒：板上瞬时特效（纯表现·不进 sim/hash）──
    const FX_MS = 640; // 特效寿命（ms）
    interface FxItem { kind: 'death' | 'deploy'; lane: number; side: 'a' | 'b'; pos01: number; rank?: string; suit?: 's' | 'h' | 'd' | 'c'; general?: boolean; born: number }
    const boardFx: FxItem[] = [];
    const deathPosByEv = new Map<ClashEvent, number>(); // 对决事件 → 败者阵亡处 pos01（特写演完落到板上斩残影）
    let lastUnitIds = new Set<string>(); // 上一拍在场牌 id（本拍新出现 = 刚投放 → 啪嗒）
    let heldClash: ClashEvent | null = null; // 已定格渲染的特写：演出期间不每帧重画 → CSS 3D 翻转/掷点动画得以播完（不再每 33ms 重启卡在起手）
    const lc = (s: string): 's' | 'h' | 'd' | 'c' => s.toLowerCase() as 's' | 'h' | 'd' | 'c';
    const actions: BattleActions = {
      selectCard: (i) => { selectedCard = i === selectedCard ? -1 : i; selectedTengang = -1; migrateSource = -1; }, // 二选一：选普通清天罡，并退出迁移模式
      selectTengang: (i) => { selectedTengang = i === selectedTengang ? -1 : i; selectedCard = -1; migrateSource = -1; },
      playLane: (lane) => { // 选中普通=部署 / 选中天罡=施法 / 无选中=三路兵力迁移（点首路=迁出、点次路=迁入）
        if (live.winner !== 'pending') return;
        if (selectedCard >= 0 && selectedCard < aHand.length) { // 部署慢行军（落点玩家自选·非牌原路）
          const c = aHand.splice(selectedCard, 1)[0];
          deploys.push({ tick: live.tick + 1, side: 'a', lane, unit: toUnit(c) });
          selectedCard = -1;
        } else if (selectedTengang >= 0 && selectedTengang < tHand.length) { // 施天罡法术（A-JOKER）：施其效果(持续战斗修正) + 消耗回库底(cycle·解锁再摸)
          const c = tHand.splice(selectedTengang, 1)[0];
          tDeck.push(c);
          castIds.add(c.id); live.tengangA = aggregateTengang([...castIds]); // 施法 → 持续修正生效（一种牌算一次·不叠）
          selectedTengang = -1;
        } else { // 迁移模式（无选中牌）：先点迁出路（须有后备）→ 再点迁入路 → 搬队尾后备一张
          if (migrateSource < 0) { if (live.lanes[lane].a.length > 0) migrateSource = lane; }
          else if (lane === migrateSource) { migrateSource = -1; } // 再点取消
          else { migrateRear(live, 'a', migrateSource, lane); migrateSource = -1; }
        }
      },
      drawNormal: () => { if (canDrawNormal()) { points -= NORMAL_DRAW_COST; aHand.push(aDeck.shift()!); } }, // 花点数摸普通库
      drawTengang: () => { if (canDrawTengang()) { points -= TENGANG_DRAW_COST; tHand.push(tDeck.shift()!); } }, // 花点数摸天罡库（cap5·打掉才补）
    };
    battle = mountBattle(stage, () => {
      const now = performance.now();
      for (let i = boardFx.length - 1; i >= 0; i--) if (now - boardFx[i].born >= FX_MS) boardFx.splice(i, 1); // 过期清理
      const fxv: BattleFx[] = boardFx.map((f) => ({ kind: f.kind, lane: f.lane, side: f.side, pos01: f.pos01, rank: f.rank, suit: f.suit, general: f.general, t: Math.min(1, (now - f.born) / FX_MS) }));
      const v = buildBattleViewLive(live, save, aiName, oppPersona, oppSuit, control(), perfClash ? clashToView(perfClash) : null, fxv);
      for (const u of v.units) { const cur = u.pos01 * LANE_LEN; const prev = prevPos.has(u.id) ? prevPos.get(u.id)! : cur; u.pos01 = (prev + (cur - prev) * frac) / LANE_LEN; } // lerp 上一拍→当拍
      return v;
    }, actions);

    let settled = false;
    let last = 0, acc = 0, lastRender = 0, raf = 0;
    const settle = (): void => {
      settled = true;
      frac = 1; // 落定帧滑到真·终位（不停在插值中途）
      if (battle) battle.update(); // 落定那帧定格最终态
      const survA = live.lanes.reduce((s, L) => s + L.a.length + L.spentA, 0); // 我方幸存(在场+续航尽退场) = 战利品
      const lanesA = live.lanes.filter((L) => L.a.length + L.spentA > L.b.length + L.spentB).length; // 净控路数（督粮/战况）
      const lanesB = live.lanes.filter((L) => L.b.length + L.spentB > L.a.length + L.spentA).length;
      const homeA = live.homeA, homeB = live.homeB, winner = live.winner;
      const gain = survA + (winner === 'a' ? 15 : 0);
      save.materials += gain;
      let tail = '';
      let route: () => void = showLobby; // 结算后"继续"去向
      let cont = '回大厅';
      if (winner === 'a') {
        save.leverEnergy = Math.min(effectiveLeverCap(save.planets), save.leverEnergy + effectiveLeverRegen(save.planets)); // 回能◈（星球·能 升档）
        if (save.stage >= RUN_BATTLES) { // 打穿终局 Boss → 通关
          save.materials += 50;
          tail = '🏆 <b>通关战役！</b>（+50 材料）回大厅开新战役';
          save.stage = 1; save.lives = effectiveLives(save.planets); save.bossIdx = rollBoss(); // 新 run：命线读星球·命、轮换 Boss
        } else { // 胜非终局 → 进军 + 场间三选一养成窗
          save.stage += 1;
          tail = `进军 第 ${save.stage}/${RUN_BATTLES} 战`;
          cont = '战间整备（三选一）';
          const nl = `进军第 ${save.stage} 战`;
          route = () => showBetween(nl);
        }
      } else { // 败/平 → 扣命
        save.lives -= 1;
        if (save.lives <= 0) { tail = '💀 <b>命尽，战役结束</b> 回大厅重整'; save.stage = 1; save.lives = effectiveLives(save.planets); save.bossIdx = rollBoss(); } // 新 run：命线读星球·命、轮换 Boss
        else { tail = `命 −1（剩 ${save.lives}）重整旗鼓再战本场`; cont = '重整再战'; route = startBattle; }
      }
      const qm = quartermasterEnergy(save.tiangangs, lanesA); // 督粮：每胜一路 +◈ 入下场 run 能量（post-resolve）
      if (qm > 0) { save.leverEnergy = Math.min(effectiveLeverCap(save.planets), save.leverEnergy + qm); tail += `（督粮 +${qm}◈）`; }
      persist(save);
      const who = winner === 'a' ? '我方胜（攻克敌老家）' : winner === 'b' ? '敌方胜（我老家被破）' : '平局（无人破家）';
      const color = winner === 'a' ? '#eab308' : winner === 'b' ? '#94a3b8' : '#cbd5e1';
      label.innerHTML = `<span style="color:${color}">${who}</span> ｜ 控路 ${lanesA}:${lanesB} ｜ 老家 我${homeA}/敌${homeB}（满${HOME_BLOOD}）｜ 敌阵【${aiName}】 ｜ +${gain} 材料 ｜ ${tail}`;
      back.textContent = `→ ${cont}`;
      back.onclick = route;
    };
    // rAF 实时驱动（CR 纯实时·无暂停·doc21）：点数(圣水)随真实时间回复；每 LIVE_STEP_MS 走一拍（一格格爬）+ 敌滴投；
    // 渲染 ~30fps 按 frac 平滑；演对决特写时世界静止（点数/sim 皆冻）；落定即结算、停步。
    const loop = (ts: number): void => {
      if (last === 0) last = ts;
      const dt = ts - last; last = ts;
      // 对决特写：演完(到 PERF_MS)收场；空闲且队列有 → 取下一场冻结战场演（sim 此刻不推进）。
      if (perfClash && ts >= perfUntil) { // 收场 → 败者落到板上一记斩残影（A6·延续 overlay→棋盘，不再凭空消失）
        const loser = perfClash.aWins ? perfClash.b : perfClash.a;
        boardFx.push({ kind: 'death', lane: perfClash.lane, side: perfClash.aWins ? 'b' : 'a', pos01: deathPosByEv.get(perfClash) ?? 0.5, rank: loser.rank, suit: lc(loser.suit), general: loser.general, born: performance.now() });
        deathPosByEv.delete(perfClash);
        perfClash = null;
      }
      if (!perfClash && perfQueue.length) { perfClash = perfQueue.shift()!; perfUntil = ts + PERF_MS; acc = 0; }
      if (!perfClash) { // 无特写在演 → 点数回复 + 推进（CR 纯实时·无暂停）
        if (!settled && live.winner === 'pending') {
          points = Math.min(POINTS_MAX, points + dt / POINTS_REGEN_MS); // 圣水随真实时间回复（演特写=世界静止时不回）
          acc += dt;
          if (acc > LIVE_STEP_MS * 3) acc = LIVE_STEP_MS; // 切后台回来防暴冲
          if (acc >= LIVE_STEP_MS) {
            prevPos = snapLivePos(live);
            const frontA = live.lanes.map((L) => L.a[0]?.id), frontB = live.lanes.map((L) => L.b[0]?.id); // 步进前各路前锋（阵亡处定位用）
            stepLiveBattle(live, deploys);
            acc -= LIVE_STEP_MS;
            const newClashes = live.clashLog.slice(drained); drained = live.clashLog.length; // 本拍新生对决（驱动特写 + 斩残影）
            for (const ev of newClashes) { // → 进特写队列 + 记下败者阵亡 pos01（步进前前锋位，特写演完落到板上斩残影）
              perfQueue.push(ev);
              const loserId = ev.aWins ? frontB[ev.lane] : frontA[ev.lane];
              if (loserId !== undefined && prevPos.has(loserId)) deathPosByEv.set(ev, prevPos.get(loserId)! / LANE_LEN);
            }
            // A2 出牌啪嗒：本拍新出现的牌(非起手 tick1 预铺) = 刚投放/滴投 → 入场环（己橙/敌蓝），点选派路看得见反馈。
            if (live.tick > 1) for (const li of [0, 1, 2]) {
              for (const u of live.lanes[li].a) if (!lastUnitIds.has(u.id)) boardFx.push({ kind: 'deploy', lane: li, side: 'a', pos01: u.pos / LANE_LEN, suit: lc(u.suit), general: u.general, born: performance.now() });
              for (const u of live.lanes[li].b) if (!lastUnitIds.has(u.id)) boardFx.push({ kind: 'deploy', lane: li, side: 'b', pos01: u.pos / LANE_LEN, suit: lc(u.suit), general: u.general, born: performance.now() });
            }
            lastUnitIds = new Set<string>();
            for (const li of [0, 1, 2]) { for (const u of live.lanes[li].a) lastUnitIds.add(u.id); for (const u of live.lanes[li].b) lastUnitIds.add(u.id); }
            // 抽牌改 CR（doc21 §四 · A1 superseded）：玩家花点数主动摸牌（drawNormal/drawTengang），不再底流/事件被动涌牌。
            if (live.tick >= aiNext && bDeck.length) { const c = bDeck.shift()!; deploys.push({ tick: live.tick + 1, side: 'b', lane: c.lane, unit: toUnit(c) }); aiNext = live.tick + AI_PERIOD_TICKS; } // 敌滴投入该牌原路（随阵型）
            if (live.winner === 'pending' && !liveActive(live)) live.winner = live.homeB < live.homeA ? 'a' : live.homeA < live.homeB ? 'b' : 'draw'; // 两军互清无突破 → 比残血定（同 runLiveBattle 收尾）
          }
          frac = Math.max(0, Math.min(1, acc / LIVE_STEP_MS));
        }
      }
      if (battle) { // 渲染：特写演出期间「定格一次」(CSS 3D 翻转/掷点/滑入动画一次播完·不每 33ms 重建 DOM 把它们重启卡在起手)；其余 ~30fps 平滑
        if (perfClash) { if (perfClash !== heldClash) { battle.update(); heldClash = perfClash; lastRender = ts; } }
        else { if (ts - lastRender >= RENDER_MS) { battle.update(); lastRender = ts; } heldClash = null; }
      }
      if (!settled && live.winner !== 'pending' && !perfClash && perfQueue.length === 0) { settle(); return; } // 等特写全演完才结算（最后几场对决也演出来）
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    stopLoop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; settled = true; };
  }

  showLobby();
  return () => {
    teardownMatch();
    root.remove();
  };
}

function el(tag: string, css: string, html = ''): HTMLElement {
  const e = document.createElement(tag);
  e.style.cssText = css;
  e.innerHTML = html;
  return e;
}
function mkBtn(text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  b.style.cssText = 'padding:8px 13px;border-radius:8px;border:1px solid #334155;background:#15202b;color:#e2e8f0;cursor:pointer;font:12px system-ui';
  return b;
}
