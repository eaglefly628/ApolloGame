# Apollo Studio · mac 离线包怎么拿 / 怎么跑

> D5 交付物（`docs/workflow/platform-packaging-spec.md`）——「整套平台」打包成一个 mac app，
> 客户机器不装 node/python。产物架构见 spec 正文；本文档只管「怎么拿到 .dmg」+「客户怎么运行」+
> 「哪些功能离线能用、哪些要 key、哪些要 node」。

## 1. 怎么拿到 `.dmg`

真 `.dmg` 只有 mac CI 能产出（本仓库/Linux 开发机产不出、也验不了实际能不能跑，见 §4「Linux
侧验过什么」）。拿法：

1. 打开仓库 GitHub 页面 → **Actions** → **Build Platform (macOS)** workflow。
2. 点 **Run workflow**（`workflow_dispatch` 手动触发·分支选 `claude/mainbranch`）。
   可选填两个输入（不填就用默认值，已验证真实存在的一组 `python-build-standalone` release）：
   - `pybuild_python_series`（默认 `3.11`）
   - `pybuild_release_tag`（默认 `20250626`）
3. 等 runner 跑完（`macos-latest`，全程约 10~20 分钟，大头是下载 Electron + standalone python +
   `pip install`）。
4. 跑完后在该次 run 页面底部 **Artifacts** 里下载 `apollo-studio-mac-arm64-dmg`（zip 包着一个
   `.dmg`）。

CI 步骤全过程见 `.github/workflows/build-platform-mac.yml`：组装前端+后端 → 灌 standalone
python + `pip install`（`scripts/bundle-python-mac.mjs`）→ 零 key 门禁（必过，`scripts/assert-no-baked-key.mjs`）
→ `electron-builder --mac --config electron-builder.platform.yml` → 上传 `.dmg`。

## 2. 客户机器怎么运行

**本包只支持 Apple 芯片 Mac（M1/M2/M3/M4…）**，arm64-only（owner 07-26 拍板；Intel 客户需要
x64/universal 是另一条后续需求，不在本次范围）。苹果菜单 →「关于本机」可看芯片类型。

1. 双击下载下来的 `.dmg`，把里面的 **Apollo Studio.app** 拖进「应用程序」文件夹。
2. **首次打开会被 Gatekeeper 拦**（报「已损坏，无法打开」或「无法验证开发者」）——这是因为本包
   默认**未签名**（无 Apple 开发者账号，owner 07-26 拍板；若某次 CI 跑配了签名 secret 则这步
   可以省，见 §5）。绕过方法（任选一种）：
   - **右键（或 Control+点按）App → 打开 → 再点一次「打开」**。
   - 若右键打开仍报「已损坏」（新版 macOS 对未签名 App 更严格），打开「终端」执行：
     ```
     xattr -cr /Applications/Apollo\ Studio.app
     ```
     然后正常双击。
   - 同款更详细的图文说明已经在仓库里现成一份（`build/mac-open-help/`），把里面的 App 名字换成
     `Apollo Studio.app` 就能直接照抄给客户用。
3. 打开后是**首启引导**：填生图 key / Deepseek key，或直接跳过（跳过＝离线模式，见下面矩阵）。
   key 只落本机 gitignored 配置，绝不随包分发（`platform-packaging-spec.md` 决策②安全红线，
   CI 有 `assert-no-baked-key.mjs` 门禁挡）。

## 3. 功能矩阵（离线 / 需 key / 需 node）

| 功能 | 无 key、无 node | 有生图 key | 有 Deepseek/LLM key | 备注 |
|---|---|---|---|---|
| 9 游戏白名单离线试玩 | ✅ 能玩 | — | — | 游戏本身不依赖后端在线服务；见 spec 架构「游戏永远离线可玩」 |
| 创作平台/工坊现场创作（生成数据游戏→玩） | ✅ 能用 | — | — | owner 拍板的核心场景，纯 python 已证通 |
| 实时生图（工坊「⚡ 生成」按钮出图/抠图） | ❌ 灰掉 + 提示填 key | ✅ 能出图 | — | 后端只依赖 Pillow（随包），生图走线上模型 API，需 key |
| LLM 对话/agent 流（工坊聊天式改稿） | ❌ 灰掉 + 提示（可选功能） | — | ✅ 能用（BYO Deepseek 等） | 纯展示可选项，不给 key 也不影响主线 |
| `claude` CLI agent 通道 | ❌ 报错「未找到 claude CLI」 | — | — | 包里不带 node/claude CLI（本次 B 决策：只带 python）；代码里已有 `shutil.which('claude')` 友好提示（`main_entry/claude_code.py`），不是崩溃 |
| art 出图辅助脚本（`ai-gen.mjs`/`asset-matte.mjs`/`vendor-asset.mjs` 等） | ❌ 报错（缺 node） | 同左 | 同左 | 这些是 `node scripts/*.mjs`，包里没带 node；客户端场景本来就用不上（面向 PE/策划工作流，不是终端玩家功能） |
| TS 卡带编译（`library/<slug>/logic.ts`） | ❌ 报错（缺 node/tsc） | — | — | 同上，面向创作者的进阶功能，终端玩家路径不触发 |

**一句话总结**：无 key、无 node → 平台 UI + 9 游戏 + 生成数据游戏这条主线完整能跑；生图/LLM
对话/TS 编译这些「需要联网模型或需要 node 工具链」的次要功能优雅降级成「灰掉 + 提示」或
「报错但不崩溃」，不是本包的核心承诺（本次 B 决策：只带 python，不带 node，这些视为已知代价）。

> **诚实边界**：上表「node 依赖功能报错但不崩溃」这条，D5 只抽查确认了 `claude_code.py`（有
> `shutil.which` 友好检查）和 `assets.py` 至少一处 `FileNotFoundError` 捕获；没有逐个接口过一遍
> 「client 侧真触发时到底是哪种报错形态」——这属于 D6（干净机验收）该做的事，不在本次打包配置
> 交付范围内。

## 4. Linux 侧验过什么 / 哪些只能 mac CI 验

D5 交付时（本仓库是 Linux 环境）能验、已验的：

- `node scripts/build-platform.mjs` 跑通，产 `platform-dist/`（9/9 白名单命中、零 key 断言 PASS）。
- `node scripts/assert-no-baked-key.mjs platform-dist` PASS（含新增的二进制嗅探安全网——见
  `scripts/assert-no-baked-key.mjs` 头部注释，为 pybundle 真二进制内容准备的）。
- `node scripts/bundle-python-mac.mjs --dry-run` 能正确解析计划并打印；不带 `--dry-run` 在非
  darwin 平台会**显式拒绝**（`exit 1` + 说明去 mac CI 跑），不是静默假装成功。
- `scripts/bundle-python-mac.mjs` 里挑资产的纯函数（`assetRegex`/`pickAsset`）有独立单测
  （`scripts/bundle-python-mac.test.mjs`），假数据覆盖多系列混杂/零命中/多命中三种情形，不依赖网络。
- `electron-builder.platform.yml` 用 `js-yaml` 解析确认语法/字段结构正确；用
  `npx electron-builder --mac --config electron-builder.platform.yml --dir` 在 Linux 上实测跑通
  （产出 `.app` 目录，虽然是 x64 而非真 arm64、也没有真 code signing，但**验证了 `files`/
  `extraResources`/`extraMetadata` 这些字段拼装逻辑真实生效）：确认了 `Resources/backend/`
  正确摘掉了 `pybundle/`、`Resources/pybundle/` 独立存在（对应 `resolveBackendDir()`/
  `resolvePythonBin()` 两个已落地的 resolver 各自要找的路径）；也确认了 `app.asar` 只有
  `electron/platform-main.cjs`+`platform-launch.cjs`+`package.json`（原本会被 electron-builder
  自动带进 `node_modules`/react/three/cannon-es，加了 `"!node_modules/**"` 排除掉——这些是网页端
  产物用的依赖，平台主进程零 npm 依赖，带进去纯浪费体积）。
- 真跑 `npx electron-builder --mac --config electron-builder.platform.yml`（不带 `--dir`，即真正
  尝试出 `.dmg`）在 Linux 上如预期报错退出（`Cannot find module 'dmg-license'`——DMG 打包这一步
  official 就是 mac-only 能力，`--dir` 之所以能跑是因为它跳过了这一步）：证实了 spec 里「Linux
  多半因 mac-only 会拒」的预判准确，真 `.dmg` 只能 mac CI 产。
- `pack:mac`（game-g 单游戏）配置**未被破坏**：`electron-builder.yml` 文件本身零改动
  （`git diff` 确认），且用同样的 `--dir` 方式重新跑过一遍确认仍能正常产出 `.app`。

只有 mac CI（`.github/workflows/build-platform-mac.yml`）能验、这次没法在本仓库验的：

- `scripts/bundle-python-mac.mjs` 真下载/校验 SHA256/解压/`pip install`/裁剪/`import PIL` 冒烟
  这条完整链路（Linux 环境对 `api.github.com`/`github.com` 有沙箱代理限制，且下载下来的也是
  macOS 二进制，Linux 跑不了）。
- 真 `.dmg` 产物本身（双击、Gatekeeper 拦截提示、右键打开绕过、内置 python 真的能 spawn 起
  `apollo.py` 服务器）。
- 签名/公证条件分支（`CSC_LINK`/`APPLE_ID` 等 secret 存在时的真实签名+公证流程）。
- `resolvePythonBin()` 在真机上定位到 `pybundle/bin/python3`（而不是回退系统 `python3`）——
  这条单测钉的是查找逻辑本身（`electron/platform-launch.test.mjs`），真机路径存在性要等
  mac CI 灌完真 pybundle 后才第一次被真正验证。

## 5. 签名/公证怎么开（可选，非默认）

默认（不配任何 secret）走**未签名 ad-hoc**路径——这是 owner 07-26 拍板的默认态，够用（配合
§2 的「右键→打开」）。想开签名/公证，去仓库 Settings → Secrets 配：

- `CSC_LINK` + `CSC_KEY_PASSWORD`：Developer ID Application 证书（base64 的 .p12 + 密码）→
  workflow 会自动切到签名路径。
- 另外配齐 `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID` → electron-builder
  会在签名后自动尝试公证（内置行为，`electron-builder.platform.yml` 不需要额外声明）。

三选一都不配 → 保持未签名，workflow 不会因为「没配」而失败（`.github/workflows/build-platform-mac.yml`
用 `steps.signing` 探测结果二选一分支跑，两条路径都是正常退出）。
