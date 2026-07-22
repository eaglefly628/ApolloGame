// art-overrides.ts —— game-a 生成/替换美术消费槽（A-023·REQ-ART 可消费槽铁律·mirror game-c）。
//
// 链路：台账行（skinKey `game-a/<slot>`）→ 工坊 art-replace 按 **skinKey 别名**登记进
//   `public/games/game-a/art/index.json`（id=skinKey·top-level source `gen:`/`vendored` 或 tags 含 'skin'）
//   → mount 期 `loadArtOverrides` 拉索引 → 覆盖注册表；消费点 `artUri(skinKey, 内置回退)` 先查覆盖、未命中回退内置占位。
// **真图未到 = 观感零字节变化**（兜底永不丢·Lead 红线）；工坊换图 → 索引写别名 → mount 拉到 → 热替换上画。
// render-only·不进 sim/hash·蓝图/确定性零影响。
import { AssetManager, ImageAssetLoader, parseAssetIndex, registerAssetIndex } from '@assets/index.js';

const _overrides = new Map<string, string>();

/** 登记美术覆盖（{ 'game-a/bg/menu': url, … }）。只收非空 URL。 */
export function registerArtOverrides(map: Record<string, string>): void {
  for (const [k, v] of Object.entries(map)) if (v) _overrides.set(k, v);
}
/** 清空覆盖（测试用·保回归确定性）。 */
export function clearArtOverridesForTest(): void { _overrides.clear(); }
export function artOverrideCount(): number { return _overrides.size; }

/** 按 skinKey 解析美术 URL：工坊覆盖真图优先·未命中回退内置占位（换图即生效·真图未到零变）。 */
export function artUri(skinKey: string, fallback: string): string {
  return _overrides.get(skinKey) ?? fallback;
}

/**
 * 按 skinKey 取覆盖真图 URL·**无内置回退**（未注册 = undefined）。
 * 用于「无兜底占位·空就不画」的可选美术槽（如对手默认立绘·owner 2026-07-22「空就不画」）——
 * 区别 artUri（有硬编码占位兜底永不丢）。工坊/index 注册真图后即命中。
 */
export function artOverride(skinKey: string): string | undefined {
  return _overrides.get(skinKey);
}

/**
 * 从本地美术库索引载入**真图替换**条目 → 返回 { skinKey: url } 覆盖表。
 * 只收 art-replace 写回的 skinKey 别名（id 以 `<slug>/` 开头 + 正向 AI 信号：top-level source 以 `gen:`/`vendored`
 * 开头，或 tags 含 'skin'）——原生货架/程序占位（不带 `game-a/` 前缀或无信号）**不进** = 观感零变。
 * 失败/无索引/无 fetch（headless）= 空对象（消费点回退内置）。render-only。
 */
/** 建空皮肤 AssetManager（mount 期创建·传给 3D ThreeRenderer·随后 loadSkinIndex 异步填充）。 */
export function makeSkinAssets(): AssetManager {
  return new AssetManager(new ImageAssetLoader());
}
/**
 * 把本地美术索引注册进皮肤 AssetManager（3D `Material3D.map` 按 **key** 解析·区别 2D artUri 的 URL 路）。
 * 3D 呢面贴图（game-a/table/felt-albedo|normal）就绪后 ThreeRenderer 按 key 取真图挂上（异步就绪→mesh 自动重建）；
 * 未就绪/无真图 = map 解析 null → 回退 preset 色。失败/headless = 空 manager（回退色·兜底永不丢）。render-only。
 */
export async function loadSkinIndex(manager: AssetManager, slug = 'game-a'): Promise<void> {
  try {
    if (typeof fetch !== 'function') return;
    const r = await fetch(`/games/${slug}/art/index.json`, { cache: 'no-cache' });
    if (!r.ok) return;
    registerAssetIndex(manager, parseAssetIndex(await r.json()));
    await manager.loadAll();
  } catch {
    /* headless/无索引/解析失败 → manager 保持空 → Material3D.map 解析 null → 回退 preset 色 */
  }
}

export async function loadArtOverrides(slug = 'game-a'): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    if (typeof fetch !== 'function') return out;
    const r = await fetch(`/games/${slug}/art/index.json`, { cache: 'no-cache' });
    if (!r.ok) return out;
    const idx = (await r.json()) as { assets?: Array<{ id?: string; path?: string; source?: string; tags?: string[] }> };
    for (const a of idx.assets ?? []) {
      if (typeof a.id !== 'string' || !a.path || !a.id.startsWith(`${slug}/`)) continue; // 只收 skinKey 别名命名空间
      const isReal =
        (typeof a.source === 'string' && (a.source.startsWith('gen:') || a.source.startsWith('vendored'))) ||
        (Array.isArray(a.tags) && a.tags.includes('skin')); // 正向 AI 信号：art-replace 别名·非原生货架
      if (isReal) out[a.id] = a.path;
    }
    return out;
  } catch {
    return out;
  }
}
