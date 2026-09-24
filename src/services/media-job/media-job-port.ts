// ═══════════════════════════════════════════════════════════════
//  MediaJobPort / MediaCachePort —— 媒体作业链端口（REQ-112-ENG-06·owner 2026-09-24 判
//  **A·先立端口**「现在暂时可能会接别的组件」→ 形状必须与具体供应商解耦）。
//
//  与 `AishePort`（REQ-112-ENG-05）成对：Aishe 管**生成一段视频**；本端口管**围着生成的那条作业链**
//  ——提交长作业、查进度、撤、删、导出，以及把已就绪的字节缓存起来别重复下载。
//
//  ── 为什么非得新立一个端口（实查留痕·别当重复造轮子）──
//   · `services/storage` 的 `IndexedDbKV` **只收 string**（看 `put(key, value: string)`）——
//     视频是字节，塞进 string KV 只能 base64，体积 +33% 且每次读写都要转码。**故 `MediaCachePort` 走 Blob。**
//   · `main_entry/server.py` 的 `/api/art/upload` 是**单图 dataBase64**（创作者换槽用），
//     `/api/assets/{matte,generate,review}` 是开发期件——都不是「长作业 + 轮询 + 审核」这条链。
//   · 全仓无 CacheStorage / Service Worker 接入面。
//
//  ── 三条纪律（同 `HttpNpcAgentPort` / `HttpAishePort`）──
//   ① **绝不抛**：一切失败落 `{ok:false,error}` 或 error 态作业。
//   ② **绝不碰 world / snapshot / hash**：旁路基础设施，与确定性 sim 解耦。
//   ③ **只归一形状**：不替调用方定产品策略（超时多久算失败、缓存多大该逐出、谁有权审核）。
//      **端口薄** = 这些一律不在这里。
//
//  ⚖ 与单子的一处**有意偏差（报 owner/复查门）**：单子写审核队列形状为 `{jobId, catId, ...}`。
//    `catId` 是 game112 的「猫」——**引擎端口不该知道游戏里有猫**（跨游戏共享面）。
//    本文件落成 **`subjectId`**（这段媒体是关于谁的），game112 侧把 catId 映射进去即可。
//    语义一字不差，只是把游戏词换成引擎词。
// ═══════════════════════════════════════════════════════════════

/**
 * 作业类型（**闭集**）。加一种 = 改本枚举一行（引擎面改动·可审计），
 * **不是**给游戏层留一个塞自由字符串的口子。
 */
export type MediaJobKind =
  | 'animate'    // 静态图 → 活视频（照片转活）
  | 'stitch'     // 多段衔接成一条（首尾帧对齐）
  | 'matte'      // 抠像 / 生成 alpha
  | 'transcode'; // 转码 / 转序列帧图集

export type MediaJobStatus = 'pending' | 'running' | 'ready' | 'error' | 'cancelled';

/**
 * 作业输入。**只走引用，绝不走裸字节**（同 `AisheImageRef` 的理由：
 * 选项对象要可日志、可比较、可缓存 key 化；字节走 `MediaCachePort`）。
 */
export interface MediaJobInputs {
  /** 输入引用（url 或资产 key）。**顺序有意义**（stitch 靠它定前后段）。 */
  readonly refs: readonly string[];
  /**
   * 透传参数（fps / 时长 / 画幅 …）。**引擎一概不解释**，原样交给后端——
   * 这是「与供应商解耦」的代价也是它的实现方式：端口不懂 provider 的旋钮，也就不会被某个 provider 绑住。
   */
  readonly params?: Readonly<Record<string, string | number | boolean>>;
  /** 这段媒体是关于谁的（见文件头偏差说明：game112 的 catId 映射到这里）。 */
  readonly subjectId?: string;
}

export interface MediaJob {
  readonly id: string;
  readonly kind: MediaJobKind;
  readonly status: MediaJobStatus;
  /** 进度千分比（0–1000·**整数**）。用千分比不用浮点小数：浮点进日志/比较会出 1 ULP 噪声。 */
  readonly progress: number;
  /** `ready` 时的产物引用。 */
  readonly outputRef?: string;
  readonly error?: string;
}

/** 通用操作结果。**绝不抛**——失败落 `{ok:false,error}`。 */
export interface MediaOpResult {
  readonly ok: boolean;
  readonly error?: string;
}

/** `export` 的结果：可直接交给用户下载/分享的地址。 */
export interface MediaExportResult extends MediaOpResult {
  readonly url?: string;
}

export interface MediaJobPort {
  /** 提交一条作业（异步）。返回的作业可能已是 `error`（后端拒）——**不抛**。 */
  submit(kind: MediaJobKind, inputs: MediaJobInputs): Promise<MediaJob>;
  /** 查进度。未知 id → `status:'error'`（不抛）。 */
  poll(id: string): Promise<MediaJob>;
  /** 撤回在跑的作业（作业有成本）。已终态 / 未知 id → `{ok:false}`。 */
  cancel(id: string): Promise<MediaOpResult>;
  /** 删除作业与产物（**隐私面**：用户传的照片生成物必须能删干净）。 */
  delete(id: string): Promise<MediaOpResult>;
  /** 导出产物给用户（下载/分享）。未就绪 → `{ok:false}`。 */
  export(id: string): Promise<MediaExportResult>;
}

/**
 * 媒体字节缓存（**Blob 级·不是 string KV**）。
 * 用途：已就绪的片段存本地，换片不重新下载（REQ-112-ENG-11 的换片不黑帧依赖它）。
 * **逐出策略不在端口里**（那是产品策略·见纪律③）——要逐出由调用方自己按 `keys()` 决定删谁。
 */
export interface MediaCachePort {
  get(key: string): Promise<Blob | null>;
  put(key: string, blob: Blob): Promise<MediaOpResult>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<MediaOpResult>;
  /** 现有的 key。**按 key 升序**（全序·不许「看谁先进来」——否则调用方的逐出决策不可复现）。 */
  keys(): Promise<readonly string[]>;
  /** 当前占用字节数（调用方判「该不该逐出」用）。 */
  size(): Promise<number>;
}

// ── 审核队列（**数据形状 + 纯函数**·无 IO）─────────────────────────────────
// 宪法「无自动入库」同款纪律：AI 生成的媒体**先进待审**，人过了才算数（照
// `scripts/ai-gen.mjs review` 的既有口径）。这里只定形状与状态转移，谁有权审核不在端口里。

export type MediaReviewVerdict = 'pending' | 'approved' | 'rejected';

export interface MediaReviewItem {
  readonly jobId: string;
  /** 这段媒体是关于谁的（game112: 猫 id）。 */
  readonly subjectId: string;
  readonly kind: MediaJobKind;
  readonly status: MediaReviewVerdict;
  /** 驳回理由（`rejected` 必填——不写理由的驳回等于没审）。 */
  readonly reason?: string;
}

/** 按 jobId 升序（全序·队列顺序会被人眼与测试同时读，不许跟插入序走）。 */
export function sortReviewQueue(q: readonly MediaReviewItem[]): MediaReviewItem[] {
  return [...q].sort((a, b) => (a.jobId < b.jobId ? -1 : a.jobId > b.jobId ? 1 : 0));
}

/** 待审的那些（按 jobId 升序）。 */
export function pendingReviews(q: readonly MediaReviewItem[]): MediaReviewItem[] {
  return sortReviewQueue(q.filter((i) => i.status === 'pending'));
}

/**
 * 落一条审核结论 → **新队列**（不改入参·入序即出序）。
 * 三条判据：① 未知 jobId 不静默吞（`changed:false` 明说）② **驳回必须带理由**
 * ③ 已终态的不许改判（审完了就是审完了·要翻案重新提作业）。
 */
export function decideReview(
  q: readonly MediaReviewItem[], jobId: string, verdict: 'approved' | 'rejected', reason?: string,
): { queue: MediaReviewItem[]; changed: boolean; error?: string } {
  const idx = q.findIndex((i) => i.jobId === jobId);
  if (idx < 0) return { queue: [...q], changed: false, error: '未知 jobId' };
  if (q[idx].status !== 'pending') return { queue: [...q], changed: false, error: `已是 ${q[idx].status}，不许改判` };
  if (verdict === 'rejected' && !(reason ?? '').trim()) {
    return { queue: [...q], changed: false, error: '驳回必须带理由' };
  }
  const next = [...q];
  next[idx] = { ...q[idx], status: verdict, ...(verdict === 'rejected' ? { reason } : {}) };
  return { queue: next, changed: true };
}
