// 剧情起手包 · 伴侣在场件 presence（REQ-DIALOGUE M3·PUI）——**非新控件·用 M1 三件拼装**（portrait 立绘 + dialog 气泡）。
//
// 用途：给**非剧情小对局**（猜拳/抽牌/骰子/消除…）叠一层「伴侣反应」——赢了她雀跃、险胜她惊呼、发呆她催促，
//   = 约会性转型线的差异化钩子（对局本身不变·只多一层在场陪伴）。
// 两块：① 反应表 `ReactionTable`（纯数据·gameEvent → 反应候选[]·种子选行·persona 可加权）；
//        ② `buildPresence(...)` 组合模板（立绘 + 台词气泡·house 主题取色·被动气泡不发信号）。
// 红线不破：产纯 LayoutNode 数据（M1 闭集控件）；反应选择确定性（seed 同→选同·录放一致·无裸 Math.random）。
import type { LayoutNode } from '@ui/components/index.js';

/** 一条反应候选：情绪键（驱动立绘变体·M2 emotion→assetKey 表）+ 台词候选（种子选一句）+ persona 加权（多候选时·缺省 1）。 */
export interface ReactionEntry {
  emotion: string;
  lines: string[];
  weight?: number;
}
/** 反应表（纯数据）：gameEvent（win/lose/bigPlay/idle/…）→ 反应候选[]（≥1·种子先按 weight 选 entry 再选 line）。 */
export type ReactionTable = Record<string, ReactionEntry[]>;

/**
 * 确定性选反应（**无 Math.random**·seed 同 → 选同 → 录放一致）：先按 weight 从 event 候选里选一个 entry，
 * 再从其 lines 里选一句。seed 由游戏给（世界 RandomSeed / tick 计数 / 分数…任意确定值）。event 无候选 → undefined。
 */
export function pickReaction(table: ReactionTable, event: string, seed: number): { emotion: string; line: string } | undefined {
  const entries = table[event];
  if (!entries || entries.length === 0) return undefined;
  const s = Math.abs(Math.trunc(seed));
  const total = entries.reduce((sum, e) => sum + Math.max(1, e.weight ?? 1), 0);
  let r = s % total;
  let chosen = entries[0]!;
  for (const e of entries) { r -= Math.max(1, e.weight ?? 1); if (r < 0) { chosen = e; break; } }
  if (chosen.lines.length === 0) return { emotion: chosen.emotion, line: '' };
  const li = Math.floor(s / total) % chosen.lines.length; // 二级种子选句（与选 entry 的位错开·避免同相）
  return { emotion: chosen.emotion, line: chosen.lines[li]! };
}

/**
 * 伴侣在场件组合模板：立绘（金描边 + 高亮）+ 台词气泡（dialog·kind:'choice' 抑制推进 ▶ = 被动气泡·不发信号）。
 * `reaction` 缺省/空句 → 只显立绘（idle 无话）。`side` 定左右序（缺省 right = 立绘靠右陪玩家视角）。游戏自行放角落。
 */
export function buildPresence(o: {
  name?: string;
  art?: string;                                   // 立绘图 URL（sim 持 key·resolveAsset 后填·M2 表按 emotion 选）
  side?: 'left' | 'right';
  reaction?: { emotion: string; line: string };
  id?: string;
}): LayoutNode {
  const side = o.side ?? 'right';
  const rootId = o.id ?? 'presence';
  const emo = o.reaction?.emotion;
  const line = o.reaction?.line ?? '';
  const portrait: LayoutNode = {
    type: 'portrait', id: `${rootId}-por`,
    props: { name: o.name, art: o.art, emotion: emo, side, edge: 'gold', glow: true },
    layout: { width: 96, height: 120 },
  };
  const bubble: LayoutNode = {
    type: 'dialog', id: `${rootId}-say`,
    props: { text: line, kind: 'choice', emotion: emo, edge: 'gold', typewriter: 24 }, // kind:'choice'→无 ▶ 无信号=被动气泡
    layout: { flex: 1 },
  };
  const kids: LayoutNode[] = line ? (side === 'right' ? [bubble, portrait] : [portrait, bubble]) : [portrait];
  return { type: 'Panel', id: rootId, props: { bare: true }, layout: { direction: 'row', align: 'end', gap: 8 }, children: kids };
}

/** 示范反应表（约会性伴侣·四常见 event·种子选句）。游戏抄它改词/加 persona 权重即得一份自己的在场反应。 */
export const SAMPLE_REACTIONS: ReactionTable = {
  win:     [{ emotion: 'happy', lines: ['漂亮！我就知道你行。', '这一手，帅得很。', '赢了——奖励是我陪你再来一局。'] }],
  bigPlay: [{ emotion: 'excited', lines: ['哇……这也太险了！', '心跳都跟着你提起来了。', '好一个绝地反击！'] }],
  lose:    [{ emotion: 'gentle', lines: ['没关系，我看好下一局。', '输赢都有我陪着呢。', '再来，这次我给你数着。'] }],
  idle:    [{ emotion: 'calm', lines: ['在想什么呢？该你了。', '我等你——不急。', '要不要我提个醒？'] }],
};
