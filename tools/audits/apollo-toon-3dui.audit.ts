import { mountUI } from '../../src/ui/components/index.js';
import { buildGallery } from '../../games/game-i/gallery.js';
import { THEMES } from '../../games/game-i/themes.js';
// apollo-toon 下「🧊 3D UI」子 tab（press3d 糖果厚按钮 + 组合演示）走查。
// activeTab 是第 7 参（第 5/6 是 shop/pick 状态·走缺省）——此前把 tab 传进 shop 槽 → mount 即抛 → 空页空审计（假绿）。
mountUI(document.getElementById('root')!, buildGallery('apollo-toon', 'mod-ui', false, false, undefined, undefined, 'tab-3dui'), {}, THEMES['apollo-toon']!);
