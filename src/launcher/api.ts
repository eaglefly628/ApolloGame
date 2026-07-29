// launcher.tsx 拆分而来（2026-07-16 纯搬运·行为不变）：创作服务 API 基址 + fetch 助手。

// 平台打包 D2（同源伺服）：`vite dev`（import.meta.env.DEV）时前端跑 :5173、后端 API 另开 :4000，
// 需要跨源绝对地址；生产构建（`vite build`）由后端 server.py 直接把 dist/ 端在同一个端口上
// （见 main_entry/server.py `_serve_static`），此时 API 与页面同源——base 留空即走相对路径，
// 打包进 electron/移到别的端口也天然跟着走，不用再改一处硬编码地址。
export const API = import.meta.env.DEV ? 'http://localhost:4000' : '';

// ══════════════════════════════════════
//  API helpers
// ══════════════════════════════════════

export async function apiCall(endpoint: string): Promise<any> {
  const res = await fetch(`${API}${endpoint}`);
  return res.json();
}
