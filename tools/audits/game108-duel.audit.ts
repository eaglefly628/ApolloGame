// 审计入口：game108《拳律》对局屏（S3 骨架关·ui-playbook §⑤ 交付前仪式）。
// 用法：node tools/ui-audit.mjs tools/audits/game108-duel.audit.ts --w 456 --h 788
// 量的是**蓄力中的一屏**（有蓄力级数 + 已亮手），比空屏更能暴露重叠/对比度问题。
//
// 【本轮审计真修的】ProgressBar `showValue` 在暗色主题下实测 2.93（8 处）——基座把它渲成
//   `t.dim` 11px（render.ts:596），casual-hud 同写法能过只因它底是亮糖色 #ffe8c8。蓄力级数与血量是
//   本作核心可读信息（【R-108-03】"常驻·零操作可读"），故**不开 showValue**、改自出高对比 Label。
//   这是真读不清，不是工具盲区。
//
// 【已知假阳·6 处 ratio=1.12】hero 键（`✊ 石` / 副标 `蓄 2 · 30`）——**非本游戏可修**，同 game-c/game-a 先例：
//   实证：render.ts:288 hero = `background:linear-gradient(180deg,t.gold,t.warn)` + `color:t.bg0`（近黑字）。
//   近黑字压金渐变=真实对比极高（真渲染截图 public/games/game108/probe/S3-render.png 目击可读）。
//   而 ui-audit 的 `solidBgUp`（tools/ui-audit.mjs:102）遇渐变（无 backgroundColor）就**向上跳过**，
//   一路落到兜底 `[6,8,13]` 近黑页底 → 近黑字 vs 近黑底 = 1.12。
//   → 已报 PUI（见 docs/design/game108/requests.md）。建议解法：`solidBgUp` 在 backgroundImage 是
//     linear-gradient 时取其首个色标当实底，而不是跳过——比给每个 hero 键手标 skip 更根治。
import { mountUI } from '../../src/ui/components/index.js';
import { buildDuelScreen, emptyView } from '../../games/game108/duel-screen.js';
import { DUEL_THEME } from '../../games/game108/theme.js';

const view = emptyView();
view.charge.p1.rock = 2;
view.charge.p1.scissors = 3;   // 满蓄 → 键面副标走「满蓄 · 40」那支
view.charge.p2.paper = 1;
view.hp.p2 = 70;
view.phase = 'clash';
view.shown = { p1: 'rock', p2: 'scissors' };
view.tell = '他盯着你的石头看了很久';

mountUI(document.getElementById('root')!, buildDuelScreen(view), {}, DUEL_THEME);
