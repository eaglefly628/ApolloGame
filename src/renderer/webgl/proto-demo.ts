// src/renderer/webgl/proto-demo.ts —— WebGL2 批渲原型的**真浏览器目击台**（REQ-3D-RENDER-EFFICIENCY 增量②）。
//  仅 dev 服务加载（`/webgl-proto.html`·不进生产构建·build input 只有 cartridge.html）。合成 ~540 个方/圆
//  实体（纯数据 World·零游戏耦合），挂 WebGLRenderer 每帧动画渲染，HUD 显 draw/实例数——证批渲真出画面 +
//  实心方/圆两模式 shader 正确 + draws 远小于实体数。文本走另一路（原型不画），此处无文本以聚焦 play-field。
import { World } from '@engine/core/world.js';
import type { Transform, Shape, Color } from '@engine/protocol/components.js';
import { WebGLRenderer } from './webgl-renderer.js';

const W = 640, H = 400;
const COLS = 30, ROWS = 18;

const world = new World();
let k = 0;
for (let gy = 0; gy < ROWS; gy++) {
  for (let gx = 0; gx < COLS; gx++) {
    const id = 'e' + k++;
    world.createEntity(id);
    world.addComponent<Transform>(id, { type: 'Transform', x: 14 + gx * 20.7, y: 14 + gy * 20.7, rotation: 0, scaleX: 1, scaleY: 1 });
    const circle = (gx + gy) % 2 === 0;
    world.addComponent<Shape>(id, circle ? { type: 'Shape', kind: 'circle', radius: 8 } : { type: 'Shape', kind: 'box', width: 14, height: 14 });
    // 彩虹网格（HSV→RGB 近似·让对比度断言有明暗层次）
    const hue = ((gx / COLS) + (gy / ROWS)) * 0.5;
    world.addComponent<Color>(id, { type: 'Color', tint: hsv(hue, 0.7, 1), alpha: 1 });
  }
}

const r = new WebGLRenderer({ width: W, height: H, background: '#0b1020' });
r.init(document.getElementById('app')!);

const ids = world.getAllEntities();
let phase = 0;
function frame(): void {
  phase += 0.04;
  let i = 0;
  for (const id of ids) {
    const t = world.getComponent<Transform>(id, 'Transform')!;
    t.rotation = phase + i * 0.11;                          // 转（帧活动·驱动 PIXELQA activity）
    t.scaleX = t.scaleY = 1 + 0.35 * Math.sin(phase + i * 0.2); // 脉动
    i++;
  }
  r.sync(world);
  const s = r.readStats();
  const hud = document.getElementById('hud');
  if (hud) hud.textContent = `WebGL2 批渲原型 · 实体 ${s.instances} → draw ${s.drawCalls}（skipped ${s.skipped}）`;
  requestAnimationFrame(frame);
}
frame();

function hsv(h: number, s: number, v: number): number {
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  let r = 0, g = 0, b = 0;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q; break;
  }
  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
}
