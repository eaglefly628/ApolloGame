// Game B ·《雀宴》—— 宿主层（S3 骨架 + 主菜单屏·mountHost 引擎公用件·零手写 DOM 骨架·零玩法逻辑）。
//
// 两屏（两层 1:1 律「S4 结构」·结构照 mockups/·皮=专属主题·S5 精修）：
//   ① 主菜单（NIGHT 夜宴皮·凤翎/明朝/粉金·结构照 main-menu.dc.html）→ 点「开始上桌」→
//   ② 牌桌（3D 世界 + sakura HUD·结构照 ui-mockup.dc.html §四·手牌 Pickable3D 拾取）。
// 红线：UI 全 LayoutNode；3D 全 render-only 组件；随机只有蓝图 RandomSeed（宿主零随机）。
import { Engine } from '../../runtime/engine.js';
import { ThreeRenderer } from '@renderer/three-renderer.js';
import { mountHost } from '@engine/host/mount-host.js';
import { mountUI } from '@ui/components/index.js';
import { buildTableBlueprint } from './blueprint.js';
import { createGameBAssets } from './assets.js';
import { buildHud, initialHud } from './hud.js';
import { buildMenu, initialMenu, MENU_START, MENU_CONTINUE, MENU_SETTINGS } from './menu.js';
import { FIELD_W, FIELD_H, MENU_W, MENU_H, MENU_BG, SAKURA, NIGHT, TINT } from './theme.js';

// 开局 seed（S3 摆拍固定值=可复现；S4 起由 SessionIn 传入·缺省时钟种子也走入参·gdd §十二）。
const S3_SEED = 20260717;

// 牌桌和室夜宴底（宿主装饰层·真美术=S6 背景件）。
const STAGE_BG = 'radial-gradient(ellipse at 50% 38%, #41283a 0%, #2a1e2b 62%, #201722 100%)';

export function mount(container: HTMLElement): () => void {
  let teardown: (() => void) | null = null;
  const clear = (): void => { teardown?.(); teardown = null; };

  // ── 主菜单屏（NIGHT 皮·结构照稿·全 UI 无 3D·overlayHost auto 让按钮可点）───────────
  function showMenu(): void {
    clear();
    const skel = mountHost(container, { fieldW: MENU_W, fieldH: MENU_H, sceneBackground: MENU_BG, wrapperBackground: '#160d1b' });
    skel.overlayHost.style.pointerEvents = 'auto';
    const ui = mountUI(skel.overlayHost, buildMenu(initialMenu()), {
      [MENU_START]: () => showTable(),
      [MENU_CONTINUE]: () => showTable(),
      [MENU_SETTINGS]: () => { /* S5 设置屏（结构照稿后补） */ },
    }, NIGHT);
    teardown = () => { ui(); skel.teardown(); };
  }

  // ── 牌桌屏（3D 世界 + sakura HUD·overlayHost 保持 none 让手牌拾取透过 canvas）─────────
  function showTable(): void {
    clear();
    const skel = mountHost(container, { fieldW: FIELD_W, fieldH: FIELD_H, sceneBackground: STAGE_BG, wrapperBackground: '#1c141d' });

    const { assets, ready } = createGameBAssets();
    const engine = new Engine();
    engine.load(buildTableBlueprint({ seed: S3_SEED }));
    const renderer = new ThreeRenderer({
      width: FIELD_W, height: FIELD_H, background: TINT.stageBg,
      assets, antialias: false, dprCap: 1.5, shadowMapSize: 1024,
    });
    engine.attachRenderer(renderer, skel.scene);
    void ready.then(() => renderer.invalidate()); // 贴图迟到 × 静态场景脏帧跳渲 → 就绪补一帧

    const hud = initialHud();
    const hudUi = mountUI(skel.overlayHost, buildHud(hud), {}, SAKURA);

    // 手牌拾取（Pickable3D + renderer.pick·S3 自证反馈进字幕·S4 改 enqueueAction 入 sim）。
    const canvas = skel.scene.querySelector('canvas');
    let downX = 0;
    let downY = 0;
    const onDown = (e: PointerEvent): void => { downX = e.clientX; downY = e.clientY; };
    const onUp = (e: PointerEvent): void => {
      if (Math.abs(e.clientX - downX) > 5 || Math.abs(e.clientY - downY) > 5) return;
      const hit = renderer.pick(e.clientX, e.clientY);
      if (!hit) return;
      hud.subtitle = { speaker: '拾取', line: `｢${hit.entityId}｣（signal:${hit.signal}·S4 接出牌）` };
      hudUi.update(buildHud(hud), SAKURA);
    };
    canvas?.addEventListener('pointerdown', onDown);
    canvas?.addEventListener('pointerup', onUp);

    engine.start();
    teardown = () => {
      canvas?.removeEventListener('pointerdown', onDown);
      canvas?.removeEventListener('pointerup', onUp);
      engine.stop();
      renderer.destroy();
      hudUi();
      skel.teardown();
    };
  }

  showMenu();
  return () => clear();
}
