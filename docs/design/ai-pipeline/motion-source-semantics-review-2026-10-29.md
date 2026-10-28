# M2 / M3 阶段复查：来源分类草稿与全目录预览

施工主体：Codex。最终独立复查：Claude，未签结论。owner 已授权上传阶段代码；真实数据仍只在本机。

## 本批解决的问题

旧预览每组三个动作，类别沿用旧默认值，不能直观浏览完整目录，也无法分辨某个标签是来源文字还是推测。本批复用 LayoutNode VirtualList、Engine、ThreeRenderer 与 AnimGraph3D：完整目录滚动、稳定全库序号、按 ID 选择一个动作，在两个 Skin 上对照；可搜索来源 Description、标题、标签和 ID。行为分组为多标签投影，分组数相加可能超过总数。选择不重置目录滚动，暂停/同动作筛选不重建播放器；加载失败保留错误并允许同动作重试。

## 共享来源契约

入口 `scripts/lib/motion-semantics.mjs`（类型声明 `.d.mts`）。`sourceSemantics(row)` 输出 `version=1`、basis、原 Description、groups、claims、unknownFacets、warnings、`status=draft`。每条 claim 有闭集 facet/value、显示名、原文 quote、start/end 字符索引、source 与 `status=source-derived`。字典版本 `source-description-v1` 单独由模块/索引保存。

Description 优先用 `source.description`；兼容旧目录时只接受带精确 source title 和固定后缀的来源说明封装，不能把自由生成的 descEn 当原始说明。明确行为优先；只有说明缺行为、无否定/受方警告时，标题可补 action，并明确记录 source=title。说明缺失时显示标题降级。原 catalog 的分类、情绪与批准状态不参与自动推断。

闭集覆盖行为、运动项目、施受角色、姿态、身体部位、方向、道具提及及明确情绪/风格。接触、起止姿态、阶段等缺证据就保持未知；无情绪不填 neutral；两帧且标题明确 Pose 的条目单列静态姿势，其上下文不当成移动动作。道具提及不代表握持/必需道具/接触已证实。否定、受击、闪避对方攻击、球类射门、俯卧撑、翻书页、walking stick 与局部肩部滚动有反例测试。

**这是一份确定性文字匹配草稿，不是通用自然语言理解器。** 复杂主体归属、隐喻、时序/并列与隐含接触仍可能漏标或误标；规则覆盖率不等于准确率。完整标签审核、人工修订持久化、标签级批准与 M4 消费升级不在本批实现内，M2 不结案。

## 只读工具与本地验证

```sh
node scripts/motion-classify.mjs --lib ~/ApolloAssets/motion-lib-full-frames
node scripts/motion-classify.mjs --lib ~/ApolloAssets/motion-lib-full-frames --json
node scripts/motion-preview.mjs --lib ~/ApolloAssets/motion-lib-full-frames
```

分类工具只输出 stdout，不写目录或改 catalog。JSON 索引包含字典版本、目录精确字节 SHA、每条动作 ID、GLB/源 FBX SHA、原素材状态与独立草稿标注。若重定向 JSON，只能落到本机资产目录；逐动作输出不能进 Git。预览启动后使用终端给出的本机地址。

本机真实目录读取成功，完整原始说明可恢复，个别说明缺失会显式降级；不上传真实目录、逐动作分类、模型、纹理、截图/视频或本机证据。项目测试只用合成文字与合成目录。

## 复跑与撤修验红导航

```sh
node node_modules/vitest/vitest.mjs run scripts/motion-semantics.test.mjs scripts/motion-classify.test.mjs tools/motion-preview scripts/motion-preview.test.mjs
node node_modules/typescript/bin/tsc -p tools/motion-preview/tsconfig.json
node tools/ui-audit.mjs tools/audits/motion-preview.audit.ts --w 676 --h 900
node tools/ui-audit.mjs tools/audits/motion-preview.audit.ts --w 1280 --h 900
node tools/ui-audit.mjs tools/audits/motion-preview-daylight.audit.ts --w 676 --h 900
node tools/ui-audit.mjs tools/audits/motion-preview-daylight.audit.ts --w 1280 --h 900
node scripts/scoped-gate.mjs --run
```

UI 审计按环境设置已有的 UI_AUDIT_CHROMIUM。亮暗审计均使用合成 2445 行，不依赖真实素材。

请复查人独立运行，再在隔离副本撤修验红，断言确实命中锚点：移除 staticPose 的 action→poseContext 转换，应让静态姿势反例转红；把列表行名重新加随 selectedId 变化的标记，应让真实 mountUI 500 项滚动保持测试转红；移除 failed 时 playbackKey 失效，应让同动作重试测试转红；破坏 CLI approval 不变/只读行为应触发 CLI 证据测试。恢复后再跑绿。不要修改冻结转换器或真实母版。

本批内部独立复核实证发现并修复了语义反例、目录滚动丢失和失败重试；这不是 Claude 最终复查，也不是 2445×108 的视觉验收。真实宽窄窗口和最终门禁结果在施工回报中交代。

## 施工方验证记录（非独立签字）

- 联合针对性回归 7 文件、64 项通过；预览工具 tsc 通过。内部独立复核额外重跑语义反例、失败重试及真实 mountUI 的 2445 行滚动反例。
- 真实本机浏览器：目录显示全量；搜索可区分同名动作；选择 Female 180 Turn 的 ID 与说明一致；两个 Skin 可播放；暂停可用；360 像素窗口的 document 宽度等于 viewport，无横向溢出；默认与 daylight 均真渲染。
- 676/1280 × 默认/亮色四次 UI 审计退出 0，重叠、硬性低对比、边框前提缺失均为 0。审计提示没有华丽件及 house 主题未命中为非阻断启发式：该工具没有卡牌、选关或庆祝场景；实际使用 apolloOnyx/apolloBrocade house 主题，并以主题正文色改善亮色控件可读性，不另写皮肤。
- 初次全量门禁有三个环境失败：未配置本机浏览器路径，以及 macOS /var→/private/var 临时路径导致既有 CLI 主入口判断未执行。在测试进程环境设置 `RENDER_PROBE_CHROMIUM` 为已有浏览器、`TMPDIR=/private/tmp` 后，三个原测试均通过；未修改或跳过原测试。
- 依赖链接 node_modules 是本机既有未跟踪链接。仅在门禁进程设置 core.excludesFile 忽略该链接，不改仓库忽略配置，不提交链接。

全量测试阶段实测：700 个测试文件、7746 项通过，2 项按既有配置跳过；本批不新增跳过项。最终完整门禁 scope=full 退出 0，eslint、depcruise、tsc、全量测试、build 和文档/预算守卫通过。已读存量告警：大 bundle 警告、game-a/game-c 美术文件缺失 WARN（门禁允许退出 2）；不把存量告警描述为零问题。
