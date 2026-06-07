// Game D · 暗黑类 ARPG 垂直切片（PoC）。负责人：用户/Lead。
// 纯数据装配：技能 = PrefabTemplate，释放 = SpawnRequest，命中结算 = hitbox（关系型战斗能力簇）。
// 证蓝图 §3「涌现式系统叠加」：冰霜新星冻住敌人 → 碎冰重锤只对冰冻目标结算 20% maxHP 真伤。
// 全程零 ARPG 专属代码——战斗由通用能力（prefab/overlap/trigger/hitbox/resource）涌现。
// follow-up（非本切片）：可玩化（玩家输入/敌人 AI/渲染/VFX）、技能区自毁（lifetime）、接 studio NL 生成路径。
export { buildGameDBlueprint, GAME_D_TEMPLATES, TEAM_PLAYER, TEAM_ENEMY, STATUS_FROZEN } from './blueprint.js';
