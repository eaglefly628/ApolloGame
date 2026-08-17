// dokiworld/game108 · 投影⑤：`apps.list()` → 终局屏「换个游戏玩」推荐位（REQ-DOKI-APPS·
// owner 2026-08-16 判「game108 当第一个消费者」）。**纯函数·零副作用·零玩法**（同 to-game-result 形态）。
//
// ══ 为什么要过滤，而不是把列表原样画上去 ══
//   SDK 实读（`@dokiworld/app-sdk/src/apps.d.ts`）：
//     `AppLaunchRequest = { appId, input: ExternalAppContract & { data } }`
//     `ExternalAppContract = { contract: string; version: number }`   ← **input 必填**
//   而 `AvailableApp` 只保证 `{id,name,description?,coverUrl?,protocolVersion,runtime?}`——
//   contract 只能来自被列 App **自己的** `runtime.input`。猜一个填进去 = 拉过去必被对方拒，
//   而且是**拒在玩家点了之后**（玩家眼里就是「这个键坏的」）。
//   故：带得出 contract 的才进推荐位；带不出的**不画那一格**，并计数留痕
//   （「什么都没发生」的分支必须记·日志基准守则）。宁可少一格，不给一颗点了报错的键。

/** 从一条 AvailableApp 里取出可拉起所需的 contract/version；取不出 = null（不可拉起）。 */
export function launchTargetOf(item) {
  const rt = item && typeof item === 'object' ? item.runtime : undefined;
  const input = rt && typeof rt === 'object' ? rt.input : undefined;
  if (!input || typeof input !== 'object') return null;
  const { contract, version } = input;
  if (typeof contract !== 'string' || !contract) return null;
  // version 缺省/非数字 → 1（协议里 version 是整数且 1 是首版；contract 才是身份，version 只是修订）
  return { contract, version: Number.isInteger(version) ? version : 1 };
}

/**
 * 列表 → { picks（给游戏侧屏的最小形状）, launchable（appId → contract/version）, skipped（不可拉起的条数）}。
 *
 * @param {Array<object>} list      `apps.list()` 的返回（恒为数组·失败已在网关那层降级成 []）
 * @param {{selfId?: string}} opts  selfId = 自己的 appId（**剔除自己**：在自己的结算屏推荐自己没有意义）
 */
export function toAppPicks(list, { selfId } = {}) {
  const picks = [];
  const launchable = new Map();
  let skipped = 0;
  for (const item of Array.isArray(list) ? list : []) {
    if (!item || typeof item !== 'object') { skipped++; continue; }
    const { id } = item;
    if (typeof id !== 'string' || !id || id === selfId) continue;   // 自己/无名条目：静默跳过（不算「拉不起来」）
    if (launchable.has(id)) continue;                               // 重名去重（先到先得·后到的不覆盖）
    const target = launchTargetOf(item);
    if (!target) { skipped++; continue; }
    launchable.set(id, target);
    picks.push({
      id,
      name: typeof item.name === 'string' && item.name ? item.name : id,   // 无名 → 拿 id 顶（不画空标签）
      ...(typeof item.coverUrl === 'string' && item.coverUrl ? { cover: item.coverUrl } : {}),
    });
  }
  return { picks, launchable, skipped };
}
