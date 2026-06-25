// Injected by vite.config.cartridge.ts at build time
declare const __TARGET_GAME__: string;

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
