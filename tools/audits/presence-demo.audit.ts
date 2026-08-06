// 审计入口：game-i「剧情·伴侣在场件」屏（apollo-toon）。
import { mountUI } from '../../src/ui/components/index.js';
import { buildPresenceDemo } from '../../games/game-i/presence-demo.js';
import { apolloToon } from '../../src/ui/apollo-toon-theme.js';
mountUI(document.getElementById('root')!, buildPresenceDemo(), {}, apolloToon);
