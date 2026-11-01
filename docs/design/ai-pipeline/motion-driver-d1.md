# M3.5 D1 · 固定时钟与可恢复播放

施工主体：当前 Codex motion-semantics-next session；2026-11-01。D1 是[完整M3.5](motion-driver-m35.md)的首批实际实现，不等于完整 Locomotion、Montage、分层、Root Motion 或影视交互已完成。真实素材不进仓库。

## 实际接线

- 公共协议：`src/engine/protocol/components/animation-driver.ts`；纯步进与投影：`src/engine/animation/driver.ts`。
- 能力 `t2-animation-driver` 提供 AnimationDriver3D、AnimationDriverPlayback3D、AnimationDriverCommand3D。三者都是 sim:true，参与世界快照和hash；旧AnimGraph3D仍是render-only，原行为不改。
- 系统在Commit之后（phase21）固定推进，每次world tick恰一步；读取当前Flag/State/Velocity快照。全部角色先计算再提交，任一坏原始输入整批拒收，不半推进。
- ModelPool复用AssetManager、GLTFLoader、骨架绑定与M1重定向，按已提交快照的绝对clip时间/权重采样。模型或动作延迟到达时追上当前快照，不从0自走；重复render、暂停与回档不改变sim。
- 同步/异步manifest、SceneImport入口、直接Engine.load使用同源校验。新驱动需要同实体Model3D，不能同挂旧AnimState3D/AnimGraph3D；直接load缺能力或tickRate不匹配明确拒收，校验发生在meta/系统/实体更改之前。追加load或同load重复能力只安装新驱动一次；不改其他旧能力装载规则。

## 版本1闭集合同

AnimationDriver3D包含version=1、tickRate整数1..240、明确initialState、内嵌带type的旧AnimGraph3D，以及与graph.clips别名精确一致的clips时间表。每段指定durationTicks正整数、可选notifies[{id,atTick}]；每graph clip.loop必须明确布尔值，不能由异步资产缺省决定模拟行为。

本批状态只支持旧图已有的单clip/一维speed混合与条件淡变。speed仍是Velocity平面长度，单位world/tick，不冒称米/秒；使用共享确定性sqrt长度函数。clip speed精度为1000子tick、范围0..16；fade秒必须能按tickRate精确换为整数tick。非法引用、额外字段、非有限值、超预算、访问器/prototype/hooks等明确拒收。

运行态保存完整规范配置身份、tick/state/paused、每clip整数子tick/cycle/instance/started/completed、nextInstance、上一命令序号、权重与各state的历史混合目标、过渡起点权重/进度、当步events。规范配置全串精确比较；FNV仅诊断摘要，不以32位摘要充当唯一身份。World.version会在恢复时单调递增，因此绝不拿它恢复动画游标。

命令组件version=1，commands数组每项seq严格递增，op为play{state}/pause/resume/seek{tick}。系统先校验结构和引用，再跳过seq≤lastCommandSeq的陈旧项；不认证所有历史payload，新动作必须使用新seq。play即使同state也重新从0进入并取得新instance。play/seek当步不做条件跳转或时间推进；pause冻结动画游标而非世界tick。seek重建本动画时间并清空当步事件，不对作品做传送或伤害。

普通条件转换对源/目标共享且当前正权重的clip保持同一播放stream、游标和完成状态，避免假淡变时跳回开头；明确play仍重播所有目标clip。新D1拒绝from==to条件转换，重触发使用新seq play，旧E2不变。

正常step先处理命令、再最多一次条件转换、再推进固定时间；非loop到终点保持末姿并发一次complete，不隐式猜返回状态。D3将补明确完成条件/段落返回，这里不能把“到末帧”当作完整攻击树。

## 事件、采样与恢复

notify由已审核的时间表提供，不从Description推断接触；每别名标记最多64，单步总事件最多1024，超过预算整步原子拒收。区间为(old,new]；at0首次正向推进发一次，每次循环跨界再发一次；终点标记先于完成事件，循环at0归新cycle。输出按alias稳定顺序，每事件带instance/alias/cycle/notify身份。

事件只保存在本步Playback.events；D1不自动写Signal、造成伤害或触发特效。导演seek不补发事件；权威World快照恢复后重新tick会重演相同事件与hash，不能把rollback误当静音预览。后续路由需沿D3契约实现。

渲染只读取projectAnimationDriver输出的各alias绝对timeSeconds与weight，不读取新参数再算权重，不用performance.now推进D1。原生clip时长与durationTicks/tickRate核验，容差max(1e-6,1/tickRate)秒；不合则表现绑定拒收，不回写或自动改变sim时间。每次采样重新应用原生绑定，防止IK后同快照被Three的相同值优化跳过。每实例独立Mixer/Action，换模型、卸载、迟到解析、销毁均清理。

## 数据示例（自产测试资产占位）

```json
{
  "meta": {"tickRate": 30},
  "entities": {
    "actor": {
      "Model3D": {"modelKey": "model/probe"},
      "AnimationDriver3D": {
        "version": 1, "tickRate": 30, "initialState": "pose",
        "graph": {
          "type": "AnimGraph3D",
          "clips": {"move": {"asset": "motion/probe", "clip": "probe", "loop": false}},
          "states": {"pose": {"clip": "move"}},
          "params": {"speed": "speed"}, "transitions": []
        },
        "clips": {"move": {"durationTicks": 30, "notifies": [{"id": "contact", "atTick": 10}]}}
      }
    }
  }
}
```

来源动作必须真实存在且时长匹配；示例不是已提供的Mixamo动作或走跑演示。资产发现会收集graph里的animation key；未知key不能伪造候选。

## 验证与边界

- 核心45项、世界/载入16项、既有E2回归、原生绝对采样与实际GLTF模型池都有针对性测试。最终内部独立复核核对22个冻结文件SHA，在独立副本实际跑181项（18文件，含18项独立探针）；11处唯一锚点撤修红/恢复绿。两类重复安装缺陷、共享clip连续性、D1自转移拒收及确定性速度溢出均经实证。旧21文件/168项判词留作历史，不替代最终冻结签署。
- Chromium/WebGL脚本 `scripts/verify-animation-driver-browser.mjs` 从仓库外生成自产三角蒙皮模型和动画，走实际AssetIndex→Engine→ModelPool→ThreeRenderer，检查骨骼、GPU纹理、单角色seek像素差、重复渲染不写世界、暂停/重触发/JSON恢复、双实例和清理。截图/报告仅保存在脚本输出的本机临时目录。
- 本机GPU通过不等于真实Mixamo/108Skin或艺术质量通过。CPU/独立复核、真实GPU、完整门禁各自记录，不能互相代签。
- D1尚无参数驱动IK权重与新驱动的接线：现IK权重引用旧AnimGraph3D参数，和D1互斥；常数IK仍可用。D5须显式扩接口，不可声称Socket原型已经直接换成D1。
- D2二维混合/相位/真实移动跳跃、D3槽/分层/动作段与事件路由、D4根运动碰撞、D5影视交互、D6工作台/导演时间线仍按总纲推进。

2026-11-01最终冻结源码完整门禁：733个测试文件通过，8212项通过、2项跳过；类型、构建及守卫退出码0。已逐条读取告警：SKILL-SHAPE存量告警、game-a/art-03与game-c/art-017旧台账缺图、构建大包提醒；没有新增相位成环告警。两次施工中失败保留记录（确定性长度函数、相位基线和施工期间变动的源码），修复并冻结后完整重跑通过，不用之前失败运行代签。

最终源码GPU再次独立于全量门禁运行，74次渲染纯读检查、53次模拟hash比对、单角色seek像素差及暂停/恢复/清理通过；机器为Apple M5/ANGLE Metal/WebGL2。证据为本机 `/private/tmp/apollo-d1-browser-EWMkk2/report.json`，资产为自产三角蒙皮。此前非施工人另做GPU纹理576浮点读回、最大差0及撤修验红；仍不能据此签真实角色美术质量。

D1内部独立复核仅覆盖其明确冻结源码及撤修证据；最终提交供Claude按此边界复查，未取得外部复查签署前不写外部PASS。D2数学模块在隔离目录施工，不混入本批或借本批门禁称完整M3.5完成。
