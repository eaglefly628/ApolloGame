---
name: native-character
description: 制作、验证和接入 ApolloGame 的分层二维角色动画（Live2D 风格），使用现有 Stretchy Studio 原生网格、参数及 .stretch 资源；适用于 Game112 猫角色和其他角色立绘。不是 Cubism 模型导入、序列帧生成或 Tier2 sim 系统。
---

# 分层二维角色动画

这是资产制作与表现层接入技能。游戏提供角色、资产 key、动作与参数数据；原生播放器负责网格、遮挡和动画。沿用 `src/engine/host/native-character.ts`，不要复制播放器到游戏或把异步浏览器操作注册进 Tier1/2/3 sim capability。

## 入口与当前边界

- 项目工作先遵循 `CLAUDE.md`；资产登记遵循 `docs/playbooks/assets.md` 与 `resource-manager` 技能。
- 引擎端：`mountNativeCharacter`、`NativeCharacterPort.loadAsset/command/destroy`；运行时示例：`tools/see-through-workbench/engine-preview.ts`。
- 制作工具：`tools/see-through-workbench/`；保留 vendor 原生源码，以 `upstream-files.json` 核对。不是 Live2D Cubism SDK，不能宣称兼容 `.moc3`。
- 已验证样例：`tools/see-through-workbench/public/art/swordswoman-generated-v2.stretch`。样例有十参数、循环片段及固定领口的原生 warp；猫角色须重新绘图与标定，不能照搬人物数值。
- Game112 请求读取 `docs/design/game112/native-character-handoff.md`。共享宿主端口已存在；Game112 的 LayoutNode `Image` 目前没有 `.stretch` 播放字段，不能假定改一个 src 就能播放。

## 制作与绑定

有审核通过的 PSD/透明层时复用；单图需要分层时尊重用户选择，可用 See-through 离线推理，也可用图像生成技能按母图逐层生成并补齐遮挡后区域。参考生成不保证像素级还原。生成工具不可用时报告缺失，不用程序绘图冒充已生成图层。

保存原始 PNG、参考图来源、生成提示词、尺寸/alpha/哈希和对齐数据。画布或局部尺寸不一致时在原生网格中对齐，不凭文件名假定已对齐。保证颈根、肢根、尾根有正确遮挡；扩大运动范围时固定连接点并实测极值，避免增加可见矩形补片。

在原生编辑器中制作 `.stretch`：图层顺序、parent、mesh、warpDeformer、animation、parameter 都走原生数据。参数须有真实绑定，声明 min/max/default；如需手动滑块，提供没有循环轨道覆盖的 controls 片段。X/Y 网格位移不是新的侧面视角；未制作独立口型、眼球、步态、转身时如实标记。

## 接入契约

审核后的资源放在 `public/games/<game>/art/animation/`，登记该游戏的本地 AssetIndex：`type: animation`、`status: filled`、`spec.format: stretch`、稳定 id、站点路径、真实来源与许可。生成候选先待审，不凭技能调用自动批准入戏。

宿主调用现有端口：`mountNativeCharacter(container, { runtimeUrl })` → `await port.loadAsset(index, key, baseUrl)` → `port.command({ type: 'play', clipId, loop: true })`。参数命令为 `{ type: 'parameters', values: { 参数id: 数值 } }`；卸载调用 `destroy()`，加载失败保留静态猫图。

runtimeUrl 必须与宿主同源，且指向已构建的工作台入口；端口会设置 `mode=player`。开发机器的 5183 地址不是发行路径。发行需要同源部署工作台构建资源及许可文件；在目标路径验证 Vite base 与所有 chunk/字体请求，不照搬根路径产物到子目录。

sim 只输出表现态或动作 key，不保存 DOM、PNG、参数播放器状态或墙钟进快照。LayoutNode 消费端缺失时先查 registry/手册并按项目 A/B 规则提出通用控件接缝；不得在游戏层手写 iframe/CSS 绕过 UI 基座。已有宿主端口不等于已有 UI 控件。

## 验证与交付

- 解包 `.stretch` 的 `project.json`，调用 `tools/see-through-workbench/project-validation.mjs` 的 `validateNativeProject`；确认贴图文件存在。
- `npm test --prefix tools/see-through-workbench`：结构负例与原生源码哈希；`npx vitest run src/engine/host/native-character.test.ts`：端口契约。
- 实测默认、单参数两端、组合极值、循环首尾、透明遮挡、播放/暂停、失败回退和卸载。原生与引擎捕获同一时刻画面对比，检查浏览器错误。示例审计脚本为 `audit-generated.mjs <asset-name>`（读取工作台索引，不直接用于游戏本地索引）；新角色按实际动作和帧时刻调整审核期望。
- Game112 还要验证 1×/0.75×/0.5× 猫位、足部接地点、遮挡、房间切换及原有点击交互；走路或转身必须有对应资产，不能靠拉伸或无遮挡镜像伪造。

交付本地资源索引、原生模型、参数/动作清单、目标游戏的实际目击证据。区分“制作完成”“共享端口可用”“目标游戏已使用”，不以演示页冒充游戏验收。
