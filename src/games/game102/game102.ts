// Game 102 · Pixel Pour —— 卡带宿主层（工程师写的 mount/host·契约明许·零玩法逻辑）。
//
// 职责（全在 sim 外·render-only）：建 Engine + CanvasRenderer，把 play-field 画进沙盒画布；响应式缩放；cleanup。
// 玩法规则一律在 blueprint.ts 的数据 + 引擎能力里（Lead 裁①·零游戏层 system 代码）。
// S3 骨架关：先把「像素画棋盘 + 传送带位 + 待命槽 + 补给区」的实体阵画出来（Shape+Color 由 CanvasRenderer 投影）；
// 交互/HUD（LayoutNode 四屏 = PUI·REQ-G102-UI）与玩法链（event-when/launch = S4）后续接入。
import { Engine } from '../../runtime/engine.js';
import { CanvasRenderer } from '@renderer/index.js';
import { mountHost } from '@engine/host/mount-host.js';
import { buildBlueprint } from './blueprint.js';
import { LEVEL_1 } from './levels.js';
import { FIELD_W, FIELD_H } from './theme.js';

// 沙盒背景：柔和海洋渐变（呼应「鲸」关·卡通像素工坊风·真皮走 S6 美术台账）。
const FIELD_BG =
  'radial-gradient(circle at 50% 30%, #12335c 0%, #0a2038 62%, #06121f 100%)';

export function mount(container: HTMLElement, _host?: { exit: () => void }): () => void {
  // 宿主骨架（render-only helper·非 sim）：wrapper > scene(定尺缩放盒·信箱化)。
  const { scene, teardown } = mountHost(container, {
    fieldW: FIELD_W,
    fieldH: FIELD_H,
    sceneBackground: FIELD_BG,
    wrapperBackground: '#06121f',
  });

  // sim + 渲染器：引擎固定步长循环驱动 world.tick + renderer.sync（rAF）。
  const engine = new Engine();
  engine.load(buildBlueprint(LEVEL_1));
  const renderer = new CanvasRenderer({ width: FIELD_W, height: FIELD_H, background: 'transparent' });
  engine.attachRenderer(renderer, scene);
  engine.start();

  // cleanup（launcher 卸载时调）：停循环 → 摘渲染器 → 拆宿主骨架。
  return () => {
    engine.stop();
    renderer.destroy();
    teardown();
  };
}
