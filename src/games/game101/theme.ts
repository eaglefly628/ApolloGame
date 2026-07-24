// game101 ·《海港绯闻》—— 配置表（数据）+ 派生（merge 规则 / 物品 prefab 模板）。
//
// 数据驱动铁律：本文件只做「JSON 配置 → 引擎数据结构」的**纯派生**（无玩法逻辑、无随机、无自由代码）。
// 所有玩法内容来自 config/*.json（GD-101 立项档 config-schema.md 的落地）；解释权归现有引擎能力。
//
// ⚠ 门禁范围（REQ-101-01 前置门·未过审）：本 M1a groundwork 只落**未涉门的**能力面——
//   merge-rule（合并链）/ f1-resource（金币·星星·经验·体力）/ over-time（体力恢复）/ prefab（物品模板）。
//   §2.5 缺口 G1（生成器耗体力·加权掉落）/ G2（订单交付消耗棋盘实例）/ G3（气泡锁金币购买）
//   现有能力表达不了、需 Lead 裁决下沉为引擎通用能力（详见目录 requests.md）——**未接线**。
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

// ── 棋盘几何（世界像素·占位·M1b 接 UI 时以 layout 稿为准）──────────────────────
export const CELL = 96;
export const BOARD_ORIGIN = { x: 0, y: 0 };

// 物品格坐标（authoring 期确定性铺格·无随机）：按行优先给第 i 个物品一个格中心。
export function cellCenter(i: number): { x: number; y: number } {
  const col = i % GAME.board.cols;
  const row = Math.floor(i / GAME.board.cols);
  return { x: BOARD_ORIGIN.x + col * CELL, y: BOARD_ORIGIN.y + row * CELL };
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
    out[def.item] = {
      entities: {
        body: {
          Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          Tag: { flags: ITEM },
          Shape: { kind: 'box', width: CELL - 8, height: CELL - 8 },
          Sprite: { textureKey: def.sprite, anchorX: 0.5, anchorY: 0.5, zOrder: 1 }, // 皮肤槽·Twemoji/原创套图就绪即换装
          Color: { tint: 0xffffff, alpha: 1 },
        },
      },
    };
  }
  return out;
}
