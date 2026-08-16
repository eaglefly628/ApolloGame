// @vitest-environment happy-dom
// tab-3dui 整页回归（REQ-UIFX 带出）：真 mount + 全树过校验器零 issue。
// 两个历史盲区都是它这形状的测试缺位放走的：① audit 入口把 activeTab 传进 shop 槽 → mount 即抛 → 空页假绿审计；
// ② gallery 长期用 Badge tone:'gold'/'danger'/'accent' 而渲染器只映射 ok/warn/dim → 渲出字面 "undefined;" 样式。
import { it, expect } from 'vitest';
import { mountUI, validateLayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { buildGallery } from './gallery.js';
import { THEMES } from './themes.js';

it('tab-3dui 真 mount 不抛·REQ-UIFX 两格在场·全树校验零 issue·无 "undefined" 样式残留', () => {
  const tree = buildGallery('daylight', 'mod-ui', false, false, undefined, undefined, 'tab-3dui');
  expect(validateLayoutNode(tree)).toEqual([]); // 全树零 issue（含 Badge tone 闭集·Particles/liquid 新轴）
  const host = document.createElement('div');
  document.body.appendChild(host);
  const un = mountUI(host, tree, {}, THEMES['daylight']!);
  expect(host.innerHTML.length).toBeGreaterThan(10000); // 真渲出内容（空页假绿的反面断言）
  expect(host.querySelector('[data-particle-sim]')).toBeTruthy(); // REQ-UIFX A·物理弹道粒子格
  expect(host.querySelector('[data-liquid]')).toBeTruthy();       // REQ-UIFX B·液面杯格
  expect(host.innerHTML).not.toContain('undefined;');             // Badge tone 未映射档的字面残留（历史病）
  un();
  host.remove();
});
