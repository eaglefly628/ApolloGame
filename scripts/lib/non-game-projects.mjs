// games/<slug>/ 下但「不属于游戏」的项目（owner 2026-10-21：game113 不属于游戏，可以例外，以后不要管它）。
// 单一真相：游戏层规则与守卫（game-skill-audit 红旗/棘轮、惰性组件守卫、推送门的 audit 步）一律跳过这些目录。
// 仍保留的是全库构建健康（tsc / depcruise / build / 测试三禁 eslint）——它与其他代码同仓同构建，坏了会拦所有人。
export const NON_GAME_PROJECTS = Object.freeze(['game113']);

export function isNonGameProject(slug) {
  return NON_GAME_PROJECTS.includes(slug);
}
