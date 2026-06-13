import type { EntityBlueprint } from '../../assembly/demo.assembly.js';

// ── 棋盘布局常量 ──
// 竞技场=棋盘区（7×8 盘 x≈±150 / y≈-155..95；席上 marker 无 TEAM 位，双保险）。
export const ARENA = { minX: -170, minY: -165, maxX: 170, maxY: 110 };
// 备战席托盘（9 槽、非六角格；买入自动落座）。
export const TRAY = { originX: -176, originY: 118, gap: 44, capacity: 9 };
// 商店三大框（用户钦定小丑牌式）。
export const SHOP_XS = [-70, 0, 70];
export const SHOP_Y = 168;

// ── §4.1/§4.2 banded 结算：armed 旗开窗 → EventWhen(edge) 带条件命中 → Effect 改资源一次。
export function band(sig: string, when: Record<string, unknown>, targetId: string, value: number): Record<string, EntityBlueprint> {
  return {
    [`when_${sig}`]: { EventWhen: { signal: sig, when, mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    [`eff_${sig}`]: { Effect: { onSignal: sig, kind: 'modify-resource', targetId, op: 'add', value } } as unknown as EntityBlueprint,
  };
}
export const flagIs = (id: string): Record<string, unknown> => ({ kind: 'flag', id, equals: true });
export const resCmp = (id: string, cmp: string, value: number): Record<string, unknown> => ({ kind: 'resource', id, cmp, value });
export const and = (...of: Record<string, unknown>[]): Record<string, unknown> => ({ kind: 'and', of });
export const or = (...of: Record<string, unknown>[]): Record<string, unknown> => ({ kind: 'or', of });

// 横幅三选一：信号到 → 显 show、藏 hides（set-visible 矩阵，纯数据）。
export function visSwap(sig: string, show: string, hides: string[]): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {
    [`eff_${sig}_show`]: { Effect: { onSignal: sig, kind: 'set-visible', targetId: '', targetEntity: show, value: true } } as unknown as EntityBlueprint,
  };
  hides.forEach((h, i) => {
    out[`eff_${sig}_hide${i}`] = { Effect: { onSignal: sig, kind: 'set-visible', targetId: '', targetEntity: h, value: false } } as unknown as EntityBlueprint;
  });
  return out;
}

// ── L2 回合流程（flow-spec §3.3）：prep⟲combat⟲resolution⟲done 与 L1 round_done 握手。
// 开战倒计时：prep 末尾恒有 3 秒读数（玩家档 180 拍；快速档按比例缩、总时长不变）。
export const makeRoundFlow = (PREP_TICKS: number, RESOLUTION_TICKS: number, CELEBRATE_TICKS: number) => {
  const CD_TICKS = Math.min(180, Math.max(6, Math.floor(PREP_TICKS / 4)));
  const PREP_SECONDS = Math.max(3, Math.round(PREP_TICKS / 60));
  const TO_COMBAT = [
    { kind: 'set-flag', targetId: 'in_combat', value: true },
    { kind: 'set-flag', targetId: 'in_prep', value: false },
    { kind: 'set-flag', targetId: 'cap_armed', value: true },
    { kind: 'set-flag', targetId: 'deploy_armed', value: true },
    { kind: 'modify-resource', targetId: 'prep_left', op: 'set', value: 0 },
  ];
  return {
    id: 'round',
    current: 'prep',
    entered: false,
    elapsed: 0,
    states: [
      {
        id: 'prep',
        onEnter: [
          { kind: 'set-state', targetId: 'round_ui', value: 'prep' },
          { kind: 'set-flag', targetId: 'in_combat', value: false },
          { kind: 'set-flag', targetId: 'in_prep', value: true },
          { kind: 'set-flag', targetId: 'ready', value: false },
          { kind: 'set-flag', targetId: 'wipe_armed', value: false },
          { kind: 'set-flag', targetId: 'dmg_armed', value: false },
          { kind: 'set-flag', targetId: 'cap_armed', value: false },
          { kind: 'set-flag', targetId: 'deploy_armed', value: false },
          { kind: 'set-flag', targetId: 'income_armed', value: false },
          { kind: 'set-flag', targetId: 'shop_refresh_armed', value: true },
          { kind: 'modify-resource', targetId: 'prep_left', op: 'set', value: PREP_SECONDS },
          { kind: 'modify-resource', targetId: 'xp', op: 'add', value: 2 },
          { kind: 'modify-resource', targetId: 'dmg_scale_a', op: 'set', value: 1 },
        ],
        transitions: [
          { when: { kind: 'flag', id: 'ready', equals: true }, to: 'countdown' },
          { when: { kind: 'always' }, after: Math.max(1, PREP_TICKS - CD_TICKS), to: 'countdown' },
        ],
      },
      {
        id: 'countdown',
        onEnter: [{ kind: 'modify-resource', targetId: 'prep_left', op: 'set', value: 3 }],
        transitions: [{ when: { kind: 'always' }, after: CD_TICKS, to: 'combat', do: TO_COMBAT }],
      },
      {
        id: 'combat',
        onEnter: [{ kind: 'set-state', targetId: 'round_ui', value: 'combat' }],
        transitions: [
          { when: { kind: 'flag', id: 'team_b_present', equals: false }, after: 30, to: 'celebrate', do: [{ kind: 'set-flag', targetId: 'won', value: true }, { kind: 'modify-resource', targetId: 'win_streak', op: 'add', value: 1 }, { kind: 'modify-resource', targetId: 'lose_streak', op: 'set', value: 0 }] },
          { when: { kind: 'flag', id: 'team_a_present', equals: false }, after: 30, to: 'celebrate', do: [{ kind: 'set-flag', targetId: 'won', value: false }, { kind: 'modify-resource', targetId: 'win_streak', op: 'set', value: 0 }, { kind: 'modify-resource', targetId: 'lose_streak', op: 'add', value: 1 }, { kind: 'set-flag', targetId: 'dmg_armed', value: true }] },
          { when: { kind: 'timer', id: 'combat_clock', cmp: 'gte', value: 2700 }, to: 'celebrate', do: [{ kind: 'set-flag', targetId: 'won', value: false }, { kind: 'modify-resource', targetId: 'win_streak', op: 'set', value: 0 }, { kind: 'modify-resource', targetId: 'lose_streak', op: 'add', value: 1 }, { kind: 'set-flag', targetId: 'dmg_armed', value: true }] },
        ],
      },
      {
        id: 'celebrate',
        onEnter: [{ kind: 'set-state', targetId: 'round_ui', value: 'celebrate' }],
        transitions: [{ when: { kind: 'always' }, after: CELEBRATE_TICKS, to: 'resolution' }],
      },
      {
        id: 'resolution',
        onEnter: [
          { kind: 'set-state', targetId: 'round_ui', value: 'resolution' },
          { kind: 'set-flag', targetId: 'in_combat', value: false },
          { kind: 'set-flag', targetId: 'deploy_armed', value: false },
          { kind: 'set-flag', targetId: 'income_armed', value: true },
          { kind: 'set-flag', targetId: 'wipe_armed', value: true },
        ],
        transitions: [
          { when: { kind: 'resource', id: 'player_hp', cmp: 'lte', value: 0 }, to: 'gameover' },
          { when: { kind: 'always' }, after: RESOLUTION_TICKS, to: 'done' },
        ],
      },
      {
        id: 'done',
        onEnter: [{ kind: 'set-flag', targetId: 'round_done', value: true }],
        transitions: [{ when: { kind: 'flag', id: 'round_done', equals: false }, to: 'prep' }],
      },
      { id: 'gameover', onEnter: [{ kind: 'set-state', targetId: 'round_ui', value: 'gameover' }, { kind: 'set-flag', targetId: 'run_over', value: true }] },
    ],
  };
};

// ── L1 局流程（flow-spec §3.2）：boot → round → advance → victory/defeat。
// 关卡表全 5 阶段（§4.5）→ stage_idx>5 即通关。
export const STAGE_COUNT = 5;
export const RUN_FLOW = {
  id: 'run',
  current: 'boot',
  entered: false,
  elapsed: 0,
  states: [
    {
      id: 'boot',
      onEnter: [
        { kind: 'modify-resource', targetId: 'player_hp', op: 'set', value: 100 },
        { kind: 'modify-resource', targetId: 'stage_idx', op: 'set', value: 1 },
        { kind: 'modify-resource', targetId: 'round_idx', op: 'set', value: 1 },
      ],
      transitions: [{ when: { kind: 'always' }, to: 'round' }],
    },
    {
      id: 'round',
      onEnter: [{ kind: 'set-flag', targetId: 'round_done', value: false }],
      transitions: [
        { when: { kind: 'flag', id: 'run_over', equals: true }, to: 'defeat' },
        { when: { kind: 'and', of: [{ kind: 'flag', id: 'round_done', equals: true }, { kind: 'resource', id: 'stage_idx', cmp: 'gt', value: STAGE_COUNT }] }, to: 'victory' },
        { when: { kind: 'flag', id: 'round_done', equals: true }, to: 'advance' },
      ],
    },
    {
      id: 'advance',
      onEnter: [{ kind: 'modify-resource', targetId: 'round_idx', op: 'add', value: 1 }],
      transitions: [{ when: { kind: 'always' }, to: 'round' }],
    },
    { id: 'victory', onEnter: [{ kind: 'set-flag', targetId: 'run_won', value: true }] },
    { id: 'defeat' },
  ],
};
