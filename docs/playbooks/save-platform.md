# 存档与平台手册

> 存档 = 纯数据 + 迁移；平台服务（成就/云存档/排行/富状态）走 `PlatformPort` 适配器（sim 只持纯数据，端口把它变成真实调用）。
> **发布**（打包/Steam 上架/平台接线）用 `game-publisher` agent。
> 机读真相：`src/services/storage/index.ts`（`StoragePort`/`SaveSystem`/`SaveGame`）、`src/services/save/index.ts`（`SavePort`/信封）、`src/services/platform/index.ts`（`PlatformPort`）。

## ① 做 X → 用什么

| 任务 | 能力实名 | 怎么接（一句） |
|---|---|---|
| 引擎快照存档（WorldSnapshot） | `StoragePort` + `SaveSystem` | `createStoragePort()` 选实现；`SaveSystem` 读写 `SaveGame`（web=Local、原生壳=SteamCloud） |
| 游戏自有数据 blob 存档（带 schema/迁移/校验） | `SavePort` + 信封 | `sealEnvelope(data,codec,savedAt)`→`port.write(slot,env)`；读 `port.read`→`openEnvelope(env,codec)`（自动校验+迁移） |
| 存档后端（内存/web/文件/云） | `MemorySavePort`/`LocalStorageSavePort`/`FileSavePort`/`CloudSavePort` | 同 `SavePort` 契约；File 经文件桥（真桥 electron preload·测试 `createMemoryFileBridge`），Cloud 经 `SteamCloudBridge` |
| 存档结构演进（数据 blob） | `SaveCodec.migrations` 链 | codec 声明 `schema` + `migrations[v]`（v→v+1 纯函数）；旧档 `openEnvelope` 自动链式升级，缺步/坏档报 `CorruptSaveError` |
| 引擎快照结构演进 | 版本键 + 迁移函数 | 快照存档带版本键（如 `gameG-save-v1`），旧版进来跑一次性迁移（纯函数） |
| 解锁成就/统计/排行 | `PlatformPort` | `unlockAchievement`/`setStat`/`uploadLeaderboard`（幂等·fire-and-forget） |
| 富状态（好友列表显示） | `PlatformPort.setRichPresence` | sim 产纯数据 → 端口投递 |
| 无原生壳降级 | `NullPlatformPort` | `isAvailable()=false`，游戏据此静默降级不报错 |
| 成就数据同步 | `AchievementSync`/`ACHIEVEMENTS` | 从 sim Flag/Resource 派生成就解锁 |
| 打包 / Steam 上架 | `game-publisher` agent | web/cartridge/electron + steam-publisher（AppID/Depot→VDF→上传→Set Live） |

## ② 样例指针

- **正样例·平台接线**：`src/games/game-g/platform-hooks.ts`（`ggOnBattleWon`/`ggCloudSave`/`ggCloudLoad`）+ 测试 `platform-hooks.test.ts`（mock 端口断言调用）。
- **正样例·存档层**：`src/games/game-g/game-g-save.ts`（纯数据 Save 类型 + 迁移，除 localStorage 外纯函数·可无头测）。
- **创作台库版本化**：`src/studio/library-model.ts`（`LibraryMeta`/`GameEntry`·library/<slug>/meta.json）——用户游戏库前端数据模型（纯函数可单测）。
- 无真账号测试：`resetMockSteam`/`createMockSteamBridge`（`src/services/platform/index.ts`）。

## ③ 本线红线

- sim **只持纯数据**（Flag/Resource/State），成就/统计由端口从数据派生，不在 sim 里直连平台 SDK。
- 存档演进**必带版本键 + 迁移**，不破坏老玩家档；`SavePort` 走 `schema`+`migrations` 链，`checksum` 不符**报错不静默**（`CorruptSaveError`）。
- `savedAt` 时间戳**由宿主注入**（app 层 Date.now），**绝不由 sim 取墙钟**（确定性红线）。
- 平台不可用一律**静默降级**（游戏代码无环境分支）。

## ④ 正样例 / 反面教材

- ✅ game-g platform-hooks + game-g-save：数据 → 端口 → 平台，可 mock 测。
- ✖ 游戏层直连 Steamworks SDK / 存档无版本号导致升级即丢档。

## ⑤ 查不到怎么办

平台契约缺能力（新平台适配器 / 新存档需求） → `docs/workflow/requests.md` 提缺口；发布链问题交 `game-publisher` agent。**不在游戏层绕端口直连平台。**
