import { describe, it, expect } from 'vitest';
import { LockstepClient } from './lockstep-tab.js';
import type { Channel, NetMsg } from './lockstep-tab.js';

// 内存版 BroadcastChannel：post 投递给**除发送者外**的所有订阅者（与浏览器语义一致）。
class MockBus {
  private recv = new Map<string, (m: NetMsg) => void>();
  readonly log: NetMsg[] = [];
  channel(tag: string): Channel {
    return {
      post: (m) => {
        this.log.push(m);
        for (const [id, cb] of this.recv) if (id !== tag) cb(structuredClone(m));
      },
      onMessage: (cb) => this.recv.set(tag, cb),
      close: () => this.recv.delete(tag),
    };
  }
}

const STEP = 1000 / 30;

describe('LockstepClient — 同浏览器双标签页帧同步（mock BroadcastChannel）', () => {
  it('两个对端逐 tick 状态完全一致：同 epoch 下每个 tick 的 hash 必相等', () => {
    const bus = new MockBus();
    let clock = 0;
    const now = () => clock;
    let inA: { dx: number; dy: number } = { dx: 0, dy: 0 };
    let inB: { dx: number; dy: number } = { dx: 0, dy: 0 };

    const A = new LockstepClient({ peerId: 'A', channel: bus.channel('A'), getInput: () => inA, now, tickRate: 30, inputDelay: 4 });
    const B = new LockstepClient({ peerId: 'B', channel: bus.channel('B'), getInput: () => inB, now, tickRate: 30, inputDelay: 4 });

    // 发现阶段：推进时钟越过心跳 → 两端互相看见 → 收敛到 epoch 'A|B'
    for (let i = 0; i < 12; i++) {
      clock += STEP;
      A.pump(STEP);
      B.pump(STEP);
    }
    expect(A.view().epoch).toBe('A|B');
    expect(B.view().epoch).toBe('A|B');
    expect(A.view().peerCount).toBe(2);

    // 用各异且变化的输入跑一段
    const dirs = [
      { dx: 1, dy: 0 }, { dx: 1, dy: 1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 1 },
      { dx: -1, dy: 0 }, { dx: 0, dy: 0 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
    ];
    for (let s = 0; s < 90; s++) {
      inA = dirs[s % dirs.length];
      inB = dirs[(s + 3) % dirs.length];
      clock += STEP;
      A.pump(STEP);
      B.pump(STEP);
    }

    // 逐 tick 校验：epoch 'A|B' 下，凡两端都报告过 hash 的 tick，hash 必相等。
    const hashAt = new Map<string, string>(); // `${peer}@${tick}` -> hash
    const ticks = new Set<number>();
    for (const m of bus.log) {
      if (m.t !== 'hash' || m.epoch !== 'A|B') continue;
      hashAt.set(`${m.peer}@${m.tick}`, m.hash);
      ticks.add(m.tick);
    }
    let compared = 0;
    let maxCommon = 0;
    for (const tk of ticks) {
      const ha = hashAt.get(`A@${tk}`);
      const hb = hashAt.get(`B@${tk}`);
      if (ha !== undefined && hb !== undefined) {
        expect(ha).toBe(hb); // ← 帧同步的硬证据：同 tick、两端逐位一致
        compared++;
        maxCommon = Math.max(maxCommon, tk);
      }
    }
    expect(compared).toBeGreaterThan(40); // 确实比对了足够多的 tick
    expect(maxCommon).toBeGreaterThan(40);
  });

  it('单端也能独立推进（等待第二端时不卡死、不报错）', () => {
    const bus = new MockBus();
    let clock = 0;
    const now = () => clock;
    const solo = new LockstepClient({
      peerId: 'solo',
      channel: bus.channel('solo'),
      getInput: () => ({ dx: 1, dy: 0 }),
      now,
      tickRate: 30,
      inputDelay: 4,
    });
    for (let i = 0; i < 30; i++) {
      clock += STEP;
      solo.pump(STEP);
    }
    expect(solo.view().peerCount).toBe(1);
    expect(solo.view().tick).toBeGreaterThan(10); // 单人自由推进
  });

  it('第二端加入 → 两端按新成员从 tick 0 重新对齐（membership 变化触发 reset）', () => {
    const bus = new MockBus();
    let clock = 0;
    const now = () => clock;
    const A = new LockstepClient({ peerId: 'A', channel: bus.channel('A'), getInput: () => ({ dx: 1, dy: 0 }), now, tickRate: 30, inputDelay: 4 });
    // A 先单独跑一会
    for (let i = 0; i < 20; i++) {
      clock += STEP;
      A.pump(STEP);
    }
    expect(A.view().epoch).toBe('A');
    const tickBeforeJoin = A.view().tick;
    expect(tickBeforeJoin).toBeGreaterThan(5);

    // B 加入
    const B = new LockstepClient({ peerId: 'B', channel: bus.channel('B'), getInput: () => ({ dx: 0, dy: 1 }), now, tickRate: 30, inputDelay: 4 });
    for (let i = 0; i < 12; i++) {
      clock += STEP;
      A.pump(STEP);
      B.pump(STEP);
    }
    expect(A.view().epoch).toBe('A|B'); // 新 epoch
    expect(B.view().epoch).toBe('A|B');
    expect(A.view().peerCount).toBe(2);
  });

  // ── P0 回归（engine-review-2026-08-04 §3.3·实测复现）────────────────────
  // 加入死锁：两端**切 epoch 的时刻不同**。先切的一方在对端还没进新 epoch 时就广播了
  // 该 epoch 的输入，对端按 epoch 不符丢弃；而发送方 committedInputTick 单调递增、
  // 永不重发 → 后进入者永久缺那几拍，卡住后自己也不再产出新输入 → 两端互等、永久卡死。
  it('加入错峰（对端尚未进入新 epoch 时收到该 epoch 的输入）→ 两端仍必须继续推进，不得死锁', () => {
    const bus = new MockBus();
    let clock = 0;
    const now = () => clock;
    const A = new LockstepClient({ peerId: 'A', channel: bus.channel('A'), getInput: () => ({ dx: 1, dy: 0 }), now, tickRate: 30, inputDelay: 4 });
    // A 先单独跑几拍：把 A 的心跳时刻钉在 clock=0，后面几轮 A 都不会再发 hello
    // （HEARTBEAT_MS=250）——这是造出「A 已切新 epoch、B 还没切」错峰的关键。
    A.pump(STEP);
    for (let i = 0; i < 4; i++) { clock += STEP; A.pump(STEP); }

    const B = new LockstepClient({ peerId: 'B', channel: bus.channel('B'), getInput: () => ({ dx: 0, dy: 1 }), now, tickRate: 30, inputDelay: 4 });
    // 错峰窗口：B 先 pump（B 的 hello 让 A 立刻切到 'A|B'），而 A 尚未到心跳点、
    // 不发 hello → B 仍停在 epoch 'B'。此间 A 在 'A|B' 下广播的输入会被 B 全部丢弃。
    for (let i = 0; i < 3; i++) {
      clock += STEP;
      B.pump(STEP);
      A.pump(STEP);
    }
    expect(A.view().epoch).toBe('A|B'); // A 已切
    expect(B.view().epoch).toBe('B');   // B 未切 → 错峰已成立（前置条件，非结论）

    // 放开长跑：A 心跳到点 → B 也切进 'A|B'。修复前两端会分别永久停在
    // 2*inputDelay 与 inputDelay（A 缺 B 的新输入、B 缺被丢弃的那几拍）。
    for (let i = 0; i < 120; i++) {
      clock += STEP;
      A.pump(STEP);
      B.pump(STEP);
    }
    expect(A.view().epoch).toBe('A|B');
    expect(B.view().epoch).toBe('A|B');
    // 核心断言：两端都真的推进了（死锁时 A=8 / B=4 永远不动）。
    expect(B.view().tick).toBeGreaterThan(30);
    expect(A.view().tick).toBeGreaterThan(30);

    // 且修死锁不能靠「放宽输入集齐」换来 desync：把落后一端追到同一 tick 再比 hash。
    // （瞬时 tick 差一两拍属正常——本 harness 每轮 A 先 pump；逐 tick 全等由本文件
    //   第一个用例覆盖，这里只需确认错峰加入后两端仍收敛到同一状态。）
    for (let i = 0; i < 40 && A.view().tick !== B.view().tick; i++) {
      clock += STEP;
      if (B.view().tick < A.view().tick) B.pump(STEP); else A.pump(STEP);
    }
    expect(A.view().tick).toBe(B.view().tick);
    expect(A.view().hash).toBe(B.view().hash);
  });
});
