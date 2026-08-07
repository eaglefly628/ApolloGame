# Review 单 · `REQ-108-ENG-04` KeyBinding 代发（`source`）

> **给复查人（楚晨）**：格式照 `REQ-108-ENG-03.md` 附录。
> 红线不变：**复查人 ≠ 施工人**；本单是**导航不是证据**——每条都要你自己复跑，别采信我的自陈。

| | |
|---|---|
| 工单 | `REQ-108-ENG-04`（owner 2026-08-07 判 **A**：给 `KeyBinding` 加可选 `source`，不选 A′ 也不选 B） |
| 施工 | 策划 session（本单作者）·按 owner 2026-08-06「引擎缺口自做自验 + Review 单」全库规矩认领 |
| 占锁 | **动手前先改工单「施工主体」并推了一次**（`5202c59d`）——这正是你在 ENG-03 单里建议、用来防双头同单的那道锁，我先自觉执行了。**规矩本身仍待 owner 拍。** |
| 复查 | **楚晨** |
| 改动面 | `src/engine/protocol/components/input.ts`、`src/skills/tier2/keybind.ts` + 其测试；游戏侧 `games/game108/{blueprint,game108,game108.test}.ts` |

## 一、做了什么（三句话）

1. `KeyBinding` 加一个**可选** `source?: string`：命中时产出的 `Signal.source` 填它，而不是挂本组件的实体。
2. 空串 = 数据错，**点名硬抛**（不静默退回本实体）。不填 = **零回归**。
3. 游戏侧据此把 game108 的出招三键代发到 `p1`，玩家动作第一次真正打通到世界。

## 二、这个缺口是怎么被找出来的（**你可能想先核这一段**）

不是"我觉得接不上"，是撞上了才查。协议第①步的实查留痕在 `docs/design/game108/requests.md REQ-108-ENG-04`，要点：

- `matrix-duel.ts:848-849` 接缝 `const side = s.source; if (!side || !world.hasComponent(side,'Resource')) continue;` —— **只认挂 hp 的对局侧**。
- `keybind.ts:83`（改前）`source: id` —— source 恒等于**挂 KeyBinding 的实体**。
- 房屋范式（`game-f:287-294`、`game101:109`、`game-103:294/422`）是**一动作一个 `kb-*` 实体** ⇒ source 永远不是对局侧。
- **实测**：往同一实体连挂两份 `KeyBinding` → `getComponent` 只剩后一份、`query('KeyBinding').length === 1`。一实体一组件，挤不下 3 个。

⇒ 玩家点了没反应，**而且不报错**——静默失效面。为什么别的游戏没撞：它们的下游（`effect-apply`/`craft-recipe`/`event-when`）按**信号名 + 全局 targetId** 消费，压根不看 source。game108 是全库第一个按 source 路由的消费方。

## 三、复查请逐条核（每条附「怎么自己验」）

| # | 核什么 | 怎么自己验 | 我的自陈 |
|---|---|---|---|
| 1 | **边界没被扩** | `git show --name-only <提交>` | 引擎侧只 2 文件 + 测试；未碰 clickable/event-when/drag-place/timeline，未碰定序、未新增 system、未改 `reads/writes` |
| 2 | **零回归是真的** | 把 `source` 相关测试全删了跑全量；或直接看 `source: kb.source ?? id` | 不填 = 逐字节旧行为；全量门禁绿 |
| 3 | **测试真的在验东西** | 撤 `kb.source ?? id` → 改回 `source: id`（**带锚点断言**，改不到要报错） | 实测 **5 红**（keybind 3 + game108 端到端 2），复原 36 绿 |
| 4 | **落盘门真的在验东西** | 把 `if (kb.source !== undefined && kb.source === '')` 改 `if (false && …)` | 实测 **1 红**，复原绿 |
| 5 | 代发**不改信号生命周期** | keybind 测试「信号组件仍挂在 KeyBinding 实体上」+ 看清扫逻辑① | Signal 仍挂 kb 实体（清扫按 KeyBinding 实体走）；只有 `source` 字段变了 |
| 6 | **端到端真打通**（不是只改了个字段） | `games/game108/game108.test.ts` 末四条：走 `InputQueue`（玩家那条路）而非手挂组件 | 点出招键 → `Signal.source==='p1'` → 接缝挂 `DuelIntent` 到 p1 → 对面真掉 30 血 |
| 7 | 确定性没被动 | 定序/遍历序未改（仍按实体 id 升序） | `source` 只影响信号内容，不影响遍历与相位 |

## 四、三处**我想请你重点看**的判断（最可能出错的地方）

1. **硬抛放在 system 里、每拍都判，而不是装载期落盘门。**
   理由：`keybind` 没有装载校验钩子（不像 `matrix-duel` 有 `validateDuelMatrix`），而 `resolveDuelMatrix` 的先例就是**在 system 里抛**。代价是每拍一次字符串比较。
   **请核**：这个位置你认不认？要不要挪去装载期（那要给 keybind 新开校验面 = 超出工单边界，我没做）。

2. **只抛空串，不抛「指向不存在的实体」。**
   理由：实体会动态生灭，代发目标这一拍不在场**未必**是数据错（可能刚被销毁/还没 spawn）；而空串是纯粹的填错。
   **请核**：这个界划得对吗？如果你认为「目标实体不存在」也该抛，代价是动态生灭的游戏会被误伤——我倾向不抛，但听你的。

3. **游戏侧我给出招键代发、蓄力键不代发。**
   理由：蓄力走 `effect-apply` 全局 `targetId`（按信号名分侧），与 source 无关；给它填 source 是无意义的噪音。
   **请核**：这个不对称你认不认？还是觉得为一致性该全填？

## 五、已知未做 / 留给下游

- **没动 `clickable` / `event-when`**：它们同样是 `source: eid`，同样接不进按 source 路由的消费方。但本工单只解玩家键位这一路，没有实证需求就不加宽（YAGNI）。**若你认为该一并加，我按你判词做。**
- **`Signal.source` 的语义没有被正式收敛成契约**：现在全库有三种做法（挂载实体 / 代发 / 输入事件自己的 source 字段），本件只是让第二种可数据填。真要收敛得开一张更大的单。
- 游戏侧 `smoke.use`/`shard.pick`/`duel.next` 三个动作还没接线（S4 的事）。

## 六、一件我做错了、值得记下来的（自陈）

端到端测试的**首版夹具是错的**：我手写 `InputQueue` 组件后连着 tick 两拍，而真 `QueuedInputSource` 每拍会排空队列 ⇒ 一次点击被算成两次，「蓄 2」测出来是 3。
**是测试先红了我才发现的**，不是读代码读出来的——又一次印证「跑出来的才算数」。修法是把排空纪律收进 `tap()` 并在注释里写清为什么。
**请你复跑时留意这条**：如果哪天有人把 `tap` 里的排空删掉，测试会变成"看起来更宽松地绿"，那是假绿。
