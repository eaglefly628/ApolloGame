import { describe, it, expect } from 'vitest';
import { World } from '@zerocraft/engine/engine/core/world.js';
import type { State, Resource } from '@zerocraft/engine/engine/protocol/components.js';
import { QIYUE, MIKA, companionById } from './characters.js';
import {
  entryAt, sceneOf, hoursAway, absenceFor, stageOf, displayTemp, deskView, greetOf,
  type ClockReading, type SessionRecord,
} from './companion.js';
import { buildPocketBlueprint, pocketGraph, R_WARMTH, POCKET_START } from './pocket.js';
import { DIALOGUE_ACTION_CHOOSE } from '@zerocraft/engine/skills/tier3/index.js';
import type { InputQueue, RawInputData } from '@zerocraft/engine/engine/protocol/components.js';

const HOUR = 3_600_000;
const clockAt = (hour: number, opts: Partial<ClockReading> = {}): ClockReading =>
  ({ hour, minute: 0, weekday: 3, nowMs: opts.nowMs ?? 1_750_000_000_000, ...opts });
const fresh = (over: Partial<SessionRecord> = {}): SessionRecord =>
  ({ lastSeenMs: 0, firstMetMs: 0, emotionTemp: 0.2, interactions: 0, ...over });

// ═══════════════════════════════════════════════════════════════
//  GDD §四 时间感知系统 —— 框架最重要的底层系统
// ═══════════════════════════════════════════════════════════════
describe('Game X · 时间感知：时刻 → 当前活动（七月作息表）', () => {
  const cases: Array<[number, string]> = [
    [7, 'wake'], [8, 'wake'], [10, 'read'], [12, 'nap'], [15, 'write'],
    [19, 'wait'], [22, 'lively'], [23, 'sleep'], [3, 'sleep'],
  ];
  for (const [hour, pose] of cases) {
    it(`${hour}:00 → ${pose}`, () => {
      expect(entryAt(QIYUE, hour).pose).toBe(pose);
    });
  }

  it('跨午夜段（23→7 睡觉）覆盖凌晨', () => {
    expect(entryAt(QIYUE, 0).pose).toBe('sleep');
    expect(entryAt(QIYUE, 6).pose).toBe('sleep');
  });

  it('日程覆盖全 24 小时（无空洞）', () => {
    for (const c of [QIYUE, MIKA]) {
      for (let h = 0; h < 24; h++) expect(entryAt(c, h)).toBeDefined();
    }
  });

  it('Mika 的活跃度在夜里最高（21+ energy=3）', () => {
    expect(entryAt(MIKA, 22).energy).toBe(3);
    expect(entryAt(MIKA, 3).energy).toBe(0);
  });
});

describe('Game X · 场景 = 场景基调 × 天气（GDD §五 48 组合）', () => {
  it('雨天午后 vs 晴天午后 → 不同 sceneId', () => {
    const e = entryAt(QIYUE, 15);
    expect(sceneOf(e, 'rainy').id).toBe('afternoon_rainy');
    expect(sceneOf(e, 'sunny').id).toBe('afternoon_sunny');
    expect(sceneOf(e, 'rainy').id).not.toBe(sceneOf(e, 'sunny').id);
  });
});

// ═══════════════════════════════════════════════════════════════
//  GDD §四 缺席感知 —— 不是惩罚，是真实反应
// ═══════════════════════════════════════════════════════════════
describe('Game X · 缺席感知（24/48/72h 痕迹）', () => {
  it('hoursAway 计算正确（首次无 lastSeen → 0）', () => {
    const now = 100 * HOUR;
    expect(hoursAway(now, 0)).toBe(0);
    expect(hoursAway(now, now - 30 * HOUR)).toBeCloseTo(30);
  });

  it('按缺席时长匹配对应痕迹（取达到阈值中最长的）', () => {
    expect(absenceFor(QIYUE, 10)).toBeNull(); // <24h 无痕迹
    expect(absenceFor(QIYUE, 25)?.hours).toBe(24);
    expect(absenceFor(QIYUE, 50)?.hours).toBe(48);
    expect(absenceFor(QIYUE, 100)?.hours).toBe(72); // 关灯，仅屏幕微光
  });

  it('deskView 在缺席时浮现痕迹文字', () => {
    const now = 200 * HOUR;
    const rec = fresh({ lastSeenMs: now - 50 * HOUR });
    const v = deskView(QIYUE, clockAt(15, { nowMs: now }), 'sunny', rec);
    expect(v.absenceNote).toContain('茶杯');
  });
});

// ═══════════════════════════════════════════════════════════════
//  GDD §八 关系成长（阶段）+ 情感温度
// ═══════════════════════════════════════════════════════════════
describe('Game X · 关系阶段（初识/熟悉/深处）', () => {
  it('新关系 = 初识期', () => {
    expect(stageOf(fresh(), 1_750_000_000_000)).toBe('acquaint');
  });
  it('一个月 / 14 次互动 → 熟悉期', () => {
    const now = 1_750_000_000_000;
    expect(stageOf(fresh({ firstMetMs: now - 40 * 86_400_000 }), now)).toBe('familiar');
    expect(stageOf(fresh({ interactions: 14 }), now)).toBe('familiar');
  });
  it('半年 + 60 次互动 → 深处期', () => {
    const now = 1_750_000_000_000;
    expect(stageOf(fresh({ firstMetMs: now - 200 * 86_400_000, interactions: 70 }), now)).toBe('deep');
  });
});

describe('Game X · 情感温度随缺席衰减', () => {
  it('24h 内不衰减；越久越冷', () => {
    expect(displayTemp(fresh({ emotionTemp: 0.8 }), 10)).toBeCloseTo(0.8);
    expect(displayTemp(fresh({ emotionTemp: 0.8 }), 48)).toBeLessThan(0.8);
    expect(displayTemp(fresh({ emotionTemp: 0.05 }), 300)).toBeGreaterThanOrEqual(0); // 夹 [0,1]
  });
});

// ═══════════════════════════════════════════════════════════════
//  GDD §六 Pocket Mode 见面第一句（按缺席/时段派生）
// ═══════════════════════════════════════════════════════════════
describe('Game X · 拿起设备：第一句问候按情境派生', () => {
  it('久违回来 → back 问候', () => {
    const now = 300 * HOUR;
    const g = greetOf(QIYUE, clockAt(15, { nowMs: now }), fresh({ lastSeenMs: now - 50 * HOUR }));
    expect(g.firstLine).toBe(QIYUE.firstLine.back);
  });
  it('深夜拿起（她睡着）→ asleep 问候', () => {
    const g = greetOf(QIYUE, clockAt(2), fresh({ lastSeenMs: clockAt(2).nowMs }));
    expect(g.asleep).toBe(true);
    expect(g.firstLine).toBe(QIYUE.firstLine.asleep);
  });
  it('白天常规 → day 问候', () => {
    const now = clockAt(15).nowMs;
    const g = greetOf(MIKA, clockAt(15, { nowMs: now }), fresh({ lastSeenMs: now - 2 * HOUR }));
    expect(g.firstLine).toBe(MIKA.firstLine.day);
  });
});

// ═══════════════════════════════════════════════════════════════
//  GDD §六 Pocket Mode 对话数据流（引擎 dialogue 能力跑脚本对话）
// ═══════════════════════════════════════════════════════════════
function loadPocket(c = QIYUE): World {
  const bp = buildPocketBlueprint(c, 20);
  const w = new World();
  // bp.capabilities 已含 dialogue + 资源/状态/文本/随机原子（effects 落地）；逐 cap 注册一次即可。
  for (const cap of bp.capabilities) for (const sys of cap.systems) w.addSystem(sys);
  for (const [eid, comps] of Object.entries(bp.entities)) {
    w.createEntity(eid);
    for (const [type, data] of Object.entries(comps)) w.addComponent(eid, { ...data, type } as never);
  }
  return w;
}
function chooseArg(w: World, index: number): void {
  const actions: RawInputData[] = [{ source: 'p1', key: DIALOGUE_ACTION_CHOOSE, arg: String(index), phase: 'action' }];
  if (!w.hasComponent('global-input', 'InputQueue')) w.createEntity('global-input');
  w.addComponent('global-input', { type: 'InputQueue', actions } as InputQueue);
}
const warmthOf = (w: World): number => w.getComponent<Resource>(R_WARMTH, 'Resource')!.current;
const curNode = (w: World): string => w.getComponent<State>('dialogue', 'State')!.current;

describe('Game X · Pocket 对话：选项 effects 经 arg 信号改情感温度', () => {
  it('起点是 hub 选择节点', () => {
    const w = loadPocket();
    expect(curNode(w)).toBe(POCKET_START);
    expect(pocketGraph(QIYUE).hub.kind).toBe('choice');
  });

  it('选「我今天有点累」(index 1·warm+8) → 暖意上升 + 跳到回应行', () => {
    const w = loadPocket();
    const before = warmthOf(w);
    chooseArg(w, 1);
    w.tick();
    expect(warmthOf(w)).toBe(before + 8);
    expect(curNode(w)).toBe('q_tired');
  });

  it('告别选项（index 3）→ 终结节点（next:null）', () => {
    const w = loadPocket();
    chooseArg(w, 3);
    w.tick();
    expect(curNode(w)).toBe('q_bye');
    expect(pocketGraph(QIYUE).q_bye).toMatchObject({ kind: 'line', next: null });
  });
});

describe('Game X · 角色注册', () => {
  it('companionById 容错回退到七月', () => {
    expect(companionById('mika').id).toBe('mika');
    expect(companionById('nope').id).toBe('qiyue');
  });
});
