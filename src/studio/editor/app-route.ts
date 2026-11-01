// 首屏路由：缺省进新的引擎编辑器（owner 2026-11-01「重构创作平台整个界面」）；
// 旧版创作台照常可达——带 legacy=1，或带旧版自己认的参数（深链 game / 工坊跳转 from / 裸跑 bare / 玩家模式 mode）
// 一律直进旧版，保证老游戏、工坊、电子壳、分享链接全部原样兼容。
const LEGACY_PARAMS = ['legacy', 'game', 'from', 'bare', 'mode'] as const;

export function startsInLegacy(search: string): boolean {
  const q = new URLSearchParams(search);
  return LEGACY_PARAMS.some((k) => q.has(k));
}
