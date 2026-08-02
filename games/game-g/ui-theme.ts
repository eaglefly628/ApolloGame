import type { UITheme } from '@zerocraft/engine/ui/components/types.js';
import { textureOverrideUri } from './art-textures.js';

// 主题级按钮皮（批29 owner 07-15「按键也可换」）：台账 game-g/ui/btn-* 三行 → 引擎 UITheme.buttonSkins，
// 一个 kind 一张皮、全游戏 35+ 按钮零逐点改。**getter 每次渲染求值**——真图后台载好、大厅重绘即换上；
// 无覆盖 = undefined = 原 kind 底（观感零变·帧回归绿）。slice=10 与台账 spec 同契约（边饰须在源图外缘 10px 内）。
function ggButtonSkins(): UITheme['buttonSkins'] {
  const hero = textureOverrideUri('game-g/ui/btn-hero');
  const primary = textureOverrideUri('game-g/ui/btn-primary');
  const ghost = textureOverrideUri('game-g/ui/btn-ghost');
  if (!hero && !primary && !ghost) return undefined;
  return {
    ...(hero ? { hero: { skin: hero } } : {}),               // 大 CTA 横幅=整图 cover（含倒角装饰·配 clip-path）
    ...(primary ? { primary: { skin: primary, skinSlice: 10 } } : {}), // 小按钮=9-slice 任意尺寸不变形
    ...(ghost ? { ghost: { skin: ghost, skinSlice: 10 } } : {}),
  };
}

// game-g 古风 UI 主题（玄铁·暗）：暖墨底 + 羊皮纸字 + 淡金点睛。
// 喂引擎 components 的 renderNode/mountUI 即「换皮」——同一份 LayoutNode 数据、零改解释器。
// 这就是「数据驱动 UI·主题作数据」的 game-g 那份令牌：最弱 LLM 也只是填颜色/字体字符串，不写 CSS/DOM。
// （注：引擎 components 只表达**配色/字体**；大厅的绿呢牌桌/漂浮对决卡等 bespoke 结构视觉不在主题范畴。）
// ① 独立浮层皮（自包含 hex）：用于 **脱离大厅 .ggl-root** 的全屏浮层(挂 document.body)——
//    如战斗内「返回大厅？」确认框。此处大厅 CSS 变量不在作用域，必须给死值。
export const GG_THEME_ONYX: UITheme = {
  bg0: '#0c0a07', bg1: '#171109', bg2: '#1f1810', bg3: '#281f15',
  pageBg: 'linear-gradient(180deg,#0c0a07 0%,#171109 100%)',
  line: 'rgba(212,189,138,0.16)',
  text: '#ece1cb', sub: '#bda984', dim: '#7c6e54',
  jade: '#e3c275', jadeWash: 'rgba(227,194,117,0.12)', jadeLine: 'rgba(227,194,117,0.42)', // 古风以淡金作主点缀（替青瓷）
  gold: '#f1d792',
  ok: '#94c08a', okWash: 'rgba(148,192,138,0.14)',
  warn: '#dcbb79', warnWash: 'rgba(220,187,121,0.14)',
  danger: '#d3897a',
  fontUi: "'Noto Serif SC','Songti SC','Source Han Serif SC',serif",
  fontMono: "ui-monospace,'SF Mono',Menlo,Consolas,monospace",
  get buttonSkins() { return ggButtonSkins(); }, // 渲染时求值（真图到位即换·无=原底）
};

// ② 大厅内嵌皮（桥接 CSS 变量）：用于**嵌在大厅 .ggl-root 内**的引擎组件(天梯榜/榜单/数值表…)。
//    令牌不写死值、而是引用大厅自己的设计令牌(var(--ink)/--panel/--gold…) → 引擎渲染的片段
//    **自动随皮(玄铁/锦霞)走**、与四周大厅零视觉割裂。这就是「引擎组件嵌入 CSS 变量宿主」的通用桥：
//    最弱 LLM 也只是把令牌填成 'var(--panel)' 这种字符串，照样不写 CSS/DOM。
export const GG_LOBBY_THEME: UITheme = {
  bg0: 'var(--track)', bg1: 'var(--panel)', bg2: 'var(--chip)', bg3: 'var(--chip)',
  pageBg: 'var(--paper)',
  line: 'var(--panel-border)',
  text: 'var(--ink)', sub: 'var(--ink-dim)', dim: 'var(--ink-dim)',
  jade: 'var(--gold)', jadeWash: 'rgba(232,205,138,0.14)', jadeLine: 'var(--hairline)',
  gold: 'var(--gold)',
  ok: 'var(--club)', okWash: 'rgba(63,174,110,0.14)',
  warn: 'var(--gold)', warnWash: 'rgba(232,205,138,0.14)',
  danger: 'var(--heart)',
  fontUi: 'var(--fb)',
  fontMono: 'var(--fn)',
  // 字体艺术槽（owner 2026-06-28「主页要正楷+艺术字」）：display=毛笔书法艺术字(--fd·玄铁 智芒星行书/锦霞 马善政楷书)·
  // pixel=Silkscreen 像素体(--fn)。已自托管加载(fonts.ts)，先前未接入主题槽→Label font:'display' 误回退像素体；此处补全。
  fontDisplay: 'var(--fd)',
  fontPixel: 'var(--fn)',
  get buttonSkins() { return ggButtonSkins(); }, // 渲染时求值（真图到位即换·无=原底）
};

// ③ 战斗屏内嵌皮：同 ②（桥接战斗 .ggt-inner 的 THEMES 令牌 var(--ink)/--panel/--gold…），
//    仅覆 bg0 = 金底上的深字色（hero CTA「结束回合」文字走 t.bg0；战斗 --track 是半透明、做字色对比不足，
//    改回原版 endSquare 的深褐 #2a1a08·两皮通用）。topbar/动作菜单不碰 bg0（用 text/gold/jade）→ 不受影响。
//    danger/ok 改桥到战斗自有的 var(--danger)/var(--hp)（GG_LOBBY_THEME 桥的 var(--heart)/var(--club) 在战斗 THEMES
//    令牌集里未定义 → 红/绿失效；战斗 THEMES 自带 --danger(#ff5d62 血灯红)/--hp(#46d17a)，正是棋枰要的色·两皮各自有值）。
// mine/foe = 阵营描边色（Panel.edge='mine'/'foe'·棋枰城堡/格/兵牌阵营框·REQ-UI-容器描边形）：我方暖橙 / 敌方冷蓝（两皮通用·逐字搬战斗原版 #ff7a45/#3a86d4）。
// ⚠ spread 会把 GG_LOBBY_THEME 的 buttonSkins getter **立即求值成死值**（模块加载时=undefined）——必须自带 getter 盖回。
export const GG_BATTLE_THEME: UITheme = { ...GG_LOBBY_THEME, bg0: '#2a1a08', danger: 'var(--danger)', ok: 'var(--hp)', mine: '#dc2626', foe: '#1a1a1a', get buttonSkins() { return ggButtonSkins(); } };
