import { mountUI, resolveBindings, type LayoutNode } from '../../src/ui/components/index.js';
import { STAR_TAIL_THEME } from '../../games/game112/ui-theme.js';
import { HallSession } from '../../games/game112/session.js';
import { buildScene } from '../../games/game112/ui.js';
import { setSkinOverrides } from '../../games/game112/cat-art.js';
import { flagOn } from '../../games/game112/project.js';

setSkinOverrides({
  'game112/scene/hall': '/games/game112/art/scene/star-tail-main-hall-bg-v2.png',
  'game112/cat/xuetuan-rest': '/games/game112/art/cat/xuetuan-rest-v1.png',
  'game112/cat/xuetuan-notice': '/games/game112/art/cat/xuetuan-notice-v1.png',
  'game112/cat/xuetuan-walk': '/games/game112/art/cat/xuetuan-walk-right-v2.png',
  'game112/cat/xuetuan-walk-left': '/games/game112/art/cat/xuetuan-walk-left-v2.png',
  'game112/cat/xuetuan-turn': '/games/game112/art/cat/xuetuan-turn-v2.png',
});

/** Same pre-render world Flag projection as the real Game112 host, not a raw builder tree. */
export function buildGame112SceneAudit(session = new HallSession(112)): LayoutNode {
  return resolveBindings(buildScene(session.hall(), 'hall'), { flag: id => flagOn(session.world, id) });
}

mountUI(
  document.getElementById('root')!,
  buildGame112SceneAudit(),
  {},
  STAR_TAIL_THEME,
);
