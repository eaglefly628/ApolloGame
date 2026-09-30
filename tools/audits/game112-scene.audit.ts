import { mountUI } from '../../src/ui/components/index.js';
import { apolloBrocade } from '../../src/ui/components/apollo-kit.js';
import { HallSession } from '../../games/game112/session.js';
import { buildScene } from '../../games/game112/ui.js';
import { setSkinOverrides } from '../../games/game112/cat-art.js';

setSkinOverrides({
  'game112/scene/hall': '/games/game112/art/scene/star-tail-main-hall-bg-v2.png',
  'game112/cat/xuetuan-rest': '/games/game112/art/cat/xuetuan-rest-v1.png',
  'game112/cat/xuetuan-notice': '/games/game112/art/cat/xuetuan-notice-v1.png',
  'game112/cat/xuetuan-walk': '/games/game112/art/cat/xuetuan-walk-right-v2.png',
  'game112/cat/xuetuan-walk-left': '/games/game112/art/cat/xuetuan-walk-left-v2.png',
  'game112/cat/xuetuan-turn': '/games/game112/art/cat/xuetuan-turn-v2.png',
});

mountUI(
  document.getElementById('root')!,
  buildScene(new HallSession(112).hall(), 'hall'),
  {},
  apolloBrocade,
);
