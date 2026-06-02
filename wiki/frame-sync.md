# 帧同步（Lockstep / Frame Synchronization）

Apollo 的联机走**帧同步**（各端各跑模拟、只交换输入），而非状态同步（服务器算、广播状态）。
帧同步能成立的**唯一前提是确定性**：相同的初始状态 + 相同的输入序列 ⇒ 逐位相同的状态。

> 因此这是一条引擎级保证：**任何**搭在确定性原子/系统上的游戏，天生就支持帧同步——
> 只要它遵守下面的"确定性铁律"。

## 分层（为什么底层不受联机影响）

依赖是**单向**的：`net → engine`，反过来没有。

- `engine` / `atom-skills` / `tier1` 里**零处** import `net`——底层系统是纯函数，不知道"联机"存在。
- `net` 只通过 World 的**公共 API** 读写（`applyCommands` 只写 `Velocity`），不改任何系统。

→ 网络层怎么改、怎么换（本地键盘 / BroadcastChannel / WebSocket），都**不可能**弄坏底层玩法。

## 确定性铁律（每个系统作者必须遵守）

1. **不用 `Math.random`** → 用 `random` 原子提供的种子化 RNG。
2. **不用 `Date.now` / `performance.now` 进模拟** → 用 `tick` 计数表达时间。
3. **遍历用确定顺序** → World 的 `Map` 是插入序，已天然保证；不要依赖对象 key 的非确定遍历。
4. **不引入外部不确定性** → 不在系统里读 DOM、网络、文件等。
5. **同一 tick 的输入在所有端按相同顺序应用** → `applyCommands` 内部已按 `playerId` 稳定排序。

## 如何验证 / 守卫

- `hashSnapshot(world.snapshot())`：状态的确定性指纹（顺序无关、字段敏感）。
- `src/net/net.test.ts`：两个独立世界喂同一命令脚本 → **每 tick 同 hash**；丢包 → 守卫报 desync。
- `src/net/lockstep-tab.test.ts`：两个 `LockstepClient` 经 mock channel 交换输入 → **逐 tick hash 全等**。
- 任何新系统若破坏确定性，上述测试会立刻变红。

## 跑起来看

- `npm run net:demo` —— 无头：固定步长 + 双端 lockstep + 丢包 desync 检测。
- `npm run dev` → 打开 `/mp.html`，**在同一浏览器再开一个本页标签页** —— 两端各控一个方块，
  HUD 的 `hash` 两端逐 tick 相等即"帧同步"。
