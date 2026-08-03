// 爱诗工作室 kit 出口（PUI·owner 2026-07「可随时插进别的游戏」）。
// 游戏 import：`@zerocraft/engine/ui/aishe`。消费引擎 services/aigp AishePort（旁路·sim 外）。
export {
  buildAisheStudio, composeAishePrompt, aisheOptsForMode, modeById,
  AISHE_MODES, INITIAL_AISHE_STUDIO,
} from './aishe-studio.js';
export type { AisheMode, AisheLook, AisheStudioState } from './aishe-studio.js';
