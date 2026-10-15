// 本机候选美术仅增强商品画面；线上没有私有索引时回退为统一包裹图标。
import { pickArtOverrides } from '@zerocraft/engine/assets/index.js';

export const LOCAL_TOY_INDEX_URL = '/games/game112/art/local-candidates/index.json';

export async function loadLocalToyArtOverrides(): Promise<Record<string, string>> {
  try {
    if (typeof fetch !== 'function') return {};
    const response = await fetch(LOCAL_TOY_INDEX_URL, { cache: 'no-cache' });
    if (!response.ok) return {};
    const skins = pickArtOverrides(await response.json(), 'game112');
    return Object.fromEntries(Object.entries(skins).filter(([id]) => /^game112\/prop\/T\d{3}$/.test(id)));
  } catch {
    return {};
  }
}
