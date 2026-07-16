// launcher.tsx 拆分而来（2026-07-16 纯搬运·行为不变）：创作服务 API 基址 + fetch 助手。

export const API = 'http://localhost:4000';

// ══════════════════════════════════════
//  API helpers
// ══════════════════════════════════════

export async function apiCall(endpoint: string): Promise<any> {
  const res = await fetch(`${API}${endpoint}`);
  return res.json();
}
