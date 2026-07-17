// @vitest-environment happy-dom
// mount-host 宿主骨架 helper 的契约测试（REQ-AUDIT-守门 C 件）：容器结构 / 定尺缩放 / teardown。
import { describe, it, expect, beforeEach } from 'vitest';
import { mountHost } from './mount-host.js';

function makeContainer(w?: number, h?: number): HTMLElement {
  const c = document.createElement('div');
  if (w !== undefined) Object.defineProperty(c, 'clientWidth', { value: w, configurable: true });
  if (h !== undefined) Object.defineProperty(c, 'clientHeight', { value: h, configurable: true });
  document.body.appendChild(c);
  return c;
}

describe('mountHost（引擎公用宿主骨架）', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('建五容器且嵌套正确：container > wrapper > scene > [top/bottom/overlay]', () => {
    const container = makeContainer();
    const h = mountHost(container, { fieldW: 800, fieldH: 600, topBarH: 40, bottomBarH: 80 });
    expect(h.wrapper.parentElement).toBe(container);
    expect(h.scene.parentElement).toBe(h.wrapper);
    expect(h.topHost.parentElement).toBe(h.scene);
    expect(h.bottomHost.parentElement).toBe(h.scene);
    expect(h.overlayHost.parentElement).toBe(h.scene);
    // 恰三个 HUD host 挂在 scene 下（画布由调用方后挂·此时 scene 只有三 host）。
    expect(h.scene.children.length).toBe(3);
  });

  it('容器骨架样式：定尺 scene / 分层 z-index / overlay 默认不吃指针 / 背景注入', () => {
    const container = makeContainer();
    const h = mountHost(container, {
      fieldW: 720, fieldH: 480, topBarH: 30, bottomBarH: 60,
      sceneBackground: '#123456', wrapperBackground: '#000000',
    });
    expect(h.scene.style.width).toBe('720px');
    expect(h.scene.style.height).toBe('480px');
    expect(h.scene.style.transformOrigin).toBe('center center');
    expect(h.scene.style.background).toContain('#123456');
    expect(h.wrapper.style.background).toContain('#000000');
    expect(h.topHost.style.zIndex).toBe('10');
    expect(h.bottomHost.style.zIndex).toBe('10');
    expect(h.topHost.style.height).toBe('30px');
    expect(h.bottomHost.style.height).toBe('60px');
    expect(h.overlayHost.style.zIndex).toBe('20');
    expect(h.overlayHost.style.pointerEvents).toBe('none');
  });

  it('省略背景/栏高：不设 background·host 高 0', () => {
    const container = makeContainer();
    const h = mountHost(container, { fieldW: 100, fieldH: 100 });
    expect(h.scene.style.background).toBe('');
    expect(h.wrapper.style.background).toBe('');
    expect(h.topHost.style.height).toBe('0px');
    expect(h.bottomHost.style.height).toBe('0px');
  });

  it('定尺缩放：等比取容器/场景较小比 → scene.transform=scale(k)', () => {
    // 容器 400×300·场景 800×600 → k=min(0.5,0.5)=0.5。
    const container = makeContainer(400, 300);
    const h = mountHost(container, { fieldW: 800, fieldH: 600 });
    expect(h.scene.style.transform).toBe('scale(0.5)');
    // 非等比容器取较小边：600×600·场景 800×400 → min(0.75, 1.5)=0.75。
    const c2 = makeContainer(600, 600);
    const h2 = mountHost(c2, { fieldW: 800, fieldH: 400 });
    expect(h2.scene.style.transform).toBe('scale(0.75)');
  });

  it('缩放回退：容器 0 尺寸（未布局）→ 用场景定尺兜底 → scale(1)', () => {
    const container = makeContainer(0, 0);
    const h = mountHost(container, { fieldW: 500, fieldH: 500 });
    expect(h.scene.style.transform).toBe('scale(1)');
  });

  it('fit() 手动补触发：容器尺寸变后重算', () => {
    const container = makeContainer(800, 600);
    const h = mountHost(container, { fieldW: 800, fieldH: 600 });
    expect(h.scene.style.transform).toBe('scale(1)');
    Object.defineProperty(container, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 300, configurable: true });
    h.fit();
    expect(h.scene.style.transform).toBe('scale(0.5)');
  });

  it('teardown 干净：移除 wrapper·window resize 不再改 scene', () => {
    const container = makeContainer(800, 600);
    const h = mountHost(container, { fieldW: 800, fieldH: 600 });
    expect(container.children.length).toBe(1);
    h.teardown();
    expect(container.children.length).toBe(0);
    expect(h.wrapper.isConnected).toBe(false);
    // teardown 后改容器尺寸 + 派 resize：监听已摘 → transform 不应更新（仍是卸载前的 scale(1)）。
    Object.defineProperty(container, 'clientWidth', { value: 200, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 150, configurable: true });
    window.dispatchEvent(new Event('resize'));
    expect(h.scene.style.transform).toBe('scale(1)');
  });
});
