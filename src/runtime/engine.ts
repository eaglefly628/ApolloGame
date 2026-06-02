import { World } from '@engine/core/world.js';
import type { Component, RendererBackend } from '@engine/core/types.js';
import type { WorldBlueprint } from '../assembly/demo.assembly.js';

export class Engine {
  readonly world: World;
  private rafId: number | null = null;
  private listeners: Array<() => void> = [];
  private renderer: RendererBackend | null = null;

  constructor() {
    this.world = new World();
  }

  load(blueprint: WorldBlueprint): void {
    for (const cap of blueprint.capabilities) {
      for (const system of cap.systems) {
        this.world.addSystem(system);
      }
    }

    for (const [entityId, components] of Object.entries(blueprint.entities)) {
      this.world.createEntity(entityId);
      for (const [type, data] of Object.entries(components)) {
        this.world.addComponent(entityId, { ...data, type } as Component);
      }
    }
  }

  attachRenderer(renderer: RendererBackend, container: HTMLElement): void {
    this.renderer = renderer;
    renderer.init(container);
    renderer.sync(this.world);
  }

  start(): void {
    if (this.rafId !== null) return;

    const loop = () => {
      this.world.tick();
      this.renderer?.sync(this.world);
      this.notifyListeners();
      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
