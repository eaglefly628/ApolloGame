# 美术管线二期图纸（REQ-ARTPIPE2 · Lead 2026-08-04 · 呈 owner 过目后分批派工）

> owner 令两翼：台账强制（无账不录入）+ Unreal 式资产浏览器（目录/历史/回滚/替换全工作流·「现在太像玩具」）。
> 侦察实数（2026-08-04）：黑户 267（含 game-i/z/102 三游戏零台账共 122 文件）·死账仅 2·**已产出行来源登记 0 缺失**
> （纪律面好·覆盖面破）·对账工具两盲区（正则漏 game101/102·game-d 非标路径树 83 行）·裸路径实证 8 处（game-b/z 硬·a/c 有覆盖层软）。

## 总纲（不变）

历史/备份=git 承载，浏览器只做呈现与操作；台账（art-ledger.json）+ 共享索引（assets/index.json）=唯一账本，
浏览器是视图。**复用不重写**：`art-replace.mjs`（845 行真脑）/上传端点/`asset-reconcile.mjs` 引擎全部保留消费。

## A1 · 台账强制守卫（先行·中体量·低档+我验收）

1. `scripts/art-ledger-guard.mjs`：逐游戏三判——**黑户**（美术目录有文件无台账行）/**死账**（行指路径无文件）/
   **缺来源**（已产出行无 provenance）→ 退出码+机器可读 JSON（喂 A2 浏览器徽标）。**servedPath 为真相**，
   不假设标准目录树（game-d 非标 83 行按其 servedPath 对账·不误判）。
2. **棘轮基线**：现状 267 黑户拍进 `scripts/art-ledger-baseline.json`——存量挂账只许减不许增；新文件必须有账行，
   否则守卫红。接入 scoped-gate 常驻守卫链。
3. **三个零台账游戏建账**：game-i(103)/game-z(5)/game102(14) 由文件机械推导首版台账（status 按实况标
   placeholder/filled·来源可考的填、不可考的标 `provenance:'unknown-legacy'` 挂账）——**不许伪造来源**。
4. 修 `asset-reconcile.mjs` 正则盲区（game101/102）。
5. 裸路径 8 处：**不进守卫一期**（性质=代码改造非账务），开游戏级工单（PE-B 3 处/P3D 1 处/PUI game-i 2 处/
   PE-A·C 各 1 处·随各游戏排期）；后续可在 game-skill-audit 加「美术裸路径」旗（A1.5·裁决后置）。

## A2 · 浏览器核心（workshop 原生·PST 域·中大体量）

三栏（目录树：游戏/共享库/类型 → 缩略图网格 → 详情栏），数据三源=assets/index.json + 各游戏 art-ledger +
FreeArtLib（沿 AssetLibrary.tsx 已验证的三源合一模式·mockup 血统同源）。拖入=调既有上传端点+自动建账行
（A1 守卫保证无逃逸）。黑户/死账/缺来源徽标=读 A1 的 JSON。**落位=workshop**（owner 日常工作面·与收稿箱/
向导同屋），不在 src/studio 原地翻修。

## A3 · 历史与回滚（中体量）

详情栏「历史」页=服务端 `git log --follow -- <servedPath>` 提交列表 + 任意版本缩略图预览（`git show rev:path`）+
「回退到此版」（写工作树+台账行状态变更走既有 replace 语义·保号）+ 替换前后并排对比。零新存储——git 就是备份。

## A4 · 替换工作流（中体量）

详情栏动作区：消费方视图（该资产 key 被哪些游戏/哪些屏引用·索引反查）→ 重生成/换库/换皮/上传替换
（全部调 `art-replace.mjs` 既有四命令与 `/api/art/*` 端点·零逻辑重写）→ 逐行人审沿 ArtLedgerPanel 端点语义
（**人审签名空起不代填**·同 wizardSignoff 铁律）。

## studio 三件裁决（Lead）

- `AssetLibrary.tsx`（旧工作台跨游戏浏览器）：**A2 达到功能对等后退役**——退役时解耦白名单 3 条 studio
  祖父条款随之清账（一石二鸟）；对等前不动。
- `StudioInspector` 内嵌 AssetBrowser：**留**——它是「这局用了谁」的调试透视，语义不同不重叠。
- `ArtLedgerPanel`：**留并被消费**——治理动作层，A4 调它的端点不重复实现。

## 顺序与派工

A1（低档施工·守卫正确性我亲验·先行）→ owner 过目 A2 骨架截图后 → A2（PST 域）→ A3 ∥ A4。
每翼 Lead 对抗性验收；A2 起真浏览器截图必查。

## 红线

台账/索引外无第二真相；来源不可考只许如实标 unknown-legacy 不许编造；人审不代签；棘轮只紧不松；
git 历史即备份——浏览器一切「删除」只是台账行状态变更+文件走 git rm 留痕，无影子回收站。
