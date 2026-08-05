// @vitest-environment happy-dom
// REQ-UICONTRACT 回归（四处「能力卡承诺了、渲染/挂载侧没做到」——本批修 3 处·item4 属 renderer 非 PUI 域）。
// 纪律：每条先复现（撤掉修复即转红）→ 绿。
import { describe, it, expect } from 'vitest';
import { mountUI } from './server.js';
import type { LayoutNode, ActionSink } from './types.js';

type Spy = ActionSink & { calls: Array<{ name: string; arg?: string }> };
function spySink(): Spy {
  const calls: Array<{ name: string; arg?: string }> = [];
  return { calls, enqueueAction(name, value) { calls.push({ name, arg: value?.arg }); } };
}
function mount(tree: LayoutNode, handlers = {}, sink?: ActionSink) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const h = mountUI(host, tree, handlers, undefined, sink);
  return { host, h, done: () => { h(); host.remove(); } };
}

describe('REQ-UICONTRACT① · modalClose / comboClick 缺 ActionSink 回退', () => {
  it('纯信号游戏（无 handler·挂 sink）点遮罩 → closeAction 入队（否则卡死弹窗）', () => {
    const sink = spySink();
    const tree: LayoutNode = { type: 'Modal', id: 'm', props: { closeAction: 'closeM' }, children: [{ type: 'Label', id: 'mt', props: { text: '弹窗体' } }] };
    const { host, done } = mount(tree, {}, sink);
    const scrim = host.querySelector<HTMLElement>('[data-modal-close]')!;
    expect(scrim).toBeTruthy();
    scrim.dispatchEvent(new MouseEvent('click', { bubbles: true })); // e.target === scrim → 点遮罩
    expect(sink.calls).toEqual([{ name: 'closeM', arg: undefined }]);
    done();
  });

  it('纯信号游戏点 Combobox 选项 → action+value 入队（否则下拉点不动）', () => {
    const sink = spySink();
    const tree: LayoutNode = { type: 'Combobox', id: 'cb', props: { options: [{ value: 'gold', label: '黄金' }, { value: 'jade', label: '翡翠' }], action: 'pickC' } };
    const { host, done } = mount(tree, {}, sink);
    const opt = host.querySelector<HTMLElement>('[data-combo-opt="jade"]')!;
    expect(opt).toBeTruthy();
    opt.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(sink.calls).toEqual([{ name: 'pickC', arg: 'jade' }]);
    done();
  });
});

describe('REQ-UICONTRACT② · 键控补丁锚点：内容插到 Panel chrome 之后（非 firstElementChild）', () => {
  it('带 title 的 Panel 键控新增首个内容子 → 内容落在 title 之后（title 仍是首个直子）', () => {
    const withKids = (ids: string[]): LayoutNode => ({
      type: 'Panel', id: 'p', props: { title: '标题' }, // title=无 id chrome·渲在内容前
      layout: { direction: 'column' },
      children: ids.map((id) => ({ type: 'Label', id, props: { text: id } })),
    });
    const { host, h, done } = mount(withKids(['a', 'b']));
    h.update(withKids(['c', 'a', 'b'])); // 键控在首位插入 c
    const panel = host.querySelector<HTMLElement>('#p')!;
    // 首个直子应仍是 chrome（无 id 的 title div）——修复前 c 会被插到 title 之前 → children[0].id==='c'。
    expect((panel.children[0] as HTMLElement).id).toBe('');
    // 带 id 的内容子按新序 c,a,b·且全在 chrome 之后。
    const idKids = Array.from(panel.children).filter((c) => (c as HTMLElement).id).map((c) => (c as HTMLElement).id);
    expect(idKids).toEqual(['c', 'a', 'b']);
    done();
  });
});

describe('REQ-UICONTRACT③ · update() 初始化首屏后由数据新增的动效', () => {
  it('update 新增 data-typewriter 元素 → 被 initDynamics 初始化（打字机起跑·非死的）', () => {
    const empty: LayoutNode = { type: 'Panel', id: 'root', props: {}, children: [] };
    const withTyper: LayoutNode = {
      type: 'Panel', id: 'root', props: {},
      children: [{ type: 'Label', id: 'say', props: { text: '你终于来了', typewriter: 30 } }],
    };
    const { host, h, done } = mount(empty);
    h.update(withTyper); // 首屏后由数据新增打字机
    const say = host.querySelector<HTMLElement>('#say')!;
    expect(say.dataset['dynInit']).toBe('1');   // 被 update 的重扫初始化（撤掉 update 里的 initDynamics 即无此标记）
    expect(say.textContent).toBe('');           // 打字机同步清空 textContent 起跑（未初始化则仍是全文）
    done();
  });

  it('update 新增 data-tween-to 元素 → 被初始化（数字滚动起跑）', () => {
    const empty: LayoutNode = { type: 'Panel', id: 'root', props: {}, children: [] };
    const withTween: LayoutNode = {
      type: 'Panel', id: 'root', props: {},
      children: [{ type: 'Label', id: 'score', props: { tween: { from: 0, to: 100, ms: 300 } } }],
    };
    const { host, h, done } = mount(empty);
    h.update(withTween);
    const score = host.querySelector<HTMLElement>('#score')!;
    expect(score.dataset['dynInit']).toBe('1');
    done();
  });

  it('mount 首屏的动效照旧初始化（无回归）', () => {
    const tree: LayoutNode = { type: 'Label', id: 'l', props: { text: 'hi', typewriter: 30 } };
    const { host, done } = mount(tree);
    expect(host.querySelector<HTMLElement>('#l')!.dataset['dynInit']).toBe('1');
    done();
  });
});
