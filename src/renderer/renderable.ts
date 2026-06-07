import type { IWorld } from '@engine/core/types.js';
import type { Transform, Shape, Color, Sprite, Text, Visibility, Frame } from '@engine/protocol/components.js';

// 相机视图与世界↔屏幕投影已下沉为共享契约（renderer 正向投影 + clickable 逆向命中的单一真相）。
// 此处重导出，保持既有 `@renderer/renderable` 消费者（canvas-renderer / 测试）的 import 不变。
export type { CameraView } from '@engine/protocol/camera-view.js';
export { getCameraView, screenToWorld } from '@engine/protocol/camera-view.js';

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
  frame?: Frame; // 当前帧索引（序列帧/命名动画用；渲染器据此 resolve(textureKey, frame.index)）
  text?: Text;
}

// 实体绘制模式选择（REQ-005）：**优先 Sprite** —— 有贴图且资产就绪即画贴图（给可碰撞实体"穿皮"，
// 盖过 Shape 几何）；否则退化为 Shape 几何（碰撞体可视化）；仅有 Sprite 但资产未就绪 → 占位方块；都没有 → 不画。
// 抽成纯函数：渲染优先级（曾经 Shape 排在 Sprite 前 → 可碰撞实体显示不了美术皮）可在无 DOM 的 node 环境单测，
// 真正的 drawImage/fillRect 只是后端薄胶水。文本实体仍优先文本（与原行为一致）。
export type RenderMode = 'text' | 'sprite' | 'shape' | 'placeholder' | 'none';
export function chooseRenderMode(r: Renderable, spriteReady: boolean): RenderMode {
  if (r.text) return 'text';
  if (r.sprite && spriteReady) return 'sprite';
  if (r.shape) return 'shape';
  if (r.sprite) return 'placeholder';
  return 'none';
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
      frame: world.getComponent<Frame>(id, 'Frame'),
      text: world.getComponent<Text>(id, 'Text'),
    });
  }
  out.sort((a, b) => a.zOrder - b.zOrder);
  return out;
}
