/** E5 fixed, generated data. No loader, renderer, world or executable expressions. */
export type SceneImportKind = 'collision' | 'navigation' | 'pick' | 'spawn' | 'display';
export interface SceneImportNode {
  readonly index: number;
  readonly path: readonly number[];
  readonly name: string;
  readonly kind: SceneImportKind;
  readonly worldMatrix: readonly number[];
  readonly positions?: readonly number[];
  readonly indices?: readonly number[];
  readonly bounds?: { readonly min: readonly number[]; readonly max: readonly number[] };
}
export interface SceneImportData {
  readonly version: 1;
  readonly sourceSha256: string;
  readonly nodes: readonly SceneImportNode[];
}
export type SceneImportCatalog = Readonly<Record<string, SceneImportData>>;

function reject(message: string): never {
  console.warn(`[scene-import] reject: ${message}`);
  throw new Error(`scene-import: ${message}`);
}
function object(value: unknown, label: string, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) reject(`${label} must be an object`);
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) if (!allowed.includes(key)) reject(`${label}: unknown field ${key}`);
  return record;
}
function numbers(value: unknown, label: string, length?: number): readonly number[] {
  if (!Array.isArray(value) || (length !== undefined && value.length !== length)
    || !value.every(v => typeof v === 'number' && Number.isFinite(v))) reject(`${label} must contain finite numbers${length === undefined ? '' : ` (length ${length})`}`);
  return Object.freeze([...value] as number[]);
}
function nodeKind(name: string): SceneImportKind {
  for (const [prefix, kind] of [['col_', 'collision'], ['nav_', 'navigation'], ['pick_', 'pick'], ['spawn_', 'spawn']] as const) {
    if (name.startsWith(prefix)) {
      if (name.length === prefix.length) reject(`empty semantic suffix ${name}`);
      return kind;
    }
  }
  return 'display';
}

/** Copy and freeze the entire closed data shape; do not retain caller-owned arrays. */
export function parseSceneImportData(raw: unknown): SceneImportData {
  const root = object(raw, 'scene', ['version', 'sourceSha256', 'nodes']);
  if (root.version !== 1) reject('scene version must be 1');
  if (typeof root.sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(root.sourceSha256)) reject('sourceSha256 must be a lowercase SHA256');
  if (!Array.isArray(root.nodes) || !root.nodes.length || root.nodes.length > 4096) reject('nodes must contain 1..4096 records');
  let components = 0;
  const seen = new Set<number>();
  const nodes: SceneImportNode[] = root.nodes.map((rawNode: unknown, i: number) => {
    const n = object(rawNode, `nodes[${i}]`, ['index', 'path', 'name', 'kind', 'worldMatrix', 'positions', 'indices', 'bounds']);
    if (!Number.isSafeInteger(n.index) || (n.index as number) < 0 || seen.has(n.index as number)) reject(`nodes[${i}] duplicate/invalid index`);
    const index = n.index as number; seen.add(index);
    const path = numbers(n.path, `nodes[${i}].path`);
    if (!path.length || path.length > 256 || path.at(-1) !== index || new Set(path).size !== path.length
      || !path.every(v => Number.isSafeInteger(v) && v >= 0)) reject(`nodes[${i}] invalid node path`);
    if (typeof n.name !== 'string' || n.name.length > 1024 || /[\x00-\x1f]/.test(n.name)) reject(`nodes[${i}] invalid name`);
    if (n.kind !== nodeKind(n.name)) reject(`nodes[${i}] kind does not match node name`);
    const matrix = numbers(n.worldMatrix, `nodes[${i}].worldMatrix`, 16);
    if (matrix[3] !== 0 || matrix[7] !== 0 || matrix[11] !== 0 || matrix[15] !== 1) reject(`nodes[${i}] worldMatrix must be affine`);
    const base = { index, path, name: n.name, kind: n.kind as SceneImportKind, worldMatrix: matrix };
    const geometry = n.positions !== undefined || n.indices !== undefined || n.bounds !== undefined;
    if (base.kind === 'spawn' || base.kind === 'display') {
      if (geometry) reject(`nodes[${i}] ${base.kind} must not contain geometry`);
      return Object.freeze(base);
    }
    const positions = numbers(n.positions, `nodes[${i}].positions`), indices = numbers(n.indices, `nodes[${i}].indices`);
    components += positions.length + indices.length;
    if (!positions.length || positions.length % 3 || !indices.length || indices.length % 3 || components > 6_000_000)
      reject(`nodes[${i}] invalid triangle geometry size`);
    if (!positions.every(v => Math.abs(v) <= 1_000_000 && Math.abs(v * 10000 - Math.round(v * 10000)) < 1e-5)) reject(`nodes[${i}] positions must be quantized to 1e-4 metres within world budget`);
    if (!indices.every(v => Number.isSafeInteger(v) && v >= 0 && v < positions.length / 3)) reject(`nodes[${i}] triangle index out of range`);
    const bounds = object(n.bounds, `nodes[${i}].bounds`, ['min', 'max']);
    const min = numbers(bounds.min, `nodes[${i}].bounds.min`, 3), max = numbers(bounds.max, `nodes[${i}].bounds.max`, 3);
    const actualMin = [Infinity, Infinity, Infinity], actualMax = [-Infinity, -Infinity, -Infinity];
    for (let p = 0; p < positions.length; p++) { const axis = p % 3; actualMin[axis] = Math.min(actualMin[axis], positions[p]); actualMax[axis] = Math.max(actualMax[axis], positions[p]); }
    if (min.some((v, axis) => v !== actualMin[axis]) || max.some((v, axis) => v !== actualMax[axis])) reject(`nodes[${i}] bounds must equal actual positions`);
    return Object.freeze({ ...base, positions, indices, bounds: Object.freeze({ min, max }) });
  });
  const byIndex = new Map(nodes.map(n => [n.index, n]));
  for (const n of nodes) {
    for (let i = 0; i < n.path.length - 1; i++) {
      const ancestor = byIndex.get(n.path[i]);
      if (!ancestor || ancestor.path.length !== i + 1 || ancestor.path.some((value, j) => n.path[j] !== value)) reject(`node ${n.index} has an inconsistent ancestor path`);
      if (n.kind !== 'display' && ancestor.kind !== 'display') reject(`node ${n.index} nests semantic node ${ancestor.index}`);
    }
  }
  return Object.freeze({ version: 1, sourceSha256: root.sourceSha256, nodes: Object.freeze(nodes) });
}

/** Verify actual fetched bytes before publishing this generated data to assembly. */
export async function verifySceneImportBytes(raw: unknown, handle: unknown): Promise<SceneImportData> {
  const scene = parseSceneImportData(raw);
  if (!(handle instanceof ArrayBuffer)) reject('scene assets require actual GLB bytes, not a mock handle');
  const header = new DataView(handle);
  if (handle.byteLength < 20 || header.getUint32(0, true) !== 0x46546c67
    || header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== handle.byteLength) reject('scene asset is not a complete GLB v2');
  if (!globalThis.crypto?.subtle) reject('SHA256 verifier unavailable; cannot load scene safely');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', handle);
  const sha = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (sha !== scene.sourceSha256) reject('source SHA256 mismatch; rebake scene from the final GLB');
  return scene;
}
