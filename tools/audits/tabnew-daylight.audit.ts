import { mountUI } from '../../src/ui/components/index.js';
import { buildGallery } from '../../games/game-i/gallery.js';
import { THEMES } from '../../games/game-i/themes.js';
mountUI(document.getElementById('root')!, buildGallery('daylight', 'mod-ui', false, false, 'tab-new'), {}, THEMES['daylight']!);
