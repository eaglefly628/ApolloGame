import { parseManifest } from './assembly/manifest.js';
import { runBlueprintInto } from './studio/cart-run-core.js';

// ═══════════════════════════════════════════════════════════════
//  离线单文件卡带引导（发布线·game-publisher/Lead 域）
//
//  数据游戏 = 一份 manifest 纯 JSON（library/<slug>）。在线时 DataCartridgeRunner
//  靠 fetch(/api/library/<slug>/manifest) 取它；离线单 HTML（file:// 双击即玩）里
//  没有服务器可 fetch —— 于是 scripts/package-web.mjs 把该 manifest 内联进
//  window.__APOLLO_INLINE_CART__，本模块读它、走既有 parseManifest + 引擎 load 路径
//  直接跑，跳过 fetch。宪法对味：游戏=数据·引擎=解释器·打包=引擎 bundle + 内联数据。
//
//  与在线路径共用同一 runBlueprintInto（cart-run-core）——同一装载探针/输入/生命周期，
//  绝不出现「在线能跑、打成包跑不了」的两套语义漂移。
// ═══════════════════════════════════════════════════════════════

/** 读注入的内联 manifest 对象；未注入=明确报错（不静默白屏）。导出供单测。 */
export function readInlineCart(win: Window = window): unknown {
  const cart = win.__APOLLO_INLINE_CART__;
  if (cart == null) {
    throw new Error(
      '未找到内联卡带数据（window.__APOLLO_INLINE_CART__）——' +
      '此 HTML 应由 scripts/package-web.mjs 打包生成，请勿手工改动其 <head> 注入段。',
    );
  }
  return cart;
}

/** GameModule.mount 契约：挂载即跑内联 manifest，返回清理函数。 */
export function mount(el: HTMLElement): () => void {
  const raw = readInlineCart();
  const blueprint = parseManifest(raw);
  // 单文件全屏：视口取容器实测尺寸（回退到卡带默认 960×600）。
  const w = el.clientWidth || 960;
  const h = el.clientHeight || 600;
  return runBlueprintInto(el, blueprint, { w, h });
}
