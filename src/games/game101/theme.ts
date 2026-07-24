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

// ── 类型（config 结构的 TS 视图·只读）─────────────────────────────────────────
export interface ChainLevel { lvl: number; item: string; name: string; sell: number; sprite: string }
export interface Chain { id: string; name: string; levels: ChainLevel[] }

export interface GeneratorDef {
  id: string; name: string; energyCost: number; cooldownSec: number;
  sprite: string; cell: number; emoji: string; dropTable: { item: string; w: number }[];
}

export interface OrderDef {
  id: string; char: string; needItem: string; qty: number;
  reward: { coins: number; exp?: number; stars?: number };
}

export const GAME = gameCfg;
export const CHAINS = chainsCfg as Chain[];
export const ENERGY = energyCfg;
export const GENERATORS = generatorsCfg as GeneratorDef[];
export const ORDERS = ordersCfg as OrderDef[];

// 生成器固定产出（weighted-spawn 缓建前）：取掉落表首项（最高权重档）。weighted-spawn 落地后改吃全表。
export function generatorOutput(g: GeneratorDef): string { return g.dropTable[0].item; }

// ── 模拟频率（引擎固定步长 60Hz·Engine 默认 tickRate）→ 秒换算 tick。─────────
export const TICKS_PER_SEC = 60;
export const ENERGY_REGEN_TICKS = ENERGY.regenIntervalSec * TICKS_PER_SEC;

// ── 资源 id（f1-resource）──────────────────────────────────────────────────────
export const RES = { energy: 'energy', coins: 'coins', stars: 'stars', exp: 'exp' } as const;

// ── Tag 位（合并板物品 / 生成器）──────────────────────────────────────────────
export const ITEM = 1 << 0;
export const GEN_TAG = 1 << 1;
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
export const ITEM_EMOJI: Record<string, string> = {
  food_1: '🍅', food_2: '🥗', food_3: '🔪', food_4: '🥫', food_5: '🍝', food_6: '🍽️',
  fish_1: '🐟', fish_2: '🐠', fish_3: '🍣', fish_4: '🍤', fish_5: '🐡', fish_6: '🍱',
  fries_1: '🥔', fries_2: '🍠', fries_3: '🍟', fries_4: '🍱',
  coffee_1: '🫘', coffee_2: '☕', coffee_3: '☕', coffee_4: '🥛', coffee_5: '🥤',
  tool_1: '🔩', tool_2: '🔧', tool_3: '🧰', tool_4: '🪫', tool_5: '🛠️',
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
