import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Component } from '@engine/core/types.js';
import type { State, StateChanged, Text, Resource, Flag } from '@engine/protocol/components.js';
import { buildGameBBlueprint } from './blueprint.js';
import { optionAvailable } from '@skills/tier3/index.js';
import { SCENE_01 } from './data/dialogue.js';

// 端到端：真实 World.tick() 跑 Game B v0.2，验证 state/resource/flag/text + event-when/effect-apply
// + 通用 dialogue 运行器（R15 下沉，脚本=世界里的 DialogueScript 数据组件）协作，
// 涌现 VN 循环 + 阈值事件链 + 条件门控选项。Game B = 纯数据（manifest + scene_01.json + 资产 + 主题）。
function loadGameB(): World {
  const w = new World();
  const bp = buildGameBBlueprint();
  for (const cap of bp.capabilities) for (const s of cap.systems) w.addSystem(s);
  for (const [id, comps] of Object.entries(bp.entities)) {
    w.createEntity(id);
    for (const [type, data] of Object.entries(comps)) w.addComponent(id, { ...data, type } as Component);
  }
  return w;
}

const cur = (w: World): string => w.getComponent<State>('dialogue', 'State')!.current;
const txt = (w: World): string => w.getComponent<Text>('dialogue', 'Text')!.content;
const res = (w: World, id: string): number => w.getComponent<Resource>(id, 'Resource')!.current;
const flag = (w: World, id: string): boolean => w.getComponent<Flag>(id, 'Flag')!.active;

function advance(w: World): void {
  w.addComponent('dialogue', { type: 'DialogueAdvance' } as Component);
  w.tick();
}
function choose(w: World, index: number): void {
  w.addComponent('dialogue', { type: 'DialogueChoose', index } as Component);
  w.tick();
}

describe('Game B v0.2 — 对话/属性/条件门控/阈值事件链', () => {
  it('拓扑无环：runner(runsBefore) 排在 resource-apply / state-sync 之前', () => {
    const w = loadGameB();
    w.tick();
    const ids = w.getSortedSystems().map((s) => s.id);
    expect(ids.indexOf('dialogue')).toBeLessThan(ids.indexOf('resource-apply'));
    expect(ids.indexOf('dialogue')).toBeLessThan(ids.indexOf('state-sync'));
    // 阈值链系统都在
    expect(ids).toContain('event-when');
    expect(ids).toContain('effect-apply');
  });

  it('7 属性齐备 + 首行渲染', () => {
    const w = loadGameB();
    w.tick();
    for (const id of ['charm', 'wisdom', 'stamina', 'career', 'affection_S', 'affection_T', 'affection_U']) {
      expect(w.getComponent<Resource>(id, 'Resource')).toBeTruthy();
    }
    expect(txt(w)).toContain('你就是新来的制作人');
  });

  it('选择改好感（按 id 全局路由，无 entityId===resourceId 假设）+ 置 flag + 分支', () => {
    const w = loadGameB();
    w.tick();
    advance(w);
    advance(w); // 到 s1_choice
    expect(cur(w)).toBe('s1_choice');
    choose(w, 0); // +5 → s1_impressed
    expect(res(w, 'affection_S')).toBe(5);
    expect(flag(w, 'met_S')).toBe(true);
    expect(cur(w)).toBe('s1_impressed');
  });

  it('阈值事件链：好感_S 越过 5（edge）→ 信号 → effect 置 S_warmed_flag（纯配置、零游戏代码）', () => {
    const w = loadGameB();
    w.tick();
    advance(w);
    advance(w);
    expect(flag(w, 'S_warmed_flag')).toBe(false);
    choose(w, 0); // +5：本 tick resource-apply 应用→event-when 越线发信号→effect-apply(Commit) 置 flag
    expect(res(w, 'affection_S')).toBe(5);
    expect(flag(w, 'S_warmed_flag')).toBe(true); // 链合龙
  });

  it('阈值未达不触发：选 +2 → 好感 2 < 5 → S_warmed_flag 仍 false', () => {
    const w = loadGameB();
    w.tick();
    advance(w);
    advance(w);
    choose(w, 1); // +2
    expect(res(w, 'affection_S')).toBe(2);
    expect(flag(w, 'S_warmed_flag')).toBe(false);
  });

  it('条件门控选项：阈值解锁门——选 +5 路线后，s1_probe 的"顺势靠近"(requires S_warmed_flag) 才可选', () => {
    const w = loadGameB();
    w.tick();
    advance(w);
    advance(w);
    choose(w, 0); // +5 → 触发 S_warmed_flag
    advance(w); // s1_impressed → s1_probe
    expect(cur(w)).toBe('s1_probe');
    const probe = SCENE_01.s1_probe;
    if (probe.kind !== 'choice') throw new Error('probe should be choice');
    // 属性门 charm>=12（charm=10）→ 隐藏；阈值门 S_warmed_flag → 解锁
    expect(optionAvailable(w, probe.options[0])).toBe(false); // 检定差一点
    expect(optionAvailable(w, probe.options[1])).toBe(true); // 保底
    expect(optionAvailable(w, probe.options[2])).toBe(true); // 阈值已解锁
    choose(w, 2); // 选解锁的特殊选项 → s1_special
    expect(cur(w)).toBe('s1_special');
    expect(res(w, 'affection_S')).toBe(10); // 5 + 5
  });

  it('条件门控：未走 +5 路线 → "顺势靠近"不可选，且 runner 拒绝选它', () => {
    const w = loadGameB();
    w.tick();
    advance(w);
    advance(w);
    choose(w, 1); // +2，不触发阈值
    advance(w); // s1_polite → s1_probe
    expect(cur(w)).toBe('s1_probe');
    const probe = SCENE_01.s1_probe;
    if (probe.kind !== 'choice') throw new Error('probe should be choice');
    expect(optionAvailable(w, probe.options[2])).toBe(false);
    choose(w, 2); // 试图选不可用选项 → runner 应拒绝（不跳转）
    expect(cur(w)).toBe('s1_probe'); // 仍停在 probe
  });

  it('确定性：同一选择序列两次跑出完全相同的世界快照', () => {
    const run = (): string => {
      const w = loadGameB();
      w.tick();
      advance(w);
      advance(w);
      choose(w, 0);
      advance(w);
      choose(w, 2);
      return JSON.stringify(w.snapshot());
    };
    expect(run()).toBe(run());
  });
});

describe('Game B v0.3 — 日程循环 / 周期计数 / 30·60 阈值 / 周期到点进结局（全数据驱动）', () => {
  // 走完开场抵达日程 hub（开场给 affection_S=3）。
  function toHub(w: World): void {
    w.tick(); // s1_l0
    advance(w); // s1_l1
    advance(w); // s1_choice
    choose(w, 1); // 请多指教 +2 → s1_polite
    advance(w); // s1_probe
    choose(w, 1); // 老实说 +1 → s1_neutral
    advance(w); // s1_end
    advance(w); // → hub
  }
  // 在 hub 选一个行动并走完它的小场景回到 hub。
  function act(w: World, index: number): void {
    choose(w, index); // hub → sc_*
    advance(w); // sc_* → hub
  }

  it('开场结束接入日程 hub（choice，≥4 个常规行动）', () => {
    const w = loadGameB();
    toHub(w);
    expect(cur(w)).toBe('hub');
    const hub = SCENE_01.hub;
    if (hub.kind !== 'choice') throw new Error('hub should be choice');
    expect(hub.options.length).toBeGreaterThanOrEqual(4);
    expect(res(w, 'cycle')).toBe(0);
  });

  it('行动推进周期计数 + 结算数值（投入工作：事业↑ 体力↓ 周期+1）', () => {
    const w = loadGameB();
    toHub(w);
    act(w, 0); // 投入工作
    expect(res(w, 'career')).toBe(8);
    expect(res(w, 'stamina')).toBe(16); // 20 - 4
    expect(res(w, 'cycle')).toBe(1);
    expect(cur(w)).toBe('hub'); // 回到日程
  });

  it('阈值 30：约会攒到好感≥30 → 置 S_30_flag → 解锁"看展(特别)"选项', () => {
    const w = loadGameB();
    toHub(w); // affection_S = 3
    expect(flag(w, 'S_30_flag')).toBe(false);
    for (let i = 0; i < 4; i++) act(w, 1); // 约 S 出来 ×4：3 → 35（耗光体力 20→0）
    expect(res(w, 'affection_S')).toBe(35);
    expect(flag(w, 'S_30_flag')).toBe(true); // 阈值事件链置位（纯数据）
    act(w, 3); // 休息恢复体力（看展还要 stamina≥6）
    const hub = SCENE_01.hub;
    if (hub.kind !== 'choice') throw new Error('hub choice');
    expect(optionAvailable(w, hub.options[4])).toBe(true); // requires S_30_flag 且 体力≥6 → 解锁
  });

  it('周期到点（cycle≥8）→ EventWhen→Effect set-state 强制进入 ending', () => {
    const w = loadGameB();
    toHub(w);
    for (let i = 0; i < 7; i++) act(w, 3); // 在家休息 ×7 → cycle 7
    expect(res(w, 'cycle')).toBe(7);
    expect(cur(w)).toBe('hub');
    choose(w, 3); // 第 8 个行动：cycle→8 当 tick event-when 发 cycle_over → effect set-state dialogue=ending
    expect(res(w, 'cycle')).toBe(8);
    expect(cur(w)).toBe('ending'); // 被强制跳到结局（Commit 阶段覆写 State.current）
  });

  it('结局按好感 flag 门控：到 30 可达"挚友"，未到 60 则"真爱"隐藏', () => {
    const w = loadGameB();
    toHub(w);
    for (let i = 0; i < 4; i++) act(w, 1); // 4 次约会 → S_30_flag（好感 35，未到 60）
    for (let i = 0; i < 4; i++) act(w, 3); // 4 次休息把 cycle 推到 8 → 进 ending
    expect(cur(w)).toBe('ending');
    const ending = SCENE_01.ending;
    if (ending.kind !== 'choice') throw new Error('ending choice');
    expect(optionAvailable(w, ending.options[1])).toBe(false); // 真爱 requires S_60_flag → 隐藏
    expect(optionAvailable(w, ending.options[2])).toBe(true); // 挚友 requires S_30_flag → 可达
    expect(optionAvailable(w, ending.options[6])).toBe(true); // 独立结局 → 保底
    choose(w, 2); // 选挚友结局
    expect(cur(w)).toBe('end_s_partner');
    expect(txt(w)).toContain('挚友结局');
  });

  it('多角色线（纯数据扩展，零新代码）：约 T ×4 → affection_T≥30 → T_30_flag → 解锁 T 结局', () => {
    const w = loadGameB();
    toHub(w);
    expect(flag(w, 'T_30_flag')).toBe(false);
    for (let i = 0; i < 4; i++) act(w, 5); // 约 T 出来 ×4：0 → 32
    expect(res(w, 'affection_T')).toBe(32);
    expect(flag(w, 'T_30_flag')).toBe(true); // T 线阈值事件链（与 S 同构，只是数据）
    for (let i = 0; i < 4; i++) act(w, 3); // 休息把 cycle 推到 8 → ending
    expect(cur(w)).toBe('ending');
    const ending = SCENE_01.ending;
    if (ending.kind !== 'choice') throw new Error('ending choice');
    expect(optionAvailable(w, ending.options[3])).toBe(true); // T 结局 requires T_30_flag
    expect(optionAvailable(w, ending.options[2])).toBe(false); // S 挚友 requires S_30（没约过 S）
    choose(w, 3);
    expect(cur(w)).toBe('end_t');
  });

  it('数值约束·体力门控：耗光体力 → 耗体力行动不可选(且 runner 拒绝)，休息后恢复', () => {
    const w = loadGameB();
    toHub(w);
    expect(res(w, 'stamina')).toBe(20);
    for (let i = 0; i < 4; i++) act(w, 1); // 约会 ×4：体力 20→0
    expect(res(w, 'stamina')).toBe(0);
    const hub = SCENE_01.hub;
    if (hub.kind !== 'choice') throw new Error('hub choice');
    expect(optionAvailable(w, hub.options[1])).toBe(false); // 约会 requires 体力≥5 → 体力 0 不可选
    expect(optionAvailable(w, hub.options[3])).toBe(true); // 休息 永远可选
    choose(w, 1); // 试图约会 → runner 拒绝（体力不足）
    expect(cur(w)).toBe('hub'); // 没跳转，仍在日程
    act(w, 3); // 休息 → 体力 +8
    expect(res(w, 'stamina')).toBe(8);
    expect(optionAvailable(w, hub.options[1])).toBe(true); // 恢复后可约会
  });

  it('数值决定命运·事业线：攒事业≥40 → career_star → 解锁高回报「主导大项目」与事业结局', () => {
    const w = loadGameB();
    toHub(w);
    for (let i = 0; i < 4; i++) act(w, 0); // 投入工作 ×4：事业 32，体力 20→4
    expect(res(w, 'career')).toBe(32);
    act(w, 3); // 休息：体力 4→12
    const hub = SCENE_01.hub;
    if (hub.kind !== 'choice') throw new Error('hub choice');
    expect(optionAvailable(w, hub.options[6])).toBe(true); // 主导大项目 requires 事业≥20 且 体力≥8
    act(w, 6); // 主导大项目：事业 32+15=47，体力 12-8=4
    expect(res(w, 'career')).toBe(47);
    expect(flag(w, 'career_star_flag')).toBe(true); // 事业里程碑事件链（career≥40）
    act(w, 3); // 休息 cycle7
    choose(w, 3); // 第 8 个行动 → cycle 8 → 强制进 ending
    expect(cur(w)).toBe('ending');
    const ending = SCENE_01.ending;
    if (ending.kind !== 'choice') throw new Error('ending choice');
    expect(optionAvailable(w, ending.options[0])).toBe(true); // 事业结局 requires career_star_flag
    choose(w, 0);
    expect(cur(w)).toBe('end_career');
    expect(txt(w)).toContain('事业结局');
  });

  it('确定性：一整轮日程序列两次跑出完全相同快照', () => {
    const play = (): string => {
      const w = loadGameB();
      toHub(w);
      act(w, 1);
      act(w, 0);
      act(w, 1);
      act(w, 3);
      return JSON.stringify(w.snapshot());
    };
    expect(play()).toBe(play());
  });
});
