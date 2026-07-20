// Game C ·《六人德州》文案字典（owner 2026-07-20「中英切换·默认英语」）——**游戏层 i18n 纯数据**。
//
// 声明式：每条用户可见文案 = 一张 {en, zh} 数据（最弱 LLM 也能照抄改值·非自由代码）；t(lang,key) 是固定查表解释器。
// 引擎无 i18n 能力（查证：零 locale 服务·无游戏做切换）→ 本游戏自持字典即可，**不下沉引擎**（YAGNI·第二个游戏要再抽共用）。
// 红线：session/acceptance 的中文口径（winner-type「三条」/last-action「跟注 50」）**不经此层**——那是 GD 域机读真相，恒中文。
//   本层只管**表现层显示**：hud 各屏文案 + 座位/牌型的显示名（牌型按 type index 双语·不碰 session 中文串）。

export type Lang = 'en' | 'zh';
type Entry = Record<Lang, string>;

// ── 静态文案（无插值）──
export const STRINGS = {
  // 主菜单 SC-1
  'menu.portraitTitle': { en: '· Hero Portrait', zh: '· 主角立绘' },
  'menu.portraitSize': { en: 'Size 300 × 440 · Portrait', zh: '尺寸 300 × 440 · 竖幅' },
  'menu.portraitAnchor': { en: 'Style · Anime / Soft-light / Warm-night / Tasteful', zh: '风格锚 · 二次元 / 柔光 / 暖夜 / 不露骨' },
  'menu.titleA': { en: 'TEXAS', zh: '德州' },
  'menu.titleB': { en: 'NIGHTS', zh: '夜宴' },
  'menu.subtitle': { en: '6-Handed · Read & Raise · Play the Long Game', zh: '六人环桌 · 押注见真章 · 步步为局' },
  'menu.blindLabel': { en: 'Blinds', zh: '本局盲注' },
  'menu.players': { en: 'Players', zh: '入局人数' },
  'menu.redpack': { en: '🧧 Daily First Hand · +88 Bonus', zh: '🧧 每日首局 +88 红包' },
  'menu.start': { en: 'Sit Down', zh: '开始上桌' },
  'menu.continue': { en: 'Continue', zh: '继续上局' },
  'menu.settings': { en: 'Settings', zh: '设置' },
  'menu.version': { en: 'v0.1.0 · Boxyard', zh: 'v0.1.0 · 盒庭线' },
  // 顶带
  'top.blind': { en: 'Blinds', zh: '盲注' },
  'top.pot': { en: 'POT', zh: 'POT · 底池' },
  // 座位气泡 / 元信息
  'bubble.out': { en: 'OUT', zh: '出局 OUT' },
  'bubble.fold': { en: 'FOLDED', zh: '已弃 FOLD' },
  'bubble.allin': { en: 'ALL-IN', zh: 'ALL-IN' },
  'bubble.thinking': { en: '● Thinking · 0:15', zh: '● 思考中 · 0:15' },
  'move.fold': { en: 'Fold', zh: '弃牌' },
  'move.check': { en: 'Check', zh: '过牌' },
  'seat.you': { en: 'You', zh: '你' },
  'seat.opp': { en: 'Opp', zh: '对手' },
  // 行动条
  'act.check': { en: 'Check', zh: '过牌' },
  'act.fold': { en: 'Fold', zh: '弃牌' },
  'quick.half': { en: '½ Pot', zh: '½ 池' },
  'quick.two3': { en: '⅔ Pot', zh: '⅔ 池' },
  'quick.pot': { en: 'Pot', zh: '满池' },
  'quick.allin': { en: 'All-In', zh: '全下' },
  'waiting': { en: '⏳ Waiting for other players…', zh: '⏳ 等待其他玩家行动…' },
  // 衣柜
  'wr.pawnedState': { en: 'Pawned · layer removed', zh: '已当 · 立绘层消失' },
  'wr.wornState': { en: 'Worn', zh: '在穿' },
  'wr.pawnedVal': { en: 'Pawned', zh: '已典当' },
  'wr.cashIn': { en: 'Cash In', zh: '换筹码' },
  'wr.portraitSub': { en: 'Layered portrait · 3:4 · pawns peel off', zh: '分层立绘区 · 3:4 · 典当逐层消失' },
  'wr.modeHero': { en: 'Your view · worn items can be pawned for chips', zh: '自己视角 · 在穿件可典当换筹码' },
  'wr.modeOpp': { en: 'Opponent view · read-only (name + value)', zh: '对手视角 · 只读（件名 + 面值可见）' },
  // 摊牌屏
  'sd.community': { en: 'COMMUNITY', zh: '公共牌 · COMMUNITY' },
  'sd.muck': { en: 'Mucked · no showdown', zh: '盖牌收池 · 无摊' },
  'sd.next': { en: 'Confirm · Next Hand ▶', zh: '确认 · 继续下一手 ▶' },
  // 局终屏
  'fin.winSub': { en: 'TOTAL VICTORY', zh: '大 获 全 胜' },
  'fin.loseSub': { en: 'WIPED OUT', zh: '铩 羽 而 归' },
  'fin.winTitle': { en: 'Table Swept', zh: '通吃满堂' },
  'fin.loseTitle': { en: 'Busted', zh: '输得精光' },
  'fin.winFlavor': { en: 'All five ladies busted · the table is yours', zh: '五位姨太尽数出局 · 一桌尽归' },
  'fin.loseFlavor': { en: 'Chips and garments all gone · you leave the table', zh: '筹码与衣物尽失 · 落败离席' },
  'fin.hands': { en: 'Hands Played', zh: '总手数' },
  'fin.chips': { en: 'Final Chips', zh: '最终筹码' },
  'fin.pawned': { en: 'Pawned Items', zh: '典当衣物' },
  'fin.again': { en: 'Play Again', zh: '再来一局' },
  'fin.exit': { en: 'Lobby', zh: '回大厅' },
  // 日志面板
  'log.title': { en: '📋 Hand Log', zh: '📋 牌局日志 · 查 bug' },
  'log.seed': { en: 'Deterministic event stream · same seed → same log', zh: '确定性事件流 · 同 seed 同日志' },
  // 座位名（主角）
  'name.hero': { en: 'You', zh: '主角' },
} satisfies Record<string, Entry>;

export type StringKey = keyof typeof STRINGS;
/** 静态查表：t(lang, key) → 该语言文案。 */
export const t = (lang: Lang, key: StringKey): string => STRINGS[key][lang];

// ── 牌型显示名（双语·按 HOLDEM_TYPE_ORDER 的 type key·**独立于 session 中文串**·不碰机读口径）──
export const HAND_NAMES: Record<Lang, Record<string, string>> = {
  en: {
    'high-card': 'High Card', 'pair': 'Pair', 'two-pair': 'Two Pair', 'three-of-a-kind': 'Trips',
    'straight': 'Straight', 'flush': 'Flush', 'full-house': 'Full House', 'four-of-a-kind': 'Quads', 'straight-flush': 'Straight Flush',
  },
  zh: {
    'high-card': '高牌', 'pair': '一对', 'two-pair': '两对', 'three-of-a-kind': '三条',
    'straight': '顺子', 'flush': '同花', 'full-house': '葫芦', 'four-of-a-kind': '四条', 'straight-flush': '同花顺',
  },
};
export const handName = (lang: Lang, typeKey: string): string => HAND_NAMES[lang][typeKey] ?? '';

// ── 插值文案（数字/名字拼接·en-US 千分位）──
const n = (x: number): string => x.toLocaleString('en-US');
export const fmtHand = (l: Lang, hand: number): string => (l === 'zh' ? `第 ${hand} 手 · 现金局` : `Hand ${hand} · Cash Game`);
export const fmtCall = (l: Lang, amt: number): string => (l === 'zh' ? `跟注 ${n(amt)}` : `Call ${n(amt)}`);
export const fmtRaise = (l: Lang, amt: number): string => (l === 'zh' ? `加注 ${n(amt)}` : `Raise ${n(amt)}`);
export const fmtBet = (l: Lang, amt: number): string => (l === 'zh' ? `注 ${n(amt)}` : `Bet ${n(amt)}`);
export const fmtBest = (l: Lang, name: string): string => (l === 'zh' ? `最优成牌 · ${name || '—'}` : `Best · ${name || '—'}`);
export const fmtShowdownTitle = (l: Lang, pot: number): string => (l === 'zh' ? `摊牌 · 底池 ${n(pot)}` : `Showdown · Pot ${n(pot)}`);
export const fmtValue = (l: Lang, v: number): string => (l === 'zh' ? `面值 ${n(v)}` : `Value ${n(v)}`);
export const fmtWardrobeTitle = (l: Lang, name: string): string => (l === 'zh' ? `${name} · 衣柜` : `${name} · Wardrobe`);
export const fmtPortrait = (l: Lang, name: string): string => (l === 'zh' ? `${name} 立绘` : `${name} Portrait`);
export const fmtHands = (l: Lang, h: number): string => (l === 'zh' ? `${h} 手` : `${h}`);
export const fmtItems = (l: Lang, cnt: number): string => (l === 'zh' ? `${cnt} / 6 件` : `${cnt} / 6`);

// 上一动作气泡（结构化 lastMove → 本地化文案 + 是否加注[金色]）。
export interface LastMove { kind: 'fold' | 'check' | 'call' | 'raise'; amount?: number }
export function fmtMove(l: Lang, m: LastMove): { text: string; isRaise: boolean } {
  switch (m.kind) {
    case 'fold': return { text: t(l, 'move.fold'), isRaise: false };
    case 'check': return { text: t(l, 'move.check'), isRaise: false };
    case 'call': return { text: fmtCall(l, m.amount ?? 0), isRaise: false };
    case 'raise': return { text: fmtRaise(l, m.amount ?? 0), isRaise: true };
  }
}
