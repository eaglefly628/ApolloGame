// Game B ·《雀宴》—— 宿主层（S3 骨架·mountHost 引擎公用件·零手写 DOM 骨架·零玩法逻辑）。
//
// 职责（全在 sim 外）：mountHost 搭台（1120×630 信箱化）→ Engine 装载牌桌蓝图 → ThreeRenderer
// 渲染 3D 世界（主机位 Camera3D 数据驱动）→ overlayHost 挂整幅 HUD（LayoutNode+sakura 主题）→
// 手牌 Pickable3D 射线拾取（点选反馈进字幕条·S4 起改 enqueueAction 入 sim）。
// 红线：UI 全 LayoutNode；3D 全 render-only 组件；随机只有蓝图 RandomSeed（宿主零随机）。
import { Engine } from '../../runtime/engine.js';
import { ThreeRenderer } from '@renderer/three-renderer.js';
import { mountHost } from '@engine/host/mount-host.js';
import { mountUI } from '@ui/components/index.js';
import type { MountHandle } from '@ui/components/index.js';
import { buildTableBlueprint } from './blueprint.js';
import { createGameBAssets } from './assets.js';
import { buildHud, initialHud, type HudState } from './hud.js';
import { FIELD_W, FIELD_H, SAKURA, TINT } from './theme.js';

// 开局 seed（S3 摆拍固定值=可复现；S4 起由 SessionIn 传入·缺省时钟种子也走入参·gdd §十二）。
const S3_SEED = 20260717;

// 和室夜宴底（线框稿 stage 径向暗梅·宿主装饰层）。
const STAGE_BG =
  'radial-gradient(ellipse at 50% 38%, #41283a 0%, #2a1e2b 62%, #201722 100%)';

export function mount(container: HTMLElement): () => void {
  const skel = mountHost(container, {
    fieldW: FIELD_W,
    fieldH: FIELD_H,
    sceneBackground: STAGE_BG,
    wrapperBackground: '#1c141d',
  });

  // ── 3D 世界（蓝图纯数据 → 真引擎 → 引擎渲染器）───────────────────────────────────
  const { assets, ready } = createGameBAssets();
  const engine = new Engine();
  engine.load(buildTableBlueprint({ seed: S3_SEED }));
  const renderer = new ThreeRenderer({
    width: FIELD_W, height: FIELD_H, background: TINT.stageBg,
    assets, antialias: false, dprCap: 1.5, shadowMapSize: 1024,
  });
  engine.attachRenderer(renderer, skel.scene);
  // 贴图迟到 × 静态场景脏帧跳渲 → 就绪后强制补一帧（公开 invalidate·见 assets.ts 注）。
  void ready.then(() => renderer.invalidate());

  // ── HUD（LayoutNode 整幅挂 overlayHost·sakura 主题·S3 全钮 disabled → handler 空表）──
  const hud: HudState = initialHud();
  const hudUi: MountHandle = mountUI(skel.overlayHost, buildHud(hud), {}, SAKURA);

  // ── 手牌拾取（Pickable3D + renderer.pick 射线·引擎输入层件）────────────────────────
  // S3=拾取自证：命中 → 字幕条显示所点牌（宿主本地反馈·不写世界）；S4 改 enqueueAction 入队。
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

  return () => {
    canvas?.removeEventListener('pointerdown', onDown);
    canvas?.removeEventListener('pointerup', onUp);
    engine.stop();
    renderer.destroy();
    hudUi();
    skel.teardown();
  };
}
