# 卡带美术存储归位（owner 2026-08-06 令·方案 b「口径彻底统一」）

> 提出：PST · 触发：owner 问「新建卡带时它怎么知道放仓库哪儿」→ 查出卡带被劈成两半。
> **状态：b-full 已全量落地（2026-08-06·owner 明示豁免 PST 跨 `scripts/` 一次）**——8 项全做完，
> 冒烟 `scripts/cartridge-art-smoke.py` 18 例绿 + 全量门禁绿。**⚠ 越界记债：`scripts/art-replace.mjs`
> 与 `scripts/art-ledger-guard.mjs` 属 Lead 独占域，本次经 owner 单次豁免由 PST 改动，待 Lead 追认。**

## 一、现状：卡带被劈成两半（缺陷本体）

创作台新建卡带落 `library/<slug>/`（**gitignored**·每卡带自带独立 git 仓，`library.py::_git_commit_all` 每次保存 `add -A` + commit）。
但 `_scaffold()` 建完之后还会往**引擎仓跟踪区**写：

| 卡带组成 | 落盘 | 入引擎仓 |
|---|---|---|
| 玩法 manifest/meta | `library/<slug>/` | ❌ |
| 美术台账 `art-ledger.json` | `public/games/<slug>/art/` | ✅ |
| 立项卡 `pipeline.json` | `public/games/<slug>/` | ✅ |
| 生成/上传真图 `gen/*.png` + `index.json` | `public/games/<slug>/art/` | ✅ |
| mock 占位图 | `gen/mock/` | ❌（已 gitignore） |

后果：**玩法在仓外、美术在仓内**。卡带美术照样被 mainbranch 高频推挤出冲突，而 `handle_art_sync`
（2026-08-06 一键提交推送）对 library 卡带是拒绝的——理由写的「卡带不入引擎仓」**只对 manifest 成立**，
于是卡带美术冲突无解。内置游戏美术留在仓里是**对的**（是出货内容），本单不动它。

## 二、关键发现：零引擎改动

引擎侧拿的是 **URL 不是磁盘路径**——`src/assets/game-art-load.ts::gameArtIndexUrl()` 返回
`/games/<slug>/art/index.json`，且 `index.json` 里的 `path` 已是站点绝对路径、`registerAssetIndex`
以 `baseUrl=''` 原样当 URL 消费（`src/services/manifest-game.ts:47` 同源另一处）。

→ **URL 是数据契约，物理存储是伺服细节**。只要 URL 形状 `/games/<slug>/art/**` 不变，
`src/{assets,services,engine,renderer}` **一行都不用改**，台账/索引**文件内容也不用改写**（servedPath 原样有效）。
这条把本单从「引擎面改造」降成「伺服 + 写盘落点」的局部迁移。

## 三、两个变体

### b-lite（.gitignore 反白名单·~5 行·零代码）
`public/games/*` 全忽略 + `!public/games/<内置游戏>/` 逐个放行。新卡带美术自动落在仓外。
- ✅ 冲突归零、零代码、可逆；✅ 打包/守卫/伺服全不动（文件仍在原处）
- ❌ **卡带美术零版本历史**（不在引擎仓，也不在卡带自己的仓里——它人还在 `public/`）
- ❌ 不是「口径统一」，只是把文件藏起来；漏写一个内置游戏 = 该游戏新文件静默不入库（需守卫兜）

### b-full（存储归位·推荐·owner 选的「彻底统一」就是这个）
卡带美术整体挪进 `library/<slug>/art/`，与玩法同处一室。
- ✅ 真·口径统一：卡带 = 完全自包含的用户数据
- ✅ **版本历史免费到手**——`_version_save` 本就 `git add -A` 整个卡带目录，art/ 自动进卡带自己的仓
- ✅ 打包更简单（卡带 zip 从一个目录取，不必再拼 `public/games/<slug>`）
- ✅ `handle_art_sync` 拒绝卡带的理由**从此真正成立**（不必再开 (a) 口子）
- ⚠ 需改伺服两处 + 写盘落点（含 Lead 独占 2 文件·见下）

## 四、b-full 精确改动清单（按域归属）

| # | 改动 | 文件 | 域 |
|---|---|---|---|
| 1 | `/games/<slug>/art/**` 查找加 library 优先回退 | `main_entry/server.py::_serve_public_games` | ✅ PST |
| 2 | dev 伺服镜像同一回退（与 1 刻意孪生·注释已言明同源） | `vite.config.ts::serveLiveGameAssets` | 🔶 构建配置 |
| 3 | 上传/还原/风格锚/复核的落盘根按卡带分流 | `main_entry/t2_replace.py`·`art_replace.py` | ✅ PST |
| 4 | 资产浏览器历史改读卡带自己的仓（`git -C library/<slug> log`） | `main_entry/artbrowser.py` | ✅ PST |
| 5 | 卡带打包 zip 源改 `library/<slug>`（含 art） | `main_entry/server.py`(~289) | ✅ PST |
| 6 | **写盘大脑落点卡带感知**（`ledgerFile`/`localIndexFile`/`genAbs`/备份 552-556） | `scripts/art-replace.mjs` | 🔒 **Lead** |
| 7 | **守卫扫描根加 library**（否则卡带台账全成黑户） | `scripts/art-ledger-guard.mjs` | 🔒 **Lead** |
| 8 | 存量迁移命令（移文件·跟踪过的 `git rm --cached`·幂等·可回滚） | 新 `scripts/` 或 `main_entry/` | 🔒 待裁 |

**⑥⑦ 是 PST 的域外硬红线**——没有它俩，上传（PST 代码）写 library、生成（scripts 大脑）仍写 public，
= **split-brain，比不改更糟**。故本单**不许只做一半**，必须整批派工。

## 五、存量与风险

- **当前引擎仓内无卡带美术**（实测 `git ls-files public/games/*` 只有 game-a/b/c/d/e/g/i/z/101/102/103 全是内置）
  → 迁移在**本仓是空操作**；风险只在 owner 本机可能有未提交的卡带美术（移文件即可·非 git rm）。
- 回滚：URL 契约未变 → 把伺服回退摘掉 + 文件挪回即复原，无数据格式变更。
- 验收：卡带换图后**刷新即见新图**（三宿主各验一次：vite dev / python server / 打包产物）+
  卡带 zip 自带美术 + 守卫对卡带零黑户 + 引擎仓 `git status` 换图后**保持干净**（本单的目的）。

## 六、如建（2026-08-06 落地实况）

owner 选 b-full 并豁免跨域，8 项全部落地：

- **单一真相双实现**：`main_entry/paths.py::art_root`（Python）+ `scripts/art-paths.mjs::artRoot`（JS）。
  两边规则必须一字不差——**冒烟 ② 直接跨语言比对两者对同一 slug 的答案**，这是 split-brain 的机械防线。
- **伺服双宿主**：`server.py::_serve_public_games` 卡带 art 优先根（两根各自独立做穿越校验）+
  `vite.config.ts::serveLiveGameAssets` 同规格镜像。content-type 表抽 `_asset_ctype` 两根共用。
- **写盘落点**：`t2_replace.py`/`art_replace.py`/`agent_chat.py`/`artbrowser.py` 全改走 `art_root`；
  `art-replace.mjs` 的 `ledgerFile`/`localIndexFile`/`genAbs`/备份改走 `artRoot`。
- **历史归位**：`_served_path_to_repo_rel` 改返回 **(仓库根, 仓内相对路径)**——卡带去卡带自己的 git 仓
  查 `git log --follow` / `git show`（美术随 `_version_save` 的 `add -A` 自动入卡带仓）。
- **发现口径**：guard `discoverGames` + artbrowser `_discover_game_slugs` 双根枚举（否则卡带台账全成黑户漏审）。
- **导出包**：`_serve_export` 无需改代码——art 已在卡带本体内，随 lib 树自动进包（归档路径由
  `<slug>/assets/art/…` 变为 `<slug>/art/…`）。
- **存量迁移**：`scripts/cartridge-art-migrate.py`（默认 dry-run·`--apply` 真搬·幂等·
  跟踪过的只 `git rm --cached` 不代人提交）。

**验收**：`scripts/cartridge-art-smoke.py` 18 例——解析分流 / 双语言一致 / 伺服三态（卡带出 library·
内置回归 public·穿越 403·缺文件 404）/ 上传落卡带屋且 public 侧零文件 / **引擎仓 git status 保持干净**
（本单目的）/ 台账端点 / 迁移 dry-run+apply+幂等 / 守卫发现卡带。

**未纳入（明示留尾·不占槽）**：`pipeline.json`（立项卡）仍落 `public/games/<slug>/`——它不在 `art/` 下、
消费方是生产板另一条线，本单只做「美术归位」不顺手扩面。要做时单开小条。
