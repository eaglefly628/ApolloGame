// click-probe 单测（REQ-S3CLICK·owner 2026-08-07 判 A）
//
// 同 render-probe.test.mjs 的既有惯例：**只测纯函数读码**，不起浏览器、不碰真仓库状态。
// 真连通性（起 vite + 真 Chromium + 真点）由跑 `node scripts/click-probe.mjs --game <slug>`
// 手动核证，交付回报里附退出码；硬塞进日常套件会每次 npm test 都重写真游戏的 probe 产物。
//
// 本文件钉死的是**门到底会不会红**——这正是本单最容易做假的地方：
// 施工过程中两版判据都「看起来在检查、实测撤修照绿」（整页快照被倒计时污染 / textContent
// 让噪声顺祖先链爬满全树 / 注释里的 resolveBindings 被当成调用），全靠撤修验红逮出来。
import { describe, it, expect } from 'vitest';
import { interpretClickProbe, checkBindWiring, LEGACY_WAIVED } from './click-probe.mjs';
import { interpretClickGate } from './game-pipeline.mjs';

const base = { slug: 'gx', controls: 3, changed: 2, consoleErrors: [], waived: undefined };

describe('click-probe · 判词（interpretClickProbe）', () => {
  it('点得动 → 过', () => {
    expect(interpretClickProbe(base).exit).toBe(0);
  });

  it('**全点了一遍 DOM 一处没变 → 红**（本门存在的理由：输入接线整条断了）', () => {
    const v = interpretClickProbe({ ...base, changed: 0 });
    expect(v.exit).toBe(1);
    expect(v.summary).toMatch(/一处都没变/);
    expect(v.summary).toMatch(/Engine\.step/); // 判词要能直接指路，不能只说"失败"
  });

  it('一个可驱动控件都没有 → 红（UI 完全不可驱动）', () => {
    expect(interpretClickProbe({ ...base, controls: 0 }).exit).toBe(1);
  });

  it('点击过程报控制台 error → 红', () => {
    const v = interpretClickProbe({ ...base, consoleErrors: ['boom'] });
    expect(v.exit).toBe(1);
    expect(v.summary).toMatch(/boom/);
  });

  it('豁免的存量游戏不判红，但**实测数照实写进判词**（豁免≠不跑≠不留证）', () => {
    const v = interpretClickProbe({ ...base, changed: 0, waived: 'owner 不回溯' });
    expect(v.exit).toBe(0);
    expect(v.waived).toBe(true);
    expect(v.summary).toMatch(/0 个点后 DOM 有变化/);
  });

  it('豁免名单只含存量游戏——**game108 及以后的新游戏必须受检**（owner 2026-08-07 口径）', () => {
    expect(LEGACY_WAIVED.game108).toBeUndefined();
    expect(Object.keys(LEGACY_WAIVED).length).toBeGreaterThan(0);
    for (const reason of Object.values(LEGACY_WAIVED)) expect(reason).toMatch(/不回溯/); // 每条都得写理由
  });
});

describe('click-probe · bind 接线静态检查（checkBindWiring）', () => {
  const f = (path, text) => ({ path, text });

  it('用了 bind 且真调了 resolveBindings → 过', () => {
    expect(checkBindWiring([
      f('a/screen.ts', "props: { bind: 'hp' }"),
      f('a/host.ts', 'const t = resolveBindings(tree, ds);'),
    ]).ok).toBe(true);
  });

  it('**用了 bind 却没人调 resolveBindings → 红**（bind 必然是哑弹）', () => {
    const r = checkBindWiring([f('a/screen.ts', "props: { bind: 'hp' }")]);
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/哑弹/);
    expect(r.detail).toMatch(/resolveBindings\(tree, dataSource\)/); // 判词带修法
  });

  it('**注释里提一句 resolveBindings 不算调用**（实测被这么骗过一次）', () => {
    const r = checkBindWiring([
      f('a/screen.ts', "props: { bind: 'hp' }"),
      f('a/host.ts', '// 记得跑 resolveBindings(tree, ds)\n/* 或者 resolveBindings(x) */\nconst t = tree;'),
    ]);
    expect(r.ok).toBe(false);
  });

  it('压根没用 bind 的游戏 → 过（不强推 bind）', () => {
    expect(checkBindWiring([f('a/screen.ts', "props: { text: 'hi' }")]).ok).toBe(true);
  });
});

describe('S3 门读码（interpretClickGate）', () => {
  it('点击门过 → 门过，摘要接在渲染摘要后面', () => {
    const v = interpretClickGate('渲染过', 0, '[click-probe] gx ✓ 点击打穿（3 个控件）');
    expect(v.exit).toBe(0);
    expect(v.summary).toMatch(/渲染过/);
    expect(v.summary).toMatch(/点击打穿/);
    expect(v.summary).not.toMatch(/\[click-probe\]/); // 前缀已剥掉，判词干净
    expect(v.summary.match(/点击打穿/g)).toHaveLength(1); // **不许套娃**（实测出过「✓点击打穿（✓点击打穿（…」）
  });

  it('点击门红 → **门红**（不许被渲染门的绿盖过去）', () => {
    const v = interpretClickGate('渲染过', 1, '一处都没变');
    expect(v.exit).toBe(1);
    expect(v.summary).toMatch(/一处都没变/);
  });

  it('环境无浏览器（3）→ 不算红（同 R1/R3 语义）', () => {
    expect(interpretClickGate('渲染过', 3, '').exit).toBe(0);
  });
});
