# M6 · 原生 IK 动作烘焙配方

实现入口 `scripts/motion-compose.mjs`；`motion-library compose` 由主入口接线。仅本机离线；不需要 Blender。人工先预览基础动作、目标 Skin、道具与轨迹，再按同一配方 SHA 明确提交已审预览回执。输出始终 `draft`，不会自动确认语义或动作质量。

```sh
node scripts/motion-compose.mjs --recipe /absolute/recipe.json --lib ~/ApolloAssets/motion-lib
# 上一步只产生候选 GLB 和 evidence，返回 recipeSha。人工看过同配方预览后：
node scripts/motion-compose.mjs --recipe /absolute/recipe.json --lib ~/ApolloAssets/motion-lib --reviewed-preview-sha <recipeSha>
```

可调用接口：`composeMotion({recipe, lib, reviewedPreviewSha?})`；返回 `{ok, published, recipeSha, candidate, evidence, verification, entry?}`。无回执 `published:false`，不改目录；回执不匹配直接拒收。回执是明确的人工确认输入，工具不声称自己完成了视觉验收。已存在动作 id 或目标文件拒绝覆盖；基础动作、Skin、配方和原目录均不就地修改。

## 闭集配方示例

```json
{
  "version": 1, "id": "reach-adjusted", "base": "reach-out", "skin": "y-bot",
  "fps": 30, "durationS": 1,
  "anchors": [{
    "id": "grip", "kind": "prop",
    "attach": {"parentId": "actor", "bone": "LeftHand", "offset": [0.03, 0, 0], "rot": [0, 0, 0]},
    "trajectory": [{"at": 0, "position": [0.03, 0, 0]}, {"at": 1, "position": [0.08, 0, 0]}]
  }],
  "ik": {"chains": [{
    "kind": "two-bone", "root": "RightUpperArm", "mid": "RightLowerArm", "end": "RightHand",
    "target": {"entity": "grip", "offset": [0, 0, 0.03]}, "pole": [0, -1, -1],
    "weight": {"param": "contact", "fade": 0.15}
  }]},
  "params": {"contact": {"flag": "touch"}}, "flags": {"touch": false},
  "cues": [{"at": 0.2, "kind": "flag", "name": "touch", "value": true}, {"at": 0.8, "kind": "flag", "name": "touch", "value": false}],
  "annotations": {"category": "gesture", "emotion": ["neutral"], "intensity": 1, "contacts": ["right-hand"], "descZh": "双手靠近道具的待审动作", "descEn": "Draft hands approaching a prop", "tags": ["reach", "prop"]}
}
```

- `version/id/base/skin/fps/durationS/anchors/ik/params/flags/cues/annotations` 全部必填；未知字段拒收。`base`、`skin` 必须真实存在目录且字节 SHA 一致。`id` 为新的小写稳定 id。
- `fps` 整数 1..120；`durationS` ≤300 秒，必须正好落在采样帧且不超过基础动作长度；不隐式循环或拉伸时间。每帧所有骨骼 TRS 总分量最多 1400 万，仍须通过现有引擎 GLB 字节/样本预算。
- `anchors` 最多64个。`kind` 只接受 `point|prop`，两者都是 CPU 锚物件，不输出道具几何。普通锚必填 `position/rot`；骨骼锚改用 `attach`，不能同时写普通位置。挂点只允许 `parentId:'actor'`，实际骨名必须唯一存在。
- 可选 `trajectory` 为2..2048个严格递增秒制关键帧，首尾覆盖 `[0,durationS]`。`position` 必填；可选 `rot` 为 XYZ 弧度。普通锚写世界位置；附着锚写 `Attach3D.offset` 的骨局部位置。位置线性插值，旋转使用原生 Quaternion slerp。所有位置、偏移、旋转和 pole 分量限 ±1000。
- `params` 值为布尔/0..1数字或 `{flag:<已声明flag>}`；`flags` 为布尔初值。`cues` 最多2048个，按秒递增（同时间不同字段允许）；`kind` 为 `flag|parameter`。参数 cue 只能改直接参数，flag cue 经原生动作图参数读取传给 IK。每个采样点先消费 `at≤当前时间` 的 cue；初帧 dt=0，后续 dt=1/fps；淡变完全由原生 InverseKinematics 实现。
- `ik` 直接走原生 `validateIK3D`、`InverseKinematics`（双骨/看向均可）。目标可指已声明锚或 `actor`，骨骼目标只允许 `actor` 的实际骨。原生拒收状态立即失败；所有约束必须至少激活一次，整体必须实际改变姿态，否则拒收无效配方。自追逐依赖（例如右手追自己握住的道具）明确拒收。
- `annotations` 复用 M2 七个闭集标签/描述字段；新条目 `derivedFrom` 为基础动作 id，`provenance` 保存配方 SHA、基础动作 SHA、Skin SHA 和回执。配方 SHA 对完整纯 JSON 按对象键排序计算，数组顺序不变。

## 运行与证据

一份 esbuild CPU 包拥有同一 THREE、AnimationMixer、原生挂点管理器、目标解析器、原生 IK 和引擎骨架校验。基础动作先以 `retarget:'humanoid'` 绑定目标 Skin；每帧按原生顺序恢复上帧 IK、采样动画、刷新挂点、运行 IK、再次刷新挂点，采集所有骨骼局部 TRS。

输出仅保留目标 Skin 的变换层级和原逆绑定矩阵，加工具新建的三顶点验证载体。不会导出来源角色网格、材质、贴图或原二进制。输出为一个标准骨架、单 clip、均匀 LINEAR 采样的 GLB；通过现有 `snapshotSkeletalGlb/extractSkeletalClip` 校验，再重新播放逐帧比较全部关节世界位置/旋转（误差上限各 1e-5 米/弧度）。

候选在 `<lib>/.compose/<id>/<recipeSha>/candidate.glb`，证据包含完整配方、来源 SHA、候选 SHA 和逐帧最大偏差。只有带匹配回执才向 `clips/<id>.glb` 发布并更新目录，使用 M2 同一入库锁；重复候选只接受完全相同字节。

## 边界

等价性只覆盖指定采样点；采样点之间由输出 LINEAR 曲线近似原生连续求解。不可达目标沿用原生最近可达结果，不能把“求解成功”当作“已接触”。不保证所有动作、所有体型或身体接触、碰撞、双人配合、道具穿插正确；必须预览。附着物只是求解辅助，不烘焙道具或火焰。

M1 的同一 T-pose/同朝向、髋部位移和旋转插值约束仍适用；不做 A-pose 归一化。实际 Mixamo 动作、真实 Skin、Blender 导入和人工视觉验收不由纯合成测试证明。
