// 媒体作业链服务（REQ-112-ENG-06·基础设施·确定性 sim 之外）。
// 与 `services/aigp` 的 `AishePort` 成对：Aishe 生成一段视频，本服务管围着生成的那条作业链
// （提交长作业 / 查进度 / 撤 / 删 / 导出）+ 已就绪字节的 Blob 级缓存 + 「无自动入库」的审核队列形状。
// 无后端时用 `NullMediaJobPort` + `MemoryMediaCachePort`（不发网络·CI 可跑全链）。
export type {
  MediaJobPort, MediaCachePort, MediaJob, MediaJobKind, MediaJobStatus, MediaJobInputs,
  MediaOpResult, MediaExportResult, MediaReviewItem, MediaReviewVerdict,
} from './media-job-port.js';
export { sortReviewQueue, pendingReviews, decideReview } from './media-job-port.js';
export { NullMediaJobPort, MemoryMediaCachePort } from './null-media-job.js';
export type { NullMediaJobOptions } from './null-media-job.js';
