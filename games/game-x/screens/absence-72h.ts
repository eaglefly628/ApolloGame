// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— Absence 72H 屏（LayoutNode·像素级复刻 Designer frame a_absence72）
//
//  「+72H · 她关了灯，只有屏幕微光」：你已离开 72 小时。黑屋里只剩显示器的冷光，
//  她还坐在那儿——一个低饱和、被关灯吞掉大半的房间。三段对齐设计稿：
//    上场景(640×300 黑屋·只有屏幕冷蓝微光照在她侧脸) /
//    信息带(640×172：左 VT323 余烬色时钟「23:48 02」+ 日期 / 右 NOW·RETURN 文案) /
//    最底情感温度线(640×8 冷蓝渐变·感情温度跌到底)。
//  右上「○ AWAY 72H」状态药丸绝对定位在场景里。全 LayoutNode 数据 + ZANKYOU 字体槽。
// ════════════════════════════════════════════════════════════════════════

import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { deviceShell } from '../device-frame.js';
import { svgUri } from '../scenes.js';

// ── 像素图：关灯的黑屋（只有显示器冷蓝微光照亮她侧脸·忠实移植设计稿 SVG）──────────
//  viewBox 320×150·preserveAspectRatio 在 svgUri 里走 meet；这里照设计稿原始坐标拼。
function darkRoomScene(): string {
  return `
  <defs>
    <radialGradient id="glow72" cx="0.45" cy="0.55" r="0.42">
      <stop offset="0" stop-color="#3a4a6b" stop-opacity="0.7"/>
      <stop offset="1" stop-color="#3a4a6b" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="320" height="150" fill="#0c0a12"/>
  <rect x="150" y="14" width="120" height="86" fill="#0a0810"/>
  <rect x="155" y="19" width="110" height="76" fill="#10131f"/>
  <rect x="208" y="19" width="4" height="76" fill="#0a0810"/>
  <rect x="155" y="54" width="110" height="4" fill="#0a0810"/>
  <rect x="232" y="28" width="10" height="10" fill="#3a4258"/>
  <rect x="0" y="112" width="320" height="38" fill="#14100c"/>
  <rect x="40" y="30" width="160" height="110" fill="url(#glow72)"/>
  <g transform="translate(150,58)" opacity="0.55">
    <rect x="44" y="6" width="8" height="54" fill="#161320"/>
    <rect x="8" y="34" width="38" height="26" fill="#23222e"/>
    <rect x="20" y="26" width="14" height="10" fill="#5a5260"/>
    <rect x="17" y="6" width="22" height="24" fill="#5a5260"/>
    <rect x="15" y="2" width="26" height="12" fill="#141019"/>
    <rect x="13" y="8" width="6" height="20" fill="#141019"/>
    <rect x="37" y="8" width="6" height="22" fill="#141019"/>
    <rect x="22" y="18" width="3" height="2" fill="#7a8aa0"/>
    <rect x="31" y="18" width="3" height="2" fill="#7a8aa0"/>
  </g>`;
}

// ── 信息带 · 时钟列（168px·余烬色 VT323·感情温度已凉，时钟亦失了磷光·不 glow）──────
function clockCol(): LayoutNode {
  return {
    type: 'Panel', id: 'gx-abs72-clockcol', props: { bg: { custom: '#08060c' } },
    layout: { width: 168, height: 172, direction: 'column', justify: 'center', padding: 16, gap: 8 },
    children: [
      {
        type: 'Panel', id: 'gx-abs72-clockrow', props: { bare: true },
        layout: { direction: 'row', gap: 4, align: 'end' },
        children: [
          // 23:48 余烬橙（#7a5a2a → 最近令牌 gold·设计稿已大幅压暗·不加 glow）
          { type: 'Label', id: 'gx-abs72-clock', props: { text: '23:48', font: 'display', color: 'gold', size: 'xl' } },
          // 秒 02（更暗·warn 近似）
          { type: 'Label', id: 'gx-abs72-sec', props: { text: '02', font: 'display', color: 'warn', size: 'lg' } },
        ],
      },
      // 日期 6月29日 周一（暗琥珀·gold 近似 #6a5530）
      { type: 'Label', id: 'gx-abs72-date', props: { text: '6月29日 周一', font: 'display', color: 'gold', size: 'md', tracking: 1 } },
      // 新月 🌑 —（天气/心情都熄了·dim 近似 #564c60）
      { type: 'Label', id: 'gx-abs72-moon', props: { text: '🌑 —', color: 'dim', size: 'sm' } },
    ],
  };
}

// ── 信息带 · 文案列（NOW 状态 + RETURN 提示·设计稿右侧 flex 区）───────────────────
function statusCol(): LayoutNode {
  const micro = (id: string, text: string): LayoutNode =>
    ({ type: 'Label', id, props: { text, font: 'pixel', color: 'dim', size: 'xs', tracking: 2 } });
  return {
    type: 'Panel', id: 'gx-abs72-statuscol', props: { bare: true },
    layout: { width: 472, height: 172, direction: 'column', justify: 'center', padding: 22, gap: 12 },
    children: [
      {
        type: 'Panel', id: 'gx-abs72-now', props: { bare: true },
        layout: { direction: 'column', gap: 5 },
        children: [
          micro('gx-abs72-now-l', 'NOW'),
          // 设计稿 #9a8da2 → sub
          { type: 'Label', id: 'gx-abs72-now-t', props: { text: '灯关了。屏幕的光映在她脸上。她还在。', color: 'sub', size: 'md' } },
        ],
      },
      {
        type: 'Panel', id: 'gx-abs72-return', props: { bare: true },
        layout: { direction: 'column', gap: 4 },
        children: [
          micro('gx-abs72-return-l', 'RETURN →'),
          // 设计稿 #8a7d92 → sub
          { type: 'Label', id: 'gx-abs72-return-t', props: { text: '她只会说一句"回来了"', color: 'sub', size: 'sm' } },
        ],
      },
    ],
  };
}

export function absence72Screen(): LayoutNode {
  return deviceShell({
    id: 'gx-absence-72h',
    chip: '+72H · 她关了灯，只有屏幕微光',
    interiorBg: '#0a0810', // 设计稿内屏底=关灯黑（非默认黄昏紫）
    interior: [
      // 上场景区 640×300（黑屋 + 显示器冷光）+ 右上 AWAY 药丸（绝对定位）
      {
        type: 'Panel', id: 'gx-abs72-stage', props: { bg: { custom: '#0a0810' } },
        layout: { width: 640, height: 300, direction: 'column' },
        children: [
          {
            type: 'Image', id: 'gx-abs72-scene',
            props: { src: svgUri(darkRoomScene(), '0 0 320 150'), fit: 'cover' },
            layout: { width: 640, height: 300 },
          },
          // 右上状态药丸「○ AWAY 72H」（设计稿 right:12 top:12·Silkscreen 暗字暗框）
          {
            type: 'Panel', id: 'gx-abs72-away', props: { bg: { custom: 'rgba(10,8,16,.7)' } },
            layout: { x: 504, y: 12, direction: 'row', align: 'center', padding: 6 },
            children: [
              { type: 'Label', id: 'gx-abs72-away-t', props: { text: '○ AWAY 72H', font: 'pixel', color: 'dim', size: 'xs', tracking: 1 } },
            ],
          },
        ],
      },
      // 信息带 640×172（顶部一条 #15101e 分隔线 + 两列）
      {
        type: 'Panel', id: 'gx-abs72-band', props: { bg: { custom: '#08060c' } },
        layout: { width: 640, height: 172, direction: 'row' },
        children: [clockCol(), statusCol()],
      },
      // 最底情感温度线 640×8（冷蓝渐变·温度跌到底·设计稿精确 hex）
      {
        type: 'Panel', id: 'gx-abs72-temp',
        props: { bg: { custom: 'linear-gradient(90deg,#2a4258 0%,#33405a 70%,#3a3a54 100%)' } },
        layout: { width: 640, height: 8 },
      },
    ],
  });
}
