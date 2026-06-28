// Game G · 大厅共享纯函数 + 引导脚本常量（旧弹层手写 DOM 渲染已退役·拆分自 lobby-screen.ts）。
// 现役大厅弹层走数据驱动（overlays.ts + lobby-dd.ts）。本文件只保留被现役代码复用的纯函数/常量。
import { type LuckyRoll } from './lobby-util.js';

// 新手引导脚本（lobby-dd 消费）：逐步高亮锚点 + 推进信号。
export const GUIDE_COACH: { anchor: string; text: string; advanceAct: string; advanceK?: string; placement: 'top' | 'bottom' }[] = [
  { anchor: 'help', text: '① 先翻一遍《玩法手册》——30 秒看懂怎么打（三路九格 · 每回合四选一 · 掷命对决）。点这里 📖', advanceAct: 'man', placement: 'bottom' },
  { anchor: 'decks', text: '② 配一套出战牌组——点这里进「我的牌组」。', advanceAct: 'tab', advanceK: 'decks', placement: 'bottom' },
  { anchor: 'autobuild-poker', text: '③ 点「✨一键自动构筑」，自动帮你凑 16 张扑克牌库。', advanceAct: 'autoBuildDeck', placement: 'bottom' },
  { anchor: 'tab-gang', text: '④ 再切到「⚡天罡战法」页配天罡。', advanceAct: 'deckTab', advanceK: 'gang', placement: 'bottom' },
  { anchor: 'autobuild-gang', text: '⑤ 点「✨一键配置天罡」，自动凑满天罡战法。', advanceAct: 'autoBuildTiangang', placement: 'bottom' },
  { anchor: 'home', text: '⑥ 配好了！点这里返回「大厅」。', advanceAct: 'tab', advanceK: 'home', placement: 'bottom' },
  { anchor: 'play', text: '⑦ 点「出征」打第一战——温泉关 · 列奥尼达（最易），解封你的第一缕英雄之魂！', advanceAct: 'play', placement: 'top' },
];

// ── 今日卦象纯函数（owner 2026-06-21·拆分自 lobby-screen.ts）──
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
