// Game F · 装备 ③/④ 模型（金铲铲制：每将 ≤3 件；"烘进下次部署"语义）。
// 纯函数 + JS 侧 meta 状态（EquipMap），不入战斗 hash；HP 经 Caster.overrides 在部署拍重烘
// （caster 每次施放重读 overrides → 拖上即改、下次开战生效）。零引擎。
// ⚠️ atk 缺口：伤害走共享 strike_<id> 模板 + 全局 scaleByResource，逐将 atk 无法经 override 烘
//   → v1 仅 HP 生效；atk/atkSpd/crit/move 记录入袋+tooltip，战斗加成待 Lead 路由（per-unit 缩放）或大厅预装版。
import { ITEM_LIB } from './items.js';
import { finalHp, type HeroSpec } from './heroes.js';
import { STAR_HP_MUL } from './economy.js';

export const MAX_EQUIP = 3; // 金铲铲：每将最多 3 件
export type EquipMap = Record<string, string[]>; // heroKey（marker 实例 id）→ 已装道具 id[]

// 装备一件（≤3）：成功 push 并返回 true；满员返回 false（调用方据此回弹/提示）。
export function addEquip(map: EquipMap, heroKey: string, itemId: string): boolean {
  const list = map[heroKey] ?? (map[heroKey] = []);
  if (list.length >= MAX_EQUIP) return false;
  list.push(itemId);
  return true;
}

// 拆解一件（④）：移除该将身上首个匹配 itemId，返回被移除的 id（用于退回战利品袋）；无则 null。
export function removeEquip(map: EquipMap, heroKey: string, itemId: string): string | null {
  const list = map[heroKey];
  if (!list) return null;
  const i = list.indexOf(itemId);
  if (i < 0) return null;
  list.splice(i, 1);
  if (list.length === 0) delete map[heroKey];
  return itemId;
}

// 某将装备的 stat 加总（缺省 0）；hp 接战斗烘值，其余暂表现。
export function equipStatSum(map: EquipMap, heroKey: string, k: 'hp' | 'atk'): number {
  return (map[heroKey] ?? []).reduce((s, id) => s + (ITEM_LIB[id]?.stats[k] ?? 0), 0);
}

// 部署 HP 重烘：= round((finalHp(英雄,含起手装) + Σ装备 hp) × 人数难度 × 星级倍率)。
// = heroOverrides 同管道（star 倍率），只是基底再加装备 hp。供拖装备时写回 marker 的 Caster.overrides.main.Resource。
export function equipDeployHp(h: HeroSpec, star: number, hpMul: number, map: EquipMap, heroKey: string): number {
  const bonus = equipStatSum(map, heroKey, 'hp');
  return Math.round((finalHp(h) + bonus) * hpMul * (STAR_HP_MUL[star] ?? 1));
}

// 解析 marker 实例 id（`bench${star?}_${heroId}#${seq}:seat`）→ {heroId, star}；非席位 → null。
// star：bench_ =1 / bench2_ =2 / bench3_ =3（模板族名编码星级）。heroId 可含下划线（如 a_guanyu）。
export function parseMarkerId(entityId: string): { heroId: string; star: number } | null {
  const m = /^bench(\d?)_(.+?)#\d+:seat$/.exec(entityId);
  if (!m) return null;
  return { heroId: m[2], star: m[1] ? Number(m[1]) : 1 };
}
