# 既有天空与环境反射的资源生命周期修复

分段锁f5cf0b166，REQ-3D-ENV-LIFECYCLE。来自V1离线整链真实Chrome反例；修复已有Sky3D/Room/HDRI所有权，不改变组件协议、sim、游戏规则或three渲染算法。V1固定直光数据与独立复查另存，不因本修复改写历史失败证据。

## 已复现问题

- env=0销毁后GPU计数可归零，但天空独占渐变map收到两次dispose：renderer显式释放一次，disposeMesh又按已有所有权释放一次。
- env=.6销毁后仍有1texture、1native buffer。PMREM返回的output RenderTarget仅被保存为texture，释放texture不代替释放RT；RoomEnvironment.dispose只释放几何/材质，不派发临时InstancedMesh对象dispose，因此instanceMatrix另漏一个原生buffer。
- HDRI替换/失败还需明确旧结果和临时eq/generator的拥有者，不能将字段置空就当资源已释放。实机另证实贴图晚到时环境UUID已换、parse/PMREM完成，但main-scene draw次数未增且renderSig不变；因此实际环境UUID与强度也须进入既有跳渲签名，缓存命中静止继续skip。独立实证还发现env0只改clouds或cloudTint时map已换但主draw不增；将现有完整skySig纳入同一签名后，两原反例转绿，并覆盖remove/readd。

原始反例收据已持久保留在V1产物 `v1-construction-evidence-20261021/old-sky-failures/`，其中env0与env>0两路分列；完整原路径在V1 Review。源码链核对原生three RoomEnvironment、PMREMGenerator、WebGLTextures、WebGLObjects与WebGLGeometries，不把renderer.info.geometry=0当作buffer=0。

## 所有权

| 资源 | 责任 |
|---|---|
| 天空独占渐变map | disposeMesh释放，renderer不再重复显式dispose |
| Room PMREM output RT | renderer持有RT，scene.environment只借用其texture；替换/销毁释放RT |
| 临时Room实例矩阵 | 转换完成后对临时InstancedMesh调用原生dispose；Room仍负责去重释放共享geometry/material |
| 临时Room与PMREM generator | 明确finally清理已经暴露给调用方的对象 |
| HDR解析出的eq贴图 | 转换后finally释放；不与输出RT纹理混淆 |
| HDR output RT | 新结果成功后交换所有者，释放旧RT；坏输入回退亦释放不再持有的旧RT |

继续沿用three原生转换和有限缓存。Room与HDR各至多持有一个结果；缺资源时可回退Room，资源随后到达同key必须可以重试。同key新ArrayBuffer需要重新转换；同一坏输入只在状态变化时记录拒收，不能每帧刷屏，也不能永久负缓存阻断恢复。不做每帧大buffer哈希或修改公共资产协议。

## 实证边界

CPU使用实际原生对象事件验证释放分派，正常测试不依赖Chrome、Blender、API或网络。真实GPU另通过现有资产/渲染路线消费自产小HDR与Sky数据；覆盖env0改/删/重建、Room开关、HDR迟到/缓存命中/替换/失败回退、重复destroy。各关键修复在额外副本唯一锚点撤修，必须实际断言红、精确恢复绿。

原生buffer、texture、framebuffer、renderbuffer在forceContextLoss之前记录拥有者释放与有界平台；上下文销毁不能当缺失delete的补救。最终报告区分真正delete与单纯几何计数，日志按确切阶段读取。此处没有付费来源、人门或视觉质量通过声明。

上游PMREM在内部渲染抛异常且尚未返回output时，该RT仍在其局部状态；caller finally无法凭空取得它。未做对应故障注入和实测时，不声称任意GPU内部异常全清；本次修复承诺范围是已取得的output与已暴露临时资源所有权。
