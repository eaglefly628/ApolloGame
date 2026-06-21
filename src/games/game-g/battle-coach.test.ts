import { describe, it, expect } from 'vitest';
import { collectActiveCoachmarks } from '@renderer/coachmark.js';
import { BATTLE_COACH, nextCoachStep, makeCoachWorld } from './battle-coach.js';

describe('Game G · 战斗新手引导（coachmark 能力接入·甲）', () => {
  it('nextCoachStep：按 seen 取第一条未看过；天罡步无天罡则跳过（流程：放牌→结束→抽牌→天罡）', () => {
    expect(nextCoachStep({})?.flag).toBe('seen_combat_deploy'); // owner 2026-06-21：先放牌
    expect(nextCoachStep({ seen_combat_deploy: true })?.flag).toBe('seen_combat_endturn');
    expect(nextCoachStep({ seen_combat_deploy: true, seen_combat_endturn: true })?.flag).toBe('seen_combat_draw');
    const done3 = { seen_combat_deploy: true, seen_combat_endturn: true, seen_combat_draw: true };
    // 天罡步：无天罡 → 跳过 → 全完
    expect(nextCoachStep(done3, { hasTengang: false })).toBeNull();
    expect(nextCoachStep(done3, { hasTengang: true })?.flag).toBe('seen_combat_tiangang');
    expect(nextCoachStep({ ...done3, seen_combat_tiangang: true })).toBeNull();
  });

  it('makeCoachWorld + setStep：可见时该步 coachmark 激活并指向其 anchor', () => {
    const { world, setStep } = makeCoachWorld();
    expect(collectActiveCoachmarks(world)).toHaveLength(0); // 初始灭
    setStep(BATTLE_COACH[0], true);
    const active = collectActiveCoachmarks(world);
    expect(active).toHaveLength(1);
    expect(active[0].anchor).toBe('combat-deploy'); // 首步=放牌
    expect(active[0].text).toContain('放牌');
    // 切到结束回合步
    setStep(BATTLE_COACH[1], true);
    expect(collectActiveCoachmarks(world)[0].anchor).toBe('combat-end');
    // 不可见(特写/忙) → 灭
    setStep(BATTLE_COACH[1], false);
    expect(collectActiveCoachmarks(world)).toHaveLength(0);
    // 全看完(null) → 灭
    setStep(null, true);
    expect(collectActiveCoachmarks(world)).toHaveLength(0);
  });
});
