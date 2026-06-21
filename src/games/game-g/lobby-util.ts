// Game G · 大厅共享小工具（拆分自 lobby-screen.ts·零依赖叶子·供各 section 模块复用，免循环引用）。
export const esc = (s: string): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
