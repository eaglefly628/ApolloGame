import { World } from '@engine/core/world.js';
import type { Component, RendererBackend } from '@engine/core/types.js';
import type { WorldBlueprint } from '../assembly/demo.assembly.js';
import { FixedStepClock, applyCommands, hashSnapshot } from '@net/index.js';
import type { InputSource } from '@net/index.js';

export interface EngineOptions {
  // 模拟频率（Hz）。固定步长 → 任何显示器刷新率下"一个 tick"都是同一份模拟时间。
  tickRate?: number;
  // 每 tick 的输入来源（本地键盘 / 网络对端 / 脚本）。缺省则不注入输入。
  input?: InputSource;
}

export class Engine {
  readonly world: World;
  private rafId: number | null = null;
  private listeners: Array<() => void> = [];
  private renderer: RendererBackend | null = null;
  private readonly tickRate: number;
  private readonly input: InputSource | null;

  constructor(options: EngineOptions = {}) {
    this.world = new World();
    this.tickRate = options.tickRate ?? 60;
    this.input = options.input ?? null;
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

    // 固定步长循环：用真实流逝时间累加，跑整数个模拟步；渲染每帧一次。
    const clock = new FixedStepClock(this.tickRate);
    let last = performance.now();

    const loop = (now: number) => {
      const steps = clock.advance(now - last);
      last = now;
      for (let i = 0; i < steps; i++) this.step();
      this.renderer?.sync(this.world);
      this.notifyListeners();
      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  // 一个固定模拟步：先注入"本 tick 的输入命令"，再 world.tick()。
  // 这正是联机要的接缝——把 input 换成网络对端即可，循环本身不变。
  private step(): void {
    if (this.input) {
      const tick = this.world.getVersion() + 1; // 即将运行的 tick 编号
      applyCommands(this.world, this.input.commandsForTick(tick));
    }
    this.world.tick();
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

  // 当前世界状态的确定性指纹（与 lockstep 守卫同一套哈希）。
  hash(): string {
    return hashSnapshot(this.world.snapshot());
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
