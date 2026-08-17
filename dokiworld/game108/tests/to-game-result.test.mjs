// toGameResult 点名测试（胜 / 负 / 中途各一·锚点 = 分数与 outcome 的精确值）。
// 世界地址与真世界严丝合缝：'flow'.GameFlow.current / 'p1'|'p2'.Resource(hp) / 'round'.Resource
// —— 与 games/game108/acceptance-adapter.ts readWorld 同一套读法（验收剧本口径）。
import test from "node:test";
import assert from "node:assert/strict";
import { toGameResult } from "../src/to-game-result.mjs";

/** 假世界：只实现 getComponent，按真实实体地址铺数据。 */
function fakeWorld({ flow, p1, p2, round = 3, style, read }) {
  const table = {
    "flow:GameFlow": { current: flow },
    "p1:Resource": { id: "hp", current: p1, min: 0, max: 100 },
    "p2:Resource": { id: "hp", current: p2, min: 0, max: 100 },
    "round:Resource": { id: "round", current: round },
    // 【episode 路由的输入】赌性指针与她的读准度（真世界里就住在这两个实体上）
    ...(style === undefined ? {} : { "style:p1:Resource": { id: "p1.style", current: style, min: 0, max: 20 } }),
    ...(read === undefined ? {} : { "read:p2:Resource": { id: "p2.read", current: read, min: 0, max: 10 } }),
  };
  return { getComponent: (id, type) => table[`${id}:${type}`] };
}

test("胜局：p1win + p2 归零 → outcome win·score = 50 + 己方余血/2", () => {
  const r = toGameResult(fakeWorld({ flow: "p1win", p1: 40, p2: 0, round: 7 }));
  assert.equal(r.terminal, true);
  assert.equal(r.outcome, "win");                       // 锚点：flow 终态 p1win ⇒ win
  assert.equal(r.normalizedScore, 70);                  // 锚点：50 + 50*(40-0)/100 = 70
  // 世界里没有 style/read（旧存档 / 还没起）⇒ 报 -1 而**不是猜一个中位数**：
  // 剧情侧据此知道"这局没有这项数据"，而 -1 落不进任何 `minScore/metrics` 条件里。
  assert.deepEqual(r.metrics, { round: 7, playerHp: 40, opponentHp: 0, style: -1, read: -1, perfect: false });
});

test("负局：p2win + p1 归零 → outcome loss·score 对称落在下半区", () => {
  const r = toGameResult(fakeWorld({ flow: "p2win", p1: 0, p2: 60, round: 5 }));
  assert.equal(r.terminal, true);
  assert.equal(r.outcome, "loss");                      // 锚点：flow 终态 p2win ⇒ loss
  assert.equal(r.normalizedScore, 20);                  // 锚点：50 + 50*(0-60)/100 = 20
});

test("中途：非终态 → terminal=false·outcome exited·当时血差照量", () => {
  const r = toGameResult(fakeWorld({ flow: "throw", p1: 80, p2: 50, round: 2 }));
  assert.equal(r.terminal, false);
  assert.equal(r.outcome, "exited");                    // 锚点：未终局 ⇒ exited（onPrepareExit 用）
  assert.equal(r.normalizedScore, 65);                  // 锚点：50 + 50*(80-50)/100 = 65
  assert.deepEqual(r.metrics, { round: 2, playerHp: 80, opponentHp: 50, style: -1, read: -1, perfect: false });
});

test("边界：满血完胜=100 · 惨败=0 · 双归零判 p1win 时=50（settle 先查 p2 倒下）", () => {
  assert.equal(toGameResult(fakeWorld({ flow: "p1win", p1: 100, p2: 0 })).normalizedScore, 100);
  assert.equal(toGameResult(fakeWorld({ flow: "p2win", p1: 0, p2: 100 })).normalizedScore, 0);
  assert.equal(toGameResult(fakeWorld({ flow: "p1win", p1: 0, p2: 0 })).normalizedScore, 50);
});

test("normalizedScore 恒为 0..100 整数（规范 §8 硬性）", () => {
  for (const [p1, p2] of [[100, 0], [0, 100], [33, 67], [1, 99], [50, 50]]) {
    const { normalizedScore } = toGameResult(fakeWorld({ flow: "clash", p1, p2 }));
    assert.ok(Number.isInteger(normalizedScore) && normalizedScore >= 0 && normalizedScore <= 100);
  }
});

test("metrics 加厚：style/read 逐项透传·perfect = 一滴血没掉（episode 按它们分支）", () => {
  const r = toGameResult(fakeWorld({ flow: "p1win", p1: 100, p2: 0, round: 5, style: 4, read: 8 }));
  assert.deepEqual(r.metrics, { round: 5, playerHp: 100, opponentHp: 0, style: 4, read: 8, perfect: true });
  // 掉过血就不是 perfect；style/read 照样透传（两者互不影响）
  const r2 = toGameResult(fakeWorld({ flow: "p1win", p1: 90, p2: 0, round: 5, style: 4, read: 8 }));
  assert.equal(r2.metrics.perfect, false);
  assert.deepEqual([r2.metrics.style, r2.metrics.read], [4, 8]);
  // ⚠ 惨败到 0 血**不算 perfect**（`playerHp > 0` 那一半：0===0 若不挡就会把输光判成完美）
  assert.equal(toGameResult(fakeWorld({ flow: "p2win", p1: 0, p2: 60 })).metrics.perfect, false);
});
