import { mountUI } from '../../src/ui/components/index.js';
import { buildGallery } from '../../games/game-i/gallery.js';
import { THEMES } from '../../games/game-i/themes.js';
// apollo-toon「水墨玩趣」下 UI 控件主 tab（LAYOUT/控件）走查：亮皮糖果皮 + 纸纹面的重叠/对比度照妖镜。
// 显式 activeTab（同 daylight 系列 audit 方法）——每 tab 单独走查，避免「无 activeTab 全 tabpage 同时可见」的非真状态。
// activeTab 是第 7 参（第 5/6 是 shop/pick 状态·走缺省）——此前把 tab 传进 shop 槽 → mount 即抛 → 空页空审计（假绿）。
mountUI(document.getElementById('root')!, buildGallery('apollo-toon', 'mod-ui', false, false, undefined, undefined, 'tab-layout'), {}, THEMES['apollo-toon']!);
