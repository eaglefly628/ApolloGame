// @vitest-environment happy-dom
// 宿主冒烟：所有画面由真实条件/流程触发（无画廊）。覆盖大厅→开机→Desk→缺席/周末/日记/Pocket。
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from './game-x.js';

function q(host: HTMLElement, id: string): HTMLElement | null { return host.querySelector<HTMLElement>(`[id="${id}"]`); }
function click(host: HTMLElement, id: string): void {
  const el = q(host, id);
  if (!el) throw new Error(`找不到控件 #${id}`);
  el.click();
}
function enter(host: HTMLElement, who = 'gx-enter-qiyue'): void {
  click(host, who);
  if (q(host, 'gx-boot-go')) click(host, 'gx-boot-go'); // 初次见面 → 放上底座
}

describe('Game X · 宿主冒烟（条件驱动·无画廊）', () => {
  beforeEach(() => { try { globalThis.localStorage?.clear(); } catch { /* noop */ } });

  it('挂载即大厅（无画廊按钮）', () => {
    const c = document.createElement('div'); document.body.appendChild(c);
    const dispose = mount(c);
    expect(q(c, 'gx-lobby')).toBeTruthy();
    expect(q(c, 'gx-lob-gallery')).toBeNull(); // 画廊已移除
    dispose(); c.remove();
  });

  it('选七月 → 开机 → Desk Mode（活时钟 + 控制条）', () => {
    const c = document.createElement('div'); document.body.appendChild(c);
    const dispose = mount(c);
    enter(c);
    expect(q(c, 'gx-desk-host')).toBeTruthy();
    expect(q(c, 'gx-clock')).toBeTruthy();
    expect(q(c, 'gx-pickup')).toBeTruthy();
    dispose(); c.remove();
  });

  it('拿起 → Pocket 上下文对话屏 → 放回回 Desk', () => {
    const c = document.createElement('div'); document.body.appendChild(c);
    const dispose = mount(c);
    enter(c);
    click(c, 'gx-pickup');
    // 七月：上下文对话屏（晨问 gx-pocket-morning 或记忆 gx-pocket-memory 之一）
    expect(q(c, 'gx-pocket-morning-host') || q(c, 'gx-pocket-memory-host')).toBeTruthy();
    click(c, 'gx-dock');
    expect(q(c, 'gx-desk-host')).toBeTruthy();
    dispose(); c.remove();
  });

  it('缺席：拿起放回写 lastSeen → dev 快进一天 → Desk 自动切缺席屏', () => {
    const c = document.createElement('div'); document.body.appendChild(c);
    const dispose = mount(c);
    enter(c);
    click(c, 'gx-pickup'); click(c, 'gx-dock'); // dock 写 lastSeen=now
    click(c, 'gx-dev-d+'); // +24h → hoursAway≥24
    expect(q(c, 'gx-absence-24h-host')).toBeTruthy();
    expect(q(c, 'gx-abs-pickup')).toBeTruthy();
    dispose(); c.remove();
  });

  it('日记：Mika 的 Desk 有日记入口 → 进收藏 → 返回', () => {
    const c = document.createElement('div'); document.body.appendChild(c);
    const dispose = mount(c);
    enter(c, 'gx-enter-mika');
    expect(q(c, 'gx-diary')).toBeTruthy(); // Mika 才有日记入口
    click(c, 'gx-diary');
    expect(q(c, 'gx-diary-screen') || q(c, 'gx-diary-host')).toBeTruthy();
    click(c, 'gx-diary-back');
    expect(q(c, 'gx-desk-host')).toBeTruthy();
    dispose(); c.remove();
  });

  it('活动菜单 → 选「听歌」→ 结束回桌面', () => {
    const c = document.createElement('div'); document.body.appendChild(c);
    const dispose = mount(c);
    enter(c);
    click(c, 'gx-weekend'); // 活动入口（Desk 常驻菜单）
    expect(q(c, 'gx-weekend-pick-host')).toBeTruthy();
    click(c, 'gx-wk-pick-song');
    expect(q(c, 'gx-weekend-song-host')).toBeTruthy();
    click(c, 'gx-wk-end');
    expect(q(c, 'gx-desk-host')).toBeTruthy();
    dispose(); c.remove();
  });

  it('切角色信号 + 天气信号不崩', () => {
    const c = document.createElement('div'); document.body.appendChild(c);
    const dispose = mount(c);
    enter(c);
    click(c, 'gx-dev-rain');
    click(c, 'gx-dev-char');
    expect(q(c, 'gx-desk-host')).toBeTruthy();
    dispose(); c.remove();
  });
});
