// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— 礼物数据（GDD §七·关心她→送礼·她记住偏好）
//  纯数据：礼物目录 + 每角色偏好 + 反应台词。v1 全部已拥有（无商店）。
// ════════════════════════════════════════════════════════════════════════

export interface Gift { id: string; icon: string; name: string }

export const GIFTS: Gift[] = [
  { id: 'tea', icon: '🍵', name: '一罐好茶' },
  { id: 'book', icon: '📖', name: '一本旧书' },
  { id: 'ink', icon: '🖌️', name: '一套绘墨' },
  { id: 'snack', icon: '🍬', name: '一袋小零食' },
  { id: 'flower', icon: '🌷', name: '一支花' },
  { id: 'cat', icon: '🐱', name: '一个猫摆件' },
];

// 偏好：love=她很喜欢(羁绊大涨) / ok=普通。按角色。
type Pref = 'love' | 'ok';
const PREF: Record<string, Record<string, Pref>> = {
  qiyue: { tea: 'love', book: 'love', flower: 'ok', cat: 'ok', ink: 'ok', snack: 'ok' },
  mika: { ink: 'love', snack: 'love', cat: 'love', flower: 'ok', tea: 'ok', book: 'ok' },
};

const REACT: Record<string, Record<Pref, string>> = {
  qiyue: {
    love: '……你怎么知道。谢谢，我会好好用的。（她难得地，耳尖红了一下）',
    ok: '嗯，谢谢。你有心了。',
  },
  mika: {
    love: '哇啊啊是给我的吗！我要把它画进今天的画里！你最好了！',
    ok: '诶嘿，谢谢谢谢～我收下啦！',
  },
};

export function giftReaction(companionId: string, giftId: string): { text: string; bond: number; love: boolean } {
  const pref = PREF[companionId]?.[giftId] ?? 'ok';
  const text = REACT[companionId]?.[pref] ?? '谢谢你。';
  return { text, bond: pref === 'love' ? 8 : 4, love: pref === 'love' };
}
