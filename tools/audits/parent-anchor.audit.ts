import { mountUI, apolloOnyx } from '../../src/ui/components/index.js';
import { buildParentAnchorDemo } from '../../games/game-i/parent-anchor-demo.js';
mountUI(document.getElementById('root')!, { type: 'Panel', id: 'anchor-audit-frame', props: {}, layout: { padding: 16 }, children: [buildParentAnchorDemo()] }, {}, apolloOnyx, undefined, { debugAnchors: true });
