# Game112 分层二维角色动画交接

日期：2026-10-12。用户要求将已有二维分层动画流程固化为技能，让 Game112 开发会话继续接入。

## 可复用产物

技能：`.claude/skills/native-character/SKILL.md`（仓库维护源）；本机 Codex 发现镜像：`.agents/skills/native-character/SKILL.md`。调用 `$native-character`；镜像未出现在既有会话目录时直接读取仓库源文件即可，不依赖自动热加载。

共享端口在 `src/engine/host/native-character.ts`，六个端口测试在同目录。原生制作/播放器工程在 `tools/see-through-workbench/`；`engine-preview.ts` 演示 `mountHost` 与端口组合，供应商源码由 534 个 SHA 锁定。

已完成演示资产 `tools/see-through-workbench/public/art/swordswoman-generated-v2.stretch`：七张生成组件、十二个绘制部件、三个原生 warp、十个真实参数，idle/breeze/nod/showcase/controls 片段。它只是接缝与制作参考，不是雪团资产，不要替换游戏里的猫。人物最大 ±12° 头部倾斜、±70px 后发及 ±60px 披风仅对该模型有效。

原始图层、提示词与对齐记录在同名美术目录；验证报告在工作台 `evidence/`。临时 `workspace/` 制作脚本是忽略的会话产物，不作为可移植技能依赖。可用原生编辑器重新绑定和保存。

## Game112 的真实当前状态

`games/game112/cat-motion.ts` 使用 LayoutNode `Image.meshMotion` 对坐姿猫的局部毛发与尾尖做微动；`game112.ts` 使用 `mountUI`，不使用示例的 `mountHost.scene`。尚未在游戏中挂载原生分层播放器，也没有雪团 `.stretch`。

查阅点：`docs/playbooks/assets.md`、`docs/playbooks/rendering-fx.md`、`src/skills/tier2/index.ts`、`src/engine/host/native-character.ts`，以及 `src/ui`/`src/assembly` 的 native-character 搜索。结论：现有共享端口能控制模型，但没有对应 LayoutNode 控件，不能通过现有 Image 数据重组出嵌入播放器。Tier2 是确定性玩法与约束，浏览器播放器应留在表现层。

## 接续顺序

1. 读取 `2d-cat-production-pipeline.md`、`live2d-prototype.md` 和本技能，以当前雪团身份母图做待审分层稿。先完成呼吸、独立眨眼、耳朵与尾尖；保留脚掌接地点、脸部花纹和静态回退。审核前不登记 filled 或替换现有猫。
2. 将审核通过的 `.stretch` vendor 到 Game112 本地 animation 目录并登记本地 AssetIndex。索引与猫动作映射是数据；不要让游戏直接依赖工作台 art 索引。
3. 针对缺失的 UI 接缝，按 CLAUDE 的裁决协议由 owner 选择：A 在 UI 基座扩通用分层角色控件，复用现有端口（推荐，供多游戏复用；PUI 域施工）；B 申请 Game112 特例宿主挂载（需明确例外，重复布局与生命周期维护）。此前对共享宿主端口的 A 授权不自动视为此次 UI 扩展裁决。本轮只固化技能，没有新增控件或该特例代码。
4. 同源部署工作台运行时，验证目标路径的 chunk/字体加载，携带 upstream 许可。播放、暂停、参数和卸载统一通过端口；加载失败继续显示猫原图。
5. 在实际 Game112 猫位做缩放、遮挡、点击、互动状态和进出房间验收。用独立复查和真实游戏截图/录屏证明接入，再更新生产方案的状态。

本交接不修改 Game112 在途代码，不提交/推送，不发送消息到其他会话。用户可把下面一句发给 Game112 会话：

> 请使用 `$native-character`，读取 `.claude/skills/native-character/SKILL.md` 和 `docs/design/game112/native-character-handoff.md`，继续将分层二维角色动画用于 Game112。先复用既有原生端口与雪团母图，完成猫模型待审样片；UI 消费接缝按交接中的 A/B 流程处理，保留现有静态猫与互动。
