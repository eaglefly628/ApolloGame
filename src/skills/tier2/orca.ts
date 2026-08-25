/*
 * ORCA（Optimal Reciprocal Collision Avoidance）—— **移植自 RVO2 Library**。
 *
 * SPDX-FileCopyrightText: 2008 University of North Carolina at Chapel Hill
 * SPDX-License-Identifier: Apache-2.0
 *
 * 原作者：Jur van den Berg, Stephen J. Guy, Jamie Snape, Ming C. Lin, Dinesh Manocha
 * 原始出处：<https://gamma.cs.unc.edu/RVO2/> · 源码 <https://github.com/snape/RVO2>（`src/Agent.cc`）
 * 按 Apache-2.0 第 4 条要求声明**本文件是修改过的版本**，修改点见下方「与原码的差异」。
 *
 * ══ 为什么要它（owner 2026-08-24 拍板「可以上」）══
 * 软分离（Reynolds 那层）是**软承诺**：允许瞬时重叠，靠力把人弹开。ORCA 给的是**强承诺**：
 * 在 `timeHorizon` 内**保证互不碰撞**——每个单位解一个二维线性规划，在"所有邻居都同样讲道理"
 * 的假设下取**最接近期望速度**的可行速度。两者不是一回事，也不互相替代：
 *   · 流场   → 期望速度 prefVelocity（**走位仍由流场定·owner 红线不变**）
 *   · ORCA   → 把期望速度改成不会撞的那个（改动量最小）
 *   · 软分离 → 另一种更便宜、更"涌流"的选择（不保证不碰）
 * RVO2 官方示例里 prefVelocity 就是「朝目标的方向 × 速度」——与我们把流场方向喂进去完全同形。
 *
 * ══ 与原码的差异（逐条·Apache-2.0 要求标注修改）══
 * ① **不含障碍物（Obstacle）那半段**：原码前半截构造多边形障碍的 ORCA 线；本仓的静态障碍
 *    已经由流场的 `blocked` 格解决（单位根本不会被引向墙里），故 `numObstLines = 0`。
 * ② **不含 KdTree**：邻居由流场自带的网格分桶提供（同一张网格·见 flow-field.ts），
 *    但**保留原码的邻居选取语义**：按距离平方升序取最近的 `maxNeighbors` 个。
 * ③ C++ 的 `float`(32 位) → JS `number`(64 位双精度)。算法与运算顺序逐行照原样，
 *    精度更高；本仓的确定性要求是"同输入同输出"，不是"与 C++ 逐位相同"。
 * ④ 结构上把 `Agent` 类拆成纯函数（本仓 sim 层不放可变对象·便于点名测试与确定性对账）。
 */

/** 原码 `RVO_EPSILON`（`src/Vector2.cc`）。 */
export const RVO_EPSILON = 0.00001;

export interface Vec2 { x: number; y: number }
/** 原码 `Line`：一条有向直线（point 上一点·direction 单位方向）。可行域 = 直线**左侧**半平面。 */
export interface OrcaLine { point: Vec2; direction: Vec2 }
/** 参与避让的一个单位（只读快照）。 */
export interface OrcaAgent { x: number; y: number; vx: number; vy: number; radius: number }

const det = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
const absSq = (a: Vec2): number => a.x * a.x + a.y * a.y;
const norm = (a: Vec2): Vec2 => { const m = Math.sqrt(absSq(a)); return { x: a.x / m, y: a.y / m }; };

/**
 * 原码 `linearProgram1`：在**第 lineNo 条直线上**求解——把可行区间夹到 [tLeft,tRight]，
 * 再取离 optVelocity 最近的点。返回 false = 该直线与前面的约束（或最大速度圆）无交集。
 */
export function linearProgram1(
  lines: readonly OrcaLine[], lineNo: number, radius: number,
  optVelocity: Vec2, directionOpt: boolean, result: Vec2,
): boolean {
  const dotProduct = dot(lines[lineNo].point, lines[lineNo].direction);
  const discriminant = dotProduct * dotProduct + radius * radius - absSq(lines[lineNo].point);

  if (discriminant < 0) return false;            // 最大速度圆把这条线整条否掉

  const sqrtDiscriminant = Math.sqrt(discriminant);
  let tLeft = -dotProduct - sqrtDiscriminant;
  let tRight = -dotProduct + sqrtDiscriminant;

  for (let i = 0; i < lineNo; i++) {
    const denominator = det(lines[lineNo].direction, lines[i].direction);
    const numerator = det(lines[i].direction, {
      x: lines[lineNo].point.x - lines[i].point.x,
      y: lines[lineNo].point.y - lines[i].point.y,
    });

    if (Math.abs(denominator) <= RVO_EPSILON) {  // 两线（近乎）平行
      if (numerator < 0) return false;
      continue;
    }

    const t = numerator / denominator;
    if (denominator >= 0) tRight = Math.min(tRight, t);   // 第 i 条从右边界住
    else tLeft = Math.max(tLeft, t);                      // 从左边界住
    if (tLeft > tRight) return false;
  }

  if (directionOpt) {
    if (dot(optVelocity, lines[lineNo].direction) > 0) {
      result.x = lines[lineNo].point.x + tRight * lines[lineNo].direction.x;
      result.y = lines[lineNo].point.y + tRight * lines[lineNo].direction.y;
    } else {
      result.x = lines[lineNo].point.x + tLeft * lines[lineNo].direction.x;
      result.y = lines[lineNo].point.y + tLeft * lines[lineNo].direction.y;
    }
  } else {
    const t = dot(lines[lineNo].direction, {
      x: optVelocity.x - lines[lineNo].point.x,
      y: optVelocity.y - lines[lineNo].point.y,
    });
    const tt = t < tLeft ? tLeft : t > tRight ? tRight : t;
    result.x = lines[lineNo].point.x + tt * lines[lineNo].direction.x;
    result.y = lines[lineNo].point.y + tt * lines[lineNo].direction.y;
  }
  return true;
}

/**
 * 原码 `linearProgram2`：先取"无约束时的最优"（期望速度，超速则钳到圆上），
 * 逐条检查约束；一旦不满足就在那条线上重解。返回**第一条解不动的线号**（全满足则返回 lines.length）。
 */
export function linearProgram2(
  lines: readonly OrcaLine[], radius: number, optVelocity: Vec2,
  directionOpt: boolean, result: Vec2,
): number {
  if (directionOpt) {
    result.x = optVelocity.x * radius; result.y = optVelocity.y * radius;
  } else if (absSq(optVelocity) > radius * radius) {
    const n = norm(optVelocity);
    result.x = n.x * radius; result.y = n.y * radius;
  } else {
    result.x = optVelocity.x; result.y = optVelocity.y;
  }

  for (let i = 0; i < lines.length; i++) {
    if (det(lines[i].direction, { x: lines[i].point.x - result.x, y: lines[i].point.y - result.y }) > 0) {
      const tempX = result.x; const tempY = result.y;
      if (!linearProgram1(lines, i, radius, optVelocity, directionOpt, result)) {
        result.x = tempX; result.y = tempY;
        return i;
      }
    }
  }
  return lines.length;
}

/**
 * 原码 `linearProgram3`：**无可行解时的兜底**（人挤得太死，所有约束凑不出可行速度）。
 * 逐条把"违反得最狠"的约束当目标，在投影出来的新约束集上求"最不违反"的速度——
 * 也就是**尽量少撞**而不是求完美。RTS 里这一段必须有，否则挤爆时会直接失去速度。
 */
export function linearProgram3(
  lines: readonly OrcaLine[], numObstLines: number, beginLine: number, radius: number, result: Vec2,
): void {
  let distance = 0;

  for (let i = beginLine; i < lines.length; i++) {
    if (det(lines[i].direction, { x: lines[i].point.x - result.x, y: lines[i].point.y - result.y }) > distance) {
      const projLines: OrcaLine[] = lines.slice(0, numObstLines).map((l) => ({ point: { ...l.point }, direction: { ...l.direction } }));

      for (let j = numObstLines; j < i; j++) {
        const determinant = det(lines[i].direction, lines[j].direction);
        let point: Vec2;

        if (Math.abs(determinant) <= RVO_EPSILON) {
          if (dot(lines[i].direction, lines[j].direction) > 0) continue;   // 同向平行：跳过
          point = {                                                        // 反向平行：取中点
            x: 0.5 * (lines[i].point.x + lines[j].point.x),
            y: 0.5 * (lines[i].point.y + lines[j].point.y),
          };
        } else {
          const k = det(lines[j].direction, {
            x: lines[i].point.x - lines[j].point.x, y: lines[i].point.y - lines[j].point.y,
          }) / determinant;
          point = { x: lines[i].point.x + k * lines[i].direction.x, y: lines[i].point.y + k * lines[i].direction.y };
        }

        const direction = norm({ x: lines[j].direction.x - lines[i].direction.x, y: lines[j].direction.y - lines[i].direction.y });
        projLines.push({ point, direction });
      }

      const tempX = result.x; const tempY = result.y;
      if (linearProgram2(projLines, radius, { x: -lines[i].direction.y, y: lines[i].direction.x }, true, result) < projLines.length) {
        // 原码注：理论上不会发生（结果按定义已在可行域内）；真发生就是浮点误差，保留原值。
        result.x = tempX; result.y = tempY;
      }
      distance = det(lines[i].direction, { x: lines[i].point.x - result.x, y: lines[i].point.y - result.y });
    }
  }
}

/**
 * 原码 `Agent::computeNewVelocity` 的**智能体部分**（障碍部分见文件头差异①）。
 *
 * @param self       自己（位置/当前速度/半径）
 * @param neighbors  邻居快照（**须已按距离平方升序**·同原码 `insertAgentNeighbor` 的语义）
 * @param pref       期望速度（本仓 = 流场方向 × speed）
 * @param maxSpeed   速度上限（= speed）
 * @param timeHorizon 前瞻时间：多久之内保证不撞（越大越早避让、越"礼让"）
 * @param timeStep   一拍的时长（已经撞上时用它算脱离速度）
 */
export function orcaVelocity(
  self: OrcaAgent, neighbors: readonly OrcaAgent[], pref: Vec2,
  maxSpeed: number, timeHorizon: number, timeStep: number,
): Vec2 {
  const lines: OrcaLine[] = [];
  const invTimeHorizon = 1 / timeHorizon;

  for (const other of neighbors) {
    const relativePosition = { x: other.x - self.x, y: other.y - self.y };
    const relativeVelocity = { x: self.vx - other.vx, y: self.vy - other.vy };
    const distSq = absSq(relativePosition);
    const combinedRadius = self.radius + other.radius;
    const combinedRadiusSq = combinedRadius * combinedRadius;

    let direction: Vec2;
    let u: Vec2;

    if (distSq > combinedRadiusSq) {
      /* 尚未碰撞 */
      const w = { x: relativeVelocity.x - invTimeHorizon * relativePosition.x, y: relativeVelocity.y - invTimeHorizon * relativePosition.y };
      const wLengthSq = absSq(w);
      const dotProduct = dot(w, relativePosition);

      if (dotProduct < 0 && dotProduct * dotProduct > combinedRadiusSq * wLengthSq) {
        /* 投影到截止圆上 */
        const wLength = Math.sqrt(wLengthSq);
        const unitW = { x: w.x / wLength, y: w.y / wLength };
        direction = { x: unitW.y, y: -unitW.x };
        const k = combinedRadius * invTimeHorizon - wLength;
        u = { x: k * unitW.x, y: k * unitW.y };
      } else {
        /* 投影到侧腿上 */
        const leg = Math.sqrt(distSq - combinedRadiusSq);
        if (det(relativePosition, w) > 0) {
          direction = {
            x: (relativePosition.x * leg - relativePosition.y * combinedRadius) / distSq,
            y: (relativePosition.x * combinedRadius + relativePosition.y * leg) / distSq,
          };
        } else {
          direction = {
            x: -(relativePosition.x * leg + relativePosition.y * combinedRadius) / distSq,
            y: -(-relativePosition.x * combinedRadius + relativePosition.y * leg) / distSq,
          };
        }
        const dv = dot(relativeVelocity, direction);
        u = { x: dv * direction.x - relativeVelocity.x, y: dv * direction.y - relativeVelocity.y };
      }
    } else {
      /* 已经撞上了：按**一拍**的截止圆算脱离速度 */
      const invTimeStep = 1 / timeStep;
      const w = { x: relativeVelocity.x - invTimeStep * relativePosition.x, y: relativeVelocity.y - invTimeStep * relativePosition.y };
      const wLength = Math.sqrt(absSq(w));
      const unitW = { x: w.x / wLength, y: w.y / wLength };
      direction = { x: unitW.y, y: -unitW.x };
      const k = combinedRadius * invTimeStep - wLength;
      u = { x: k * unitW.x, y: k * unitW.y };
    }

    /* **各让一半**（reciprocal 的由来）：line.point = 自己的速度 + u/2 */
    lines.push({ point: { x: self.vx + 0.5 * u.x, y: self.vy + 0.5 * u.y }, direction });
  }

  const result: Vec2 = { x: 0, y: 0 };
  const lineFail = linearProgram2(lines, maxSpeed, pref, false, result);
  if (lineFail < lines.length) linearProgram3(lines, 0, lineFail, maxSpeed, result);
  return result;
}
