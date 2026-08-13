// checkpoint 传输编码点名测试（挂起/恢复接线的正确性层）。
// 锚点思路：往返逐字节还原（deepEqual 精确值）·上限自检真抛·坏输入全部 null 不炸。
import test from "node:test";
import assert from "node:assert/strict";
import {
  packWorld, unpackWorld, toCheckpoint, fromCheckpoint,
  CHECKPOINT_CONTRACT, CHECKPOINT_VERSION, CAPABILITY_PAYLOAD_LIMIT,
} from "../src/checkpoint-codec.mjs";

// 形状照真快照（WorldSnapshot = { 实体: { 组件类型: 组件 } }·order = 创建序）。
const SNAPSHOT = {
  flow: { GameFlow: { type: "GameFlow", current: "throw", elapsed: 42 } },
  p1: { Resource: { type: "Resource", id: "hp", current: 80, min: 0, max: 100 } },
  "slot:p1:rock": { Resource: { type: "Resource", id: "p1.charge.rock", current: 2, min: 0, max: 3 } },
  "10": { Flag: { type: "Flag", id: "x", active: true } },   // 数字样 id：order 保序正是为它
};
const ORDER = ["flow", "10", "p1", "slot:p1:rock"];          // 故意不同于 JS 键枚举序

test("pack → unpack 逐字节还原（snapshot 与 order 都 deepEqual·order 保原序）", async () => {
  const packed = await packWorld(SNAPSHOT, ORDER);
  assert.equal(typeof packed, "string");
  const back = await unpackWorld(packed);
  assert.deepEqual(back.snapshot, SNAPSHOT);                 // 锚点：结构精确还原
  assert.deepEqual(back.order, ORDER);                       // 锚点：创建序不被 JSON 键序重排
});

test("压缩后是 1 个字符串节点且远小于 capability 上限（64KB 硬门的余量自证）", async () => {
  const packed = await packWorld(SNAPSHOT, ORDER);
  assert.ok(packed.length < CAPABILITY_PAYLOAD_LIMIT / 4, `packed=${packed.length} 应远小于上限`);
  assert.equal(CAPABILITY_PAYLOAD_LIMIT, 64 * 1024);         // 锚点：与 SDK capability.js 同值
});

test("真实规模压得动：~125KB/万节点级的重复结构快照压完仍在上限内", async () => {
  // 造一个与真快照同量级的世界（154 实体 × 多组件·重复键名——正是引擎快照的形状）
  const big = {};
  const order = [];
  for (let i = 0; i < 160; i++) {
    const id = `entity:${i}`;
    order.push(id);
    big[id] = {
      Resource: { type: "Resource", id: `res.${i}`, current: i, min: 0, max: 100 },
      Rule: { type: "Rule", rows: Array.from({ length: 12 }, (_, j) => ({ when: { kind: "flag", id: `f${j}` }, then: { add: j } })) },
    };
  }
  assert.ok(JSON.stringify({ snapshot: big, order }).length > 100_000, "前提：原文确实超过 64KB 上限");
  const packed = await packWorld(big, order);
  assert.ok(packed.length < CAPABILITY_PAYLOAD_LIMIT, `packed=${packed.length} 必须过 64KB 硬门`);
  assert.deepEqual((await unpackWorld(packed)).order, order);
});

test("unpack 坏输入全走 null（不炸）：非串/空串/坏 base64/合法 base64 坏流/坏形状", async () => {
  assert.equal(await unpackWorld(undefined), null);
  assert.equal(await unpackWorld(""), null);
  assert.equal(await unpackWorld("%%%不是base64%%%"), null);
  assert.equal(await unpackWorld("aGVsbG8="), null);          // "hello"——不是 deflate 流
  // 合法压缩流但形状不对（snapshot 是数组 / order 混非串）→ null
  const arr = await packWorld([], ORDER);
  assert.equal(await unpackWorld(arr), null);
  const badOrder = await packWorld(SNAPSHOT, [1, 2]);
  assert.equal(await unpackWorld(badOrder), null);
});

test("checkpoint 信封：contract/version 精确匹配才认（别家/别版/坏形状全 null）", async () => {
  const env = toCheckpoint("abc");
  assert.deepEqual(env, { contract: CHECKPOINT_CONTRACT, version: CHECKPOINT_VERSION, data: { world: "abc" } });
  assert.equal(fromCheckpoint(env), "abc");                  // 锚点：正路取回原串
  assert.equal(fromCheckpoint(null), null);
  assert.equal(fromCheckpoint({ ...env, contract: "doki.game.other" }), null);
  assert.equal(fromCheckpoint({ ...env, version: 2 }), null);
  assert.equal(fromCheckpoint({ contract: CHECKPOINT_CONTRACT, version: 1, data: {} }), null);
  assert.equal(fromCheckpoint({ contract: CHECKPOINT_CONTRACT, version: 1, data: { world: "" } }), null);
});
