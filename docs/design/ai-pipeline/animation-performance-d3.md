# D3 固定步进表演层合同（v1）

此层叠加在既有 AnimationDriver3D 或 LocomotionDriver3D 的基础姿态上；不接管基础时钟、移动或 IK。核心文件为 `src/engine/animation/performance-driver.ts`，协议与真实嵌套 schema 位于 `src/engine/protocol/components/animation-performance.ts`。

## 数据与接口

- `AnimationPerformance3D`：version=1、tickRate、clips、slots、montages。clip 声明实际选中 GLB 的 SHA256、准确 clipName、required `retarget:'exact'|'humanoid'`、durationTicks 与有来源身份的 notify 时间；不以 FBX 原件 SHA 代替实际 GLB SHA。
- slot 指定唯一 order、override/additive、逐个枚举的骨名与整数 weightQ（0..1000000）。mask 不隐式包含子树，不允许通配符。additive 必须声明参考 clip 与 atTick。实际缺骨、参考姿态和资产身份由原生绑定层拒收；协议声明不是资源已核的证明。
- montage 有优先级、入/出淡变和有序 sections；每段明确 clip 的起止 tick 与 once/hold。最多一个 hold；hold 循环整段，release 才进入下一段。段走完后按 blendOut 返回基础层。
- `createAnimationPerformance(config, actorId)`；`stepAnimationPerformance(config, playback, {commands?})` 返回新 Playback；`projectAnimationPerformance` 返回只读采样 layers。
- Command 是 version=1 的 commands 信封。seq 严增；play、release、cancel、pause、resume、preview-seek 均是闭集数据。陈旧 seq 先验证结构/引用再忽略，不认证历史 payload。

## 时间、混合与事件

命令先于时钟，每调用推进一个 host tick。新 play 的本地游标为0，命令步不推进该槽；下一次正推进触发段起点一次。pause/resume 命令步不推进动画时钟、不发 notify；paused 仍消费 seq/host tick。preview-seek 不发 notify/section，也不重放被越过的 cue；rollback 是恢复原快照，再确定性重演相同事件。

notify 使用 `(old,new]`；进入段的起点单独触发一次。hold 终点属于旧 cycle，随后起点属于新 cycle。不同段复用同一源时间点时，按不同 sectionIndex 分别触发，**不跨段去重**。事件 ID 包含 actorId、slot、montage、instance、sectionIndex、cycle、源 tick 与 cueId；世界接线必须核对 actorId 等于实际实体 ID。外部 cue 路由只使用已提交快照，不从 renderer 回传事件。

高/同优先级替换建立新 instance，并保留旧源的冻结姿态；旧源不再触发 cue。一个槽至多 incoming/outgoing 两个采样；交叉淡变中再次 play 明确 blocked/transition-busy，不静默丢源。低优先级 blocked/priority。零 blendIn 直接切换。cancel 将两源当前权重同比例淡出；零 blendOut 立即清槽。

投影先按 slot.order（override 在 additive 前）输出。**同槽两源先合成一个姿态，再以权重总和对基础骨骼应用一次遮罩 alpha**；不能把两个 override 顺序 slerp。slot 权重和不超该槽上限；不同槽与基础/additive 不做全局归一。additive 以显式参考姿态差值叠加，最终 IK 属于后续阶段。

## 边界与拒收

最多64个 clip、8个槽、64个 montage、每montage32段、每clip64个 notify、每步64个命令、1024个事件。tick/instance/seq/cycle 有明确整数预算；溢出整步拒收，输入和旧快照不改。配置身份使用 canonical 完整内容及共享 FNV 摘要，不能只凭32位摘要。

所有 protocol/config/snapshot/step 输入禁止未知字段、getter、隐藏 serializer、符号、NaN、循环与共享对象引用。快照包含配置身份、actor、完整段游标/循环/实例、淡变起点、outgoing 源、命令序号及当前事件，可 JSON 往返。

本批是上述闭集蒙太奇合同，不是任意连锁 montage 或完整 Unreal 系统；最多两源是明确预算。骨骼/参考姿态实际绑定、原生分层播放、浏览器效果及真实素材质量须分别验收，纯 core 测试不能代签。

`exact` 必须完整 TRS 且源/目标 rest 严格相容；`humanoid` 显式使用跨 Skin M1。不得根据缺少字段自动猜测，不支持的非 Hips 动态平移/缩放由原生绑定拒收，不静默丢通道。参考 clip 也适用相同必填策略。
