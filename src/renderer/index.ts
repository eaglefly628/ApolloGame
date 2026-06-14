// ═══════════════════════════════════════════════════════════════
//  Renderer —— 引擎无关的渲染数据提取 + 可替换后端
//  collectRenderables 是核心；后端（Ascii / Canvas / …）只负责画。
// ═══════════════════════════════════════════════════════════════
export { collectRenderables } from './renderable.js';
export type { Renderable } from './renderable.js';
export { AsciiRenderer } from './ascii-renderer.js';
export type { AsciiRendererOptions } from './ascii-renderer.js';
export { CanvasRenderer } from './canvas-renderer.js';
export type { CanvasRendererOptions } from './canvas-renderer.js';
// 注：3D 后端 ThreeRenderer（依赖 three）刻意不在此 barrel 导出——避免 CanvasRenderer 的消费者连带打包 three。
// 它是 Game G 专属表现层，已随 gameG 自包含到 `src/games/game-g/three-renderer.ts`（若将来多款 3D 游戏复用，再升回本目录作通用后端）。
