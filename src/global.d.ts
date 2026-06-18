// Injected by vite.config.cartridge.ts at build time
declare const __TARGET_GAME__: string;

// Vite ?raw 文本导入（如新手教程 html 内联进弹层 iframe srcdoc）
declare module '*.html?raw' {
  const content: string;
  export default content;
}
