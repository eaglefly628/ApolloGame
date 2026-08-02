// 文本 emoji 自动图渲（REQ-UI-emoji图渲）照妖镜：daylight 皮 + 开 theme.emoji → 独立「🎨 emoji 美术」tab
// 的 t-emoji 段 emoji 字形应内联成 <img>（1em 随字号）。验重叠/对比在图渲后仍归零（img 盒替字形不撑破布局）。
import { mountUI } from '../../src/ui/components/index.js';
import { buildGallery } from '../../games/game-i/gallery.js';
import { THEMES } from '../../games/game-i/themes.js';
const theme = { ...THEMES['daylight']!, emoji: { base: '/games/game-i/art/emoji' } };
mountUI(document.getElementById('root')!, buildGallery('daylight', 'mod-ui', false, false, 'tab-emoji'), {}, theme);
