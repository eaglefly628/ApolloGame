import { Quaternion, Vector3 } from 'three';

const up = new Vector3(0, 1, 0);
const clamp = value => Math.min(1, Math.max(0, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const blendWindow = (phase, begin, full, release, end) =>
  smooth((phase - begin) / (full - begin)) * (1 - smooth((phase - release) / (end - release)));

export function bindShoe(foot, sole) {
  const toe = foot.children.find(node => node.name.endsWith('ToeBase'));
  const forward = toe.position.clone().normalize();
  const attr = sole.geometry.getAttribute('position');
  sole.updateMatrix();
  const points = Array.from({ length: attr.count }, (_, i) =>
    new Vector3().fromBufferAttribute(attr, i).applyMatrix4(sole.matrix));
  const offsets = points.map(point => point.dot(forward));
  const min = Math.min(...offsets), max = Math.max(...offsets);
  return {
    foot, points,
    heel: points.filter((_, i) => offsets[i] <= min + (max - min) * .32),
    front: points.filter((_, i) => offsets[i] >= max - (max - min) * .32),
    axis: forward,
  };
}

const lowest = points => points.reduce((a, b) => a.y <= b.y ? a : b);

export function soleSections(shoe) {
  return [shoe.heel, shoe.front].map(points =>
    lowest(points.map(point => point.clone().applyMatrix4(shoe.foot.matrixWorld))).y);
}

function shoeFrame(shoe) {
  const rotation = shoe.foot.getWorldQuaternion(new Quaternion());
  const forward = shoe.axis.clone().applyQuaternion(rotation).setY(0).normalize();
  const world = points => points.map(point => point.clone().applyMatrix4(shoe.foot.matrixWorld));
  const heel = lowest(world(shoe.heel));
  const front = lowest(world(shoe.front));
  const span = front.clone().sub(heel).dot(forward);
  const pitch = span > .001 ? Math.atan2(front.y - heel.y, span) : 0;
  return { rotation, forward, pitch, world };
}

export const shoePitch = shoe => shoeFrame(shoe).pitch;

export function supportPivot(shoe, ankle, q) {
  const pivot = lowest(shoe.points.map(point => point.clone().applyMatrix4(shoe.foot.matrixWorld)));
  const lever = pivot.clone().sub(ankle).applyQuaternion(q.clone().invert());
  return { pivot, lever };
}

function rotateShoe(shoe, frame, height, angle) {
  if (Math.abs(angle) < 1e-5) return { height };
  const { forward, rotation } = frame;
  const axis = new Vector3().crossVectors(up, forward);
  const adjust = new Quaternion().setFromAxisAngle(axis, angle);
  return orientShoe(shoe, height, adjust.multiply(rotation));
}

export function orientShoe(shoe, height, rotation) {
  const current = shoe.foot.getWorldQuaternion(new Quaternion());
  const adjust = rotation.clone().multiply(current.invert());
  const ankle = shoe.foot.getWorldPosition(new Vector3());
  const points = shoe.points.map(point => point.clone().applyMatrix4(shoe.foot.matrixWorld));
  const before = lowest(points).y;
  const after = lowest(points.map(point => point.clone().sub(ankle).applyQuaternion(adjust).add(ankle))).y;
  return { height, rotation, soleShift: after - before };
}

// Authored clip seconds. Keep the heel descending through the original stall,
// then use the existing stance window to retain contact. The right step wraps.
const approaches = [
  { begin: .515, impact: .695, flat: .742, height: .067 },
  { begin: 1.186, impact: 1.407, flat: 1.456, height: .056 },
];

export function stanceTarget(shoe, phase, side, height, heelFirst = false) {
  // Times are seconds in this 1.4 s avatar walk. End each window before the authored push-off.
  const pitch = side === 0 ? blendWindow(phase, .67, .71, .84, .875) :
    blendWindow(phase, .009, .032, .265, .34);
  const bridge = side === 1 ? blendWindow(phase, .746, .757, .848, .89) : 0;
  const { begin, impact, flat, height: startHeight } = approaches[side];
  const time = side === 1 && phase < .08 ? phase + 1.4 : phase;
  if (heelFirst && time >= begin && time < flat) {
    const frame = shoeFrame(shoe);
    const blend = smooth((time - begin) / .045);
    const descent = startHeight * clamp((impact - time) / (impact - begin));
    const targetHeight = time >= impact ? 0 : height + (Math.min(height, descent) - height) * blend;
    const toeLift = .095 * (1 - smooth((time - impact) / (flat - impact)));
    const targetPitch = frame.pitch + (toeLift - frame.pitch) * blend;
    return rotateShoe(shoe, frame, targetHeight, frame.pitch - targetPitch);
  }
  if (!pitch && !bridge) return { height };
  const frame = shoeFrame(shoe);
  return rotateShoe(shoe, frame, height * (1 - Math.max(pitch, bridge)), Math.min(0, frame.pitch) * pitch);
}

export function stopTarget(shoe, height, incomingPitch, limit, idleBlend) {
  const frame = shoeFrame(shoe);
  return rotateShoe(shoe, frame, height, (frame.pitch - incomingPitch * limit) * (1 - idleBlend));
}

export function firmLanding(height, velocity, age) {
  if (height <= 0) return 0;
  const descent = Math.max(0, -velocity);
  const duration = Math.min(.12, .04 + height * 1.3, descent ? 1.25 * height / descent : Infinity);
  const t = clamp(age / Math.max(.028, duration));
  const slope = Math.min(1.5, descent * duration / height);
  // Keep downward speed through impact, then hold contact.
  return height * (1 - t) * (1 + (1 - slope) * t);
}
