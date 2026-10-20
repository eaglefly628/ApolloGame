# E2 外部动作与 AnimGraph3D

分段锁 28e384aa2（2026-10-20）。现有 2D Frame/anim-state 及整体 Anim3D 不能表达骨骼 clip 的独立绑定/混合；本段实现 owner 已批准的 E2。T5 离线工具已独立复查，真实 ARP/Mixamo/Tripo 仍待来源依赖。本段用已实际导出/播放的离线 GLB 验证运行时，不替换生产绑骨路线，不启动 Blender。

## 数据入口

`AssetIndex` 仍用 `type:"animation"`，新骨骼语义的 spec 四项全必填：`{skeleton:"apollo-humanoid-v1",fps,frames,loop}`。fps 为1..120整数、frames 为2..36001整数（包含端点）、loop为布尔。仅这些已声明骨骼语义的条目桥接新物理描述符 `SkeletalAnimationDescriptor{kind:"skeletal-animation",key,src,skeleton,fps,frames,loop}`；旧无 skeleton 的 animation 条目保持原有行为，不偷换现有2D atlas `AnimationDescriptor`。

资产层只取自包含 GLB 字节，不引 three；复用 AssetManager/R4 分组装载、进度、引用/驱逐，不另建网络加载器、不在每帧 load 建常驻 pin。动作 GLB 恰一个 clip、实际时间轴/样本/有限值与声明一致；引用必须严格命中 clip 名。外部骨架与模型模板的名称、祖先、rest 及 inverse-bind 必须相容，不能只信 profile 标签。这里“一套动作绑两个不同模型”指不同网格但同 bind/rest 骨架；跨体型/骨架的重定向仍在 T5。

```json
{"type":"AnimGraph3D","clips":{"idle":{"asset":"motion/idle","clip":"idle"},"walk":{"asset":"motion/walk","clip":"walk"},"run":{"asset":"motion/run","clip":"run","speed":1}},"states":{"locomotion":{"blend":{"param":"move","points":[{"at":0,"clip":"idle"},{"at":0.05,"clip":"walk"},{"at":0.15,"clip":"run"}]}},"rest":{"clip":"idle"}},"transitions":[{"from":"locomotion","to":"rest","whenParam":"paused","cmp":"eq","value":true,"fade":0.2},{"from":"rest","to":"locomotion","whenParam":"paused","cmp":"eq","value":false,"fade":0.2}],"params":{"move":"speed","paused":"flag:paused"}}
```

闭集形状沿路线图：clips 的 asset 可省（模型内 clip）；speed 默认1、有限0..16，loop覆盖可省（外部取描述符loop，内置默认true）。states 每项只能是 `{clip:<alias>}` 或 `{blend:{param,points:[{at,clip:<alias>}]}}`。clips/states/params 各1..64项，transitions 0..256项，blend points 2..64项且at严格递增、有限，blend param须来源speed；未知字段、坏引用、非有限值装载拒收。

参数源仅 speed / flag:<语义id> / state:<fsmId>：speed读本实体Velocity平面长度，单位沿用world单位/tick；其余复用现全局 IdLookup 的首份语义id规则。缺失来源是undefined，转换不成立，绝不把缺失flag当false。cmp为eq/ne/gt/gte/lt/lte，布尔/字符串只允许eq/ne。参数与图配置只读，运行状态在renderer私有表，不写世界。

## 固定执行语义

首个声明的 state 为初态；每帧按 transitions 数组顺序取第一条成立规则，最多转一次，from/to必须是真实状态名，不引自由表达式或通配符。fade为有限非负秒数（上限60），0为立即切换。1D blend夹到两端，区间仅相邻两个clip有线性权重，权重和为1。

淡变使用“当前已混合权重快照 → 新状态目标权重”的固定线性包络；中断从当时权重继续，不堆叠无限过渡链。目标blend可随本帧参数变化。动作骨骼采样/插值仍由原生three AnimationMixer完成，不把逐帧动画自研进sim。不要同时每帧setEffectiveWeight又调用原生fadeIn，否则three会停止自己的淡变。

每实体独立 Mixer/Action/Bone/Skeleton，外部源clip不原地改写；重绑只面向唯一命名骨骼与TRS通道，不能用外部track改模型根/材质/世界。动画正权重且时间推进、淡变未完、本帧最后姿态变化均能使画面/阴影失效一次；停播后收敛，不因零权重循环永久重绘。缺资源/坏骨架有一次性拒收诊断，不默默播首clip。

保留旧 `AnimState3D` 的实际语义（含原fallback、0.25秒淡变及同名只改loop不会重设的现状）。同实体两者同时声明时旧组件优先，图跳过并WARN一次；不同实体可分别使用。图移除/切换模型/被驱逐/销毁时释放其Action与绑定，迟到异步结果不得回填下一代。动作原始场景不挂主scene，解析时产生的geometry/material/texture/skeleton也必须释放。

`AnimGraph3D` 为render-only，加入NON_DETERMINISTIC；世界只提供参数输入，不从动作帧产生玩法事件或回写sim。验证要比较完整sim长序列hash，而非仅新增组件的初始排除测试。

## 验证范围

格式/闭集/参数/淡变/1D边界与中断、异步驱逐、独立骨架、legacy回归均需定向测试和撤修验红。真实CPU/GPU证据须走 AssetIndex→AssetManager→ModelPool→ThreeRenderer，至少两种不同网格与同模型两个实例，实际关节/蒙皮顶点/截图/阴影变化、暂停及最后帧、动作迟到与卸载重载、数千帧循环和资源有界/释放。现T5单独GLTFLoader+Mixer报告仅是输入证据，不能替代E2接线验收。

所有本段数据夹具明确自产；真实付费来源绑定另记待补。未知图/资产输入应明确拒收，不能静默降级为错误动作，不能改原已结案流程门或签真人门。

数值混合参数缺失时不猜零速：该状态从未见过有效数值则所有权重为 0（绑定姿势）；见过则保持该状态最后一次有效目标权重。缓存按状态有界，过渡仍从当前权重快照淡入。缺失参数只告警一次，稳定的缺失输入不强制重绘。
