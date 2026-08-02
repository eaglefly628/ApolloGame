import { describe, it, expect } from 'vitest';
import { Engine } from '@zerocraft/engine/runtime/engine.js';
import { applyCommands, QueuedInputSource } from '@zerocraft/engine/net/index.js';
import { validateLayoutNode } from '@zerocraft/engine/ui/components/index.js';
import type { Resource, Tag, GameFlow } from '@zerocraft/engine/engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import { buildTopBar, buildBottomBar, buildOverlay, type HudState } from './hud.js';
import { ENEMY, TOWER, TICKET, START_GOLD, TOWERS, PAD_SPOTS, WAVE_SCHEDULE } from './theme.js';

function res(e: Engine, eid: string): number { return e.world.getComponent<Resource>(eid, 'Resource')?.current ?? 0; }
function countTag(e: Engine, bit: number): number {
  let n = 0;
  for (const [id] of e.world.query('Tag')) { const t = e.world.getComponent<Tag>(id, 'Tag'); if (t && (t.flags & bit) !== 0) n++; }
  return n;
}
function tickN(e: Engine, n: number): void { for (let i = 0; i < n; i++) e.world.tick(); }
function flowState(e: Engine): string { return e.world.getComponent<GameFlow>('flow', 'GameFlow')?.current ?? '?'; }

// 带输入的引擎：step() 先注入 InputQueue 再 tick（复刻宿主循环）。
function driven(): { e: Engine; input: QueuedInputSource; step: () => void; buy: (k: string) => void; click: (x: number, y: number) => void } {
  const input = new QueuedInputSource('q');
  const e = new Engine({ input });
  e.load(buildBlueprint());
  let tk = 0;
  const step = (): void => { applyCommands(e.world, input.commandsForTick(++tk)); e.world.tick(); };
  return {
    e, input, step,
    buy: (k) => input.enqueueAction(k),
    click: (x, y) => input.enqueue({ source: 'q', x, y, phase: 'down' }),
  };
}

describe('Game Q · Neon Siege（数据驱动塔防·重制）', () => {
  it('蓝图是纯数据：消费现有能力 + 关键单例齐全（零专属系统）', () => {
    const bp = buildBlueprint();
    expect(bp.capabilities.length).toBeGreaterThan(20);
    const ids = Object.keys(bp.entities);
    for (const key of ['gold', 'base', 'lane', 'library', 'flow', 'ticketcount', 'killzone', 'pad-0-p', 'spawn-0']) {
      expect(ids).toContain(key);
    }
    expect(() => JSON.stringify(bp.entities)).not.toThrow();
  });

  it('波次自动开播：tick 后敌人被生怪票→prefab 生出来', () => {
    const e = new Engine(); e.load(buildBlueprint());
    expect(countTag(e, ENEMY)).toBe(0);
    tickN(e, 170);
    expect(countTag(e, ENEMY)).toBeGreaterThan(0);
  });

  it('确定性：两把独立跑同 tick → 同 hash（可回放/lockstep）', () => {
    const a = new Engine(); a.load(buildBlueprint());
    const b = new Engine(); b.load(buildBlueprint());
    tickN(a, 300); tickN(b, 300);
    expect(a.hash()).toBe(b.hash());
  });

  it('放置只在建造位：买 PULSE → 点非法处不生成 / 点 pad 生成一座塔', () => {
    // 点非建造位（车道上·无 pad）→ 不生成
    const g1 = driven();
    expect(countTag(g1.e, TOWER)).toBe(0);
    const gold0 = res(g1.e, 'gold');
    g1.buy('buy_pulse'); g1.step();
    expect(res(g1.e, 'gold')).toBe(gold0 - TOWERS.pulse.cost);      // 扣金
    g1.click(480, 410); g1.step(); g1.step();
    expect(countTag(g1.e, TOWER)).toBe(0);                          // 非法处不落塔

    // 点建造位 → 生成
    const g2 = driven();
    g2.buy('buy_pulse'); g2.step();
    g2.click(PAD_SPOTS[3].x, PAD_SPOTS[3].y); g2.step(); g2.step();
    expect(countTag(g2.e, TOWER)).toBeGreaterThanOrEqual(1);
  });

  it('占位：pad 落塔后自毁，同处不可重复布', () => {
    const g = driven();
    g.buy('buy_pulse'); g.step();
    g.click(PAD_SPOTS[3].x, PAD_SPOTS[3].y); g.step(); g.step();
    expect(countTag(g.e, TOWER)).toBe(1);
    // pad-3-p 已销毁 → 再买再点同处不生成第二座
    g.buy('buy_pulse'); g.step();
    g.click(PAD_SPOTS[3].x, PAD_SPOTS[3].y); g.step(); g.step();
    expect(countTag(g.e, TOWER)).toBe(1);
  });

  it('塔杀敌：出生口旁 RAIL → 敌被击杀（remaining 降而 lives 满·非漏怪）', () => {
    const g = driven();
    // 作弊金（测试白盒）：够买炮
    g.e.world.getComponent<Resource>('gold', 'Resource')!.current = 9999;
    g.buy('buy_cannon'); g.step();
    g.click(PAD_SPOTS[0].x, PAD_SPOTS[0].y); g.step(); g.step(); // pad-0 覆盖出生口
    expect(countTag(g.e, TOWER)).toBe(1);
    const lives0 = res(g.e, 'base');
    tickN(g.e, 320);
    expect(res(g.e, 'base')).toBe(lives0);                          // 无漏怪
    expect(res(g.e, 'ticketcount') + res(g.e, 'livecount')).toBeLessThan(WAVE_SCHEDULE.length); // 有敌被杀
  });

  it('失败：无塔 → 敌漏满 → GameFlow 进 defeat', () => {
    const e = new Engine(); e.load(buildBlueprint());
    tickN(e, 3200);
    expect(flowState(e)).toBe('defeat');
  });

  it('胜利：无票无敌 → GameFlow 进 victory（win 条件接线）', () => {
    const e = new Engine(); e.load(buildBlueprint());
    // 白盒：销毁全部生怪票（波次放完）→ 无敌生成 → 应判胜
    for (const [id] of [...e.world.query('Tag')]) {
      const t = e.world.getComponent<Tag>(id, 'Tag');
      if (t && (t.flags & TICKET) !== 0) e.world.destroyEntity(id);
    }
    tickN(e, 6);
    expect(res(e, 'ticketcount')).toBe(0);
    expect(res(e, 'livecount')).toBe(0);
    expect(flowState(e)).toBe('victory');
  });

  it('防重复买：pending 时两买钮皆禁（不再重扣金）', () => {
    const pending: HudState = { lives: 20, gold: 999, remaining: 10, pending: 'pulse', status: 'playing', muted: false };
    const bar = buildBottomBar(pending);
    const pulse = bar.children!.find((c) => c.id === 'q-buy-pulse')!;
    const cannon = bar.children!.find((c) => c.id === 'q-buy-cannon')!;
    expect((pulse.props as { disabled?: boolean }).disabled).toBe(true);
    expect((cannon.props as { disabled?: boolean }).disabled).toBe(true);
  });

  it('起始经济/生命符合配置', () => {
    const e = new Engine(); e.load(buildBlueprint());
    expect(res(e, 'gold')).toBe(START_GOLD);
    expect(res(e, 'base')).toBe(20);
  });

  it('HUD 是合法 LayoutNode（validate 零 issue·多态覆盖）', () => {
    const states: HudState[] = [
      { lives: 20, gold: 300, remaining: 24, pending: null, status: 'playing', muted: false },
      { lives: 4, gold: 55, remaining: 9, pending: 'pulse', status: 'playing', muted: true },
      { lives: 0, gold: 999, remaining: 3, pending: 'cannon', status: 'defeat', muted: false },
      { lives: 20, gold: 120, remaining: 0, pending: null, status: 'victory', muted: false },
    ];
    for (const s of states) {
      expect(validateLayoutNode(buildTopBar(s))).toEqual([]);
      expect(validateLayoutNode(buildBottomBar(s))).toEqual([]);
      expect(validateLayoutNode(buildOverlay(s))).toEqual([]);
    }
  });
});
