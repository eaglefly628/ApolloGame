import { describe, it, expect } from 'vitest';
import { collectActiveCoachmarks } from '@renderer/coachmark.js';
import { BATTLE_COACH, nextCoachStep, makeCoachWorld } from './battle-coach.js';

describe('Game G · 战斗新手引导（coachmark 能力接入·甲）', () => {
  it('nextCoachStep：流程=抽牌→结束→放牌→再结束→打天罡（doc28 §三·先抽牌修「放牌断掉」）；打天罡步无天罡则跳过', () => {
    expect(nextCoachStep({})?.flag).toBe('seen_combat_draw'); // 先抽牌（turn1 必可抽·不会断）
    expect(nextCoachStep({ seen_combat_draw: true })?.flag).toBe('seen_combat_endturn');
    expect(nextCoachStep({ seen_combat_draw: true, seen_combat_endturn: true })?.flag).toBe('seen_combat_deploy');
    const done3 = { seen_combat_draw: true, seen_combat_endturn: true, seen_combat_deploy: true };
    // 放完→「再结束回合」(推进/掷命) 总会出（核心步·非天罡门）
    expect(nextCoachStep(done3, { hasTengang: false })?.flag).toBe('seen_combat_endturn2');
    const done4 = { ...done3, seen_combat_endturn2: true };
    // 打天罡步：手里无天罡 → 跳过(不卡死) → 全完；有天罡 → 出
    expect(nextCoachStep(done4, { hasTengang: false })).toBeNull();
    expect(nextCoachStep(done4, { hasTengang: true })?.flag).toBe('seen_combat_tiangang');
    expect(nextCoachStep({ ...done4, seen_combat_tiangang: true }, { hasTengang: true })).toBeNull();
  });

  it('makeCoachWorld + setStep：可见时该步 coachmark 激活并指向其 anchor', () => {
    const { world, setStep } = makeCoachWorld();
    expect(collectActiveCoachmarks(world)).toHaveLength(0); // 初始灭
    setStep(BATTLE_COACH[0], true);
    const active = collectActiveCoachmarks(world);
    expect(active).toHaveLength(1);
    expect(active[0].anchor).toBe('combat-draw'); // 首步=抽牌（doc28 §三）
    expect(active[0].text).toContain('抽牌');
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
