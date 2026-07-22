// art-overrides.ts —— game-c 生成美术消费槽（REQ-C-112·owner 2026-07-22·mirror game-g art-textures 覆盖模式）。
//
// 链路：台账行（skinKey）→ 工坊生成真图 → art-replace 按 **skinKey 别名**登记进 public/games/game-c/art/index.json
//   （id=skinKey·top-level source='gen:<provider>'·tags 含 'skin'）→ mount 期 loadArtOverrides 拉索引注册到这里；
//   消费点（背幕等）先查覆盖、未命中回退程序化（STORY_BACKDROP 等）——**真图未到 = 观感零字节变化**（Lead 红线）。
// render-only·不进 sim/hash·蓝图/确定性零影响。
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
