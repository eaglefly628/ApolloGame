// Game I 展示台 · 模块清单 MODULES + 稳定编号 MODULE_NO
// 由 gallery.ts 按 REQ-I-gallery拆分 逐字节搬出（零逻辑改）。入口/组装仍在 gallery.ts。

/**
 * 展示台模块清单——每块「积木」是一类底座能力的活样例。点一块进它自己的子菜单。
 * soon=规划中（占位·灰块不可点）。后续精灵动画/3D/视频逐块点亮。
 */
export const MODULES: ReadonlyArray<{ id: string; glyph: string; label: string; desc: string; tone: 'accent' | 'normal' | 'dim'; dim: '2d' | '3d'; soon?: boolean }> = [
  // ── 2D 区 ──
  { id: 'mod-ui', glyph: '🎛', label: 'UI 控件', desc: '30+ 数据驱动控件 · 换皮', tone: 'accent' as const, dim: '2d' },
  { id: 'mod-mmo', glyph: '🗡', label: '组合 · MMO HUD', desc: '纯数据复现 WoW 风最复杂 HUD', tone: 'accent' as const, dim: '2d' },
  { id: 'mod-casual', glyph: '🍬', label: '组合 · 超休闲对局', desc: '精致消除对局屏 · 糖果棋盘 + 道具 + juice', tone: 'accent' as const, dim: '2d' },
  { id: 'mod-dialogue', glyph: '💬', label: '剧情 · VN 对话三件', desc: '台词框 + 选项 + 立绘 · 闭集纯数据 · 消费 t3-dialogue 投影', tone: 'accent' as const, dim: '2d' },
  { id: 'mod-presence', glyph: '🫂', label: '剧情 · 伴侣在场件', desc: '非剧情对局叠伴侣反应 · 反应表选句 + M1 三件拼装', tone: 'accent' as const, dim: '2d' },
  { id: 'mod-sound', glyph: '🔊', label: '声音', desc: '合成 / 混音 / 立体声 / 混响', tone: 'normal' as const, dim: '2d' },
  { id: 'mod-input', glyph: '🎮', label: '输入底座', desc: 'RawInput → KeyBinding → 信号', tone: 'normal' as const, dim: '2d' },
  { id: 'mod-anim', glyph: '✨', label: '精灵动画', desc: 'tween 驱动 · Canvas 实时绘制', tone: 'normal' as const, dim: '2d' },
  { id: 'mod-ai', glyph: '🧠', label: '游戏 AI', desc: '索敌 aggro / 寻路 grid-move', tone: 'normal' as const, dim: '2d' },
  { id: 'mod-physics', glyph: '🟢', label: '运动与碰撞', desc: 'motion + overlap + 碰撞响应', tone: 'normal' as const, dim: '2d' },
  { id: 'mod-combat', glyph: '⚔️', label: '战斗结算', desc: '命中 → 伤害 → DoT → 死亡', tone: 'normal' as const, dim: '2d' },
  { id: 'mod-spawn', glyph: '🎆', label: '生成与寿命', desc: 'spawn → 飞 → 寿命自毁', tone: 'normal' as const, dim: '2d' },
  { id: 'mod-fx', glyph: '💥', label: '战场特效（库B）', desc: '爆炸环 prefab · 火花叠在画面上', tone: 'normal' as const, dim: '2d' },
  { id: 'mod-fsm', glyph: '🔀', label: '状态机', desc: 'condition → signal → set-state', tone: 'normal' as const, dim: '2d' },
  { id: 'mod-video', glyph: '🎬', label: '爱诗工作室', desc: 'AIGP 端口 · 8 输出模式 · 竖/横屏短视频', tone: 'normal' as const, dim: '2d' },
  // ── 3D 区（消费 P3D 3D 渲染线·ThreeRenderer）──
  { id: 'mod-3d', glyph: '🧊', label: '3D 渲染', desc: 'Mesh3D · 翻面/翻滚 基础旋转', tone: 'accent' as const, dim: '3d' },
  { id: 'mod-3d-light', glyph: '💡', label: '数据化光照', desc: 'Light3D 定向+环境 · 投影', tone: 'normal' as const, dim: '3d' },
  { id: 'mod-3d-post', glyph: '🔭', label: '景深 · 泛光', desc: 'Post3D 移轴景深 + bloom', tone: 'normal' as const, dim: '3d' },
  { id: 'mod-3d-primitives', glyph: '🔷', label: '圆润图元', desc: 'Mesh3D 球/柱/锥/胶囊/环 7 原语', tone: 'normal' as const, dim: '3d' },
  { id: 'mod-3d-nav', glyph: '🧭', label: '3D 寻路', desc: 'navmesh 自动烘焙 + 绕障追逐', tone: 'normal' as const, dim: '3d' },
  { id: 'mod-3d-collide', glyph: '🎯', label: '3D 碰撞', desc: 'Collider3D / Overlap3D · 触发区', tone: 'normal' as const, dim: '3d' },
  { id: 'mod-3d-particle', glyph: '🎇', label: '3D 粒子（prefab）', desc: 'prefab → Mesh3D 火花 · 泛光', tone: 'normal' as const, dim: '3d' },
  { id: 'mod-3d-vfx', glyph: '🌟', label: '3D 粒子（Vfx3D）', desc: '数据驱动发射器 · 锥喷+重力+渐变', tone: 'normal' as const, dim: '3d' },
  { id: 'mod-3d-text', glyph: '🔤', label: '头顶 3D 文字', desc: 'WorldUI3D · 世界空间飘字', tone: 'normal' as const, dim: '3d' },
  { id: 'mod-3d-worldui', glyph: '🪧', label: '世界空间面板', desc: 'WorldUI3D.node · 富 LayoutNode 名牌+血条', tone: 'normal' as const, dim: '3d' },
  { id: 'mod-3d-ao', glyph: '🌑', label: '环境光遮蔽 AO', desc: 'Post3D.ao · 接触/缝隙压暗', tone: 'normal' as const, dim: '3d' },
  { id: 'mod-3d-material', glyph: '🧱', label: 'PBR 材质', desc: 'Material3D 金/钢/玻璃 + 调色', tone: 'normal' as const, dim: '3d' },
  { id: 'mod-3d-fog', glyph: '🌫', label: '距离雾', desc: 'Fog3D · 远处渐隐纵深', tone: 'normal' as const, dim: '3d' },
  { id: 'mod-3d-pointlight', glyph: '🔦', label: '点光源 / 聚光灯', desc: 'Light3D point·spot · 动态局部光', tone: 'normal' as const, dim: '3d' },
  { id: 'mod-3d-surface', glyph: '🪨', label: '程序化表面细节', desc: 'Material3D.surface · 凹凸/划痕贴图', tone: 'normal' as const, dim: '3d' },
  { id: 'mod-3d-toon', glyph: '🖍', label: '卡通描边 toon', desc: 'Material3D.shading:toon + outline', tone: 'normal' as const, dim: '3d' },
  { id: 'mod-3d-billboard', glyph: '🪙', label: '广告牌 + 贴花', desc: 'Billboard3D 朝相机 + Decal3D 地阴影', tone: 'normal' as const, dim: '3d' },
  { id: 'mod-3d-path', glyph: '🛤', label: '路径跟随', desc: 'Path3D · 巡逻/轨道/移动平台', tone: 'normal' as const, dim: '3d' },
  { id: 'mod-3d-spring', glyph: '🟢', label: '弹簧动画', desc: 'Anim3D spring · 弹入/落定过冲', tone: 'normal' as const, dim: '3d' },
  { id: 'mod-3d-model', glyph: '🦆', label: 'glTF 模型导入', desc: 'Model3D · 真模型 + 自带材质/软影', tone: 'normal' as const, dim: '3d' },
];

/** 一块模块积木卡。 */
/** 每个效果的稳定索引编号（=在 MODULES 里的全局位次·1 起）：卡片角标显示 + 编号快速跳转都取它。
 *  追加新效果不改旧号（位次不变）；用它「指定编号→点击直达」。 */
export const MODULE_NO: ReadonlyMap<string, number> = new Map(MODULES.map((m, i) => [m.id, i + 1]));
