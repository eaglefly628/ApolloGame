// 审计入口：game-i「剧情·VN 对话三件」屏（portrait + dialog + choiceList·apollo-toon 糖果水墨皮）。
// 用法：node tools/ui-audit.mjs tools/audits/dialogue-demo.audit.ts --w 500 --h 760
import { mountUI } from '../../src/ui/components/index.js';
import { buildDialogueScene } from '../../games/game-i/dialogue-demo.js';
import { apolloToon } from '../../src/ui/apollo-toon-theme.js';
mountUI(document.getElementById('root')!, buildDialogueScene(), {}, apolloToon);
