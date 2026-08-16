// @vitest-environment happy-dom
// REQ-UIFX（owner 2026-08-08·game108 v3 定稿带出）：2D 表现件补齐——
//   A · Particles 扩写对位 Vfx3D：color/colorGradient/size 分档/shape:'cone'+coneAngle/speed/gravity/drag/
//       飞向 LayoutNode(flyTo=AnchorRef)/拖尾 trail(对位 Trail3D)。物理弹道=server.ts rAF 胶水（render-only）。
//   B · ProgressBar shape:'liquid'（同族扩写）：radius/fillColor/wave/bubbles·游戏只给标量 value。
//   ⑤ 同族小项：Label.tween.scale（伤害跳数字号 .82→1）· anim:'tick'（steps(1,end) 节拍）。
// 红线：render-only 不进 sim/hash；默认不填 = 全库老屏零变化（本文件有零回归断言）。
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderNode, validateLayoutNode, mountUI, particleSimSpec, particleSize } from './index.js';
import type { LayoutNode } from './index.js';

afterEach(() => { vi.useRealTimers(); });

describe('REQ-UIFX A · Particles 对位 Vfx3D 扩写', () => {
  it('零回归：新轴全不填 → 四预设仍走 CSS 动画路·无物理容器标记·确定式可回归', () => {
    for (const kind of ['confetti', 'coins', 'stars', 'sparkle'] as const) {
      const html = renderNode({ type: 'Particles', id: `p-${kind}`, props: { kind }, layout: { width: 200, height: 120 } });
      expect(html).not.toContain('data-particle-sim');
      expect(html).not.toContain('data-pp');
      const again = renderNode({ type: 'Particles', id: `p-${kind}`, props: { kind }, layout: { width: 200, height: 120 } });
      expect(again).toBe(html); // 确定式（同输入同字节）
    }
    // 原动画名原样在（CSS 路未动）
    expect(renderNode({ type: 'Particles', id: 'p', props: { kind: 'confetti' } })).toContain('apollo-p-fall');
    expect(renderNode({ type: 'Particles', id: 'p', props: { kind: 'stars' } })).toContain('apollo-p-burst');
    expect(renderNode({ type: 'Particles', id: 'p', props: { kind: 'sparkle' } })).toContain('apollo-p-twinkle');
  });

  it('color / colorGradient / size 分档：四预设 kind 也吃（换牌色·径向渐变·六档 12–30）', () => {
    // 单色：confetti 逐片换成牌色（不再走内置色板）
    const solid = renderNode({ type: 'Particles', id: 'c', props: { kind: 'confetti', count: 6, color: '#ff5d7d' } });
    expect(solid).toContain('background:#ff5d7d');
    expect(solid).not.toContain('#e94f5a'); // 色板首色不再出现
    // 径向渐变（定稿「芯白→牌色→牌色75%」）：stops 进 radial-gradient·alpha 追加 hex 字节
    const grad = renderNode({ type: 'Particles', id: 'g', props: { kind: 'coins', count: 4,
      colorGradient: [{ t: 0, color: '#ffffff' }, { t: 0.45, color: '#e94f5a' }, { t: 1, color: '#e94f5a', alpha: 0.75 }] } });
    expect(grad).toContain('radial-gradient(circle at 32% 30%,#ffffff 0%,#e94f5a 45%,#e94f5abf 100%)');
    // 尺寸分档：数组按 index 取档（定稿六档 12–30）
    const sized = renderNode({ type: 'Particles', id: 's', props: { kind: 'coins', count: 7, size: [12, 16, 20, 22, 26, 30] } });
    for (const px of [12, 16, 20, 22, 26, 30]) expect(sized).toContain(`width:${px}px`);
    expect(particleSize(0, [12, 16, 20, 22, 26, 30])).toBe(12);
    expect(particleSize(6, [12, 16, 20, 22, 26, 30])).toBe(12); // 第 7 颗回到首档
    expect(particleSize(3)).toBe(6 + 3 * 2); // 缺省=原 index 派生（零回归）
    // 注入净化：色串里逃逸字符被剥（style 声明打不穿）
    const inj = renderNode({ type: 'Particles', id: 'x', props: { kind: 'sparkle', count: 2, color: 'red;position:fixed' } });
    expect(inj).not.toContain('position:fixed');
  });

  it('物理弹道模式：shape:"cone" → data-particle-sim 容器 + data-pp 粒子体 + 对位轴 data-ps-*', () => {
    const html = renderNode({ type: 'Particles', id: 'fly', props: {
      kind: 'coins', count: 14, shape: 'cone', coneAngle: 0.5, speed: 520, gravity: 900, lifetime: 2, stagger: 36,
    }, layout: { width: 160, height: 120 } });
    expect(html).toContain('data-particle-sim="coins"');
    expect(html).toContain('data-ps-shape="cone"');
    expect(html).toContain('data-ps-cone="0.5"');
    expect(html).toContain('data-ps-speed="520"');
    expect(html).toContain('data-ps-grav="900"');
    expect(html).toContain('data-ps-life="2"');
    expect(html).toContain('data-ps-stagger="36"');
    expect((html.match(/data-pp="/g) ?? []).length).toBe(14);
    expect(html).toContain('overflow:visible'); // 飞出容器盒（区别缺省雨/爆 hidden）
    expect(html).not.toContain('apollo-p-fall'); // 物理模式不走 CSS 关键帧路
    // 确定式：两次渲染逐字节一致
    expect(renderNode({ type: 'Particles', id: 'fly', props: { kind: 'coins', count: 14, shape: 'cone', coneAngle: 0.5, speed: 520, gravity: 900, lifetime: 2, stagger: 36 }, layout: { width: 160, height: 120 } }))
      .toBe(renderNode({ type: 'Particles', id: 'fly', props: { kind: 'coins', count: 14, shape: 'cone', coneAngle: 0.5, speed: 520, gravity: 900, lifetime: 2, stagger: 36 }, layout: { width: 160, height: 120 } }));
  });

  it('flyTo=AnchorRef（复用 Float/Connector 同套寻址·非第三套）→ data-ps-fly-* + 缺省轻阻尼', () => {
    const html = renderNode({ type: 'Particles', id: 'f', props: {
      kind: 'stars', count: 5, flyTo: { kind: 'node', id: 'wallet', at: 'top', offset: { y: -6 } },
    } });
    expect(html).toContain('data-particle-sim'); // flyTo 单独在场即入物理模式
    expect(html).toContain('data-ps-fly-kind="node"');
    expect(html).toContain('data-ps-fly-id="wallet"');
    expect(html).toContain('data-ps-fly-at="top"');
    expect(html).toContain('data-ps-fly-oy="-6"');
    expect(html).toContain('data-ps-drag="1.2"'); // flyTo 缺省带轻阻尼（阻尼弹簧=缓入缓出）
  });

  it('拖尾 trail（对位 Trail3D 轴 segments/width/fade/blend）→ 每颗粒子 segments 个 data-pt 垫底点', () => {
    const html = renderNode({ type: 'Particles', id: 't', props: {
      kind: 'coins', count: 3, shape: 'cone', trail: { segments: 6, width: 10, fade: 0.2, blend: 'add' },
    } });
    expect((html.match(/data-pt="/g) ?? []).length).toBe(3 * 6);
    expect(html).toContain('data-ps-trail-seg="6"');
    expect(html).toContain('data-ps-trail-fade="0.2"');
    expect(html).toContain('width:10px'); // 头宽
    expect(html).toContain('mix-blend-mode:screen'); // blend:'add'=发光
    // segments 上限 16（DOM 预算）
    const capped = renderNode({ type: 'Particles', id: 'c', props: { kind: 'coins', count: 2, trail: { segments: 99 } } });
    expect((capped.match(/data-pt="/g) ?? []).length).toBe(2 * 16);
  });

  it('particleSimSpec 确定式弹道参数（纯函数·server 胶水与测试单一真相）', () => {
    // cone：角度在 -π/2 ± coneAngle 内
    for (let i = 0; i < 20; i++) {
      const s = particleSimSpec(i, { shape: 'cone', coneAngle: 0.5 });
      expect(s.angle).toBeGreaterThanOrEqual(-Math.PI / 2 - 0.5 - 1e-9);
      expect(s.angle).toBeLessThanOrEqual(-Math.PI / 2 + 0.5 + 1e-9);
    }
    // 错峰：delay = i * stagger（定稿「每颗错开 36ms」）
    expect(particleSimSpec(0, { stagger: 36 }).delay).toBe(0);
    expect(particleSimSpec(7, { stagger: 36 }).delay).toBe(252);
    // 初速抖动有界（±15%）
    const sp = particleSimSpec(9, { speed: 520 }).speed;
    expect(sp).toBeGreaterThanOrEqual(520 * 0.85);
    expect(sp).toBeLessThanOrEqual(520 * 1.15);
    // 确定式（同 i 同输出）
    expect(particleSimSpec(5, { shape: 'cone', coneAngle: 0.4, speed: 320, stagger: 36 }))
      .toEqual(particleSimSpec(5, { shape: 'cone', coneAngle: 0.4, speed: 320, stagger: 36 }));
  });

  it('server 胶水：mountUI 挂物理粒子不炸·teardown 干净（happy-dom 无布局也安全）', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const tree: LayoutNode = {
      type: 'Panel', id: 'stage', props: { bare: true }, children: [
        { type: 'Badge', id: 'wallet', props: { text: '钱包' } },
        { type: 'Particles', id: 'burst', props: { kind: 'coins', count: 4, shape: 'cone', gravity: 600, flyTo: { kind: 'node', id: 'wallet' }, trail: { segments: 4 } } },
      ],
    };
    const un = mountUI(host, tree);
    expect(host.querySelector('[data-particle-sim]')).toBeTruthy();
    expect(host.querySelectorAll('[data-pp]').length).toBe(4);
    un(); // teardown 不抛（rAF 撤干净）
    expect(host.innerHTML).toBe('');
    host.remove();
  });
});

describe('REQ-UIFX B · ProgressBar shape:"liquid"（同族扩写·非新控件）', () => {
  it('液面杯：radius 裁 + fillColor + 水位 height% + 双错频波脊 + 整杯 slosh（游戏只给标量 value）', () => {
    const html = renderNode({ type: 'ProgressBar', id: 'cup', props: {
      value: 0.68, shape: 'liquid', radius: 18, fillColor: '#31b7f2', bubbles: 3,
    }, layout: { width: 92, height: 140 } });
    expect(html).toContain('data-liquid');
    expect(html).toContain('border-radius:18px');
    expect(html).toContain('background:#31b7f2');
    expect(html).toContain('height:68%'); // 水位=标量 value
    expect(html).toContain('apollo-liq-wave 900ms');   // 主脊（定稿 900ms）
    expect(html).toContain('apollo-liq-wave2 1250ms'); // 副脊（定稿 1250ms 反向·两条错频才有晃动感）
    expect(html).toContain('apollo-liq-slosh 1300ms'); // 整杯以杯底为轴 ±1.6°
    expect(html).toContain('transform-origin:50% 100%'); // 杯底为轴
    expect((html.match(/data-liq-bub/g) ?? []).length).toBe(3); // 气泡 3 颗
    expect(html).toContain('width:16px'); // 定稿气泡首档 16px
    expect(html).toContain('overflow:hidden'); // 杯体裁剪
  });

  it('wave:false=静水（无波动/slosh 动画·留静态水面脊）；气泡上限 8；fillColor 注入净化', () => {
    const still = renderNode({ type: 'ProgressBar', id: 's', props: { value: 0.5, shape: 'liquid', wave: false } });
    expect(still).not.toContain('apollo-liq-wave');
    expect(still).not.toContain('apollo-liq-slosh');
    expect(still).toContain('data-liq-ridge'); // 静态水面脊仍在（液体观感）
    const many = renderNode({ type: 'ProgressBar', id: 'm', props: { value: 0.5, shape: 'liquid', bubbles: 99 } });
    expect((many.match(/data-liq-bub/g) ?? []).length).toBe(8);
    const inj = renderNode({ type: 'ProgressBar', id: 'i', props: { value: 0.5, shape: 'liquid', fillColor: 'red;position:fixed' } });
    expect(inj).not.toContain('position:fixed');
  });

  it('showValue/label 叠中心（可读投影）；缺省 tone 取令牌色', () => {
    const html = renderNode({ type: 'ProgressBar', id: 'v', props: { value: 0.4, shape: 'liquid', showValue: true, label: '水位' } });
    expect(html).toContain('>40%<');
    expect(html).toContain('水位');
    expect(html).toContain('text-shadow'); // 值压液面仍可读
  });

  it('零回归：bar/ring 输出不含 liquid 标记·结构原样', () => {
    const bar = renderNode({ type: 'ProgressBar', id: 'b', props: { value: 0.5 } });
    expect(bar).not.toContain('data-liquid');
    expect(bar).toContain('transition:width .2s');
    const ring = renderNode({ type: 'ProgressBar', id: 'r', props: { value: 0.75, shape: 'ring' } });
    expect(ring).not.toContain('data-liquid');
    expect(ring).toContain('conic-gradient');
  });
});

describe('REQ-UIFX ⑤ · 同族小项', () => {
  it('Label.tween.scale：data-tween-scale + inline-block + 初始缩放；补间推进回到 scale(1)', () => {
    const html = renderNode({ type: 'Label', id: 'dmg', props: { text: '', tween: { from: 0, to: 120, ms: 320, scale: 0.82 } } });
    expect(html).toContain('data-tween-scale="0.82"');
    expect(html).toContain('display:inline-block');
    expect(html).toContain('transform:scale(0.82)');
    // 无 scale=原输出零回归（不塞 transform/inline-block）
    const plain = renderNode({ type: 'Label', id: 'p', props: { text: '', tween: { from: 0, to: 9 } } });
    expect(plain).not.toContain('data-tween-scale');
    expect(plain).not.toContain('transform:scale');
    // server 胶水：定时器推进 → transform 随进度回 1
    vi.useFakeTimers();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const un = mountUI(host, { type: 'Label', id: 'tw', props: { text: '', tween: { from: 0, to: 100, ms: 160, scale: 0.82 } } });
    vi.advanceTimersByTime(400); // 跑完补间
    const el = host.querySelector<HTMLElement>('#tw')!;
    expect(el.style.transform).toBe('scale(1.000)');
    expect(el.textContent).toBe('100');
    un(); host.remove();
  });

  it('anim:"tick"：steps(1,end) 硬跳节拍·infinite（「−1」印章每秒跳一下·周期=animMs）', () => {
    const html = renderNode({ type: 'Badge', id: 'stamp', props: { text: '−1' }, layout: { anim: 'tick' } });
    expect(html).toMatch(/animation:apollo-tick 1000ms steps\(1,end\) infinite/);
    const fast = renderNode({ type: 'Badge', id: 's2', props: { text: '−1' }, layout: { anim: 'tick', animMs: 500 } });
    expect(fast).toContain('apollo-tick 500ms steps(1,end) infinite');
  });

  it('keyframes 注入：mountUI 后 apollo-liq-* / apollo-tick 关键帧在 document（渲染器承担动画·非游戏层）', () => {
    document.getElementById('apollo-ui-keyframes')?.remove();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const un = mountUI(host, { type: 'Label', id: 'x', props: { text: 'x' } });
    const css = document.getElementById('apollo-ui-keyframes')!.textContent!;
    for (const kf of ['apollo-liq-wave', 'apollo-liq-wave2', 'apollo-liq-slosh', 'apollo-liq-bub', 'apollo-tick']) {
      expect(css).toContain(`@keyframes ${kf}`);
    }
    un(); host.remove();
  });
});

describe('REQ-UIFX · 目录/校验器自洽', () => {
  it('新轴样例过校验器零 issue；坏枚举被拦', () => {
    const good: LayoutNode[] = [
      { type: 'Particles', id: 'v1', props: { kind: 'coins', shape: 'cone', coneAngle: 0.5, gravity: 900, size: [12, 16, 20, 22, 26, 30], colorGradient: [{ t: 0, color: '#fff' }, { t: 1, color: '#e94f5a', alpha: 0.75 }], flyTo: { kind: 'node', id: 'w' }, trail: { segments: 6, blend: 'add' } } },
      { type: 'ProgressBar', id: 'v2', props: { value: 0.68, shape: 'liquid', radius: 18, fillColor: '#31b7f2', wave: true, bubbles: 3 } },
      { type: 'Label', id: 'v3', props: { text: '', tween: { from: 0, to: 9, scale: 0.82 } } },
    ];
    for (const n of good) expect(validateLayoutNode(n)).toEqual([]);
    // 坏枚举：Particles.shape / ProgressBar.shape 不在闭集 → bad-enum
    expect(validateLayoutNode({ type: 'Particles', id: 'b1', props: { kind: 'coins', shape: 'blob' } } as unknown as LayoutNode)
      .some((i) => i.kind === 'bad-enum')).toBe(true);
    expect(validateLayoutNode({ type: 'ProgressBar', id: 'b2', props: { value: 1, shape: 'water' } } as unknown as LayoutNode)
      .some((i) => i.kind === 'bad-enum')).toBe(true);
  });
});
