# 动画工作台与 AI Catalog

本机只读汇总，复用现有原生动作预览与实时 Socket/IK 预览。普通动作保留来源 Description、精确 ID/SHA、来源文字标签；派生说明是生成意图，基础文字不能证明新增行为。工作台不复制、覆盖或上传动作素材。

## 启动

```sh
node tools/motion-workbench/server.mjs \
  --lib /absolute/path/to/full-frame-library \
  --runtime-lib /absolute/path/to/socket-trial/review \
  --runtime-report /absolute/path/to/socket-trial/validation.json \
  --preview-report /absolute/path/to/socket-trial/preview-validation.json
```

只监听 `127.0.0.1`，打印工作台地址。`runtime-report` 为完整原始验证元数据；`preview-report` 为同一批次的独立精简预览数据（最多1MiB，保留原技术失败、逐角色状态、必要 Socket 链/道具/边界与 SHA）。缺掌骨角色只有带精确 embedded SHA 的基础播放；端点失败仍可作为带失败标记的候选查看，不能提升为可用素材。

同一端口的 `/library/` 提供原库预览，`?clip=<精确ID>` 直达动作；`/interaction/` 提供实时交互，`?skin=<精确ID>` 直达角色。两处都有返回工作台按钮，原独立入口保持兼容。

## AI 只读接口

- `/ai-catalog.json`：统一目录、源 catalog/report SHA 快照与故事补全提案。
- `/entries?text=warming&type=motion&offset=0&limit=50`：来源文字/标签查询，确定分页。不是向量或视觉匹配，不输出伪造置信度。
- `/story.json`：game628《最后的火柴》设计的需求与候选。未命中不证明库内缺失。
- `/summary.json`：类型/验证状态统计与快照身份。

目录类型：`motion`、`generated-motion`、`runtime-clip`、`runtime-profile`、`capability`。状态：`ready`（原资产已 confirmed，文字标签仍可为草稿）、`candidate`、`failed`、`unsupported`、`planned`。运行时端点通过最高为候选，不能当成抓握、手指、穿插、多人承重或故事验收通过。未绑定精确角色 SHA 的 profile 不可成为交互预览或适用角色。

当前可调用补全原型仅固定火柴/火柴盒模板；按压和通用伸手作为规划能力列出，不因为有相近 clip 就标成已实现。三组手指控制尚未实现。

故事提案区分原7项人物动作与按GDD拆出的道具/场景/转场。单次擦火柴表意确认绑定 v022/Claire，不能扩展为所有角色或新运行时姿态确认。烤鹅属于非人体场景制作；奶奶抱起/双人升空超出当前单人站定上肢模板。

## 验证

```sh
node node_modules/vitest/vitest.mjs run tools/motion-workbench tools/motion-preview/client.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tools/motion-workbench/tsconfig.json
```

## D6 本机导演台

`node tools/motion-workbench/driver-server.mjs --driver-scene /外部暂存根/review.json`

也可向原工作台命令追加 `--driver-scene`，挂载 `/driver/` 与首页入口；未提供该参数时保留原目录/Socket工作台行为。`server.mjs --driver-scene ...` 单参数模式只启动导演台。所有监听均为127.0.0.1；仅GET/HEAD，校验Host和回环remote地址，无上传/任意文件读取接口。

外部JSON采用 `{version:1,profiles:[{id,label,description,status:'numeric-candidate',manifest,program,assets:[{key,kind:'model'|'skeletal-animation',file,sha256,fps?,frames?,loop?}]}]}`。动作显式fps/frames/loop；model不带这些字段。文件路径仅相对该JSON目录，必须是独立regular GLB；拒绝越界realpath、末级symlink、多硬链接及仓库资产。预算：JSON4MiB，≤16profiles，每profile≤64assets，每GLB64MiB，总256MiB。使用既有Target/Skeletal GLB守卫拒绝外部URI，校验每个精确SHA及manifest资产引用/Root去根配对/D3源SHA。启动时捕获批准字节，HTTP只提供该不可变快照；原文件变化须重启服务，不能悄悄替换正在看的候选。

`/driver/profiles.json` 返回可读模板、program及规范AssetDescriptor本地白名单src，省略源file/SHA字段与绝对路径；组件中的声明SHA仍作为其原有身份数据。前端先加载资产，再`new Engine → parseManifest/load → CinematicPreviewSession.seek(0)`。唯一World推进者是该session；RAF仅使用既有FixedStepClock决定整场景步数，不启动Engine自身RAF。暂停继续只读renderSnapshot，允许资源解析完成；不运行FrameServices。角色切换重建Engine并清理旧renderer/assets；卸载或过期异步任务不提交新Engine。

控制全场景播放/暂停、单帧、复位及定位；观察已提交base/slots/weights/cues、root请求/接受及阻挡。原生动画状态读取renderer只读diagnostics，模型计数或sim游标不构成原生就绪；非兼容原因可展开查看。这里始终显示数值候选，不把技术可播放、原生就绪或模板声明当作视觉/接触/完整M3.5审核通过。真实素材及截图仅留外部本机目录，不进入Git。
