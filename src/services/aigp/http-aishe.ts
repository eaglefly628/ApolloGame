import type {
  AishePort, AisheGenerateOptions, AisheStatus, AisheVideoHandle, AisheOpResult,
} from './aishe-port.js';

export interface HttpAisheConfig {
  endpoint: string; // 视频生成 API 端点（submit）
  apiKey?: string; // 鉴权（可选，Bearer）
  fetchImpl?: typeof fetch; // 注入 fetch（测试/Node）；缺省用全局 fetch
  /**
   * 作业端点基址（poll/cancel/delete 用）。缺省取 `endpoint`。
   * 约定：`GET <base>/<id>` 查 · `POST <base>/<id>/cancel` 撤 · `DELETE <base>/<id>` 删。
   * **换 provider 只改这三处路径**——端口契约与游戏侧一行不动（这正是端口的意义）。
   */
  jobEndpoint?: string;
}

// 真后端骨架 —— 把提示词 POST 给外部视频生成 API，解析回视频句柄。provider 无关（端点 + 鉴权可配）。
// 表现层旁路：异步、绝不碰 world / snapshot / hash。接入具体 provider 时按其文档把请求/响应字段适配此骨架。
// 失败不抛异常，返回 error 句柄（展示层据 status 处理）——与确定性 sim 解耦，后端故障不影响游戏推进。
//
// ── 三条纪律（同 `HttpNpcAgentPort`·REQ-112-ENG-05 起对四个方法一体适用）──
//  ① **绝不抛**：非 2xx / 坏 JSON / 网络断 / 超时，一律落 error 句柄或 `{ok:false}`。
//  ② **绝不碰 world**：这里只有 fetch 与形状归一，没有任何 world/hash 接触面。
//  ③ **只归一形状**：不替调用方判业务（比如不猜「pending 多久算超时」）——那是产品策略，不是端口的事。
export class HttpAishePort implements AishePort {
  constructor(private readonly cfg: HttpAisheConfig) {}

  private get jobBase(): string {
    return this.cfg.jobEndpoint ?? this.cfg.endpoint;
  }

  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      ...(this.cfg.apiKey ? { authorization: `Bearer ${this.cfg.apiKey}` } : {}),
    };
  }

  async generate(prompt: string, opts?: AisheGenerateOptions): Promise<AisheVideoHandle> {
    const doFetch = this.cfg.fetchImpl ?? fetch;
    try {
      const res = await doFetch(this.cfg.endpoint, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          prompt,
          aspect: opts?.aspect ?? '9:16',
          negativePrompt: opts?.negativePrompt,
          seconds: opts?.seconds,
          seed: opts?.seed,
          // REQ-112-ENG-05：参考输入四件（JSON.stringify 自动丢 undefined → 不传就不出现在请求体里）
          referenceImages: opts?.referenceImages,
          characterId: opts?.characterId,
          firstFrame: opts?.firstFrame,
          lastFrame: opts?.lastFrame,
        }),
      });
      if (!res.ok) return { id: '', status: 'error', prompt, error: `HTTP ${res.status}` };
      const data = (await res.json()) as { id?: string; url?: string; status?: string };
      const status: AisheStatus = (data.status as AisheStatus) ?? (data.url ? 'ready' : 'pending');
      return { id: data.id ?? '', status, prompt, url: data.url };
    } catch (e) {
      return { id: '', status: 'error', prompt, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async poll(id: string): Promise<AisheVideoHandle> {
    const doFetch = this.cfg.fetchImpl ?? fetch;
    try {
      const res = await doFetch(`${this.jobBase}/${encodeURIComponent(id)}`, {
        method: 'GET', headers: this.headers(),
      });
      if (!res.ok) return { id, status: 'error', prompt: '', error: `HTTP ${res.status}` };
      const data = (await res.json()) as { id?: string; url?: string; status?: string; prompt?: string };
      const status: AisheStatus = (data.status as AisheStatus) ?? (data.url ? 'ready' : 'pending');
      // prompt 回显：provider 回了就用，没回就 ''（见 AisheVideoHandle.prompt 注释——不是丢了，是没回）。
      return { id: data.id ?? id, status, prompt: data.prompt ?? '', url: data.url };
    } catch (e) {
      return { id, status: 'error', prompt: '', error: e instanceof Error ? e.message : String(e) };
    }
  }

  async cancel(id: string): Promise<AisheOpResult> {
    return this.op(`${this.jobBase}/${encodeURIComponent(id)}/cancel`, 'POST');
  }

  async delete(id: string): Promise<AisheOpResult> {
    return this.op(`${this.jobBase}/${encodeURIComponent(id)}`, 'DELETE');
  }

  /** cancel/delete 共用：只看 2xx，不解析体（provider 回什么都不影响「撤了没 / 删了没」）。 */
  private async op(url: string, method: 'POST' | 'DELETE'): Promise<AisheOpResult> {
    const doFetch = this.cfg.fetchImpl ?? fetch;
    try {
      const res = await doFetch(url, { method, headers: this.headers() });
      return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
