import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import { overlapDetectCapability } from '@skills/atoms/overlap-detect/index.js';
import { destroyCapability } from '@skills/atoms/destroy/index.js';
import { timerCapability } from '@skills/atoms/timer/index.js';
import { resourceCapability } from '@atom-skills/index.js';
import { lifetimeCapability, hierarchyResolveCapability, hierarchyCascadeCapability, motionApplyCapability, tweenCapability } from '@skills/tier1/index.js';
import {
  trayCapability, steeringCapability, triggerZoneCapability, hitboxCapability, overTimeCapability,
  mortalCapability, eventWhenCapability, effectApplyCapability, zoneOccupancyCapability, gaugeCapability,
  clickableCapability, selfRuleCapability, cardPileCapability, craftRecipeCapability, textBindingCapability,
  groupCountCapability, cameraFollowCapability, gridMoveCapability, dragPlaceCapability,
} from '@skills/tier2/index.js';
import { prefabCapability, casterCapability, aggroCapability, flowCapability, mergeRuleCapability } from '@skills/tier3/index.js';
import { F_FX_STRIKE, F_FX_DRAIN, F_HEX_WARM, F_HEX_COOL, F_PEDESTAL, F_THRONE, F_HERO } from './assets.js';
import { boardEntities, project, offsetToAxial, COLS, ROWS, TILE, ORIGIN_X, ORIGIN_Y, LAYOUT } from './hex.js';
import {
  TEAM_A, TEAM_B,
  SHOPSLOT_BITS, SHOPSLOT_ALL, RUNE, BENCH_OCC, MARKER_VIS, PROJ, RESULT, LOOT, PROTAG, BAG, EQUIP, FACT_SHU,
  HP_SCALE, FONT_DISPLAY, FONT_BODY, FONT_NUM, xf, sprite, zlift, chrome,
} from './constants.js';
import { type Faction, ROSTER as BASE_ROSTER, rosterFor, codesFor } from './heroes.js';
import { STAGES, PVE_WAVES, MOB_BASE_HP } from './stages.js';
import { SHOP_DECK, SELL_PRICE } from './economy.js';
import { templatesFor, slotEntity } from './combat.js';
import { ARENA, TRAY, SHOP_XS, SHOP_Y, band, flagIs, resCmp, and, or, visSwap, makeRoundFlow, RUN_FLOW } from './flow.js';

// ── 向后兼容重导出（test + index.ts 直接从 './blueprint.js' 导入）──
export { TEAM_A, TEAM_B, FROZEN, SHU_RED, WEI_BLUE, BAG, EQUIP } from './constants.js';
export { rosterFor, type Faction } from './heroes.js';
export { GAME_F_TEMPLATES } from './combat.js';

export const GAME_F_HERO_IDS = BASE_ROSTER.map((h) => h.id);

// 敌阵预览（点将台：展示当前阶段将对阵哪些敌人）。
export function gameFEnemyPreview(stageIdx: number, roundIdx: number, pf: Faction = 'shu'): { name: string; x: number; y: number }[] {
  if (stageIdx <= 1 || roundIdx >= 5) return [];
  const stage = STAGES.find((s) => s.n === stageIdx);
  if (!stage) return [];
  const enemyHeroes = rosterFor(pf).filter((h) => h.team === TEAM_B);
  return stage.comp.map((c) => {
    const eh = enemyHeroes[c.ei];
    const a = offsetToAxial(c.q, c.r);
    const p = project(a.q, a.r);
    return { name: eh?.name ?? '魏', x: p.x, y: p.y };
  });
}

export interface GameFPacing { prepTicks?: number; resolutionTicks?: number; celebrateTicks?: number; playerFaction?: Faction }

export function buildGameFBlueprint(pacing: GameFPacing = {}): WorldBlueprint {
  const PREP_TICKS = pacing.prepTicks ?? 1800; // 30s@60tps
  const RESOLUTION_TICKS = pacing.resolutionTicks ?? 240; // 4s
  const CELEBRATE_TICKS = pacing.celebrateTicks ?? 110; // ~1.8s 战后亮相
  const ROSTER = rosterFor(pacing.playerFaction ?? 'shu');
  const HERO_CODE = codesFor(ROSTER);
  const GAME_F_TEMPLATES = templatesFor(ROSTER);
  const enemyHeroes = ROSTER.filter((h) => h.team === TEAM_B);
  const entities: Record<string, EntityBlueprint> = {
    library: { PrefabLibrary: { templates: GAME_F_TEMPLATES, seq: 0 } } as unknown as EntityBlueprint,
    ...boardEntities(F_HEX_WARM, F_HEX_COOL),
    board: { HexBoard: { cols: COLS, rows: ROWS, tileSize: TILE, originX: ORIGIN_X, originY: ORIGIN_Y, layout: LAYOUT } } as unknown as EntityBlueprint,
    team_a_flag: { Flag: { id: 'team_a_present', active: true } } as unknown as EntityBlueprint,
    team_b_flag: { Flag: { id: 'team_b_present', active: true } } as unknown as EntityBlueprint,
    zone_a: { Zone: { outFlag: 'team_a_present', ...ARENA, requiredTag: TEAM_A, count: 1 } } as unknown as EntityBlueprint,
    zone_b: { Zone: { outFlag: 'team_b_present', ...ARENA, requiredTag: TEAM_B, count: 1 } } as unknown as EntityBlueprint,
    flow_ctrl: { GameFlow: makeRoundFlow(PREP_TICKS, RESOLUTION_TICKS, CELEBRATE_TICKS) } as unknown as EntityBlueprint,
    flow_run: { GameFlow: RUN_FLOW } as unknown as EntityBlueprint,
    f_in_combat: { Flag: { id: 'in_combat', active: false } } as unknown as EntityBlueprint,
    f_in_prep: { Flag: { id: 'in_prep', active: false } } as unknown as EntityBlueprint,
    f_won: { Flag: { id: 'won', active: false } } as unknown as EntityBlueprint,
    f_over: { Flag: { id: 'run_over', active: false } } as unknown as EntityBlueprint,
    f_round_done: { Flag: { id: 'round_done', active: false } } as unknown as EntityBlueprint,
    f_run_won: { Flag: { id: 'run_won', active: false } } as unknown as EntityBlueprint,
    r_gold: { Resource: { id: 'gold', current: 5, min: 0, max: 999 } } as unknown as EntityBlueprint, // 起手金 5（用户：10 太多）；收入仍在结算后发
    r_player_hp: { Resource: { id: 'player_hp', current: 100, min: 0, max: 100 } } as unknown as EntityBlueprint,
    r_round_idx: { Resource: { id: 'round_idx', current: 1, min: 0, max: 999 } } as unknown as EntityBlueprint,
    r_stage_idx: { Resource: { id: 'stage_idx', current: 1, min: 0, max: 99 } } as unknown as EntityBlueprint,
    r_win_streak: { Resource: { id: 'win_streak', current: 0, min: 0, max: 999 } } as unknown as EntityBlueprint,
    r_lose_streak: { Resource: { id: 'lose_streak', current: 0, min: 0, max: 999 } } as unknown as EntityBlueprint,
    r_xp: { Resource: { id: 'xp', current: 0, min: 0, max: 999 } } as unknown as EntityBlueprint,
    r_level: { Resource: { id: 'level', current: 4, min: 1, max: 8 } } as unknown as EntityBlueprint,
    f_ready: { Flag: { id: 'ready', active: false } } as unknown as EntityBlueprint,
    ...chrome('btn_ready', 300, 180, 68, 26, 0xd8607b, 0xb84a62),
    ...chrome('btn_reroll', 300, 150, 60, 22, 0xfdf3ea, 0xecd3b2),
    ...chrome('btn_lock', 300, 120, 46, 22, 0xfdf3ea, 0xecd3b2),
    ...chrome('btn_unlock', 300, 92, 46, 22, 0xfdf3ea, 0xecd3b2),
    ...chrome('btn_xp', 300, 64, 46, 22, 0xfdf3ea, 0xecd3b2),
    btn_ready: {
      Transform: xf(300, 180),
      Shape: { kind: 'box', width: 64, height: 24 },
      Clickable: { action: 'ready_btn' },
      Text: { content: '开战', fontSize: 13, fontFamily: FONT_DISPLAY, anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0xffffff, alpha: 1 },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 },
    } as unknown as EntityBlueprint,
    eff_ready: { Effect: { onSignal: 'ready_btn', kind: 'set-flag', targetId: 'ready', value: true } } as unknown as EntityBlueprint,
    r_prep_left: {
      Resource: { id: 'prep_left', current: 30, min: 0, max: 99 },
      OverTime: { effects: [{ id: 'cd_tick', resource: 'prep_left', amountPerTick: -1, period: 60, duration: 0, elapsed: 0 }] },
    } as unknown as EntityBlueprint,
    hud_timer: {
      Transform: xf(0, -160),
      Text: { content: '开战 30', fontSize: 18, fontFamily: FONT_NUM, anchor: 'center', lineSpacing: 0 },
      TextBinding: { resourceId: 'prep_left', prefix: '开战 ' },
      Color: { tint: 0xd8607b, alpha: 1 },
      Visibility: { visible: true },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 31 },
    } as unknown as EntityBlueprint,
    eff_timer_show: { Effect: { onSignal: 'ph_prep', kind: 'set-visible', targetId: '', targetEntity: 'hud_timer', value: true } } as unknown as EntityBlueprint,
    eff_timer_hide: { Effect: { onSignal: 'ph_combat', kind: 'set-visible', targetId: '', targetEntity: 'hud_timer', value: false } } as unknown as EntityBlueprint,
    eff_timer_hide2: { Effect: { onSignal: 'ph_res', kind: 'set-visible', targetId: '', targetEntity: 'hud_timer', value: false } } as unknown as EntityBlueprint,
    eff_marker_hide: { Effect: { onSignal: 'ph_combat', kind: 'set-visible-tagged', targetId: '', tagMask: MARKER_VIS, value: false } } as unknown as EntityBlueprint,
    eff_marker_show: { Effect: { onSignal: 'ph_prep', kind: 'set-visible-tagged', targetId: '', tagMask: MARKER_VIS, value: true } } as unknown as EntityBlueprint,
    shop: {
      CardPile: { owner: 'shop', deck: [...SHOP_DECK], hand: [], handSize: 3, playCosts: [{ id: 'gold', amount: 3 }, { id: 'bench_space', amount: 1 }], playedCodeResource: 'bought_code', refreshOnSignal: 'shop_refresh', returnOnSignal: 'card_sold', returnCodeResource: 'sold_code', handCodeResources: ['shop_slot_1', 'shop_slot_2', 'shop_slot_3'], playOnSignals: ['buy_slot_1', 'buy_slot_2', 'buy_slot_3'] },
      PlayedHand: { owner: 'shop', cards: [] },
      Flag: { id: 'shop', active: false },
    } as unknown as EntityBlueprint,
    r_bought_code: { Resource: { id: 'bought_code', current: 0, min: 0, max: 9999 } } as unknown as EntityBlueprint,
    r_bench_space: { Resource: { id: 'bench_space', current: 9, min: 0, max: 11 } } as unknown as EntityBlueprint,
    r_bench_cap: { Resource: { id: 'bench_cap', current: 9, min: 0, max: 11 } } as unknown as EntityBlueprint,
    r_bench_occupied: { Resource: { id: 'bench_occupied', current: 0, min: 0, max: 99 } } as unknown as EntityBlueprint,
    gc_bench: { GroupCount: { countResource: 'bench_occupied', requiredTag: BENCH_OCC, onBoard: false } } as unknown as EntityBlueprint,
    when_bench_sync: { EventWhen: { signal: 'bench_sync', when: resCmp('bench_cap', 'gte', 0), mode: 'level', armed: false } } as unknown as EntityBlueprint,
    eff_bench_set: { Effect: { onSignal: 'bench_sync', kind: 'modify-resource', targetId: 'bench_space', op: 'set', value: 0, valueFrom: { resourceId: 'bench_cap' }, order: 1 } } as unknown as EntityBlueprint,
    eff_bench_sub: { Effect: { onSignal: 'bench_sync', kind: 'modify-resource', targetId: 'bench_space', op: 'add', value: 0, valueFrom: { resourceId: 'bench_occupied', coeff: -1 }, order: 2 } } as unknown as EntityBlueprint,
    f_shop_refresh_armed: { Flag: { id: 'shop_refresh_armed', active: false } } as unknown as EntityBlueprint,
    f_shop_locked: { Flag: { id: 'shop_locked', active: false } } as unknown as EntityBlueprint,
    when_shop_refresh: { EventWhen: { signal: 'shop_refresh', when: and(flagIs('shop_refresh_armed'), { kind: 'not', of: flagIs('shop_locked') }), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_shop_gate: { EventWhen: { signal: 'shop_gate_done', when: flagIs('shop_refresh_armed'), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    eff_gate_disarm: { Effect: { onSignal: 'shop_gate_done', kind: 'set-flag', targetId: 'shop_refresh_armed', value: false } } as unknown as EntityBlueprint,
    eff_gate_unlock: { Effect: { onSignal: 'shop_gate_done', kind: 'set-flag', targetId: 'shop_locked', value: false } } as unknown as EntityBlueprint,
    btn_xp: {
      Transform: xf(300, 64),
      Shape: { kind: 'box', width: 40, height: 20 },
      Clickable: { action: 'buyxp_btn' },
      CraftRecipe: { onSignal: 'buyxp_btn', costs: [{ id: 'gold', amount: 4 }], gains: [{ id: 'xp', amount: 4 }] },
      Text: { content: '经验$4', fontSize: 11, fontFamily: FONT_BODY, anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0x6a4a4f, alpha: 1 },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 },
    } as unknown as EntityBlueprint,
    ...band('lvl_5', resCmp('xp', 'gte', 8), 'level', 1),
    ...band('lvl_6', resCmp('xp', 'gte', 18), 'level', 1),
    ...band('lvl_7', resCmp('xp', 'gte', 30), 'level', 1),
    ...band('lvl_8', resCmp('xp', 'gte', 44), 'level', 1), // 阈值下调（用户：买经验/打赢要看得见升级）；+2/回合、买经验$4=+4，edge 单发+1，封顶 8
    btn_reroll: {
      Transform: xf(300, 150),
      Shape: { kind: 'box', width: 56, height: 20 },
      Clickable: { action: 'reroll_btn' },
      CraftRecipe: { onSignal: 'reroll_btn', costs: [{ id: 'gold', amount: 2 }], grantsFlag: 'reroll_paid' },
      Text: { content: '刷新$2', fontSize: 11, fontFamily: FONT_BODY, anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0x6a4a4f, alpha: 1 },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 },
    } as unknown as EntityBlueprint,
    f_reroll_paid: { Flag: { id: 'reroll_paid', active: false } } as unknown as EntityBlueprint,
    when_reroll: { EventWhen: { signal: 'shop_refresh', when: flagIs('reroll_paid'), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    eff_reroll_reset: { Effect: { onSignal: 'shop_refresh', kind: 'set-flag', targetId: 'reroll_paid', value: false } } as unknown as EntityBlueprint,
    btn_lock: {
      Transform: xf(300, 120),
      Shape: { kind: 'box', width: 40, height: 20 },
      Clickable: { action: 'lock_btn' },
      Text: { content: '锁店', fontSize: 11, fontFamily: FONT_BODY, anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0xd8607b, alpha: 1 },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 },
    } as unknown as EntityBlueprint,
    btn_unlock: {
      Transform: xf(300, 92),
      Shape: { kind: 'box', width: 40, height: 20 },
      Clickable: { action: 'unlock_btn' },
      Text: { content: '解锁', fontSize: 11, fontFamily: FONT_BODY, anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0x6a4a4f, alpha: 1 },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 },
    } as unknown as EntityBlueprint,
    eff_lock: { Effect: { onSignal: 'lock_btn', kind: 'set-flag', targetId: 'shop_locked', value: true } } as unknown as EntityBlueprint,
    eff_unlock: { Effect: { onSignal: 'unlock_btn', kind: 'set-flag', targetId: 'shop_locked', value: false } } as unknown as EntityBlueprint,
    r_sold_code: { Resource: { id: 'sold_code', current: 0, min: 0, max: 9999 } } as unknown as EntityBlueprint,
    when_sold: { EventWhen: { signal: 'card_sold', when: resCmp('sold_code', 'gt', 0), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    f_marks_armed: { Flag: { id: 'shop_marks_armed', active: false } } as unknown as EntityBlueprint,
    f_marks2_armed: { Flag: { id: 'shop_marks2_armed', active: false } } as unknown as EntityBlueprint,
    eff_marks_on_refresh: { Effect: { onSignal: 'shop_refresh', kind: 'set-flag', targetId: 'shop_marks_armed', value: true } } as unknown as EntityBlueprint,
    when_marks: { EventWhen: { signal: 'shop_marks', when: flagIs('shop_marks_armed'), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    eff_marks_clear: { Effect: { onSignal: 'shop_marks', kind: 'destroy-tagged', targetId: '', value: SHOPSLOT_ALL } } as unknown as EntityBlueprint,
    eff_marks_disarm: { Effect: { onSignal: 'shop_marks', kind: 'set-flag', targetId: 'shop_marks_armed', value: false } } as unknown as EntityBlueprint,
    eff_marks2_arm: { Effect: { onSignal: 'shop_marks', kind: 'set-flag', targetId: 'shop_marks2_armed', value: true } } as unknown as EntityBlueprint,
    when_marks2: { EventWhen: { signal: 'shop_marks2', when: flagIs('shop_marks2_armed'), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    eff_marks2_disarm: { Effect: { onSignal: 'shop_marks2', kind: 'set-flag', targetId: 'shop_marks2_armed', value: false } } as unknown as EntityBlueprint,
    f_round_state: { State: { fsmId: 'round_ui', current: 'prep' } } as unknown as EntityBlueprint,
    banner_prep: {
      Transform: xf(0, -186),
      Text: { content: '备 战 —— 买人/刷新/锁店，点「开战」或等倒计时', fontSize: 15, fontFamily: FONT_DISPLAY, anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0xcf9a3f, alpha: 1 },
      Visibility: { visible: true },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 31 },
    } as unknown as EntityBlueprint,
    banner_combat: {
      Transform: xf(0, -186),
      Text: { content: '战 斗 中', fontSize: 16, fontFamily: FONT_DISPLAY, anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0xd8607b, alpha: 1 },
      Visibility: { visible: false },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 31 },
    } as unknown as EntityBlueprint,
    banner_resolution: {
      Transform: xf(0, -186),
      Text: { content: '回 合 结 算', fontSize: 15, fontFamily: FONT_DISPLAY, anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0x8aa0e6, alpha: 1 },
      Visibility: { visible: false },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 31 },
    } as unknown as EntityBlueprint,
    banner_gameover: {
      Transform: xf(0, -60),
      Text: { content: '败 局 —— 玩家血量耗尽', fontSize: 22, fontFamily: FONT_DISPLAY, anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0xd65668, alpha: 1 },
      Visibility: { visible: false },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 32 },
    } as unknown as EntityBlueprint,
    banner_victory: {
      Transform: xf(0, -60),
      Text: { content: '通 关 —— 打穿关卡表！', fontSize: 22, fontFamily: FONT_DISPLAY, anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0x54ad8e, alpha: 1 },
      Visibility: { visible: false },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 32 },
    } as unknown as EntityBlueprint,
    banner_win: {
      Transform: xf(0, -60),
      Text: { content: '🎉 胜 利 ！', fontSize: 26, fontFamily: FONT_DISPLAY, anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0xcf9a3f, alpha: 1 },
      Visibility: { visible: false },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 32 },
    } as unknown as EntityBlueprint,
    banner_lose: {
      Transform: xf(0, -60),
      Text: { content: '败 阵 …', fontSize: 22, fontFamily: FONT_DISPLAY, anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0xd65668, alpha: 1 },
      Visibility: { visible: false },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 32 },
    } as unknown as EntityBlueprint,
    f_click_sell_off: { Flag: { id: 'click_sell_off', active: false } } as unknown as EntityBlueprint, // 恒假：点选卖出永闭
    // 备战台两侧各一个小垃圾桶（用户：左右各放一个、小一点）；任一 DropZone 落子=卖出（hitDropZone 通配）。
    ...chrome('trash_bin', 200, 118, 32, 32, 0xfbeee4, 0xd65668, 18.5),
    trash_bin: {
      Transform: xf(200, 118),
      Shape: { kind: 'box', width: 30, height: 30 },
      DropZone: {},
      Text: { content: '🗑', fontSize: 17, fontFamily: FONT_BODY, anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0xd65668, alpha: 0.95 },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 27 },
    } as unknown as EntityBlueprint,
    ...chrome('trash_bin_l', -200, 118, 32, 32, 0xfbeee4, 0xd65668, 18.5),
    trash_bin_l: {
      Transform: xf(-200, 118),
      Shape: { kind: 'box', width: 30, height: 30 },
      DropZone: {},
      Text: { content: '🗑', fontSize: 17, fontFamily: FONT_BODY, anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0xd65668, alpha: 0.95 },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 27 },
    } as unknown as EntityBlueprint,
    eff_projsweep_w: { Effect: { onSignal: 'ph_win', kind: 'destroy-tagged', targetId: '', value: PROJ } } as unknown as EntityBlueprint,
    eff_projsweep_l: { Effect: { onSignal: 'ph_lose', kind: 'destroy-tagged', targetId: '', value: PROJ } } as unknown as EntityBlueprint,
    rescast_w: { Transform: xf(210, -26), Caster: { onSignal: 'ph_win', template: 'result_win', at: 'self' } } as unknown as EntityBlueprint,
    rescast_l: { Transform: xf(210, -26), Caster: { onSignal: 'ph_lose', template: 'result_lose', at: 'self' } } as unknown as EntityBlueprint,
    eff_result_sweep: { Effect: { onSignal: 'ph_prep', kind: 'destroy-tagged', targetId: '', value: RESULT } } as unknown as EntityBlueprint,
    when_ph_win: { EventWhen: { signal: 'ph_win', when: and({ kind: 'state', fsmId: 'round_ui', equals: 'celebrate' }, flagIs('won')), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_ph_lose: { EventWhen: { signal: 'ph_lose', when: and({ kind: 'state', fsmId: 'round_ui', equals: 'celebrate' }, { kind: 'not', of: flagIs('won') }), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    burst_l: { Transform: xf(-70, -50), Caster: { onSignal: 'ph_win', template: 'win_burst', at: 'self' } } as unknown as EntityBlueprint,
    burst_m: { Transform: xf(0, -80), Caster: { onSignal: 'ph_win', template: 'win_burst', at: 'self' } } as unknown as EntityBlueprint,
    burst_r: { Transform: xf(70, -50), Caster: { onSignal: 'ph_win', template: 'win_burst', at: 'self' } } as unknown as EntityBlueprint,
    when_ph_prep: { EventWhen: { signal: 'ph_prep', when: { kind: 'state', fsmId: 'round_ui', equals: 'prep' }, mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_ph_combat: { EventWhen: { signal: 'ph_combat', when: { kind: 'state', fsmId: 'round_ui', equals: 'combat' }, mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_ph_res: { EventWhen: { signal: 'ph_res', when: { kind: 'state', fsmId: 'round_ui', equals: 'resolution' }, mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_ph_over: { EventWhen: { signal: 'ph_over', when: flagIs('run_over'), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_ph_won: { EventWhen: { signal: 'ph_won', when: flagIs('run_won'), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    ...visSwap('ph_prep', 'banner_prep', ['banner_combat', 'banner_resolution', 'banner_win', 'banner_lose']),
    ...visSwap('ph_combat', 'banner_combat', ['banner_prep', 'banner_resolution']),
    ...visSwap('ph_res', 'banner_resolution', ['banner_prep', 'banner_combat', 'banner_win', 'banner_lose']),
    ...visSwap('ph_win', 'banner_win', ['banner_combat']),
    ...visSwap('ph_lose', 'banner_lose', ['banner_combat']),
    ...visSwap('ph_over', 'banner_gameover', []),
    ...visSwap('ph_won', 'banner_victory', []),
    hud_gold: { Transform: xf(-340, -186), Text: { content: '金币 0', fontSize: 13, fontFamily: FONT_NUM, anchor: 'left', lineSpacing: 0 }, TextBinding: { resourceId: 'gold', prefix: '金币 ' }, Color: { tint: 0xcf9a3f, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 } } as unknown as EntityBlueprint,
    hud_hp: { Transform: xf(-340, -168), Text: { content: '血量 100', fontSize: 13, fontFamily: FONT_NUM, anchor: 'left', lineSpacing: 0 }, TextBinding: { resourceId: 'player_hp', prefix: '血量 ' }, Color: { tint: 0xd65668, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 } } as unknown as EntityBlueprint,
    hud_level: { Transform: xf(-340, -150), Text: { content: '等级 4', fontSize: 13, fontFamily: FONT_NUM, anchor: 'left', lineSpacing: 0 }, TextBinding: { resourceId: 'level', prefix: '等级 ' }, Color: { tint: 0x8aa0e6, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 } } as unknown as EntityBlueprint,
    hud_xp: { Transform: xf(-340, -132), Text: { content: '经验 0', fontSize: 13, fontFamily: FONT_NUM, anchor: 'left', lineSpacing: 0 }, TextBinding: { resourceId: 'xp', prefix: '经验 ' }, Color: { tint: 0xc98fc4, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 } } as unknown as EntityBlueprint,
    hud_stage: { Transform: xf(-340, -114), Text: { content: '阶段 1', fontSize: 13, fontFamily: FONT_NUM, anchor: 'left', lineSpacing: 0 }, TextBinding: { resourceId: 'stage_idx', prefix: '阶段 ' }, Color: { tint: 0xa98b8f, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 } } as unknown as EntityBlueprint,
    hud_round: { Transform: xf(-275, -114), Text: { content: '回合 1', fontSize: 13, fontFamily: FONT_NUM, anchor: 'left', lineSpacing: 0 }, TextBinding: { resourceId: 'round_idx', prefix: '回合 ' }, Color: { tint: 0xa98b8f, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 } } as unknown as EntityBlueprint,
    hud_bench: { Transform: xf(-340, -96), Text: { content: '空席 9', fontSize: 13, fontFamily: FONT_NUM, anchor: 'left', lineSpacing: 0 }, TextBinding: { resourceId: 'bench_space', prefix: '空席 ' }, Color: { tint: 0xa98b8f, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 } } as unknown as EntityBlueprint,
    f_deploy_armed: { Flag: { id: 'deploy_armed', active: false } } as unknown as EntityBlueprint,
    f_wipe_armed: { Flag: { id: 'wipe_armed', active: false } } as unknown as EntityBlueprint,
    f_income_armed: { Flag: { id: 'income_armed', active: false } } as unknown as EntityBlueprint,
    f_dmg_armed: { Flag: { id: 'dmg_armed', active: false } } as unknown as EntityBlueprint,
    when_deploy: { EventWhen: { signal: 'deploy', when: flagIs('deploy_armed'), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    f_cap_armed: { Flag: { id: 'cap_armed', active: false } } as unknown as EntityBlueprint,
    r_count_team_a: { Resource: { id: 'count_team_a', current: 0, min: 0, max: 99 } } as unknown as EntityBlueprint,
    gc_team_a: { GroupCount: { countResource: 'count_team_a', requiredTag: TEAM_A } } as unknown as EntityBlueprint,
    when_cap: { EventWhen: { signal: 'enforce_cap', when: and(flagIs('cap_armed'), resCmp('count_team_a', 'gte', 1)), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    eff_cap: { Effect: { onSignal: 'enforce_cap', kind: 'destroy-tagged', targetId: '', value: TEAM_A, keepResource: 'level' } } as unknown as EntityBlueprint,
    when_deploy_stage2: { EventWhen: { signal: 'deploy_stage_2', when: and(flagIs('deploy_armed'), resCmp('stage_idx', 'eq', 2), resCmp('round_idx', 'lte', 4)), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_deploy_stage3: { EventWhen: { signal: 'deploy_stage_3', when: and(flagIs('deploy_armed'), resCmp('stage_idx', 'eq', 3), resCmp('round_idx', 'lte', 4)), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_deploy_stage4: { EventWhen: { signal: 'deploy_stage_4', when: and(flagIs('deploy_armed'), resCmp('stage_idx', 'eq', 4), resCmp('round_idx', 'lte', 4)), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_deploy_stage5: { EventWhen: { signal: 'deploy_stage_5', when: and(flagIs('deploy_armed'), resCmp('stage_idx', 'eq', 5), resCmp('round_idx', 'lte', 4)), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_deploy_pve1: { EventWhen: { signal: 'deploy_pve_1', when: and(flagIs('deploy_armed'), resCmp('stage_idx', 'eq', 1)), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_deploy_pve2: { EventWhen: { signal: 'deploy_pve_2', when: and(flagIs('deploy_armed'), resCmp('stage_idx', 'eq', 2), resCmp('round_idx', 'gte', 5)), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_deploy_pve3: { EventWhen: { signal: 'deploy_pve_3', when: and(flagIs('deploy_armed'), resCmp('stage_idx', 'eq', 3), resCmp('round_idx', 'gte', 5)), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_deploy_pve4: { EventWhen: { signal: 'deploy_pve_4', when: and(flagIs('deploy_armed'), resCmp('stage_idx', 'eq', 4), resCmp('round_idx', 'gte', 5)), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    when_deploy_pve5: { EventWhen: { signal: 'deploy_pve_5', when: and(flagIs('deploy_armed'), resCmp('stage_idx', 'eq', 5), resCmp('round_idx', 'gte', 5)), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    wipe_loot: { Effect: { onSignal: 'wipe', kind: 'destroy-tagged', targetId: '', value: LOOT } } as unknown as EntityBlueprint,
    eff_equip_sweep: { Effect: { onSignal: 'ph_combat', kind: 'destroy-tagged', targetId: '', value: EQUIP } } as unknown as EntityBlueprint,
    throne: { Transform: xf(-150, 96), Shape: { kind: 'box', width: 40, height: 46 }, Color: { tint: 0xffffff, alpha: 1 }, Sprite: { textureKey: F_THRONE, anchorX: 0.5, anchorY: 0.5, zOrder: 1 } } as unknown as EntityBlueprint,
    throne_label: { Transform: xf(-150, 122), Text: { content: '主公宝座', fontSize: 9, fontFamily: FONT_BODY, anchor: 'center', lineSpacing: 0 }, Color: { tint: 0xcf9a3f, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 2 } } as unknown as EntityBlueprint,
    protag: {
      Transform: xf(-150, 86),
      Velocity: { vx: 0, vy: 0, angular: 0 },
      Controllable: { playerId: 'p1', speed: 1.6 },
      Shape: { kind: 'box', width: 14, height: 14 },
      Tag: { flags: PROTAG },
      Resource: { id: 'loot', current: 0, min: 0, max: 999 },
      Sprite: sprite(F_HERO.protag, 12),
    } as unknown as EntityBlueprint,
    item_bag: {
      Transform: xf(-150, 86),
      Shape: { kind: 'box', width: 18, height: 18 },
      Tag: { flags: BAG },
      Resource: { id: 'items', current: 0, min: 0, max: 8 },
      Hierarchy: { parentId: 'protag', localX: 0, localY: 0, localRotation: 0, localScaleX: 1, localScaleY: 1 },
    } as unknown as EntityBlueprint,
    protag_name: {
      Transform: xf(-150, 70),
      Text: { content: '主公', fontSize: 10, fontFamily: FONT_BODY, anchor: 'center', lineSpacing: 0 },
      Color: { tint: 0xcf9a3f, alpha: 1 },
      Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 30 },
      Hierarchy: { parentId: 'protag', localX: 0, localY: -16, localRotation: 0, localScaleX: 1, localScaleY: 1 },
    } as unknown as EntityBlueprint,
    when_loot: { EventWhen: { signal: 'loot_cash', when: resCmp('loot', 'gt', 0), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    eff_loot_gold: { Effect: { onSignal: 'loot_cash', kind: 'modify-resource', targetId: 'gold', op: 'add', value: 0, valueFrom: { resourceId: 'loot' }, order: 1 } } as unknown as EntityBlueprint,
    eff_loot_clear: { Effect: { onSignal: 'loot_cash', kind: 'modify-resource', targetId: 'loot', op: 'set', value: 0, order: 2 } } as unknown as EntityBlueprint,
    ...chrome('rune_title', 0, -128, 344, 22, 0xfffdfa, 0xe3c896, 32.5, RUNE),
    ...chrome('rune_a', -110, -100, 100, 44, 0xfffdfa, 0xe3c896, 32.5, RUNE),
    ...chrome('rune_b', 0, -100, 100, 44, 0xfffdfa, 0xe3c896, 32.5, RUNE),
    ...chrome('rune_c', 110, -100, 100, 44, 0xfffdfa, 0xe3c896, 32.5, RUNE),
    rune_title: { Transform: xf(0, -128), Shape: { kind: 'box', width: 340, height: 18 }, Tag: { flags: RUNE }, Text: { content: '◆ 开局强化 · 三选一（点击生效，开战后消失）', fontSize: 13, fontFamily: FONT_DISPLAY, anchor: 'center', lineSpacing: 0 }, Color: { tint: 0xcf9a3f, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 33 } } as unknown as EntityBlueprint,
    rune_a: { Transform: xf(-110, -100), Shape: { kind: 'box', width: 96, height: 40 }, Clickable: { action: 'rune_a' }, Tag: { flags: RUNE }, Text: { content: '屯粮：+5 金', fontSize: 12, fontFamily: FONT_BODY, anchor: 'center', lineSpacing: 0 }, Color: { tint: 0xcf9a3f, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 33 } } as unknown as EntityBlueprint,
    rune_b: { Transform: xf(0, -100), Shape: { kind: 'box', width: 96, height: 40 }, Clickable: { action: 'rune_b' }, Tag: { flags: RUNE }, Text: { content: '砺兵：+8 经验', fontSize: 12, fontFamily: FONT_BODY, anchor: 'center', lineSpacing: 0 }, Color: { tint: 0xc98fc4, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 33 } } as unknown as EntityBlueprint,
    rune_c: { Transform: xf(110, -100), Shape: { kind: 'box', width: 96, height: 40 }, Clickable: { action: 'rune_c' }, Tag: { flags: RUNE }, Text: { content: '广纳：备战席 +2', fontSize: 12, fontFamily: FONT_BODY, anchor: 'center', lineSpacing: 0 }, Color: { tint: 0x8aa0e6, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 33 } } as unknown as EntityBlueprint,
    eff_rune_a: { Effect: { onSignal: 'rune_a', kind: 'modify-resource', targetId: 'gold', op: 'add', value: 5 } } as unknown as EntityBlueprint,
    eff_rune_b: { Effect: { onSignal: 'rune_b', kind: 'modify-resource', targetId: 'xp', op: 'add', value: 8 } } as unknown as EntityBlueprint,
    eff_rune_c: { Effect: { onSignal: 'rune_c', kind: 'modify-resource', targetId: 'bench_cap', op: 'add', value: 2 } } as unknown as EntityBlueprint,
    eff_rune_a_done: { Effect: { onSignal: 'rune_a', kind: 'destroy-tagged', targetId: '', value: RUNE } } as unknown as EntityBlueprint,
    eff_rune_b_done: { Effect: { onSignal: 'rune_b', kind: 'destroy-tagged', targetId: '', value: RUNE } } as unknown as EntityBlueprint,
    eff_rune_c_done: { Effect: { onSignal: 'rune_c', kind: 'destroy-tagged', targetId: '', value: RUNE } } as unknown as EntityBlueprint,
    eff_rune_sweep: { Effect: { onSignal: 'ph_combat', kind: 'destroy-tagged', targetId: '', value: RUNE } } as unknown as EntityBlueprint,
    bond_counter_shu: { GroupCount: { countResource: 'count_shu', requiredTag: FACT_SHU } } as unknown as EntityBlueprint,
    r_count_shu: { Resource: { id: 'count_shu', current: 0, min: 0, max: 99 } } as unknown as EntityBlueprint,
    r_dmg_scale_a: { Resource: { id: 'dmg_scale_a', current: 1, min: 0, max: 9 } } as unknown as EntityBlueprint,
    r_dmg_scale_b: { Resource: { id: 'dmg_scale_b', current: 1, min: 0, max: 9 } } as unknown as EntityBlueprint,
    when_bond_shu: { EventWhen: { signal: 'bond_shu', when: and({ kind: 'state', fsmId: 'round_ui', equals: 'combat' }, resCmp('count_shu', 'gte', 3)), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    eff_bond_shu: { Effect: { onSignal: 'bond_shu', kind: 'modify-resource', targetId: 'dmg_scale_a', op: 'set', value: 1.2 } } as unknown as EntityBlueprint,
    overtime_clock: { Timer: { id: 'combat_clock', elapsed: 0, duration: 999999, loop: false } } as unknown as EntityBlueprint,
    when_ot_reset: { EventWhen: { signal: 'ot_reset', when: { kind: 'state', fsmId: 'round_ui', equals: 'combat' }, mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    eff_ot_reset: { Effect: { onSignal: 'ot_reset', kind: 'reset-timer', targetId: '', targetEntity: 'overtime_clock' } } as unknown as EntityBlueprint,
    when_wipe: { EventWhen: { signal: 'wipe', when: flagIs('wipe_armed'), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    wipe_team_a: { Effect: { onSignal: 'wipe', kind: 'destroy-tagged', targetId: '', value: TEAM_A } } as unknown as EntityBlueprint,
    wipe_team_b: { Effect: { onSignal: 'wipe', kind: 'destroy-tagged', targetId: '', value: TEAM_B } } as unknown as EntityBlueprint,
    when_stage_up: { EventWhen: { signal: 'stage_up', when: resCmp('round_idx', 'gt', 5), mode: 'edge', armed: false } } as unknown as EntityBlueprint,
    eff_stage_up_stage: { Effect: { onSignal: 'stage_up', kind: 'modify-resource', targetId: 'stage_idx', op: 'add', value: 1 } } as unknown as EntityBlueprint,
    eff_stage_up_round: { Effect: { onSignal: 'stage_up', kind: 'modify-resource', targetId: 'round_idx', op: 'set', value: 1 } } as unknown as EntityBlueprint,
    ...band('income_2', and(flagIs('income_armed'), resCmp('stage_idx', 'eq', 1), resCmp('round_idx', 'lte', 2)), 'gold', 2),
    ...band('income_3', and(flagIs('income_armed'), resCmp('stage_idx', 'eq', 1), resCmp('round_idx', 'eq', 3)), 'gold', 3),
    ...band('income_4', and(flagIs('income_armed'), resCmp('stage_idx', 'eq', 1), resCmp('round_idx', 'eq', 4)), 'gold', 4),
    ...band('income_5', and(flagIs('income_armed'), or(resCmp('stage_idx', 'gt', 1), resCmp('round_idx', 'gte', 5))), 'gold', 5),
    ...band('interest_1', and(flagIs('income_armed'), resCmp('gold', 'gte', 10), resCmp('gold', 'lt', 20)), 'gold', 1),
    ...band('interest_2', and(flagIs('income_armed'), resCmp('gold', 'gte', 20), resCmp('gold', 'lt', 30)), 'gold', 2),
    ...band('interest_3', and(flagIs('income_armed'), resCmp('gold', 'gte', 30), resCmp('gold', 'lt', 40)), 'gold', 3),
    ...band('interest_4', and(flagIs('income_armed'), resCmp('gold', 'gte', 40), resCmp('gold', 'lt', 50)), 'gold', 4),
    ...band('interest_5', and(flagIs('income_armed'), resCmp('gold', 'gte', 50)), 'gold', 5),
    ...band('streak_1', and(flagIs('income_armed'), resCmp('win_streak', 'gte', 2), resCmp('win_streak', 'lte', 3)), 'gold', 1),
    ...band('streak_2', and(flagIs('income_armed'), resCmp('win_streak', 'eq', 4)), 'gold', 2),
    ...band('streak_3', and(flagIs('income_armed'), resCmp('win_streak', 'gte', 5)), 'gold', 3),
    ...band('lstreak_1', and(flagIs('income_armed'), resCmp('lose_streak', 'gte', 2), resCmp('lose_streak', 'lte', 3)), 'gold', 1),
    ...band('lstreak_2', and(flagIs('income_armed'), resCmp('lose_streak', 'eq', 4)), 'gold', 2),
    ...band('lstreak_3', and(flagIs('income_armed'), resCmp('lose_streak', 'gte', 5)), 'gold', 3),
    ...band('dmg_stage_1', and(flagIs('dmg_armed'), resCmp('stage_idx', 'eq', 1)), 'player_hp', -2),
    ...band('dmg_stage_2', and(flagIs('dmg_armed'), resCmp('stage_idx', 'gt', 1)), 'player_hp', -4),
    camera: { Transform: xf(0, 0), Camera: { zoom: 1.8, offsetX: 0, offsetY: 0, rotation: 0, viewportW: 1280, viewportH: 720 } } as unknown as EntityBlueprint,
  };
  entities['when_boot'] = { EventWhen: { signal: 'boot_roster', when: resCmp('stage_idx', 'gte', 1), mode: 'edge', armed: false } } as unknown as EntityBlueprint;
  for (const h of ROSTER.filter((x) => x.team === TEAM_A && x.seed !== false)) { // 只播种原 4 将（seed≠false）；新增 2 将商店专属可买
    const a = offsetToAxial(h.q, h.r);
    const p = project(a.q, a.r);
    entities[`bootcast_${h.id}`] = {
      Transform: xf(p.x, p.y),
      HexPos: { q: a.q, r: a.r },
      Caster: { onSignal: 'boot_roster', template: `bench_${h.id}`, at: 'self', requireHexPos: true, overrides: { seat: { HexPos: '@origin-hex' } } },
    } as unknown as EntityBlueprint;
  }
  ROSTER.filter((x) => x.team === TEAM_A).forEach((h, i) => {
    const sig = `buy_${h.id}`;
    entities[`when_${sig}`] = { EventWhen: { signal: sig, when: resCmp('bought_code', 'eq', HERO_CODE[h.id]), mode: 'edge', armed: false } } as unknown as EntityBlueprint;
    entities[`buycast_${h.id}`] = { Transform: xf(0, TRAY.originY), Caster: { onSignal: sig, template: `bench_${h.id}`, at: 'self' } } as unknown as EntityBlueprint;
    entities[`eff_${sig}_reset`] = { Effect: { onSignal: sig, kind: 'modify-resource', targetId: 'bought_code', op: 'set', value: 0 } } as unknown as EntityBlueprint;
    const sell = `sell_${h.id}`;
    entities[`eff_${sell}_destroy`] = { Effect: { onSignal: sell, kind: 'destroy', targetId: '', targetEntity: '@signal-source' } } as unknown as EntityBlueprint;
    entities[`eff_${sell}_gold`] = { Effect: { onSignal: sell, kind: 'modify-resource', targetId: 'gold', op: 'add', value: SELL_PRICE[1] } } as unknown as EntityBlueprint;
    entities[`eff_${sell}_code`] = { Effect: { onSignal: sell, kind: 'modify-resource', targetId: 'sold_code', op: 'set', value: HERO_CODE[h.id] } } as unknown as EntityBlueprint;
    entities[`mr2_${h.id}`] = { MergeRule: { template: `bench_${h.id}`, need: 3, into: `bench2_${h.id}`, intoOverrides: { seat: { HexPos: '@origin-hex' } } } } as unknown as EntityBlueprint;
    entities[`mr3_${h.id}`] = { MergeRule: { template: `bench2_${h.id}`, need: 3, into: `bench3_${h.id}`, intoOverrides: { seat: { HexPos: '@origin-hex' } } } } as unknown as EntityBlueprint;
    for (const s of [2, 3]) {
      const sk = `sell${s}_${h.id}`;
      entities[`eff_${sk}_destroy`] = { Effect: { onSignal: sk, kind: 'destroy', targetId: '', targetEntity: '@signal-source' } } as unknown as EntityBlueprint;
      entities[`eff_${sk}_gold`] = { Effect: { onSignal: sk, kind: 'modify-resource', targetId: 'gold', op: 'add', value: SELL_PRICE[s] } } as unknown as EntityBlueprint;
    }
  });
  for (let i = 0; i < 3; i++) {
    entities[`r_shop_slot_${i + 1}`] = { Resource: { id: `shop_slot_${i + 1}`, current: 0, min: 0, max: 9999 } } as unknown as EntityBlueprint;
    ROSTER.filter((x) => x.team === TEAM_A).forEach((h) => {
      const sig = `s${i + 1}_${h.id}`;
      entities[`when_${sig}`] = { EventWhen: { signal: sig, when: and(flagIs('shop_marks2_armed'), resCmp(`shop_slot_${i + 1}`, 'eq', HERO_CODE[h.id])), mode: 'edge', armed: false } } as unknown as EntityBlueprint;
      entities[`cardcast_${sig}`] = { Transform: xf(SHOP_XS[i], SHOP_Y), Caster: { onSignal: sig, template: `shopcard_${h.id}`, at: 'self', overrides: { card: { Clickable: { action: `buy_slot_${i + 1}` }, Tag: { flags: SHOPSLOT_BITS[i] } } } } } as unknown as EntityBlueprint;
    });
  }
  entities['shop_panel'] = { Transform: xf(0, SHOP_Y), Shape: { kind: 'box', width: 240, height: 80 }, Color: { tint: 0xfffdfa, alpha: 0.92 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 26 } } as unknown as EntityBlueprint;
  for (let i = 0; i < 3; i++) {
    entities[`shop_frame_${i + 1}`] = { Transform: xf(SHOP_XS[i], SHOP_Y), Shape: { kind: 'box', width: 62, height: 72 }, Color: { tint: 0xf3dcc8, alpha: 1 }, Sprite: { textureKey: F_FX_STRIKE, anchorX: 0.5, anchorY: 0.5, zOrder: 27 } } as unknown as EntityBlueprint;
  }
  entities['bench_tray'] = { Tray: { ...TRAY, requiredTag: BENCH_OCC } } as unknown as EntityBlueprint;
  for (let i = 0; i < TRAY.capacity; i++) {
    entities[`bench_frame_${i}`] = { Transform: xf(TRAY.originX + i * TRAY.gap, TRAY.originY + 6), Shape: { kind: 'box', width: 40, height: 32 }, Color: { tint: 0xffffff, alpha: 1 }, Sprite: { textureKey: F_PEDESTAL, anchorX: 0.5, anchorY: 0.5, zOrder: 1 } } as unknown as EntityBlueprint;
  }
  for (const h of ROSTER.filter((x) => x.team === TEAM_A)) {
    entities[`eff_marks_on_buy_${h.id}`] = { Effect: { onSignal: `buy_${h.id}`, kind: 'set-flag', targetId: 'shop_marks_armed', value: true } } as unknown as EntityBlueprint;
  }
  for (const st of STAGES) {
    st.comp.forEach((c, ci) => {
      const eh = enemyHeroes[c.ei];
      entities[`slot_s${st.n}_${ci}_${eh.id}`] = slotEntity(eh, `deploy_stage_${st.n}`, c.q, c.r, c.hpMul);
    });
  }
  for (const w of PVE_WAVES) {
    for (let i = 0; i < w.count; i++) {
      const col = 1 + i;
      const a = offsetToAxial(col, 3);
      const p2 = project(a.q, a.r);
      const hp = Math.round(MOB_BASE_HP * HP_SCALE * w.hpMul);
      entities[`pveslot_s${w.stage}_${i}`] = {
        Transform: xf(p2.x, p2.y),
        Caster: { onSignal: `deploy_pve_${w.stage}`, template: `mob_s${w.stage}`, at: 'self', overrides: { main: { HexPos: { q: a.q, r: a.r }, Tag: { flags: TEAM_B }, Resource: { current: hp, max: hp } } } },
      } as unknown as EntityBlueprint;
    }
  }

  return {
    capabilities: [
      flowCapability,
      aggroCapability,
      gridMoveCapability,
      steeringCapability,
      motionApplyCapability,
      timerCapability,
      selfRuleCapability,
      eventWhenCapability,
      effectApplyCapability,
      casterCapability,
      prefabCapability,
      overlapDetectCapability,
      triggerZoneCapability,
      hitboxCapability,
      overTimeCapability,
      resourceCapability,
      lifetimeCapability,
      destroyCapability,
      mortalCapability,
      zoneOccupancyCapability,
      gaugeCapability,
      clickableCapability,
      cardPileCapability,
      craftRecipeCapability,
      textBindingCapability,
      groupCountCapability,
      mergeRuleCapability,
      dragPlaceCapability,
      trayCapability,
      hierarchyResolveCapability,
      hierarchyCascadeCapability,
      cameraFollowCapability,
      tweenCapability,
    ],
    entities,
  };
}
