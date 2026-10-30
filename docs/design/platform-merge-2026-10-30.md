# 三平台合并（创作 · 动画 · 3D 资产）· 可行性与路线 · 2026-10-30

> 状态：P0「从创作平台拉起」已施工（见 §4）。
>
> **owner 2026-10-30 已裁**：
> 1. 后端不重写——Python `main_entry/` 与 Node 动画服务两套原样保留。
> 2. **动画平台代码不动、保持独立**（它本身仍在持续修改）——先合流程：从创作平台能拉起动画平台和 3D 资产平台。
> 3. 创作平台本身将另行大规模重构（目标用户重新定义）——故 P0 入口做成**单件可搬**（一个组件 + 一行挂载），不在旧壳上深耕。
>
> 本文是工具链胶水层，不占 `requests.md` 引擎槽。

## 1. 结论

可行，且**不需要重写引擎**。`src/engine` / `src/skills` / `src/renderer` 不动；要合的是三台工具的**入口、导航与资产身份**。

## 2. 现状（实查·2026-10-30 `605d8bcb`）

| | 创作平台 | 动画平台 | 3D 资产平台 |
|---|---|---|---|
| 后端 | Python：`zerocraft.py` → `main_entry/server.py`（`/api/*`·读写）+ `main_entry/cli.py` 拉起 Vite | Node：`tools/motion-workbench/server.mjs`（已挂 `/library/`=`scripts/motion-preview.mjs`、`/interaction/`=Mink 预览）·只读·`127.0.0.1`+`allowLocalPreviewHost` | 制作中（owner 2026-10-30）；仓内可见件：`tools/asset-vault`、`src/studio/AssetLibrary.tsx`、`assets/index.json` |
| 界面 | React + SHELL（`src/launcher.tsx` + `src/studio/**`·产品壳例外） | LayoutNode + ThreeRenderer/AnimGraph3D·启动时 esbuild 打包 | 未定 |
| 数据 | 仓内 `assets/index.json`、`library/<slug>/` | 仓外 `~/ApolloAssets/**/catalog.json`（SHA 校验）·启动靠 4 个绝对路径参数 | 未定 |

先例：动画平台已把两个独立预览服务并到同端口前缀下（`server.mjs` 前缀转发）——三平台合并是同一手法上推一层。

## 3. 关键约束

1. **后端不动** → 不能在 Python 侧加反向代理，也不能改 `server.mjs`。动画工作台 HTML 用根绝对路径（`/app.js`、`/library/…`），**挂到他人前缀下会断**；故接入方式 = **按其原端口直连**（新窗口或 iframe 指向 `http://127.0.0.1:<port>/`），不做前缀代理。
2. **无统一资产根**：`tools/asset-vault/README.md` 原文「当前没有统一 `APOLLO_ASSETS` 运行时根 API」。这是唯一真正的缺口，在 P1 处理。
3. **域边界**：`src/ui/**` 归 PUI、`src/renderer/three-*` 归 P3D、动画线施工主体 Codex。本合并只碰 `src/launcher.tsx`、`src/studio/**`、`scripts/`、`tools/` 的启动胶水层。

## 4. 路线

- **P0 从创作平台拉起（已施工·2026-10-30）**：
  - `main_entry/platforms.py`：`GET /api/platforms`（清单 + 运行态）、`POST /api/platforms/<id>/launch`。只拉起本机配置里写死的条目，请求体不带命令；`command` 为参数数组、不经 shell；从子进程 stdout 抓第一条本机 URL（90s 超时即停）；已在跑则复用；子进程登记进 `_processes`，随创作平台退出一起收掉。测试 `main_entry/test_platforms.py`（真子进程）。
  - `src/studio/PlatformLauncher.tsx`：启动页「🗃 资源库」后的入口按钮（清单由接口给·零硬编码），点击时先同步开空窗再导航到返回地址（防弹窗拦截）；未配置置灰并提示配置文件。`src/launcher.tsx` 仅一行挂载——创作平台重构时整件搬走。测试 `src/studio/platform-launcher.test.tsx`。
  - 本机配置 `.zerocraft/platforms.json`（Git 外·含绝对路径·`.zerocraft/` 下未入库），示例：

    ```json
    {"platforms": {
      "motion": {"command": ["node", "tools/motion-workbench/server.mjs",
        "--lib", "/Users/<you>/ApolloAssets/motion-lib-full-frames",
        "--runtime-lib", "/Users/<you>/ApolloAssets/motion-socket-validation/review",
        "--runtime-report", "/Users/<you>/ApolloAssets/motion-socket-validation/validation.json",
        "--preview-report", "/Users/<you>/ApolloAssets/motion-socket-validation/preview-validation.json"]},
      "asset3d": {"url": "http://127.0.0.1:<port>/"}
    }}
    ```
    每条二选一：`command`（由创作平台拉起）或 `url`（平台已自行在跑）。`label` 可选。
  - 动画平台零改动：沿用它现有的启动命令与端口，自带的本机 Host 校验原样生效。
- **P1 资产身份契约**（核心）：定 `APOLLO_ASSETS` 资产根 + 统一条目身份（`key`·`sha256`·`source/license`·`status ∈ draft|candidate|confirmed|failed`）；仓内 AssetIndex、动作 catalog、3D catalog 各写**只读映射**到该契约，出一个汇总只读视图。不改各平台原 catalog 格式。
- **P2 跨平台流转**：创作平台为游戏挑动作/模型 → 按 SHA vendor 进游戏本地目录（扩 `resource-manager` 流程补动作/模型段）。
- **不做（现阶段）**：统一后端语言；把创作平台 React 壳重写为 LayoutNode。

## 5. 美术风格对齐（owner 2026-10-30 问）

可以对齐，但**改动落在动画平台自己的一个文件**，按「动画平台代码不动」本轮不碰，交动画平台会话执行：

- 现状：创作平台 = `src/ui/shell-theme.ts` 的 `SHELL`（靛玄深底 `#070613`、jade `#5fdcc8`、violet `#9aa0f5`、`appBg` 靛紫纹理）；动画工作台 = `tools/motion-workbench/theme.ts` 的「亮蓝卡通」（`4b490e57`·当时为用户指定），`tools/motion-preview/theme.ts` 复用它。
- 做法：只改 `workbenchTheme()` 的令牌——以 house 主题 `apolloOnyx`（与 SHELL 同一靛玄系）为底，`pageBg` 取 `SHELL.appBg`，主色映射 `SHELL.jade/violet/gold`，保留 nine-slice 糖果钮与本地字体。逻辑、接口、目录零改动；用 `check-ui` 过对比度。
- 待 owner 确认：放弃亮蓝卡通、统一靛玄？若创作平台重构会改风格，建议等新风格定下再一起对齐，避免对两次。

## 6. 待 owner 答

1. 3D 资产平台所在仓库/目录与启动方式（命令 or 地址）——拿到即可填进 `platforms.json`，代码无需再改。
2. 风格对齐时机（§5）。

## 7. 风险

- 3D 平台未定型：现在合代码必返工 → P0 只留占位，先定 P1 契约。
- 动画工作台的本机限定校验（Host 检查）不可因接入丢失——直连原端口天然保留。
- 动画工作台启动参数含绝对路径：只进 Git 外本机配置，不进仓库。
