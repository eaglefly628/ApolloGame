// Game G · 掷命手感曲线（design/15 ·「有趣」最后一公里 · 纯表现时间/强度函数）。
// 渲染器(three-renderer)消费它把"匀速翻牌"演成"命运一掷"：顶点**滞空(屏息)** + 落定**金石对比**。
// ⛔ 红线（design/15 §八）：全表现层 —— **不进 hash、不读 sim 真相之外、不回灌胜负**；各端时长可不同 → 多人安全。
// 全是纯函数（无 Three.js / 无 DOM）→ headless 可测；手感=「演结果」，永不「改结果」。

/** 钳到 [0,1]。 */
export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** 平滑阶跃 smoothstep：x≤a→0、x≥b→1、之间 3t²−2t³（端点导数为 0，过渡无棱角）。 */
export function smoothstep(a: number, b: number, x: number): number {
  if (a === b) return x < a ? 0 : 1;
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/**
 * 顶点滞空时间重映射（命门）：把匀速进度 t∈[0,1] 映成视觉进度 s∈[0,1]，两端快、apex(中段)慢 → "屏息一刻"。
 *   s = t + k·sin(2πt)/(2π)，k∈[0,1)。端点 s(0)=0、s(1)=1、s(0.5)=0.5；
 *   s'(t)=1+k·cos(2πt) → s'(0.5)=1−k(最慢=滞空)、s'(0)=s'(1)=1+k(最快=快抛快落)。
 * k<1 保证 s'>0 处处单调（不回放/不抖动）。k 越大滞空越明显（缺省 0.6）。配合 leap=sin(π·s)：apex 处停一拍。
 */
export function hangWarp(t: number, k = 0.6): number {
  const c = clamp01(t);
  return c + (k * Math.sin(2 * Math.PI * c)) / (2 * Math.PI);
}

/** 落定揭晓强度：t 接近 1（落地一刻）时 0→1 —— 金光/石暗在"落地那拍"兑现，不是一路渐亮。 */
export function revealGlow(t: number): number {
  return smoothstep(0.78, 1, t);
}

/** 既定面是否正面（朝镜头）：落定角 cos>0 = 正面(活)。渲染据此选 金光(活) / 石暗(死)。 */
export function faceUpVisible(rot: number): boolean {
  return Math.cos(rot) > 0;
}

/**
 * 逐路揭晓（VIS-4 · design/16 §九）：把整局进度 prog 映成**某路**的视觉进度——上路(0)先翻、下路(2)后翻，
 * 制造"2:1 还能不能翻盘"的连续悬念（best-of-3 的心跳）。lead=每路错开量；至 prog=1 各路都落定(=1)。
 * 纯表现重映射（不改胜负、不进 hash）；渲染器用它驱动该路的 抛飞弧/翻面/金石揭晓 的时序。
 */
export function laneRevealProgress(prog: number, lane: number, lead = 0.16): number {
  return clamp01((clamp01(prog) - lane * lead) / Math.max(0.001, 1 - 2 * lead));
}

/** easeOutCubic：1-(1-x)³，落定收尾的缓出（逐路揭晓重导翻面角用）。 */
export function easeOutCubic(x: number): number {
  const t = 1 - clamp01(x);
  return 1 - t * t * t;
}

export const ALIVE_GLOW = 0.6; // 正面(活)：自色 emissive 强度峰值（立绘亮）
export const DEAD_DIM = 0.5; // 反面(死)：背面石板压暗比例（沉灰）
