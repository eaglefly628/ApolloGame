// Injected by vite.config.cartridge.ts at build time
declare const __TARGET_GAME__: string;

// 离线单文件卡带（scripts/package-web.mjs 注入到 <head>·在 bundle 之前执行）：
//   __APOLLO_INLINE_CART__ = 该卡带的 manifest 纯 JSON 对象（引擎经 parseManifest 直接跑，跳过 fetch）
//   __APOLLO_INLINE_META__ = 引导壳展示用的 { title, subtitle }（可选）
interface Window {
  __APOLLO_INLINE_CART__?: unknown;
  __APOLLO_INLINE_META__?: { title?: string; subtitle?: string };
}

// Vite ?raw 文本导入（如新手教程 html 内联进弹层 iframe srcdoc）
declare module '*.html?raw' {
  const content: string;
  export default content;
}

// Vite ?url 资产导入（自托管字体 woff2 等 → 打包发出 URL，不引用外部库）
declare module '*.woff2' {
  const src: string;
  export default src;
}
declare module '*.woff2?url' {
  const url: string;
  export default url;
}
