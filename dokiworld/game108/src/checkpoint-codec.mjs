// dokiworld/game108 · checkpoint 传输编码（**纯投影零规则**·不解释快照内容）。
//
// 为什么要编码：SDK storage capability 的 payload 三条硬上限（capability.js 原文）=
// 64KB / 2000 节点 / 深 12，而 game108 世界快照实测 ~125KB / ~10500 节点 / 深 31
// （规则即数据——判定表、AI 表全在组件里，所以快照天生大而深）。裸传必被
// `invalid-request` 拒收。故把整包 JSON 压成**一个字符串**（1 节点·深 1）：
//   JSON({snapshot, order}) → deflate-raw → base64 → { world: '<b64>' }
// 实测中盘快照 base64 后 ~7KB，余量近十倍。压缩是**传输编码**不是玩法——
// 快照进快照出逐字节还原，世界内容一个字段都不挑（挑字段=把规则写进宿主层）。
//
// 依赖全是 Web 标准（CompressionStream/DecompressionStream/btoa/atob）：
// 浏览器与 Node 18+ 都原生有，App 包零新依赖。
//
// 降级纪律（同卡桥「绝不炸」）：unpack 对任何坏输入（非串/坏 base64/坏压缩流/坏 JSON/
// 形状不对）一律返回 null——调用方拿 null 走全新开局，绝不因坏存档白屏。

/** checkpoint 业务 contract（manifest 之外的第五维——App 自己的存档格式版本）。 */
export const CHECKPOINT_CONTRACT = 'doki.game.game108-checkpoint';
export const CHECKPOINT_VERSION = 1;

/** SDK capability payload 的字节上限（capability.js MAX_PAYLOAD_BYTES 同值·pack 后自检用）。 */
export const CAPABILITY_PAYLOAD_LIMIT = 64 * 1024;

const bytesToBase64 = (buf) => {
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
};
const base64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** {snapshot, order} → base64(deflate-raw(JSON))。超过 capability 上限时抛（上限是对方的硬门，静默截断=坏档）。 */
export async function packWorld(snapshot, order) {
  const json = JSON.stringify({ snapshot, order });
  const stream = new Blob([new TextEncoder().encode(json)]).stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  const packed = bytesToBase64(new Uint8Array(await new Response(stream).arrayBuffer()));
  if (packed.length > CAPABILITY_PAYLOAD_LIMIT) {
    throw new Error(`checkpoint 压缩后仍超 capability 上限（${packed.length} > ${CAPABILITY_PAYLOAD_LIMIT}）`);
  }
  return packed;
}

/** base64 → {snapshot, order}；任何坏输入返回 null（调用方走全新开局）。 */
export async function unpackWorld(packed) {
  if (typeof packed !== 'string' || packed.length === 0) return null;
  try {
    const stream = new Blob([base64ToBytes(packed)]).stream()
      .pipeThrough(new DecompressionStream('deflate-raw'));
    const parsed = JSON.parse(await new Response(stream).text());
    const { snapshot, order } = parsed ?? {};
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
    if (!Array.isArray(order) || !order.every((id) => typeof id === 'string')) return null;
    return { snapshot, order };
  } catch {
    return null;
  }
}

/** 世界包 → SDK storage 的 AppCheckpoint 信封（contract/version 是本 App 存档格式的唯一真相）。 */
export function toCheckpoint(packed) {
  return { contract: CHECKPOINT_CONTRACT, version: CHECKPOINT_VERSION, data: { world: packed } };
}

/** AppCheckpoint → 世界包字符串；contract/version 不符或形状不对 → null（不认别家/别版的档）。 */
export function fromCheckpoint(checkpoint) {
  if (!checkpoint || typeof checkpoint !== 'object') return null;
  if (checkpoint.contract !== CHECKPOINT_CONTRACT || checkpoint.version !== CHECKPOINT_VERSION) return null;
  const world = checkpoint.data?.world;
  return typeof world === 'string' && world.length > 0 ? world : null;
}
