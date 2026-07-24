// game101 ·《海港绯闻》—— 配置表（数据）+ 派生（merge 规则 / 物品 prefab 模板）。
//
// 数据驱动铁律：本文件只做「JSON 配置 → 引擎数据结构」的**纯派生**（无玩法逻辑、无随机、无自由代码）。
// 所有玩法内容来自 config/*.json（GD-101 立项档 config-schema.md 的落地）；解释权归现有引擎能力。
//
// ⚠ 接线状态（capability-plan §6 Lead 已过审 2026-07-23）：本 M1a groundwork 落未涉门能力面——
//   merge-rule（合并链）/ f1-resource（体力/金币/星星/经验）/ over-time（体力恢复）/ prefab（物品模板）。
//   G1 生成器按 §6 组合接线经源码复核撞墙（加权运行时 spawn 无引擎原语）→ 报引擎池
//   docs/workflow/requests.md REQ-TAPSPAWN；generators.json 已备·待该能力落地再接线。G2/G3=后续 slice。
import gameCfg from './config/game.json';
import chainsCfg from './config/chains.json';
import energyCfg from './config/energy.json';

// ── 类型（config 结构的 TS 视图·只读）─────────────────────────────────────────
export interface ChainLevel { lvl: number; item: string; name: string; sell: number; sprite: string }
export interface Chain { id: string; name: string; levels: ChainLevel[] }

export const GAME = gameCfg;
export const CHAINS = chainsCfg as Chain[];
export const ENERGY = energyCfg;

// ── 模拟频率（引擎固定步长 60Hz·Engine 默认 tickRate）→ 秒换算 tick。─────────
export const TICKS_PER_SEC = 60;
export const ENERGY_REGEN_TICKS = ENERGY.regenIntervalSec * TICKS_PER_SEC;

// ── 资源 id（f1-resource）──────────────────────────────────────────────────────
export const RES = { energy: 'energy', coins: 'coins', stars: 'stars', exp: 'exp' } as const;

// ── Tag 位（合并板物品）────────────────────────────────────────────────────────
export const ITEM = 1 << 0;

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
