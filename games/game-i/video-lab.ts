// Game I · 爱诗工作室样例 —— 现薄消费引擎 `@zerocraft/engine/ui/aishe` 工作室 kit（dogfood·owner 2026-07
//   「往深做 + 可随时插进别的游戏」）。原本一句写死提示词 + 一个钮的占位 demo，已升级为可复用工作室：
//   外观→提示词组装器 + 8 输出模式 + 生成/状态流 + Video 预览。本文件只做「game-i 侧适配」（保旧导出名）。
// 端口仍是引擎 services/aigp AishePort（旁路·不碰 sim/hash）；视图=纯 LayoutNode 数据（写世界=action 信号）。
export {
  buildAisheStudio as buildVideoLab,
  INITIAL_AISHE_STUDIO as INITIAL_AISHE,
  composeAishePrompt, aisheOptsForMode, AISHE_MODES,
} from '@zerocraft/engine/ui/aishe/index.js';
export type { AisheStudioState as AisheState } from '@zerocraft/engine/ui/aishe/index.js';
export type { AisheVideoHandle } from '@zerocraft/engine/services/aigp/index.js';
