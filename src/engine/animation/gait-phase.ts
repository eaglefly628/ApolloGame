/** D2 candidate: calibrated cyclic gait synchronization, independent of renderer/simulation.
 * Distance Q units must be identical for acceptedDistanceQ and all stride distances.
 * No contact is inferred: every member requires reviewed marker provenance and source SHA.
 */
export const GAIT_PHASE_SCALE = 1_000_000;
export const GAIT_MAX_DISTANCE_Q = 1_000_000_000;
export const GAIT_MAX_EVENTS = 64;
export const GAIT_MAX_CYCLE = 1_000_000_000;
const MAX_DURATION = 1_000_000_000_000;
const MAX_STRIDE = 1_000_000_000_000;
export interface GaitCanonicalMarker {
  readonly id: string;
  readonly phaseQ: number;
  readonly foot: 'left' | 'right';
  readonly kind: 'plant' | 'lift';
}
export interface GaitPhaseMember {
  readonly durationSubticks: number;
  readonly markers: readonly { readonly id: string; readonly atSubtick: number }[];
  readonly strideDistanceQ: number;
  readonly sourceSha256: string;
  readonly calibrationStatus: 'reviewed';
  readonly provenance: string;
}
export interface GaitPhaseGroupV1 {
  readonly version: 1;
  readonly id: string;
  readonly referenceStrideDistanceQ: number;
  /** Sorted, strictly increasing, half-open [0, 1e6); first marker is the phase0 anchor. */
  readonly markers: readonly GaitCanonicalMarker[];
  readonly members: Readonly<Record<string, GaitPhaseMember>>;
}
export interface GaitPhaseStateV1 {
  readonly version: 1;
  readonly configCanonical: string;
  readonly phaseQ: number;
  readonly cycle: number;
  /** Numerator remainder, denominator = referenceStrideDistanceQ. */
  readonly remainder: number;
  readonly instance: number;
  readonly started: boolean;
}
export interface GaitPlantEvent {
  readonly id: string;
  readonly groupId: string;
  readonly instance: number;
  readonly cycle: number;
  readonly markerId: string;
  readonly phaseQ: number;
  readonly kind: 'plant';
  readonly foot: 'left' | 'right';
}
export type GaitWeightsQ = Readonly<Record<string, number>>;

function reject(message: string): never {
  throw new Error(`GaitPhaseGroupV1: ${message}`);
}
function integer(value: unknown, label: string, min: number, max: number): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    reject(`${label} must be an integer in ${min}..${max}`);
  }
}
function stableId(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(value)) {
    reject(`${label} must be a stable id`);
  }
}
/** No accessors, symbols, hidden properties, inherited hooks, sparse arrays, cycles/shared references. */
function dataTree(value: unknown): void {
  const seen = new WeakSet<object>();
  let visited = 0;
  function visit(v: unknown, depth: number): void {
    if (++visited > 32_000 || depth > 12) reject('data tree budget exceeded');
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) reject('nonfinite data');
      return;
    }
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return;
    if (!v || typeof v !== 'object') reject('plain JSON data required');
    if (seen.has(v)) reject('cyclic/shared data references');
    seen.add(v);
    if (Object.getOwnPropertySymbols(v).length) reject('symbol fields');
    const names = Object.getOwnPropertyNames(v);
    const keys = Object.keys(v);
    if (Array.isArray(v)) {
      if (Object.getPrototypeOf(v) !== Array.prototype || v.length > 4096 || keys.length !== v.length || names.length !== v.length + 1) {
        reject('plain dense array required');
      }
    } else if ((Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null) || names.length !== keys.length) {
      reject('plain enumerable object required');
    }
    for (const key of keys) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) reject('unsafe field');
      const descriptor = Object.getOwnPropertyDescriptor(v, key)!;
      if (!('value' in descriptor)) reject('accessor field');
      visit(descriptor.value, depth + 1);
    }
  }
  visit(value, 0);
}
function fields(value: unknown, allowed: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) reject(`${label} object required`);
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== allowed.length || allowed.some(key => !Object.hasOwn(record, key))) {
    reject(`${label} fields mismatch`);
  }
  return record;
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const record = value as Record<string, unknown>;
  return '{' + Object.keys(record).sort().map(key => JSON.stringify(key) + ':' + canonical(record[key])).join(',') + '}';
}

export function validateGaitPhaseGroup(value: unknown): GaitPhaseGroupV1 {
  dataTree(value);
  const config = fields(value, ['version', 'id', 'referenceStrideDistanceQ', 'markers', 'members'], 'group');
  if (config.version !== 1) reject('unsupported version');
  stableId(config.id, 'group id');
  integer(config.referenceStrideDistanceQ, 'reference stride', 1, MAX_STRIDE);
  if (!Array.isArray(config.markers) || config.markers.length < 2 || config.markers.length > 32) reject('markers require 2..32 entries');
  const ids = new Set<string>();
  const plants = new Set<string>();
  let previousPhase = -1;
  for (const raw of config.markers) {
    const marker = fields(raw, ['id', 'phaseQ', 'foot', 'kind'], 'canonical marker');
    stableId(marker.id, 'marker id');
    if (ids.has(marker.id)) reject('duplicate marker id');
    ids.add(marker.id);
    integer(marker.phaseQ, 'marker phase', 0, GAIT_PHASE_SCALE - 1);
    if (marker.phaseQ <= previousPhase) reject('canonical marker phases must strictly increase');
    previousPhase = marker.phaseQ;
    if (marker.foot !== 'left' && marker.foot !== 'right') reject('marker foot must be left/right');
    if (marker.kind !== 'plant' && marker.kind !== 'lift') reject('marker kind must be plant/lift');
    if (marker.kind === 'plant') plants.add(marker.foot);
  }
  if (config.markers[0].phaseQ !== 0) reject('phase0 marker anchor required');
  if (!plants.has('left') || !plants.has('right')) reject('left and right plant markers required');
  if (!config.members || typeof config.members !== 'object' || Array.isArray(config.members)) reject('members object required');
  const members = config.members as Record<string, unknown>;
  const aliases = Object.keys(members);
  if (aliases.length < 1 || aliases.length > 64) reject('members require 1..64 clips');
  const canonicalIds = config.markers.map((marker: GaitCanonicalMarker) => marker.id);
  for (const alias of aliases) {
    stableId(alias, 'clip id');
    const member = fields(members[alias], ['durationSubticks', 'markers', 'strideDistanceQ', 'sourceSha256', 'calibrationStatus', 'provenance'], 'member');
    integer(member.durationSubticks, 'durationSubticks', 1, MAX_DURATION);
    integer(member.strideDistanceQ, 'member stride', 1, MAX_STRIDE);
    if (typeof member.sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(member.sourceSha256)) reject('member source SHA256 required');
    if (member.calibrationStatus !== 'reviewed') reject('reviewed calibration required');
    if (typeof member.provenance !== 'string' || !member.provenance.trim() || member.provenance.length > 1024 || /[\u0000-\u001f]/u.test(member.provenance)) reject('member provenance required');
    if (!Array.isArray(member.markers) || member.markers.length !== canonicalIds.length) reject('member marker set mismatch');
    const memberIds: string[] = [];
    let previousTime = -1;
    for (const raw of member.markers) {
      const marker = fields(raw, ['id', 'atSubtick'], 'member marker');
      stableId(marker.id, 'member marker id');
      integer(marker.atSubtick, 'member marker time', 0, member.durationSubticks);
      if (marker.atSubtick === member.durationSubticks || marker.atSubtick <= previousTime) reject('member times must strictly increase in half-open duration');
      previousTime = marker.atSubtick;
      if (!ids.has(marker.id) || memberIds.includes(marker.id)) reject('member marker set mismatch');
      memberIds.push(marker.id);
    }
    const rotation = canonicalIds.indexOf(memberIds[0]);
    if (memberIds.some((id, i) => id !== canonicalIds[(rotation + i) % canonicalIds.length])) reject('member marker cyclic order mismatch');
  }
  return value as GaitPhaseGroupV1;
}

export function validateGaitPhaseState(config: GaitPhaseGroupV1, value: unknown): GaitPhaseStateV1 {
  validateGaitPhaseGroup(config);
  dataTree(value);
  const state = fields(value, ['version', 'configCanonical', 'phaseQ', 'cycle', 'remainder', 'instance', 'started'], 'state');
  if (state.version !== 1 || state.configCanonical !== canonical(config)) reject('state config identity/version mismatch');
  integer(state.phaseQ, 'phaseQ', 0, GAIT_PHASE_SCALE - 1);
  integer(state.cycle, 'cycle', 0, GAIT_MAX_CYCLE);
  integer(state.remainder, 'remainder', 0, config.referenceStrideDistanceQ - 1);
  integer(state.instance, 'instance', 1, Number.MAX_SAFE_INTEGER);
  if (typeof state.started !== 'boolean') reject('started boolean required');
  if (!state.started && (state.phaseQ !== 0 || state.cycle !== 0 || state.remainder !== 0)) reject('unstarted state must be the initial anchor');
  return value as GaitPhaseStateV1;
}

export function createGaitPhaseGroup(config: GaitPhaseGroupV1, instance = 1): GaitPhaseStateV1 {
  validateGaitPhaseGroup(config);
  integer(instance, 'instance', 1, Number.MAX_SAFE_INTEGER);
  return { version: 1, configCanonical: canonical(config), phaseQ: 0, cycle: 0, remainder: 0, instance, started: false };
}

/** Weights are integer millionths. Missing members mean zero; no undeclared clip is accepted. */
export function selectGaitLeader(config: GaitPhaseGroupV1, weightsQ: GaitWeightsQ): string | undefined {
  validateGaitPhaseGroup(config);
  dataTree(weightsQ);
  if (!weightsQ || typeof weightsQ !== 'object' || Array.isArray(weightsQ)) reject('weights object required');
  let sum = 0;
  let leader: string | undefined;
  let highest = 0;
  for (const alias of Object.keys(weightsQ).sort()) {
    if (!Object.hasOwn(config.members, alias)) reject('weight references unknown member');
    const weight = weightsQ[alias];
    integer(weight, 'weightQ', 0, GAIT_PHASE_SCALE);
    sum += weight;
    if (sum > GAIT_PHASE_SCALE) reject('weight sum exceeds phase scale');
    if (weight > highest) { highest = weight; leader = alias; }
  }
  return leader;
}

function plantEvent(config: GaitPhaseGroupV1, state: GaitPhaseStateV1, marker: GaitCanonicalMarker, cycle: number): GaitPlantEvent {
  return {
    id: `${config.id}:${state.instance}:${cycle}:${marker.id}`,
    groupId: config.id, instance: state.instance, cycle, markerId: marker.id,
    phaseQ: marker.phaseQ, foot: marker.foot, kind: 'plant',
  };
}

/** Explicit positive-actual-motion signal, before reference-distance quantization.
 * This does not add distance or advance phase/cycle/remainder. The caller must
 * only invoke it when physical motion occurred (never for pause or stationary seek).
 * Inactive and already-started groups are idempotent; preview seek already marks started.
 */
export function startGaitPhaseGroup(
  config: GaitPhaseGroupV1,
  previous: GaitPhaseStateV1,
  weightsQ: GaitWeightsQ,
): { readonly state: GaitPhaseStateV1; readonly events: readonly GaitPlantEvent[]; readonly leader: string | undefined } {
  validateGaitPhaseState(config, previous);
  const leader = selectGaitLeader(config, weightsQ);
  if (leader === undefined || previous.started) return { state: { ...previous }, events: [], leader };
  // The snapshot validator requires an unstarted group to be at its initial anchor.
  const anchor = config.markers[0];
  return {
    state: { ...previous, started: true },
    events: anchor.kind === 'plant' ? [plantEvent(config, previous, anchor, previous.cycle)] : [],
    leader,
  };
}

/** Exact rational integration uses BigInt internally; persisted state/events contain JSON-safe numbers only.
 * No backward distance or unbounded catchup is supported. Budget violations throw before returning a new state.
 * The first positive accepted displacement fires an anchor plant once, even if only the rational remainder advances.
 * Thereafter markers use (oldPhase, newPhase], including exact wraps. Only group-level plant events are emitted.
 */
export function stepGaitPhaseGroup(
  config: GaitPhaseGroupV1,
  previous: GaitPhaseStateV1,
  input: { readonly acceptedDistanceQ: number; readonly weightsQ: GaitWeightsQ },
): { readonly state: GaitPhaseStateV1; readonly events: readonly GaitPlantEvent[]; readonly leader: string | undefined } {
  validateGaitPhaseState(config, previous);
  dataTree(input);
  fields(input, ['acceptedDistanceQ', 'weightsQ'], 'step input');
  integer(input.acceptedDistanceQ, 'acceptedDistanceQ', 0, GAIT_MAX_DISTANCE_Q);
  const leader = selectGaitLeader(config, input.weightsQ);
  // No positive member means the whole group is inactive, even if another motor accepted distance.
  // A zero-weight member still follows phase when any other member activates the group.
  if (input.acceptedDistanceQ === 0 || leader === undefined) return { state: { ...previous }, events: [], leader };
  const scale = BigInt(GAIT_PHASE_SCALE);
  const numerator = BigInt(input.acceptedDistanceQ) * scale + BigInt(previous.remainder);
  const denominator = BigInt(config.referenceStrideDistanceQ);
  const delta = numerator / denominator;
  const absolute = BigInt(previous.cycle) * scale + BigInt(previous.phaseQ) + delta;
  const nextCycle = absolute / scale;
  if (nextCycle > BigInt(GAIT_MAX_CYCLE)) reject('cycle overflow budget');
  const nextPhase = Number(absolute % scale);
  const occurrences: { marker: GaitCanonicalMarker; firstCycle: number; lastCycle: number }[] = [];
  const anchor = !previous.started && config.markers[0].kind === 'plant' ? config.markers[0] : undefined;
  let count = anchor ? 1 : 0;
  for (const marker of config.markers) {
    if (marker.kind !== 'plant') continue;
    const firstCycle = previous.cycle + (marker.phaseQ > previous.phaseQ ? 0 : 1);
    const lastCycle = Number(nextCycle) - (marker.phaseQ > nextPhase ? 1 : 0);
    if (lastCycle < firstCycle) continue;
    count += lastCycle - firstCycle + 1;
    if (count > GAIT_MAX_EVENTS) reject('plant event budget exceeded');
    occurrences.push({ marker, firstCycle, lastCycle });
  }
  const ordered: { marker: GaitCanonicalMarker; cycle: number }[] = [];
  if (anchor) ordered.push({ marker: anchor, cycle: 0 });
  for (const occurrence of occurrences) {
    for (let cycle = occurrence.firstCycle; cycle <= occurrence.lastCycle; cycle++) ordered.push({ marker: occurrence.marker, cycle });
  }
  ordered.sort((a, b) => a.cycle - b.cycle || a.marker.phaseQ - b.marker.phaseQ);
  const events = ordered.map(({ marker, cycle }) => plantEvent(config, previous, marker, cycle));
  const state: GaitPhaseStateV1 = {
    ...previous, phaseQ: nextPhase, cycle: Number(nextCycle),
    remainder: Number(numerator % denominator), started: true,
  };
  return { state, events, leader };
}

/** Marker-segment mapping is nondecreasing in absolute time, with <1-subtick floor rounding.
 * Every member starts at its own phase0 marker (which may be in the middle of its source clip).
 * Wrapped member streams increment clipCycle independently while sharing the same group phase.
 */
export function projectGaitPhaseGroup(config: GaitPhaseGroupV1, state: GaitPhaseStateV1): {
  readonly samples: Readonly<Record<string, { readonly timeSubticks: number; readonly clipCycle: number }>>;
} {
  validateGaitPhaseState(config, state);
  const samples: Record<string, { timeSubticks: number; clipCycle: number }> = {};
  for (const alias of Object.keys(config.members).sort()) {
    const member = config.members[alias];
    const positions = new Map(member.markers.map(marker => [marker.id, marker.atSubtick]));
    const unwrapped = [positions.get(config.markers[0].id)!];
    for (let i = 1; i < config.markers.length; i++) {
      const previous = positions.get(config.markers[i - 1].id)!;
      const current = positions.get(config.markers[i].id)!;
      unwrapped.push(unwrapped[i - 1] + ((current - previous + member.durationSubticks) % member.durationSubticks));
    }
    let segment = config.markers.length - 1;
    for (let i = 1; i < config.markers.length; i++) {
      if (state.phaseQ < config.markers[i].phaseQ) { segment = i - 1; break; }
    }
    const left = config.markers[segment].phaseQ;
    const right = segment + 1 < config.markers.length ? config.markers[segment + 1].phaseQ : GAIT_PHASE_SCALE;
    const leftTime = unwrapped[segment];
    const rightTime = segment + 1 < unwrapped.length ? unwrapped[segment + 1] : unwrapped[0] + member.durationSubticks;
    const time = BigInt(leftTime) + BigInt(state.phaseQ - left) * BigInt(rightTime - leftTime) / BigInt(right - left);
    const duration = BigInt(member.durationSubticks);
    samples[alias] = { timeSubticks: Number(time % duration), clipCycle: state.cycle + Number(time / duration) };
  }
  return { samples };
}

/** Preview seek never emits a plant or resets instance identity; future motion starts after the sought position.
 * Seek discards old rational remainder. A rollback should restore the serialized state instead of seeking.
 */
export function seekGaitPhaseGroup(
  config: GaitPhaseGroupV1,
  previous: GaitPhaseStateV1,
  position: { readonly phaseQ: number; readonly cycle: number },
): GaitPhaseStateV1 {
  validateGaitPhaseState(config, previous);
  dataTree(position);
  fields(position, ['phaseQ', 'cycle'], 'seek position');
  integer(position.phaseQ, 'seek phaseQ', 0, GAIT_PHASE_SCALE - 1);
  integer(position.cycle, 'seek cycle', 0, GAIT_MAX_CYCLE);
  return { ...previous, phaseQ: position.phaseQ, cycle: position.cycle, remainder: 0, started: true };
}
