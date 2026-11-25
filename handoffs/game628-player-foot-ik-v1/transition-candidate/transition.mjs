import { Box3, Quaternion, Vector3 } from 'three';
import { solveTwoBone } from '../../game628-cat-turn-20261121/apollo-two-bone.mjs';

import { bindShoe, firmLanding, orientShoe, shoePitch, soleSections, stanceTarget, stopTarget, supportPivot } from './heel-contact.mjs';

const clamp = value => Math.min(1, Math.max(0, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const position = node => node.getWorldPosition(new Vector3());
const rotation = node => node.getWorldQuaternion(new Quaternion());
const recoveryDrop = .09;

function land(height, velocity, age) {
  if (height <= 0) return 0;
  const descent = Math.max(0, -velocity);
  const duration = descent ? Math.min(.18, Math.max(.045, 1.25 * height / descent)) : .18;
  const t = clamp(age / duration);
  const tangent = Math.min(descent * duration, 2 * height);
  // A monotone Hermite segment that ends on the ground with zero vertical velocity.
  return (1 - t) ** 2 * (height * (1 + 2 * t) - tangent * t);
}

function setRotation(node, quaternion) {
  node.quaternion.copy(rotation(node.parent).invert().multiply(quaternion));
  node.updateWorldMatrix(false, true);
}
function aim(node, child, target) {
  const pivot = position(node);
  const from = position(child).sub(pivot).normalize();
  const to = target.clone().sub(pivot).normalize();
  setRotation(node, new Quaternion().setFromUnitVectors(from, to).multiply(rotation(node)));
}
function reach(hip, goal, length) {
  return Math.sqrt(Math.max(0, (length - .00002) ** 2 - (hip.x - goal.x) ** 2 - (hip.z - goal.z) ** 2));
}

export class FootTransition {
  constructor(contact, firmContact = false) {
    this.contact = contact;
    this.box = new Box3();
    this.legs = ['Left', 'Right'].map(side => {
      const foot = contact.model.getObjectByName(side + 'Foot');
      return { foot, knee: foot.parent, upper: foot.parent.parent };
    });
    this.nodes = [contact.hips, ...this.legs.flatMap(leg => [leg.upper, leg.knee, leg.foot])];
    this.age = 0;
    this.firmContact = firmContact;
    this.balanceStop = firmContact === 'balanced-stop';
    this.recoveryStep = firmContact === 'recovery-step' || this.balanceStop;
    if (firmContact) this.shoes = this.legs.map((leg, i) => bindShoe(leg.foot, contact.shoes[i]));
  }

  restore() {
    if (!this.saved) return;
    for (const { node, p, q } of this.saved) {
      node.position.copy(p);
      node.quaternion.copy(q);
    }
    this.saved = undefined;
  }

  heights() {
    const baseY = this.contact.model.matrixWorld.elements[13];
    return this.contact.shoes.map(shoe => this.box.setFromObject(shoe, true).min.y - baseY);
  }

  project(before, desired, stance) {
    const targets = this.legs.map((leg, i) => {
      const upper = position(leg.upper), middle = position(leg.knee), ankle = position(leg.foot);
      const goal = ankle.clone();
      goal.y += desired[i] - before[i] - (stance?.[i].soleShift ?? 0);
      if (stance?.[i].ankle) {
        goal.x = stance[i].ankle.x;
        goal.z = stance[i].ankle.z;
      }
      return { goal, length: upper.distanceTo(middle) + middle.distanceTo(ankle), q: stance?.[i].rotation ?? rotation(leg.foot) };
    });
    if (targets.every((_, i) => Math.abs(desired[i] - before[i]) < .0001 &&
      !stance?.[i].rotation && !stance?.[i].ankle)) return;
    this.saved = this.nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone() }));
    let drop = 0;
    for (const [i, leg] of this.legs.entries()) {
      const hip = position(leg.upper);
      const { goal, length } = targets[i];
      drop = Math.max(drop, hip.y - reach(hip, goal, length) - goal.y);
    }
    if (drop > 0) {
      const hips = this.contact.hips;
      const point = position(hips);
      const stopRelief = this.firmContact && this.mode === 'stop';
      const maxDrop = this.recovery ? recoveryDrop : stopRelief ? .068 : .048;
      point.y -= Math.min(maxDrop, drop);
      hips.position.copy(hips.parent.worldToLocal(point));
      hips.updateWorldMatrix(false, true);
    }
    for (const [i, leg] of this.legs.entries()) {
      const hip = position(leg.upper), knee = position(leg.knee);
      const { goal, length, q } = targets[i];
      goal.y = Math.max(goal.y, hip.y - reach(hip, goal, length));
      const solution = solveTwoBone(hip, knee, position(leg.foot), goal, knee);
      if (!solution) continue;
      aim(leg.upper, leg.knee, solution.mid);
      aim(leg.knee, leg.foot, solution.end);
      setRotation(leg.foot, q);
    }
  }

  beginRecovery() {
    if (!this.lastWalkPose || !this.idleFeet) return;
    const model = this.contact.model;
    const rootRotation = rotation(model);
    const rest = this.idleFeet.map(foot => ({
      ankle: model.localToWorld(foot.ankle.clone()), q: rootRotation.clone().multiply(foot.q),
    }));
    const feet = this.lastWalkPose.map((foot, i) => {
      const span = Math.hypot(foot.ankle.x - rest[i].ankle.x, foot.ankle.z - rest[i].ankle.z);
      return { from: foot, to: rest[i], height: Math.max(0, this.entry[i]), span, duration: Math.min(.21, .13 + span * .29) };
    });
    const airborne = feet.findIndex(foot => foot.height > .0015);
    const first = airborne >= 0 ? airborne : Number(feet[1].span > feet[0].span);
    feet[first].start = 0;
    const waiting = feet[1 - first];
    waiting.start = feet[first].duration + .024;
    if (waiting.from.support) {
      const { pivot, lever } = waiting.from.support;
      const seated = pivot.clone().sub(lever.clone().applyQuaternion(waiting.to.q));
      waiting.span = Math.hypot(seated.x - waiting.to.ankle.x, seated.z - waiting.to.ankle.z);
      waiting.duration = Math.min(.21, .13 + waiting.span * .29);
    }
    return feet;
  }

  supportPose(index, from, to, blend) {
    const { pivot, lever } = from.support;
    const { upper, knee, foot } = this.legs[index];
    const hip = position(upper), joint = position(knee);
    const length = hip.distanceTo(joint) + joint.distanceTo(position(foot));
    const at = weight => {
      const q = from.q.clone().slerp(to.q, weight);
      const ankle = pivot.clone().sub(lever.clone().applyQuaternion(q));
      return { q, ankle };
    };
    const reachable = ({ ankle }) => hip.y - reach(hip, ankle, length) - ankle.y <= recoveryDrop - .001;
    const full = at(blend);
    if (reachable(full)) return full;
    // During a long split stance the pelvis may be too far away for a flat foot.
    // Keep as much roll as the leg can reach without lifting the planted point.
    let low = 0, high = blend;
    for (let i = 0; i < 8; i++) {
      const trial = (low + high) / 2;
      if (reachable(at(trial))) low = trial;
      else high = trial;
    }
    return at(low);
  }

  recoveryTargets(before) {
    const end = Math.max(...this.recovery.map(foot => foot.start + foot.duration));
    return this.recovery.map(({ from, to, height, span, start, duration }, i) => {
      const t = clamp((this.age - start) / duration);
      const airborne = height > .008;
      const realStep = span > .009;
      const move = realStep ? smooth((t - (airborne ? 0 : .16)) / (airborne ? .87 : .68)) : smooth(t);
      const soleHeight = airborne ? height * (1 - t * (.44 + .56 * t))
        : Math.max(height * (1 - t), realStep ? Math.min(.041, .016 + span * .17) * Math.sin(t * Math.PI) : 0);
      const support = from.support && start > 0 && !airborne
        ? this.supportPose(i, from, to, smooth(this.age / .074)) : { q: from.q.clone(), ankle: from.ankle };
      const { q } = support;
      const ankle = support.ankle.clone().lerp(to.ankle, move);
      q.slerp(to.q, smooth(t));
      const idleBlend = smooth((this.age - end) / .06);
      ankle.lerp(position(this.legs[i].foot), idleBlend);
      q.slerp(rotation(this.legs[i].foot), idleBlend);
      return { ...orientShoe(this.shoes[i], soleHeight * (1 - idleBlend) + before[i] * idleBlend, q), ankle };
    });
  }

  apply(clip, dt, observe = false, phase) {
    if (clip !== this.clip) {
      this.mode = this.clip === 'idle' && clip === 'walk' ? 'start' :
        this.clip === 'walk' && clip === 'idle' ? 'stop' : undefined;
      this.entry = this.last ?? [0, 0];
      this.entryVelocity = this.velocity ?? [0, 0];
      this.entryPitch = this.lastPitch;
      this.recovery = this.recoveryStep && this.mode === 'stop' ? this.beginRecovery() : undefined;
      this.age = 0;
      this.clip = clip;
    } else this.age += dt;

    if (clip !== 'walk' && clip !== 'idle') {
      this.last = undefined;
      this.velocity = undefined;
      this.lastPitch = undefined;
      return;
    }
    const before = this.heights();
    const recoveryEnd = this.recovery ? Math.max(...this.recovery.map(foot => foot.start + foot.duration)) + .06 : .32;
    const active = this.age < recoveryEnd && this.mode;
    if (active === 'stop' && this.recovery) {
      const stance = this.recoveryTargets(before);
      this.project(before, stance.map(target => target.height), stance);
    } else if (active) {
      const desired = before.map((height, i) => {
        if (this.mode === 'start') {
          const carry = Math.max(0, this.entry[i]) * (1 - smooth(this.age / .12));
          return carry + height * smooth((this.age - .172) / .078);
        }
        const idle = smooth((this.age - .25) / .07);
        const landing = this.firmContact ? firmLanding : land;
        return landing(this.entry[i], this.entryVelocity[i], this.age) + height * idle;
      });
      const stance = this.shoes && this.mode === 'stop' && this.shoes.map((shoe, i) => {
        const idle = smooth((this.age - .25) / .07);
        const pitchWeight = this.entry[i] > .0015
          ? clamp(desired[i] / this.entry[i]) : 1 - smooth(this.age / .07);
        return stopTarget(shoe, desired[i], this.entryPitch?.[i] ?? 0, pitchWeight, idle);
      });
      this.project(before, desired, stance || undefined);
    } else if (this.shoes && clip === 'walk' && Number.isFinite(phase)) {
      const heelFirst = this.firmContact === 'heel-first' || this.recoveryStep;
      const stance = this.shoes.map((shoe, i) => stanceTarget(shoe, phase, i, before[i], heelFirst));
      this.project(before, stance.map(target => target.height), stance);
    }
    const heights = this.saved ? this.heights() : before;
    if (dt > .0001 && this.last) this.velocity = heights.map((height, i) => (height - this.last[i]) / dt);
    this.last = heights;
    this.lastPitch = this.shoes && clip === 'walk' ? this.shoes.map(shoePitch) : undefined;
    if (this.recoveryStep && clip === 'walk') {
      this.lastWalkPose = this.legs.map(({ foot }, i) => {
        const ankle = position(foot), q = rotation(foot);
        const support = this.balanceStop && this.age >= .32 && heights[i] <= .0015
          ? supportPivot(this.shoes[i], ankle, q) : undefined;
        return { ankle, q, support };
      });
    } else if (this.recoveryStep && !active) {
      const model = this.contact.model;
      const relative = rotation(model).invert();
      this.idleFeet = this.legs.map(({ foot }) => ({
        ankle: model.worldToLocal(position(foot)), q: relative.clone().multiply(rotation(foot)),
      }));
    }
    if (observe) {
      const rootY = this.contact.model.matrixWorld.elements[13];
      const sections = this.shoes?.map(shoe => soleSections(shoe).map(height => height - rootY));
      return { clip, phase, mode: active || null, age: this.age, shoes: this.last, before, sections };
    }
  }
}
