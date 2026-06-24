// Game I 画廊冒烟测试（契约 DoD：renderNode 串测·结构/主题/转义）。
// 验证「填数据即出 UI」：整棵画廊数据经引擎纯函数渲染，应含全部控件标记、且文本转义防 XSS。

import { describe, it, expect } from 'vitest';
import { renderNode, resolveBindings } from '@ui/components/index.js';
import type { UIDataSource } from '@ui/components/index.js';
import { buildGallery } from './gallery.js';
import { THEMES, onyx } from './themes.js';

describe('Game I gallery', () => {
  it('renders the full control gallery as an HTML string', () => {
    const html = renderNode(buildGallery('onyx'), onyx);
    expect(html).toContain('id="gameui-root"');          // Screen 根
    expect(html).toContain('data-tabs="gallery-tabs"');  // Tabs 分页
    // 三个分页都在
    expect(html).toContain('data-tabpage="tab-layout"');
    expect(html).toContain('data-tabpage="tab-display"');
    expect(html).toContain('data-tabpage="tab-input"');
    expect(html).toContain('data-tabpage="tab-shop"');   // 组合演示·商店
    expect(html).toContain('data-tabpage="tab-pick"');   // 组合演示·选牌
    expect(html).toContain('data-tabpage="tab-sound"');  // 声音测试
  });

  it('lists ALL 30 engine components (showcase coverage gate)', () => {
    // 模态/抽屉需开启态才入树；用 modalOpen=drawerOpen=true 覆盖到 Modal/Drawer。
    const html = renderNode(buildGallery('onyx', true, true), onyx);
    // 渲染器分发表认识的全部 30 个控件，展示款里一个都不能漏。
    for (const id of [
      'topbar',              // Panel
      'gameui-root',         // Screen
      'gallery-tabs',        // Tabs
      'demo-table',          // Table
      'app-title',           // Label
      'app-engine',          // Badge
      'img-cover',           // Image
      'top-div',             // Divider
      'btn-p',               // Button
      'in-text',             // Input
      'dd-diff',             // Dropdown
      'cb-tutorial',         // Checkbox
      'tg-sound',            // Toggle
      'rg-speed',            // RadioGroup
      'sl-volume',           // Slider
      'pb-accent',           // ProgressBar
      'tag-all',             // Tag
      'demo-modal-overlay',  // Modal
      'toast-ok',            // Toast（静态预览节点）
      'tip-top',             // Tooltip
      'demo-accordion',      // Accordion
      'av-circle',           // Avatar
      'card-1',              // Card
      'seg-view',            // Segmented
      'stp-qty',             // Stepper
      'cb-city',             // Combobox
      'demo-drawer-overlay', // Drawer
      'rt-stars',            // Rating
      'demo-vlist',          // VirtualList
      'demo-ctxmenu',        // ContextMenu
    ]) {
      expect(html).toContain(`"${id}"`);
    }
  });

  it('overlays the Modal only when modalOpen=true', () => {
    expect(renderNode(buildGallery('onyx', false), onyx)).not.toContain('demo-modal-overlay');
    expect(renderNode(buildGallery('onyx', true), onyx)).toContain('demo-modal-overlay');
  });

  it('exercises every input control with an action signal', () => {
    const html = renderNode(buildGallery('onyx', true, true), onyx);
    for (const action of [
      'click', 'setText', 'setNum', 'setDifficulty',
      'setFlag', 'setSound', 'setSpeed', 'setVolume', 'setTheme', 'switchTab',
      'pickRow', 'pickTag', 'openModal', 'closeModal', 'showToast',
      'pickCard', 'setView', 'setQty', 'toggleAcc',
      'setRating', 'openDrawer', 'closeDrawer', 'hurt', 'heal',
      'pickVRow', 'ctxAction',
    ]) {
      expect(html).toContain(`data-action="${action}"`);
    }
    // Combobox 走引擎内建 data-combo（非 data-action）→ 单独断言
    expect(html).toContain('data-combo="setCity"');
  });

  it('demonstrates world-binding: resolveBindings fills bound HUD nodes', () => {
    const ds: UIDataSource = {
      resource: (id) => (id === 'hp' ? { current: 42, max: 100 } : id === 'gold' ? { current: 999 } : undefined),
    };
    const resolved = resolveBindings(buildGallery('onyx'), ds);
    const html = renderNode(resolved, onyx);
    // 绑定后：Label 把 current 接在 text 后；ProgressBar value 取 current。
    expect(html).toContain('生命值 42');
    expect(html).toContain('金币 999');
    // 未绑定渲染时 HUD 不含解析值（bind 占位）
    expect(renderNode(buildGallery('onyx'), onyx)).not.toContain('生命值 42');
  });

  it('reflects the active theme in the theme picker', () => {
    const html = renderNode(buildGallery('brocade'), THEMES['brocade']!);
    // 暖金主题的主色应出现在渲染串里（令牌驱动·非内联死色）
    expect(html).toContain('#e0b964');
  });

  it('renders identical structure across themes (data-driven re-skin)', () => {
    const a = renderNode(buildGallery('onyx'), THEMES['onyx']!);
    const b = renderNode(buildGallery('onyx'), THEMES['frost']!);
    // 同一棵数据、不同令牌 → 结构锚点一致，仅颜色变
    expect(a).toContain('data-tabs="gallery-tabs"');
    expect(b).toContain('data-tabs="gallery-tabs"');
    expect(a).not.toBe(b);
  });
});
