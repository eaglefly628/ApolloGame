// Game 102 · Pixel Pour —— 卡带宿主层（工程师写的 mount/host·契约明许·零玩法逻辑）。
//
// 职责（全在 sim 外·render-only）：建 Engine + CanvasRenderer，把 play-field 画进沙盒画布；响应式缩放；cleanup。
// 玩法规则一律在 blueprint.ts 的数据 + 引擎能力里（Lead 裁①·零游戏层 system 代码）。
// S3 骨架关：先把「像素画棋盘 + 传送带位 + 待命槽 + 补给区」的实体阵画出来（Shape+Color 由 CanvasRenderer 投影）；
// 交互/HUD（LayoutNode 四屏 = PUI·REQ-G102-UI）与玩法链（event-when/launch = S4）后续接入。
import { Engine } from '../../runtime/engine.js';
import { CanvasRenderer } from '@renderer/index.js';
import { AssetManager, ImageAssetLoader, registerAssetIndex, parseAssetIndex } from '@assets/index.js';
import { QueuedInputSource, canvasPointerToScreen } from '@net/index.js';
import { mountHost } from '@engine/host/mount-host.js';
import { buildBlueprint } from './blueprint.js';
import { LEVEL_1 } from './levels.js';
import { FIELD_W, FIELD_H } from './theme.js';

// 沙盒背景：design-ref 对局屏石板渐变（#5b6488→#4c5578·真皮/管道金属观感走 S6 美术台账）。
const FIELD_BG = 'linear-gradient(180deg,#5b6488,#4c5578)';

export function mount(container: HTMLElement, _host?: { exit: () => void }): () => void {
  // 宿主骨架（render-only helper·非 sim）：wrapper > scene(定尺缩放盒·信箱化)。
  const { scene, teardown } = mountHost(container, {
    fieldW: FIELD_W,
    fieldH: FIELD_H,
    sceneBackground: FIELD_BG,
    wrapperBackground: '#06121f',
  });

  // sim + 渲染器 + 指针输入：引擎固定步长循环（rAF）每拍先注入本 tick 输入命令再 world.tick。
  const input = new QueuedInputSource('g102');
  const engine = new Engine({ input });
  engine.load(buildBlueprint(LEVEL_1));
  // 炮台贴图资产（打蛋器 recolor·美术就绪即盖过 box·无 index/失败=回退方体·美术是增量非依赖）。
  const assets = new AssetManager(new ImageAssetLoader());
  void (async () => {
    try {
      const r = await fetch('/games/game102/art/index.json', { cache: 'no-store' });
      if (!r.ok) return;
      registerAssetIndex(assets, parseAssetIndex(await r.json()));
      await assets.loadAll();
    } catch { /* 无美术目录 → 回退 box 观感·不炸游戏 */ }
  })();
  const renderer = new CanvasRenderer({ width: FIELD_W, height: FIELD_H, background: 'transparent', assets });
  engine.attachRenderer(renderer, scene);

  // 画布点击 → 逆投影为世界坐标（无相机=画布逻辑坐标·信箱缩放已由 mountHost 处理）→ 入队；
  // 补给炮 Clickable 命中 → fire_<color> 信号 → 置 firing 旗 → 炮向最近同色格喷弹消除（blueprint 开火链）。
  const canvas = scene.querySelector('canvas') as HTMLCanvasElement;
  const onDown = (e: PointerEvent): void => {
    const rect = canvas.getBoundingClientRect();
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const p = canvasPointerToScreen(e.clientX, e.clientY, rect, canvas.width / dpr, canvas.height / dpr);
    input.enqueue({ source: 'g102', x: p.x, y: p.y, phase: 'down' });
  };
  canvas.addEventListener('pointerdown', onDown);
  engine.start();

  // cleanup（launcher 卸载时调）：停循环 → 摘监听 → 摘渲染器 → 拆宿主骨架。
  return () => {
    engine.stop();
    canvas.removeEventListener('pointerdown', onDown);
    renderer.destroy();
    teardown();
  };
}
