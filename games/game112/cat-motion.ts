// 雪团透明锚图的 2D 柔性待机标定。坐标按各图片宽高归一化；运动只触及耳、胸、尾，不移动脚掌。
// 这是单图局部网格样片，不承担跨视角转身或完整走路。
import type { ImageMeshMotion } from '@zerocraft/engine/ui/components/index.js';

export const XUETUAN_REST_MOTION: ImageMeshMotion = {
  cycleMs: 4600,
  regions: [
    { center: [0.39, 0.59], radius: [0.34, 0.32], move: [0, -0.013], scale: [0.05, 0.04] },
    { center: [0.33, 0.16], radius: [0.12, 0.15], move: [-0.018, -0.015], harmonic: 3 },
    { center: [0.59, 0.25], radius: [0.14, 0.11], move: [0.015, -0.009], harmonic: 2 },
    { center: [0.85, 0.84], radius: [0.22, 0.16], move: [0.055, -0.018], harmonic: 2 },
  ],
};

export const XUETUAN_NOTICE_MOTION: ImageMeshMotion = {
  cycleMs: 4300,
  regions: [
    { center: [0.43, 0.72], radius: [0.29, 0.23], move: [0, -0.011], scale: [0.041, 0.036] },
    { center: [0.34, 0.44], radius: [0.11, 0.12], move: [-0.014, -0.011], harmonic: 3 },
    { center: [0.59, 0.56], radius: [0.13, 0.10], move: [0.012, -0.008], harmonic: 2 },
    { center: [0.81, 0.16], radius: [0.18, 0.18], move: [0.052, -0.015], harmonic: 2 },
  ],
};

/** 标定只对这两张确切图片有效；换猫或换画稿时静态显示，避免错位牵拉。 */
export function xuetuanMotion(src: string): ImageMeshMotion | undefined {
  if (src === '/games/game112/art/cat/xuetuan-rest-v1.png') return XUETUAN_REST_MOTION;
  if (src === '/games/game112/art/cat/xuetuan-notice-v1.png') return XUETUAN_NOTICE_MOTION;
  return undefined;
}
