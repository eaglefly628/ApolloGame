# game-103 · iOS模拟器原生运行记录（2026-10-26）

**这是运行实证，不是独立复查PASS、真机质量验收或App Store已上架。** owner要求挑一款已有游戏实际跑iOS；先game108，后明确换幸存者。查launcher与GDD：幸存者为game-103，game101为海港绯闻。

## 原生执行

- 固定隔离clone `/private/tmp/apollo-ios-runtime-check-20261026`，HEAD `bb477f902`；未改共享工作区或游戏源码。调试产品配置保存在本地，Bundle ID仅作模拟器身份，不声称已由Apple账号注册。
- 本机Xcode26.6、iOS26.5 SDK；通过Apple官方`xcodebuild -downloadPlatform iOS -architectureVariant arm64`安装iOS26.5(23F77)。第一次下载exit70，官方命令重试exit0，实际simctl返回available=true。
- 独立iPhone17Pro模拟器上实际安装/启动；名称已改为Apollo game-103 iOS verification。保留game108用于对照，不覆盖其它模拟设备。
- `ios-product.mjs prepare`对game-103的真实module入口及声明资源出包，exit0；`ios-release.mjs sdk-build --target simulator`真Xcode编译，exit0，实际Mach-O平台IOSSIMULATOR。
- game-103 buildId：`f010b9243bc8ee084c1446bff7b90ae3ecfa106ee8168cc4afa4f54413416d8f`；game108对照包buildId：`4c7db5a79447edf195fb0fa97c26151173619c4dfb79040c187d1c982e5d50c1`。
- game-103首次安装遇设备Shutdown，exit149；重启同一独立设备后安装exit0，launch exit0，实际观察到战斗、升级三选一；原生Simulator点击技能后确实回到战斗。
- 拖动已尝试，但截图不足以确认移动坐标变化，**触屏走位未验收**；不把画面在动、自动开火或技能可点当作移动输入正确证据。
- 原生竖屏截图在`/Users/junbaili/.codex/visualizations/2026/10/16/01a1423a-1952-7952-a2c0-8ae2faac621b/ios-games-20261026/game103-portrait.png`。game108的原生战斗已目击，第一次保存截图因设备关闭等待屏幕超时；没有伪造其PNG。

## 本轮范围

产品配置复用现有发布能力：工程入口`games/game-103/game-103.ts`，480×854竖屏；resources只带本作art与ui-fonts；runtime.touch为drag/range64/deadZone8。未新增游戏专属system，也未将此调试配置当正式发布配置。是否账号/签名/价格/分级/商店资料齐全仍未验证。

与game108的桌面动画对照见[动画实证记录](../../ios-animation-diagnosis-2026-10-26.md)。iOS实际帧率、启动闪烁、设备GPU、强杀存档、音频恢复、完整通关和商店审核仍未验，不能从本轮构建/截图推定通过。

完整可复用本地配置、prepare/sdk-build原始日志和run-summary.json保存在`/Users/junbaili/.codex/visualizations/2026/10/16/01a1423a-1952-7952-a2c0-8ae2faac621b/ios-games-20261026`。本次不修改产品代码，文档门禁与上传提交见本文件Git历史；未签任何人门。

## 文档提交门禁

本次跨game108/game-103文档，scoped-gate实际判为full。首次沙箱运行vitest退出1（缺浏览器对照、受限临时路径等环境失败）；配置真实Chrome、TMPDIR=/private/tmp并在主机重跑同一scoped-gate，总退出0。eslint、depcruise、tsc、vitest:full、build、docs-ref、context-budget均0；art-ledger-guard退出2为既有允许WARN（黑户5、死账2、缺来源0）；末行`✅ 门禁全绿（scope=full）`。此为施工/记录门禁，不是独立复查判词。
