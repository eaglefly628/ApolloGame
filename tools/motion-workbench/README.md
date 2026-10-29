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
