// @vitest-environment happy-dom
// 宿主冒烟：完整陪伴流程。大厅→开机→Desk→拿起→互动中枢→聊天/关心送礼/回忆/放回。
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
  if (q(host, 'gx-boot-go')) click(host, 'gx-boot-go');
}

describe('Game X · 宿主冒烟（完整陪伴流程）', () => {
  beforeEach(() => { try { globalThis.localStorage?.clear(); } catch { /* noop */ } });

  it('大厅(无画廊) → 开机 → Desk(活动菜单)', () => {
    const c = document.createElement('div'); document.body.appendChild(c);
    const dispose = mount(c);
    expect(q(c, 'gx-lobby')).toBeTruthy();
    expect(q(c, 'gx-lob-gallery')).toBeNull();
    enter(c);
    expect(q(c, 'gx-desk-host')).toBeTruthy();
    expect(q(c, 'gx-pickup')).toBeTruthy();
    dispose(); c.remove();
  });

  it('拿起 → 互动中枢（六入口·初识无靠近）', () => {
    const c = document.createElement('div'); document.body.appendChild(c);
    const dispose = mount(c);
    enter(c);
    click(c, 'gx-pickup');
    expect(q(c, 'gx-pockethub-host')).toBeTruthy();
    expect(q(c, 'gx-hub-go-chat')).toBeTruthy();
    expect(q(c, 'gx-hub-go-care')).toBeTruthy();
    expect(q(c, 'gx-hub-go-mem')).toBeTruthy();
    expect(q(c, 'gx-hub-go-near')).toBeNull(); // 初识阶段不解锁靠近
    dispose(); c.remove();
  });

  it('聊天：进对话 → 选话题 → 她回应 → 放回结算', () => {
    const c = document.createElement('div'); document.body.appendChild(c);
    const dispose = mount(c);
    enter(c);
    click(c, 'gx-pickup');
    click(c, 'gx-hub-go-chat');
    expect(q(c, 'gx-chat-host')).toBeTruthy();
    expect(q(c, 'gx-chat-opt-0')).toBeTruthy(); // 话题菜单
    click(c, 'gx-chat-opt-0'); // 听你说说今天（异步 raf 推进·这里只验不崩 + 控件在）
    expect(q(c, 'gx-chat-host')).toBeTruthy();
    dispose(); c.remove();
  });

  it('关心 → 送礼 → 她的反应', () => {
    const c = document.createElement('div'); document.body.appendChild(c);
    const dispose = mount(c);
    enter(c);
    click(c, 'gx-pickup');
    click(c, 'gx-hub-go-care');
    expect(q(c, 'gx-care-host')).toBeTruthy();
    click(c, 'gx-care-gift');
    expect(q(c, 'gx-gift-host')).toBeTruthy();
    click(c, 'gx-gift-go-tea'); // 送七月一罐好茶（她喜欢）
    expect(q(c, 'gx-react-host')).toBeTruthy(); // 反应屏
    click(c, 'gx-react-back');
    expect(q(c, 'gx-care-host')).toBeTruthy(); // 返回关心菜单
    dispose(); c.remove();
  });

  it('回忆与档案：相册/懂你/纪念日', () => {
    const c = document.createElement('div'); document.body.appendChild(c);
    const dispose = mount(c);
    enter(c);
    click(c, 'gx-pickup');
    click(c, 'gx-hub-go-mem');
    expect(q(c, 'gx-memories-host')).toBeTruthy();
    click(c, 'gx-mem-back');
    expect(q(c, 'gx-pockethub-host')).toBeTruthy();
    dispose(); c.remove();
  });

  it('缺席：放回写 lastSeen → 快进一天 → 自动缺席屏', () => {
    const c = document.createElement('div'); document.body.appendChild(c);
    const dispose = mount(c);
    enter(c);
    click(c, 'gx-pickup'); click(c, 'gx-hub-dock'); // 放回写 lastSeen
    click(c, 'gx-dev-d+');
    expect(q(c, 'gx-absence-24h-host')).toBeTruthy();
    dispose(); c.remove();
  });

  it('活动菜单 → 听歌 → 结束；Mika 有日记入口', () => {
    const c = document.createElement('div'); document.body.appendChild(c);
    const dispose = mount(c);
    enter(c, 'gx-enter-mika');
    expect(q(c, 'gx-diary')).toBeTruthy();
    click(c, 'gx-weekend');
    click(c, 'gx-wk-pick-song');
    expect(q(c, 'gx-weekend-song-host')).toBeTruthy();
    click(c, 'gx-wk-end');
    expect(q(c, 'gx-desk-host')).toBeTruthy();
    dispose(); c.remove();
  });
});
