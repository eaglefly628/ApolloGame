# 发行白皮书（PS） · stub

> 指针优先·不复制内容（防口径漂移）。慢慢补全。

## 发行现状与流程（指针）

- **工具与流程**：`steam-publisher/README.md`（+ `steam-publisher/RELEASE-PROCESS.md`）。
- **发行清单/现状**：`docs/workflow/finish/PS-steam-finish-list.md`（成就/云存档/富状态进度 + 假 Steam）。
- **agent**：`.claude/agents/game-publisher.md`（构建→VDF→steamcmd→Set Live 一条龙）。

## 构建线

- **桌面打包**：`electron-builder.yml` + `scripts/dist.py`（electron 裸目录 → 安装包）。
- **cartridge 构建线**：`vite.config.cartridge.ts`（`VITE_TARGET_GAME` 选单游戏 → `dist-cartridge`·入口 `cartridge.html` + `src/cartridge-entry.ts`·`base:'./'`·直挂游戏无 launcher）。
- **平台锚点**：`src/services/platform/{platform-port,select-platform,mock-steam}.ts`·`electron/steam.cjs`。无真账号走 `?steammock=1`。

## 教训（必读一行，细节点开源文档）

- **掌机弱 GPU 黑屏**：`docs/workflow/archive/session-handoff-2026-06-22-full.md §0`——cartridge 烧进掌机弱 GPU webview 时，`transform:scale` 首帧烤成单合成图层→合成失败黑屏（无头测不出，Mac 正常）；修法=改 **CSS zoom**（CPU 布局缩放·不生成合成图层·消闪烁·fail-safe 只裁切不黑）。发行前真机烧版验证，别信无头绿。

## 发行双清单（CCGS 参考采纳·2026-07-04·主程沉淀）

- **内门**（对内发版）：门禁全绿 · 未关 bug 按严重度阻断（CRITICAL/HIGH=BLOCKED 逐个点名·MEDIUM/LOW=CONCERNS）· changelog 就绪 · 未终态工单按未完成计（In Review ≠ Done）。
- **外门**（对外上市）：商店页完备（截图/描述/元数据）· 构建带版本 tag 可复现 · 平台接线验证（成就/云存档·mock 或真机）· **真人玩前 5 分钟首次体验** · 法务/分级（上架时）。
- 每次检查按日期落档，与上一份做 delta（新解决/仍悬挂/新出现）；硬缺口=BLOCKED，人工验证项=CONCERNS 不自动升级。紧急修复（hotfix）不豁免技术门：门禁+靶向回归照跑，人评审可事后补。

## 补全规则（照模板 §4）

- 踩过的打包/上架/平台坑 → 追加一节（≤20 行/次），同提交推；能沉淀成手册的回填 `docs/playbooks/save-platform.md`。
- 缺口 → `docs/workflow/requests.md`（发行类工单）。
