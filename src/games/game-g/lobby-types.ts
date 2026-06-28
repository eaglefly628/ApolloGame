// Game G · 大厅共享类型 + 纯函数 + 引导脚本常量（单一真相·收口）。
// 去腐收口 2026-06-28：旧手写 DOM 大厅退役后，原 lobby-screen.ts / lobby-overlays.ts / lobby-collection.ts
// 各只剩一截共享物（view/handler 类型 · 卦象纯函数 · 引导脚本 · 地煞数值人话化），合并到此一处。
// 现役大厅走数据驱动（lobby-dd.ts + home/campaign/collection/deck/craft-screen + overlays.ts）。
// 本文件是零渲染的叶子：只被各屏 import，绝不 import 任何屏（无环）。原始小工具/常量仍在 lobby-util.ts。
import { type InlayEntry, type StageCampaign } from './blueprint.js';
import { type LuckyRoll, type FortuneView } from './lobby-util.js';
import { DISHA_SPECS } from './disha.js';

// ── 共享 view / 商品 / 抽卡结果 / handler 类型 ───────────────────────────────
export interface LobbyShopItem { id: string; name: string; sub: string; cost: number; owned: boolean; buyable: boolean; level?: number; inDeck?: boolean; power?: number; phat?: number; kind?: string; icon?: string; tint?: string; unlockStage?: number; locked?: boolean }
export interface GachaResult { kind: 'tiangang' | 'dizhi'; id: string; name: string; rarity?: string; outcome: 'new' | 'dup-shard' | 'dizhi-up' | 'dizhi-shard'; detail: string } // 抽卡结果（开包演出读）
export interface LobbyView {
  skin: 'onyx' | 'rosy';
  coin: number; diamond?: number; dizhiShards?: number; tiangangShards?: number; dizhiBag?: Record<string, number[]>; inlays?: Record<string, InlayEntry[]>; rechargeNeedsPassword?: boolean; energy: number; energyMax: number; foilCount: number;
  name: string; mainCard: string; rankText: string;
  stageLabel: string; archLine: string; bossLine: string;
  deckAvg: number; deckMin: number; deckMax: number; deck: number[];
  tiangangs: LobbyShopItem[]; planets: LobbyShopItem[]; foils: LobbyShopItem[];
  ladderLines: string[];
  deckArchName?: string | null; deckArchActivated?: boolean;
  // 天罡牌组（owner 2026-06-20 多牌组）：decks=各牌组概览 / deckSize=每组上限 / activeDeckName=出战组名 / canAddDeck=可否再建
  decks?: { id: string; name: string; size: number; pokerSize?: number; active: boolean }[];
  deckSize?: number; activeDeckName?: string; canAddDeck?: boolean;
  // 出战扑克牌组构筑（乙1·DEV-CHECKLIST 契约 A）：从 52 池自选 ≤pokerPickMax 张；pokerPicks=当前出战组已选卡 id；cost 角标读 deployCost。
  pokerPicks?: string[]; pokerPickMax?: number;
  campaign?: StageCampaign; // 当前关战役（Boss/战役/难度/地煞/解锁 · doc23 §八）
  campaignMax?: number; // 已抵达的最高关（战役进度屏 锁/通关判定）
  firstLaunch?: boolean; // 首次启动（未看过开场故事）→ 进大厅自动播放（doc28 §一）
  guideStep?: number; // 新手引导进度（doc28 §二）：0..N 进行中 · -1 完成/跳过
  guideOn?: boolean; // 新手引导开关（owner 2026-06-21·默认开·设置可关）
  fortune?: FortuneView; // 今日卦象（owner 2026-06-21）：制卦次数 + 收下的卦值 → 主页顶展示
}

export interface LobbyHandlers {
  getView: () => LobbyView;
  onPlay: () => void;
  onBuyTiangang?: (id: string) => void;
  onBuyPlanet?: (id: string) => void;
  onBuyFoil?: (id: string) => void;
  onToggleTiangang?: (id: string) => void; // 选入/踢出**出战牌组**（≤deckSize）
  onDiamondUnlock?: (id: string) => void; // 钻石速购解锁天罡（doc25·跳关门槛）
  onRecharge?: (packId: string, password: string) => boolean | void; // 充值 ¥→💎（Demo·首充免密/复充需密码）→ true=成功
  onRollFortune?: () => number | null; // 掷今日卦象（持久计数·返卦值1-100；次数已尽返 null）（owner 2026-06-21）
  onKeepFortune?: (val: number) => void; // 收下今日卦象（持久化选中→主页顶展示）
  onExchange?: (exId: string) => void; // 兑换 💎→🪙金币
  onBuyShards?: (exId: string) => void; // 兑换 💎→🧩地支碎片
  onGacha?: (pool: 'tiangang' | 'dizhi', count: 1 | 10, pay: 'gold' | 'diamond') => GachaResult[] | null; // 抽卡（doc25 §四）→ 结果/null(买不起)
  onCraftTiangang?: (id: string) => boolean | void; // 天罡碎片定向兑换指定天罡（保底）
  onCraftDizhi?: (branch: string) => boolean | void; // 地支碎片定向兑换/升指定生肖（owner 2026-06-21）
  onInlay?: (idx: string, branch: string, tier: number) => boolean | void; // 地支附魔：把卡包某档生肖镶进牌位（消耗一张·≤INLAY_MAX）
  onRemoveInlay?: (idx: string, slot: number) => void; // 卸下某牌位第 slot 个镶嵌（永久消耗不退）
  onSelectDeck?: (id: string) => void; // 选某牌组出战
  onNewDeck?: () => void; // 新建牌组
  onDelDeck?: (id: string) => void; // 删除牌组
  onTogglePick?: (cardId: string) => void; // 出战扑克牌组：点牌入/出（≤POKER_PICK_SIZE·乙1）
  onAutoBuildDeck?: () => void; // 一键自动构筑出战扑克牌组（乙3）
  onClearPicks?: () => void; // 清空出战扑克牌组
  onAutoBuildTiangang?: () => void; // 一键配置天罡战法（从已拥有里自动凑满·owner 2026-06-21）
  onReset?: () => void;
  onSkin?: (skin: 'onyx' | 'rosy') => void;
  onIntroSeen?: () => void; // 看完开场故事（doc28 §一）→ 标记已看 + 起引导
  onGuideStep?: (n: number) => void; // 新手引导步进（doc28 §二）
  onGuideDone?: () => void; // 完成/跳过引导
  onReplayIntro?: () => void; // 重看开场故事 + 引导
  onToggleGuide?: () => void; // 新手引导开/关（owner 2026-06-21·默认开·手动关）
  onExitGame?: () => void; // 退出到游戏库（壳层钩子·收进设置·owner 2026-06-21）
}

// ── 今日卦象纯函数（owner 2026-06-21）────────────────────────────────────────
export function luckyFromVal(val: number): LuckyRoll {
  return val >= 90 ? { val, label: '大吉', color: 'var(--gold)', line: '天命在你·此局必有奇遇，放胆去翻！' }
    : val >= 70 ? { val, label: '吉', color: 'var(--club)', line: '顺风顺水·正是出征好时机。' }
    : val >= 40 ? { val, label: '中庸', color: 'var(--ink)', line: '胜负在人·稳扎稳打、看准爆冷缝。' }
    : val >= 15 ? { val, label: '小凶', color: 'var(--diamond)', line: '谨慎出牌·手里留张保命天罡。' }
    : { val, label: '大凶', color: 'var(--heart)', line: '爆冷之日——正好赌一把翻盘命！' };
}
// 卦象战场加成：收下的卦象会影响出战时所有部署兵的 buff（大吉+2 / 吉+1 / 中庸0 / 小凶−1 / 大凶−2）。
export const luckyBattleBuff = (val: number): number =>
  val >= 90 ? 2 : val >= 70 ? 1 : val >= 40 ? 0 : val >= 15 ? -1 : -2;

// ── 新手引导脚本（lobby-dd 消费）：逐步高亮锚点 + 推进信号 ─────────────────────
export const GUIDE_COACH: { anchor: string; text: string; advanceAct: string; advanceK?: string; placement: 'top' | 'bottom' }[] = [
  { anchor: 'help', text: '① 先翻一遍《玩法手册》——30 秒看懂怎么打（三路九格 · 每回合四选一 · 掷命对决）。点这里 📖', advanceAct: 'man', placement: 'bottom' },
  { anchor: 'decks', text: '② 配一套出战牌组——点这里进「我的牌组」。', advanceAct: 'tab', advanceK: 'decks', placement: 'bottom' },
  { anchor: 'autobuild-poker', text: '③ 点「✨一键自动构筑」，自动帮你凑 16 张扑克牌库。', advanceAct: 'autoBuildDeck', placement: 'bottom' },
  { anchor: 'tab-gang', text: '④ 再切到「⚡天罡战法」页配天罡。', advanceAct: 'deckTab', advanceK: 'gang', placement: 'bottom' },
  { anchor: 'autobuild-gang', text: '⑤ 点「✨一键配置天罡」，自动凑满天罡战法。', advanceAct: 'autoBuildTiangang', placement: 'bottom' },
  { anchor: 'home', text: '⑥ 配好了！点这里返回「大厅」。', advanceAct: 'tab', advanceK: 'home', placement: 'bottom' },
  { anchor: 'play', text: '⑦ 点「出征」打第一战——温泉关 · 列奥尼达（最易），解封你的第一缕英雄之魂！', advanceAct: 'play', placement: 'top' },
];

// ── 地煞「真正数值」（读甲 DISHA_SPECS·关1-5 精确数值）→ 人话一行 ─────────────
export function dishaNumberLine(dishaId: string): string {
  const s = DISHA_SPECS[dishaId]; if (!s) return '';
  const p: string[] = [];
  if (s.homeHp) p.push(`大本营 ${s.homeHp} 血`);
  if (s.allWinPct) p.push(`全军 +${s.allWinPct}% 胜率`);
  if (s.generalWinPct) p.push(`主将 +${s.generalWinPct}%`);
  if (s.phalanxPerAdj) p.push(`每相邻友兵 +${s.phalanxPerAdj}%${s.phalanxCap ? ` · 封顶 +${s.phalanxCap}%` : ''}`);
  if (s.nearBaseSlots) p.push(`大本营前 ${s.nearBaseSlots} 格 ${[s.nearBasePower ? `守军战力 +${s.nearBasePower}` : '', s.nearBaseWinPct ? `+${s.nearBaseWinPct}% 胜率` : ''].filter(Boolean).join('·') || '固守'}`);
  if (s.eliteMidWinPct) p.push(`中路前锋 +${s.eliteMidWinPct}%`);
  if (s.flankYouWinPct) p.push(`你被左右夹 −${s.flankYouWinPct}%`);
  if (s.firstStrike) p.push(`先手出击${s.firstStrikeWinPct ? ` +${s.firstStrikeWinPct}%` : ''}`);
  if (s.winStreakPer) p.push(`每连胜 +${s.winStreakPer}%${s.winStreakCap ? ` · 封顶 +${s.winStreakCap}%` : ''}`);
  if (s.lastStandGeneral) p.push('主将 2 命（首负不亡·退一格）');
  if (s.noRout) p.push('主将亡不溃散');
  if (s.bonusMana) p.push(`每回合多 +${s.bonusMana} 召唤源泉`);
  if (s.batteryEveryTurns) p.push(`每 ${s.batteryEveryTurns} 回合压一路 −${s.batteryWinPct}%`);
  return p.join(' · ');
}
