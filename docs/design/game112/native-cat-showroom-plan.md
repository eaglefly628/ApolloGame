# Game112 猫咪展示室 · 制作与接入记录

日期：2026-10-12。用户要求继续 native-character 交接，重新独立生成部件，增加脸部分层，允许完整隐藏区域互相 overlap；新增观察猫动画的小房间，并持续生成市面猫种的同风格 Demo。

## S1：本轮目标

一个明亮、猫原生的小房间，猫位脚掌清楚可见。可选择猫、动作、播放/暂停、速度、缩放、单参数与复位。先完成雪团基准，不给默认待机添加整头晃动。真正制作后的片段才展示；步态和跨视角转身目前没有资产。

## S2：实查和接缝

已查 src/engine/host/native-character.ts、src/ui/components/{types,catalog,server}.ts、src/assembly/capability-registry.ts、资产/UI/2D 渲染手册及 native-character 技能。共享端口支持 loadAsset/command/destroy，原生播放器支持 mesh、warp、parent、parameter、animation、eyewhite/irides stencil。LayoutNode 闭集没有对应播放器控件，Image 只有 sprite/meshMotion；视频控件也不能解释 .stretch。不能靠 Image 的 src 或现有 sim capability 重组嵌入播放器。

owner A/B 问询已发出，尚无答复：

- A（推荐）：由 PUI 增加通用 NativeCharacter 控件，复用现有端口。游戏只给 assetKey、静态 poster、clip、参数与布局。影响面是 UI 共享层；代价为生命周期/就地更新/失败回退/目录字段和发布验证；可供其他游戏使用。
- B：Game112 独有宿主挂载例外。代价为本游戏单独维护布局、销毁与投影接线，后续游戏无法直接复用，须明确例外。

此前共享宿主端口授权不自动扩大为本次 UI 裁决。裁决前只制作候选模型与原生工具 Demo，不更改 src/ui、不冒充 Game112 游戏内接入。独立只读复查已核证此缺口，端口测试 6/6 通过。

必须保持 iframe 身份：server.ts 默认 props/layout 变化会 outerHTML 重建；参数更新应由控件就地发送，不得每次滑块都重载/重播。异步 load 有版本令牌；退出房间、移除控件和根重建要 destroy；失败继续显示 poster。

## 独立生成规范

纯数据生产规格：games/game112/native-cat-production.v1.json。每猫 1 张身份母图 + 28 个独立部件。脸部包括底稿、左右耳、眼底、虹膜、上下眼睑、眉上毛、两侧口鼻垫、鼻、嘴、胡须、脸颊毛。全都参考身份母图重新绘制完整部件；不切母图作为替代。隐藏耳根/腿根/颈根/尾根完整，允许覆盖，分别在 mesh 中标定原点与接缝。

原图、候选 .stretch、预览、对齐、哈希、实际生成记录存 art-local/game112/native-character/，不入 Git。候选保持待审，不能自动晋升 official AssetIndex filled。后台生成不需要替换主厅猫。

## 目录与持续任务

当前 Gallery 有 91 品种/变体条目，来源与范围沿用 cat-gallery.v1.json，并非全球穷尽定义。第一批各一只成年代表猫，共 2,639 项图片作业；随后覆盖既有公/母布偶的幼/成/老身份与掌柜。实际游戏 CATS 只有雪团；品种文字目录不是已完成模型。

队列脚本：node scripts/game112-native-cat-queue.mjs init / next 8 / record <breed/part> <生成文件> / summary。本地 queue.json 是断点，完成项不重复出图。先完成雪团，再覆盖品种母图与部件，逐猫制作/验模。

2026-10-12 已建立本聊天持续任务“Game112 全猫种分层动画制作”（automation id game112），每 15 分钟续跑。本地运行依赖电脑开机、桌面应用运行和生成服务可达。临时配额/服务失败保留断点，不自动转收费 API。范围扩充不解除 UI 专职域与人审约束。

## S3–S8 待验收标准

S3：原生项目结构、贴图解码、实际参数绑定；S4：选择→播放→暂停→控制→复位的工具闭环，游戏接入须先取得 S2 裁决；S5：LayoutNode 游戏展示室零重叠与清楚的地面落脚；S6：逐层接缝、透明、花纹身份、默认与参数极值；S7：独立真实截图/循环核证；S8：相关测试、构建、干净发布路径与回退验收。此文件不代签人门，不将候选生成数当成模型验收数。
