import type { EntityId, ComponentType, Component, SystemDeclaration, IWorld } from './types.js';
import { topologicalSort } from './topological-sort.js';

export class World implements IWorld {
  private entities = new Map<EntityId, Map<ComponentType, Component>>();
  private systems: SystemDeclaration[] = [];
  private sorted: SystemDeclaration[] = [];
  private needsSort = false;
  private version = 0;

  // ── Entity operations ──

  createEntity(id: EntityId): void {
    if (this.entities.has(id)) throw new Error(`Entity "${id}" already exists`);
    this.entities.set(id, new Map());
  }

  destroyEntity(id: EntityId): void {
    this.entities.delete(id);
  }

  getAllEntities(): EntityId[] {
    return Array.from(this.entities.keys());
  }

  // ── Component operations ──

  addComponent(entityId: EntityId, component: Component): void {
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error(`Entity "${entityId}" not found`);
    entity.set(component.type, component);
  }

  removeComponent(entityId: EntityId, type: ComponentType): void {
    this.entities.get(entityId)?.delete(type);
  }

  getComponent<T extends Component>(entityId: EntityId, type: ComponentType): T | undefined {
    return this.entities.get(entityId)?.get(type) as T | undefined;
  }

  hasComponent(entityId: EntityId, type: ComponentType): boolean {
    return this.entities.get(entityId)?.has(type) ?? false;
  }

  // ── Queries ──

  query(...types: ComponentType[]): Array<[EntityId, Map<ComponentType, Component>]> {
    const results: Array<[EntityId, Map<ComponentType, Component>]> = [];
    for (const [id, comps] of this.entities) {
      if (types.every(t => comps.has(t))) {
        results.push([id, comps]);
      }
    }
    return results;
  }

  queryEntities(...types: ComponentType[]): EntityId[] {
    return this.query(...types).map(([id]) => id);
  }

  // ── System management ──

  addSystem(system: SystemDeclaration): void {
    this.systems.push(system);
    this.needsSort = true;
  }

  private ensureSorted(): void {
    if (this.needsSort) {
      this.sorted = topologicalSort(this.systems);
      this.needsSort = false;
    }
  }

  // ── Game loop ──

  tick(): void {
    this.ensureSorted();

    for (const system of this.sorted) {
      system.execute(this);

      // Consume: remove components marked as consumed
      for (const consumeType of system.consumes) {
        for (const [entityId, comps] of this.entities) {
          if (comps.has(consumeType)) {
            comps.delete(consumeType);
          }
        }
      }
    }

    this.version++;
  }

  getVersion(): number {
    return this.version;
  }

  getSortedSystems(): readonly SystemDeclaration[] {
    this.ensureSorted();
    return this.sorted;
  }
}
