// NON_DETERMINISTIC ⊆ 组件全集 对账（8/4 大评审根因②的第一个消费者）。
// 名单靠手维护，拼错/幽灵名即静默失效：多算→误报 desync，少算→纯表现组件混进 hash 假绿。
// 8/4 评审断言此测试「写不了」——因运行时无组件全集基准；现在基准 = component-universe.gen.ts
// （`node scripts/build-component-map.mjs` 生成·漂移守卫见 scripts/build-component-map.test.mjs）。
import { describe, it, expect } from 'vitest';
import { NON_DETERMINISTIC, hashSnapshot } from '@net/determinism.js';
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

// ── 键位转义（canonical 防伪造·2026-08-22 测试大扫除实证修复的回归钉）──────────────
// 修复前实证：下面「id 内嵌分隔符」的两个不同快照 canonical 逐字节相同（hash 双双 82653c9e）——
// desync 假绿 + 存档篡改假绿的碰撞面。修法=键含该层结构字符才 JSON.stringify（干净键原样）。
describe('determinism — 键位转义（不同状态 hash 必不同·干净键兼容不变）', () => {
  it('实体 id 内嵌分隔符 → 不再与其伪装的多实体快照碰撞（修复前双双 82653c9e）', () => {
    const A = { x: { Tag: { a: '1', type: 'Tag' } }, y: { Tag: { a: '2', type: 'Tag' } } };
    const B = { ['x|Tag|a="1",type="Tag";y']: { Tag: { a: '2', type: 'Tag' } } };
    expect(hashSnapshot(A as never)).not.toBe(hashSnapshot(B as never));
  });

  it('嵌套键内嵌 ":"/"," → 不再与其伪装的多键对象碰撞', () => {
    const A = { e: { T: { type: 'T', o: { 'b:1,c': 2 } } } };
    const B = { e: { T: { type: 'T', o: { b: 1, c: 2 } } } };
    expect(hashSnapshot(A as never)).not.toBe(hashSnapshot(B as never));
  });

  it('干净键 canonical 逐字节不变：golden 锚 = 修复前实测值（prefab id 的 #/: 不受扰·旧档兼容承重线）', () => {
    const snap = {
      'tmpl#0:blade': { Transform: { type: 'Transform', x: 1.5, y: -2 }, Tag: { type: 'Tag', flags: 6 } },
      hero: { Resource: { type: 'Resource', id: 'hp', current: 90, max: 100 },
              Steering: { type: 'Steering', mode: 'seek', separation: { radius: 28, weight: 1.5 } } },
      lib: { PrefabLibrary: { type: 'PrefabLibrary', seq: 3, templates: { a: { entities: { b: { Tag: { flags: 1 } } } } } } },
      z9: { StringVar: { type: 'StringVar', id: 'phase', value: 'settle;x|y' }, Flag: { type: 'Flag', id: 'on', active: true } },
    };
    expect(hashSnapshot(snap as never)).toBe('e5341c34');
  });

  it('该变必变：整个组件被移除 → hash 必变（字段级敏感已有测·补组件级方向）', () => {
    const full = { e: { A: { type: 'A', v: 1 }, B: { type: 'B', w: 2 } } };
    const less = { e: { A: { type: 'A', v: 1 } } };
    expect(hashSnapshot(full as never)).not.toBe(hashSnapshot(less as never));
  });

  it('不该变必不变：嵌套对象键插入序不同 → hash 相同（stableValue 排序承重）', () => {
    const ab = { e: { T: { type: 'T', o: { a: 1, b: 2 } } } };
    const o2: Record<string, number> = {};
    o2.b = 2; o2.a = 1;
    const ba = { e: { T: { type: 'T', o: o2 } } };
    expect(hashSnapshot(ab as never)).toBe(hashSnapshot(ba as never));
  });
});
