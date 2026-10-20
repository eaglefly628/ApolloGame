import type { AssetGroups } from './asset-types.js';

/** 只校验数据形状；物理 key 的登记存在性由 AssetManager 整体校验。 */
export function parseAssetGroups(raw: unknown): AssetGroups {
  const reject = (message: string): never => {
    console.warn(`AssetGroups: reject ${message}`);
    throw new TypeError(`AssetGroups: ${message}`);
  };
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return reject('expected an object');
  }
  const prototype = Object.getPrototypeOf(raw);
  if (prototype !== Object.prototype && prototype !== null) return reject('expected a plain object');
  const result: Record<string, readonly string[]> = Object.create(null);
  for (const [id, members] of Object.entries(raw)) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(id)) return reject('invalid group id');
    if (!Array.isArray(members)) return reject(`group "${id}" requires an array`);
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const key of members) {
      if (typeof key !== 'string' || key.length === 0 || key.includes('\0')) {
        return reject(`group "${id}" contains an invalid asset key`);
      }
      if (seen.has(key)) {
        console.info(`AssetGroups: skip duplicate key in group "${id}"`);
        continue;
      }
      seen.add(key);
      keys.push(key);
    }
    result[id] = Object.freeze(keys);
  }
  return Object.freeze(result);
}
