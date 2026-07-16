import { mountUI } from '../../src/ui/components/index.js';
import { buildGallery } from '../../src/games/game-i/gallery.js';
import { THEMES } from '../../src/games/game-i/themes.js';
// apollo-toon 下「🧊 3D UI」子 tab（press3d 糖果厚按钮 + 组合演示）走查。
mountUI(document.getElementById('root')!, buildGallery('apollo-toon', 'mod-ui', false, false, 'tab-3dui'), {}, THEMES['apollo-toon']!);
