// VN 真世界守卫（REQ-DIALOGUE M1 整改）：证明展台真跑——advance/choose 真推进世界，effects/setFlag/门控动态解锁，
// source 投影随 State.current 真刷新（非 literal 静态）。这就是「活范例纪律达标」的机器证据。
import { describe, it, expect } from 'vitest';
import { createDialogueWorld } from './dialogue-world.js';

describe('Game I · VN 真 dialogueCapability 世界', () => {
  it('初始停在 start line 节点（投影 speaker/text/kind·无选项）', () => {
    const w = createDialogueWorld();
    const v = w.source.current('vn-dlg')!;
    expect(v.kind).toBe('line');
    expect(v.speaker).toBe('林清越');
    expect(v.text).toContain('你终于来了');
    expect(v.options).toBeUndefined(); // line 节点无选项
    expect(w.affinity()).toBe(8);      // 好感起手 8
  });

  it('advance → 进 pick choice 节点（3 选项·第三项好感门控 available:false）', () => {
    const w = createDialogueWorld();
    w.advance();
    const v = w.source.current('vn-dlg')!;
    expect(v.kind).toBe('choice');
    expect(v.options).toHaveLength(3);
    expect(v.options!.map((o) => o.available)).toEqual([true, true, false]); // 握手初始锁（warmed=false）
  });

  it('选暖场项 → 好感真涨(8→14) + setFlag warmed + 回环 pick → 握手动态解锁', () => {
    const w = createDialogueWorld();
    w.advance();          // start → pick
    w.choose(0);          // 「就没打算走」→ aff+6, warmed=true → warm
    expect(w.affinity()).toBe(14);
    // warm 是 line 节点 → 再 advance 回到 pick
    let v = w.source.current('vn-dlg')!;
    expect(v.kind).toBe('line');
    expect(v.text).toContain('直白');
    w.advance();          // warm → pick（回环）
    v = w.source.current('vn-dlg')!;
    expect(v.kind).toBe('choice');
    expect(v.options![2].available).toBe(true); // 暖场后握手真解锁（投影随世界 flag 刷新·非静态）
  });

  it('解锁后选握手 → hold 结局节点（ended）', () => {
    const w = createDialogueWorld();
    w.advance(); w.choose(0); w.advance(); // 暖场 + 回环
    w.choose(2);                            // 握手 → hold
    const v = w.source.current('vn-dlg')!;
    expect(v.kind).toBe('line');
    expect(v.text).toContain('别松手');
    expect(w.ended()).toBe(true);           // next=null 结局
  });

  it('未暖场时选锁定项无效（optionAvailable 门控·世界拒绝）', () => {
    const w = createDialogueWorld();
    w.advance();     // → pick（warmed=false）
    w.choose(2);     // 握手锁 → 世界不跳转
    const v = w.source.current('vn-dlg')!;
    expect(v.kind).toBe('choice'); // 仍停在 pick
  });

  it('未命中实体 id → undefined（安全）', () => {
    const w = createDialogueWorld();
    expect(w.source.current('nope')).toBeUndefined();
  });
});
