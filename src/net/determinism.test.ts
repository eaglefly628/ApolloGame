// NON_DETERMINISTIC ⊆ 组件全集 对账（8/4 大评审根因②的第一个消费者）。
// 名单靠手维护，拼错/幽灵名即静默失效：多算→误报 desync，少算→纯表现组件混进 hash 假绿。
// 8/4 评审断言此测试「写不了」——因运行时无组件全集基准；现在基准 = component-universe.gen.ts
// （`node scripts/build-component-map.mjs` 生成·漂移守卫见 scripts/build-component-map.test.mjs）。
import { describe, it, expect } from 'vitest';
import { NON_DETERMINISTIC } from '@net/determinism.js';
import { COMPONENT_UNIVERSE_SET } from '@assembly/component-universe.gen.js';

describe('determinism — NON_DETERMINISTIC ⊆ 组件全集对账', () => {
  it('名单每一项都是真实组件名（不在全集=拼错/幽灵/改名遗留·点名报红）', () => {
    const ghosts = [...NON_DETERMINISTIC].filter((name) => !COMPONENT_UNIVERSE_SET.has(name));
    // 失败信息点名坏名字；修法 = 改回真实组件名，或（新组件）重跑生成命令刷新全集。
    expect(ghosts, `NON_DETERMINISTIC 含全集之外的名字：${ghosts.join(', ')}`).toEqual([]);
  });

  it('名单非空且含奠基项 Camera（防「名单被整体清空」这类假绿）', () => {
    expect(NON_DETERMINISTIC.size).toBeGreaterThan(0);
    expect(NON_DETERMINISTIC.has('Camera')).toBe(true);
  });
});
