# R2 确定性贴地行走契约

> REQ-AIFLOW-GROUND，owner 已判 A。接续 E5；施工锁 c33954665。此文是实现接口，不是复查判词。

## 实查与范围

实查 `capability-registry.ts`、3D 与 movement-pathfinding 手册：motion-apply 只积分平面 Transform；ground-sense 只读 2D Overlap；3D resolver 只解 XZ；表现物理 heightfield 不进 hash，不能作为 sim 高度来源。复用 E5 最终 GLB 的 SHA 已验证目录、静态三角、现有导航与碰撞，不引入游戏 system 或表现回调写 sim。

## 作者数据与派生数据

- `SceneImport3D{modelKey,rules:"default",ground?:{source:"navigation"|"collision"}}`：显式 ground 才启用新展开；未配置保留 E5 行为。navigation 用 nav_* 的实际三角；collision 显式选 col_* 闭合凸体的上表面。坡度上限固定 45°；不把墙/背面当可走面。
- `GroundWalker3D{surfaceId,maxStepUpQ?,maxStepDownQ?}`：角色选择展开后的场景实体；默认单次升阶 2500Q、降阶 5000Q。Q=10000/米，均为非负安全整数。角色需要平面 Transform 和非 trigger 的竖直 sphere/capsule/box Collider3D；不支持动态 hull、表现刚体/路径/层级驱动的位置冲突。
- 引擎烘焙 `GroundSurface3D{originXQ,originZQ,cellSizeQ,cols,rows,triangles,supportIds,offsets,indices}`：triangles 每9项是一个世界 XYZ 三角（整数Q），每三角 supportIds 是匹配的静态碰撞实体 id 数组；格桶只缩小候选，不把地形压成一个格中心高度。默认格边5000Q。上限4096三角、65536格、262144桶引用，超限拒收，绝不静默裁掉。
- 引擎生成 `GroundContact3D{surfaceId,heightQ,triangleId,acceptedXQ,acceptedZQ,acceptedHeightQ,acceptedTriangleId,supported,rejected?}`：最后接受位置属于世界状态，随快照/hash恢复；pre候选与最终接受点分开，防碰撞推开失败时回退进墙。rejected是本拍pre拒移标记，由final停速后清除。无模块级角色状态。初始无支撑明确拒收移动并停速；不暗加重力或传送到远处地面。

## 显式传送（REQ-GROUND-TELEPORT·owner 判 A）

- 任何对 walker Transform 的跳变写入仍按「上次接受点 → 当前点」整段行走验收，跨洞/越高台即回滚——这是防穿墙的本意，不放宽。要合法地瞬移/复活/过传送门，给 walker 自身挂一次性意图 `GroundTeleport3D{x,y}`（平面 Transform 米坐标，与 `Transform.x/y` 同口径）。
- `ground-teleport-3d`（Input 相位·显式 runsBefore `ground-init-3d`·consumes 该意图）：目标点（加 Collider offset）在 walker 自己的 surface 上 `sampleGroundSurface` 有支撑 → 写 `Transform.x/y=目标`、`baseY=支撑高`、整份覆盖 `GroundContact3D`（accepted=目标·supported·rejected=false）；之后同拍 motion 从目标点起走。无支撑/越界/非有限/超坐标预算/非 walker → 整体拒收：本系统零写入、意图照常消费、trace `reject`。不吸附最近点、不改 Velocity、不换 surface。
- 初始无支撑而冻在出生点的 walker 可被传送救回。Update 及以后相位新挂的意图在下一拍 Input 生效（确定性一拍延迟·挂起意图随快照/hash）。装载期允许作者直接写该意图（首拍生效），字段闭集 `{x,y}`、须同实体有 `GroundWalker3D`，否则原子拒收。

## 采样与通行

坐标按 E5 的 Math.round(x*10000) 量化并归一 -0；格索引用 floor，出界不 clamp。三角覆盖与重心高度使用临时 BigInt，向上取整为Q；世界只存JSON整数，不存BigInt。台阶各保留自己的平面分片，不跨台阶双线性插值。稳定三角序与上一三角优先解决共边平局。正面积重叠而高度不同的表面拒收，多层桥下桥上不在本轮平面导航契约内。

移动沿实际线段检查三角覆盖和高度转换，不能只验终点跨过洞或高台。计算预算超限拒收并留 trace；不得用有限间隔采样冒称完整覆盖。拒绝时回到上次接受XZ/高度并停速；初次无有效接受点保持原地、标记无支撑。过高/过低阶、洞和出界同样处理。合规高低地面可正常行走，不将步高限制误用于整段缓坡总爬升。

## 相位、碰撞与表现

两次采样：pre在Update中显式排在motion和其意图生产者之后、overlap-detect-3d之前，更新本拍脚高，拒移时先回退XZ；此阶段不写Velocity，停速放final。final在本能力局部phase21，晚于Commit20的bounds等位置修正。旧3D detector相位不改，以保留无Walker世界的prefab新生反馈时机。申报真实读写、显式同桶顺序，不靠拓扑软环的字典序回退；组合测试必须读告警并验证定序。

首次支撑由Input(-20)的ground-init取得，防首拍motion先跨洞再把终点当出生点；Update/Commit新生成的角色在该能力下一个执行点按真实出生位置初始化。最后接受坐标、高度、三角保存在GroundContact中，pre候选不会覆盖最终回退锚点。新增相位成员点名登记；既有SCC基线不扩大。

坡面只免除本拍接受三角匹配的支撑实体、且方向匹配其可走上表面的接触（统一support→walker，ny>0且与采样上法线dot≥0.999）。每轮NGS重新判，不永久删除整对。该实体侧面、天花、其他墙与动态体照常阻挡；不得跳过整类 col 或所有带向上分量的法线。

登低阶另有显式立面规则：有垂直接触面的移动意图，脚底中心到角色足迹前缘的完整线段连续可走，终点升高为正且不超过步高，且终点三角真实支撑ID就是接触障碍时，可跨该低阶立面。朝向立面用maxStepUpQ；背离立面用maxStepDownQ验证反向连接，避免中心下阶后后帽被水平推远。以此避免胶囊前帽在中心跨边前被台阶挡死；不豁免水平同高侧壁、天花、洞后的台阶或超过步高的墙。此轮只证明量化后脚底中心路径受支撑，不声称整个胶囊底面均被地面覆盖。

渲染单向读取 sim 脚高：规范化脚底 pivot 的 Model3D 根位于 baseY；中心 pivot 的 Mesh3D 加实际缩放后的竖直半尺寸。ground walker 采用 sim Transform，拒绝冲突的 Transform3D/表现物理等驱动，不由渲染回写。未启用 walker 的旧渲染位置不变；同步前后世界 hash 一致。

导航复用现有 NavigationGrid/Profile/NavGraph；从相同表面覆盖和可跨高度边界保守烘焙 blocked，保留洞/陡坡/高台边隔离。不能把两个有高度的格子直接连通，也不能将支撑坡体投影成整块障碍。

## 验收

无key离线测试：坡道往返、合法/过高阶跃、负坐标、洞与越界、大步跨洞、步高与缓坡区分、支撑坡体与墙分别响应、碰撞推开后同拍脚高、初始/新生/缺源拒收、定序零新WARN、双世界逐tick hash、snapshot+order恢复、trace开关不改hash、表现同步不改hash。真实 Blender 起伏场景导出 → E5实际字节验证 → 装载展开 → Engine回放 → Chrome目击；自产夹具不冒称付费Tripo样本。
