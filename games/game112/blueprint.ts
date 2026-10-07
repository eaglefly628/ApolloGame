// game112《星尾会客厅》—— 世界 = 纯数据（WorldBlueprint）。**本目录零专属系统代码。**
//
//   关系四量   = 每量一实体 Resource（f1-resource）；兴致挂 OverTime 自然下行（t2-over-time）
//   陪伴动作   = 宿主具名 action → KeyBinding → Signal → Effect modify-resource（预展开表·零解释器）
//   杂货铺     = KeyBinding → CraftRecipe（costs 星砂 · gains 物品计数 · grantsFlag own.<item>）
//   放到馆里   = KeyBinding → Effect set-flag placed.<item>
//   回忆章节   = EventWhen(心光 gte·edge) → Effect set-flag；章节 = DialogueScript + State + Text（t3-dialogue）
//   离线小事件 = KeyBinding(offline.<tier>) → WeightedSpawn（种子抽模板）→ t3-prefab 展开；ack → destroy-tagged 回收
//
// 架构基石（framework.md §0）：猫的行为在 sim，猫的画面是投影——本文件里没有任何视频/媒体字段。
// 能力总览：docs/design/game112/capability-plan.md。
import type { WorldBlueprint, EntityBlueprint } from '@zerocraft/engine/assembly/demo.assembly.js';
import {
  resourceCapability, flagCapability, stringVariableCapability, randomCapability, textCapability,
  tagCapability, transformCapability, spawnCapability, destroyCapability, timerCapability,
} from '@zerocraft/engine/atom-skills/index.js';
import {
  eventWhenCapability, effectApplyCapability, overTimeCapability, keybindCapability,
  craftRecipeCapability, weightedSpawnCapability,
} from '@zerocraft/engine/skills/tier2/index.js';
import { dialogueCapability, prefabCapability } from '@zerocraft/engine/skills/tier3/index.js';
import type { ConditionExpr, Effect } from '@zerocraft/engine/engine/protocol/components.js';
import { ITEM_EXPERIENCES, ITEM_REQUEST, ITEM_ACTIVITY, ITEM_ROOM, ITEM_CANCEL, useKey, respondKey, removeKey, usesId } from './item-data.js';
import {
  ACTIVE_CAT, STARDUST, STARDUST_MAX, STARDUST_GRANTS, RELATIONS, MOOD_DRIFT, CARE_ACTIONS, SHOP_ITEMS, CHAPTERS,
  OFFLINE_TIERS, OFFLINE_EVENTS, OFFLINE_TAG, OFFLINE_ACK_KEY, SEED_DEFAULT,
  relId, itemCount, ownFlag, placedFlag, buyKey, placeKey,
  chapterFlag, chapterFsm, chapterUnlockSignal, offlineKey, offlineSignal, poseFsm,
  STAGE_ONLY_FLAG, STAGE_HIDE_KEY, STAGE_SHOW_KEY, ROOM_IDS,
  grantKey, grantClaimedFlag, grantStock,
} from './world-data.js';

/** 局外持久态（`services/save` 信封里的 data·宿主读回后作蓝图初值）。兴致不在里面（当次临时）。 */
export interface PersistedState {
  readonly stardust: number;
  /** 每个一次性来源的已领 id；旧档缺省为空。 */
  readonly claimedGrants?: readonly string[];
  /** `<key>.<cat>` → 值（只含 persist:true 的量）。 */
  readonly relations: Readonly<Record<string, number>>;
  /** 物品 id → 数量。 */
  readonly items: Readonly<Record<string, number>>;
  readonly placed: readonly string[];
  /** 已解锁章节 id。 */
  readonly chapters: readonly string[];
  /** 章节 id → 对话游标（节点 id）。 */
  readonly cursors: Readonly<Record<string, string>>;
  /** 旧档缺省为空；陪伴过的物件会留下痕迹。 */
  readonly itemUses?: Readonly<Record<string, number>>;
}
export const EMPTY_STATE: PersistedState = { stardust: 0, claimedGrants: [], relations: {}, items: {}, placed: [], chapters: [], cursors: {} };

const TEXT_BASE = { fontSize: 14, fontFamily: 'sans-serif', anchor: 'center', lineSpacing: 1.2 } as const;
const AT_ORIGIN = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } as const;

// ── 关系四量（一实体一 Resource；兴致挂自然下行）──────────────────────────
function relationEntities(s: PersistedState): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  for (const r of RELATIONS) {
    const id = relId(r.key, ACTIVE_CAT);
    const current = r.persist ? (s.relations[id] ?? r.start) : r.start;
    out[`rel-${ACTIVE_CAT}-${r.key}`] = {
      Resource: { id, current, min: r.min, max: r.max },
      ...(r.key === 'mood'
        ? { OverTime: { effects: [{ id: 'mood-drift', resource: id, amountPerTick: MOOD_DRIFT.amountPerTick, period: MOOD_DRIFT.period, duration: 0, elapsed: 0 }] } }
        : {}),
    };
  }
  return out;
}

// ── 陪伴动作：具名 action → Signal → 逐项 Effect（同信号多条·order 定序）+ 姿态机 ───────
//   姿态机 pose.<cat>（j1-state·rest/lookup/settled·不进档）：每个动作末尾一条 set-state，
//   投影按姿态换台词与画面 = 「操作有画面确认」（八问第 2 问·S4 第 2 轮）。
function careEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  out[`pose-${ACTIVE_CAT}`] = { State: { fsmId: poseFsm(ACTIVE_CAT), current: 'rest', previous: 'rest' } };
  for (const a of CARE_ACTIONS) {
    out[`kb-${a.id}`] = { KeyBinding: { key: a.key, signal: a.key, phase: 'action' } };
    a.effects.forEach((e, i) => {
      out[`fx-${a.id}-${i}`] = { Effect: { onSignal: a.key, kind: 'modify-resource', targetId: e.res, op: 'add', value: e.amount, order: i } };
    });
    out[`fx-${a.id}-pose`] = { Effect: { onSignal: a.key, kind: 'set-state', targetId: poseFsm(ACTIVE_CAT), value: a.pose, order: a.effects.length } };
  }
  return out;
}

// ── 杂货铺 + 仓库 + 放到馆里 ────────────────────────────────────────────
function shopEntities(s: PersistedState): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  for (const it of SHOP_ITEMS) {
    const n = s.items[it.id] ?? 0;
    out[`res-item-${it.id}`] = { Resource: { id: itemCount(it.id), current: n, min: 0, max: 99 } };
    out[`flag-own-${it.id}`] = { Flag: { id: ownFlag(it.id), active: n > 0 } };
    out[`flag-placed-${it.id}`] = { Flag: { id: placedFlag(it.id), active: n > 0 && s.placed.includes(it.id) } };
    out[`stock-${it.id}`] = { Resource: { id: `stock.${it.id}`, current: n > 0 ? 0 : 1, min: 0, max: 1 } };
    out[`kb-buy-${it.id}`] = { KeyBinding: { key: buyKey(it.id), signal: buyKey(it.id), phase: 'action' } };
    // 可负担才成交，否则整单不动（craft-recipe 口径）——心光永不进 costs（GDD §12.2）。
    out[`recipe-${it.id}`] = {
      CraftRecipe: { onSignal: buyKey(it.id), costs: [{ id: STARDUST, amount: it.price }, { id: `stock.${it.id}`, amount: 1 }], gains: [{ id: itemCount(it.id), amount: 1 }], grantsFlag: ownFlag(it.id) },
    };
    out[`kb-place-${it.id}`] = { KeyBinding: { key: placeKey(it.id), signal: placeKey(it.id), phase: 'action' } };
    // 非消耗式拥有门：同一配方扣 1 再还 1，只有真正拥有时才能摆放。
    out[`recipe-place-${it.id}`] = { CraftRecipe: { onSignal: placeKey(it.id), costs: [{ id: itemCount(it.id), amount: 1 }], gains: [{ id: itemCount(it.id), amount: 1 }], grantsFlag: placedFlag(it.id) } };
    out[`kb-remove-${it.id}`] = { KeyBinding: { key: removeKey(it.id), signal: removeKey(it.id), phase: 'action' } };
    out[`fx-remove-${it.id}`] = { Effect: { onSignal: removeKey(it.id), kind: 'set-flag', targetId: placedFlag(it.id), value: false } };
  }
  return out;
}

/** 一次性星砂来源：KeyBinding → 消耗唯一 stock 的 CraftRecipe → 星砂 + 已领 Flag。 */
function currencyGrantEntities(s: PersistedState): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  for (const grant of STARDUST_GRANTS) {
    const claimed = s.claimedGrants?.includes(grant.id) ?? false;
    out[`res-grant-${grant.id}`] = { Resource: { id: grantStock(grant.id), current: claimed ? 0 : 1, min: 0, max: 1 } };
    out[`flag-grant-${grant.id}`] = { Flag: { id: grantClaimedFlag(grant.id), active: claimed } };
    out[`kb-grant-${grant.id}`] = { KeyBinding: { key: grantKey(grant.id), signal: grantKey(grant.id), phase: 'action' } };
    out[`recipe-grant-${grant.id}`] = { CraftRecipe: {
      onSignal: grantKey(grant.id), costs: [{ id: grantStock(grant.id), amount: 1 }],
      gains: [{ id: STARDUST, amount: grant.amount }], grantsFlag: grantClaimedFlag(grant.id),
    } };
  }
  return out;
}

/** 轻量互动：State + EventWhen + Effect + Timer，无专用 system。 */
function itemInteractionEntities(s: PersistedState): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {
    'item-request': { State: { fsmId: ITEM_REQUEST, current: 'none', previous: 'none' } },
    'item-activity': { State: { fsmId: ITEM_ACTIVITY, current: 'none', previous: 'none' } },
    'item-room': { State: { fsmId: ITEM_ROOM, current: 'hall', previous: 'hall' } },
    'item-clock': { Timer: { id: 'item-clock', elapsed: 0, duration: 150, loop: false } },
    // 先清消费完的上拍请求，再写本拍输入：不会吞连续输入，也不会把无效点击排队到以后。
    'item-clear-request': { EventWhen: { signal: 'items.clear-request', when: { kind: 'always' }, mode: 'level', armed: false } },
    'item-clear-request-fx': { Effect: { onSignal: 'items.clear-request', kind: 'set-state', targetId: ITEM_REQUEST, value: 'none', order: -100 } },
  };
  const state = (fsmId: string, equals: string): ConditionExpr => ({ kind: 'state', fsmId, equals });
  const inHall = state(ITEM_ROOM, 'hall');
  const idle = state(ITEM_ACTIVITY, 'none');
  const cancelled: ConditionExpr = { kind: 'or', of: [state(ITEM_REQUEST, ITEM_CANCEL), { kind: 'not', of: inHall }] };
  // 仅展开 EventWhen/Effect 数据；运行时条件仍由引擎解释。
  const rule = (signal: string, when: ConditionExpr, effects: Omit<Effect, 'type' | 'onSignal'>[]): void => {
    out[`gate-${signal}`] = { EventWhen: { signal, when, mode: 'level', armed: false } };
    effects.forEach((effect, i) => { out[`fx-${signal}-${i}`] = { Effect: { ...effect, onSignal: signal, order: i } }; });
  };
  const activity = (value: string): Omit<Effect, 'type' | 'onSignal'> => ({ kind: 'set-state', targetId: ITEM_ACTIVITY, value });
  const clock = (value: number): Omit<Effect, 'type' | 'onSignal'> => ({ kind: 'reset-timer', targetEntity: 'item-clock', targetId: '', value });
  rule('items.cancelled', cancelled, [activity('none')]);
  for (const room of ROOM_IDS) {
    const key = `room.visit.${room}`;
    out[`kb-visit-${room}`] = { KeyBinding: { key, signal: key, phase: 'action' } };
    out[`fx-visit-${room}`] = { Effect: { onSignal: key, kind: 'set-state', targetId: ITEM_ROOM, value: room } };
  }
  for (const key of [ITEM_CANCEL, ...ITEM_EXPERIENCES.flatMap((it) => [useKey(it.id), respondKey(it.id)])]) {
    out[`kb-${key}`] = { KeyBinding: { key, signal: key, phase: 'action' } };
    out[`fx-${key}`] = { Effect: { onSignal: key, kind: 'set-state', targetId: ITEM_REQUEST, value: key } };
  }
  for (const it of ITEM_EXPERIENCES) {
    out[`uses-${it.id}`] = { Resource: { id: usesId(it.id), current: s.itemUses?.[it.id] ?? 0, min: 0, max: 9999 } };
    const placed: ConditionExpr = { kind: 'flag', id: placedFlag(it.id) };
    const invite = state(ITEM_ACTIVITY, `${it.id}:invite`);
    const done = state(ITEM_ACTIVITY, `${it.id}:done`);
    rule(`items.start.${it.id}`, { kind: 'and', of: [inHall, idle, placed,
      state(ITEM_REQUEST, useKey(it.id)), { kind: 'resource', id: itemCount(it.id), cmp: 'gte', value: 1 },
    ] }, [activity(`${it.id}:invite`), clock(150)]);
    rule(`items.finish.${it.id}`, { kind: 'and', of: [inHall, invite, placed,
      state(ITEM_REQUEST, respondKey(it.id)), { kind: 'timer', id: 'item-clock', cmp: 'lt', value: 150 },
    ] }, [activity(`${it.id}:done`), clock(24),
      { kind: 'modify-resource', targetId: relId(it.benefit, ACTIVE_CAT), op: 'add', value: 2 },
      { kind: 'modify-resource', targetId: usesId(it.id), op: 'add', value: 1 },
    ]);
    rule(`items.end.${it.id}`, { kind: 'and', of: [
      { kind: 'or', of: [invite, done] },
      { kind: 'or', of: [
        { kind: 'not', of: placed },
        { kind: 'and', of: [invite, { kind: 'timer', id: 'item-clock', cmp: 'gte', value: 150 }] },
        { kind: 'and', of: [done, { kind: 'timer', id: 'item-clock', cmp: 'gte', value: 24 }] },
      ] },
    ] }, [activity('none')]);
  }
  return out;
}

// ── 回忆章节：心光阈值解锁（edge）+ 章节对话机 ─────────────────────────────
function chapterEntities(s: PersistedState): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  for (const c of CHAPTERS) {
    const unlocked = s.chapters.includes(c.id);
    out[`flag-chapter-${c.id}`] = { Flag: { id: chapterFlag(c.id), active: unlocked } };
    out[`gate-chapter-${c.id}`] = {
      EventWhen: {
        signal: chapterUnlockSignal(c.id),
        when: { kind: 'resource', id: relId('heartlight', c.cat), cmp: 'gte', value: c.unlockHeartlight },
        mode: 'edge', armed: unlocked,
      },
    };
    out[`fx-chapter-${c.id}`] = { Effect: { onSignal: chapterUnlockSignal(c.id), kind: 'set-flag', targetId: chapterFlag(c.id), value: true } };
    const cursor = s.cursors[c.id] ?? c.start;
    out[`dlg-${c.id}`] = {
      DialogueScript: { fsmId: chapterFsm(c.id), nodes: c.nodes },
      State: { fsmId: chapterFsm(c.id), current: cursor, previous: cursor },
      Text: { content: '', ...TEXT_BASE },
    };
  }
  return out;
}

// ── 离线小事件：分档 key → 种子抽模板 → prefab 展开；ack 批量回收 ─────────────
function offlineEntities(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  for (const t of OFFLINE_TIERS) {
    // 每档一张权重表（离开越久，「睡过你的位置」这类痕迹越重·纯数据）；权重 0 的模板不会被抽到。
    const table = OFFLINE_EVENTS.map((e) => ({ templateId: e.id, weight: e.weight[t] })).filter((x) => x.weight > 0);
    out[`kb-offline-${t}`] = { KeyBinding: { key: offlineKey(t), signal: offlineSignal(t), phase: 'action' } };
    out[`gen-offline-${t}`] = { Transform: { ...AT_ORIGIN }, WeightedSpawn: { onSignal: offlineSignal(t), table } };
  }
  out['prefabs'] = {
    PrefabLibrary: {
      seq: 0,
      templates: Object.fromEntries(OFFLINE_EVENTS.map((e) => [e.id, {
        entities: { prop: { Transform: { ...AT_ORIGIN }, Tag: { flags: OFFLINE_TAG }, Text: { content: e.text, ...TEXT_BASE } } },
      }])),
    },
  };
  out['kb-offline-ack'] = { KeyBinding: { key: OFFLINE_ACK_KEY, signal: 'offline:ack', phase: 'action' } };
  // destroy-tagged 的掩码走 `value`（logic.ts:143「destroy-tagged：value=Tag 掩码」·effect-apply.ts:238 实读 value；
  // schema 注释写 tagMask 是姊妹条 set-*-tagged 的口径——已报 S3 复查记录）。`targetId` 该 kind 不读，
  // 但 Effect 类型要求非空字符串 → 填语义名占位，不是路由键。
  out['fx-offline-ack'] = { Effect: { onSignal: 'offline:ack', kind: 'destroy-tagged', targetId: 'offline-props', value: OFFLINE_TAG } };
  return out;
}

// ── 沉浸模式：Flag + 两把 key → set-flag（UI 侧 visibleWhen 消费·不进档）────────────
function stageOnlyEntities(): Record<string, EntityBlueprint> {
  return {
    'flag-stage-only': { Flag: { id: STAGE_ONLY_FLAG, active: false } },
    'kb-stage-hide': { KeyBinding: { key: STAGE_HIDE_KEY, signal: STAGE_HIDE_KEY, phase: 'action' } },
    'fx-stage-hide': { Effect: { onSignal: STAGE_HIDE_KEY, kind: 'set-flag', targetId: STAGE_ONLY_FLAG, value: true } },
    'kb-stage-show': { KeyBinding: { key: STAGE_SHOW_KEY, signal: STAGE_SHOW_KEY, phase: 'action' } },
    'fx-stage-show': { Effect: { onSignal: STAGE_SHOW_KEY, kind: 'set-flag', targetId: STAGE_ONLY_FLAG, value: false } },
  };
}

export function buildBlueprint(seed = SEED_DEFAULT, s: PersistedState = EMPTY_STATE): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {
    world: { RandomSeed: { seed, state: seed >>> 0 }, StringVar: { id: 'activeCat', value: ACTIVE_CAT } },
    'res-stardust': { Resource: { id: STARDUST, current: s.stardust, min: 0, max: STARDUST_MAX } },
    ...relationEntities(s),
    ...careEntities(),
    ...shopEntities(s),
    ...currencyGrantEntities(s),
    ...itemInteractionEntities(s),
    ...chapterEntities(s),
    ...offlineEntities(),
    ...stageOnlyEntities(),
  };
  return {
    capabilities: [
      resourceCapability, flagCapability, stringVariableCapability, randomCapability, textCapability,
      tagCapability, transformCapability, spawnCapability, destroyCapability,
      eventWhenCapability, effectApplyCapability, overTimeCapability, keybindCapability,
      craftRecipeCapability, weightedSpawnCapability,
      dialogueCapability, prefabCapability, timerCapability,
    ],
    entities,
    meta: { tickRate: 5 },
  };
}
