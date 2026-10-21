import { mountUI } from '../../src/ui/components/index.js';
import { buildParentAnchorDemo } from '../../games/game-i/parent-anchor-demo.js';
import { daylight } from '../../games/game-i/themes.js';
mountUI(document.getElementById('root')!, { type: 'Panel', id: 'anchor-audit-frame', props: {}, layout: { padding: 16 }, children: [buildParentAnchorDemo()] }, {}, daylight, undefined, { debugAnchors: true });
