import type { IWorld } from '../core/types.js';
import type { Camera } from './components.js';

// ═══════════════════════════════════════════════════════════════
//  相机视图 —— 世界↔屏幕投影的**单一真相**（共享契约层）。
//
//  渲染器用「正向」（世界→屏幕，画卷轴）；指针命中用「逆向」（屏幕→世界，命中测试）。
//  二者必须用同一套相机参数，否则正反投影各自漂移 → 命中错位（集成层 bug 温床）。
//  因此把它放在 protocol（Camera 组件所在层），渲染器与 clickable 共同消费，定义一处。
//
//  确定性边界：相机是**纯表现**（已排除出 world hash）。同一客户端的录放是确定的；
//  跨客户端 lockstep 下若各端视口/相机不同，屏幕坐标命中会分叉——指针输入的跨端一致性
//  是已知待验证项（见 SESSION-HANDOFF §4），不在本模块承诺范围内。
// ═══════════════════════════════════════════════════════════════

// 引擎无关的相机视图：世界中心点 + 缩放。渲染后端据此做世界→屏幕投影（卷轴）。
export interface CameraView {
  centerX: number;
  centerY: number;
  zoom: number;
}

// 取世界里的相机（第一个挂 Camera 的实体）。无则返回 null（投影退化为世界坐标 1:1）。
export function getCameraView(world: IWorld): CameraView | null {
  for (const [e] of world.query('Camera')) {
    const c = world.getComponent<Camera>(e, 'Camera');
    if (c) return { centerX: c.offsetX, centerY: c.offsetY, zoom: c.zoom };
  }
  return null;
}

// 屏幕坐标 → 世界坐标：CanvasRenderer 投影 translate(中心)→scale(zoom)→translate(-center) 的逆变换
// （Gemini Q5）。指针/点击拿到的是屏幕坐标，命中测试前用它换回世界坐标，免得每个游戏自己手写逆矩阵。
// 无相机（cam=null）时屏幕即世界。
export function screenToWorld(
  screenX: number,
  screenY: number,
  cam: CameraView | null,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  if (!cam) return { x: screenX, y: screenY };
  return {
    x: (screenX - canvasWidth / 2) / cam.zoom + cam.centerX,
    y: (screenY - canvasHeight / 2) / cam.zoom + cam.centerY,
  };
}
