// scripts/lib/pixel-qa.mjs —— 像素级机器断言（REQ-3D-像素断言·纯函数·零浏览器·零依赖）
//
//  治的病：`shoot-game.mjs` 截图只进人眼——「黑屏假绿 / 糊成一团 / 冻结假活」机器判不出。
//  药方＝把截图当客观判定器：解码像素读三件事——
//   ① 非黑占比（nonBlack）    ：亮度 > 暗阈的像素占比 → 防黑屏（渲染真出画面·非全黑假绿）。
//   ② 对比度（contrast）      ：亮度直方图 p5..p95 动态范围 → 防「糊成一团/纯色板」（画面有明暗层次）。
//   ③ 帧活动（activity）      ：相隔两帧逐像素亮度差均值 → 防冻结（动画/粒子/相机在动·非静止假活）。
//  纯函数（喂解码后像素·出判定）——同 render-harness.decodePNG 的可测哲学：不起浏览器就能单测/标定。
//  阈值绝不拍脑袋——对存量场景（game-z + game-i 展台）实测分布定草案（见 REQ 回执标定表）。

// Rec.709 亮度（人眼加权·同 CSS/视频口径）。像素 0..255 → 亮度 0..255。
export function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// 逐像素取亮度（按通道数兼容 gray/gray+α/RGB/RGBA·忽略 α）。返回 Float64Array（长度 = 像素数）。
export function lumaField(img) {
  const { width, height, channels, pixels } = img;
  const n = width * height;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * channels;
    if (channels >= 3) out[i] = luma(pixels[p], pixels[p + 1], pixels[p + 2]);
    else out[i] = pixels[p]; // 灰度：单通道即亮度
  }
  return out;
}

// 单帧分析：非黑占比 + 亮度动态范围（百分位抗离群点·非纯 min/max）+ 均值。
//  darkThreshold：低于此亮度算「黑」（缺省 16/255·抗 JPEG/抗锯齿暗噪）。
export function analyzeFrame(img, { darkThreshold = 16 } = {}) {
  const lum = lumaField(img);
  const n = lum.length;
  if (n === 0) return { nonBlackRatio: 0, p5: 0, p95: 0, dynamicRange: 0, mean: 0, count: 0 };
  let nonBlack = 0, sum = 0;
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    const v = lum[i];
    sum += v;
    if (v > darkThreshold) nonBlack++;
    hist[Math.min(255, Math.max(0, Math.round(v)))]++;
  }
  const p5 = percentileFromHist(hist, n, 0.05);
  const p95 = percentileFromHist(hist, n, 0.95);
  return {
    nonBlackRatio: nonBlack / n,
    p5, p95,
    dynamicRange: p95 - p5, // 直方图动态范围（0..255·越大越有明暗层次）
    mean: sum / n,
    count: n,
  };
}

// 从 256-bin 直方图取百分位亮度（累积到 q·线性扫描·纯确定）。
function percentileFromHist(hist, total, q) {
  const target = q * total;
  let acc = 0;
  for (let b = 0; b < 256; b++) {
    acc += hist[b];
    if (acc >= target) return b;
  }
  return 255;
}

// 两帧活动度：逐像素亮度差绝对值的均值（0..255）。尺寸不符 → 抛（防喂错帧）。
export function frameActivity(imgA, imgB) {
  const a = lumaField(imgA), b = lumaField(imgB);
  if (a.length !== b.length) throw new Error(`帧尺寸不符（${a.length} vs ${b.length}）`);
  if (a.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

// 草案阈值（REQ-3D-像素断言·对 game-z + game-i 展台实测分布定·标定表见本单回执·非拍脑袋）。
//  取实测最小值下方留裕度：非黑占比宽松（UI 游戏大片留白也得过）、动态范围要真有层次、活动>epsilon 防纯静止。
export const DRAFT_THRESHOLDS = {
  minNonBlackRatio: 0.05,  // ≥5% 像素非黑（防全黑屏·纯 DOM UI 游戏留白多故取低）
  minDynamicRange: 24,     // p5..p95 亮度跨度 ≥24（防糊成纯色一团）
  minActivity: 0.15,       // 两帧亮度差均值 ≥0.15（防完全冻结·真渲染总有微动/抗锯齿抖动）
  darkThreshold: 16,
};

// 三断言汇总判定。frameB 省略 → 跳过帧活动断言（单帧静态截图场景）。
//  返回 { pass, assertions:{nonBlack,contrast,activity}, metrics }——每条 {pass, value, threshold}。
export function assertPixelQA({ frameA, frameB, thresholds = DRAFT_THRESHOLDS }) {
  const t = { ...DRAFT_THRESHOLDS, ...thresholds };
  const a = analyzeFrame(frameA, { darkThreshold: t.darkThreshold });
  const nonBlack = { pass: a.nonBlackRatio >= t.minNonBlackRatio, value: a.nonBlackRatio, threshold: t.minNonBlackRatio };
  const contrast = { pass: a.dynamicRange >= t.minDynamicRange, value: a.dynamicRange, threshold: t.minDynamicRange };
  const assertions = { nonBlack, contrast };
  let activityVal;
  if (frameB) {
    activityVal = frameActivity(frameA, frameB);
    assertions.activity = { pass: activityVal >= t.minActivity, value: activityVal, threshold: t.minActivity };
  }
  const pass = Object.values(assertions).every((x) => x.pass);
  return { pass, assertions, metrics: { ...a, activity: activityVal } };
}
