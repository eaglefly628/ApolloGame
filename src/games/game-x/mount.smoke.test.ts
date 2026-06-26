// @vitest-environment happy-dom
// 宿主冒烟：mount() 在真实 DOM 走通 大厅→开机→Desk→Pocket→放回，全程不崩。
// 覆盖宿主胶水层（四态流转 / 时钟服务 / mountUI / 引擎驱动 / localStorage 回写）。
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from './game-x.js';

function q(host: HTMLElement, id: string): HTMLElement | null {
  return host.querySelector<HTMLElement>(`[id="${id}"]`);
}
function click(host: HTMLElement, id: string): void {
  const el = q(host, id);
  if (!el) throw new Error(`找不到控件 #${id}`);
  el.click();
}

describe('Game X · 宿主冒烟（大厅 → 开机 → Desk → Pocket）', () => {
  beforeEach(() => { try { globalThis.localStorage?.clear(); } catch { /* noop */ } });

  it('挂载即渲染大厅（角色选择 Marketplace）', () => {
    const c = document.createElement('div'); document.body.appendChild(c);
    const dispose = mount(c);
    expect(q(c, 'gx-lobby')).toBeTruthy();
    expect(q(c, 'gx-card-qiyue')).toBeTruthy();
    expect(q(c, 'gx-card-mika')).toBeTruthy();
    dispose(); c.remove();
  });

  it('选七月 → 初次见面开机屏 → 放上底座进 Desk Mode（活时钟 + 情感线）', () => {
    const c = document.createElement('div'); document.body.appendChild(c);
    const dispose = mount(c);
    click(c, 'gx-enter-qiyue');
    expect(q(c, 'gx-boot')).toBeTruthy(); // 初次见面（localStorage 已清→新关系）
    click(c, 'gx-boot-go');
    expect(q(c, 'gx-desk')).toBeTruthy();
    expect(q(c, 'gx-clock')).toBeTruthy(); // VT323 活时钟
    expect(q(c, 'gx-temp')).toBeTruthy(); // 情感温度线
    expect(q(c, 'gx-pickup')).toBeTruthy();
    dispose(); c.remove();
  });

  it('Desk → 拿起进 Pocket 对话 → 回大厅', () => {
    const c = document.createElement('div'); document.body.appendChild(c);
    const dispose = mount(c);
    click(c, 'gx-enter-qiyue');
    click(c, 'gx-boot-go');
    click(c, 'gx-pickup');
    expect(q(c, 'gx-pocket')).toBeTruthy();
    expect(q(c, 'gx-c-0')).toBeTruthy(); // hub 选项
    dispose(); c.remove();
  });

  it('Desk Mode 天气/时刻/切角色信号不崩', () => {
    const c = document.createElement('div'); document.body.appendChild(c);
    const dispose = mount(c);
    click(c, 'gx-enter-qiyue');
    click(c, 'gx-boot-go');
    click(c, 'gx-dev-rain');
    click(c, 'gx-dev-fwd');
    click(c, 'gx-dev-char'); // 切到 Mika
    expect(q(c, 'gx-desk')).toBeTruthy();
    dispose(); c.remove();
  });
});
