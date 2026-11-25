import { daylight } from '../../games/game-i/themes.js';
import { apolloOnyx, mountUI, type LayoutNode } from '../../src/ui/components/index.js';
import { projectSceneUi } from './scene-ui.js';
import studio from './public/scenes/avatar-studio.json';

const flags = new Map(Object.keys(studio.uiConditions).map(id => [id, id === 'avatar.build.1' || (!id.startsWith('avatar.build.') && id.endsWith('.0'))]));
const theme = innerWidth < 500 ? daylight : apolloOnyx;
mountUI(document.getElementById('root')!, projectSceneUi(studio.layout as LayoutNode, flags), {}, theme);
