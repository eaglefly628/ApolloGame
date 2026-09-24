// ═══════════════════════════════════════════════════════════════
//  video-clips —— 引擎能力「内嵌 AI 视频播放」的**纯核**（REQ-112-ENG-11·owner 2026-09-24 判 A）。
//
//  游戏侧只给**数据**（片段目录），不写播放器；选哪一片、缺片怎么退、下一片预载谁、
//  换片会不会黑帧——全在这里，全是纯函数，零 DOM、零网络、零世界访问。
//
//  ── 三条边界（**这是本件最要紧的部分**）──
//  ① **不新增 sim 组件，因此根本不碰 hash。**
//     单子把「determinism.ts 登记」列进了边界，那是假定要加一个 render-only 组件。
//     实做下来不需要：片段目录是**宿主层数据**（同 `framework.md §2 CLIP_CATALOG`「每猫一份·纯数据」），
//     宿主**只读** `State{fsmId}.current` 再投影出一个 clipKey 给 UI。世界里不多一个字段，
//     也就没有「忘了登记 NON_DETERMINISTIC 导致 desync」这一类事故面。**不加比加了再登记更安全。**
//  ② **播放进度 / 结束不进 sim**（单子第 2 条）。本文件不产出任何要写回世界的东西；
//     `ended` 只走 UI 层的 action 信号（见 `src/ui/components/server.ts` 的 video ended 接线）。
//  ③ **透明 / 遮罩不在本轮**——单子第 5 条明写「可选高级项」。`framework.md §6⑨` 里 GD 推荐延后
//     的理由正是「大投入押在浏览器透明视频（VP9/HEVC alpha）兼容性上」，owner 的单子已把它摘成可选，
//     故本轮不做，也**不假装做了**。
//
//  确定性口径：一切排序按 clipKey 升序全序兜底（同分不许「看谁先来」）；ticks 整数。
//  本件虽在 sim 外，但它的输出会决定玩家看到什么——不可复现的选片 = 不可复现的 bug。
// ═══════════════════════════════════════════════════════════════

import { cmpStr } from '@engine/math/scalar.js';

/** 审核态。**缺省 pending**——「无自动入库」（宪法）：没人审过的生成片不许自己爬上画面。 */
export type ClipReview = 'pending' | 'approved' | 'rejected';
export type ClipSource = 'official' | 'generated';

/** 一条片段（POD·纯数据·形状对齐 `docs/design/game112/framework.md §2` 的 CLIP_CATALOG）。 */
export interface VideoClip {
  /** 资产 key（序列帧图集或视频）。目录内唯一。 */
  clipKey: string;
  /** 对应 sim 的 `State{fsmId}.current`（同 `t2-anim-state` 按状态选 clip 的口径）。 */
  state: string;
  /** 片长（**整数 tick**）。sim 拿它推进 `after`，所以不许是小数。 */
  ticks: number;
  loop?: boolean;
  /** 首姿势（缺省 `neutral`）。换片不黑帧靠它与上一片的 `poseOut` 对齐。 */
  poseIn?: string;
  /** 尾姿势（缺省 `neutral`）。 */
  poseOut?: string;
  /** 个性片 = 属于某个主体；**缺省 = 通用片**（回退链第二环）。 */
  subjectId?: string;
  /** 这一片缺了退到哪一片（目录内的另一个 clipKey）。 */
  fallbackClipKey?: string;
  review?: ClipReview;
  source?: ClipSource;
}

export interface VideoClipCatalog {
  id: string;
  clips: readonly VideoClip[];
  /** 基础活照片：所有状态共用的兜底动片（回退链倒数第二环）。 */
  baseClipKey?: string;
  /** 链尾静态图。**本地静态资产 → 永远算就绪**，这就是「断网时链尾必达」的实现。 */
  stillRef?: string;
}

export interface ClipSelectCtx {
  /** 谁的个性片优先。 */
  subjectId?: string;
  /** 已就绪（缓存命中 / 已预载）的 clipKey 集合。**缺省 = 全部当就绪**（无缓存信息时不自我降级）。 */
  ready?: ReadonlySet<string>;
  /** 放行未审片（开发期用）。缺省 false = 只播 `approved`。 */
  allowPending?: boolean;
}

/** 回退链的一环。`kind` 让调用方/测试看得出退到第几环了。 */
export interface ClipCandidate {
  kind: 'personal' | 'generic' | 'declared-fallback' | 'base' | 'still';
  /** clipKey（`still` 环时是 `stillRef`）。 */
  ref: string;
}

const POSE_DEFAULT = 'neutral';
export const poseIn = (c: VideoClip): string => c.poseIn ?? POSE_DEFAULT;
export const poseOut = (c: VideoClip): string => c.poseOut ?? POSE_DEFAULT;

/** 这一片现在可选吗：`rejected` 永不可选；`pending` 只有 `allowPending` 才放行。 */
export function isPlayable(c: VideoClip, ctx: ClipSelectCtx = {}): boolean {
  const r = c.review ?? 'pending';
  if (r === 'rejected') return false;
  return r === 'approved' || ctx.allowPending === true;
}

/**
 * 回退链（单子第 4 条）：**个性片 → 通用片 → 该片声明的 fallback → 基础活照片 → 静态图**。
 * 每环内按 clipKey 升序（全序·不跟数组插入序走）。链尾 `still` 若声明了就**必然在**——
 * 这是「断网时链尾必达」的结构保证，不靠运行期祈祷。
 */
export function resolveChain(
  catalog: VideoClipCatalog, state: string, ctx: ClipSelectCtx = {},
): ClipCandidate[] {
  const ofState = catalog.clips.filter((c) => c.state === state && isPlayable(c, ctx));
  const byKey = (a: VideoClip, b: VideoClip): number => cmpStr(a.clipKey, b.clipKey);
  const personal = ctx.subjectId === undefined ? []
    : [...ofState.filter((c) => c.subjectId === ctx.subjectId)].sort(byKey);
  const generic = [...ofState.filter((c) => c.subjectId === undefined)].sort(byKey);

  const out: ClipCandidate[] = [];
  const seen = new Set<string>();
  const push = (kind: ClipCandidate['kind'], ref: string | undefined): void => {
    if (!ref || seen.has(ref)) return;
    seen.add(ref);
    out.push({ kind, ref });
  };
  for (const c of personal) push('personal', c.clipKey);
  for (const c of generic) push('generic', c.clipKey);
  // 声明式 fallback：只收「目录里真有、且现在可选」的那些（悬空 fallback 是数据 bug，validate 会点名）。
  for (const c of [...personal, ...generic]) {
    const f = c.fallbackClipKey && catalog.clips.find((x) => x.clipKey === c.fallbackClipKey);
    if (f && isPlayable(f, ctx)) push('declared-fallback', f.clipKey);
  }
  push('base', catalog.baseClipKey);
  push('still', catalog.stillRef);
  return out;
}

/** 静态图永远算就绪（本地资产·不依赖网络）——链尾必达的那一条豁免。 */
const isReady = (cand: ClipCandidate, ctx: ClipSelectCtx): boolean =>
  cand.kind === 'still' || ctx.ready === undefined || ctx.ready.has(cand.ref);

/**
 * 选片：走回退链，取**第一个就绪**的。全链都不就绪 → `null`（调用方该显示什么由它定，
 * 端口不替它编一个出来）。目录声明了 `stillRef` 时**不可能**返回 null——由上面的豁免保证。
 */
export function selectClip(
  catalog: VideoClipCatalog, state: string, ctx: ClipSelectCtx = {},
): ClipCandidate | null {
  return resolveChain(catalog, state, ctx).find((c) => isReady(c, ctx)) ?? null;
}

/**
 * 换片会不会黑帧（单子第 3 条）：上一片的尾姿势 == 下一片的首姿势 → 可以直切。
 * 对不上**不是错误**，是「这里需要一次过渡」——调用方据此决定淡入还是硬切。
 */
export function canCutClean(from: VideoClip | null, to: VideoClip | null): boolean {
  if (!from || !to) return true;               // 没有上一片 = 开场，谈不上接不上
  return poseOut(from) === poseIn(to);
}

/**
 * 预载名单（单子第 3 条）：给出「接下来可能进哪些状态」，算出该提前拉哪些片。
 * 只出**还没就绪**的（已就绪的不必再拉）；按 clipKey 升序；`limit` 封顶防一次拉爆。
 * 每个状态只取它链上的**头一个**候选——预载是押注，押第一顺位就够，押全链是浪费带宽。
 */
export function preloadCandidates(
  catalog: VideoClipCatalog, nextStates: readonly string[], ctx: ClipSelectCtx = {}, limit = 3,
): string[] {
  const want = new Set<string>();
  for (const s of nextStates) {
    const head = resolveChain(catalog, s, ctx).find((c) => c.kind !== 'still');
    if (head && !(ctx.ready?.has(head.ref) ?? false)) want.add(head.ref);
  }
  return [...want].sort(cmpStr).slice(0, Math.max(0, Math.trunc(limit)));
}

/** 目录体检（落盘门/开发期用·纯 fs 外）。返回人话错误串数组，空 = 合法。 */
export function validateCatalog(catalog: VideoClipCatalog): string[] {
  const errs: string[] = [];
  if (!catalog.id?.trim()) errs.push('目录缺 id');
  const seen = new Set<string>();
  for (const c of catalog.clips) {
    const at = c.clipKey || '(空 clipKey)';
    if (!c.clipKey?.trim()) errs.push('有片段缺 clipKey');
    else if (seen.has(c.clipKey)) errs.push(`clipKey 重复：${c.clipKey}（目录内须唯一）`);
    else seen.add(c.clipKey);
    if (!c.state?.trim()) errs.push(`${at} 缺 state（要靠它对 State{fsmId}.current）`);
    if (!Number.isInteger(c.ticks) || c.ticks < 0) errs.push(`${at} ticks=${c.ticks} 非法（须非负整数·sim 拿它推进 after）`);
    if (c.review !== undefined && !['pending', 'approved', 'rejected'].includes(c.review)) {
      errs.push(`${at} review=${JSON.stringify(c.review)} 不在闭集 pending/approved/rejected`);
    }
  }
  for (const c of catalog.clips) {
    if (c.fallbackClipKey && !seen.has(c.fallbackClipKey)) {
      errs.push(`${c.clipKey} 的 fallbackClipKey=${c.fallbackClipKey} 在目录里不存在（悬空回退 = 那一环静默消失）`);
    }
  }
  if (!catalog.stillRef) errs.push('目录缺 stillRef（链尾静态图）——断网时回退链走到头会没东西可显示');
  return errs;
}
