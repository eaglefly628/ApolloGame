import { TEAM_A, TEAM_B, WARRIOR, TACTICIAN, ASSASSIN, FACT_SHU, FACT_WEI, SHU_RED, WEI_BLUE, HP_SCALE } from './constants.js';
import { F_HERO, F_FX_STRIKE, F_FX_ARROW, F_FX_BOLT, F_FX_FLAME, F_FX_FROST, F_FX_DRAIN } from './assets.js';

export interface HeroSpec {
  id: string;
  name: string;
  key: string; // 贴图 key（艺术库）
  team: number; // 队伍位（TEAM_A/B）
  enemy: number; // 敌方队伍位
  cls: number; // 职业位（WARRIOR/TACTICIAN/ASSASSIN）
  faction: number; // 势力位（FACT_SHU/WEI/WU）—— 羁绊
  tint: number; // 势力色（羁绊期徽记/描边备用）
  q: number; // 视觉列 col（odd-r；slotEntity 经 offsetToAxial 换算成 axial）
  r: number; // 视觉行 row（r0-3=魏上半场, r4-7=蜀下半场）
  hp: number; // 血量
  atk: number; // 攻击力
  ult: string; // 大招名
  ultDmg: number; // 大招伤害
  ultSize: number; // 大招范围(px)
  atkType: 'melee' | 'ranged' | 'magic'; // 攻击类型 → 普攻特效
  ultFx: string; // 大招特效 key
  ultDot?: boolean; // 大招附 DoT（灼烧/吸取）
  ultFreeze?: number; // 大招冰冻时长(tick)
  items?: string[]; // 装备 id 列表
  seed?: boolean; // false = 商店专属（开局不播种）
}

// 站位金铲铲式（7×8 真规格：魏上半场 r0..3 / 蜀下半场 r4..7）
// 单机=纯蜀魏对阵，不混吴（曹战刘世界观）；每方 4 将出场 + 2 将商店专属。
export const ROSTER: HeroSpec[] = [
  // 蜀（TEAM_A，下半场 r4..7，红）—— 单机=纯刘备阵营（关羽/赵云/诸葛亮/张飞），不混吴。
  { id: 'a_guanyu', name: '关羽', key: F_HERO.guan_yu, team: TEAM_A, enemy: TEAM_B, cls: WARRIOR, faction: FACT_SHU, tint: SHU_RED, q: 2, r: 4, hp: 240, atk: 12, ult: '青龙偃月', ultDmg: 45, ultSize: 80, atkType: 'melee', ultFx: F_FX_STRIKE, items: ['yuxi'] },
  { id: 'a_zhaoyun', name: '赵云', key: F_HERO.zhao_yun, team: TEAM_A, enemy: TEAM_B, cls: WARRIOR, faction: FACT_SHU, tint: SHU_RED, q: 4, r: 4, hp: 165, atk: 18, ult: '七进七出', ultDmg: 75, ultSize: 55, atkType: 'melee', ultFx: F_FX_STRIKE, items: ['qinggang'] },
  { id: 'a_zhuge', name: '诸葛亮', key: F_HERO.zhuge_liang, team: TEAM_A, enemy: TEAM_B, cls: TACTICIAN, faction: FACT_SHU, tint: SHU_RED, q: 2, r: 6, hp: 120, atk: 24, ult: '八阵图', ultDmg: 35, ultSize: 95, atkType: 'magic', ultFx: F_FX_FROST, ultFreeze: 120 },
  { id: 'a_zhouyu', name: '张飞', key: F_HERO.zhang_fei, team: TEAM_A, enemy: TEAM_B, cls: WARRIOR, faction: FACT_SHU, tint: SHU_RED, q: 4, r: 6, hp: 200, atk: 15, ult: '燕人咆哮', ultDmg: 50, ultSize: 72, atkType: 'melee', ultFx: F_FX_STRIKE },
  // 蜀 6 将库扩充（商店专属，seed:false 不播种；数值杜撰、不特别强）：
  { id: 'a_machao', name: '马超', key: F_HERO.ma_chao, team: TEAM_A, enemy: TEAM_B, cls: WARRIOR, faction: FACT_SHU, tint: SHU_RED, q: 3, r: 5, hp: 190, atk: 16, ult: '西凉铁骑', ultDmg: 48, ultSize: 70, atkType: 'melee', ultFx: F_FX_STRIKE, seed: false },
  { id: 'a_huangzhong', name: '黄忠', key: F_HERO.huang_zhong, team: TEAM_A, enemy: TEAM_B, cls: ASSASSIN, faction: FACT_SHU, tint: SHU_RED, q: 1, r: 6, hp: 130, atk: 22, ult: '百步穿杨', ultDmg: 55, ultSize: 48, atkType: 'ranged', ultFx: F_FX_ARROW, seed: false },
  // 魏（TEAM_B，上半场 r0..3，蓝）—— 单机=纯曹操阵营（张辽/许褚/司马懿/夏侯惇），不混吴。
  { id: 'b_zhangliao', name: '张辽', key: F_HERO.zhang_liao, team: TEAM_B, enemy: TEAM_A, cls: WARRIOR, faction: FACT_WEI, tint: WEI_BLUE, q: 2, r: 3, hp: 200, atk: 15, ult: '突阵', ultDmg: 50, ultSize: 70, atkType: 'melee', ultFx: F_FX_STRIKE, items: ['fangtian'] },
  { id: 'b_xuchu', name: '许褚', key: F_HERO.xu_chu, team: TEAM_B, enemy: TEAM_A, cls: WARRIOR, faction: FACT_WEI, tint: WEI_BLUE, q: 4, r: 3, hp: 270, atk: 11, ult: '裸衣血战', ultDmg: 42, ultSize: 78, atkType: 'melee', ultFx: F_FX_STRIKE },
  { id: 'b_simayi', name: '司马懿', key: F_HERO.sima_yi, team: TEAM_B, enemy: TEAM_A, cls: TACTICIAN, faction: FACT_WEI, tint: WEI_BLUE, q: 3, r: 1, hp: 130, atk: 23, ult: '鬼谋', ultDmg: 40, ultSize: 88, atkType: 'magic', ultFx: F_FX_DRAIN, ultDot: true, items: ['qinggang'] },
  { id: 'b_ganning', name: '夏侯惇', key: F_HERO.xiahou_dun, team: TEAM_B, enemy: TEAM_A, cls: WARRIOR, faction: FACT_WEI, tint: WEI_BLUE, q: 5, r: 1, hp: 200, atk: 14, ult: '拔矢啖睛', ultDmg: 50, ultSize: 70, atkType: 'melee', ultFx: F_FX_STRIKE },
  // 魏 6 将库（对称扩充，选阵营翻转用；商店专属 seed:false）：
  { id: 'b_caoren', name: '曹仁', key: F_HERO.cao_ren, team: TEAM_B, enemy: TEAM_A, cls: WARRIOR, faction: FACT_WEI, tint: WEI_BLUE, q: 3, r: 2, hp: 230, atk: 12, ult: '据守', ultDmg: 40, ultSize: 72, atkType: 'melee', ultFx: F_FX_STRIKE, seed: false },
  { id: 'b_dianwei', name: '典韦', key: F_HERO.dian_wei, team: TEAM_B, enemy: TEAM_A, cls: WARRIOR, faction: FACT_WEI, tint: WEI_BLUE, q: 1, r: 2, hp: 250, atk: 14, ult: '古之恶来', ultDmg: 50, ultSize: 74, atkType: 'melee', ultFx: F_FX_STRIKE, seed: false },
];

// 开局选阵营（REQ-F-061）：玩家选蜀或魏，所选阵营填我方(a_/下半场)、另一阵营填敌方(b_/上半场)。
export type Faction = 'shu' | 'wei';

// 阵营互换：a_↔b_ 角色前缀翻转 + 队伍/敌方交换 + 站位镜像(r→7-r) + tint 随队伍色。
export function swapFactions(roster: HeroSpec[]): HeroSpec[] {
  return roster.map((h): HeroSpec => {
    const wasPlayer = h.team === TEAM_A;
    return {
      ...h,
      id: (wasPlayer ? 'b_' : 'a_') + h.id.slice(2),
      team: wasPlayer ? TEAM_B : TEAM_A,
      enemy: wasPlayer ? TEAM_A : TEAM_B,
      tint: wasPlayer ? WEI_BLUE : SHU_RED,
      r: 7 - h.r, // 上半场 r0-3 ↔ 下半场 r4-7 镜像
    };
  });
}

export function rosterFor(pf: Faction): HeroSpec[] {
  return pf === 'wei' ? swapFactions(ROSTER) : ROSTER;
}

// 商店英雄码：玩家阵营 4 将 → 码 1..4（按 a_ 顺序）。
export function codesFor(roster: HeroSpec[]): Record<string, number> {
  const out: Record<string, number> = {};
  roster.filter((h) => h.team === TEAM_A).forEach((h, i) => { out[h.id] = i + 1; });
  return out;
}

// 装备（数据）：物品=属性加成；英雄装配期把 hp/atk 加上（静态）。
export const ITEMS: Record<string, { name: string; hp?: number; atk?: number }> = {
  yuxi: { name: '玉玺', hp: 120 }, // +120 血
  qinggang: { name: '青釭剑', atk: 12 }, // +12 攻
  fangtian: { name: '方天画戟', hp: 60, atk: 8 }, // +60 血 +8 攻
};

export const sumItem = (ids: string[] | undefined, k: 'hp' | 'atk'): number => (ids ?? []).reduce((s, id) => s + (ITEMS[id]?.[k] ?? 0), 0);
export const finalHp = (h: HeroSpec): number => h.hp * HP_SCALE + sumItem(h.items, 'hp');
export const finalAtk = (h: HeroSpec): number => h.atk + sumItem(h.items, 'atk');

// 普攻特效按攻击类型：近战斩光 / 远程箭 / 法术弹。
export const FX_BY_TYPE: Record<HeroSpec['atkType'], string> = { melee: F_FX_STRIKE, ranged: F_FX_ARROW, magic: F_FX_BOLT };
