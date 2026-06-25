// 自托管字体（owner 2026-06-21「美术资源落自家库·不引用外部库」）：原本 3 个渲染器各内联一段
// Google Fonts <link>（外部资产库依赖）。改为把字体子集化(只留游戏用到的 ~2200 字形)·woff2 收进
// src/games/game-g/assets/fonts/，由 Vite 打包发出，本地 @font-face 引用。零外部网络依赖。
// CJK(思源/手写/毛笔)按字形子集，拉丁全量；思源黑/宋为可变字重(400–900)单文件。
import silk400 from './assets/fonts/silkscreen-400.woff2';
import silk700 from './assets/fonts/silkscreen-700.woff2';
import raj500 from './assets/fonts/rajdhani-500.woff2';
import raj600 from './assets/fonts/rajdhani-600.woff2';
import raj700 from './assets/fonts/rajdhani-700.woff2';
import cor500 from './assets/fonts/cormorant-500.woff2';
import cor600 from './assets/fonts/cormorant-600.woff2';
import cor700 from './assets/fonts/cormorant-700.woff2';
import notosans from './assets/fonts/notosanssc.woff2';
import notoserif from './assets/fonts/notoserifsc.woff2';
import zhimang from './assets/fonts/zhimangxing.woff2';
import mashan from './assets/fonts/mashanzheng.woff2';

const face = (family: string, weight: string, url: string): string =>
  `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(${url}) format('woff2')}`;

// 注入文档头的本地字体样式（替代外部 <link>）。各渲染器 import 此常量。
export const FONTS = `<style>${[
  face('Silkscreen', '400', silk400), face('Silkscreen', '700', silk700),
  face('Rajdhani', '500', raj500), face('Rajdhani', '600', raj600), face('Rajdhani', '700', raj700),
  face('Cormorant Garamond', '500', cor500), face('Cormorant Garamond', '600', cor600), face('Cormorant Garamond', '700', cor700),
  face('Noto Sans SC', '400 900', notosans), // 可变字重单文件
  face('Noto Serif SC', '400 900', notoserif),
  face('Zhi Mang Xing', '400', zhimang), face('Ma Shan Zheng', '400', mashan),
].join('')}</style>`;
