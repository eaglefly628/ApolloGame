# E3 骨骼挂点 Attach3D

分段锁 `d15dcef60`（2026-10-21）；依赖 E2（施工2240c493b、独立复查dd0374031）。本段实现 owner 已批准的 E3，不改游戏、不签人门，不启动 Blender。

## 实查与数据入口

已实查 registry 的 `a2-hierarchy`、`hierarchy-resolve/cascade`、3D手册及 `three/pivot.ts`：现有 Hierarchy 从父 Transform 算子 Transform（sim），Pivot3D 合成整体变换，均读不到表现层正在采样的骨骼；重组不能表达“动画手骨的最终世界矩阵”。本单沿已裁 A 的路线图 E3 下沉 render-only 数据解释器，不把骨骼反写 sim。

`Attach3D{parentId,bone,offset:[x,y,z],rot:[x,y,z]}`：parentId 是父实体真实id，父显示模型为 Model3D；bone 是精确骨骼名（实际 THREE.Bone），offset 是骨骼局部米制偏移，rot 是局部 XYZ 欧拉弧度。四字段必填，字符串非空且有界，三元组必须有限，未知字段拒收。type 在裸蓝图可省，世界中仍为 Attach3D。

挂件消费已有 Model3D/Mesh3D 与普通2D-in-3D可绘对象；Mesh3D 走现有单对象路径，保留材质/描边/透明/体素/骰面，避免为挂点另起一条几何/材质路线。不改实例化数据协议。Attach3D 只提供表现变换，不赋予不可绘实体模型，不改变独立 VFX/物理系统的模拟输入。

## 固定语义

- 动画（legacy 或 E2 图）推进后，先更新父模型矩阵，再读取命名骨骼最终矩阵；挂件世界变换为 `boneWorld * T(offset) * R_XYZ(rot) * S(挂件原有渲染缩放)`。挂件原 world 位置/旋转由挂点替代，原渲染缩放（含 Model3D.scale）保留，继承父骨骼缩放。完整矩阵交 three，不通过分解再合成丢失非均匀缩放下的剪切。
- 不重挂 three 层级；模型/材质/骨架仍由原池持有，子物件不会混进父物件的资源遍历。挂点移除恢复原数据位姿；模型替换、驱逐、销毁没有悬挂引用。挂点本身不申请资产加载/pin。
- 父实体被销毁、不可见、模型未就绪时挂件隐藏（一次性明确诊断），以后父就绪可恢复；不从上代模型缓存假装父还存在。父实体模型有了但骨骼不存在或同名骨骼不唯一时，WARN一次、回退父模型根，offset/rot仍适用。
- 允许父模型本身也是挂件，按依赖先父后子计算；数据装载拒收已知自环/环。直接World等绕过装载的坏图运行时一次WARN并隐藏涉环挂件，不递归爆栈。缺父可以是动态生成/装载迟到，装载时不因此拒收。
- 只对实际画面变化产生脏标；参数-only变更、最后一帧、隐藏/恢复也刷新画面/阴影/拾取。摄像机取景和拾取使用挂接后的世界位姿，隐藏挂件不能留下可拾取旧位置。
- 世界组件/snapshot/writeSequence/dirty不改，Attach3D进 NON_DETERMINISTIC。无该组件时原路径与资源语义不变。拒收/降级用console分级且不每帧刷屏；缓存按当前实体/实例有界。

## 验证

纯CPU真实Bone/Mixer采样与单/多层挂点、局部offset/rot/缩放、非均匀父矩阵、缺骨根fallback、缺父/迟到/驱逐与恢复、图移除/旧model切换、环/坏数据、有限输出和10k帧有界；每个关键修复在临时副本唯一锚点撤修验红。

浏览器复用已有T5自产GLB，走正式AssetIndex/AssetManager/ModelPool/ThreeRenderer与E2动作，实际关节与挂件矩阵、真实GPU像素/阴影/拾取，双世界长hash一致，卸载重载与销毁资源有界。来源仍generic-blender-fixture，ARP/Mixamo/Tripo false；测试道具不冒称生产资产或真实人工动作质量验收。独立复查人复跑后才可结案。
