// Game 102 · Pixel Pour —— S4 walkthrough：**照 GD 验收剧本的确切数字**自验（不是自己发明的数）。
// 机制（gdd §1/§2·剧本 01/02/04）：点补给色→生成上带色炮(ammo)→逐发单子弹打同色→弹尽入槽→点槽复用。
import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { applyCommands, QueuedInputSource } from '@net/index.js';
import type { Resource, Transform, GameFlow, Tag, Flag } from '@engine/protocol/components.js';
import { buildBlueprint } from './blueprint.js';
import type { Level } from './levels.js';
import { TRAY_BIT } from './theme.js';

const base = { conveyorCap: 5, burstCap: 10, slots: 5, beltSpeed: 95, stars: [0, 0, 0] as [number, number, number] };
// 剧本 01：5×1 · blue×3 + red×1 · ammo5 · 目标清空。
const S01: Level = { no: 101, name: 's01', cols: 5, rows: 1, palette: ['blue', 'red'], ammo: 5, ...base, limit: { kind: 'moves', n: 3 }, goals: [{ kind: 'clear' }], seed: 20101, bitmap: ['000.1'] };
// 剧本 02：6×1 · blue×6 · ammo3 · 弹尽入槽 + 点槽复用。
const S02: Level = { no: 102, name: 's02', cols: 6, rows: 1, palette: ['blue'], ammo: 3, ...base, limit: { kind: 'moves', n: 5 }, goals: [{ kind: 'clear' }], seed: 20102, bitmap: ['000000'] };
// 剧本 05：3×1 · blue×3 · ammo1 · moves1 → 只能消 1 · 剩 2 → 判负。
const S05: Level = { no: 105, name: 's05', cols: 3, rows: 1, palette: ['blue'], ammo: 1, ...base, limit: { kind: 'moves', n: 1 }, goals: [{ kind: 'clear' }], seed: 20105, bitmap: ['000'] };
// 剧本 03：4×1 · blue 于 col0/col2 皆钥匙 · needKeys2 → 收集 2 钥匙 → 开门 → 过关。
const S03: Level = { no: 103, name: 's03', cols: 4, rows: 1, palette: ['blue'], ammo: 5, ...base, limit: { kind: 'moves', n: 3 }, goals: [{ kind: 'clear' }, { kind: 'keys', n: 2 }, { kind: 'door', needKeys: 2, target: 100 }], seed: 20103, bitmap: ['0.0.'], keys: [[0, 0], [2, 0]] };
// 剧本 04：12×1 · blue×12 · ammo1 · 快连 6 门 → conveyor.count=6（突破 5→10）。
const S04: Level = { no: 104, name: 's04', cols: 12, rows: 1, palette: ['blue'], ammo: 1, ...base, limit: { kind: 'moves', n: 12 }, goals: [{ kind: 'clear' }], seed: 20104, bitmap: ['000000000000'] };

function driven(level: Level) {
  const input = new QueuedInputSource('g102');
  const e = new Engine({ input });
  e.load(buildBlueprint(level));
  let tk = 0;
  const step = (n = 1): void => { for (let i = 0; i < n; i++) { applyCommands(e.world, input.commandsForTick(++tk)); e.world.tick(); } };
  const clickAt = (x: number, y: number): void => input.enqueue({ source: 'g102', x, y, phase: 'down' });
  const res = (entityId: string): number => e.world.getComponent<Resource>(entityId, 'Resource')?.current ?? NaN;
  const flow = (): string => e.world.getComponent<GameFlow>('flow', 'GameFlow')?.current ?? '?';
  const tapSupply = (color: string): void => { const t = e.world.getComponent<Transform>(`supply-${color}`, 'Transform')!; clickAt(t.x, t.y); };
  const tapSlot = (): void => {              // 点第一门待命槽炮（Tag 含 TRAY_BIT）
    for (const [id] of e.world.query('Tag', 'Transform')) {
      const tg = e.world.getComponent<Tag>(id, 'Tag'); if (tg && (tg.flags & TRAY_BIT) !== 0) { const t = e.world.getComponent<Transform>(id, 'Transform')!; clickAt(t.x, t.y); return; }
    }
  };
  return { e, step, res, flow, tapSupply, tapSlot };
}

describe('Game 102 · Pixel Pour（S4 · 照验收剧本自验）', () => {
  it('剧本01 基础消色：点 blue 炮 → 连喷清 3 蓝格 → remain.blue=0 / red=1 / total=1 / playing', () => {
    const g = driven(S01);
    g.step(2);
    g.tapSupply('blue');
    g.step(60);
    expect(g.res('remain-blue')).toBe(0);
    expect(g.res('remain-red')).toBe(1);
    expect(g.res('remain-total')).toBe(1);
    expect(g.res('score')).toBeGreaterThan(0);   // 消除计分（scoreblip·剧本01 score>0）
    expect(g.flow()).toBe('playing');
  });

  it('剧本02 弹尽入槽：ammo3 只清 3 蓝 → remain.blue=3 / conveyor=0 / tray=1', () => {
    const g = driven(S02);
    g.step(2);
    g.tapSupply('blue');
    g.step(60);
    expect(g.res('remain-blue')).toBe(3);
    expect(g.res('conveyor-count')).toBe(0);
    expect(g.res('tray-count')).toBe(1);
    expect(g.flow()).toBe('playing');
  });

  it('剧本02 点槽复用：tapSlot → 重装满补火 → remain.blue=0 → victory', () => {
    const g = driven(S02);
    g.step(2);
    g.tapSupply('blue');
    g.step(60);
    expect(g.res('remain-blue')).toBe(3);   // 前置：第一门打光
    g.tapSlot();
    g.step(60);
    expect(g.res('remain-blue')).toBe(0);
    expect(g.res('remain-total')).toBe(0);
    expect(g.flow()).toBe('victory');
  });

  it('不点炮 → 零消除（假信心自查：没输入就不该有世界改动）', () => {
    const g = driven(S01);
    g.step(2);
    const b0 = g.res('remain-blue');
    g.step(60);
    expect(g.res('remain-blue')).toBe(b0);
    expect(g.flow()).toBe('playing');
  });

  it('剧本05 限额判负：ammo1/moves1 只清 1 → remain.blue=2 → defeat', () => {
    const g = driven(S05);
    g.step(2);
    g.tapSupply('blue');
    g.step(60);
    expect(g.res('remain-blue')).toBe(2);
    expect(g.flow()).toBe('defeat');
  });

  it('剧本03 钥匙开门：清 2 钥匙格 → keys=2 → doorOpen → victory', () => {
    const g = driven(S03);
    g.step(2);
    g.tapSupply('blue');
    g.step(60);
    expect(g.res('remain-blue')).toBe(0);
    expect(g.res('keys')).toBe(2);
    expect(g.e.world.getComponent<Flag>('doorflag', 'Flag')?.active).toBe(true);
    expect(g.flow()).toBe('victory');
  });

  // 剧本04 突破容量 = pending（撞墙报缺口·requests.md REQ-G102-BURST）：同拍 6 tapSupply 只生成 1 门炮
  // （Caster 每拍一发·N 信号→1 生成），"快连堆炮/突破 5→10" 需 conveyor-queue 下沉·裁前不游戏层自写。
  it.skip('剧本04 突破容量：快连 6 门 → conveyor.count=6（pending·待 conveyor-queue 下沉）', () => {
    const g = driven(S04);
    g.step(2);
    for (let i = 0; i < 6; i++) g.tapSupply('blue');
    g.step(1);
    expect(g.res('conveyor-count')).toBe(6);
  });

  it('确定性：同操作两次同 hash（lockstep-safe）', () => {
    const a = driven(S02); a.step(2); a.tapSupply('blue'); a.step(30);
    const b = driven(S02); b.step(2); b.tapSupply('blue'); b.step(30);
    expect(a.e.hash()).toBe(b.e.hash());
  });
});
