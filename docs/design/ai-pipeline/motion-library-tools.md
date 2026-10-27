# 本机动画库工具

原始 FBX 与转换的 GLB 均留在 `~/ApolloAssets/`，不进入 Git。每个候选记录来源 SHA、作业证据与 draft 状态；自动结构验证不代替视觉确认。

## 入库与验证

`node scripts/motion-library.mjs ingest --from <原动画目录> --lib <库目录> --annotations <外部标签JSON> --blender <程序>`

角色使用 `skin-ingest --from <characters_mesh目录>`；可用 `--ids id1,id2` 分批。`validate --lib <库目录>` 重算文件 SHA 与引擎测量。非 Mixamo 来源必须给 `--source-kind <来源> --license <说明>`，只声明许可而不自动授权。

## 检索与预览

`node scripts/motion-match.mjs <文本> --lib <库目录>` 做确定性关键词检索。支持情绪、接触、时长、类别筛选；无相关项返回空。不是语义理解或视觉质量评分。

`node scripts/motion-preview.mjs --lib <库目录>` 输出本机地址。只读目录，逐文件核验 SHA；以现有 LayoutNode / house 主题和 ThreeRenderer / AnimGraph3D 播放。每组最多两个角色、三个动作，可检索、筛选和暂停；默认使用目录中前两个角色，两个下拉框可各自选择全目录任意Skin。过滤或暂停会重建舞台并从头播放。当前未提供人工确认写回、动作质量自动评分。

## 派生变体

`node scripts/motion-library.mjs variant <动作id> --trim 0,1 --lib <库目录> --blender <程序>`

互斥选项：`--trim 开始秒,结束秒`、`--mirror`、`--loop-fix`。可指定 `--id <新id>`。保留原骨架、逆绑定和原二进制前缀，新增标准采样动画。输出只发布 draft，记录 derivedFrom、配方和作业证据；原素材不可覆盖。

镜像按世界空间旋转增量反射、左右配对；拒绝非均匀静止缩放、动态缩放、非 Hips 平移。仅支持 LINEAR 采样；STEP/CUBIC、非关节动画等明确拒收。补循环只平滑末段接缝，不解决脚滑和接触。Mixamo 滑杆远端批量导出协议未核实，未编造接口；现有角色来自已完成的官方网页下载。

## IK 烘焙

`node scripts/motion-library.mjs compose --recipe <配方JSON> --lib <库目录>`

配方与回执规则见 [motion-compose.md](motion-compose.md)。首次只产生候选和等价性证据；人工检查后，显式提交对应配方 SHA 才能入库为 draft。该确认不等于最终动作质量已批准。
