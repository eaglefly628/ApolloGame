// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— 文字散步屏（LayoutNode·像素级复刻 Designer frame「a_weekend_walk」）
//
//  一台 RP 设备的内屏（640×480·黄昏紫 #15101f）：
//    · 上半 像素散步场景（640×250·flex:none）：暮色天空渐变 + 草地 + 小径 + 老树 + 路灯 + 两个并肩走的小人 + 萤火虫（SMIL 漂浮）。
//    · 下半 文字内容（flex:1·padding 18·gap 14）：斜体旁白 + 她的对话气泡（左蓝边·#211a30）+ 两枚选项（#1c1726 描边卡）。
//  全 LayoutNode 数据 + ZANKYOU 主题字体槽（DotGothic16 正文）。场景走 Image(data-URI SVG)。交互只发 action 信号。
//  设计稿精确 hex 直填 Panel.bg / SVG <rect>；设计文字色经最近令牌映射（#9a8da2→sub · #e8dcc8→text）。
// ════════════════════════════════════════════════════════════════════════

import type { LayoutNode } from '@ui/components/index.js';
import { deviceShell } from '../device-frame.js';
import { svgUri } from '../scenes.js';

// ── 像素散步场景（viewBox 320×130·xMidYMax slice 填满 640×250）──────────────
//  忠实移植设计稿 SVG：暮色天空(#3a3560→#c07a6e) / 草地 / 土径 / 老树 / 路灯辉光 /
//  两个并肩小人(蓝衣 + 暖橙衣扎辫) / 三点萤火虫(SMIL 上下漂浮微闪)。
function walkSceneUri(): string {
  // 萤火虫：原设计为静态点，这里加 SMIL 微漂浮（<img> data-URI 内 SMIL 可跑）。
  const ff = (x: number, y: number, begin: string): string =>
    `<rect x="${x}" y="${y}" width="2" height="2" fill="#ffe9a8">` +
    `<animate attributeName="y" values="${y};${y - 4};${y}" dur="3.2s" begin="${begin}" repeatCount="indefinite"/>` +
    `<animate attributeName="opacity" values="1;0.35;1" dur="3.2s" begin="${begin}" repeatCount="indefinite"/></rect>`;
  const inner =
    `<defs><linearGradient id="walkSky" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#3a3560"/><stop offset="1" stop-color="#c07a6e"/></linearGradient></defs>` +
    `<rect width="320" height="130" fill="url(#walkSky)"/>` +
    // 草地
    `<rect y="92" width="320" height="38" fill="#2a3320"/>` +
    // 小径 + 石板纹
    `<polygon points="130,92 190,92 240,130 80,130" fill="#4a4030"/>` +
    `<rect x="150" y="96" width="20" height="3" fill="#5a4d3a"/><rect x="140" y="106" width="40" height="3" fill="#5a4d3a"/>` +
    // 老树（树干 + 两层树冠）
    `<rect x="40" y="50" width="10" height="46" fill="#3a2a1e"/>` +
    `<rect x="20" y="24" width="50" height="34" fill="#2f5236"/>` +
    `<rect x="28" y="16" width="34" height="14" fill="#3a6342"/>` +
    // 路灯（柱 + 灯罩 + 暖光）
    `<rect x="250" y="44" width="4" height="52" fill="#241f2e"/>` +
    `<rect x="246" y="40" width="12" height="8" fill="#caa05a"/>` +
    `<rect x="248" y="48" width="8" height="3" fill="#ffd27f"/>` +
    // 两个并肩走的小人（左：蓝衣深发 · 右：暖橙衣扎辫）
    `<g transform="translate(146,68)"><rect x="0" y="6" width="8" height="16" fill="#46546b"/><rect x="1" y="0" width="6" height="7" fill="#241f2e"/></g>` +
    `<g transform="translate(160,70)"><rect x="0" y="6" width="8" height="14" fill="#e08a5f"/><rect x="1" y="0" width="6" height="7" fill="#6b4631"/><rect x="-1" y="0" width="3" height="4" fill="#6b4631"/></g>` +
    // 萤火虫
    ff(90, 40, '0s') + ff(200, 56, '1.1s') + ff(120, 60, '2.0s');
  return svgUri(inner, '0 0 320 130');
}

// ── 选项卡（#1c1726 底·#3a3050 描边·奶油字居中）──────────────────────────
function choice(id: string, text: string, action: string): LayoutNode {
  return {
    type: 'Panel',
    id,
    props: { bg: '#1c1726' },
    layout: { flex: 1, padding: 11, direction: 'row', justify: 'center', align: 'center' },
    children: [
      { type: 'Label', id: `${id}-t`, props: { text, color: 'text' as const, size: 'sm' as const } },
    ],
  };
}

// ── 整屏（设备外壳 + 内屏：场景 + 文字内容）─────────────────────────────────
export function weekendWalkScreen(): LayoutNode {
  return deviceShell({
    id: 'gx-weekend-walk',
    chip: '文字散步 · 林七月',
    interior: [
      // 像素散步场景（640×250·flex:none）
      {
        type: 'Image',
        id: 'gx-ww-scene',
        props: { src: walkSceneUri(), fit: 'cover' },
        layout: { width: 640, height: 250 },
      },
      // 文字内容（flex:1·padding 18·gap 14）
      {
        type: 'Panel',
        id: 'gx-ww-body',
        props: { bare: true },
        layout: { direction: 'column', flex: 1, padding: 18, gap: 14 },
        children: [
          // 斜体旁白（设计 #9a8da2 → sub）
          {
            type: 'Label',
            id: 'gx-ww-narr',
            props: { text: '我们沿着河走。路灯一盏一盏亮起来。她在一棵老树前停下了。', color: 'sub' as const, size: 'sm' as const },
          },
          // 她的对话气泡（#211a30 底·左侧 #5a7a9a 蓝边·奶油字）
          {
            type: 'Panel',
            id: 'gx-ww-bubble',
            props: { bg: '#211a30' },
            layout: { direction: 'column', padding: 12, gap: 4 },
            children: [
              { type: 'Label', id: 'gx-ww-bub-1', props: { text: '这棵树……你不觉得它长得有点固执吗。', color: 'text' as const, size: 'md' as const } },
              { type: 'Label', id: 'gx-ww-bub-2', props: { text: '你喜欢它吗？', color: 'text' as const, size: 'md' as const } },
            ],
          },
          // 两枚选项（row·gap 10）
          {
            type: 'Panel',
            id: 'gx-ww-choices',
            props: { bare: true },
            layout: { direction: 'row', gap: 10 },
            children: [
              choice('gx-ww-c1', '喜欢，它很安静', 'walk.choose'),
              choice('gx-ww-c2', '说不上来', 'walk.choose'),
            ],
          },
        ],
      },
    ],
  });
}
