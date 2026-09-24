// AishePort —— 爱诗(AIGP)视频生成端口（基础设施，确定性 sim 之外；表现层旁路，REQ-C-004）。
//
// 输入 = 一段提示词（由 sim 外的「外观→提示词」纯数据表组装，活样例见 game-i video-lab）；
// 输出 = 一个视频句柄（异步生成，UI 据此展示/分享）。后端可换（Null/真后端），契约不变——
// 与渲染/音频/资产端口同一哲学（EnginePort 风格）。**绝不碰 world / snapshot / hash**（异步旁路，
// 与资产、音频同纪律）→ 不影响确定性/lockstep/录放。对应周期表「扩展 C: AIGP 旁路」X4–X7 的消费端。
//
// ── REQ-112-ENG-05（owner 2026-09-24 判 A「要做，毕竟要跟爱诗对接」）补两块 ──
//  ① **作业生命周期**：原接口只有 `generate`，而它**可以返回 `status:'pending'`**
//     （`http-aishe.ts` 无 url 即 pending）——**全仓没有任何东西能把 pending 解出来**：
//     句柄一旦 pending 就永远悬着，UI 只能干等。这不是缺特性，是接口的死胡同。
//     故加 `poll(id)`；配套 `cancel(id)` / `delete(id)`（用户撤回与删除是产品面硬需求·生成有成本）。
//  ② **参考输入**：照片转活视频 / 同一只猫多段一致 / 首尾帧衔接都要喂参考图与角色 id，
//     原 `AisheGenerateOptions` 零图片字段。新增四个字段**全部可选**。
//
// ⚠ 向后兼容口径（**故意**）：`AisheGenerateOptions` / `AisheVideoHandle` / `AisheStatus` 的
//    **既有字段一个没动，新增字段全可选**——因为 `src/ui/aishe/aishe-studio.ts` 消费这两个类型而
//    那是 **PUI 域**（本单是 🔴 主程面，不得顺手改 PUI 的文件）。接口新增的三个方法只落在
//    本目录两个实现上（全仓 implements AishePort 仅 Null/Http 两处·已实查）。

/**
 * 图片引用：**url 或资产 key**。
 * **绝不塞裸字节 / base64**——字节走 `MediaCachePort` 的 Blob 面（REQ-112-ENG-06）；
 * 这里只走引用，才能让选项对象保持可日志、可缓存、可比较。
 */
export type AisheImageRef = string;

export interface AisheGenerateOptions {
  aspect?: string; // 画幅，如 '9:16'（竖屏短视频）
  negativePrompt?: string; // 负面提示词
  seconds?: number; // 时长（秒）
  seed?: number; // 可复现生成的种子（可选）
  /** 参考图（风格/主体一致性）。顺序有意义 = provider 的权重次序，调用方自己排好再传。 */
  referenceImages?: readonly AisheImageRef[];
  /** 角色 id：同一主体跨多段保持一致（provider 侧的 character/consistency 概念）。 */
  characterId?: string;
  /** 首帧：从这张图起（照片转活视频的入口）。 */
  firstFrame?: AisheImageRef;
  /** 尾帧：收在这张图（多段衔接时上一段的尾 = 下一段的首，才能不跳帧）。 */
  lastFrame?: AisheImageRef;
}

export type AisheStatus = 'pending' | 'ready' | 'error';

export interface AisheVideoHandle {
  id: string; // 句柄 id
  status: AisheStatus;
  /**
   * 生成所用提示词（**回显**）。
   * `poll()` 路径上 provider 常不回它 → 此时为 `''`（**不是丢了，是没回**）。
   * 要稳定拿到原文请自己留着 `generate()` 的返回值——端口不做状态存储。
   */
  prompt: string;
  url?: string; // status==='ready' 时的视频地址
  error?: string; // status==='error' 时的错误信息
}

/** `cancel` / `delete` 的结果。**绝不抛**——失败一律落 `{ok:false,error}`（同 `HttpNpcAgentPort` 纪律）。 */
export interface AisheOpResult {
  ok: boolean;
  error?: string;
}

export interface AishePort {
  /** 提交一段提示词生成视频，返回句柄（异步）。Null 后端即时返回 ready 的占位句柄；真后端调外部 API。 */
  generate(prompt: string, opts?: AisheGenerateOptions): Promise<AisheVideoHandle>;
  /**
   * 查一个作业现在什么状态。**`pending` 句柄唯一的出路**。
   * 未知 id 返回 `status:'error'` 的句柄（**不抛**）——调用方按 status 分流即可，不必 try/catch。
   */
  poll(id: string): Promise<AisheVideoHandle>;
  /** 撤回在跑的作业（生成有成本·用户点了取消就该真停）。已完成/未知 id → `{ok:false}`。 */
  cancel(id: string): Promise<AisheOpResult>;
  /** 删除作业与其产物（隐私面：用户传的照片生成物必须能删干净）。未知 id → `{ok:false}`。 */
  delete(id: string): Promise<AisheOpResult>;
}
