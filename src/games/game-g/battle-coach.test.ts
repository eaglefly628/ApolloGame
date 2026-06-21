import { describe, it, expect } from 'vitest';
import { collectActiveCoachmarks } from '@renderer/coachmark.js';
import { BATTLE_COACH, nextCoachStep, makeCoachWorld } from './battle-coach.js';

describe('Game G · 战斗新手引导（coachmark 能力接入·甲）', () => {
  it('nextCoachStep：流程=抽天罗→抽扑克→结束→打天罡→结束→放牌→结束→掷骰（owner 2026-06-21 重排）；打天罡步无天罡则跳过', () => {
    expect(nextCoachStep({})?.flag).toBe('seen_combat_draw_tg'); // 先抽天罡
    expect(nextCoachStep({ seen_combat_draw_tg: true })?.flag).toBe('seen_combat_draw_pk'); // 再抽扑克
    const d2 = { seen_combat_draw_tg: true, seen_combat_draw_pk: true };
    expect(nextCoachStep(d2)?.flag).toBe('seen_combat_end1');
    const d3 = { ...d2, seen_combat_end1: true };
    // 打天罡步：手里无天罡 → 跳过(不卡死) → 落到放牌；有天罡 → 出
    expect(nextCoachStep(d3, { hasTengang: true })?.flag).toBe('seen_combat_cast');
    expect(nextCoachStep(d3, { hasTengang: false })?.flag).toBe('seen_combat_end2'); // 无天罡 → 跳过 cast → 落到其后的结束回合(不卡死)
    const d4 = { ...d3, seen_combat_cast: true };
    expect(nextCoachStep(d4, { hasTengang: true })?.flag).toBe('seen_combat_end2');
    const d6 = { ...d4, seen_combat_end2: true, seen_combat_deploy: true, seen_combat_end3: true };
    expect(nextCoachStep(d6, { hasTengang: true })?.flag).toBe('seen_combat_roll'); // 最后=掷骰
    expect(nextCoachStep({ ...d6, seen_combat_roll: true }, { hasTengang: true })).toBeNull();
  });

  it('makeCoachWorld + setStep：可见时该步 coachmark 激活并指向其 anchor', () => {
    const { world, setStep } = makeCoachWorld();
    expect(collectActiveCoachmarks(world)).toHaveLength(0); // 初始灭
    setStep(BATTLE_COACH[0], true);
    const active = collectActiveCoachmarks(world);
    expect(active).toHaveLength(1);
    expect(active[0].anchor).toBe('combat-draw'); // 首步=抽牌（doc28 §三）
    expect(active[0].text).toContain('抽牌');
    // 切到第二步(抽扑克·仍指抽牌钮)
    setStep(BATTLE_COACH[1], true);
    expect(collectActiveCoachmarks(world)[0].anchor).toBe('combat-draw');
    // 不可见(特写/忙) → 灭
    setStep(BATTLE_COACH[1], false);
    expect(collectActiveCoachmarks(world)).toHaveLength(0);
    // 全看完(null) → 灭
    setStep(null, true);
    expect(collectActiveCoachmarks(world)).toHaveLength(0);
  });
});
