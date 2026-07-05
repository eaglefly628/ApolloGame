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
- [x] **假 Steam 后端（owner 2026-06-25 指派·无真账号长期开发用）** — ✅ `mock-steam.ts`：实现与真桥**同一 `SteamBridge` 契约**的本地假 Steam（假玩家、内存+localStorage 持久化态、幂等成就、排行/统计/富状态、解锁弹 Steam 风格 toast「正常回馈」）。走与真 Steam **同一 `SteamworksPlatformPort` 代码路径**，换真账号零改动。开关：`?steammock=1` / `localStorage['apollo:steam:mock']=1` / `globalThis.__APOLLO_STEAM_MOCK__`。默认关→web 生产仍 Null。
- [x] **P1 成就直通（数据驱动 + 端到端可见）** — ✅ `achievements.ts` 成就目录=数据（game-g/e/f，各含 *_FIRST_BOOT）；`cartridge-entry.ts` 启动时经 `createPlatformPort()` 上报富状态 + 解锁首启成就（无平台→Null 静默，零副作用）。**Playwright 真机验证**：game-g 单文件 `?steammock=1` 启动 → 控制台 `[steam:mock] unlock GG_FIRST_BOOT` + 右下角弹「🏆 成就解锁」。tsc+vitest(1692)+build 全绿。
      - ⏳ 余：接真 Steam 后台登记同名成就 id（需 owner 真 appid）；game-g 战役胜利点接 `GG_FIRST_WIN`（待 PG 数据化出 Flag 流后接 AchievementSync，或在胜利回调直接 `port.unlockAchievement`）。
- [x] **P2 云存档（数据驱动 + 假云可验）** — ✅ `storage/steam-cloud-storage.ts`：`SteamCloudStoragePort implements StoragePort`（槽位=云文件 + 索引文件，索引缺失从文件重建；写失败回滚）。`cloud-bridge.ts` 定义 `SteamCloudBridge` 契约 + `createMockSteamCloudBridge()` 假云（内存+localStorage 持久化）。`select-storage.ts` 工厂：真云桥→假云(开关)→LocalStorage→Memory，零分支。Electron 侧 `steam.cjs` 加 `client.cloud` 防御封装 + preload `__APOLLO_STEAM_CLOUD__`(invoke) + main handle。单测 6（往返/索引重建/持久化/工厂）全绿，cloud 降级自检通过。
      - ⏳ 余：game-g 把 `new SaveSystem(createStoragePort())`（一行消费）接上，存档即走（假/真）云；真机验收需 owner appid。
- [x] **P3 富状态 / 排行榜 + game-g 接线** — ✅ 富状态/成就；**⚠️ 排行榜实为未实现（steamworks.js 无 leaderboard API，见下「2026-07-04 复核修订」）**。`game-g/platform-hooks.ts`：`ggOnBattleWon` 在战役胜利点（game-g.tsx persist 后）解 `GG_FIRST_WIN`、无伤(大本营满血)加 `GG_FLAWLESS`、传 `campaign_progress` 排行榜、`setRichPresence("战役 第 N 关")`、store。`ggCloudSave/ggCloudLoad` 经云桥镜像 game-g 自有存档 blob 上云（persist 时 best-effort）。工厂选实现，不可用静默。`resolveCloudBridge()` 加进 storage。单测 5（胜利/无伤/不可用/云往返）+ flow-walk 真打一局过结算全绿。tsc+vitest(1727)+build 全绿。
      - ⏳ 真机：富状态/排行/成就需 owner 真 appid + 后台登记同名 id/排行榜。
- [x] **P4 上架管线（一键傻瓜界面）** — ✅ 独立工具 `steam-publisher/`（纯 Python + 网页，同 cartridge-station 风格）。界面四步：① 配置(AppID/各平台 DepotID/builder/steamcmd/选游戏) → 🔨 构建裸目录(electron-builder --dir) → 📝 生成 VDF(app_build+depot·写真 steam_appid.txt) → 🚀 一键发布(steamcmd +run_app_build)，实时日志轮询。自检：server 起动 + /api/state + VDF 生成格式正确（SteamPipe 标准）。
      - ⏳ 真上传需 owner：合作伙伴账号($100)+真 AppID/DepotID + 装 steamcmd + 后台 Set Live + 登记成就 id/Cloud 配额。工具用占位 480 已跑通编排。

## 2026-07-04 · PS 代码复核修订（真桥 API 对齐 · 门禁全绿）

> 拿真实 `steamworks.js@0.4.x` 的 `.d.ts` 逐条比对 `electron/steam.cjs` 的"防御式猜测"，坐实三处真机会咬人、但被 mock 绿掩盖的缺陷并修复。tsc + vitest(2240) + build 全绿。

- **🔴 排行榜哑火 → 可观测降级**：`steamworks.js` **整包无 `leaderboard` 命名空间**（P3 曾标 ✅ 名不副实）。旧 `client.leaderboard.uploadScore` 恒 undefined + `safe()` 静默吞 = 真机永不上传且零日志。改为 `warnMissing` 明确告警一次。**排行榜要真上线须另接 Steamworks Web API**——P3「排行榜」实为**未实现**，成就/富状态/云不受影响。
- **🔴 云 `listFiles` 类型不符 → 修**：真桥 `client.cloud.listFiles()` 返回 `FileInfo{name,size}[]`，桥契约要 `string[]`；旧实现透传对象 → 真机索引重建时 `f.startsWith` 抛。`steam.cjs cloudList()` 取 `name` 归一化，`SteamCloudStoragePort.rebuildIndex` 加容错 + 回归测试（喂真桥形态对象断言重建不炸）。
- **🟠 AppID split-brain → 修**：旧 `steam.cjs` 只读 `env/480`、无视发布工具写进 `steam_appid.txt` 的真 AppID → 打包后 `init(480)` 连 SpaceWar。改为 `resolveAppId()` 以同目录 `steam_appid.txt` 为单一真相（env 覆盖 > 文件 > 480 兜底），`status().appIdSource` 自检暴露来源。**打包路径需真机烧版核对**（`resourcesPath/../steam_appid.txt`）。
- 🟡 待办（未改，behavior-changing/低优先，留真机 bring-up）：`restartAppIfNecessary` 最佳实践、`delete()` 索引回滚对称性。

## 2026-07-04 · 创作台一键发布·PS 侧地基（REQ-PUBLISH·owner 指派）

> owner 拍板：创作台 player 模式内做「打包→上传 Steam」一键流水线（承载面=studio 网页·深度=尽量一路到上传）。跨 PS↔PST 域，工单 `requests.md#REQ-PUBLISH-创作台一键发布` 待 Lead 裁域切分+派工。**PS 先起不依赖 UI 形态的管线地基**：

- **稳定编排契约 `plan_pipeline(cfg)`**（`steam-publisher/serve.py`）：单一入口固化 build→生成 VDF→上传 的顺序与命令构造，dry-run 返回三步（不实际 build/upload），缺前置（未填 builder/depot）记 `blocked`+原因不抛（预览友好）。additive `POST /api/plan` 暴露。studio 接入时无论走「直连本地端口/apollo.py 转发/内嵌」都复用此纯函数。
- **三段稳定契约 + 判词 token 收口（Lead 派工·2026-07-04 落）**（`serve.py`）：
  - **三段命名** `PUBLISH_STAGES=('package','genvdf','upload')` + `stage_package/stage_genvdf/stage_upload(cfg)`，各返回统一 `{stage,status,...}`；`plan_pipeline` 由三段组合。
  - **判词 token 收口**：全管线对外状态只用一套稳定字面——段判词 `ST_OK/ST_BLOCKED`（缺前置记 blocked+reason 不抛），任务判词 `JOB_IDLE/RUNNING/DONE/ERROR`（`job_status()`）。**消费端不再 scrape 日志字符串**，apollo.py 代理/前端认这套。
  - **进度**：`job_status()` 接进 `/api/state` + `/api/log`（旧 `running`/`action` 字段保留不破 GUI）。
- **无真账号冒烟 `scripts/steam-publish-smoke.py`**（480·退出码门禁·同 `scripts/*-smoke.py` 约定）：**24 断言**验 VDF 格式(SteamPipe)/build·publish 命令/错误守卫/三段命名/`plan` 判词 token/`stage_*` 单段/`job_status` 空态。副作用重定向 temp 不脏化仓库。自证：破坏 VDF 格式 / 段名 → 真红。已登记 `playbooks/testing.md`。
- **Lead 裁决（2026-07-04）**：接入形态=**经 apollo.py 转发**（薄代理 `/api/publish/*` → serve.py·只透传不塞逻辑），非直连/非内嵌；PS 先行硬化契约（✅ 三段+token 已落）；PST 随后接向导页 UI。
- ⏳ 余：① apollo.py 加 `/api/publish/*` 薄代理（PST/服务面域）；② PST 接 player 模式「发布」向导页（选游戏/平台·填 AppID/DepotID/builder·进度日志·**三步不能自动做成显式向导页**）。真上传三步（账号+$100 / steamcmd 登录 / 后台 Set Live）向导显式引导。

## 依赖 / 待 owner 提供

- **Steam 合作伙伴账号 + 真 appid**（$100 一次性入门费）。拿到前用 480 测试 appid 跑通 P0–P3。
- 联机（P2P→Steam Networking）依赖 **REQ-010 浮点→定点**，排在最后或暂不做。

## 现状

- 已有（框架）：`platform-port.ts`（接口）、`null-platform.ts`（降级）、`achievement-sync.ts`（骨架）、`platform.test.ts`（仅测 Null）、`docs/design/steam-publish.md`（蓝图）。
- 未动：steamworks.js 依赖、`SteamworksPlatformPort` 实体、Steam Cloud、depot/上传管线。
- **下一步**：P0（加依赖 + steam_appid.txt + 壳内 init 自检）。
