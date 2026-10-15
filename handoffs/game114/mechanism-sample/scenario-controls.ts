// Preview-only scenario controls: UI actions select declarative world edits; movement remains engine-owned.
import type { Component } from '@zerocraft/engine/engine/core/types.js';
import type { World } from '@zerocraft/engine/engine/core/world.js';
import type { FlowField, Line3D, NavGraph, Shape, Transform } from '@zerocraft/engine/engine/protocol/components.js';
import type { CrowdAvoidance } from '@zerocraft/engine/engine/protocol/components/crowd.js';
import { contactBetween } from '@zerocraft/engine/engine/spatial/contact.js';
import { getBakedField } from '@zerocraft/engine/skills/tier2/flow-field-core.js';
import { usableGuideField } from '@zerocraft/engine/skills/tier2/crowd-flow-guide.js';
import { repathOccupancy, type RepathObstacle } from '@zerocraft/engine/skills/tier2/crowd-route-repath.js';
import { sampleBlueprint, oxTemplateIds, type OxGroup } from './scene';
import { playPatrolEntity, playPatrolIds, playRoutes } from './play-scene';
import { buildFlowDebugLines, buildOccupancyDebugLines, flowFieldId, FLOW_VIEWS, type FlowView } from './flow-debug-view';

const GROUPS: readonly OxGroup[] = ['upper', 'lower', 'left', 'right'];
const VECTOR_SUFFIXES = ['desired', 'raw', 'actual', 'avoid'] as const;
export const MAX_OXEN = 128;
export const MAX_PLAY_PATROLS = 96;

export interface ScenarioControlState { oxen: number; linesVisible: boolean; flowView: FlowView;
  flowMarks: number; occupancyMarks: number; occupancyPenalty: number }

export class ScenarioControls {
  private readonly activeAgents: string[];
  private readonly lineData = new Map<string, Line3D>();
  private readonly flowLineIds: string[] = [];
  private readonly costLineIds: string[] = [];
  private flowBake: ReturnType<typeof getBakedField> | null = null;
  private occupancySnapshot: Uint8Array | null = null;
  private flowUpdateTicks = 0;
  private linesVisible = true;
  private flowView: FlowView = 'off';
  private serial = 0;

  constructor(private readonly world: World, initialOxen = 16, showLines = true,
    private readonly setting: 'stress' | 'garden' | 'play' = 'stress') {
    this.activeAgents = setting === 'play' ? [...playPatrolIds] : GROUPS.flatMap(group => oxTemplateIds[group]);
    for (const [id] of world.query('Line3D')) {
      const line = world.getComponent<Line3D>(id, 'Line3D');
      if (line) this.lineData.set(id, structuredClone(line));
    }
    if (!showLines) this.setLinesVisible(false);
    if (setting !== 'play' && initialOxen > this.activeAgents.length)
      this.add(Math.min(initialOxen, MAX_OXEN) - this.activeAgents.length);
  }

  get state(): ScenarioControlState {
    let occupancyPenalty = 0;
    if (this.flowView !== 'off') {
      const fieldId = flowFieldId(this.flowView);
      for (const [id] of this.world.query('CrowdAvoidance')) {
        const guide = this.world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')?.flowGuide;
        if (guide?.fieldId !== fieldId) continue;
        occupancyPenalty = guide.occupancyPenalty ?? 0;
        break;
      }
    }
    return { oxen: this.activeAgents.length, linesVisible: this.linesVisible,
      flowView: this.flowView, flowMarks: this.flowLineIds.length,
      occupancyMarks: this.costLineIds.length, occupancyPenalty };
  }

  dispatch(action: string): void {
    switch (action) {
      case 'scenario.lines': this.setLinesVisible(!this.linesVisible); break;
      case 'scenario.flow': this.cycleFlowView(); break;
      case 'scenario.add': this.add(Math.min(this.setting === 'play' ? 2 : 4,
        (this.setting === 'play' ? MAX_PLAY_PATROLS : MAX_OXEN) - this.activeAgents.length)); break;
      case 'scenario.remove': this.remove(Math.min(this.setting === 'play' ? 2 : 4, this.activeAgents.length)); break;
      case 'scenario.double': this.add(Math.min(Math.max(this.setting === 'play' ? 2 : 16, this.activeAgents.length),
        (this.setting === 'play' ? MAX_PLAY_PATROLS : MAX_OXEN) - this.activeAgents.length)); break;
    }
  }

  private cycleFlowView(): void {
    this.clearFlowView();
    const next = (FLOW_VIEWS.indexOf(this.flowView) + 1) % FLOW_VIEWS.length;
    this.flowView = FLOW_VIEWS[next]!;
    this.ensureFlowView();
  }

  /** The first UI click may precede the grid system's first tick. */
  ensureFlowView(): boolean {
    if (this.flowView === 'off') return false;
    const field = this.world.getComponent<FlowField>(flowFieldId(this.flowView), 'FlowField');
    if (!field || !usableGuideField(field)) {
      const hadLines = this.flowLineIds.length + this.costLineIds.length > 0;
      this.clearFlowView();
      return hadLines;
    }
    const baked = getBakedField(field);
    const fieldChanged = baked !== this.flowBake;
    if (fieldChanged) {
      this.clearFlowView();
      this.flowBake = baked;
      for (const { id, line } of buildFlowDebugLines(field, this.flowView)) {
        this.world.createEntity(id);
        this.world.addComponent(id, line);
        this.flowLineIds.push(id);
      }
    }
    // Debug-only sampling avoids destroying hundreds of cell outlines every render tick.
    if (!fieldChanged && ++this.flowUpdateTicks < 8) return false;
    this.flowUpdateTicks = 0;
    const graph = this.world.getComponent<NavGraph>(flowFieldId(this.flowView), 'NavGraph');
    const obstacles: RepathObstacle[] = this.world.query('CrowdAvoidance', 'Transform').flatMap(([id]) => {
      if (this.world.hasComponent(id, 'Sensor')) return [];
      const t = this.world.getComponent<Transform>(id, 'Transform')!;
      const cfg = this.world.getComponent<CrowdAvoidance>(id, 'CrowdAvoidance')!;
      const shape = this.world.getComponent<Shape>(id, 'Shape');
      const radius = shape?.kind === 'circle' ? shape.radius : cfg.radius;
      return Number.isFinite(t.x) && Number.isFinite(t.y) && Number.isFinite(radius) && radius! > 0
        ? [{ x: t.x, y: t.y, radius: radius! }] : [];
    });
    const occupied = graph ? repathOccupancy(graph, obstacles) : null;
    if (occupied && this.occupancySnapshot && occupied.every((value, i) => value === this.occupancySnapshot![i]))
      return fieldChanged;
    const oldCount = this.costLineIds.length;
    this.clearCostLines();
    this.occupancySnapshot = occupied;
    if (occupied) for (const { id, line } of buildOccupancyDebugLines(field, occupied, this.flowView)) {
      this.world.createEntity(id);
      this.world.addComponent(id, line);
      this.costLineIds.push(id);
    }
    return fieldChanged || oldCount !== this.costLineIds.length;
  }

  private clearFlowView(): void {
    for (const id of this.flowLineIds) this.world.destroyEntity(id);
    this.flowLineIds.length = 0;
    this.flowBake = null;
    this.clearCostLines();
    this.occupancySnapshot = null;
    this.flowUpdateTicks = 0;
  }

  private clearCostLines(): void {
    for (const id of this.costLineIds) this.world.destroyEntity(id);
    this.costLineIds.length = 0;
  }

  private setLinesVisible(visible: boolean): void {
    this.linesVisible = visible;
    for (const [id, data] of this.lineData) {
      if (visible) this.world.addComponent(id, structuredClone(data));
      else this.world.removeComponent(id, 'Line3D');
    }
  }

  private spawnPosition(group: OxGroup): { x: number; y: number } | undefined {
    const vertical = group === 'upper' || group === 'lower';
    const sign = group === 'upper' || group === 'right' ? 1 : -1;
    const depths = this.setting === 'garden' ? [13, 16, 19, 22, 25, 28, 31] : [16, 21, 26, 30];
    const laneValues = this.setting === 'garden' && !vertical
      ? [-4, -2, 0, 2, 4]
      : [-16, -12, -8, -4, 0, 4, 8, 12, 16];
    const firstLane = Math.floor(this.serial / GROUPS.length) % laneValues.length;
    const lanes = [...laneValues.slice(firstLane), ...laneValues.slice(0, firstLane)];
    const footprint = { type: 'Shape', kind: 'circle', radius: .95, category: 1, mask: 3 } as Shape;
    for (const lane of lanes) for (const depth of depths) {
      const x = vertical ? lane : sign * depth;
      const y = vertical ? sign * depth : lane;
      const candidate = { type: 'Transform', x, y, rotation: 0, scaleX: 1, scaleY: 1 } as Transform;
      let free = true;
      for (const [otherId] of this.world.query('Shape', 'Transform')) {
        const otherShape = this.world.getComponent<Shape>(otherId, 'Shape')!;
        const other = this.world.getComponent<Transform>(otherId, 'Transform')!;
        if (contactBetween(candidate, footprint, other, otherShape)) { free = false; break; }
      }
      if (free) return { x, y };
    }
    return undefined;
  }

  private addPlayPatrols(amount: number): void {
    const footprint = { type: 'Shape', kind: 'circle', radius: .8, category: 1, mask: 3 } as Shape;
    for (let n = 0; n < amount; n++) {
      const route = playRoutes[this.serial % playRoutes.length]!;
      let spawn: { x: number; y: number; nextIndex: number } | undefined;
      for (let offset = 0; offset < route.points.length && !spawn; offset++) {
        const index = (this.serial * 7 + offset) % route.points.length;
        const from = route.points[index]!;
        const to = route.points[(index + 1) % route.points.length]!;
        for (const t of [.2, .5, .8]) {
          const x = from.x + (to.x - from.x) * t;
          const y = from.y + (to.y - from.y) * t;
          const candidate = { type: 'Transform', x, y, rotation: 0, scaleX: 1, scaleY: 1 } as Transform;
          if (this.world.query('Shape', 'Transform').some(([id]) =>
            contactBetween(candidate, footprint,
              this.world.getComponent<Transform>(id, 'Transform')!,
              this.world.getComponent<Shape>(id, 'Shape')!))) continue;
          spawn = { x, y, nextIndex: (index + 1) % route.points.length };
          break;
        }
      }
      if (!spawn) break;
      const id = `patrol-extra-${this.serial++}`;
      this.world.createEntity(id);
      for (const [type, source] of Object.entries(playPatrolEntity(route, spawn, spawn.nextIndex)))
        this.world.addComponent(id, { ...structuredClone(source), type } as Component);
      this.activeAgents.push(id);
    }
  }

  private add(amount: number): void {
    if (this.setting === 'play') { this.addPlayPatrols(amount); return; }
    for (let n = 0; n < amount; n++) {
      const group = GROUPS[this.serial % GROUPS.length]!;
      const templateId = oxTemplateIds[group][0]!;
      const template = sampleBlueprint.entities[templateId]!;
      const spawn = this.spawnPosition(group);
      if (!spawn) break;
      const id = `stress-ox-${this.serial++}`;
      this.world.createEntity(id);
      for (const [type, source] of Object.entries(template)) {
        const data = structuredClone(source) as Record<string, unknown>;
        if (type === 'Transform') { data.x = spawn.x; data.y = spawn.y; }
        if (type === 'Model3D' && this.setting !== 'stress') data.tint = 0x71879a;
        if (type === 'PathFollow') {
          const lane = group === 'upper' || group === 'lower' ? spawn.x : spawn.y;
          data.waypoints = group === 'upper' || group === 'lower'
            ? [{ x: lane, y: group === 'upper' ? 22 : -22 }, { x: lane, y: group === 'upper' ? -22 : 22 }]
            : [{ x: group === 'left' ? -20 : 20, y: lane }, { x: group === 'left' ? 20 : -20, y: lane }];
        }
        if (type === 'CrowdAvoidance') {
          data.debugVectorPrefix = `crowd-vector-${id}`;
        }
        if (type === 'Trail3D' && this.setting !== 'stress') continue;
        this.world.addComponent(id, { ...data, type } as Component);
      }
      for (const suffix of VECTOR_SUFFIXES) {
        const lineId = `crowd-vector-${id}:${suffix}`;
        const sourceId = `crowd-vector-${templateId}:${suffix}`;
        const source = sampleBlueprint.entities[sourceId]!.Line3D as unknown as Line3D;
        const line = { ...structuredClone(source), type: 'Line3D' as const, points: [] };
        this.lineData.set(lineId, line);
        this.world.createEntity(lineId);
        if (this.linesVisible) this.world.addComponent(lineId, structuredClone(line));
      }
      this.activeAgents.push(id);
    }
  }

  private remove(amount: number): void {
    if (this.setting === 'play') {
      for (let n = 0; n < amount; n++) {
        const id = this.activeAgents.pop();
        if (!id) break;
        this.world.destroyEntity(id);
      }
      return;
    }
    for (let n = 0; n < amount; n++) {
      const id = this.activeAgents.pop();
      if (!id) break;
      this.world.destroyEntity(id);
      for (const suffix of VECTOR_SUFFIXES) {
        const lineId = `crowd-vector-${id}:${suffix}`;
        this.world.destroyEntity(lineId);
        this.lineData.delete(lineId);
      }
    }
  }
}
