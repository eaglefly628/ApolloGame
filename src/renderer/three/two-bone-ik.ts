import * as THREE from 'three';

export interface TwoBoneSolution { readonly mid: THREE.Vector3; readonly end: THREE.Vector3; readonly reachable: boolean; }
const finite = (v: THREE.Vector3): boolean => [v.x, v.y, v.z].every(Number.isFinite);
function difference(a: THREE.Vector3, b: THREE.Vector3, scale: number): THREE.Vector3 {
  const component = (x: number, y: number): number => Number.isFinite(x - y) ? (x - y) / scale : x / scale - y / scale;
  return new THREE.Vector3(component(a.x, b.x), component(a.y, b.y), component(a.z, b.z));
}
function direction(a: THREE.Vector3, b: THREE.Vector3): { unit: THREE.Vector3; scale: number; length: number } {
  const delta = a.clone().sub(b), values = [delta.x, delta.y, delta.z];
  const scale = values.every(Number.isFinite) ? Math.max(...values.map(Math.abs)) : Math.max(...a.toArray().map(Math.abs), ...b.toArray().map(Math.abs));
  if (scale === 0) return { unit: new THREE.Vector3(), scale: 0, length: 0 };
  const scaled = difference(a, b, scale), length = Math.hypot(scaled.x, scaled.y, scaled.z);
  return { unit: scaled.divideScalar(length), scale, length };
}
function perpendicular(axis: THREE.Vector3, preferred: THREE.Vector3): THREE.Vector3 {
  const projected = preferred.clone().addScaledVector(axis, -preferred.dot(axis));
  let length = Math.hypot(projected.x, projected.y, projected.z);
  if (length <= 1e-10) {
    const values = axis.toArray().map(Math.abs), smallest = values.indexOf(Math.min(...values));
    projected.set(smallest === 0 ? 1 : 0, smallest === 1 ? 1 : 0, smallest === 2 ? 1 : 0).addScaledVector(axis, -axis.getComponent(smallest));
    length = Math.hypot(projected.x, projected.y, projected.z);
  }
  return projected.divideScalar(length);
}

/** Analytic positions in one Euclidean coordinate frame. Inputs are read-only;
 * lengths are scaled before squaring so tiny/large finite rigs remain finite. */
export function solveTwoBone(root: THREE.Vector3, mid: THREE.Vector3, end: THREE.Vector3, target: THREE.Vector3, pole?: THREE.Vector3): TwoBoneSolution | undefined {
  if (![root, mid, end, target, ...(pole ? [pole] : [])].every(finite)) return undefined;
  const first = direction(mid, root), second = direction(end, mid), scale = Math.max(first.scale, second.scale);
  if (!(scale > 0) || first.length === 0 || second.length === 0) return undefined;
  const a = first.scale / scale * first.length, b = second.scale / scale * second.length;
  if (!(a > 0 && b > 0)) return undefined;
  const requested = direction(target, root), current = direction(end, root);
  const axis = requested.length > 0 ? requested.unit : current.length > 0 ? current.unit : first.unit;
  const distance = requested.scale / scale * requested.length, low = Math.abs(a - b), high = a + b;
  const reach = Math.max(low, Math.min(high, distance));
  const preferred = pole ? direction(pole, root).unit : first.unit;
  let elbow: THREE.Vector3;
  if (reach === 0) elbow = (preferred.lengthSq() > 0 ? preferred : first.unit).clone().multiplyScalar(a);
  else {
    const along = Math.max(-a, Math.min(a, (reach + (a - b) * (a + b) / reach) / 2));
    const height = Math.sqrt(Math.max(0, (a - along) * (a + along)));
    elbow = axis.clone().multiplyScalar(along).addScaledVector(perpendicular(axis, preferred), height);
  }
  const restore = (offset: THREE.Vector3): THREE.Vector3 => {
    const coordinate = (origin: number, delta: number): number => { const direct = origin + delta * scale; return Number.isFinite(direct) ? direct : (origin / scale + delta) * scale; };
    return new THREE.Vector3(coordinate(root.x, offset.x), coordinate(root.y, offset.y), coordinate(root.z, offset.z));
  };
  const solvedMid = restore(elbow), solvedEnd = restore(axis.clone().multiplyScalar(reach));
  if (!finite(solvedMid) || !finite(solvedEnd)) return undefined;
  return { mid: solvedMid, end: solvedEnd, reachable: distance >= low && distance <= high };
}
