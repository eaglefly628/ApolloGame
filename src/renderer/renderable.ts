import type { IWorld } from '@engine/core/types.js';
import type { Transform, Shape, Color, Sprite, Text, Visibility, Camera } from '@engine/protocol/components.js';

// 引擎无关的相机视图：世界中心点 + 缩放。渲染后端据此做世界→屏幕投影（卷轴）。
export interface CameraView {
  centerX: number;
  centerY: number;
  zoom: number;
}

// 取世界里的相机（第一个挂 Camera 的实体）。无则返回 null（渲染退化为世界坐标 1:1）。
export function getCameraView(world: IWorld): CameraView | null {
  for (const [e] of world.query('Camera')) {
    const c = world.getComponent<Camera>(e, 'Camera');
    if (c) return { centerX: c.offsetX, centerY: c.offsetY, zoom: c.zoom };
  }
  return null;
}

// 引擎无关的渲染数据。任何后端（Ascii / Canvas / Phaser / AI 视频）都消费同一份。
export interface Renderable {
  entityId: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  zOrder: number;
  shape?: Shape;
  color?: Color;
  sprite?: Sprite;
  text?: Text;
}

// 从世界提取可渲染项：所有挂 Transform 且未被 Visibility 隐藏的实体，按 zOrder 排序。
export function collectRenderables(world: IWorld): Renderable[] {
  const out: Renderable[] = [];
  for (const [id] of world.query('Transform')) {
    const visibility = world.getComponent<Visibility>(id, 'Visibility');
    if (visibility && !visibility.visible) continue;
    const t = world.getComponent<Transform>(id, 'Transform')!;
    const sprite = world.getComponent<Sprite>(id, 'Sprite');
    out.push({
      entityId: id,
      x: t.x,
      y: t.y,
      rotation: t.rotation,
      scaleX: t.scaleX,
      scaleY: t.scaleY,
      zOrder: sprite?.zOrder ?? 0,
      shape: world.getComponent<Shape>(id, 'Shape'),
      color: world.getComponent<Color>(id, 'Color'),
      sprite,
      text: world.getComponent<Text>(id, 'Text'),
    });
  }
  out.sort((a, b) => a.zOrder - b.zOrder);
  return out;
}
