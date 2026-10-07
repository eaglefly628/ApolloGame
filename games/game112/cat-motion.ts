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

/** 只对应玳瑁掌柜坐姿立绘：胸前一像素级呼吸、尾尖轻摆，脸/耳/爪固定。 */
export const SHOPKEEPER_REST_MOTION: ImageMeshMotion = {
  cycleMs: 4800,
  regions: [
    { center: [0.75, 0.62], radius: [0.10, 0.10], move: [0, -0.005] },
    { center: [0.13, 0.60], radius: [0.10, 0.10], move: [0.011, -0.003], harmonic: 2 },
  ],
};

export function shopkeeperMotion(src: string): ImageMeshMotion | undefined {
  return src.endsWith('/shopkeeper-tortoiseshell-v1.png') ? SHOPKEEPER_REST_MOTION : undefined;
}

/** 标定只对这张坐姿图有效；换猫或换画稿时静态显示，避免错位牵拉。 */
export function xuetuanMotion(src: string, engaged = false): ImageMeshMotion | undefined {
  if (src === '/games/game112/art/cat/xuetuan-rest-v1.png') return engaged ? {
    cycleMs: 3600,
    regions: [XUETUAN_REST_MOTION.regions[0]!, { ...XUETUAN_REST_MOTION.regions[1]!, move: [0.023, -0.006] }],
  } : XUETUAN_REST_MOTION;
  return undefined;
}
