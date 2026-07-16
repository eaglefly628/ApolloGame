import { mountUI } from '../../src/ui/components/index.js';
import { buildGallery } from '../../src/games/game-i/gallery.js';
import { THEMES } from '../../src/games/game-i/themes.js';
// apollo-toon 下组合演示·商店 tab 走查（卡片/按钮/价签在新皮下的对比度）。
mountUI(document.getElementById('root')!, buildGallery('apollo-toon', 'mod-ui', false, false, 'tab-shop'), {}, THEMES['apollo-toon']!);
