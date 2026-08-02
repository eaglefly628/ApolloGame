// 审计入口：game-t《墨消》结算浮层（胜·三星+收笔明细+confetti·apollo-toon 皮）。
// 用法：node tools/ui-audit.mjs tools/audits/game-t-result.audit.ts --w 440 --h 780
// Particles=铺满父容器的装饰发射层（render-only 意图叠层）→ 标 data-allow-overlap。
import { mountUI } from '../../src/ui/components/index.js';
import { buildResultOverlay, type HudState } from '../../games/game-t/hud.js';
import { apolloToon } from '../../src/ui/apollo-toon-theme.js';

const s: HudState = {
  levelNo: 1,
  levelName: '初磨',
  moves: 6,
  score: 4800,
  goals: [{ label: '得分', cur: 4800, need: 3600 }],
  status: 'win',
  stars: 2,
  brush: 6000,
  finalScore: 10800,
  selIndex: -1,
  cols: 7,
  muted: false,
  hasNext: true,
};
mountUI(document.getElementById('root')!, buildResultOverlay(s), {}, apolloToon);
document.getElementById('t-confetti')?.setAttribute('data-allow-overlap', '1');
