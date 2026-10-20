# T4 模型规范化数据契约

复用T7闭集作业：`node scripts/model-normalize.mjs <job.json> [--mock] [--blender <path>] [--timeout-ms <n>]`。固定Blender 4.5 LTS；缺Blender明确失败并提示，不静默。真实Tripo API尚未配置，owner授权先用明确标记的离线夹具推进，真实三样本补验另记。

```json
{"op":"normalize","inputs":["raw.glb"],"params":{"sourceUp":"Y","targetHeightMeters":1.8,"maxTris":30000,"maxTextureSize":2048},"outputs":["out/model.glb","out/model-spec.json"]}
```

一个自包含GLB输入、一个GLB输出及一个JSON元数据输出。源几何仅接受TRIANGLES（primitive.mode=4或省略）；线/点/strip/fan及未知模式在导入前明确拒收，避免Blender静默漏掉非三角几何。四个params全必填：sourceUp只取Y/Z（源模型的语义朝上轴，不猜）；targetHeightMeters正数（米制目标高度）；maxTris正整数（超预算拒收，不擅自减面）；maxTextureSize为1..2048整数。无自由脚本、表达式或命令入口。

工作器把源世界空间几何的语义上轴转为+Y，以统一缩放达到目标米制高度，平移到包围盒底面中心原点，变换烘焙到网格。作者提供的corner normals须在烘焙前保存、按世界变换逆转置归一化，负缩放翻面后依角点身份恢复，避免Blender重算法线改变表面光照。输入骨架/动画属于T5，不在规范化时静默丢弃，应明确拒收。含静态weights的morph targets/shape keys也明确拒收，须在DCC先显式处理；不以默认形态烘焙来悄悄丢掉形态键，不声称T5已实现morph编辑。贴图保持宽高比缩小到maxTextureSize以内并嵌入GLB，保留材质用途及色彩空间。首版仅接当前引擎默认采样组合：wrapS/T=REPEAT(10497)、magFilter=LINEAR(9729)、minFilter=LINEAR_MIPMAP_LINEAR(9987)，字段省略按本引擎默认；其他显式采样或错类型在导入前明确拒收，导出后再核验，避免Blender合并ORM/AO时改采样。复杂采样须先DCC显式处理，不承诺无损转换所有glTF材质；几何使用固定参数Draco压缩，缺编码器或未输出压缩扩展即失败。

JSON产物为`{spec:{scale:1,up:"Y",pivot:"bottom-center",tris,bytes},normalization:{sourceUp,targetHeightMeters,appliedScale,sourceBounds,bounds,trianglesIn,trianglesOut,maxTextureSize,textureSizes,compression:"draco"}}`。scale=1因为尺寸已烘焙，不依赖当前尚无消费者的MeshSpec.scale；appliedScale只作来源记录。bounds采用最终glTF/引擎Y-up坐标的[min,max]。

工具输出含作业证据及该spec，是资产条目的字段片段，不是已批准的完整资产条目。可通过API `normalizedEntry(sourceEntry, report, servedPath)`合并到原mesh条目：保留id/license/source及所有已有来源，更新path/spec，追加provenance.normalization（输入SHA、jobHash、参数及测量）；源mock标记不清除。新候选仍交原M2.5待审门，不直接写任何index，不自动approve或签字。

显式mock只证明协议/调度，产物留T7证据目录的mock域；spec为空、不伪造面数/字节/压缩验收，也不能生成完整候选条目。真实Blender运行离线模拟模型时，作业是真执行，来源仍记模拟；不能据此声称真实Tripo样本已验。

验收包含三个不同离线几何夹具的真实Blender双跑、米制/底轴/预算/贴图/Draco解码实证，以及缺程序/错误源轴/超预算的可读拒收。按路线图仍须待凭据/样本就绪补三个真实Tripo模型；独立复查负责最终判词。
