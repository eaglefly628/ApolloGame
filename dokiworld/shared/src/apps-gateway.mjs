// dokiworld/shared · 「获取卡带」薄适配（`apps` 扩展模块）—— **跨 app 共享，不属任何一个 app**。
//
// ══ 这一层为什么存在 ══
//   owner 2026-08-15：「接入 dokiworld SDK，能够有一些**获取卡带**的能力和方法，全部都集成进去」。
//   SDK 里对应的就是 `./apps`：`list()` 列出宿主当前能拉起的 App、`launch()` 拉起一个并等它交回结果。
//   **但它不该被抄进每个 app**：`dokiworld/` 下第二个 app 一出包，这套超时/降级/dispose 就要复制一遍
//   ——复制出来的第二份永远是"改了一处忘了另一处"的那处。故落在共享层，各 app 引用。
//
// ══ 三条纪律（全部来自 SDK 源码实读，非文档手抄）══
//
//   ① **没在 manifest 里声明 `apps` 就一个字节都别发**。规范 §7：「未声明的扩展消息会被拒绝」，
//      而 `createCapabilityClient` 的拒绝形态是**静默等到超时**（capability.js：宿主不回，
//      客户端只有 `setTimeout` 那一条出路）。于是"忘了声明"的表症是**卡 30 秒然后失败**，
//      而不是"立刻报错"——最难查的那一类。这里把它拦在发之前：`declared:false` ⇒ 直接降级。
//
//   ② **降级不抛**。「获取卡带」对任何一个 app 都是**可选增强**：宿主老、没授权、用户取消，
//      都属正常世界。一个可选能力把对局打崩是缺陷。故 `list` 恒返回数组、`launch` 恒返回三态之一，
//      **本模块对外不抛异常**（唯一例外是构造参数非法——那是接线错，越早炸越好）。
//
//   ③ **`launch` 的超时是一小时不是三十秒**（`DEFAULT_APP_LAUNCH_TIMEOUT_MS = 60*60*1000`）：
//      拉起一个 App 意味着玩家**跑去玩那个 App 了**，拿 30 秒的默认超时套它 = 玩家还在玩、
//      我方已判失败。SDK 自己就是这么分的（`createAppsClientExtension` 给 launch 单独传 timeoutMs），
//      封装时**不许把这条差别磨平**。
//
// ══ 不做什么 ══
//   · 不替 app 声明 extension（封装 ≠ 声明·谁消费谁按真用到的写进自己的 manifest）。
//   · 不解释 `output.data` 的语义（那是各 app 与对方 app 的契约，不是通道的事）。
import { createAppsClientExtension, DEFAULT_APP_LAUNCH_TIMEOUT_MS } from '@dokiworld/app-sdk/apps';

export { DEFAULT_APP_LAUNCH_TIMEOUT_MS };

/** manifest 里声明了 `apps` 没有（`runtime.extensions` 是唯一真相·读不到按未声明算）。 */
export function appsDeclared(manifest) {
  const ext = manifest?.runtime?.extensions;
  return Array.isArray(ext) && ext.includes('apps');
}

/** 失败原因归一化：SDK 的 `AppCapabilityError.code`（timeout / disposed / unsupported-operation …）。 */
const reasonOf = (error) => {
  const code = error && typeof error === 'object' ? error.code : undefined;
  return typeof code === 'string' && code.length > 0 ? code : 'operation-failed';
};

/**
 * 建一条「获取卡带」通道。
 *
 * @param {{send: Function, onMessage: Function}} client   `createAppClient()` 那台（或任何同形通道）
 * @param {{declared?: boolean, timeoutMs?: number, launchTimeoutMs?: number, onWarn?: (info:{op:string,reason:string})=>void}} [options]
 *        declared = manifest 里声明了 apps 没有（**缺省 false**：没明说就当没声明，见纪律①）
 *        onWarn   = 降级时的观察口（宿主自己决定要不要打日志·本层不 console，静默降级要看得见）
 * @returns {{list: Function, launch: Function, available: boolean, dispose: Function}}
 */
export function createAppsGateway(client, options = {}) {
  const { declared = false, timeoutMs, launchTimeoutMs, onWarn } = options;
  const warn = (op, reason) => { try { onWarn?.({ op, reason }); } catch { /* 观察口自己炸不许影响主路 */ } };

  // 未声明 / 无通道 ⇒ **不建 SDK 扩展**（不挂 onMessage、不发任何消息），直接给一台恒降级的空壳。
  // 空壳与真通道**同形**：调用方不需要写 `if (gateway)`，少一条分支就少一处忘写的降级。
  if (!declared || !client || typeof client.send !== 'function' || typeof client.onMessage !== 'function') {
    const reason = declared ? 'no-channel' : 'not-declared';
    return Object.freeze({
      available: false,
      list: async () => { warn('list', reason); return []; },
      launch: async () => { warn('launch', reason); return { status: 'unavailable', reason }; },
      dispose: () => {},
    });
  }

  const ext = createAppsClientExtension(client, {
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    ...(launchTimeoutMs !== undefined ? { launchTimeoutMs } : {}),
  });
  let disposed = false;

  return Object.freeze({
    available: true,

    /**
     * 列出宿主现在能拉起的 App（可按 capability 过滤）。
     * **恒返回数组**——失败、超时、已 dispose 一律空数组 + warn（纪律②）。
     */
    async list(filter = {}) {
      if (disposed) { warn('list', 'disposed'); return []; }
      try {
        const { apps } = await ext.list(filter);
        return Array.isArray(apps) ? apps : [];
      } catch (error) {
        warn('list', reasonOf(error));
        return [];
      }
    },

    /**
     * 拉起一个 App 并等它交回结果。
     * @param {{appId: string, contract: string, version?: number, data?: unknown}} req
     * @returns {Promise<{status:'completed', output: object} | {status:'cancelled'} | {status:'unavailable', reason: string}>}
     *
     * 三态里 **`cancelled` 是正常结局**（玩家中途退出那个 App），与 `unavailable`（通道没成事）
     * 分开报——合成一态的话，「玩家不想玩」和「宿主坏了」在调用方眼里长得一样。
     */
    async launch({ appId, contract, version = 1, data = {} } = {}) {
      if (disposed) { warn('launch', 'disposed'); return { status: 'unavailable', reason: 'disposed' }; }
      if (typeof appId !== 'string' || !appId || typeof contract !== 'string' || !contract) {
        warn('launch', 'invalid-request');
        return { status: 'unavailable', reason: 'invalid-request' };
      }
      try {
        const result = await ext.launch({ appId, input: { contract, version, data } });
        return result.status === 'completed'
          ? { status: 'completed', output: result.output }
          : { status: 'cancelled' };
      } catch (error) {
        const reason = reasonOf(error);
        warn('launch', reason);
        return { status: 'unavailable', reason };
      }
    },

    /** 幂等：重复调用不重复退订（`createCapabilityClient.dispose` 自己也幂等，这里再兜一层）。 */
    dispose() {
      if (disposed) return;
      disposed = true;
      ext.dispose();
    },
  });
}
