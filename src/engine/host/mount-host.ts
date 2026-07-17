// 引擎公用宿主骨架（render-only · 纯 DOM · 零 sim 依赖）——REQ-AUDIT-守门 C 件下沉。
//
// 抽出各卡带宿主层重复的「wrapper > scene(定尺缩放盒) > [topHost/bottomHost/overlayHost]」五容器
// 骨架 + 等比缩放逻辑（原 game-q/game-t mount 逐字复制的那段）。本 helper 只搭台：不引 Engine/World，
// 不碰 sim/hash，不接渲染器/输入/HUD——那些一律留在调用方（宿主契约明许的 sim 外胶水）。
//
// 布局：wrapper 铺满容器并 flex 居中 → scene 定尺盒（fieldW×fieldH·等比 scale 缩进容器·信箱化）；
// 渲染器画布由调用方 attach 进 scene 打底（z0），三个 HUD host 叠上（top/bottom z10·overlay z20）。
// 指针映射经 scene 的 getBoundingClientRect 自动跟随缩放，调用方无需感知 scale。

export interface MountHostOptions {
  /** 定尺场景宽（逻辑像素·等比缩放基准）。 */
  fieldW: number;
  /** 定尺场景高（逻辑像素·等比缩放基准）。 */
  fieldH: number;
  /** 顶栏 host 高（px·默认 0）。 */
  topBarH?: number;
  /** 底栏 host 高（px·默认 0）。 */
  bottomBarH?: number;
  /** 场景底纹（CSS background 值·省略=不设背景）。 */
  sceneBackground?: string;
  /** wrapper 信箱区底色（CSS background 值·省略=不设背景）。 */
  wrapperBackground?: string;
}

export interface HostSkeleton {
  /** 铺满容器、flex 居中信箱区的最外层。 */
  wrapper: HTMLDivElement;
  /** 定尺缩放盒——渲染器画布 attach 于此打底（z0）。 */
  scene: HTMLDivElement;
  /** 顶栏 HUD host（z10）。 */
  topHost: HTMLDivElement;
  /** 底栏 HUD host（z10）。 */
  bottomHost: HTMLDivElement;
  /** 全屏浮层 host（z20·默认 pointer-events:none·调用方按需开）。 */
  overlayHost: HTMLDivElement;
  /** 按当前容器尺寸重算 scene 等比缩放（ResizeObserver/resize 已自动触发·此为手动补触发口）。 */
  fit: () => void;
  /** 卸载：停 ResizeObserver + 摘 resize 监听 + 移除 wrapper（调用方另清自己的 sim/HUD 挂载）。 */
  teardown: () => void;
}

/**
 * 建卡带宿主 DOM 骨架并挂进 container，返回容器句柄 + 缩放/卸载钩子。
 * render-only：不含任何 sim 逻辑，跳过/复用不影响回放/hash/lockstep。
 */
export function mountHost(container: HTMLElement, opts: MountHostOptions): HostSkeleton {
  const { fieldW, fieldH, topBarH = 0, bottomBarH = 0, sceneBackground, wrapperBackground } = opts;

  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:absolute;inset:0;overflow:hidden;display:flex;align-items:center;justify-content:center;' +
    '-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale' +
    (wrapperBackground ? `;background:${wrapperBackground}` : '');

  // scene = 定尺缩放盒；画布(z0·渲染器 init 时挂入) 打底 + 三个 HUD host(z10/20) 叠上。
  const scene = document.createElement('div');
  scene.style.cssText =
    `position:relative;width:${fieldW}px;height:${fieldH}px;flex:0 0 auto;transform-origin:center center` +
    (sceneBackground ? `;background:${sceneBackground}` : '');

  const topHost = document.createElement('div');
  topHost.style.cssText = `position:absolute;left:0;right:0;top:0;height:${topBarH}px;z-index:10`;
  const bottomHost = document.createElement('div');
  bottomHost.style.cssText = `position:absolute;left:0;right:0;bottom:0;height:${bottomBarH}px;z-index:10`;
  const overlayHost = document.createElement('div');
  overlayHost.style.cssText = 'position:absolute;inset:0;z-index:20;pointer-events:none';

  scene.append(topHost, bottomHost, overlayHost);
  wrapper.appendChild(scene);
  container.appendChild(wrapper);

  // ── 响应式缩放（定尺场景盒等比缩进容器·指针映射经 getBoundingClientRect 自动跟随）──
  const fit = (): void => {
    const cw = container.clientWidth || fieldW;
    const ch = container.clientHeight || fieldH;
    const k = Math.min(cw / fieldW, ch / fieldH);
    scene.style.transform = `scale(${k})`;
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
  ro?.observe(container);
  if (typeof window !== 'undefined') window.addEventListener('resize', fit);
  fit();

  const teardown = (): void => {
    ro?.disconnect();
    if (typeof window !== 'undefined') window.removeEventListener('resize', fit);
    wrapper.remove();
  };

  return { wrapper, scene, topHost, bottomHost, overlayHost, fit, teardown };
}
