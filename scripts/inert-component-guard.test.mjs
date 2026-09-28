import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  componentsOfEntities, presentComponents, touchedComponents, inertOf, gamesWithBlueprint,
} from './inert-component-core.mjs';   // 纯核（壳是 CLI·见核文件头「为什么拆」）

// 惰性组件守卫：蓝图挂了组件、却没有任何**已装能力**读/写/提供它 → 那段数据什么都不干且零告警。
// 纯函数部分在这里钉（不 import 任何游戏·秒级）；「真扫全库」那条走 CLI 腿。
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const cap = (name, parts) => ({ id: name, components: parts });

describe('presentComponents：entities + prefabs 模板都要数进来', () => {
  it('顶层 entities 的组件名', () => {
    expect([...presentComponents({ entities: { a: { Transform: {}, Sprite: {} } } })].sort())
      .toEqual(['Sprite', 'Transform']);
  });

  it('★ prefab 模板里的组件也算（漏了它=模板里的惰性组件永远查不出来）', () => {
    const bp = { entities: { a: { Transform: {} } }, prefabs: { bullet: { entities: { b: { Velocity: {}, Timer: {} } } } } };
    expect([...presentComponents(bp)].sort()).toEqual(['Timer', 'Transform', 'Velocity']);
  });

  it('空/缺字段不炸', () => {
    expect(componentsOfEntities(undefined).size).toBe(0);
    expect(presentComponents({}).size).toBe(0);
    expect(presentComponents(undefined).size).toBe(0);
  });
});

describe('touchedComponents：provides ∪ reads ∪ writes ∪ consumes 四处都要并', () => {
  it('四处各自都能贡献（少并一处 = 误报一片）', () => {
    const caps = [
      cap('c1', { provides: { Tray: {} } }),
      cap('c2', { reads: ['Transform'] }),
      cap('c3', { writes: ['Velocity'] }),
      cap('c4', { consumes: ['SpawnRequest'] }),
    ];
    expect([...touchedComponents(caps)].sort()).toEqual(['SpawnRequest', 'Transform', 'Tray', 'Velocity']);
  });

  it('无能力 / 能力无 components 字段都不炸', () => {
    expect(touchedComponents([]).size).toBe(0);
    expect(touchedComponents(undefined).size).toBe(0);
    expect(touchedComponents([{ id: 'x' }]).size).toBe(0);
  });
});

describe('inertOf：差集 + 全序 + 豁免', () => {
  it('★ 复现真事故形状：挂了 Tray 但没装 tray 能力 → 报 Tray', () => {
    const bp = {
      capabilities: [cap('t2-clickable', { reads: ['Transform', 'Clickable'] })],
      entities: { tray: { Tray: {} }, btn: { Transform: {}, Clickable: {} } },
    };
    expect(inertOf(bp)).toEqual(['Tray']);
  });

  it('装上对应能力 → 归零（这就是修法①）', () => {
    const bp = {
      capabilities: [cap('t2-clickable', { reads: ['Transform', 'Clickable'] }), cap('t2-tray', { provides: { Tray: {} } })],
      entities: { tray: { Tray: {} }, btn: { Transform: {}, Clickable: {} } },
    };
    expect(inertOf(bp)).toEqual([]);
  });

  it('豁免名单能放行渲染器直消费件（修法②）——但**只对名单里那个**放行', () => {
    const bp = { capabilities: [], entities: { a: { Sprite: {}, Whatever: {} } } };
    expect(inertOf(bp, { Sprite: '渲染器直接画' })).toEqual(['Whatever']);
  });

  it('输出按名升序（全序·不跟对象键序走）', () => {
    const bp = { capabilities: [], entities: { a: { Zed: {}, Alpha: {}, Mid: {} } } };
    expect(inertOf(bp)).toEqual(['Alpha', 'Mid', 'Zed']);
  });
});

describe('CLI（走 vite-node·因要 import .ts 蓝图）', () => {
  const run = (args = [], env = {}) => {
    try {
      return { code: 0, out: execFileSync('npx', ['vite-node', 'scripts/inert-component-guard.mjs', ...args],
        // stdio 三档显式给全：`execFileSync` **默认把子进程 stderr 透传给父进程**（只 stdout 是 pipe）→
        // 失败态判词会漏进门禁日志污染 `grep FAIL`（2026-09-28 实撞·gate 日志里冒出一行
        // `INERT-COMPONENT: FAIL（空转·零覆盖）`，那是本测试故意触发的，不是门禁真红）。
        { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 300_000,
          stdio: ['ignore', 'pipe', 'pipe'] }) };
    } catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') }; }
  };

  it('真扫全库：判 PASS 且**真查到了游戏**（不是空转绿）', () => {
    const r = run();
    expect(r.out).toContain('INERT-COMPONENT: PASS');
    expect(r.code).toBe(0);
    // 至少查到 6 个（当前实况）——写下限而不是等号，新游戏进来不该把这条弄红
    const m = r.out.match(/PASS（(\d+) 个游戏零惰性/);
    expect(Number(m?.[1] ?? 0)).toBeGreaterThanOrEqual(6);
  });

  it('★ 空转不许绿：一个游戏都没查到 → FAIL（守卫最坏的形态不是漏报，是永远绿）', () => {
    const empty = mkdtempSync(join(tmpdir(), 'inert-empty-'));
    const r = run([], { ZEROCRAFT_INERT_ROOT: empty });
    expect(r.out).toContain('INERT-COMPONENT: FAIL');
    expect(r.out).toContain('空转');
    expect(r.code).toBe(1);
  });

  it('跳过的游戏照实打印（覆盖面有洞就说出来·别让"全绿"掩盖"没查"）', () => {
    expect(run().out).toMatch(/跳过 \d+ 个/);
  });

  it('gamesWithBlueprint 升序且非空（守卫的输入面还在）', () => {
    const gs = gamesWithBlueprint(ROOT);
    expect(gs.length).toBeGreaterThan(0);
    expect([...gs].sort()).toEqual(gs);
  });
});
