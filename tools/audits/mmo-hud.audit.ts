// 审计入口示例：MMO HUD（最复杂组合页）。
// 用法：node tools/ui-audit.mjs tools/audits/mmo-hud.audit.ts
// 约定：把要审计的 LayoutNode 树 mount 到 #root（与 ui-audit.mjs 默认 --mount root 对齐）。
import { mountUI } from '../../src/ui/components/index.js';
import { buildGallery } from '../../games/game-i/gallery.js';
import { THEMES } from '../../games/game-i/themes.js';

mountUI(document.getElementById('root')!, buildGallery('onyx', 'mod-mmo'), {}, THEMES['onyx']!);
