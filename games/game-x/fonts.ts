// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— 像素字体加载（宿主表现层·与资产加载同侧）
//
//  注入 VT323 / DotGothic16 / Silkscreen（对齐 Designer bundle）。一次性注入、幂等。
//  这是宿主胶水（等同 AssetManager 拉美术），非游戏数据——游戏数据只引用字体槽名。
// ════════════════════════════════════════════════════════════════════════

const LINK_ID = 'gx-zankyou-fonts';
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=VT323&family=DotGothic16&family=Silkscreen:wght@400;700&display=swap';

export function ensureFonts(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(LINK_ID)) return;
  const link = document.createElement('link');
  link.id = LINK_ID;
  link.rel = 'stylesheet';
  link.href = FONT_CSS;
  document.head.appendChild(link);
}

// 关键帧（蒸汽/眨眼/磷光呼吸）：SVG 内联 SMIL 已带动画，这里补 chrome 侧用的 CSS 关键帧（情感线呼吸等）。
const KF_ID = 'gx-zankyou-kf';
export function ensureKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KF_ID)) return;
  const style = document.createElement('style');
  style.id = KF_ID;
  style.textContent = `
    @keyframes gx-glow { 0%,100%{opacity:.85} 50%{opacity:1} }
    @keyframes gx-blink-cursor { 0%,49%{opacity:1} 50%,100%{opacity:0} }
  `;
  document.head.appendChild(style);
}
