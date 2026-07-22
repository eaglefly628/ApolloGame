// art-overrides.ts —— game-c 生成美术消费槽（REQ-C-112·owner 2026-07-22·mirror game-g art-textures 覆盖模式）。
//
// 链路：台账行（skinKey）→ 工坊生成真图 → art-replace 按 **skinKey 别名**登记进 public/games/game-c/art/index.json
//   （id=skinKey·top-level source='gen:<provider>'·tags 含 'skin'）→ mount 期 loadArtOverrides 拉索引注册到这里；
//   消费点（背幕等）先查覆盖、未命中回退程序化（STORY_BACKDROP 等）——**真图未到 = 观感零字节变化**（Lead 红线）。
// render-only·不进 sim/hash·蓝图/确定性零影响。
import { AssetManager, ImageAssetLoader, parseAssetIndex, registerAssetIndex } from '@assets/index.js';
import { STORY_BACKDROP } from './theme.js';

const _texOverrides = new Map<string, string>();

/** 登记贴图覆盖（{ 'game-c/scene/backdrop': url, … }）。只收非空 URL。 */
export function registerTextureOverrides(map: Record<string, string>): void {
  for (const [k, v] of Object.entries(map)) if (v) _texOverrides.set(k, v);
}
/** 查某槽当前真图 URL；无覆盖=null（消费点回退程序化）。 */
export function textureOverrideUri(key: string): string | null {
  return _texOverrides.get(key) ?? null;
}
/** 清空覆盖（测试用·保回归确定性）。 */
export function clearTextureOverridesForTest(): void { _texOverrides.clear(); }
export function textureOverrideCount(): number { return _texOverrides.size; }

/** 夜景背幕（台账槽 game-c/scene/backdrop）：真图覆盖优先·回退程序化 STORY_BACKDROP（theme 逐层复刻稿）。 */
export function backdropUri(): string {
  return textureOverrideUri('game-c/scene/backdrop') ?? STORY_BACKDROP;
}

/** 衣柜件图标（台账槽 game-c/icon/wear-<id>）：真图 URL 优先·无则 null（消费点回退 emoji）。 */
export function wearIconUri(itemId: string): string | null {
  return textureOverrideUri(`game-c/icon/wear-${itemId}`);
}

/** 主题级按钮皮（kind→skin·台账槽 game-c/ui/btn-<kind>）：真图就绪返 buttonSkins 表·全无返 undefined（原 kind 底·零变化）。
 *  只覆盖 **Button 组件**（快捷注/菜单/语言键·主题 kind 皮机制）；主行动键弃/跟/加=复合 Panel·另需 Panel 贴图槽（报 PUI）。 */
export function buttonSkinsForTheme(): Partial<Record<'hero' | 'primary' | 'ghost' | 'quiet', { skin: string; skinSlice?: number }>> | undefined {
  const out: Partial<Record<'hero' | 'primary' | 'ghost' | 'quiet', { skin: string }>> = {};
  const hero = textureOverrideUri('game-c/ui/btn-hero');
  const primary = textureOverrideUri('game-c/ui/btn-primary');
  const ghost = textureOverrideUri('game-c/ui/btn-ghost');
  if (hero) out.hero = { skin: hero };
  if (primary) out.primary = { skin: primary };
  if (ghost) out.ghost = { skin: ghost };
  return Object.keys(out).length ? out : undefined;
}

/**
 * 把本地美术库索引注册进一个 AssetManager（供 3D `Material3D.map` 按 **key** 解析·区别背幕/按钮的 URL 路）。
 * 3D 呢面/木栏贴图（game-c/table/felt-albedo|rail-albedo…）就绪后 ThreeRenderer 按 key 取真图挂上（异步就绪→mesh 自动重建·
 * three-renderer 把「贴图就绪态」并进 mode）；未就绪/无真图=map 解析 null→回退 preset 色。失败/headless=空 manager（回退色）。
 * 注：这里注册**全部** filled 条目（含程序占位 `table/felt-albedo`）·但呢面 map 指 skinKey `game-c/table/felt-albedo`
 * （仅真图写回后才在索引里）→ 无真图=解析 null=回退色；真图到=解析命中=上贴图。render-only。
 */
export async function loadSkinIndex(manager: AssetManager, slug = 'game-c'): Promise<void> {
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

/** 建一个空的皮肤 AssetManager（游戏 mount 期创建·传给 ThreeRenderer·随后 loadSkinIndex 异步填充）。 */
export function makeSkinAssets(): AssetManager {
  return new AssetManager(new ImageAssetLoader());
}

/**
 * 从本地美术库索引载入**真图替换**条目 → 覆盖注册表。
 * 只收 art-replace 写回的 skinKey 别名（id 以 `<slug>/` 开头 + **正向 AI 信号**：top-level source 以 `gen:`/`vendored`
 * 开头，或 tags 含 'skin'）——程序占位（scene/backdrop 等·无 game-c/ 前缀·source 在 provenance 里）**不进** = 观感零变。
 * 失败/无索引/无 fetch（headless）= 空对象（消费点回退程序化）。render-only。
 */
export async function loadArtOverrides(slug = 'game-c'): Promise<Record<string, string>> {
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
        (Array.isArray(a.tags) && a.tags.includes('skin')); // 正向 AI 信号：art-replace 别名·非程序占位
      if (isReal) out[a.id] = a.path;
    }
    return out;
  } catch {
    return out;
  }
}
