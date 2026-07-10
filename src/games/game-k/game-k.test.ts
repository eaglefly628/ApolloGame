import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { applyCommands, QueuedInputSource } from '@net/index.js';
import { validateLayoutNode } from '@ui/components/index.js';
import { evaluateSlot } from '@skills/tier3/index.js';
import type { Resource, RolledDice, LineWins } from '@engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import { buildTopBar, buildBottomBar, buildOverlay, type HudState } from './hud.js';
import { SYM, PAYTABLE, SCATTER_PAY, PAYLINES, REELS, ROWS, START_BALANCE, DEFAULT_BET, BET_STEP, BET_MAX } from './theme.js';

function res(e: Engine, id: string): Resource | undefined {
  for (const [eid] of e.world.query('Resource')) { const r = e.world.getComponent<Resource>(eid, 'Resource'); if (r && r.id === id) return r; }
  return undefined;
}
const cur = (e: Engine, id: string): number => res(e, id)?.current ?? 0;

// 带输入的引擎：step() 先注入 InputQueue 再 tick（复刻宿主循环）。
function driven(): { e: Engine; act: (k: string) => void; step: () => void } {
  const input = new QueuedInputSource('k');
  const e = new Engine({ input });
  e.load(buildBlueprint());
  let tk = 0;
  return { e, act: (k) => input.enqueueAction(k), step: () => { applyCommands(e.world, input.commandsForTick(++tk)); e.world.tick(); } };
}

describe('Game K · Zombie Slots（数据驱动老虎机）', () => {
  it('蓝图是纯数据：消费现有能力 + 关键单例齐全（零专属系统）', () => {
    const bp = buildBlueprint();
    expect(bp.capabilities.length).toBe(5);
    const ids = Object.keys(bp.entities);
    for (const key of ['rng', 'reels', 'balance', 'bet', 'win', 'freespins', 'machine', 'kb-spin']) expect(ids).toContain(key);
    expect(() => JSON.stringify(bp.entities)).not.toThrow();
  });

  it('起始经济符合配置', () => {
    const e = new Engine(); e.load(buildBlueprint());
    expect(cur(e, 'balance')).toBe(START_BALANCE);
    expect(cur(e, 'bet')).toBe(DEFAULT_BET);
    expect(cur(e, 'freespins')).toBe(0);
  });

  it('SPIN：掷出 5×3 网格 + 扣注 + 写 LineWins（判线赔付接线）', () => {
    const g = driven();
    const bal0 = cur(g.e, 'balance'), bet = cur(g.e, 'bet');
    g.act('spin'); g.step();
    const rolled = g.e.world.getComponent<RolledDice>('reels', 'RolledDice');
    expect(rolled?.results.length).toBe(REELS * ROWS);
    const lw = g.e.world.getComponent<LineWins>('machine', 'LineWins');
    expect(lw?.spin).toBe(1);
    // 余额 = 期初 − 注 + 本旋赢（LineWins.total）
    expect(cur(g.e, 'balance')).toBe(bal0 - bet + (lw?.total ?? 0));
    expect(cur(g.e, 'win')).toBe(lw?.total ?? 0);
  });

  it('确定性：两把独立跑同动作序列 → 同 hash（可回放/lockstep）', () => {
    const a = driven(), b = driven();
    for (let i = 0; i < 4; i++) { a.act('spin'); a.step(); b.act('spin'); b.step(); }
    expect(a.e.hash()).toBe(b.e.hash());
  });

  it('下注升降：betup/betdown 钳制在 [min,max]', () => {
    const g = driven();
    g.act('betup'); g.step();
    expect(cur(g.e, 'bet')).toBe(DEFAULT_BET + BET_STEP);
    for (let i = 0; i < 40; i++) { g.act('betup'); g.step(); }
    expect(cur(g.e, 'bet')).toBe(BET_MAX);           // 上限钳制
    for (let i = 0; i < 40; i++) { g.act('betdown'); g.step(); }
    expect(cur(g.e, 'bet')).toBe(20); // 下限（BET_MIN）钳制
  });

  it('免费旋转经济：freespins>0 时本旋不扣注、线赢×倍率', () => {
    const g = driven();
    // 白盒：直接给 5 次免费旋转
    res(g.e, 'freespins')!.current = 5;
    const bal0 = cur(g.e, 'balance');
    g.act('spin'); g.step();
    const lw = g.e.world.getComponent<LineWins>('machine', 'LineWins');
    expect(cur(g.e, 'freespins')).toBe(4);                 // 免费旋转 −1
    expect(cur(g.e, 'balance')).toBe(bal0 + (lw?.total ?? 0)); // 不扣注·只加赢
  });

  // ── evaluateSlot 纯函数（判线核）──
  const P = PAYTABLE as unknown as Record<number, Record<number, number>>;
  const S = SCATTER_PAY as unknown as Record<number, number>;
  function gridFrom(cols: number[][]): number[][] { return cols; }

  it('evaluateSlot：中路 3 连赔付（DOG×3）', () => {
    const F = SYM.T;
    const grid = gridFrom([
      [F, SYM.DOG, F], [F, SYM.DOG, F], [F, SYM.DOG, F], [F, SYM.A, F], [F, SYM.J, F],
    ]);
    const r = evaluateSlot(grid, PAYLINES, P, SYM.WILD, SYM.SCAT, 3, S, 1, 20);
    expect(r.lineWins.some((w) => w.symbol === SYM.DOG && w.count === 3)).toBe(true);
  });

  it('evaluateSlot：百搭代入（WILD,DOG,DOG → DOG×3）', () => {
    const F = SYM.T;
    const grid = gridFrom([
      [F, SYM.WILD, F], [F, SYM.DOG, F], [F, SYM.DOG, F], [F, SYM.A, F], [F, SYM.J, F],
    ]);
    const r = evaluateSlot(grid, PAYLINES, P, SYM.WILD, SYM.SCAT, 3, S, 1, 20);
    expect(r.lineWins.some((w) => w.symbol === SYM.DOG && w.count === 3)).toBe(true);
  });

  it('evaluateSlot：分散计数与赔付（3 分散 → ×总注）', () => {
    const F = SYM.T;
    const grid = gridFrom([
      [SYM.SCAT, F, F], [F, F, F], [SYM.SCAT, F, F], [F, F, F], [SYM.SCAT, F, F],
    ]);
    const r = evaluateSlot(grid, PAYLINES, P, SYM.WILD, SYM.SCAT, 3, S, 1, 20);
    expect(r.scatterCount).toBe(3);
    expect(r.scatterWin).toBe(SCATTER_PAY[3] * 20);
  });

  it('HUD 是合法 LayoutNode（validate 零 issue·多态覆盖）', () => {
    const skins = { logo: '/games/game-k/art/gen/art-24.png', panel: '/games/game-k/art/gen/art-23.png', btnSpin: '/x/spin.png', btnPlus: '/x/p.png', btnMinus: '/x/m.png', btnMute: '/x/mute.png', btnInfo: '/x/i.png' };
    const states: HudState[] = [
      { balance: 5000, bet: 20, win: 0, free: 0, spinning: false, muted: false, overlay: null },
      { balance: 3200, bet: 100, win: 450, free: 8, spinning: true, muted: true, overlay: null },
      { balance: 0, bet: 20, win: 0, free: 0, spinning: false, muted: false, overlay: { kind: 'broke', amount: 0, free: 0 } },
      { balance: 9000, bet: 40, win: 4000, free: 0, spinning: false, muted: false, overlay: { kind: 'zombie', amount: 4000, free: 0 } },
      { balance: 5000, bet: 20, win: 40, free: 10, spinning: false, muted: false, overlay: { kind: 'free', amount: 40, free: 10 } },
      // 皮肤槽全就绪：Logo/按钮/面板/横幅走 Image/skin/bgTexture 路径（validate 仍零 issue）
      { balance: 7500, bet: 200, win: 1200, free: 3, spinning: false, muted: false, skins, overlay: { kind: 'mega', amount: 1200, free: 0, banner: '/games/game-k/art/gen/art-13.png' } },
    ];
    for (const s of states) {
      expect(validateLayoutNode(buildTopBar(s))).toEqual([]);
      expect(validateLayoutNode(buildBottomBar(s))).toEqual([]);
      if (s.overlay) expect(validateLayoutNode(buildOverlay(s))).toEqual([]);
    }
  });
});
