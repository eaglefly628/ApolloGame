import { mountUI } from '../../src/ui/components/index.js';
import { apolloBrocade } from '../../src/ui/components/apollo-kit.js';
import { buildMap } from '../../games/game112/ui.js';
import { setSkinOverrides } from '../../games/game112/cat-art.js';

setSkinOverrides({
  'game112/map/hall': '/games/game112/art/ai/openai-imagegen/00-star-tail-house-cutaway-v2.png',
});

mountUI(
  document.getElementById('root')!,
  buildMap('hall'),
  {},
  apolloBrocade,
);
