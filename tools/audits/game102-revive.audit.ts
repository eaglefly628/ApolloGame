// 审计入口：game102《色流工坊》④ 失败/续命屏（Modal offer·复活/续命/放弃 三键·pixelPour 皮）。
// 用法：node tools/ui-audit.mjs tools/audits/game102-revive.audit.ts --w 390 --h 844
import { mountUI } from '../../src/ui/components/index.js';
import { buildRevive, pixelPour } from '../../games/game102/index.js';

mountUI(
  document.getElementById('root')!,
  buildRevive({ hint: '还差 1 块就点亮宝箱门', price: '$6.99', ammo: 3, revived: false }),
  {},
  pixelPour,
);
