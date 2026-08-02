# Steam Publisher — ZeroCraft 一键傻瓜发布

把 ZeroCraft 的 Electron 游戏经 **SteamPipe（steamcmd）** 推上 Steam。纯 Python 标准库 + 网页界面，独立目录，不碰引擎/游戏代码。

```
python3 serve.py        # 浏览器自动开 http://127.0.0.1:8799
```

> **程序化接入**（创作台 player 模式一键发布 / zerocraft.py 薄代理）：见 `PUBLISH-API.md`（稳定端点 + 三段/判词 token 契约）。无真账号验证：`python3 ../scripts/steam-publish-smoke.py`。

## 它做什么（界面四步）

1. **① 配置**：填 AppID / 各平台 DepotID / steamcmd 路径 / builder 账号 / 选游戏。「探测裸目录」自动找 `release/<game>/bin/*-unpacked`。「保存配置」存到 `config.json`。
2. **🔨 构建裸目录**：`electron-builder --dir`（Steam 要的是**裸目录**，不是 dmg/exe 安装包）。
3. **📝 生成 VDF**：写 `out/app_build.vdf` + `out/depot_<id>.vdf`（SteamPipe 配置），并把真 AppID 写进仓库根 `steam_appid.txt`。
4. **🚀 一键发布**：`steamcmd +run_app_build` 把裸目录上传成一个 build。日志实时显示。

## 真上传前你要准备（只有这些是钱/账号的事）

- **Steamworks 合作伙伴账号**（$100/app·Steam Direct，营收满 $1000 返还）→ 拿到**真 AppID + DepotID**。
- 本机装好 **steamcmd**（`steamcmd` 在 PATH，或填绝对路径）。
- **首次登录**：点「🔑 登录 steamcmd」缓存凭据；若开了 Steam Guard 令牌，先在终端手跑一次
  `steamcmd +login <builder>` 输入令牌，之后本工具复用缓存会话。

## 上传成功后（Steam 不给 API 的人工步）

去 **Steamworks 后台 → 你的 App → SteamPipe → Builds**，选中刚上传的 build，**Set Live** 到分支（`default` 或 beta）。这一步故意要手动，防误推线上。

## 别忘了后台登记

代码里的成就 id（`GG_FIRST_BOOT` 等，见 `src/services/platform/achievements.ts`）和 Steam Cloud，
**后台也要登记同名/开配额**才真生效（App Admin → Stats & Achievements / Cloud）。

## 注意

- `config.json`（含 builder 账号）、`run.log`、`out/` 已 gitignore，不进库。模板见 `config.example.json`。
- 本工具只编排命令；真正构建/上传跑在你装了 steamcmd 的机器上。
