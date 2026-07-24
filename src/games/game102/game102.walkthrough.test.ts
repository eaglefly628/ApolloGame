// Game 102 · Pixel Pour —— S4 玩法关 walkthrough：点炮台 → 按色喷弹命中 → 同色格消除（「点了有反应」）。
// 断言的是**行为**（点绿炮→绿格减少/清空），非常量——故意不点则零消除（假信心自查）。
import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { applyCommands, QueuedInputSource } from '@net/index.js';
import type { Resource, Transform, GameFlow } from '@engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import { LEVEL_1 } from './levels.js';

function remain(e: Engine, color: string): number {
  return e.world.getComponent<Resource>(`remain-${color}`, 'Resource')?.current ?? NaN;
}
function cellCount(e: Engine): number {
  let n = 0;
  for (const [id] of e.world.query('Tag', 'Transform')) if (id.startsWith('cell-')) n++;
  return n;
}
// 驱动引擎（复刻宿主循环：注入本 tick 输入 → world.tick）。
function driven(): { e: Engine; click: (x: number, y: number) => void; step: (n?: number) => void } {
  const input = new QueuedInputSource('g102');
  const e = new Engine({ input });
  e.load(buildBlueprint());
  let tk = 0;
  const step = (n = 1): void => { for (let i = 0; i < n; i++) { applyCommands(e.world, input.commandsForTick(++tk)); e.world.tick(); } };
  const click = (x: number, y: number): void => input.enqueue({ source: 'g102', x, y, phase: 'down' });
  return { e, click, step };
}
// cannon-<color> 实体的世界坐标（点它开火）。
function cannonPos(e: Engine, color: string): { x: number; y: number } {
  const t = e.world.getComponent<Transform>(`cannon-${color}`, 'Transform')!;
  return { x: t.x, y: t.y };
}

describe('Game 102 · Pixel Pour（S4 玩法关 · 点炮开火消色）', () => {
  it('点绿炮 → 绿色像素块被喷弹逐步消除（核心循环有反应）', () => {
    const { e, click, step } = driven();
    step(2);                                           // 先跑两拍让 group-count 填数、aggro 就绪
    const green0 = remain(e, 'green');
    expect(green0).toBeGreaterThan(0);                 // 前置：确有绿格
    const { x, y } = cannonPos(e, 'green');
    click(x, y);                                       // 点绿炮 → fire_green 信号 → 置 firing_green 旗
    step(80);                                          // 连喷若干拍
    expect(remain(e, 'green')).toBeLessThan(green0);   // 绿格被消除（行为断言·非常量）
  });

  it('不点炮 → 零消除（假信心自查：没有输入就不该有世界改动）', () => {
    const { e, step } = driven();
    step(2);
    const green0 = remain(e, 'green');
    const cells0 = cellCount(e);
    step(80);
    expect(remain(e, 'green')).toBe(green0);
    expect(cellCount(e)).toBe(cells0);
  });

  it('只消同色：点绿炮不减红格（按色索敌·targetMask 隔离）', () => {
    const { e, click, step } = driven();
    step(2);
    const red0 = remain(e, 'red');
    const { x, y } = cannonPos(e, 'green');
    click(x, y);
    step(80);
    expect(remain(e, 'red')).toBe(red0);               // 红格不受绿炮影响
  });

  it('通关：点齐所有颜色炮 → 清空整幅像素画 → flow 到 victory（可完成的游戏）', () => {
    const { e, click, step } = driven();
    step(2);
    for (const name of LEVEL_1.palette) { const t = e.world.getComponent<Transform>(`cannon-${name}`, 'Transform')!; click(t.x, t.y); }
    step(700);                                         // 全色连喷清盘
    expect(remain(e, 'green')).toBe(0);                // 主色清空
    expect(e.world.getComponent<Resource>('cells-total', 'Resource')?.current ?? -1).toBe(0); // 全盘清空
    expect(e.world.getComponent<GameFlow>('flow', 'GameFlow')?.current).toBe('victory');       // 通关
  });

  it('确定性：同操作两次跑出同 hash（lockstep-safe）', () => {
    const a = driven(); a.step(2); const pa = cannonPos(a.e, 'green'); a.click(pa.x, pa.y); a.step(40);
    const b = driven(); b.step(2); const pb = cannonPos(b.e, 'green'); b.click(pb.x, pb.y); b.step(40);
    expect(a.e.hash()).toBe(b.e.hash());
  });
});
