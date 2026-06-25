# PS · Steam 发行轨 · 工作清单 / 认领（Platform / Steam Publishing）

> **本 session（cartridge/平台轨）维护。** owner（junbai.li · 2026-06-25）拍板：**Steam 发行作为独立平台轨，由本 session 接管全部事项。**
> 给 **Lead/主程** 看引擎触点供 review、给其他 session 看车道避免撞车。
> 分支 `claude/mainbranch`；每条 tsc + vitest + build 全绿才推。设计真相：`docs/design/steam-publish.md`。

---

## ⭐ 车道声明（"跟主持人挂号"）

- **谁**：本 session 接管 Steam 全链路（壳内 SDK 绑定 + 平台适配器 + 上架管线）。
- **落点**：`electron/`（壳内 steamworks.js 绑定）、`src/services/platform/`（`SteamworksPlatformPort` 实体）、`src/services/storage/`（Steam Cloud 适配）、`scripts/`（depot/上传）。
- **与 PG 的边界**：PG（game-g）只**消费** PlatformPort（触发成就/上传分数走现成接口），**不碰** SDK/壳/管线。手柄同理：引擎 `GamepadInputSource` 已就绪，PG mount 时接线即可。
- **与 Lead 的边界**：服务层原属 Lead 域；本轨经 owner 指派由本 session 实现，登记于此 + requests.md(`REQ-STEAM`) 周知。接口契约 `PlatformPort` 不改（已稳定），只加适配器实体。

## 选型（已定，解除"定壳"阻塞）

- **壳**：**Electron**（沿用现有 electron 33 + electron-builder，不引入 Tauri）。
- **SDK**：**steamworks.js**（N-API 绑定，仅壳内 require；web bundle 不变，dev/web 仍走 `NullPlatformPort`）。
- **适配器**：`SteamworksPlatformPort implements PlatformPort`（`unlockAchievement/setStat/setRichPresence/uploadLeaderboard`）。
- **测试 appid**：先用 **480（SpaceWar）** 跑通 P0–P3；owner 拿到真 appid 后替换。

## 阶段（每阶段独立验收，绿了再下一步）

- [x] **P0 选型锁定 + 依赖落地 + init 自检骨架** — ✅ 代码全绿（tsc+vitest 1682+build）。落地：
      - `steam_appid.txt(480)`；`package.json` optionalDependencies 加 `steamworks.js`。
      - 主进程绑定 `electron/steam.cjs`（防御式 init，无 Steam→available:false 不崩）+ `electron/preload.cjs`（contextBridge 注入 `window.__APOLLO_STEAM__`）+ `electron/main.cjs`（IPC 两端 + 自检 log）。
      - 渲染侧 `SteamworksPlatformPort`（委派桥）+ `createPlatformPort()` 工厂（有桥→Steam，无桥→Null，零分支）+ 单测。
      - `electron-builder.yml`：ship preload/steam.cjs + steam_appid.txt，asarUnpack 原生 .node。
      - ⏳ **待真机验收**（本环境无 Steam）：装了 Steam 客户端的机器上 `npm i`（拉 steamworks.js 原生模块）+ 放 Steamworks SDK redist → 跑 Electron，控制台应见 `[steam] init → {"available":true,"name":"<你的Steam名>"...}`。这步 owner 在本地做。
- [ ] **P1 成就 / 统计直通** — 实现 `SteamworksPlatformPort`，`achievement-sync.ts` 接真 Steam；game-g 触发一个测试成就。验收：Steam 客户端弹出成就解锁。
- [ ] **P2 云存档** — `StoragePort` 加 Steam Cloud(remote storage) 适配。验收：删本地存档、重进还在。
- [ ] **P3 富状态 / 排行榜** — `setRichPresence` + `uploadLeaderboard`。验收：好友列表见"正在玩 翻命扑克 第 N 关"。
- [ ] **P4 上架管线** — `steam_appid` + depot vdf + `scripts/publish-steam.mjs`(steamcmd 上传) + CI。验收：steamcmd 能推到后台测试 depot。

## 依赖 / 待 owner 提供

- **Steam 合作伙伴账号 + 真 appid**（$100 一次性入门费）。拿到前用 480 测试 appid 跑通 P0–P3。
- 联机（P2P→Steam Networking）依赖 **REQ-010 浮点→定点**，排在最后或暂不做。

## 现状

- 已有（框架）：`platform-port.ts`（接口）、`null-platform.ts`（降级）、`achievement-sync.ts`（骨架）、`platform.test.ts`（仅测 Null）、`docs/design/steam-publish.md`（蓝图）。
- 未动：steamworks.js 依赖、`SteamworksPlatformPort` 实体、Steam Cloud、depot/上传管线。
- **下一步**：P0（加依赖 + steam_appid.txt + 壳内 init 自检）。
