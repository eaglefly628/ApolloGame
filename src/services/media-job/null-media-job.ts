import type {
  MediaJobPort, MediaCachePort, MediaJob, MediaJobKind, MediaJobInputs,
  MediaOpResult, MediaExportResult,
} from './media-job-port.js';

// ═══════════════════════════════════════════════════════════════
//  Null 实现 —— **不发任何网络**，供无网 CI / headless / 无后端（MVP）跑通全链。
//  照 `NullAishePort` / `NullNpcAgentPort` 的同款理由：真后端那条路进不了 CI，
//  于是「UI 等作业等得对不对、缓存换片换得对不对」就没人验过。这里让它可验。
//
//  **推进按 poll 次数，不按墙钟**——墙钟是确定性红线，也会让测试变成时序赌博。
// ═══════════════════════════════════════════════════════════════

export interface NullMediaJobOptions {
  /** 几次 poll 后转 ready（缺省 2：让 `pending→running→ready` 三态都真走一遍）。`trunc` + 下钳 1。 */
  readyAfterPolls?: number;
}

export class NullMediaJobPort implements MediaJobPort {
  readonly log: Array<{ kind: MediaJobKind; inputs: MediaJobInputs }> = [];
  private counter = 0;
  private readonly jobs = new Map<string, { job: MediaJob; polls: number }>();
  private readonly readyAfterPolls: number;

  constructor(opts: NullMediaJobOptions = {}) {
    this.readyAfterPolls = Math.max(1, Math.trunc(opts.readyAfterPolls ?? 2));
  }

  async submit(kind: MediaJobKind, inputs: MediaJobInputs): Promise<MediaJob> {
    // 空输入是调用方的 bug，不是后端的——当场落 error 而不是提交一个注定失败的作业。
    if (inputs.refs.length === 0) {
      return { id: '', kind, status: 'error', progress: 0, error: 'refs 为空（没有输入可处理）' };
    }
    this.counter += 1;
    this.log.push({ kind, inputs });
    const job: MediaJob = { id: `mj-null-${this.counter}`, kind, status: 'pending', progress: 0 };
    this.jobs.set(job.id, { job, polls: 0 });
    return job;
  }

  async poll(id: string): Promise<MediaJob> {
    const rec = this.jobs.get(id);
    if (!rec) return { id, kind: 'animate', status: 'error', progress: 0, error: '未知作业 id' };
    if (rec.job.status === 'pending' || rec.job.status === 'running') {
      rec.polls += 1;
      if (rec.polls >= this.readyAfterPolls) {
        rec.job = { ...rec.job, status: 'ready', progress: 1000, outputRef: `about:media#${id}` };
      } else {
        // 进度按「已 poll / 需 poll」线性推，整数千分比（见 MediaJob.progress 注释）。
        rec.job = { ...rec.job, status: 'running', progress: Math.trunc((rec.polls * 1000) / this.readyAfterPolls) };
      }
    }
    return rec.job;
  }

  async cancel(id: string): Promise<MediaOpResult> {
    const rec = this.jobs.get(id);
    if (!rec) return { ok: false, error: '未知作业 id' };
    if (rec.job.status !== 'pending' && rec.job.status !== 'running') {
      return { ok: false, error: `作业已是 ${rec.job.status}，撤不回` };
    }
    rec.job = { ...rec.job, status: 'cancelled' };
    return { ok: true };
  }

  async delete(id: string): Promise<MediaOpResult> {
    return this.jobs.delete(id) ? { ok: true } : { ok: false, error: '未知作业 id' };
  }

  async export(id: string): Promise<MediaExportResult> {
    const rec = this.jobs.get(id);
    if (!rec) return { ok: false, error: '未知作业 id' };
    if (rec.job.status !== 'ready') return { ok: false, error: `作业未就绪（${rec.job.status}）` };
    return { ok: true, url: rec.job.outputRef };
  }
}

/**
 * 内存媒体缓存 —— Blob 进 Map。CI / headless 用；浏览器侧真实现走 CacheStorage 或 IndexedDB(blob)。
 * `keys()` **按 key 升序**（端口契约要求全序·调用方的逐出决策才可复现）。
 */
export class MemoryMediaCachePort implements MediaCachePort {
  private readonly store = new Map<string, Blob>();

  async get(key: string): Promise<Blob | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, blob: Blob): Promise<MediaOpResult> {
    if (key === '') return { ok: false, error: 'key 不许为空' };
    this.store.set(key, blob);
    return { ok: true };
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async delete(key: string): Promise<MediaOpResult> {
    return this.store.delete(key) ? { ok: true } : { ok: false, error: '无此 key' };
  }

  async keys(): Promise<readonly string[]> {
    return [...this.store.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  async size(): Promise<number> {
    let total = 0;
    for (const b of this.store.values()) total += b.size;
    return total;
  }
}
