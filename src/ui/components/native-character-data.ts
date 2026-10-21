import type { LayoutNode, NativeCharacterProps } from './types.js';

// Narrow opt-in contract. The old UI vocabulary and its validation are unchanged.
const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const ASSET_ID = /^[A-Za-z0-9][A-Za-z0-9_./-]{0,255}$/;
const FIELDS = new Set(['assetKey', 'poster', 'alt', 'fit', 'clip', 'loop', 'speed', 'parameters']);
/** Local URL syntax, not CSS: reject protocol-relative/schemed URLs and escaping characters. */
export function nativeLocalPath(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 2048
    && !/[\s\\<>"'`]|^[a-z][a-z0-9+.-]*:|^\/\//i.test(value)
    && !/%(?:2f|5c|00)/i.test(value);
}
export function nativeCharacterIssues(p: unknown): string[] {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return ['props must be an object'];
  const v = p as Record<string, unknown>;
  const issues: string[] = [];
  for (const k of Object.keys(v)) if (!FIELDS.has(k)) issues.push(`unknown props.${k}`);
  if (typeof v.assetKey !== 'string' || !ASSET_ID.test(v.assetKey) || v.assetKey.split('/').some(s => !s || s === '.' || s === '..')) issues.push('assetKey must be a stable asset id');
  if (!nativeLocalPath(v.poster)) issues.push('poster must be a local URL path');
  if (v.alt !== undefined && (typeof v.alt !== 'string' || v.alt.length > 1024)) issues.push('alt must be text (max 1024)');
  if (v.fit !== undefined && v.fit !== 'contain') issues.push('fit must be contain');
  if (v.clip !== undefined && (typeof v.clip !== 'string' || !ID.test(v.clip))) issues.push('clip must be a model clip id');
  if (v.loop !== undefined && typeof v.loop !== 'boolean') issues.push('loop must be boolean');
  if (v.speed !== undefined && (typeof v.speed !== 'number' || !Number.isFinite(v.speed) || v.speed <= 0)) issues.push('speed must be finite and positive');
  if (v.parameters !== undefined) {
    if (!v.parameters || typeof v.parameters !== 'object' || Array.isArray(v.parameters)) issues.push('parameters must be an id/number object');
    else {
      const pairs = Object.entries(v.parameters);
      if (pairs.length > 128) issues.push('parameters exceeds 128 entries');
      for (const [key, value] of pairs) if (!ID.test(key) || typeof value !== 'number' || !Number.isFinite(value)) issues.push(`invalid parameter ${key}`);
    }
  }
  return issues;
}
/** Only this new opt-in type adds a pre-DOM rejection; no old-tree validation migration. */
export function assertNativeCharacterTree(root: LayoutNode): void {
  const ids = new Map<string, number>();
  const nativeNodes: LayoutNode[] = [];
  const walk = (n: LayoutNode): void => {
    ids.set(n.id, (ids.get(n.id) ?? 0) + 1);
    if (n.type === 'NativeCharacter') {
      nativeNodes.push(n);
      const issues = nativeCharacterIssues(n.props as NativeCharacterProps);
      if (typeof n.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:#-]{0,255}$/.test(n.id)) issues.push('node id must be stable');
      if (n.children?.length) issues.push('NativeCharacter does not accept children');
      if (issues.length) throw new Error(`NativeCharacter ${n.id}: ${issues.join('; ')}`);
    }
    n.children?.forEach(walk);
    // Node-valued props (Tooltip/PlayingCard) are real render subtrees too.
    for (const key of ['bubble', 'backFace']) {
      const child = (n.props as unknown as Record<string, unknown>)[key] as LayoutNode | undefined;
      if (child?.type) walk(child);
    }
  };
  walk(root);
  for (const n of nativeNodes) if (ids.get(n.id) !== 1) throw new Error(`NativeCharacter ${n.id}: duplicate node id`);
}
