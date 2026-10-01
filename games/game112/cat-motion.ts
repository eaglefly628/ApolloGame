// 雪团坐姿透明图的 2D 柔性待机标定。坐标按图片宽高归一化。
// 只让胸前毛发轻微呼吸、尾尖小幅摆动；头、脸、耳、躯干和脚掌必须固定。
import type { ImageMeshMotion } from '@zerocraft/engine/ui/components/index.js';

export const XUETUAN_REST_MOTION: ImageMeshMotion = {
  cycleMs: 5200,
  regions: [
    { center: [0.36, 0.65], radius: [0.19, 0.17], move: [0, -0.006] },
    { center: [0.85, 0.83], radius: [0.13, 0.11], move: [0.014, -0.004], harmonic: 2 },
  ],
};

/** 标定只对这张坐姿图有效；换猫或换画稿时静态显示，避免错位牵拉。 */
export function xuetuanMotion(src: string): ImageMeshMotion | undefined {
  if (src === '/games/game112/art/cat/xuetuan-rest-v1.png') return XUETUAN_REST_MOTION;
  return undefined;
}
