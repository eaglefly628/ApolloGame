// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— 画廊（浏览全部画面·压力测试演示 + 自审对齐入口）
//
//  从大厅可进：菜单列出全部已复刻屏，点一个全屏看，返回菜单。模块无关（接收条目列表）。
// ════════════════════════════════════════════════════════════════════════

import type { LayoutNode } from '@ui/components/index.js';
import { deviceShell } from './device-frame.js';

export interface GalleryEntry { id: string; label: string; group: string }

export function galleryMenu(entries: GalleryEntry[]): LayoutNode {
  // 按组分块。
  const groups = [...new Set(entries.map((e) => e.group))];
  const blocks: LayoutNode[] = [];
  for (const g of groups) {
    blocks.push({ type: 'Label', id: `gx-gg-${g}`, props: { text: g, font: 'pixel', color: 'dim', size: 'xs', tracking: 2 }, layout: { margin: 2 } });
    blocks.push({
      type: 'Panel', id: `gx-grow-${g}`, props: { bare: true },
      layout: { direction: 'grid', minCol: 180, gap: 8 },
      children: entries.filter((e) => e.group === g).map((e) => ({
        type: 'Button' as const, id: `gx-gv-${e.id}`,
        props: { label: e.label, kind: 'ghost' as const, action: 'gallery.view', actionArg: e.id },
      })),
    });
  }
  return deviceShell({
    id: 'gx-gallery',
    chip: '画廊 · 全部画面',
    chipFlag: `${entries.length} 屏`,
    interior: [
      {
        type: 'Panel', id: 'gx-gal-head', props: { bare: true },
        layout: { direction: 'row', justify: 'between', align: 'end', width: 640, padding: 16 },
        children: [
          { type: 'Label', id: 'gx-gal-t', props: { text: '全部画面', color: 'text', size: 'lg' } },
          { type: 'Button', id: 'gx-gal-back', props: { label: '◀ 大厅', kind: 'ghost', action: 'mode.lobby' } },
        ],
      },
      {
        type: 'Panel', id: 'gx-gal-list', props: { scroll: true, bare: true },
        layout: { direction: 'column', gap: 8, padding: 16, flex: 1, width: 640 },
        children: blocks,
      },
    ],
  });
}

// 单屏查看时的返回浮条（叠在被查看屏上方·绝对定位左上）。
export function galleryBackBar(): LayoutNode {
  return {
    type: 'Panel', id: 'gx-galbackbar', props: { bare: true },
    layout: { direction: 'row', gap: 6, width: 660, justify: 'center', padding: 4 },
    children: [{ type: 'Button', id: 'gx-gal-tomenu', props: { label: '◀ 画廊菜单', kind: 'ghost', action: 'gallery.menu' } }],
  };
}
