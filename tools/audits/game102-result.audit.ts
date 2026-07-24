// 审计入口：game102《色流工坊》② 结算屏（通关·星级 Rating + 钥匙 Badge + 得分 + confetti·pixelPour 皮）。
// 用法：node tools/ui-audit.mjs tools/audits/game102-result.audit.ts --w 390 --h 844
import { mountUI } from '../../src/ui/components/index.js';
import { buildResult, KEYS_TOTAL, pixelPour } from '../../src/games/game102/index.js';

mountUI(
  document.getElementById('root')!,
  buildResult({ levelNo: 7, stars: 2, keys: KEYS_TOTAL, keysTotal: KEYS_TOTAL, score: 12340, hasNext: true }),
  {},
  pixelPour,
);
