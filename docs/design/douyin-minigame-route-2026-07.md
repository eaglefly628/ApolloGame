# 抖音小游戏导出技术路线（调研档·2026-07·Lead 合成）

> owner 问「引擎导出抖音小游戏的技术路线」→ 双路调研（平台约束外查 + 引擎可移植性内查）合成。
> **⚖ 决策（owner 2026-07 拍板）：主航道=Steam（零引擎改造·无版号门槛·工具链已在仓）；抖音路线不做、本档收存**——
> 将来想吃国内小游戏流量时照此档评估，不必重新调研。候选游戏仅 101/102/103（a/b/c 姨太线按 A-006 大陆不可发）。
> ⚠ 外查报告的官方文档均未逐字通读（网络代理拦截 developer.open-douyin.com 等），关键数字上线前须人工核实。

## 一、平台硬约束（高置信度精华）

1. **无 DOM/BOM**：JS VM 只有 `tt.*` API，无 window/document/CSS；全程**只有一块上屏 canvas**（`tt.createCanvas` 首调），
   「canvas 游戏 + DOM 覆盖 UI」的分层模型不存在；小游戏**无 webview**（小程序才有，且规则堵死游戏类目内嵌——路线 C 不可依赖）。
2. 输入=`tt.onTouchStart/Move/End/Cancel` 回调（无 pointer 合成、无事件冒泡）；音频=`tt.getAudioContext`；存储=`tt.setStorage`（~10MB）。
3. **主包 ≤4MB**（分包后·总包 20/30MB·分包上限两处官方口径矛盾待核）；CDN 资源域名须 HTTPS+**ICP 备案**白名单。
4. **禁 eval/new Function**（运行时不支持+审核红线·2022 起驳回 JS 解释器热更包）——我们的 DSL 必须保持解释执行形态（现状即是·勿引入表达式编译）。
5. iOS 逻辑层 JavaScriptCore **无 JIT**——热循环按解释执行做性能预算；iOS 内存是头号杀手（中文字体 >10MB·音频实例 ~20MB·建议 ASTC 纹理）。
6. 合规栈：主体可能须企业/个体工商户（个人存疑·矛盾来源）；**软著硬前置**（电子版 ~10 天）；IAP→版号、纯广告 IAA→作品备案
   （执法有收紧案例·非安全承诺）；ICP 备案；防沉迷实名强制接入。分成数字为 2024 版（IAP 一般档 ~60%）·以后台当期为准。

## 二、三条路线与判定

| 路线 | 模式 | 判定 |
|---|---|---|
| A 商业引擎导出（Cocos/Laya） | 引擎方自带 adapter+分包工具链 | 回驳——等于放弃自研引擎宪法 |
| **B adapter+canvas 自绘** | 薄 adapter 骗过渲染库 + UI 换 canvas 后端 | **唯一可行路**·社区大规模验证（微信官方 minigame-canvas-engine=「声明式数据→自绘」标准答案·3000+ 游戏在用） |
| C 小程序 webview 装 H5 | — | 规则堵死（类目一致性+不收单一游戏小程序+兜底罚则） |

**社区共识判据**：UI 是否已表达成数据。是→换渲染后端（代价可控）；否→重写 UI 层。
**我们恰好在"是"的一侧**：LayoutNode 纯数据+38 控件闭集+action 信号——缺的是一个 **canvas 渲染后端**，不是 DOM 模拟。
CLAUDE.md「禁手写 React 屏/自由 DOM」铁律在此从代码规范升格为平台可行性前提。

## 三、引擎可移植性判定（内查精华）

- **低成本**：sim 核零 DOM；运行环纯时序；2D CanvasRenderer 的 DOM 面仅 init 15 行（绘制全是 17 个标准 canvas API）；
  输入/音频/存档/资产有 Port 抽象（但 8+ 游戏裸调 localStorage 等绕过点须逐个清理·game-103 仅 2 处）。
- **主成本**：UI 解释器 `render.ts`+`server.ts` ≈1866 行须整台重写为 canvas 版（数据侧零改）；
  `layout-solver.ts`（120 行平台无关布局核·为此而写·现零消费者）是已付款未验证的地基；移植契约档 `apollo-ui-porting-contract.md` 在档但控件数已过期（28→38）。
- **砍掉项**：3D 线（three-renderer 深度 DOM 依赖+CSS3DRenderer 无 canvas 等价·社区 adapter 均个人维护）；Video/Float/Connector/speechSynthesis。
- **候选排序**：game-103 最佳（2D+7 平凡控件+纯 capability 蓝图）＞102（多 three 支线+Float/LevelPath）＞101 最差（无渲染器·100% UI 游戏·canvas UI 不完工一行跑不起来）。

## 四、若将来启动：最小可行路线

- **阶段 0 探针（人日级）**：最小 tt 入口（canvas+fillRect+touch 打点）——先证伪平台推断（rAF/API 面/包体限额/个人主体）。
- **阶段 1 sim+2D 跑通**：CanvasRenderer 注入分支 ~15 行 + mountHost 重写 ~90 行 + touch→pointer 桥 ~60 行 + 资产/存档 adapter ~45 行
  → 产物=能玩没 HUD 的 game-103（真正的续投判断点）。
- **阶段 2 canvas UI 后端**：激活 layout-solver → 按 game-103 的 7 控件切最小闭包（勿一次铺 38）→ 矩形命中→action 信号（游戏侧零改）
  → 验收床=game-i 控件画廊。字体改 tt.loadFont 外部加载（584KB base64 必拆）。

## 五、与 Steam 对比（决策依据存档）

Steam：$100/款（可赚回）·无版号/软著/备案/防沉迷·个人主体可·HTML UI 在 Electron 原样跑=**零引擎改造**·
steam-publisher 工具链+mac CI 已在仓·a/b/c 成人线合规（成人分级+年龄门）。抖音：上表全套摩擦+1866 行重写。
**故主航道 Steam；抖音=档案态**，重启条件=国内流量诉求明确 + 阶段 0 探针证伪通过 + 主体/资质就绪。

## 六、重启前须人工核实的空白

个人主体可否上架（矛盾）；分包上限（矛盾）；three 社区 adapter 对抖音（非头条小程序）的实测支持度与活跃度；
体验版人数额度；2026 现值分成与 iOS 虚拟支付状态；备案时限数字。核实方式=大陆网络环境直开官方后台与文档原文。
