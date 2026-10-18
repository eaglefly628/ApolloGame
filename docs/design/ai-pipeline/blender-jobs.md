# Blender 无头作业桥（T7）

`node scripts/blender-job.mjs <job.json> [--mock] [--blender <executable>] [--timeout-ms <n>]`。
可执行文件取 CLI、`BLENDER_BIN` 或 PATH 中的 `blender`。生产固定同一 LTS 补丁版本；当前真实验收固定 Blender 4.5.14 LTS。程序缺失明确失败，不自动降级；`--mock` 才生成隔离模拟产物。所有工作在引擎外离线进行，不改 sim、不自动登记资产或签生产门。

T7 首阶段交付作业桥、建场景和预览链路；五个 op 的闭集入口是 `normalize`、`rig-arp`、`retarget-arp`、`build-scene`、`render-views`。前三个 op 的下游实现分别属于后续 T4/T5；当前实际执行须非零退出、不给成功记录或假模型。ARP 入口区分“插件未安装”和“已安装但 T5 执行器未就绪”，不以桥存在冒充绑骨已完成。

## 输入与证据

job 只接受四字段 `{op, inputs: string[], params: object, outputs: string[]}`，拒收额外字段。没有 Python 文本、表达式、shell 或自由执行器入口。

输入相对 job 所在目录解析（可读该目录以外的显式文件），必须真实存在。GLB 必须自包含，外部 buffer/图片先嵌入，避免漏记依赖或暗中联网。输出必须在 job 目录内；拒收出界/悬空链接、覆盖 job/输入、重叠输出及覆盖 `.blender-jobs` 证据目录。

输入字节、输入路径、job 纯数据和固定 bpy 执行器 SHA256 形成 jobHash；Blender 消费的是同一份输入快照。每次执行保存到 `.blender-jobs/<real|mock>/<jobHash>/run-000001/`（序号递增，日志不会被下一跑盖掉）：

- `job.py`：固定、可审的 bpy 作业脚本，可与 job 数据一并提交作审计产物。
- `payload.json` / `inputs/`：本次精确执行参数与输入快照。
- `job.log`：决策、Blender stdout/stderr、拒收或产物哈希。
- `stage/`：成功产物的原字节快照，后续重跑覆盖目标时仍能追溯。
- `result.json`：只在成功时生成，含输入/输出哈希、快照及实际发布路径。

真实作业先写空 staging；子进程成功且所有本次产物有效后发布，旧文件不会冒充这次成功。mock 全部产物落证据目录的 `out/`，绝不覆盖 job 所指真实路径；报告带 `mock:true`，不能作为 Blender、T4/T5 或资产人审通过的证据。stdout 仅一个结果 JSON，日志走 stderr；失败 exit1。超时为1..3600000毫秒，默认120000。

## build-scene

`inputs[0]` 为 D1 `asset-split.json`，其余输入为已存在的 GLB 道具。`outputs` 恰好一个 `.glb`。

```json
{
  "op": "build-scene",
  "inputs": ["asset-split.json", "models/kettle.glb"],
  "params": {
    "scene": "courtyard",
    "objects": [
      {"splitId":"floor","name":"col_floor","source":{"primitive":"box","size":[6,0.2,5]},"position":[0,-0.1,0],"rotation":[0,0,0],"scale":1,"color":[0.3,0.4,0.2,1]},
      {"splitId":"kettle","name":"pick_kettle","source":{"input":1},"position":[1,0,0],"rotation":[0,0,0],"scale":1},
      {"name":"spawn_hero","source":{"primitive":"empty"},"position":[0,0,1],"rotation":[0,0,0],"scale":1}
    ]
  },
  "outputs": ["out/courtyard.glb"]
}
```

示例要求 D1 中 floor 是该 scene 的 approved/build 行，kettle 是 approved/generate 或 character 行；skinKey/refs 等仍按拆层 schema 校验。approved 行必须有对象消费；proposed 行不生成、引用它会拒收。build 路线消费显式图元，generate/character 路线消费输入模型。仅 `spawn_*` 的 empty 标记可以没有 splitId。每个 name 唯一，稳定保留 E5 的 `col_*`、`nav_*`、`pick_*`、`spawn_*` 名称。

source 二选一：`{primitive,size?}` 或 `{input}`（从1开始引用模型输入）。primitive 闭集 box / plane / empty；box 三个尺寸均正，plane 是 XZ 地面，size=[正宽,0,正深]，empty 不带 size。模型保留输入材质，不能用 color 覆盖。

位置/尺寸使用引擎/glTF 的 Y-up、米制；rotation 是 Three XYZ 欧拉弧度；scale 为正数。固定解释器转换到 Blender Z-up，导出恢复 glTF Y-up。**不从二维 bbox 猜三维位置、深度或尺寸**；这些都必须由制作数据明确给出。图元只用于 D1 判作直接搭建的构件；真实主角/道具模型仍走生成、规范化及资产审核流程。

## render-views

一个自包含 GLB 输入；`views` 1..32个，每个对应一个 PNG 输出。

```json
{
  "op":"render-views",
  "inputs":["out/courtyard.glb"],
  "params":{"views":[{"id":"front","position":[0,3,8],"target":[0,1,0],"fov":45,"width":1000,"height":640}]},
  "outputs":["out/front.png"]
}
```

position/target 仍为 Y-up米制，fov 是度；width/height 为16..4096整数。机位须显式给出或来自已确认预设，不从参考图臆造。固定 Cycles CPU、种子、采样、线程、灯光及色彩管理；PNG 不写时间戳。只保证同版本、同运行环境、同 job 双跑字节一致，不声称跨 Blender/GPU/操作系统逐字节一致。Blender 预览不能替代 T6 的引擎截图或独立盲审结论。

## 验证

普通无 key/无网络环境：`npx vitest run scripts/blender-job.test.mjs`，使用显式 mock 与临时假可执行程序，检查作业协议及失败传播。

真实离线：`BLENDER_BIN=<固定LTS完整程序路径> node scripts/blender-job.integration.mjs`。双跑真实场景 GLB、双机位 PNG 比较哈希，校验四类 E5 节点，确认 T4/T5 未就绪不能成功。`BLENDER_KEEP_EVIDENCE=1` 可保留临时证据。没有 Blender 时此真实验收明确失败，不能当作已通过。

本机验证工具来自[官方4.5发行目录](https://download.blender.org/release/Blender4.5/)，4.5.14 macOS arm64 DMG SHA256=`65134d9b07b20e2fa8d3c9e44f6f44ffb5c9774dd521b95f50387310241ca170`。命令行和导出参数依据[4.5命令行文档](https://docs.blender.org/manual/en/4.5/advanced/command_line/arguments.html)、[4.5 glTF导出API](https://docs.blender.org/api/4.5/bpy.ops.export_scene.html)。程序可放临时工具目录，保留完整应用资源，不要求安装进系统目录。
