// game101 ·《海港绯闻》—— 配置表（数据）+ 派生（merge 规则 / 物品 prefab 模板）。
//
// 数据驱动铁律：本文件只做「JSON 配置 → 引擎数据结构」的**纯派生**（无玩法逻辑、无随机、无自由代码）。
// 所有玩法内容来自 config/*.json（GD-101 立项档 config-schema.md 的落地）；解释权归现有引擎能力。
//
// ⚠ 接线状态（capability-plan §6 Lead 已过审 2026-07-23）：
//   已接（S4 可玩核）：merge-rule 自动合并 / f1-resource / over-time 体力恢复 / prefab 物品库 /
//     生成器点击产出（clickable+craft-recipe 耗体力+event-when+caster **固定产出**·非加权）。
//   缺口（引擎/主程域·非 PE）：①加权掉落 `weighted-spawn`（⏸缓建·owner 定 M1 不急）→ 生成器暂固定产出；
//     ②真·拖拽合并 `merge-on-place`（拖同类才合·现无能力）→ 报 requests.md REQ-MERGE-ON-PLACE，暂用自动合并。
import gameCfg from './config/game.json';
import chainsCfg from './config/chains.json';
import energyCfg from './config/energy.json';
import generatorsCfg from './config/generators.json';
import ordersCfg from './config/orders.json';
import boardCoverCfg from './config/board-cover.json';
import bubblesCfg from './config/bubbles.json';
import progressionCfg from './config/progression.json';

// ── 类型（config 结构的 TS 视图·只读）─────────────────────────────────────────
export interface ChainLevel { lvl: number; item: string; name: string; sell: number; sprite: string }
export interface Chain { id: string; name: string; levels: ChainLevel[] }

export interface GeneratorDef {
  id: string; name: string; energyCost: number; cooldownSec: number;
  sprite: string; cell: number; emoji: string; dropTable: { item: string; w: number }[];
}

export interface OrderReward { coins: number; exp?: number; stars?: number }
export interface OrderDef {
  id: string; char: string; needItems: string[]; // 各 slot 要的模板 id（顺序即 slot 序·最多 3）
  reward: OrderReward;
  timed?: boolean; // 限时特惠订单：卡上显示 ⏱ 倒计时（菜单 Timer 驱动·循环刷新）
  // 续单池（REQ-ORDERROT·①订单轮换）：集齐后按 sequence 环回取下一单（needItems/reward 全替换）。
  // 递进升级 + 循环 → 顾客满足后换新需求，不再重复同单（解「循环空转」）。缺省无池=重复本单。
  pool?: { needItems: string[]; reward: OrderReward }[];
}

// ── 挖掘阻碍层（board-cover·REQ-101-08·merge-proximity-clear）───────────────────
export interface CoverCell { cell: number; layers: number; reveal: { kind: 'item' | 'energy' | 'gem' | 'chest' | 'gen'; item?: string; amount?: number } }
export interface BoardCover { coverSprite: string; decPerMerge: number; radius: number; cells: CoverCell[] }
export const BOARD_COVER = boardCoverCfg as BoardCover;
// 友好 reveal.kind → 引擎 Blocker.reveal 通用形（item→spawn·energy/gem/chest→resource）。gem→星星·chest→金币包。
// gen=解锁生成器：清层即 no-op（挖开后 readState 见该格未覆盖→自动摆出生成器），发 0 exp 占位。
export function coverReveal(rv: CoverCell['reveal']): { kind: 'spawn' | 'resource'; templateId?: string; resourceId?: string; amount?: number } {
  switch (rv.kind) {
    case 'item': return { kind: 'spawn', templateId: rv.item };
    case 'energy': return { kind: 'resource', resourceId: 'energy', amount: rv.amount ?? 0 };
    case 'gem': return { kind: 'resource', resourceId: 'stars', amount: rv.amount ?? 0 };
    case 'chest': return { kind: 'resource', resourceId: 'coins', amount: rv.amount ?? 0 };
    case 'gen': return { kind: 'resource', resourceId: 'exp', amount: 0 };
  }
}

export const GAME = gameCfg;
export const CHAINS = chainsCfg as Chain[];
export const ENERGY = energyCfg;
export const GENERATORS = generatorsCfg as GeneratorDef[];
export const ORDERS = ordersCfg as OrderDef[];

// 生成器固定产出（weighted-spawn 缓建前）：取掉落表首项（最高权重档）。weighted-spawn 落地后改吃全表。
export function generatorOutput(g: GeneratorDef): string { return g.dropTable[0].item; }

// ── 顾客满意度（心情）：每完成一单 +1·满 ORDER_SAT_MAX 即最开心。资源化·order-fulfill 发奖时涨。──
export const ORDER_SAT_MAX = 5;
// 满意度分数 → 心情脸（0..max·越交越开心）。纯派生·无逻辑。
export function moodFace(sat: number): string {
  const faces = ['😐', '🙂', '😊', '😄', '😍'];
  const i = Math.max(0, Math.min(faces.length - 1, Math.round((sat / ORDER_SAT_MAX) * (faces.length - 1))));
  return faces[i];
}

// ── 模拟频率（引擎固定步长 60Hz·Engine 默认 tickRate）→ 秒换算 tick。─────────
export const TICKS_PER_SEC = 60;

// ── 限时鲜货（物件级倒计时·owner 基准需求 ui-brief §4.2）：带 id='life' 的 Timer·到期 lifetime 销毁。──
export const TIMED_SEC = 20; // 限时物存活秒数（到 0 自毁）
export const TIMED_ITEM = 'timed_fresh';
export const MENU_TIMER_SEC = 30; // 限时特惠订单倒计时周期（循环刷新·菜单 Timer）

// 顾客立绘（asset-manager 2026-07-25 vendor 的 CC0 头像·public served·顾客卡背景图层·美术就绪即换）。
export const CUST_PORTRAITS = [
  '/games/game101/art/superpowers/ninja-adventure/characters/faceset/1.png',
  '/games/game101/art/superpowers/ninja-adventure/characters/faceset/5.png',
  '/games/game101/art/superpowers/ninja-adventure/characters/faceset/12.png',
];
export const ENERGY_REGEN_TICKS = ENERGY.regenIntervalSec * TICKS_PER_SEC;

// ── 资源 id（f1-resource）──────────────────────────────────────────────────────
export const RES = { energy: 'energy', coins: 'coins', stars: 'stars', exp: 'exp' } as const;

// ── Tag 位（合并板物品 / 生成器）──────────────────────────────────────────────
export const ITEM = 1 << 0;
export const GEN_TAG = 1 << 1;
export const BUBBLE_TAG = 1 << 2; // 泡泡锁实体位（点破扣币→spawn 真物·merge 天然不碰）
export const STARLOCK_TAG_BASE = 3; // 星锁区 Tag 位起点：里程碑 i 用 1 << (STARLOCK_TAG_BASE + i)（marker 实体·非 Blocker·免被挖掘误减）

export interface BubbleDef { id: string; cell: number; item: string; cost: number }
export const BUBBLES = bubblesCfg as BubbleDef[];

// ── 进度推进（②·一关进度弧：攒星 → 里程碑解锁新区 → 达标关卡完成）──────────────────
export interface MilestoneDef { id: string; atStars: number; label: string; cells: number[] }
export interface ProgressionDef { goalStars: number; milestones: MilestoneDef[] }
export const PROGRESSION = progressionCfg as ProgressionDef;
export const LEVEL_DONE_FLAG = 'level_done';
export function milestoneTag(i: number): number { return 1 << (STARLOCK_TAG_BASE + i); }
export const GEN_TINT = 0xc8871e; // 生成器格占位色（暖金·美术就绪即被 gen sprite 皮盖过）

// ── 棋盘几何（世界像素·占位灰盒·M1b 接 UI 时以 layout 稿为准）──────────────────
export const CELL = 96;
export const BOARD_PAD = 48;
export const BOARD_W = GAME.board.cols * CELL;
export const BOARD_H = GAME.board.rows * CELL;
export const FIELD_W = BOARD_W + BOARD_PAD * 2;
export const FIELD_H = BOARD_H + BOARD_PAD * 2;

// 物品格坐标（authoring 期确定性铺格·无随机）：按行优先给第 i 个物品一个格中心（居中留边）。
export function cellCenter(i: number): { x: number; y: number } {
  const col = i % GAME.board.cols;
  const row = Math.floor(i / GAME.board.cols);
  return { x: BOARD_PAD + col * CELL + CELL / 2, y: BOARD_PAD + row * CELL + CELL / 2 };
}
// 世界坐标 → 格 index（cellCenter 逆运算·活板投影用）。越界返回 -1。
export function cellIndexOf(x: number, y: number): number {
  const col = Math.round((x - BOARD_PAD - CELL / 2) / CELL);
  const row = Math.round((y - BOARD_PAD - CELL / 2) / CELL);
  if (col < 0 || col >= GAME.board.cols || row < 0 || row >= GAME.board.rows) return -1;
  return row * GAME.board.cols + col;
}

// ── 链主色（灰盒占位观感·美术就绪即被 Sprite 皮肤盖过）────────────────────────
const CHAIN_TINT: Record<string, number> = {
  food: 0xff6b6b, fish: 0x4da6ff, fries: 0xf4c04d, coffee: 0xa9744f, tool: 0x9b8cff,
};
// 越高级越亮（每级向白靠拢）——合并升级视觉可辨。
function levelTint(base: number, lvl: number, maxLvl: number): number {
  const t = Math.min(1, (lvl - 1) / Math.max(1, maxLvl - 1)) * 0.55;
  const mix = (c: number): number => Math.round(c + (255 - c) * t);
  const r = (base >> 16) & 0xff, g = (base >> 8) & 0xff, b = base & 0xff;
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

// ── 物品占位 emoji（Twemoji 活板显示·美术就绪即被 sprite 皮盖过）──────────────
// 每条链每级一个 emoji·体现升级进程（真原创套图走 S6 台账皮肤槽替换）。
// 每条链=**连贯的食物进化**（owner 2026-07-25：从小到大·稻谷→面包→蛋糕这种，别放刀/工具这种非食物）。
export const ITEM_EMOJI: Record<string, string> = {
  // 粮食链（9 级）：稻谷 → 米饭 → 面包 → 可颂 → 蛋糕 → 华丽蛋糕 → 派 → 圣代 → 盛宴
  food_1: '🌾', food_2: '🍚', food_3: '🍞', food_4: '🥐', food_5: '🍰', food_6: '🎂', food_7: '🥧', food_8: '🍨', food_9: '🍽️',
  // 渔获链（9 级）：小鱼 → 鲜鱼 → 虾 → 寿司 → 鱼板 → 海鲜便当 → 炸虾 → 关东煮 → 海鲜锅
  fish_1: '🐟', fish_2: '🐠', fish_3: '🦐', fish_4: '🍣', fish_5: '🍥', fish_6: '🍱', fish_7: '🍤', fish_8: '🍢', fish_9: '🫕',
  // 蔬果链（7 级）：土豆 → 胡萝卜 → 沙拉 → 蔬菜煲 → 玉米 → 炖菜 → 咖喱
  fries_1: '🥔', fries_2: '🥕', fries_3: '🥗', fries_4: '🥘', fries_5: '🌽', fries_6: '🍲', fries_7: '🍛',
  // 饮品链（8 级）：咖啡豆 → 咖啡 → 拿铁 → 冰饮 → 奶茶 → 果汁 → 花茶 → 鸡尾酒
  coffee_1: '🫘', coffee_2: '☕', coffee_3: '🥛', coffee_4: '🥤', coffee_5: '🧋', coffee_6: '🧃', coffee_7: '🍵', coffee_8: '🍹',
  // 甜点链（8 级）：巧克力 → 糖果 → 甜甜圈 → 纸杯蛋糕 → 华夫饼 → 棒棒糖 → 曲奇 → 蜜罐
  tool_1: '🍫', tool_2: '🍬', tool_3: '🍩', tool_4: '🧁', tool_5: '🧇', tool_6: '🍭', tool_7: '🍪', tool_8: '🍯',
  timed_fresh: '🦀', // 限时鲜货（带倒计时·到期自毁）
};

// ── 全部物品级的索引（item id → {chain, level 数据}）──────────────────────────
export interface ItemDef extends ChainLevel { chainId: string }
export const ITEMS: Record<string, ItemDef> = (() => {
  const out: Record<string, ItemDef> = {};
  for (const c of CHAINS) for (const lv of c.levels) out[lv.item] = { ...lv, chainId: c.id };
  return out;
})();

// ── 派生 1：merge 规则（每链每级一条 need:2 into 次级；最高级不写规则=封顶）──────
export interface MergeRuleDef { template: string; need: number; into: string }
export function mergeRules(): MergeRuleDef[] {
  const rules: MergeRuleDef[] = [];
  for (const c of CHAINS) {
    for (let i = 0; i < c.levels.length - 1; i++) {
      rules.push({ template: c.levels[i].item, need: GAME.mergeNeed, into: c.levels[i + 1].item });
    }
  }
  return rules;
}

// ── 派生 2：物品 prefab 模板（每个物品级一个单实体模板·带皮肤槽 Sprite）─────────
// prefab 展开时自动盖 PrefabOrigin 戳 → merge-rule 按 templateId 计数合成。
export interface PrefabTemplateData { entities: Record<string, Record<string, unknown>> }

// ── 限时鲜货模板（物件级倒计时）：body 带 id='life' 的 Timer → timer-advance 每拍 +1·到 duration 发 TimerDone
//    → lifetime 销毁。纯能力组合（timer + lifetime）·游戏层零计时逻辑。
export function timedTemplates(): Record<string, PrefabTemplateData> {
  return {
    [TIMED_ITEM]: {
      entities: {
        body: {
          Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          Tag: { flags: ITEM },
          Shape: { kind: 'box', width: CELL - 12, height: CELL - 12 },
          Sprite: { textureKey: 'item_timed_fresh', anchorX: 0.5, anchorY: 0.5, zOrder: 1 }, // 皮肤槽
          Color: { tint: 0xff8a3c, alpha: 1 },
          Timer: { id: 'life', elapsed: 0, duration: TIMED_SEC * TICKS_PER_SEC, loop: false }, // 到期 lifetime 销毁
        },
      },
    },
  };
}

export function itemTemplates(): Record<string, PrefabTemplateData> {
  const out: Record<string, PrefabTemplateData> = {};
  for (const def of Object.values(ITEMS)) {
    const maxLvl = CHAINS.find((c) => c.id === def.chainId)!.levels.length;
    const tint = levelTint(CHAIN_TINT[def.chainId] ?? 0x888888, def.lvl, maxLvl);
    out[def.item] = {
      entities: {
        body: {
          Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          Tag: { flags: ITEM },
          Shape: { kind: 'box', width: CELL - 12, height: CELL - 12 },
          Sprite: { textureKey: def.sprite, anchorX: 0.5, anchorY: 0.5, zOrder: 1 }, // 皮肤槽·Twemoji/原创套图就绪即换装
          Color: { tint, alpha: 1 }, // 灰盒占位色（链色×等级亮度）·美术就绪即被皮肤盖过
        },
      },
    };
  }
  return out;
}
