// 审计入口：game-t《墨消》关内 HUD（顶=目标/步数 · 底=道具条/提示·纯 LayoutNode·apollo-toon 皮）。
// 用法：node tools/ui-audit.mjs tools/audits/game-t-hud.audit.ts --w 440 --h 780
// 态选「吃紧」组合：步数告急(danger) + 已选格提示(jade) + 目标一成一欠 → 覆盖最紧配色。
import { mountUI } from '../../src/ui/components/index.js';
import type { LayoutNode } from '../../src/ui/components/index.js';
import { buildTopBar, buildBottomBar, type HudState } from '../../games/game-t/hud.js';
import { apolloToon } from '../../src/ui/apollo-toon-theme.js';

const s: HudState = {
  levelNo: 4,
  levelName: '冰纹',
  moves: 3,
  score: 8200,
  goals: [
    { label: '破瓷', cur: 12, need: 12 },
    { label: '得分', cur: 8200, need: 16000 },
  ],
  status: 'playing',
  stars: 0,
  brush: 0,
  finalScore: 8200,
  selIndex: 24,
  cols: 7,
  muted: true,
  hasNext: true,
};
const page: LayoutNode = {
  type: 'Screen',
  id: 't-hud-audit',
  props: {},
  layout: { direction: 'column', justify: 'between', padding: 0 },
  children: [buildTopBar(s), buildBottomBar(s)],
};
mountUI(document.getElementById('root')!, page, {}, apolloToon);
