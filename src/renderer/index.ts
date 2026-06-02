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
