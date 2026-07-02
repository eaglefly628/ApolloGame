// 创作台 v1 · 用户游戏库前端数据模型（纯函数·无副作用·可无头单测）。
//  后端 library/<slug>/meta.json → 卡带架要的 GameEntry；provider 列表 → 顶栏状态灯判定。
//  接后端见 apollo.py：GET /api/library（_list_library）与 GET /api/generate/providers（get_available_providers）。

/** 卡带（内置游戏 + library 卡带共用的展示形状）。原在 launcher.tsx，抽此处以便 library 映射复用且可单测。 */
export interface GameEntry {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  accentColor: string;
  icon: string;
  status: 'playable' | 'coming-soon';
}

/** library/<slug>/meta.json 的形状（apollo.py `_write_meta` 落盘字段；description 可选·后端暂不写）。 */
export interface LibraryMeta {
  name?: string;
  subtitle?: string;
  description?: string;
  color?: string;
  accentColor?: string;
  icon?: string;
  provider?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** GET /api/library 列表项（_list_library）：slug + meta + manifest 是否可解析。 */
export interface LibraryEntry {
  slug: string;
  meta: LibraryMeta;
  valid: boolean;
}

// library 卡带缺省配色（meta 未填色时兜底）：暗蓝主色 + 青强调，贴合壳层基调。
export const LIB_DEFAULT_COLOR = '#1e3a5f';
export const LIB_DEFAULT_ACCENT = '#38bdf8';
// library 卡带 id 命名空间前缀：与内置 game-* 隔开，launcher 据此分流（数据卡带走 DataCartridgeRunner）。
export const LIB_ID_PREFIX = 'lib:';

/** meta.json → 复用现有 Cartridge 组件所需的 GameEntry。缺省字段兜底；manifest 不可解析 → coming-soon（不可运行）。 */
export function metaToGameEntry(entry: LibraryEntry): GameEntry {
  const m = entry.meta ?? {};
  return {
    id: `${LIB_ID_PREFIX}${entry.slug}`,
    title: (m.name ?? '').trim() || entry.slug,
    subtitle: m.subtitle ?? '',
    description: m.description ?? '',
    color: m.color || LIB_DEFAULT_COLOR,
    accentColor: m.accentColor || LIB_DEFAULT_ACCENT,
    icon: m.icon || '🎴',
    status: entry.valid ? 'playable' : 'coming-soon',
  };
}

/** `lib:<slug>` id → slug；非 library id 返回 null（launcher 分流用）。 */
export function libSlug(id: string): string | null {
  return id.startsWith(LIB_ID_PREFIX) ? id.slice(LIB_ID_PREFIX.length) : null;
}

/** GET /api/generate/providers 列表项（get_available_providers）。 */
export interface ProviderInfo {
  id: string;
  name: string;
  models?: string[];
  available: boolean;
}

/** 顶栏 API 状态灯：任一 provider 配了 key → 绿「已连接·<name>」；全无 → 琥珀「未配置 API Key」。 */
export interface ApiStatusLight {
  connected: boolean;
  label: string;
  tone: 'ok' | 'warn';
}

export function providerStatus(providers: ProviderInfo[]): ApiStatusLight {
  const avail = providers.find((p) => p.available);
  if (avail) return { connected: true, label: `已连接 · ${avail.name}`, tone: 'ok' };
  return { connected: false, label: '未配置 API Key', tone: 'warn' };
}
