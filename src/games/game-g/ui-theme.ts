import type { UITheme } from '@ui/components/types.js';

// game-g 古风 UI 主题（玄铁·暗）：暖墨底 + 羊皮纸字 + 淡金点睛。
// 喂引擎 components 的 renderNode/mountUI 即「换皮」——同一份 LayoutNode 数据、零改解释器。
// 这就是「数据驱动 UI·主题作数据」的 game-g 那份令牌：最弱 LLM 也只是填颜色/字体字符串，不写 CSS/DOM。
// （注：引擎 components 只表达**配色/字体**；大厅的绿呢牌桌/漂浮对决卡等 bespoke 结构视觉不在主题范畴。）
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
  fontUi: '"Noto Serif SC","Songti SC","Source Han Serif SC",serif',
  fontMono: 'ui-monospace,"SF Mono",Menlo,Consolas,monospace',
};
