// Game K · Zombie Slots —— 符号程序化美术（宿主表现层·outcome-first 投影·不碰 sim）。
//
// 风格：迪士尼亲和（大而圆润的轮廓、夸张大眼、一眼可读）× 次表面散射（暖色内发光透出腐肉、
// 边缘冷光、黏腻高光——用分层径向渐变伪造）。零外部图片；离屏烘焙一次后缩放贴出，动画顺滑。
import { SYM } from './theme.js';

const RES = 200;
const cache: Record<number, HTMLCanvasElement> = {};

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// 次表面填充：外层腐肉 + 内层暖光核（光从内部透出）。
function sss(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, hue: number, core = hue + 20): void {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0.0, `hsla(${core},85%,82%,1)`);
  g.addColorStop(0.45, `hsla(${hue},70%,58%,1)`);
  g.addColorStop(0.82, `hsla(${hue - 8},62%,40%,1)`);
  g.addColorStop(1.0, `hsla(${hue - 14},55%,30%,1)`);
  ctx.fillStyle = g;
}
function rim(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, hue: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const g = ctx.createRadialGradient(cx, cy, r * 0.72, cx, cy, r * 1.02);
  g.addColorStop(0, `hsla(${hue},90%,70%,0)`);
  g.addColorStop(0.85, `hsla(${hue + 30},95%,78%,0.35)`);
  g.addColorStop(1, `hsla(${hue + 30},95%,82%,0)`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.02, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look = 0.15, glow = '#c9ffe0'): void {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, glow); g.addColorStop(1, 'rgba(120,170,140,0.9)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0a1410'; ctx.beginPath(); ctx.arc(x + r * look, y + r * 0.1, r * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(x + r * look - r * 0.18, y - r * 0.1, r * 0.18, 0, Math.PI * 2); ctx.fill();
}
function stitch(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, n: number, col = 'rgba(20,40,25,0.7)'): void {
  ctx.strokeStyle = col; ctx.lineWidth = RES * 0.012;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  for (let i = 0; i <= n; i++) {
    const t = i / n, mx = x1 + (x2 - x1) * t, my = y1 + (y2 - y1) * t;
    const dx = -(y2 - y1), dy = x2 - x1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, s = RES * 0.03;
    ctx.beginPath(); ctx.moveTo(mx - ux * s, my - uy * s); ctx.lineTo(mx + ux * s, my + uy * s); ctx.stroke();
  }
}

function boneLetter(ctx: CanvasRenderingContext2D, letter: string, hue: number): void {
  const c = RES / 2;
  ctx.save();
  rounded(ctx, RES * 0.16, RES * 0.12, RES * 0.68, RES * 0.76, RES * 0.12);
  const sg = ctx.createLinearGradient(0, RES * 0.12, 0, RES * 0.88);
  sg.addColorStop(0, `hsla(${hue},30%,42%,1)`); sg.addColorStop(1, `hsla(${hue},35%,22%,1)`);
  ctx.fillStyle = sg; ctx.fill(); ctx.clip();
  const gg = ctx.createRadialGradient(c, RES * 0.44, RES * 0.05, c, RES * 0.5, RES * 0.5);
  gg.addColorStop(0, `hsla(${hue + 20},90%,70%,0.55)`); gg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gg; ctx.fillRect(0, 0, RES, RES);
  ctx.restore();
  ctx.save();
  ctx.font = `900 ${RES * 0.46}px "Trebuchet MS", Arial, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = `hsla(${hue + 25},95%,65%,0.9)`; ctx.shadowBlur = RES * 0.09;
  const lg = ctx.createLinearGradient(0, RES * 0.3, 0, RES * 0.72);
  lg.addColorStop(0, `hsl(${hue + 30},90%,82%)`); lg.addColorStop(1, `hsl(${hue + 10},80%,55%)`);
  ctx.fillStyle = lg; ctx.fillText(letter, c, RES * 0.52);
  ctx.restore();
}

function hound(ctx: CanvasRenderingContext2D): void {
  const cx = RES / 2, cy = RES * 0.56, r = RES * 0.32, hue = 96;
  rim(ctx, cx, cy, r * 1.15, hue);
  for (const s of [-1, 1]) { sss(ctx, cx + s * r * 0.7, cy - r * 0.7, r * 0.5, hue); ctx.beginPath(); ctx.ellipse(cx + s * r * 0.72, cy - r * 0.55, r * 0.22, r * 0.5, s * 0.5, 0, Math.PI * 2); ctx.fill(); }
  sss(ctx, cx, cy, r, hue); ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 1.02, 0, 0, Math.PI * 2); ctx.fill();
  sss(ctx, cx, cy + r * 0.45, r * 0.6, hue, hue + 30); ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.5, r * 0.55, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  stitch(ctx, cx + r * 0.15, cy - r * 0.3, cx + r * 0.55, cy + r * 0.1, 4);
  eye(ctx, cx - r * 0.42, cy - r * 0.15, r * 0.24, 0.2); eye(ctx, cx + r * 0.4, cy - r * 0.22, r * 0.19, -0.1);
  ctx.fillStyle = '#20321f'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.4, r * 0.16, r * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'hsl(340,70%,60%)'; rounded(ctx, cx - r * 0.12, cy + r * 0.5, r * 0.24, r * 0.4, r * 0.1); ctx.fill();
  ctx.fillStyle = '#f4ffe9'; ctx.beginPath(); ctx.moveTo(cx + r * 0.18, cy + r * 0.52); ctx.lineTo(cx + r * 0.28, cy + r * 0.52); ctx.lineTo(cx + r * 0.23, cy + r * 0.68); ctx.closePath(); ctx.fill();
}
function bride(ctx: CanvasRenderingContext2D): void {
  const cx = RES / 2, cy = RES * 0.5, r = RES * 0.3, hue = 300;
  rim(ctx, cx, cy, r * 1.25, hue);
  ctx.fillStyle = 'hsla(275,45%,30%,1)'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.15, r * 1.15, r * 1.3, 0, 0, Math.PI * 2); ctx.fill();
  rim(ctx, cx, cy + r * 0.1, r * 1.3, hue + 20);
  sss(ctx, cx, cy, r, hue, hue + 25); ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.85, r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'hsla(340,90%,70%,0.35)';
  ctx.beginPath(); ctx.arc(cx - r * 0.45, cy + r * 0.28, r * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.45, cy + r * 0.28, r * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  eye(ctx, cx - r * 0.34, cy - r * 0.05, r * 0.26, 0.05, '#eaffff'); eye(ctx, cx + r * 0.34, cy - r * 0.05, r * 0.26, -0.05, '#eaffff');
  ctx.strokeStyle = '#160a18'; ctx.lineWidth = RES * 0.014; ctx.lineCap = 'round';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * r * 0.34, cy - r * 0.05, r * 0.28, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
  stitch(ctx, cx - r * 0.3, cy + r * 0.5, cx + r * 0.3, cy + r * 0.5, 4, 'rgba(60,20,50,0.8)');
  for (let i = -2; i <= 2; i++) {
    const fx = cx + i * r * 0.42, fy = cy - r * 0.92 + Math.abs(i) * r * 0.08;
    ctx.fillStyle = `hsl(${300 + i * 12},75%,${65 + i}%)`;
    for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2; ctx.beginPath(); ctx.arc(fx + Math.cos(a) * r * 0.1, fy + Math.sin(a) * r * 0.1, r * 0.08, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'hsl(52,90%,70%)'; ctx.beginPath(); ctx.arc(fx, fy, r * 0.06, 0, Math.PI * 2); ctx.fill();
  }
}
function scientist(ctx: CanvasRenderingContext2D): void {
  const cx = RES / 2, cy = RES * 0.54, r = RES * 0.3, hue = 52;
  rim(ctx, cx, cy, r * 1.2, hue);
  ctx.fillStyle = 'hsla(200,20%,80%,1)';
  for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.4); ctx.lineTo(cx + Math.cos(a) * r * 1.35, cy - r * 0.4 + Math.sin(a) * r * 1.1); ctx.lineTo(cx + Math.cos(a + 0.2) * r * 0.9, cy - r * 0.4 + Math.sin(a + 0.2) * r * 0.7); ctx.closePath(); ctx.fill(); }
  sss(ctx, cx, cy, r, hue, hue + 15); ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.82, r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3a2a12'; ctx.lineWidth = RES * 0.03; ctx.beginPath(); ctx.moveTo(cx - r * 0.6, cy - r * 0.1); ctx.lineTo(cx + r * 0.6, cy - r * 0.1); ctx.stroke();
  for (const s of [-1, 1]) {
    const gx = cx + s * r * 0.36;
    const gg = ctx.createRadialGradient(gx, cy - r * 0.1, r * 0.05, gx, cy - r * 0.1, r * 0.3);
    gg.addColorStop(0, s < 0 ? 'rgba(180,255,120,0.9)' : 'rgba(120,220,255,0.85)'); gg.addColorStop(1, 'rgba(40,60,30,0.6)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(gx, cy - r * 0.1, r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#241a08'; ctx.lineWidth = RES * 0.02; ctx.beginPath(); ctx.arc(gx, cy - r * 0.1, r * 0.3, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#0a1004'; ctx.beginPath(); ctx.arc(gx + s * r * 0.05, cy - r * 0.08, r * 0.09, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#2a1408'; ctx.lineWidth = RES * 0.02; ctx.beginPath(); ctx.arc(cx, cy + r * 0.35, r * 0.35, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  ctx.fillStyle = '#eefbe0'; for (let i = -2; i <= 2; i++) { rounded(ctx, cx + i * r * 0.14 - r * 0.05, cy + r * 0.42, r * 0.1, r * 0.14, r * 0.02); ctx.fill(); }
}
function wild(ctx: CanvasRenderingContext2D): void {
  const cx = RES / 2, cy = RES * 0.52, r = RES * 0.32, hue = 120;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const halo = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 1.4);
  halo.addColorStop(0, 'hsla(120,90%,60%,0.5)'); halo.addColorStop(1, 'hsla(140,90%,60%,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  sss(ctx, cx, cy, r, hue, 90); ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.05, r * 0.9, r, 0, 0, Math.PI * 2); ctx.fill();
  sss(ctx, cx, cy + r * 0.6, r * 0.55, hue); rounded(ctx, cx - r * 0.5, cy + r * 0.4, r, r * 0.55, r * 0.2); ctx.fill();
  ctx.fillStyle = 'hsla(340,55%,60%,0.9)'; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(cx + i * r * 0.28, cy - r * 0.8 + Math.abs(i) * r * 0.05, r * 0.2, Math.PI, 0); ctx.fill(); }
  for (const s of [-1, 1]) {
    const ex = cx + s * r * 0.4;
    const gg = ctx.createRadialGradient(ex, cy, r * 0.02, ex, cy, r * 0.28);
    gg.addColorStop(0, '#eaffb0'); gg.addColorStop(0.5, 'hsl(110,100%,55%)'); gg.addColorStop(1, 'rgba(10,30,5,0.9)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(ex, cy, r * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#04150a'; ctx.beginPath(); ctx.arc(ex, cy, r * 0.11, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#f0ffe0'; for (let i = -2; i <= 2; i++) { rounded(ctx, cx + i * r * 0.16 - r * 0.06, cy + r * 0.45, r * 0.12, r * 0.2, r * 0.02); ctx.fill(); }
  banner(ctx, 'WILD', hue);
}
function scatter(ctx: CanvasRenderingContext2D): void {
  const cx = RES / 2, cy = RES * 0.48, r = RES * 0.3;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const halo = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.5);
  halo.addColorStop(0, 'hsla(80,95%,60%,0.55)'); halo.addColorStop(1, 'hsla(80,95%,60%,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, 'hsla(80,90%,80%,1)'); g.addColorStop(0.6, 'hsla(80,80%,50%,1)'); g.addColorStop(1, 'hsla(80,70%,28%,1)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = '#10240a';
  for (let k = 0; k < 3; k++) { ctx.rotate((Math.PI * 2) / 3); ctx.beginPath(); ctx.arc(0, -r * 0.55, r * 0.26, Math.PI * 0.15, Math.PI * 0.85, false); ctx.arc(0, -r * 0.2, r * 0.16, Math.PI * 1.85, Math.PI * 1.15, true); ctx.closePath(); ctx.fill(); }
  ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'hsl(80,90%,70%)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.09, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.3, r * 0.15, -0.6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  banner(ctx, 'FREE', 82);
}
function banner(ctx: CanvasRenderingContext2D, text: string, hue: number): void {
  const y = RES * 0.88;
  ctx.save();
  rounded(ctx, RES * 0.14, y - RES * 0.085, RES * 0.72, RES * 0.16, RES * 0.06);
  const g = ctx.createLinearGradient(0, y - RES * 0.09, 0, y + RES * 0.08);
  g.addColorStop(0, `hsl(${hue},60%,24%)`); g.addColorStop(1, `hsl(${hue},65%,14%)`);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = `hsl(${hue},80%,55%)`; ctx.lineWidth = RES * 0.01; ctx.stroke();
  ctx.font = `900 ${RES * 0.1}px "Trebuchet MS", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = `hsl(${hue},95%,60%)`; ctx.shadowBlur = RES * 0.05; ctx.fillStyle = `hsl(${hue},90%,82%)`;
  ctx.fillText(text, RES / 2, y); ctx.restore();
}

const DRAW: Record<number, (ctx: CanvasRenderingContext2D) => void> = {
  [SYM.T]: (c) => boneLetter(c, '10', 176),
  [SYM.J]: (c) => boneLetter(c, 'J', 210),
  [SYM.Q]: (c) => boneLetter(c, 'Q', 280),
  [SYM.K]: (c) => boneLetter(c, 'K', 42),
  [SYM.A]: (c) => boneLetter(c, 'A', 8),
  [SYM.DOG]: hound,
  [SYM.GIRL]: bride,
  [SYM.DOC]: scientist,
  [SYM.WILD]: wild,
  [SYM.SCAT]: scatter,
};

function baked(id: number): HTMLCanvasElement {
  if (cache[id]) return cache[id];
  const cv = document.createElement('canvas');
  cv.width = cv.height = RES;
  const ctx = cv.getContext('2d')!;
  (DRAW[id] ?? DRAW[SYM.T])(ctx);
  cache[id] = cv;
  return cv;
}

/** 把符号绘入 (x,y,size,size) 方格（缩放贴烘焙图）。 */
export function drawSymbol(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, size: number): void {
  ctx.drawImage(baked(id), x, y, size, size);
}
export function prewarm(): void { for (const k of Object.keys(DRAW)) baked(Number(k)); }
