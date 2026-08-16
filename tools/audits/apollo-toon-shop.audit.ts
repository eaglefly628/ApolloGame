import { mountUI } from '../../src/ui/components/index.js';
import { buildGallery } from '../../games/game-i/gallery.js';
import { THEMES } from '../../games/game-i/themes.js';
// apollo-toon 下组合演示·商店 tab 走查（卡片/按钮/价签在新皮下的对比度）。
// activeTab 是第 7 参（第 5/6 是 shop/pick 状态·走缺省）——此前把 tab 传进 shop 槽 → mount 即抛 → 空页空审计（假绿）。
mountUI(document.getElementById('root')!, buildGallery('apollo-toon', 'mod-ui', false, false, undefined, undefined, 'tab-shop'), {}, THEMES['apollo-toon']!);
