---
name: aiflow-split
description: 从已定稿关键图制定 D1 拆层单，选择 Tripo、Blender 搭建或二维切图，生成标注图并把真人确认的消费槽需求推导到美术台账。用于关键图拆资产，不代替资产生成、绑骨或人门签字。
---

# 关键图拆层（D1）

权威：`docs/workflow/ai-production-flow.md` §3、`docs/playbooks/art-pipeline.md`。工作区与脚本约定见 `docs/design/ai-pipeline/asset-split.md`。

## 看图时决定什么

先看 `docs/design/<slug>/keyart/<scene>.png` 及 K2 补视角，确认这是 owner 定稿版本；没有定稿证据先交人确认。按可独立替换、复用、运动或遮挡的视觉对象拆分，保留构图中的尺度、光向、前后层与接触关系，避免把整幅图拆成无消费用途的碎片。

| 图中对象 / 制作约束 | route | 去向与提示词要求 |
|---|---|---|
| 可独立复用的三维道具，如水壶、树、椅子；轮廓或表面细节不适合基础体搭建 | `generate` | 给 Tripo。描述完整主体、材质、尺度、朝向，refs 附裁切或补视角；被遮挡部分不臆造为定稿，先补参考。 |
| 规则空间、地面、墙体、台阶、重复建筑模块；需精确尺寸与拼接关系 | `build` | 给 Blender 搭建。prompt 写尺寸、轴向、相邻关系与材质要求；有机装饰物另拆到 Tripo。 |
| 固定视角二维背景、前景遮挡、透明贴层或图标，参考图已包含可用像素 | `build` | 二维切图 / 拼层。prompt 明写“2D 切图”、透明边缘、遮挡补洞与叠放关系，不送 Tripo；bbox 是原图裁区依据。需重新生成缺失像素时另用 `generate`，prompt 明写“2D 图生图”。 |
| 需要骨骼与动作的三维角色 | `character` | 先补 T-Pose 前后左右四视图，再交人物线 Tripo → 规范化 → 绑骨 → 动作；当前单只登记需求，不声称已完成人物链。二维角色仍按切图或二维生成处理。 |

路线不确定、消费槽未落实或遮挡信息不足时保留 `proposed`，向 owner 说明待决定点。不得为凑全批准而擅改路线或关键图。

## 输出纯数据

写 `docs/design/<slug>/asset-split.json`，顶层数组，每行只用以下字段：

```json
[
  {
    "id": "hall-kettle",
    "scene": "hall",
    "bbox": [120, 240, 180, 220],
    "route": "generate",
    "skinKey": "example/props/kettle",
    "prompt": "独立三维旧铜水壶，保留左侧暖光与右向壶嘴，完整把手，落地轴心；交 Tripo。",
    "refs": ["keyart/hall.png"],
    "state": "proposed"
  }
]
```

示例 skinKey 只是形状示意，使用前换成项目中真实消费的槽。逐行查 manifest `art:` / skinMap / Sprite / 背景装载点，向人确认清单附上“skinKey → 文件与消费位置”证据；schema 没有证据字段，不另塞自由字段。无真实槽先报告缺口，不把假 key 当已接线。任何缺 `skinKey` 行都会被脚本拒收，包括 `proposed` 行。

`id` 唯一且稳定；scene 对应 `keyart/<scene>.png`。bbox 是该原图左上原点的整数像素 `[x,y,w,h]`，宽高大于零且不越图界。refs 是相对 `docs/design/<slug>/` 的本地文件路径，文件必须存在，禁远程 URL 和目录外路径。prompt 写清主体、特征、颜色、视角与制作目标，不能只有裸名词。

## 标图、确认、入账

```bash
node scripts/asset-split.mjs <slug>
```

正常路径纯离线：脚本绘制 `keyart/<scene>-split.png`，框上编号对应生成的 `asset-split.md` 标号；框色为 generate=黄、build=青、character=粉。标注框用于确认范围与路线，脚本本身不切图、不调用 Tripo/Blender。相同输入重复生成的标注 PNG 应一致。

测试可用 `node scripts/asset-split.mjs <slug> --root <fixtureRoot> --mock`。mock 只写 `keyart/mock/<scene>-split.png`，缺主图时明确记录降级并合成 mock 预览；不写真实 `art-ledger.json`、不写 `asset-split.md`、不改 state，也不能作为定稿依据。refs 仍须存在：若引用缺失主图会拒收；不需要额外参考时可用空 refs 测试降级。

先展示关键图、标注图、逐行路线和消费槽证据。只有收到真人逐项确认后，才按确认范围记录 `state: "approved"` 并重跑；agent 不代 owner 签 D1，不通过 mock 自动批准。只有 approved 且有 skinKey 的行进入对应 `artRoot` 的 `art-ledger.json`，proposed 会被跳过并输出日志；由 `mergeLedger` 保持旧编号与历史。拆层 approved 表示需求确认，不等于资产质量 approved：生成、接线与美术人审仍走原管线。
