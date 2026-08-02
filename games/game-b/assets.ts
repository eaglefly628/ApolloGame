// Game B ·《雀宴》—— 本地美术索引装载（vendoring 模型·REQ-Resource ⑤）。
// 真相文件=public/games/game-b/art/index.json（scripts/vendor-asset.mjs 产·B-007 占位包：
// FluffyStuff riichi 牌面 40 张 PNG·CC0·provenance 在条目里）；游戏只引本地拷贝、不直引共享货架。
// 消费路线=game-q 先例：运行时 fetch 本地索引 → registerAssetIndex 统一桥接（path 站点绝对 → baseUrl ''）。
import { AssetManager, ImageAssetLoader, parseAssetIndex, registerAssetIndex } from '@zerocraft/engine/assets/index.js';

export const ART_INDEX_URL = '/games/game-b/art/index.json';

/** 建资产管理器并异步装载本地占位美术（贴图未就绪时渲染器回退纯色·就绪自动挂上）。
 *  ready：装载收尾信号——静态场景的脏帧跳渲不会自己发现「贴图迟到」，宿主用它调 renderer.invalidate()
 *  强制补一帧（公开 API·game-z 调参先例；引擎侧通用化缺口已提 requests.md）。 */
export function createGameBAssets(): { assets: AssetManager; ready: Promise<void> } {
  const assets = new AssetManager(new ImageAssetLoader());
  const ready = (async () => {
    try {
      const r = await fetch(ART_INDEX_URL, { cache: 'no-store' });
      if (!r.ok) return; // 索引缺失=占位色兜底（不炸装载）
      registerAssetIndex(assets, parseAssetIndex(await r.json()));
      await assets.loadAll();
    } catch {
      /* headless/离线：静默走纯色回退 */
    }
  })();
  return { assets, ready };
}
