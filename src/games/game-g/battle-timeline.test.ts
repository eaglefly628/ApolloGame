// battle-timeline：game-g 演出改走引擎 t3-timeline（owner 2026-07-03「用 timeline·不手写排程」）——
// 验证 timeline 宿主逐 tick 按 cue.at 确定性发演出信号 + 播完发 timeline:done（表现层据此自演，本模块只管「何时」）。
import { describe, it, expect } from 'vitest';
import { createBattleTimeline } from './battle-timeline.js';

const names = (sigs: { name: string }[]): string[] => sigs.map((s) => s.name);

describe('Game G · battle-timeline（引擎 t3-timeline 宿主·确定性演出信号）', () => {
  it('play → 逐 tick 按 cue.at 发齐信号 + 播完发 timeline:done', () => {
    const tl = createBattleTimeline();
    tl.play({ id: 'clash-post', cues: [
      { at: 0, do: { kind: 'signal', signal: 'loser-slain' } },
      { at: 2, do: { kind: 'signal', signal: 'winner-crown' } },
      { at: 4, do: { kind: 'signal', signal: 'clash-done', arg: '我方胜' } },
    ] });
    expect(names(tl.pump())).toEqual(['loser-slain']); // t=0
    expect(names(tl.pump())).toEqual([]);              // t=1（前一 tick 瞬时信号已回收·无新 cue）
    expect(names(tl.pump())).toEqual(['winner-crown']); // t=2
    expect(names(tl.pump())).toEqual([]);              // t=3
    const last = tl.pump();                            // t=4：末 cue + 播完 done 同 tick
    expect(names(last)).toContain('clash-done');
    expect(last.find((s) => s.name === 'clash-done')?.arg).toBe('我方胜'); // cue.arg 透传给表现层
    expect(names(last).some((n) => n === 'timeline:done:clash-post')).toBe(true);
  });

  it('信号铁律：只透 timeline 自发瞬时信号·不泄漏宿主内部 play 信号', () => {
    const tl = createBattleTimeline();
    tl.play({ id: 't', cues: [{ at: 0, do: { kind: 'signal', signal: 'go' } }] });
    const first = names(tl.pump());
    expect(first).toContain('go');
    expect(first.some((n) => n.startsWith('play:'))).toBe(false); // 宿主注入的起播信号不外泄
  });
});
