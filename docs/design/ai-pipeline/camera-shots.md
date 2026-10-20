# E6 剧情镜头表与信号切镜

分段锁90d165f1e（2026-10-21）。owner已在3D总单/R3判A：下沉render-only CameraShot3D镜头表、信号触发和缓动；不加sim system，不改游戏。实查 `CameraRig/CameraTween` 已有原生相机与世界eye/target，`Path3D`实际写Transform3D不能作为纯相机轨道，t1-tween只写Transform/Color，t3-timeline负责“何时发Signal”不负责相机；registry没有等价镜头表provider。复用现有相机/缓动，不自研渲染。

## 数据闭集

`CameraShot3D{shots:{<name>:{keyframes:[{at,eye:[x,y,z],target:[x,y,z],ease?}]}},onSignal:[{signal,shot}]}`。挂在Camera3D同实体，只解释getCamera3D既有语义选中的首个相机；其它相机的镜头表不抢控制权。装载检查所有表，无效整次原子拒收，单独manifest没有provider时也明确报错。组件仅表现，入NON_DETERMINISTIC；Signal仍是原sim组件，不能为通过hash测试排除Signal。

- shots为1..32个具名纯数据条目；每条1..64键、全表至多512键；名字/信号为非空≤256字符串。onSignal为1..64条，signal唯一、shot必须在本表存在，不支持自由表达式/路径或脚本。
- at为秒，首键0，后键严格递增、≤600。eye/target为有限三元组，坐标绝对值≤1e6米（明确可绘范围，防GPU Float32溢出）；每键eye≠target。裸type可省，未知字段/访问器/洞/非POD均拒。
- ease取现有linear/cubicOut/inOut，缺省linear，属于从该键到下一键的区间。最后键ease无额外作用。插值是相同ease下eye和target的世界空间线性插值，不承诺弧长速度。
- 投影/fov/orthoSize/near/far继续由本体Camera3D给出；拉近/推远用eye关键帧。初版没有镜头生成、输出完成Signal、自动改剧情状态或全身跟随绑定。

## 播放语义

无触发走原基础相机；没有自动播放。匹配实际Signal发布时硬切该shot首键，再按render壁钟播放，末键保持。相同实体/相同Signal payload再次发布也会重播；后发生的触发打断前者。同一绘制间隔多次发布归约为最后一个匹配决定，不积无限队列；丢弃前面的待切决定一次诊断。触发时间从首次绘制消费该决定开始，不声称亚帧或声音级同步。

CameraShot3D/相机移除、载体销毁/同id重建、World切换或restore都清旧决定/播放态；恢复出来的旧Signal仅作基线，不当新触发。镜头表内容变化作新配置，不把旧信号套到新表；动态在同一次catch-up中加表再发Signal也须捕获。没有观察源的自定义IWorld明确WARN并回基础相机，不伪称无漏。

中途eye/target插值重合时一次WARN、保最近有效取景，继续推进并可恢复；不让NaN进入原生相机。正在播时不叠加legacy tween，shake仍沿同一原生相机生效；无镜头时旧orbit/follow/ortho/tween路径不变。脏标含实际取景，硬切与最后帧都绘制，保持末键后收敛停绘。最终CameraRig.current仍统一用于post、raycast、反射、WorldUI和Diegetic。

## 可靠Signal接缝（既定E6触发的必要支持）

实查 `Engine.start` 一帧先跑所有catch-up tick，再renderer.sync一次；timeline下一tick销毁cue Signal，帧末轮询会漏。原Signal没有发布seq，按实体/payload去重会漏同值重播；TickObserver只有单槽且被Tracer/Recorder使用，不能占用或覆盖。net/Recorder/Replay亦可直驱World.tick，仅补Engine.step不够。

采用**被动、可取消、多订阅的通用组件观测**，不另造sim事件总线或历史仓库。World在原add/replace已完成写入/索引后通知匹配类型；remove（含consumes）/destroy/restore亦通知生命周期。数据通知为独立冻结快照，无活组件引用，监听异常不打断模拟，未订阅时不复制/分配通知。setObserver旧单槽与录制行为保留。相机适配器只保一个最新匹配决定；回调只更新表现私态，不执行镜头或写World。

观测元数据不进entities/snapshot/hash/delta，不额外touch/emit、写序号或排序相位。restore重置通知在原恢复完成后发出，不重新发其Signal。applyDelta沿原add/remove语义通知实际发布，不另改其模拟语义；CameraShot3D等值替换不应重复清合法播放态。取消最后监听释放所有订阅引用。通知自身不引DOM/three/时钟；所有表现时间都在相机控制器。

接缝API：World `observeComponents(types,listener):()=>void`，通用类型 `ComponentNotice` 为 `{kind:'add',entityId,component}` / `{kind:'remove',entityId,componentType}` / `{kind:'destroy',entityId}` / `{kind:'reset'}`。仅这条必要被动观测接线触及core，不能修改系统执行序、hash规则、网络命令或信号生产者。

## 验证义务

协议/装载闭集、引用/时间/预算与原子拒收；原生相机硬切/缓动/中断/重播/结束保持/移除回基础，最后帧脏标与静止不永久绘制；catch-up2..5tick、144Hz重复绘制、同系统同实体同payload多次add、发布即销毁/consumes、真实timeline快进多cue；Tracer/Recorder共存、异常监听隔离、冻结快照与取消、restore/World切换/同id重建不串镜头。双World长跑对照snapshot/full+incremental hash/writeSequence/dirty；真GPU画面与post/pick/WorldUI使用同一CameraRig.current、资源归零。另做唯一锚点撤修和独立复查，不以Mock或施工自陈结案。
