import type { AssetManager } from './asset-manager.js';

/** Structural UI source: no runtime dependency on the UI package or world. */
interface GroupSourceFallback {
  resource?(id: string): { current: number; max?: number } | undefined;
  flag?(id: string): boolean | undefined;
  value?(id: string): string | undefined;
  list?(id: string): ReadonlyArray<Readonly<Record<string, string | number | boolean>>> | undefined;
}
export function createAssetGroupDataSource<T extends GroupSourceFallback>(manager: AssetManager, fallback?: T) {
  const progress = (id: string) => id.startsWith('asset-group:') ? manager.groupProgress(id.slice('asset-group:'.length)) : undefined;
  return {
    ...fallback,
    value(id: string): string | undefined { return fallback?.value?.(id); },
    list(id: string): ReadonlyArray<Readonly<Record<string, string | number | boolean>>> | undefined { return fallback?.list?.(id); },
    resource(id: string): { current: number; max?: number } | undefined {
      const p = progress(id);
      if (!p) return fallback?.resource?.(id);
      return p.total === 0 ? { current: p.status === 'ready' ? 1 : 0, max: 1 } : { current: p.loaded, max: p.total };
    },
    flag(id: string): boolean | undefined {
      const match = /^asset-group:([^:]+):(loading|ready|failed)$/.exec(id);
      if (match) {
        const p = manager.groupProgress(match[1]);
        if (p) return p.status === match[2];
      }
      return fallback?.flag?.(id);
    },
  };
}
