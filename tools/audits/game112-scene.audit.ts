import { mountUI } from '../../src/ui/components/index.js';
import { apolloBrocade } from '../../src/ui/components/apollo-kit.js';
import { HallSession } from '../../games/game112/session.js';
import { buildScene } from '../../games/game112/ui.js';
import { setSkinOverrides } from '../../games/game112/cat-art.js';

setSkinOverrides({
  'game112/scene/hall': '/games/game112/art/scene/star-tail-main-hall-bg-v2.png',
});

mountUI(
  document.getElementById('root')!,
  buildScene(new HallSession(112).hall(), 'hall'),
  {},
  apolloBrocade,
);
