// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— 关心/靠近 的反应台词（纯数据·按角色 + 动作）
// ════════════════════════════════════════════════════════════════════════

export interface Reaction { text: string; bond: number }

const GREET: Record<string, string> = {
  qiyue: '……还好。你呢，别又熬夜。',
  mika: '我才不累呢！……好吧有一点。你问我，我就不累了。',
};
const QUIET_DEEP: Record<string, string> = {
  qiyue: '（她没说话，只是把头轻轻靠过来。窗外很安静。）',
  mika: '（难得地，她也安静下来，靠着你，一句话没说。）',
};
const QUIET: Record<string, string> = {
  qiyue: '（你们就这样安静地待着。她翻书的声音很轻。）',
  mika: '诶……你不说话啊。那……那我也不说，就一下下哦。',
};
const INTIMACY: Record<string, Record<string, string>> = {
  qiyue: {
    head: '（她愣了一下，没躲开。）……嗯。',
    hand: '（她的手很凉，却没有把手抽回去。）',
    lean: '（她靠过来，呼吸很轻。）这样……也挺好。',
  },
  mika: {
    head: '欸嘿嘿——头发会乱啦！……再摸一下也行。',
    hand: '（她一把扣住你的手指）抓到啦！不许松开！',
    lean: '（她整个人靠过来）就一会儿哦……好吧很多会儿也行。',
  },
};

export function greetReaction(id: string): Reaction { return { text: GREET[id] ?? '嗯，谢谢你。', bond: 3 }; }
export function quietReaction(id: string, deep: boolean): Reaction {
  return { text: (deep ? QUIET_DEEP : QUIET)[id] ?? '（你们安静地待着。）', bond: deep ? 6 : 4 };
}
export function intimacyReaction(id: string, act: string): Reaction {
  const text = INTIMACY[id]?.[act] ?? '……（她看着你）';
  const bond = act === 'lean' ? 7 : act === 'hand' ? 6 : 4;
  return { text, bond };
}
