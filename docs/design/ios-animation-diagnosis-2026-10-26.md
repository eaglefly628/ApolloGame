# iOS 试玩动画阶梯 / 闪烁 · 只读实证（2026-10-26）

用户实际试玩game108原生iOS模拟器后反馈：卡牌/页面动画不连续、启动闪烁、疑似帧率低；随后要求换幸存者比较。查仓库确认幸存者为 **game-103**；game101是海港绯闻。源码与原生包固定`bb477f902`，不含之后施工的RenderBinding3D。

## 已确认：游戏动画与DOM更新确实存在问题

| 实证 | 最小复现 / 文件锚点 | 结果 |
|---|---|---|
| 卡牌位移量化 | game108启动后开始对局，逐rAF读key-rock的盒子；`games/game108/duel-screen.ts` 884–894将380ms进度量化到0.1 | 桌面真实Chrome在开始后500ms的30帧中仅8个几何状态；宽205→244→283→302→322→341→361→380，y754→634→514→454→394→334→274→214 |
| 震屏反复重启内部CSS动画 | 蓄力rock→出paper使对手掉血；`duel-screen.ts` 1796–1799修改根layout，`src/ui/components/server.ts` 151–168对layout/props变化使用outerHTML | 约100ms内duel-screen替换7次，每次含160后代；lane的260ms apollo-pop对应出现7次animationstart |
| 不是所有“跳帧”都等于低rAF | 相同Chrome390×844、DPR2，运行两真实产品Web载荷并统计rAF | 两者rAF中位/p95约16.7ms；game108约10秒839次outerHTML（两手各254、phase-ring177），game-103约9.5秒10次HUD替换 |

第二轮只跑game108补抓真实出拳：615次outerHTML、两手各111、根7。根替换时刻5786.7/5801.9/5818.6/5835.5/5852.1/5868.8/5885.1ms；lane animationstart对应5800.5至5900.8ms。探针在组件加载前包装outerHTML setter并记录真实节点/animationstart/rAF；不是用源码计数推定浏览器行为。初轮投拳selector误写，未形成投拳样本；第二轮已纠正为实际throw.paper并保留两次原始结果。

## 尚不能下的结论

- 桌面Chromium的16.7ms不是iOS WKWebView的实测帧率；没有给实体iPhone性能下结论，也没有把“换了模拟器”当成修复。
- 启动闪烁未定位。只知道启动条20档、完成时替换启动面板一次，不足以归因；仍需iOS启动录屏 / 原生帧时分析。
- game-103的FX_SHEETS里fps:3/4并非实际3/4fps；`anim-state.ts`114–118每tick累计elapsed，达到该值换一帧，所以60TPS下是20/15fps序列帧。不能把像素特效的有意分帧等同引擎掉帧。
- mountHost使用一次transform:scale并在resize更新，不是这里实证的逐帧重排原因；不据此全局改缩放机制。

## 归属与修复验收

通用DOM/动画实例连续性归PUI（REQ-PUI-ANIM-CONTINUITY）；卡牌0.1几何量化与逐帧SVG皮肤更换归game108维护方（REQ-108-ANIM-CONTINUITY）。本次只读定位，不代修、不判修复PASS。

PUI验收应钉住：同类型/同id节点仅布局或可变props更新时，子节点与活动animation对象不因无关父级震屏重建；交互handler不重复、父锚点与结构替换仍正确。建议就地更新可变属性，但不指定重造UI框架。game108验收应真采样卡片/手轨迹，去掉不必要几何量化，并验证原设计外观与时序。

现有Label.tween只支持数字/字号，不足以直接承载任意手/卡片轨迹，不把“改用现成Tween”写成已验证的万能解法。修复方仍须带唯一锚点撤修验红、真实浏览器/原生对照和完整相关门禁。

证据根`/Users/junbaili/.codex/visualizations/2026/10/16/01a1423a-1952-7952-a2c0-8ae2faac621b/ios-games-20261026`：两份apollo-ios-animation-probe*.mjs及JSON（实际数据较大，不内嵌）；run-summary.json记录原生包运行范围。所有独立Chrome/本地服务已关闭，源文件与产品载荷未被探针修改。
