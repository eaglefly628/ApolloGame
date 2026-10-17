# R1 关键图、UI 与动作比对工具

本工具覆盖路线图 T6 / U2 / U4 / R5；独立复查规程见 `.claude/skills/aiflow-blind-review/SKILL.md`。工具生成截图、指标与空白差异单骨架，不写复查 PASS，也不签人门。

## 入口与配置

```bash
node scripts/keyart-review.mjs <slug> <scene>
node scripts/keyart-review.mjs <slug> <scene> --mode ui
node scripts/keyart-review.mjs <slug> <scene> --root <fixtureRoot> --mock
node scripts/design-measure.mjs <slug>
```

配置位于 `docs/design/<slug>/keyart/<scene>.review.json`。顶层 mode 为 `scene` 或 `ui`，viewport 固定截图尺寸，presets 列出机位及绝对帧。缺省为 main 机位、第 60 帧与 1000×640 viewport。可选 entry 是相对仓根的本地 `.html` 入口，用于独立夹具或页面；省略则沿用 `?game=<slug>`。默认场景参考为 `keyart/<scene>.png`；每机位可用 reference 指向同设计目录下的其他 PNG。

```json
{
  "mode": "scene",
  "viewport": { "width": 1280, "height": 720 },
  "presets": [
    {
      "id": "front",
      "frame": 120,
      "frames": [120, 126, 132, 138],
      "camera": {
        "entity": "cam", "mode": "orbit",
        "yaw": 0, "pitch": 0.3, "distance": 8,
        "pivotX": 0, "pivotY": 1, "pivotZ": 0,
        "fov": 45, "projection": "perspective"
      },
      "actions": [{ "key": "Space" }],
      "reference": "keyart/hall.png"
    }
  ]
}
```

`frame` 为整数固定帧；可选 frames 是严格递增的绝对帧号数组，用于动作序列，不是相邻采集间隔；帧号范围 0–600，最多 120 项。actions 每机位最多 20 项，每项为 `{ "click": "选择器" }` 或 `{ "key": "Space" }`。2D 固定帧不必配置 camera；3D 相机字段均可选，mode 为 orbit / follow，projection 为 perspective / orthographic，正交机位可填 orthoSize。Camera3D 预设由 scripts 下的 Vite 采集插件在临时浏览器会话消费，不修改持久源码。

## UI 模式

mode 设为 ui，增加以下 ui 配置；reference 是相对 `docs/design/<slug>/` 的本地设计稿，通常在 `ui-refs/`。

```json
{
  "reference": "ui-refs/menu.dc.html",
  "canvas": { "width": 1280, "height": 720, "selector": "#design-canvas" },
  "items": [
    { "id": "start", "selector": "#start-button", "actualSelector": "[data-layout-id='start']" }
  ]
}
```

canvas 默认 1920×1080，selector 可省略；每项 selector 定位参考稿，actualSelector 可选，用于实际屏选择器不同的情况。UI reference HTML 实际渲染成参考图，图像与盒子测量来自同一次参考页面。设计稿与实际屏都用 U2 的同一个 `measurePage` 尺子，逐件输出 missing、位置、尺寸、bg 与 color 差。选择器、画布或屏状态不匹配须先核实，不能把选择器没命中直接解释为视觉缺陷。通用量稿入口 `design-measure.mjs <slug>` 支持多项目，原 game108 入口保留原行为。

## 工件与边界

真实采集落在 `docs/design/<slug>/self-check/`：

```text
shots/<scene>/<preset>-0060.png
shots/<scene>/<preset>-0060-compare.png
shots/<scene>/metrics.json
R1-keyart-review.md
```

截图文件名中的帧号补足四位，以上为第 60 帧示例。采集固定时钟与种子，对同机位重复截图比较字节；重复结果不一致时报错，不能据此宣称截图可复现。对比图并排呈现参考与实际；客观指标包含色调直方图距离和构图分区亮度，UI 模式附逐件差值。**指标只作参考，不作为通过阈值**，图像相近也不证明动作和交互正确。

frames 可输出同机位多张 PNG 作为 R5 动作证据，本波不要求 GIF；选帧应覆盖动作前、中、后和接触时刻，必要时补密集帧检查穿模、滑步与 IK 抖动。帧不足时记待补证，不凭静帧判定动作过关。

工具创建的 `R1-keyart-review.md` 只含待填检查骨架，不自动填写复查结论：重复场景保留已有复查章节，新场景仅追加新骨架。`--mock` 截图与指标写入 `self-check/mock/shots/<scene>/`，骨架写入 `self-check/mock/R1-keyart-review.md`，不会生成真实门工件，不能用于视觉复查或冒充在档 R1。

独立复查第一轮只给已定稿参考图与真实截图 / 帧序列，不读施工方 Review 单、自陈或指标分析。先固定盲判差异，再用指标定位；改施工后重截，改参考图须回 K2 由 owner 重新确认。
