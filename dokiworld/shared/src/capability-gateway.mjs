// dokiworld/shared · **capability 通用闸** —— 九个模块共用的那套「声明门 + 降级 + dispose」。
//
// ══ 为什么要有它 ══
//   `apps-gateway` 先写了一份，接着 speech / persona / dialogue / media 要用**一模一样**的三条纪律：
//   ① 没在 manifest 声明就一个字节都别发 ② 降级不抛 ③ dispose 幂等且之后一律降级。
//   照抄五遍 = 五份会各自漂移的真相。故把「闸」抽出来，各模块只声明**自己降级时返回什么**。
//
// ══ 三条纪律（来自 SDK 源码实读·见 apps-gateway.mjs 文件头的完整论证）══
//   ① 未声明 ⇒ **不建 SDK 扩展**（不挂 onMessage、不发消息）。规范 §7 说未声明的消息会被拒，
//      而 `createCapabilityClient` 的"被拒"形态是**静默等到超时**——「忘了声明」的表症是
//      卡满超时再失败，最难查的那一类。拦在发之前。
//   ② **降级不抛**。这些能力对游戏一律是**可选增强**：宿主老、没授权、用户取消都属正常世界。
//      一个可选能力把对局打崩是缺陷。故每个方法都给一个 `fallback`，失败即走它。
//   ③ dispose 幂等；dispose 之后所有方法继续降级（不是抛，也不是继续发消息）。
//
// ⚠ **本闸不解释任何模块的语义**：它只管"叫得通就把结果给你、叫不通就给你兜底值"。
//    每个模块自己的形状（参数怎么拼、结果怎么读）留在各自的薄封装里。

/** 失败原因归一化：SDK 的 `AppCapabilityError.code`（timeout / disposed / unsupported-operation …）。 */
export const reasonOf = (error) => {
  const code = error && typeof error === 'object' ? error.code : undefined;
  return typeof code === 'string' && code.length > 0 ? code : 'operation-failed';
};

/** manifest 里声明了某个扩展没有（`runtime.extensions` 是唯一真相·读不到按未声明算）。 */
export const declares = (manifest, name) => {
  const ext = manifest?.runtime?.extensions;
  return Array.isArray(ext) && ext.includes(name);
};

/**
 * 建一台带闸的 capability。
 *
 * @param {{
 *   name: string,                       // 扩展名（= manifest 里那个词·只用于 warn 归因）
 *   declared: boolean,                  // manifest 声明了没有（**缺省视为 false**：没明说就当没声明）
 *   client: {send: Function, onMessage: Function} | undefined,
 *   create: (client: object) => object, // 造 SDK 扩展的那一句（如 createSpeechClientExtension）
 *   fallbacks: Record<string, (...args: unknown[]) => unknown>,  // 方法名 → 降级值（**同时也是方法名单**）
 *   onWarn?: (info: {capability: string, op: string, reason: string}) => void,
 * }} spec
 * @returns {{available: boolean, lastReason: () => string｜null, dispose: () => void} & Record<string, Function>}
 */
export function createGuardedCapability({ name, declared = false, client, create, fallbacks, onWarn }) {
  if (typeof name !== 'string' || !name) throw new Error('capability name 必填');
  if (!fallbacks || typeof fallbacks !== 'object') throw new Error(`${name}: fallbacks 必填（它同时是方法名单）`);

  let lastReason = null;
  const warn = (op, reason) => {
    lastReason = reason;
    try { onWarn?.({ capability: name, op, reason }); } catch { /* 观察口自己炸不许影响主路 */ }
  };

  const usable = declared && client && typeof client.send === 'function' && typeof client.onMessage === 'function';
  if (!usable) {
    // 恒降级的空壳，**与真通道同形**：调用方不需要写 `if (gw)`，少一条分支就少一处忘写的降级。
    const reason = declared ? 'no-channel' : 'not-declared';
    const shell = { available: false, lastReason: () => lastReason, dispose: () => {} };
    for (const [op, fb] of Object.entries(fallbacks)) {
      shell[op] = async (...args) => { warn(op, reason); return fb(...args); };
    }
    return Object.freeze(shell);
  }

  const ext = create(client);
  let disposed = false;
  const gw = {
    available: true,
    lastReason: () => lastReason,
    dispose() {
      if (disposed) return;
      disposed = true;
      ext.dispose?.();
    },
  };
  for (const [op, fb] of Object.entries(fallbacks)) {
    gw[op] = async (...args) => {
      if (disposed) { warn(op, 'disposed'); return fb(...args); }
      if (typeof ext[op] !== 'function') { warn(op, 'no-such-operation'); return fb(...args); }
      try {
        const out = await ext[op](...args);
        lastReason = null;                      // 成功一次就把上一次的失败原因抹掉（面板读它）
        return out;
      } catch (error) {
        warn(op, reasonOf(error));
        return fb(...args);
      }
    };
  }
  return Object.freeze(gw);
}
