// Game I · 控件画廊 —— **薄入口/组装层**（REQ-I-gallery拆分·owner 2026-07-15 批「拆大文件」）。
//
// 这就是「玩 UI」的测试场：把引擎现有控件全部铺开、可交互、可换皮。
// 红线：本文件只产出数据。渲染/事件/换皮由引擎 renderNode + mountUI 解释（见 game-i.ts）。
// 母法：apollo-ui-contract.md（控件契约总表·归档层已删·查 git 历史）。
//
// **拆分后的结构**（原 2148 行单文件 → 薄入口 + gallery/ 分页·逐字节搬运零逻辑改）：
//   gallery/shared.ts     跨页共用（ControlsState/调参台/子编号器/段标题/贴图常量）
//   gallery/modules.ts    模块清单 MODULES + 稳定编号 MODULE_NO
//   gallery/hub.ts        落地积木墙 + 渲染舞台壳 buildSimStage
//   gallery/page-*.ts     各子 tab 一页（layout/display/input/3dui/3dbtn/emoji/new）
// 加新页 = 新建 gallery/page-X.ts + 在本文件 buildUIModule 的 tabs/children 各加一行。

import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { THEME_OPTIONS } from './themes.js';
import { buildShop, INITIAL_SHOP, type ShopState } from './shop.js';
import { buildPickHand, INITIAL_PICK, type PickState } from './pickcards.js';
import { buildInputLab, INITIAL_INPUT, type InputLabState } from './input-lab.js';
import { buildVideoLab, INITIAL_AISHE, type AisheState } from './video-lab.js';
import { buildMmoHud } from './mmo-hud.js';
import { buildCasualHud } from './casual-hud.js';
import { buildDialogueScene } from './dialogue-demo.js';
import { buildPresenceDemo } from './presence-demo.js';
import { beginSections, tuneDeck, INITIAL_CONTROLS, type ControlsState } from './gallery/shared.js';
import { MODULES } from './gallery/modules.js';
import { buildHub, buildSimStage } from './gallery/hub.js';
import { pageLayout } from './gallery/page-layout.js';
import { pageDisplay } from './gallery/page-display.js';
import { buildPageInput, buildSoundPage, modalOverlay, drawerOverlay } from './gallery/page-input.js';
import { buildPage3dUi } from './gallery/page-3dui.js';
import { buildPage3dButtons } from './gallery/page-3dbtn.js';
import { buildPageEmoji } from './gallery/page-emoji.js';
import { buildPageNew } from './gallery/page-new.js';

// ── 公开面（拆分前由本文件直接导出·保持调用方 import 不变）──────────────
export { INITIAL_CONTROLS, TEXTURE_URI, tuneDeck } from './gallery/shared.js';
export type { ControlsState, TuneSpec } from './gallery/shared.js';
export { MODULES, MODULE_NO } from './gallery/modules.js';
export { modalOverlay, drawerOverlay } from './gallery/page-input.js';

/** UI 控件模块（7 个 UI 子 tab：容器/展示/输入/3D UI/新特性/商店/选牌）。 */
function buildUIModule(shop: ShopState, pick: PickState, activeTab: string, controls: ControlsState): LayoutNode {
  return {
    type: 'Tabs', id: 'gallery-tabs',
    props: {
      tabs: [
        { id: 'tab-layout', label: '容器与布局' },
        { id: 'tab-display', label: '数据展示' },
        { id: 'tab-input', label: '输入与交互' },
        { id: 'tab-3dui', label: '🧊 3D UI' },
        { id: 'tab-emoji', label: '🎨 emoji 美术' },
        { id: 'tab-new', label: '🆕 新控件/特性' },
        { id: 'tab-shop', label: '🧩 组合演示·商店' },
        { id: 'tab-pick', label: '🎴 组合演示·选牌' },
        { id: 'tab-3dbtn', label: '🕹 3D 按钮布局' },
      ],
      active: activeTab,
      action: 'switchTab',
    },
    layout: { flex: 1 },
    children: [pageLayout(), pageDisplay(), buildPageInput(controls), buildPage3dUi(controls), buildPageEmoji(), buildPageNew(controls), buildShop(shop), buildPickHand(pick), buildPage3dButtons()],
  };
}

/** 模块体：按当前模块出对应样例。 */
function moduleBody(
  currentModule: string, shop: ShopState, pick: PickState, activeTab: string,
  controls: ControlsState, input: InputLabState, aishe: AisheState,
): LayoutNode {
  beginSections(currentModule); // 进模块即重置子编号计数（前缀=该模块主编号·顺序=显示顺序·稳定可复述）
  switch (currentModule) {
    case 'mod-ui': return buildUIModule(shop, pick, activeTab, controls);
    case 'mod-mmo': return buildMmoHud();
    case 'mod-casual': return buildCasualHud();
    case 'mod-dialogue': return buildDialogueScene();
    case 'mod-presence': return buildPresenceDemo();
    case 'mod-sound': return buildSoundPage(controls);
    case 'mod-input': return buildInputLab(input);
    case 'mod-video': return buildVideoLab(aishe);
    case 'mod-anim': return buildSimStage('anim', '✨', '精灵动画 · tween 驱动',
      '引擎 Canvas 渲染器实时绘制：4 个形状由 tween 能力（平移巡逻 / 呼吸缩放 / 匀速自转 / 淡入淡出）驱动，纯蓝图数据、无专属代码。',
      ['tween', 'transform', 'shape', 'color', 'CanvasRenderer']);
    case 'mod-ai': return buildSimStage('ai', '🧠', '游戏 AI · 索敌 + 寻路',
      '玩家居中（金圆），五个敌人挂 Perception（索敌 aggro：锁定最近玩家）+ GridMover（寻路 grid-move：hex A* 逐格逼近、到相邻停）。纯蓝图组合现成能力，无专属代码。',
      ['aggro', 'grid-move', 'hex A*', 'Perception']);
    case 'mod-3d': return buildSimStage('3d', '🧊', '3D 渲染 · Mesh3D',
      '引擎 ThreeRenderer 实时渲染：翻面卡 / 翻滚立方 / 倾转薄面，由 tween 转 Transform.rotation 当翻面角驱动。同一份 collectRenderables 换 three 后端即换维度。',
      ['Mesh3D', 'tween', 'ThreeRenderer']);
    case 'mod-3d-light': return buildSimStage('3dlight', '💡', '数据化光照 · Light3D',
      '光照是数据：一盏 Light3D 定向主光（castShadow 投影）+ 一盏环境补光，照亮盒阵 + 一只缓转金盒（转动时各面随光明暗）。配 Sky3D 程序天空 + Camera3D 轨道相机。全部纯组件数据，渲染器自动读。点下方调参台改档，实时看画面随数据变。',
      ['Light3D', 'Sky3D', 'Camera3D', 'Mesh3D'],
      tuneDeck('3dlight', [
        { key: 'l.sun', label: '主光强度', def: 'mid', opts: [{ v: 'low', label: '弱' }, { v: 'mid', label: '中' }, { v: 'high', label: '强' }] },
        { key: 'l.amb', label: '环境补光', def: 'mid', opts: [{ v: 'low', label: '暗' }, { v: 'mid', label: '中' }, { v: 'high', label: '亮' }] },
        { key: 'l.cam', label: '相机距离', def: 'mid', opts: [{ v: 'near', label: '近' }, { v: 'mid', label: '中' }, { v: 'far', label: '远' }] },
      ], controls));
    case 'mod-3d-post': return buildSimStage('3dpost', '🔭', '景深 · 泛光 · Post3D',
      '后处理是数据：一个 Post3D 启 EffectComposer——移轴景深（中段清晰、上下虚化=微缩盒庭感）+ bloom 泛光（亮处发光）。同场景换不换 Post3D = 换不换后处理，蓝图一字不改。',
      ['Post3D', 'tiltShift', 'bloom', 'Light3D'],
      tuneDeck('3dpost', [
        { key: 'ps.tilt', label: '虚化量', def: 'mid', opts: [{ v: 'soft', label: '弱' }, { v: 'mid', label: '中' }, { v: 'strong', label: '强' }] },
        { key: 'ps.bloom', label: '泛光强', def: 'mid', opts: [{ v: 'low', label: '弱' }, { v: 'mid', label: '中' }, { v: 'high', label: '强' }] },
        { key: 'ps.focus', label: '焦平面', def: 'mid', opts: [{ v: 'low', label: '下' }, { v: 'mid', label: '中' }, { v: 'high', label: '上' }] },
      ], controls));
    case 'mod-3d-nav': return buildSimStage('3dnav', '🧭', '3D 寻路 · navmesh 自动烘焙',
      '摆一张 NavMesh 罩草地，navmesh-bake 每帧把 Collider3D 障碍栅格化、可走处自动织成 NavGraph（零手摆航点）。两个 NavAgent 追兵沿图绕障逼近左右巡逻的目标盒；相机 follow 目标（Camera3D follow 模式）。青点/线=自动导航图、黄线=当前规划路径。',
      ['NavMesh', 'navmesh-bake', 'NavAgent', 'pathfind', 'Camera3D·follow'],
      tuneDeck('3dnav', [
        { key: 'nav.spd', label: '追速', def: 'mid', opts: [{ v: 'slow', label: '慢' }, { v: 'mid', label: '中' }, { v: 'fast', label: '快' }] },
        { key: 'nav.cell', label: '网格精度', def: 'mid', opts: [{ v: 'coarse', label: '粗' }, { v: 'mid', label: '中' }, { v: 'fine', label: '细' }] },
      ], controls));
    case 'mod-3d-collide': return buildSimStage('3dcollide', '🎯', '3D 碰撞 · Collider3D / Overlap3D',
      '两个盒（球碰撞体 / 盒碰撞体）来回穿过中央触发区，overlap-detect-3d 每帧解析判交、产 Overlap3D 事件（触发区只报不推）。线框=碰撞体（实心黄 / 触发绿），位置每帧跟随。',
      ['Collider3D', 'overlap-detect-3d', 'Overlap3D', 'trigger']);
    case 'mod-3d-particle': return buildSimStage('3dpart', '🎇', '3D 粒子（prefab）· prefab → Mesh3D',
      '2D 库B 套路搬到 3D：发射器 Timer→event-when→caster 周期引爆「爆炸环」prefab，一圈小盒火花放射（motion-apply）+ Timer 到期 lifetime 自毁，叠 Post3D bloom 发光。新特效=加一份 prefab 数据，ThreeRenderer 照渲。',
      ['caster', 'prefab', 'Mesh3D', 'lifetime', 'Post3D·bloom'],
      tuneDeck('3dpart', [
        { key: 'pa.speed', label: '喷速', def: 'mid', opts: [{ v: 'slow', label: '慢' }, { v: 'mid', label: '中' }, { v: 'fast', label: '快' }] },
        { key: 'pa.count', label: '火花数', def: 'mid', opts: [{ v: 'few', label: '少' }, { v: 'mid', label: '中' }, { v: 'many', label: '多' }] },
        { key: 'pa.bloom', label: '泛光', def: 'mid', opts: [{ v: 'low', label: '弱' }, { v: 'mid', label: '中' }, { v: 'high', label: '强' }] },
      ], controls));
    case 'mod-3d-vfx': return buildSimStage('3dvfx', '🌟', '3D 粒子（Vfx3D）· 数据驱动发射器',
      'TA「Niagara-lite」专门的粒子机：一个 Vfx3D 组件 = 一台发射器——锥形喷射 + 重力回落 + size/color over life 曲线/渐变 + 加色发光。三股金/玉/玫喷泉，render-only 不进 hash。比 prefab 那套更专业、参数即数据。',
      ['Vfx3D', 'cone', 'gravity', 'colorGradient', 'Post3D·bloom'],
      tuneDeck('3dvfx', [
        { key: 'vfx.rate', label: '喷量', def: 'mid', opts: [{ v: 'low', label: '疏' }, { v: 'mid', label: '中' }, { v: 'high', label: '密' }] },
        { key: 'vfx.grav', label: '重力', def: 'mid', opts: [{ v: 'low', label: '飘' }, { v: 'mid', label: '中' }, { v: 'high', label: '坠' }] },
        { key: 'vfx.spd', label: '初速', def: 'mid', opts: [{ v: 'low', label: '低' }, { v: 'mid', label: '中' }, { v: 'high', label: '高' }] },
      ], controls));
    case 'mod-3d-primitives': return buildSimStage('3dprim', '🔷', '圆润图元 · Mesh3D.shape',
      'box 之外的 6 种图元：plane 双面薄片 + sphere 正球 + cylinder 柱 + cone 锥 + capsule 胶囊 + torus 环（three 内建几何·单材质单色）。一排七件各自缓转、头顶名牌标形。参数口径：圆润件 width=直径、height=柱/锥高（球忽略）、torus tube=管半径比。',
      ['Mesh3D.shape', 'sphere/cylinder', 'cone/capsule/torus', 'tube'],
      tuneDeck('3dprim', [
        { key: 'prm.spin', label: '转速', def: 'mid', opts: [{ v: 'slow', label: '慢' }, { v: 'mid', label: '中' }, { v: 'fast', label: '快' }] },
        { key: 'prm.cam', label: '机位', def: 'mid', opts: [{ v: 'near', label: '近' }, { v: 'mid', label: '中' }, { v: 'far', label: '远' }] },
      ], controls));
    case 'mod-3d-text': return buildSimStage('3dtext', '🔤', '头顶 3D 文字 · WorldUI3D',
      '世界空间 UI（简写飘字）：每个盒挂一个 WorldUI3D.text（头顶名字/血量/状态），渲染器把实体锚点投影到屏幕、在该处用引擎 UI 库 mountUI 挂一棵 LayoutNode Label（UI 铁律·非手写 DOM）。相机转/物体动时标签跟着头顶飘。',
      ['WorldUI3D.text', 'mountUI', 'LayoutNode', '世界锚+投影']);
    case 'mod-3d-worldui': return buildSimStage('3dwui', '🪧', '世界空间面板 · WorldUI3D.node',
      '飘字进阶：WorldUI3D.node 挂**整棵 LayoutNode**——Boss/治疗/精英怪头顶各一块富名牌（Panel = Label 名字 + ProgressBar 血条/护盾/法力·raised 令牌面板·非手写 DOM），走引擎 UI 库 mountUI 渲染。治疗单位横向移动，名牌随单位每帧投影跟随（背相机/出屏自动隐）。',
      ['WorldUI3D.node', 'Panel+ProgressBar', 'mountUI', '锚世界物+跟随'],
      tuneDeck('3dwui', [
        { key: 'wui.cam', label: '机位', def: 'mid', opts: [{ v: 'near', label: '近' }, { v: 'mid', label: '中' }, { v: 'far', label: '远' }] },
      ], controls));
    case 'mod-3d-ao': return buildSimStage('3dao', '🌑', '环境光遮蔽 · Post3D.ao（GTAO）',
      '一个 Post3D.ao 启 GTAO 地面真值环境光遮蔽：紧挨的盒堆在接触缝隙/墙根处被压暗 → 厚重「接地」的盒庭玩具感（关泛光以凸显 AO）。intensity/radius/scale 全是数据。',
      ['Post3D.ao', 'GTAO', '接触压暗', '盒庭质感'],
      tuneDeck('3dao', [
        { key: 'ao.str', label: '遮蔽强', def: 'mid', opts: [{ v: 'low', label: '弱' }, { v: 'mid', label: '中' }, { v: 'high', label: '强' }] },
        { key: 'ao.rad', label: '遮蔽半径', def: 'mid', opts: [{ v: 'tight', label: '窄' }, { v: 'mid', label: '中' }, { v: 'wide', label: '宽' }] },
      ], controls));
    case 'mod-3d-material': return buildSimStage('3dmat', '🧱', 'PBR 材质预设 · Material3D + IBL',
      '材质是数据：一排盒各挂一个 Material3D 预设——金/钢/铜（IBL 环境反射出真金属光泽）、玻璃（透射折射）、木/岩（哑光）、自发光。Sky3D.env 开 IBL（中性影室环境贴图）金属才有反射可照。叠 Post3D 调色 + 抗锯齿。',
      ['Material3D', 'PBR', 'IBL·Sky3D.env', 'grade', 'aa'],
      tuneDeck('3dmat', [
        { key: 'mat.emit', label: '自发光', def: 'mid', opts: [{ v: 'low', label: '弱' }, { v: 'mid', label: '中' }, { v: 'high', label: '强' }] },
        { key: 'mat.expo', label: '曝光', def: 'mid', opts: [{ v: 'dim', label: '暗' }, { v: 'mid', label: '中' }, { v: 'bright', label: '亮' }] },
        { key: 'mat.sat', label: '饱和度', def: 'mid', opts: [{ v: 'low', label: '淡' }, { v: 'mid', label: '中' }, { v: 'high', label: '浓' }] },
      ], controls));
    case 'mod-3d-toon': return buildSimStage('3dtoon', '🖍', '卡通描边 · Material3D.shading:toon + outline',
      '超休闲平涂招牌观感：一排图元走分段卡通着色（MeshToonMaterial 阶梯明暗·toonSteps 控阶数）+ inverted-hull 描边（沿法线外扩的背面壳=一圈实色轮廓）。大亮色 + 黑描边 = 卡通感。零美术文件·纯数据选着色模型。',
      ['Material3D.shading:toon', 'outline', 'toonSteps', 'inverted-hull'],
      tuneDeck('3dtoon', [
        { key: 'tn.steps', label: '色阶数', def: 'mix', opts: [{ v: 'mix', label: '混' }, { v: '2', label: '2阶' }, { v: '3', label: '3阶' }, { v: '4', label: '4阶' }] },
        { key: 'tn.outline', label: '描边粗', def: 'mid', opts: [{ v: 'thin', label: '细' }, { v: 'mid', label: '中' }, { v: 'bold', label: '粗' }] },
      ], controls));
    case 'mod-3d-billboard': return buildSimStage('3dbb', '🪙', '世界广告牌 + 地面贴花 · Billboard3D / Decal3D',
      '休闲拾取物经典组合：一圈始终朝相机的发光金币（Billboard3D·add 混合·参与深度排序会被遮挡·区别于 WorldUI3D 永在最上）+ Anim3D bob 上下浮 + 脚下 Decal3D blob 软阴影（便宜接触阴影·零美术文件）。另有 ring/disc 贴花做目标标记环/落点 splat。',
      ['Billboard3D', 'Decal3D·blob/ring/disc', 'Anim3D·bob', '朝相机+深度排序'],
      tuneDeck('3dbb', [
        { key: 'bb.bob', label: '浮动幅', def: 'mid', opts: [{ v: 'low', label: '弱' }, { v: 'mid', label: '中' }, { v: 'high', label: '强' }] },
        { key: 'bb.shadow', label: '阴影浓', def: 'mid', opts: [{ v: 'faint', label: '淡' }, { v: 'mid', label: '中' }, { v: 'dark', label: '浓' }] },
        { key: 'bb.size', label: '币大小', def: 'mid', opts: [{ v: 'small', label: '小' }, { v: 'mid', label: '中' }, { v: 'large', label: '大' }] },
      ], controls));
    case 'mod-3d-path': return buildSimStage('3dpath', '🛤', '路径跟随 · Path3D',
      '沿一串控制点按壁钟匀速走（帧率无关无漂移·render-only 只写 Transform3D）：巡逻平台走矩形折线（linear·移动平台/传送带）、巡逻兵朝运动方向平滑绕行（smooth + faceDir）、金币沿高空平滑闭环绕飞。loop=loop/pingpong/none。与 Anim3D 正交（一个沿路径行进·一个绕初值振荡）。',
      ['Path3D', 'linear/smooth', 'faceDir', 'loop/pingpong'],
      tuneDeck('3dpath', [
        { key: 'pt.speed', label: '巡速', def: 'mid', opts: [{ v: 'slow', label: '慢' }, { v: 'mid', label: '中' }, { v: 'fast', label: '快' }] },
      ], controls));
    case 'mod-3d-spring': return buildSimStage('3dspring', '🟢', '弹簧动画 · Anim3D spring',
      '解析阻尼弹簧（欠阻尼带过冲回弹·spawn 弹入/吸附 juice）：进本页时一排盒子 scale 0→1 弹入 + 从高处 y 落定，各带不同 damping（0.12 弹久 → 0.55 硬）看回弹次数差。零缓动代码·只填 damping/freq/from/to。',
      ['Anim3D·spring', 'damping', '过冲回弹', 'spawn juice'],
      tuneDeck('3dspring', [
        { key: 'sp.freq', label: '弹频', def: 'mid', opts: [{ v: 'slow', label: '慢' }, { v: 'mid', label: '中' }, { v: 'fast', label: '快' }] },
      ], controls));
    case 'mod-3d-surface': return buildSimStage('3dsurf', '🪨', '程序化表面细节 · Material3D.surface',
      '零美术文件的表面质感：渲染器按数据生成 normal/roughness 贴图——凸点 bumps / 噪声 noise / 划痕 scratches 三种程序化图案 + 平铺/法线强度/粗糙起伏。最左是光面对照，右三块依次凹凸/磨砂/拉丝。同天空盒程序化纹理先例。',
      ['Material3D.surface', '程序化 normal/rough', 'bumps/noise/scratches'],
      tuneDeck('3dsurf', [
        { key: 'sf.normal', label: '凹凸强', def: 'mid', opts: [{ v: 'flat', label: '弱' }, { v: 'mid', label: '中' }, { v: 'deep', label: '强' }] },
        { key: 'sf.tiles', label: '密度', def: 'mid', opts: [{ v: 'coarse', label: '粗' }, { v: 'mid', label: '中' }, { v: 'fine', label: '细' }] },
      ], controls));
    case 'mod-3d-model': return buildSimStage('3dmodel', '🦆', 'glTF 模型导入 · Model3D',
      'box/plane 原语表达不了圆润模型 → 导入真 glTF：居中主鸭缓转 + 左右两只染色鸭（同模板多实例·共享几何各自染色）+ 一个盒模型。模型自带材质 + 受软影。蓝图只持 modelKey（保纯·可哈希），ModelAssetLoader 取字节、ThreeRenderer 解析、未就绪本帧不画。',
      ['Model3D', 'glTF 导入', 'AssetManager', '多实例 clone'],
      tuneDeck('3dmodel', [
        { key: 'mdl.spin', label: '转速', def: 'mid', opts: [{ v: 'slow', label: '慢' }, { v: 'mid', label: '中' }, { v: 'fast', label: '快' }] },
        { key: 'mdl.cam', label: '机位', def: 'mid', opts: [{ v: 'near', label: '近' }, { v: 'mid', label: '中' }, { v: 'far', label: '远' }] },
      ], controls));
    case 'mod-3d-fog': return buildSimStage('3dfog', '🌫', '距离雾 · Fog3D',
      '一个 Fog3D（雾色取天际·near 清晰 far 全雾）：两列尖塔夹道向远处退去、渐隐入雾——盒庭「装在玻璃盒里」的纵深感。天空盒不受雾影响。color/near/far 三个数。点调参台改雾浓度看纵深随数据变。',
      ['Fog3D', '距离雾', '纵深', 'scene.fog'],
      tuneDeck('3dfog', [
        { key: 'f.den', label: '雾浓度', def: 'mid', opts: [{ v: 'thin', label: '薄' }, { v: 'mid', label: '中' }, { v: 'thick', label: '浓' }] },
        { key: 'f.near', label: '雾起点', def: 'mid', opts: [{ v: 'far', label: '远' }, { v: 'mid', label: '中' }, { v: 'near', label: '近' }] },
      ], controls));
    case 'mod-3d-pointlight': return buildSimStage('3dpl', '🔦', '点光源 / 聚光灯 · Light3D point·spot',
      'TA Phase 2 动态局部光：暗场里一盏移动暖点光（挂 Transform3D·tween 横扫白盒阵）+ 一盏冷聚光锥（从高处朝下·有锥角/半影）。点光随实体走、按 range/decay 衰减；叠 bloom 让光源发光。',
      ['Light3D·point', 'Light3D·spot', 'range/decay', '可移动'],
      tuneDeck('3dpl', [
        { key: 'pl.warm', label: '点光强', def: 'mid', opts: [{ v: 'dim', label: '弱' }, { v: 'mid', label: '中' }, { v: 'bright', label: '强' }] },
        { key: 'pl.spot', label: '聚光强', def: 'mid', opts: [{ v: 'dim', label: '弱' }, { v: 'mid', label: '中' }, { v: 'bright', label: '强' }] },
        { key: 'pl.angle', label: '锥角', def: 'mid', opts: [{ v: 'tight', label: '窄' }, { v: 'mid', label: '中' }, { v: 'wide', label: '宽' }] },
      ], controls));
    case 'mod-physics': return buildSimStage('phys', '🟢', '运动与碰撞',
      'motion-apply（Velocity→Transform 运动学）+ overlap-detect（碰撞检测）+ collision-resolve（按质量推开=碰撞响应）。四物体相向运动、于中心相撞被推开。纯蓝图，无专属代码。',
      ['motion-apply', 'overlap-detect', 'collision-resolve']);
    case 'mod-combat': return buildSimStage('combat', '⚔️', '战斗结算',
      '弹道（Sensor+Hitbox）飞行命中敌人 → trigger-zone → hitbox 扣血 / 挂灼烧 DoT → mortal 判死 → destroy 移除。整条战斗链全是现成能力组合，零游戏代码。',
      ['hitbox', 'trigger-zone', 'over-time', 'mortal']);
    case 'mod-spawn': return buildSimStage('spawn', '🎆', '生成与寿命',
      '发射器 Timer→event-when→caster 周期性从 PrefabLibrary 模板生成粒子，粒子带 Velocity 飞 + Tween 淡出 + Timer 到期 → lifetime 自毁。生成与销毁全数据驱动。',
      ['caster', 'prefab', 'event-when', 'lifetime']);
    case 'mod-fx': return buildSimStage('fx', '💥', '战场特效（库B·挂在画面上）',
      '特效架构「库 B」：世界里生成的特效实体。定时引爆「爆炸环」prefab——caster 一次展开整圈放射火花 + 冲击核（飞 + 淡出 + Timer 到期 lifetime 自毁）。与「库 A·UI 特效（layout.fx）」正交、可叠加。新特效 = 加一份 prefab 数据，零新 system。',
      ['caster', 'prefab', 'tween', 'lifetime']);
    case 'mod-fsm': return buildSimStage('fsm', '🔀', '状态机 / 行为',
      '自由计时器驱动 condition→signal→effect：idle→alert→flee→循环。状态转移（set-state）+ 指示块切换（set-visible）三段全是数据，非代码。',
      ['state', 'event-when', 'effect-apply']);
    default: return buildHub();
  }
}

/**
 * 整棵展示台 = 顶栏 + （落地积木墙 Hub｜某模块子菜单）。currentModule=null → Hub；否则进该模块。
 * modalOpen / drawerOpen = UI 模块里叠加演示用模态/抽屉（宿主状态驱动·开关都是数据/信号）。
 * 整棵树是纯数据：换主题只是换令牌包重挂，这份数据一字不改。
 */
export function buildGallery(
  activeTheme: string, currentModule: string | null = null, modalOpen = false, drawerOpen = false,
  shop: ShopState = INITIAL_SHOP, pick: PickState = INITIAL_PICK, activeTab = 'tab-layout',
  controls: ControlsState = INITIAL_CONTROLS, input: InputLabState = INITIAL_INPUT,
  aishe: AisheState = INITIAL_AISHE,
): LayoutNode {
  const mod = currentModule ? MODULES.find((m) => m.id === currentModule) : undefined;
  const title = mod ? `${mod.glyph} ${mod.label}` : 'Game I · 底座能力展示台';
  return {
    type: 'Screen',
    id: 'gameui-root',
    props: { center: false },
    layout: { direction: 'column', padding: 0 },
    children: [
      // 顶栏：（返回展台·进模块时）+ 标题 + 换皮下拉
      {
        type: 'Panel',
        id: 'topbar',
        props: {},
        layout: { direction: 'row', gap: 12, align: 'center', padding: 16 },
        children: [
          ...(currentModule ? [{ type: 'Button', id: 'hub-back', props: { label: '← 展台', kind: 'ghost', action: 'exitModule' } } as LayoutNode] : []),
          { type: 'Label', id: 'app-title', props: { text: title, size: 'lg', bold: true }, layout: { flex: 1 } },
          { type: 'Badge', id: 'app-engine', props: { text: 'ZeroCraft Preview · 数据驱动 UI', tone: 'dim' } },
          { type: 'Label', id: 'theme-lbl', props: { text: '换皮', size: 'sm', color: 'sub' } },
          {
            type: 'Dropdown',
            id: 'theme-pick',
            props: { options: THEME_OPTIONS, value: activeTheme, action: 'setTheme' },
          },
        ],
      },
      { type: 'Divider', id: 'top-div', props: {} },
      // 落地积木墙 或 某模块子菜单
      currentModule ? moduleBody(currentModule, shop, pick, activeTab, controls, input, aishe) : buildHub(),
      // 模态浮层 / 抽屉按需叠加（满屏遮罩·盖在主界面之上）
      ...(modalOpen ? [modalOverlay] : []),
      ...(drawerOpen ? [drawerOverlay] : []),
    ],
  };
}