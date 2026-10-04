import { mountUI } from '../../src/ui/components/index.js';
import { STAR_TAIL_THEME } from '../../games/game112/ui-theme.js';
import { HallSession } from '../../games/game112/session.js';
import { buildScreen } from '../../games/game112/ui.js';
import { setSkinOverrides } from '../../games/game112/cat-art.js';

setSkinOverrides({
  'game112/scene/hall': '/games/game112/art/scene/star-tail-main-hall-bg-v2.png',
  'game112/cat/xuetuan-rest': '/games/game112/art/cat/xuetuan-rest-v1.png',
});

mountUI(document.getElementById('root')!, buildScreen({ screen: 'catalog', view: new HallSession(112).hall(), room: 'hall' }), {}, STAR_TAIL_THEME);
