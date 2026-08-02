// Game G · 充值/兑换/闪艺/抽卡密码 经济数据（纯数据+小工具叶子·拆分自 blueprint.ts）。


// ── T-G6 · 闪艺 foil 收集皮肤（design reply#17 · 附魔回驳→纯表现收集）──
// ⛔ 纯表现 / 不进 hash / 零平衡影响：只是局外**收集欲**的牌组装饰，买下=解锁、零 gameplay 作用。最弱 LLM 能填 {id,name,cost}。
export interface FoilSkin { id: string; name: string; cost: number; desc: string }
export const GAME_G_FOILS: FoilSkin[] = [
  { id: 'gilt', name: '鎏金', cost: 30, desc: '金箔流光' },
  { id: 'azure', name: '碧霄', cost: 45, desc: '青碧全息' },
  { id: 'crimson', name: '赤焰', cost: 60, desc: '赤红炽芒' },
  { id: 'obsidian', name: '玄曜', cost: 90, desc: '玄黑曜辉' },
];

// === 钻石经济（owner 2026-06-20 · Demo 假支付）===
// 闭环：充值(¥→💎，越充越送·上限64) → 兑换(💎→🪙材料，拿去改造坊升级地支/天罡)。
// 全数据驱动：调档位/价格/赠送只改下表，引擎只「读表发币」。numbers=Demo 占位，owner 可调。
export interface RechargePack { id: string; price: number; base: number; bonus: number; tag?: string } // price=¥ · 到账=base+bonus
export const RECHARGE_PACKS: RechargePack[] = [
  { id: 'r6', price: 6, base: 6, bonus: 0 }, // ¥6=6💎（1:1·首档无赠）
  { id: 'r18', price: 18, base: 18, bonus: 2, tag: '超值' }, // 到账 20（+11%）
  { id: 'r30', price: 30, base: 30, bonus: 6, tag: '热卖' }, // 到账 36（+20%）
  { id: 'r50', price: 50, base: 50, bonus: 14, tag: '至尊' }, // 到账 64（+28%·上限）
];
export const rechargeTotal = (p: RechargePack): number => p.base + p.bonus;

// 💎→🪙材料 兑换（越换单价越优）；🪙 用于改造坊升级（地支材料/天罡/星球）。
export interface DiamondExchange { id: string; diamond: number; gold: number; tag?: string }
export const DIAMOND_EXCHANGES: DiamondExchange[] = [
  { id: 'x6', diamond: 6, gold: 60 }, // 10🪙/💎
  { id: 'x18', diamond: 18, gold: 200, tag: '超值' }, // ~11🪙/💎
  { id: 'x36', diamond: 36, gold: 450, tag: '热卖' }, // 12.5🪙/💎
  { id: 'x64', diamond: 64, gold: 900, tag: '至尊' }, // ~14🪙/💎
];

// 💎→地支碎片 兑换（养地支专属材料·待甲镶嵌系统消耗）。Demo：先能买能囤。
export interface ShardPack { id: string; diamond: number; shards: number; tag?: string }
export const DIZHI_SHARD_PACKS: ShardPack[] = [
  { id: 's4', diamond: 4, shards: 10 },
  { id: 's12', diamond: 12, shards: 36, tag: '超值' },
  { id: 's24', diamond: 24, shards: 80, tag: '热卖' },
];

// 投资人彩蛋（owner 2026-06-20）：首充免密「送一点点」，第二次起需密码。
// 测试版改点选花色（owner 2026-06-21·不让打字）：点选 2 张花色当密码，正确=♥红心+♠黑桃。
// 顺序无关——按固定花色序规范化后比较。密码=数据常量·可改。
const SUIT_PW_ORDER = ['♠', '♥', '♦', '♣'];
/** 规范化点选的花色组合（去重 + 固定序）→ 可比较的密码串。 */
export function canonSuitPw(suits: string[]): string {
  return [...new Set(suits)].sort((a, b) => SUIT_PW_ORDER.indexOf(a) - SUIT_PW_ORDER.indexOf(b)).join('');
}
export const RECHARGE_SUIT_PW = ['♥', '♠']; // 正确密码：红心 + 黑桃
export const RECHARGE_PASSWORD = canonSuitPw(RECHARGE_SUIT_PW); // 规范化后 = '♠♥'

// === 抽卡商城（doc25 §四 · Demo）===
// 商城=抽卡枢纽：花🪙/💎 从「已解锁池」随机出天罡/地支；天罡重复→天罡碎片→定向兑换(保底·可控build)；
// 地支 新得=铜·重复=升档(铜→银→金)·满金重复→地支碎片。全数据驱动·价格/汇率可调。
export const DIZHI_MAX_TIER = 3; // 1铜 2银 3金
export const GACHA = {
  tiangang: { singleGold: 80, singleDiamond: 8, tenGold: 720, tenDiamond: 72, dupShards: 5, craftShards: 20 },
  dizhi: { singleGold: 60, singleDiamond: 6, tenGold: 540, tenDiamond: 54, maxDupShards: 8, craftShards: 12 },
};
/** 抽卡花费（pool×count×pay）。返回 {gold,diamond} 其一>0。 */
export function gachaCost(pool: 'tiangang' | 'dizhi', count: 1 | 10, pay: 'gold' | 'diamond'): { gold: number; diamond: number } {
  const g = GACHA[pool];
  const gold = pay === 'gold' ? (count === 10 ? g.tenGold : g.singleGold) : 0;
  const diamond = pay === 'diamond' ? (count === 10 ? g.tenDiamond : g.singleDiamond) : 0;
  return { gold, diamond };
}
