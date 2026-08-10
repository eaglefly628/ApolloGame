// 运行时组件全集生成器守卫（8/4 大评审根因②）：
// ① 漂移门——在档产物 component-universe.gen.ts 必须与生成器现算逐字节一致；
//    有人加/改名/删组件而没同提交重跑生成命令 → 本测立即红并点名漂移组件。
// ② 确定性——同输入同字节（稳定排序·与遍历序无关），产物才配当「可信全集」。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import {
  scanSkillComponents, computeUniverse, renderUniverseModule, parseUniverseModule,
} from './build-component-map.mjs';
import { diffComponents } from './component-manifest-guard.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = join(ROOT, 'src', 'assembly', 'component-universe.gen.ts');

describe('build-component-map — 在档产物漂移门', () => {
  it('在档全集与现算逐名一致（漂移=加/删组件没重跑生成命令·点名报红）', () => {
    const current = computeUniverse();
    const onDisk = parseUniverseModule(readFileSync(OUT_FILE, 'utf8'));
    const { added, removed } = diffComponents(current, onDisk);
    // 失败信息直接点名；修法 = `node scripts/build-component-map.mjs` 重生成并同提交。
    expect({ added, removed }).toEqual({ added: [], removed: [] });
  });

  it('在档产物与现算渲染逐字节一致（手改生成物/模板漂移也算红）', () => {
    expect(readFileSync(OUT_FILE, 'utf8')).toBe(renderUniverseModule(computeUniverse()));
  });
});

describe('build-component-map — 生成器自证', () => {
  it('确定性：两次现算同结果·渲染同字节（同输入同字节）', () => {
    const a = computeUniverse();
    const b = computeUniverse();
    expect(b).toEqual(a);
    expect(renderUniverseModule(b)).toBe(renderUniverseModule(a));
  });

  it('全集升序去重（对账消费者依赖的形态契约）', () => {
    const u = computeUniverse();
    expect([...u].sort()).toEqual(u);
    expect(new Set(u).size).toBe(u.length);
  });

  it('两个来源都真的被扫到（protocol 核心/渲染组件 + skill 组件·防扫描面静默缩水）', () => {
    const u = new Set(computeUniverse());
    for (const anchor of ['Transform', 'Mesh3D', 'DebugTrace']) expect(u.has(anchor), `protocol 组件 ${anchor} 缺席`).toBe(true);
    for (const anchor of ['DialogueScript', 'DuelIntent']) expect(u.has(anchor), `skill 组件 ${anchor} 缺席`).toBe(true);
    expect(scanSkillComponents().length).toBeGreaterThan(0);
  });

  it('parseUniverseModule 能从渲染产物刮回原名单（--check 差异报告的地基）', () => {
    const names = ['Alpha', 'Beta9'];
    expect(parseUniverseModule(renderUniverseModule(names))).toEqual(names);
  });
});
