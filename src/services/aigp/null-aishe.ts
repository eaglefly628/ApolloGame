import type {
  AishePort, AisheGenerateOptions, AisheVideoHandle, AisheOpResult,
} from './aishe-port.js';

// 空爱诗后端 —— 不调任何外部服务，即时返回一个确定性占位句柄。供 headless / 测试 / 无后端（MVP）时使用。
// 记录调用日志便于断言；句柄 id 用自增计数（确定性）。占位 url 是标记性的 about: 链接，绝不发网络。
// 类比 NullAudioPort / 占位资产：缺真后端时一切照常跑，UI 拿到 ready 句柄展示占位即可。
//
// ── REQ-112-ENG-05 补 poll/cancel/delete ──
// 缺省行为**一个字没变**（generate 即时 ready）——既有断言与 game-i video-lab 零回归。
// 新增 `pendingFirst` 是**opt-in 的异步路径桩**：照 `NullNpcAgentPort` 的同款理由——
// 真 provider 的正常路径是「先 pending、后 ready」，而那条路进不了无网 CI，也就没人验过
// 「UI 等 pending 等得对不对」。开了它就能在 CI 里把这条路走一遍。
// **转 ready 按 poll 次数，不按墙钟**（墙钟 = 确定性红线，且会让测试变成时序赌博）。

export interface NullAisheOptions {
  /** true = `generate` 先回 `pending`，第 `readyAfterPolls` 次 `poll` 起转 `ready`。缺省 false（即时 ready）。 */
  pendingFirst?: boolean;
  /** `pendingFirst` 时需要几次 poll 才 ready（缺省 1·`Math.trunc` + 下钳到 1）。 */
  readyAfterPolls?: number;
}

export class NullAishePort implements AishePort {
  readonly log: Array<{ prompt: string; opts?: AisheGenerateOptions }> = [];
  private counter = 0;
  /** 作业台账：poll/cancel/delete 的唯一状态源（进程内·不落盘·端口不做持久化）。 */
  private readonly jobs = new Map<string, { handle: AisheVideoHandle; polls: number }>();
  private readonly pendingFirst: boolean;
  private readonly readyAfterPolls: number;

  constructor(opts: NullAisheOptions = {}) {
    this.pendingFirst = opts.pendingFirst === true;
    this.readyAfterPolls = Math.max(1, Math.trunc(opts.readyAfterPolls ?? 1));
  }

  async generate(prompt: string, opts?: AisheGenerateOptions): Promise<AisheVideoHandle> {
    this.counter += 1;
    this.log.push({ prompt, opts });
    const id = `aishe-null-${this.counter}`;
    const handle: AisheVideoHandle = this.pendingFirst
      ? { id, status: 'pending', prompt }
      : { id, status: 'ready', prompt, url: `about:aishe#${this.counter}` };
    this.jobs.set(id, { handle, polls: 0 });
    return handle;
  }

  async poll(id: string): Promise<AisheVideoHandle> {
    const job = this.jobs.get(id);
    if (!job) return { id, status: 'error', prompt: '', error: '未知作业 id' };
    if (job.handle.status === 'pending') {
      job.polls += 1;
      if (job.polls >= this.readyAfterPolls) {
        const n = id.slice('aishe-null-'.length);
        job.handle = { ...job.handle, status: 'ready', url: `about:aishe#${n}` };
      }
    }
    return job.handle;
  }

  async cancel(id: string): Promise<AisheOpResult> {
    const job = this.jobs.get(id);
    if (!job) return { ok: false, error: '未知作业 id' };
    if (job.handle.status !== 'pending') return { ok: false, error: `作业已是 ${job.handle.status}，撤不回` };
    job.handle = { id, status: 'error', prompt: job.handle.prompt, error: '已撤回' };
    return { ok: true };
  }

  async delete(id: string): Promise<AisheOpResult> {
    return this.jobs.delete(id) ? { ok: true } : { ok: false, error: '未知作业 id' };
  }
}
