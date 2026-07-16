import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { applyCommands, QueuedInputSource } from '@net/index.js';
import { validateLayoutNode } from '@ui/components/index.js';
import type { GameFlow, MatchBoard, Resource, Flag } from '@engine/protocol/components.js';
import { buildLevelBlueprint } from './blueprint.js';
import { LEVELS, type LevelSpec, levelIssues, parseLayout, goalRequirements, finalScore, starsFor, progressStates } from './levels.js';
import { buildSelect, buildTopBar, buildBottomBar, buildResultOverlay, type HudState } from './hud.js';
import { cellCenter, SETTLE_TICKS, SCORE_PER_TILE } from './theme.js';

// ── 测试专用迷你关（全指定摆盘·零初始连线·白盒可控）────────────────────────────
//   摆盘核验：横向最长 run=2（row4 的 0,0）；纵向全交错。交换 22↔23 → row4 前三格成 0,0,0。
const MINI_BOARD = ['01234', '12340', '01234', '12340', '00203'];
function miniSpec(over: Partial<LevelSpec> = {}): LevelSpec {
  return {
    no: 99,
    name: '走查',
    type: 'score',
    cols: 5,
    rows: 5,
    kinds: 5,
    moves: 5,
    goals: [{ kind: 'score', n: 999999 }],
    stars: [100, 200, 300],
    seed: 7,
    layout: { board: MINI_BOARD },
    ...over,
  };
}

// 带输入的引擎：step() 先注入 InputQueue 再 tick（复刻宿主循环·game-q 同款）。
function driven(spec: LevelSpec) {
  const input = new QueuedInputSource('t');
  const e = new Engine({ input });
  e.load(buildLevelBlueprint(spec));
  let tk = 0;
  const step = (n = 1): void => {
    for (let i = 0; i < n; i++) {
      applyCommands(e.world, input.commandsForTick(++tk));
      e.world.tick();
    }
  };
  const clickCell = (i: number): void => {
    const p = cellCenter(spec.cols, i);
    input.enqueue({ source: 't', x: p.x, y: p.y, phase: 'down' });
  };
  const board = (): MatchBoard => e.world.getComponent<MatchBoard>('board', 'MatchBoard')!;
  const res = (id: string): number => {
    for (const [eid] of e.world.query('Resource')) {
      const r = e.world.getComponent<Resource>(eid, 'Resource');
      if (r?.id === id) return r.current;
    }
    return 0;
  };
  const flow = (): string => e.world.getComponent<GameFlow>('flow', 'GameFlow')!.current;
  const untilIdle = (cap = 900): void => {
    for (let i = 0; i < cap && board().phase !== 'idle'; i++) step();
  };
  return { e, step, clickCell, board, res, flow, untilIdle };
}

describe('Game T ·《墨消》（数据驱动三消·骨架关）', () => {
  it('关卡表全过 schema 校验，关型闭集五型齐（占位表·GD 换表后本关仍在）', () => {
    for (const lv of LEVELS) expect(levelIssues(lv)).toEqual([]);
    expect(new Set(LEVELS.map((l) => l.type))).toEqual(new Set(['score', 'collect', 'jelly', 'blocker', 'mixed']));
    // 校验器本身有牙：坏表要报
    expect(levelIssues(miniSpec({ kinds: 9 })).length).toBeGreaterThan(0);
    expect(levelIssues({ ...LEVELS[2], goals: [{ kind: 'blocker' }] }).length).toBeGreaterThan(0);
  });

  it('蓝图=纯数据可序列化：规则零 TS·消费现有能力·关键实体齐全', () => {
    const bp = buildLevelBlueprint(LEVELS[0]);
    expect(bp.capabilities.length).toBe(9);
    expect(() => JSON.stringify(bp.entities)).not.toThrow();
    const ids = Object.keys(bp.entities);
    for (const key of ['board', 'flow', 'can-play', 'score', 'moves', 'cell-0', `cell-${7 * 9 - 1}`]) {
      expect(ids).toContain(key);
    }
    // 墨渍关带静态底衬 + jelly config
    const bp3 = buildLevelBlueprint(LEVELS[2]);
    expect(Object.keys(bp3.entities).some((k) => k.startsWith('wash-'))).toBe(true);
    expect((bp3.entities.board.MatchBoard as { jelly?: number[] }).jelly?.some((v) => v > 0)).toBe(true);
  });

  it('字符画装配映射：S=砚石(-1)·数字=瓷 hp·墨渍层数（纯转换）', () => {
    const L = parseLayout(LEVELS[3]);
    expect(L.blockers?.[7 * 7 + 0]).toBe(-1); // 第 8 行 'S.....S'
    expect(L.blockers?.[3 * 7 + 1]).toBe(2); // '.2...2.'
    const J = parseLayout(LEVELS[2]);
    expect(J.jelly?.[4 * 7 + 3]).toBe(2); // '..121..' 中心
    // 目标推导与摆盘一致：洗墨需求 = 总层数
    const need = goalRequirements(LEVELS[2])[0];
    expect(need).toEqual({ rid: 'washed', need: 10, label: '洗墨' });
  });

  it('确定性：同关同 seed 双引擎空跑同 hash（可回放/lockstep）', () => {
    const a = new Engine();
    a.load(buildLevelBlueprint(LEVELS[2]));
    const b = new Engine();
    b.load(buildLevelBlueprint(LEVELS[2]));
    for (let i = 0; i < 400; i++) {
      a.world.tick();
      b.world.tick();
    }
    expect(a.hash()).toBe(b.hash());
  });

  it('走查·点选交换消除：两点相邻 → 三连清除 → 产料/记分/扣步 → 回稳', () => {
    const g = driven(miniSpec());
    g.untilIdle(); // 全指定摆盘无空位：初始即稳
    expect(g.board().phase).toBe('idle');
    expect(g.res('moves')).toBe(5);
    g.clickCell(22);
    g.step();
    expect(g.board().selIndex).toBe(22);
    g.clickCell(23);
    g.step();
    g.untilIdle();
    g.step(3); // 资源结算一拍延迟
    expect(g.res('ink0')).toBeGreaterThanOrEqual(3); // 三枚墨玉入账（连锁只多不少）
    expect(g.res('score')).toBeGreaterThanOrEqual(3 * SCORE_PER_TILE);
    expect(g.res('moves')).toBe(4); // 合法步扣 1·连锁不扣
    expect(g.board().selIndex).toBe(-1);
  });

  it('走查·非法步弹回：无连线交换 → 盘面复原 · 不扣步', () => {
    const g = driven(miniSpec());
    g.untilIdle();
    g.clickCell(0);
    g.step();
    g.clickCell(1);
    g.step();
    g.untilIdle();
    g.step(3);
    expect(g.board().cells[0]).toBe(0);
    expect(g.board().cells[1]).toBe(1);
    expect(g.res('moves')).toBe(5);
    expect(g.res('score')).toBe(0);
  });

  it('胜利链：目标达成 → flow=victory → 输入闸落（can-play=false·点击不再选中）', () => {
    const g = driven(miniSpec({ goals: [{ kind: 'collect', color: 0, n: 3 }] }));
    g.untilIdle();
    g.clickCell(22);
    g.step();
    g.clickCell(23);
    g.step();
    let guard = 0;
    while (g.flow() !== 'victory' && guard++ < 900) g.step();
    expect(g.flow()).toBe('victory');
    g.step(2); // onEnter 动作次拍生效
    expect(g.e.world.getComponent<Flag>('can-play', 'Flag')!.active).toBe(false);
    g.clickCell(7);
    g.step(3);
    expect(g.board().selIndex).toBe(-1); // 闸已落：点击不产选中
  });

  it('失败链：moves 尽且未达标 → lastcall 结算窗 → 窗过判负', () => {
    const g = driven(miniSpec({ moves: 1 }));
    g.untilIdle();
    g.clickCell(22);
    g.step();
    g.clickCell(23);
    g.step();
    let guard = 0;
    while (g.flow() !== 'lastcall' && guard++ < 900) g.step();
    expect(g.flow()).toBe('lastcall'); // 末步先进结算窗（连锁可补目标）
    let guard2 = 0;
    while (g.flow() !== 'defeat' && guard2++ < SETTLE_TICKS + 300) g.step();
    expect(g.flow()).toBe('defeat');
  });

  it('结算纯函数：收笔与星级（1 星保底·GDD §四）', () => {
    expect(finalScore(5000, 3)).toBe(8000);
    const spec = miniSpec({ stars: [1000, 2000, 3000] });
    expect(starsFor(500, spec)).toBe(1); // 胜利保底 1 星
    expect(starsFor(2200, spec)).toBe(2);
    expect(starsFor(9999, spec)).toBe(3);
  });

  it('选关进度推导：首个未过关=current·其余锁定·过关带星', () => {
    const p0 = progressStates(LEVELS, {});
    expect(p0[0].state).toBe('current');
    expect(p0[1].state).toBe('locked');
    const p1 = progressStates(LEVELS, { 1: 2 });
    expect(p1[0]).toMatchObject({ state: 'done', stars: 2 });
    expect(p1[1].state).toBe('current');
    expect(p1[2].state).toBe('locked');
  });

  it('HUD 是合法 LayoutNode（validate 零 issue·多态覆盖）', () => {
    const base: HudState = {
      levelNo: 1,
      levelName: '初磨',
      moves: 20,
      score: 1200,
      goals: [
        { label: '得分', cur: 1200, need: 3600 },
        { label: '洗墨', cur: 3, need: 10 },
      ],
      status: 'playing',
      stars: 0,
      brush: 0,
      finalScore: 1200,
      selIndex: -1,
      cols: 7,
      muted: false,
      hasNext: true,
    };
    const states: HudState[] = [
      base,
      { ...base, selIndex: 10, moves: 4, muted: true },
      { ...base, status: 'settling', moves: 0 },
      { ...base, status: 'win', stars: 3, brush: 5000, finalScore: 9800 },
      { ...base, status: 'win', stars: 1, hasNext: false },
      { ...base, status: 'lose', moves: 0 },
    ];
    for (const s of states) {
      expect(validateLayoutNode(buildTopBar(s))).toEqual([]);
      expect(validateLayoutNode(buildBottomBar(s))).toEqual([]);
      if (s.status === 'win' || s.status === 'lose') expect(validateLayoutNode(buildResultOverlay(s))).toEqual([]);
    }
    for (const sel of [
      { nodes: progressStates(LEVELS, {}).map((n) => ({ no: n.no, name: n.name, stars: n.stars, state: n.state })), muted: false },
      { nodes: progressStates(LEVELS, { 1: 3, 2: 1 }).map((n) => ({ no: n.no, name: n.name, stars: n.stars, state: n.state })), muted: true },
    ]) {
      expect(validateLayoutNode(buildSelect(sel))).toEqual([]);
    }
  });
});
