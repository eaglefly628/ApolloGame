# ZeroCraft Engine —— 一键发布 Steam 架构设计

> 作者：Lead · 日期：2026-06-08 · 状态：设计蓝图（未施工，可独立立项、可并行）
> 关联：`docs/design/modular-game-framework.md`（EnginePort / 函数式内核+命令式外壳）、
> `docs/design/data-driven-manifesto.md`、`requests.md` REQ-010（跨架构 lockstep 定点数）。

## 0. 一句话 + 结论

**当前 TS/Web 栈 100% 能上 Steam，无需重写引擎、不用换语言。** Steam 只发可执行壳、不看语言；
Web 游戏套个桌面壳即是 Steam 游戏。更关键：**我们的架构（端口隔离 + 确定性快照/录放 + 游戏=数据）
出奇地适配"一键发布任意生成游戏"** —— 因为每个游戏都是"同一引擎 + 不同数据"，打包管线对所有游戏**完全一致**。

## 1. 战略定位：为什么这条线与「AI 一句话成游戏」是天作之合

产品愿景的终态是「一句话 → AI 产数据 → 引擎跑 → **一键上架 Steam**」。前三段已具备（parseManifest + 确定性引擎 + studio 热载）。
本设计补最后一段。关键洞察：**因为"游戏=数据"，不同游戏的发布逻辑零差异** —— 把"游戏数据 + 引擎 + 壳模板"
喂进同一条 `build → 壳 → Steamworks → 上传` 流水线即可。**不必为每个游戏写发布代码**，这正是数据驱动的复利在分发侧的兑现。

## 2. 技术选型

| 方案 | 壳形态 | 二进制 | Steamworks 绑定 | 裁决 |
|---|---|---|---|---|
| **Tauri**（推荐） | 系统原生 webview（WebView2/WebKit）+ Rust 壳 | **~3–10MB** | `steamworks.js` / Rust `steamworks` crate | ✅ 轻、省内存、启动快；现代首选 |
| Electron | 自带 Chromium + Node | ~120–180MB | `steamworks.js` / `greenworks` | 备选：最成熟、生态最大，但重 |
| NW.js | 自带 Chromium | ~120MB | greenworks | 老牌，无明显优于上二者 |

**选 Tauri**：二进制小、性能/内存好、Steamworks 绑定成熟；Canvas2D 在原生 webview 跑我们的 2D 游戏绰绰有余。
（若将来遇到 Tauri 特定 webview 兼容坑，可退 Electron —— 因为**游戏本体是同一份 web bundle，换壳零成本**。）

## 3. 架构：Steam = 一个端口，sim 一行不改

铁律：**确定性模拟层（sim）绝不直接调用 Steamworks**（那是命令式、非确定、平台相关的副作用）。
Steam 能力全部经**端口（EnginePort 家族）**接入，与现有 AudioPort / AishePort / StoragePort 同纪律。

**Steam 功能 → 我们已有的什么（多数是"接后端"而非"造新东西"）**：

| Steam 功能 | 落地方式 | 现有基建 |
|---|---|---|
| **云存档（Steam Cloud）** | 新增 `SteamCloudStorage` 作为 **StoragePort 的一个后端** | ✅ `services/storage`（StoragePort + SaveSystem，存的是 snapshot POD/JSON）——**直接插上** |
| **成就 / 统计 / 排行榜** | 新增 `SteamPort.unlockAchievement/setStat/...`；游戏层用**信号/事件**驱动（数据），不在 sim 里调 | 涌现层产 Signal/Flag → 外壳订阅 → 调 Steam |
| **Overlay / 富存在（Rich Presence）** | `SteamPort.setRichPresence(...)`，纯表现层 | 表现外壳 |
| **回放 / 分享** | 已有 **lockstep 命令日志**（录一局 = 存初始 seed + 命令流）→ 导出文件 | ✅ `net/lockstep` + 确定性重放 |
| **P2P 联机对战** | 已有 **lockstep**；网络传输层换成 Steam Networking（SteamPort 提供 channel） | ✅ `net/lockstep-tab` 的 Channel 抽象，换底层 |
| **创意工坊（Mod）** | Mod = **游戏数据包**（manifest + 资产）；工坊上传/订阅经 SteamPort；引擎 parseManifest 直接加载 | ✅ 游戏=数据 + parseManifest + R12 校验 |
| **手柄 / 全屏 / 文件系统** | Tauri/Electron 原生 API，封成端口 | 输入层（InputSource）已抽象 |

> 重点：**云存档/回放/联机/Mod 这几样我们"天生就有"**（snapshot / command-log / lockstep / 数据化游戏），
> Steam 集成多是"给已有端口加一个 Steam 后端"，而非新造系统。这是确定性 + 数据驱动架构的直接红利。

## 4. 「一键发布」打包管线

```
 game 数据(manifest) ─┐
 引擎(TS) ───────────┼─▶ vite build ─▶ 静态 bundle ─▶ tauri build ─▶ .exe/.app/.AppImage
 壳模板(Tauri) ───────┘                                   │
                                          steamworks 配置(appid/depot) + steampipe 上传 ─▶ Steam
```
- 因游戏=数据，**所有游戏共用这一条管线**；发布某游戏 = 喂它的数据 + 跑脚本。
- 全程可 CI 自动化（`scripts/publish-steam.mjs`：build → tauri bundle → steamcmd 推 depot）。
- 与现有 `scripts/pack-atlas.mjs`（资产打包）同属"离线工具链"，不进引擎运行时。

## 5. 分期路线图（每期独立可交付、可停）

1. **MVP·套壳能跑**：原生壳加载现有 web bundle，桌面窗口里能玩 game-e/f/g。无 Steamworks。（≈最小，验证壳）
2. **存档 + 成就**：`SteamCloudStorage`(StoragePort 后端) + `SteamPort`(成就/统计)；信号驱动解锁。
3. **Overlay / 富存在 / 排行榜**：表现层接入。
4. **创意工坊**：Mod=数据包，上传/订阅 + parseManifest 加载（R12 校验防坏档）。
5. **跨平台 P2P 联机**：lockstep 换 Steam Networking；**前置 REQ-010**（浮点→定点数，根除跨架构 desync）。
   —— 单机发布（1–4 期）**完全不需要** REQ-010；只有跨架构实时对战才提上日程。

## 6. ★ 并行性与协作边界（回答"能不能并行、会不会影响开发"）

**结论：可以完全并行，不阻塞、不影响主线开发，撞车风险极低。**

原因：这条线是**引擎之外的「壳 + 端口后端 + 离线工具」层**，它**只消费引擎的稳定接口，不修改引擎核心**。

| 这条线**会碰**（新增，独占） | 这条线**绝不碰**（零撞车） |
|---|---|
| `src-tauri/`（或 `desktop/`）—— Tauri 壳，全新目录 | `src/engine/`（sim/协议核心） |
| `src/services/steam/`—— SteamPort + 后端，全新（仿 audio/aigp 范式） | `src/skills/`（capabilities / 战斗簇） |
| `src/services/storage/steam-cloud.ts`—— StoragePort 的新后端 | `src/games/*`（PA/PB/PC/PD 的游戏数据） |
| `scripts/publish-steam.mjs`—— 打包 CI，全新 | `src/renderer/` / `src/net/lockstep`（只读，不改） |
| vite/tauri 配置文件 | 任何 manifest / 组件契约 |

- **唯一协调点**：助理程序员若发现某端口缺方法（如 StoragePort 要补一个 Steam Cloud 需要的接口），向 Lead 提一个**小的、加性的**端口扩展 —— 这是少数、低频、不破坏现有实现。
- **不阻塞**：他做壳/端口时，引擎/游戏照常推进；他基于**已发布的 web bundle + 已稳定的端口契约**工作，二者时间线独立。
- **纪律**：同 `claude/mainbranch`，提交前 `fetch → rebase → push`，全绿才推（与全员一致）。他的改动几乎全在新文件里，rebase 几乎不冲突。

> 一句话：**这是一个可以"摘出去单干"的工作包** —— 像资产管线、studio 那样的旁路层，不在引擎确定性核心的关键路径上。给他这份文档 + 端口范式参考（services/audio）即可开工。

## 7. 端口契约草案（供施工者起步）

```ts
// src/services/steam/steam-port.ts —— 与 AudioPort/AishePort 同纪律：接口 + Null 后端(测试/无 Steam) + 真后端。
export interface SteamPort {
  isAvailable(): boolean;                         // 非 Steam 环境(如纯 web)返回 false，全部降级为 no-op
  unlockAchievement(id: string): void;
  setStat(id: string, value: number): void;
  setRichPresence(key: string, value: string): void;
  // 云存档走 StoragePort 的 SteamCloudStorage 后端，不在此重复。
  // 联机走 net 的 Channel 抽象的 Steam 实现，不在此重复。
}
export class NullSteamPort implements SteamPort { /* 全 no-op，纯 web / headless / 测试用 */ }
// SteamworksSteamPort：包 steamworks.js，仅在 Tauri/Electron 壳内构造。
```
注入点：游戏 mount/launcher 处构造端口并传入（与现在传 AssetManager/AudioPort 同位置）。sim 与游戏数据无感。

## 8. 风险 / 坑（都不阻塞单机发布）
- **跨架构 lockstep 浮点 desync** → REQ-010（定点数），仅跨平台实时对战需要。
- **二进制体积 / 启动** → 选 Tauri 即解。
- **上架审核 / 代码签名 / Steamworks 配置**（appid、depot、商店页）→ 运营/发行流程，非工程；CI 脚本覆盖打包+上传那段。
- **webview 性能上限** → 2D 无虞；非 3A-3D 目标。

## 9. 结论
当前栈能上 Steam、不重写引擎、可并行单干。建议技术栈 **Tauri + steamworks.js + SteamPort + StoragePort(Steam Cloud 后端) + publish CI**。
本线可作独立工作包交助理程序员并行推进，主线（引擎/战斗/各游戏）不受影响。
