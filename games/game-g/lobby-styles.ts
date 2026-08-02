// Game G · 大厅设计令牌 CSS（双皮变量 + 基础重置 + keyframes·纯样式字符串·零依赖）。
// 去腐 2026-06-28：手写 DOM 旧大厅删除后，其专属 class 样式（.felt-h/.dcard/.pcard/.deck-nav/.ench-*/.hero-*/.ldr-* …）全成死 CSS（~310 行）已剪。
// 数据驱动大厅（lobby-dd + 各 *-screen）走 LayoutNode 内联样式，只借这里的设计令牌 var(--felt/--gold/--chip/--ink/--panel…) + 字体。
// game-f 有自己本地的 LOBBY_CSS，不依赖本文件。
export const LOBBY_CSS = `
@keyframes ggl-sheen { 0% { background-position:-130% 0 } 100% { background-position:230% 0 } }
@keyframes ggl-float { 0%,100% { transform:translateY(0) rotate(var(--rot,0deg)) } 50% { transform:translateY(-12px) rotate(var(--rot,0deg)) } }
@keyframes ggl-pulse { 0%,100% { opacity:.45 } 50% { opacity:1 } }
@keyframes ggl-fadein { from{ opacity:0; transform:translateY(7px) } to{ opacity:1; transform:translateY(0) } }
@keyframes ggl-glow { 0%,100%{ box-shadow:0 0 22px rgba(232,205,130,.5),inset 0 1px 0 rgba(255,255,255,.5) } 50%{ box-shadow:0 0 50px rgba(232,205,130,.95),inset 0 1px 0 rgba(255,255,255,.65) } }
.ggl-root[data-skin="onyx"]{ --ink:#e7edf3; --ink-dim:#7e8c9b; --gold:#e8cd82; --gold-grad:linear-gradient(180deg,#f5e6ad,#c69a44);
  --paper:radial-gradient(120% 120% at 50% -8%,#1d2d42 0%,#0f1b29 55%,#070e17 100%);
  --panel:radial-gradient(130% 95% at 22% 10%,rgba(82,120,158,.30),transparent 56%),linear-gradient(165deg,#1a2a3c,#0f1c2a);
  --panel-border:#3a516e; --hairline:rgba(232,205,138,.24); --chip:rgba(255,255,255,.05); --track:rgba(0,0,0,.5);
  --frame-edge:#2a3a4e; --felt:radial-gradient(120% 110% at 50% 26%,#3a6b5b 0%,#274e43 46%,#15302a 100%); --felt-edge:#1a3a2e;
  --spade:#8ba2c9; --heart:#d8504e; --diamond:#e0973a; --club:#3fae6e;
  --chamfer:polygon(13px 0,100% 0,100% calc(100% - 13px),calc(100% - 13px) 100%,0 100%,0 13px);
  --hp:#46d17a; --danger:#ff5d62;
  --fd:'Zhi Mang Xing',cursive; --fh:'Rajdhani',sans-serif; --fb:'Noto Sans SC',sans-serif; --fn:'Silkscreen',monospace; }
.ggl-root[data-skin="rosy"]{ --ink:#5a3f44; --ink-dim:#a98b8f; --gold:#cf9a3f; --gold-grad:linear-gradient(180deg,#f3e2a4,#cf9a3f);
  --paper:radial-gradient(120% 120% at 50% -10%,#fdf4ee 0%,#f3e2dc 60%,#ecd6cf 100%);
  --panel:radial-gradient(130% 95% at 22% 10%,rgba(216,170,120,.20),transparent 56%),linear-gradient(165deg,#fffaf3,#f8e7d6);
  --panel-border:#e0c290; --hairline:rgba(207,154,63,.5); --chip:rgba(255,255,255,.55); --track:rgba(150,110,90,.18);
  --frame-edge:#6b4a2e; --felt:radial-gradient(120% 110% at 50% 26%,#c97f86 0%,#b15f6b 46%,#8c4654 100%); --felt-edge:#6e3a44;
  --spade:#4a6390; --heart:#c14b66; --diamond:#b8862f; --club:#2f8f56;
  --chamfer:polygon(13px 0,100% 0,100% calc(100% - 13px),calc(100% - 13px) 100%,0 100%,0 13px);
  --hp:#2f8f6b; --danger:#d65668;
  --fd:'Ma Shan Zheng',cursive; --fh:'Cormorant Garamond',serif; --fb:'Noto Serif SC',serif; --fn:'Silkscreen',monospace; }
.ggl-root{ background:#0c0a08; color:var(--ink); font-family:'Noto Sans SC',sans-serif; box-sizing:border-box; user-select:none; -webkit-user-select:none; cursor:default }
.ggl-root *{ box-sizing:border-box; margin:0 }
.ggl-root button{ font-family:inherit; cursor:pointer } .ggl-root button:disabled{ opacity:.5; cursor:not-allowed }
.ggl-root [data-act]{ cursor:pointer }
.ggl-root input,.ggl-root textarea{ user-select:text; -webkit-user-select:text; cursor:text }
`;
