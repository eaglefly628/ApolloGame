# Light3D 既有方向归一化契约修复

REQ-3D-LIGHT-DIRECTION，分段锁a47bd5d63，2026-10-21。`render.ts`已承诺directional/spot的dir由renderer归一化。本次只兑现现有契约，不增加组件字段、capability、游戏代码或渲染算法。

## 原反例与接线

真实LightRig/native shadow camera先证实：方向`(-6,-5,0)/sqrt(61)`到主灯距离3.2，场景中心NDC.z=-.44144；同方向乘8后距离25.6、NDC.z=3.59459，中心出阴影视锥。投影矩阵与有效光照方向未变，阴影位置却变了。Chrome实机另证实主灯unit有48179个深度占用采样，8倍后为0；主灯、额外directional、spot的极小/极大有限方向还会在原生归一化或target加法时退化。

三路共用LightRig私有方向处理：先按各自既有规则填齐缺省分量；只对有限非零向量，除以最大绝对分量后再用hypot求单位向量。主灯继续取反作为位置方向，额外directional继续在反向100单位处，spot继续以位置加方向为target。只改变向量长度，不改变去向、强度、预算、颜色或point/ambient行为。复用three原生光照、阴影视锥和GPU实现。

## 兼容与诊断

- 完全没有Light3D时，原默认暖主光/冷补光、位置及矩阵逐值保留，不把历史默认向量也归一化。
- 显式directional未填dir仍沿原`(-.78,-.62,-.5)`方向；作为显式Light3D按既有契约归一化，因此主灯到中心距离变成3.2×radius。这是修复涉及的兼容变化。
- 只有部分分量时，先填原缺省，再归一化；不是把缺失分量置零。
- 零或含NaN/Infinity的方向跳过归一化并保留原数值与原生行为。它们不是有效方向，本次不新增拒收或回退政策。
- 无法归一化时，每个已处理灯的当前无效值状态只WARN一次；恢复有效、移除、无Light、场景切换或dispose清理记录。相同灯不断变更无效值时只存当前一条，不积攒历史值。

## 验法与边界

CPU用实际LightRig、THREE ShadowCamera/Frustum/WebGLLights测三路，含MIN子正规数、近MAX有限数、partial/default、无Light精确矩阵、无效值旧行为和双World两万次纯读。真实浏览器脚本：

```sh
node scripts/verify-light-direction-browser.mjs
# --case main|extra|spot|legacy；--legacy-reference <旧版report.json>逐字段核无Light原行为
```

浏览器三路分别建renderer，unit/8倍/1e-300/1e300比较原生方向uniform、灯朝向、阴影视图/投影/裁剪、原生PCF深度和实际像素。额外directional原本不投影，观测它的方向与光照像素，不伪造阴影。观察不替换shader、renderer输出或测试阈值；销毁在forceContextLoss之前检查原生资源释放，World快照/hash/writeSequence/dirty不变。旧源保留为独立副本，不覆盖施工现场。

spot只改方向/角度/penumbra的跳渲签名疑点尚未取得主renderer反例，不混修。灯世界坐标本身极大导致单位target加法不可表示，也不属于本次方向向量归一化承诺。付费来源、生产美术质量和真人R1仍未验收。
