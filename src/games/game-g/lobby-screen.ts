// lobby-screen.ts —— 共享类型与纯函数复用枢纽。
// 旧的「忠实港」手写 DOM 渲染（renderLobby/mountLobby/renderLobbyDoc/lobbyOverlaysHTML）已退役，
// 现役大厅走数据驱动（lobby-dd.ts + home/campaign/collection/deck/craft-screen + overlays.ts）。
// 本文件只保留：① 各屏共享的 view/handler 类型；② 对 lobby-util / lobby-overlays 纯函数的再导出。

import { type InlayEntry } from './blueprint.js';

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

import { type StageCampaign } from './blueprint.js';

export { luckyFromVal, luckyBattleBuff } from './lobby-overlays.js'; // 纯函数复用（卦值→吉凶档 + 战场加成）

export type { LuckyRoll, FortuneView } from './lobby-util.js';
import { type FortuneView } from './lobby-util.js';

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
