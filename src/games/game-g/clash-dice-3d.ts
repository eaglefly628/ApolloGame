// Game G · 掷命对决「3D 战力骰」（owner 2026-07-03「必须用我们的底座和 3D 基础·别绕规则」；对应 requests-3d.md REQ-3D-骰盅）。
//
// 数据驱动铁律下的真 3D 骰：**零手写 Three.js**。本模块只在 game 层**声明 ECS 组件数据**
// （Transform3D 位姿 / Mesh3D box+dieFaces 骰面 / Vfx3D 能量注入粒子 / Camera3D / Light3D / Sky3D env），
// 由主程/P3D 的 `ThreeRenderer` 解释渲染——与 game-d Title 大骰同一条路子（game-d.ts createEntity+addComponent）。
// 绝不改 three-renderer/引擎；绝不用 CSS 3D transform（既绕过 3D 基座、又会在战斗 zoom 画框里重演放大 bug）。
//
// 挂载点：clashNode 的 `clash-die3d-m`/`clash-die3d-f` 两个 🎲 锚点（各一颗骰）——mountTurnBattle 量锚点屏幕 rect、
// 各覆一张 fixed canvas（逃 innerHTML 重建 + zoom 裁剪·同 tip 气泡路子）。骰绕 X/Y 缓转 + 粒子上涌（「在对决画面旋转」）；
// 掷值数字仍由 clashNode 的 `clash-die-m/f` 文本显（驱动层就地哒哒哒滚·本 3D 骰纯装饰旋转·不落特定面）。
// 无 WebGL（happy-dom 测试）→ mount 返回 null，🎲 emoji 占位照显（数据驱动回退·headless 安全）。
import { Engine } from '../../runtime/engine.js';
import { ThreeRenderer } from '@renderer/three-renderer.js';
import type { Component } from '@engine/core/types.js';

export interface ClashDie3DOpts {
  power: number; // 战力（骰面点数上限 1~power）
  mine: boolean; // 我方(暖橙) / 敌方(冷蓝)
  dark: boolean; // 皮肤：玄铁(暗)/锦霞(亮)——定环境色
}

export interface ClashDie3DHandle {
  destroy(): void;
}

// 骰面贴图（data URL·程序化数字面）：奶白骰底 + 阵营色描边 + 大数字。dieFaces.src 优先于程序化 pip → 支持任意战力数字。
function faceTex(n: number, dark: boolean, mine: boolean): string {
  const S = 128;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x = cv.getContext('2d');
  if (!x) return '';
  const g = x.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, dark ? '#fffaf0' : '#fffdf6'); g.addColorStop(1, dark ? '#e6d3ad' : '#f0dcc2');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const team = mine ? '#ee5a25' : '#2a5f9e';
  x.strokeStyle = team; x.lineWidth = 8; x.strokeRect(6, 6, S - 12, S - 12);
  x.fillStyle = mine ? '#b1402f' : '#2a5f9e';
  x.font = '700 68px Rajdhani, "Noto Sans SC", sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(String(n), S / 2, S / 2 + 4);
  return cv.toDataURL();
}

// 六面（BoxGeometry 面序 [右,左,顶,底,前,后]）——各面随机 1~power 数字（翻滚时闪现·忠实设计稿 rolling 相）。
function dieFaces(power: number, dark: boolean, mine: boolean): Array<{ color: number; pip: number; src: string }> {
  const p = Math.max(1, power);
  let s = mine ? 91 : 47; // 稳定种子（render-only·可用）
  const rnd = (): number => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  return Array.from({ length: 6 }, () => {
    const n = 1 + Math.floor(rnd() * p);
    return { color: mine ? 0xee5a25 : 0x2a5f9e, pip: ((n - 1) % 6) + 1, src: faceTex(n, dark, mine) };
  });
}

/** 挂载一颗 3D 战力骰（绕轴翻滚 + 能量注入粒子）。host 须已定位/定尺（canvas 铺满）。
 *  无 WebGL 或建渲染器失败 → 返回 null（调用方回退 🎲 emoji 占位·测试环境即走此路）。 */
export function mountClashDie3D(host: HTMLElement, w: number, h: number, opts: ClashDie3DOpts): ClashDie3DHandle | null {
  const { mine, dark } = opts;
  let engine: Engine;
  let renderer: ThreeRenderer;
  try {
    engine = new Engine();
    // 背景贴近 clash-dicewrap 底（暗蓝·免突兀暗方块）；小画布上翻滚的亮骰足够抓眼。
    renderer = new ThreeRenderer({ width: Math.max(2, Math.round(w)), height: Math.max(2, Math.round(h)), background: dark ? 0x141c28 : 0xe9d3c9, fov: 34 });
    engine.attachRenderer(renderer, host);
  } catch {
    return null; // headless / 无 WebGL → 交给 🎲 emoji 占位
  }
  const cv = host.querySelector('canvas'); if (cv) { cv.style.width = '100%'; cv.style.height = '100%'; cv.style.display = 'block'; }

  const add = (id: string, ...comps: object[]): void => {
    engine.world.createEntity(id);
    for (const c of comps) engine.world.addComponent(id, c as unknown as Component);
  };
  // 相机：透视微俯·正对骰
  add('cd-cam', { type: 'Camera3D', yaw: 0, pitch: 0.24, distance: 7.4, pivotX: 0, pivotY: 0.1, pivotZ: 0, projection: 'perspective', fov: 34 });
  add('cd-sky', { type: 'Sky3D', top: dark ? 0x1a2740 : 0xf7e6dc, bottom: dark ? 0x0a121f : 0xe6bcbb, env: 0.8 });
  add('cd-sun', { type: 'Light3D', kind: 'directional', color: 0xfff0dc, intensity: 1.6, dirX: -0.4, dirY: -1, dirZ: -0.6 });
  add('cd-amb', { type: 'Light3D', kind: 'ambient', color: dark ? 0x5a6a88 : 0xfff2e6, intensity: dark ? 1.0 : 1.3 });
  // 骰体：位姿 + box 六面数字骰面 + **Anim3D 数据驱动翻滚**（rotX+rotY 双 spin + y-bob·渲染器 Anim3DSystem 每帧算·
  //   零游戏层逐帧手写——遵「把逐帧手写下沉成数据」的 3D 基座铁律·owner「必须 follow 底座·不能自己创造」）。
  const SZ = 3.0;
  const rx = mine ? 1.4 : 1.15, ry = mine ? 1.9 : -1.65; // rad/秒·基速·两骰异速（错开视觉·非同步）
  // Anim3D spin 通道对象**存引用**→ P18：game 层按钟形曲线脉动其 rate（加速→峰值→减速·像摇骰子·非恒速·owner 2026-07-04「旋转要有加速减速曲线·别恒速看着突然停」）。
  //   只改自家实体的组件数据·不碰渲染器/Anim3DSystem（真·下沉成 Anim3D ease/pulse 通道归 P3D·已提 requests-3d）。
  const spinX = { kind: 'spin', field: 'rotX', rate: rx };
  const spinY = { kind: 'spin', field: 'rotY', rate: ry };
  add('cd-die',
    { type: 'Transform3D', x: 0, y: 0.1, z: 0, rotX: -0.3, rotY: 0.4, scale: 1 },
    { type: 'Mesh3D', shape: 'box', width: SZ, height: SZ, depth: SZ, frontTint: 0xffffff, dieFaces: dieFaces(opts.power, dark, mine) },
    { type: 'Anim3D', channels: [spinX, spinY, { kind: 'bob', field: 'y', amp: 0.16, freq: 3.1, phase: mine ? 0 : 1.6 }] },
  );
  // 能量注入粒子（Vfx3D·真 3D 粒子）：P18 修「粒子层级在骰之下·被挡」→ 发射点前移到骰**前方**(z 正=朝相机) + 抬高·加大量/尺寸 → 火星在骰前迸涌可见·不被骰体遮。
  add('cd-vfx',
    { type: 'Transform3D', x: 0, y: -1.4, z: 1.7 },
    { type: 'Vfx3D', rate: 30, lifetime: 0.9, lifeVar: 0.3, max: 64, shape: 'cone', coneAngle: 0.62, emitRadius: 1.2, speed: 3.6, speedVar: 1.1, gravity: -1.3, drag: 0.4, size: 0.36, color: mine ? 0xff965a : 0x5aaaff, blend: 'add' },
  );
  engine.start(); // rAF 循环 → renderer.sync 每帧跑 Anim3DSystem/VfxSystem（翻滚 + 粒子皆数据驱动）
  // ── P18 旋转脉动（加速→峰值→减速循环·摇骰手感）：钟形曲线改 spin rate（中间最快·两端慢）。rAF timestamp 驱动（非 Date.now）。──
  let rafId = 0; const PERIOD = 1500; // ms/脉动周期
  const pulse = (t: number): void => {
    const k = 0.5 - 0.5 * Math.cos(((t % PERIOD) / PERIOD) * 2 * Math.PI); // 0(慢)→1(峰·最快)→0(慢) 钟形
    const boost = 1.4 + k * 3.6; // 基速×[1.4,5.0] → 高速 + 明显加速减速
    spinX.rate = rx * boost; spinY.rate = ry * boost;
    rafId = requestAnimationFrame(pulse);
  };
  rafId = requestAnimationFrame(pulse);

  return {
    destroy: (): void => {
      try { if (rafId) cancelAnimationFrame(rafId); engine.stop(); renderer.destroy(); } catch { /* noop */ }
      host.replaceChildren();
    },
  };
}
