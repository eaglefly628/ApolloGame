# ApolloGame 中国古机关游戏交接

交接生成日期：2026-10-09。源任务「评估 ApolloGame 新游戏」，thread 01a11c85-8a47-75b9-8ea0-7a9cd6d9f00c。源目录 `/Users/junbaili/Documents/Codex/2026-10-09/task-2`（以下相对路径均基于此目录）。当前任务 projectId=null，不能当作已归入正式项目。

## 正式目标与用户授权

已由受支持 list_projects 再次确认：ApolloGame projectId=`22c64537-de6b-4a09-9739-d4812eceb7f3`，root=`/Users/junbaili/Documents/GitHub/ApolloGame`，hostId=local，Git 项目。父会话负责在此项目新建 session、传入本交接、确定归档时机。保留本目录原件，勿删除或移动。

用户明确要求在真正项目中创建新 session、交接全部成果、以后创建前核对项目归属并将约定落档。新 session 应先读取项目既有 AGENTS.md/适用约定，合入 PROJECT-SESSION-RULES.proposed.md 的规则，保留原约定。当前文档是待合入文本，不代表正式项目规则已落地。

原始仅评估授权后来扩展为概念图及独立真实 3D 渲染演示，用户已请求模型、动画、材质和阴影改进。没有推送、发布、购买授权。此次交接不扩大功能开发授权。

## 已确认方向

参考对象为《吞吞堡垒》/Wanderburg；原先太空骰子叙事讨论不应混入。以中国传统古机关为核心，融入墨家/鲁班意象；将移动城堡换为机关载具，使用中国地图展开大地图、子地图和核心战场。墨子属于墨家，机关为原创幻想设计，不应包装成考证复原。

必须真 3D、固定俯视镜头，不做自由旋转；用户喜欢卡通低模风格，接受树石 low poly，要求木纹、草地和较清晰阴影。只用 Codex 直接创作及现有引擎依赖，不引入第三方模型生成服务或建模软件。美术/文案原创，不提取参考游戏资产、源码、商标。

尚未确定具体完整游戏规则、战斗吞噬/成长/升级机制、中国地图内容范围、关卡规模、数值、角色和正式资源预算。机关龟/牛及稻田村落是演示选择；不把这些自动当作最终玩法承诺。

## 全部成果位置

- `ApolloGame-assessment.md`：引擎能力、分支盘点。
- `Wanderburg-conditional-assessment.md`：参考条件评估与差距。
- `game-103-audit.txt`：现有 game103 检查证据。
- `generated_images/`：全部原始概念 PNG、`concept-prompts.txt`、`toon-3d-prompt.txt`。最终认可的低模俯视概念是 `exec-e1255f03-c8b1-4cb9-91f7-9d5c6eb86256.png`；其他 exec PNG 为细节英雄、大地图、江南和边塞概念。交接应完整保留目录，不依赖聊天图片。
- `mechanism-sample/`：可重建独立演示完整源码和资源，README 包含限制。
  - `main.ts`：实体场景、固定正交 Camera3D、灯光、草地加载、Model3D、Path3D、AnimState3D。
  - `build-models.mjs`：直接创作六种几何，GLB 导出，木纹嵌入，节点动画。
  - `build-textures.py`：Python 标准库生成原创可平铺 512×512 木纹/草地。
  - `public/models/`：turtle/house/tree/rock/ox/pickup.glb，六种自包含 GLB。
  - `public/textures/`：wood-grain.png、grass.png。
  - `verify-models.mjs`、`model-report.json`、`validation.json`：校验和统计。
  - `index.html`、`vite.config.mjs`、`package.json`：启动构建。
  - `preview.jpg`：早期实机；`preview-refined.jpg`：最新材质阴影实机截图。
  - `dist/`：最新 production build，可再生成；`.vite-cache/` 是缓存无需移交。
- `engine-review/`：从 claude/mainbranch 6bf0a03676d8c091e96572f9c82a3dc878ce1047 提取的 src/games/scripts/docs/config 快照，当前演示实际引用它；不是 Git checkout。
- `ApolloGame/`：完整仓库克隆、bootstrap master；`ApolloGame-review/`：浅克隆。未修改其代码。原盘点 master=f5b2184de，codex/mainbranch=3e6569c26；新会话应重新核实远程状态，勿切换原工作树。

## 依赖、启动与接入

`mechanism-sample/node_modules` 与 `engine-review/node_modules` 是指向正式项目现有 node_modules 的只读复用 symlink。不要复制成嵌套依赖或写进原 node_modules。Vite cacheDir 在 sample 自己目录。vite.config 的 engine alias 指向相邻 engine-review；迁移后需明确保留快照或改到适用正式引擎路径，并验证版本兼容，不悄悄改 renderer。

启动：在 mechanism-sample 执行 `npm run dev`，本机 http://127.0.0.1:5187/。资源重建 `npm run models`（先 Python 贴图，再 Node GLB）；校验 `node verify-models.mjs`（必须在 sample 工作目录）；构建 `npm run build`。

源 session 已启动 Vite 服务端口 5187，最早工具 session ID 80152。交接时用 lsof 检查实际监听者；不随便启动第二个占用同端口服务，不随便终止用户进程。页面仍引用源目录，归档前先确保新会话已复制所需文件并重新建立服务。

## 实现与证据

六种模型：机关龟 894 三角、房屋68、树32、石36、机关牛108、木材拾取48。龟 GLB 中 mechanical-loop 为8秒循环，共四车轮、两弩台、投石臂七条 quaternion 轨道；AnimationMixer 节点动画无需骨骼。载具移动由 Path3D 驱动。当前没有真实战斗状态或模拟判定。

木纹以 baseColorTexture 内嵌到木制模型；草地通过 ImageAssetLoader/Material3D.map 接入。树石维持原有几何材质。阴影从1024到2048，地面范围90缩到65；dprCap1.5。曾试4096但预览连接超时，尚不能断言是GPU开销导致；最终选2048，未做跨设备帧率基准。

最后一次六个 GLB 容器/缓冲和七条动画校验 PASS。Vite build PASS，105 modules，有共享包1.625MB超过500kB的体积警告。浏览器实际查看最新材质/模型和动画，console error/warn 为空；截图 preview-refined.jpg。旧 game103 RATCHET PASS，有7个已批准重复功能和wallclock警告，见原日志。

地面场景块使用引擎 toon；GLB 保留平面法线、粗糙 PBR。当前 Model3D 不消费 Material3D toon，不得声称全场景严格 cel shader。没有改 renderer 或 ModelPool。

## 未完成与保护事项

尚未挂入正式 launcher/game-i；未实现战斗、碰撞、吞噬成长、地图系统、HUD、弹道、攻击状态同步。整车行走和轮速尚未绑定真实状态，发射循环没有伤害事件。下一步先核实用户希望继续集成还是仅交接，不自动扩展玩法。

原正式项目有既存未提交修改，不是本任务改动：.gitignore、assets/README.md、docs/design/game112/shop-and-stardust-v1.md；games/game112 下 cat-art/game112/item-host.test/shop-browse.test/shop-browse/ui.test/world-data；games/game113 下 app.css/app.tsx/game113.tsx/hobby-guide.test.tsx/sake-mentor-view.tsx/state.test/state；新增 game112 build-local-toy-art/local-toy-art.test/local-toy-art/shop-catalog.v1.json，game113 daily-lesson.test/daily-lesson，scripts/game112-toy-expansion-plan.mjs。重新 git status 核实，不清理、不重置、不覆盖。

本任务 sample/报告/图片是独立源成果，不表示已 commit。旧 clone 和 engine 快照不能替代用户正式工作树。参考附件 wanderburg-feasibility.md 获取返回403，有界重试后仍无法读取，未以文档内容作依据。最初 Library 图片64×2048无法辨标题，不凭其猜机制。公开参考 Steam https://store.steampowered.com/app/3624140/Wanderburg/；/tmp/wanderburg-official-style.jpg 只是已查看的公开风格参考，不作为游戏素材且 /tmp 不作为永久交接存储。

## 创建/绑定能力

支持 create_thread target.type=project + 上述 projectId + environment.type=local（创建真实项目任务）。create_thread 默认模型应省略，不用 worktree 除非用户要求。工具没有现有 session projectId/cwd 重新绑定接口；move_thread_to_sidebar_section 只移动分组。handoff_thread 无法移动调用线程自身且 cloud handoff 不支持，不用于假装本任务已绑定。父会话创建后应 read_thread/list_threads 核实新 task projectId/cwd，再把本文件绝对路径写入初始 prompt。归档需按父会话安排，先保全成果及服务依赖。

## 最新迁移阻塞（父会话通知）

父会话尝试使用其元数据中的 projectId `693ca716-830d-406c-becd-ff72a5c7f9de` 与正确 cwd 创建，返回 DesktopTaskProjectUnavailableError，task_created=false；父会话已请用户断开重连电脑后复核。本执行环境最新 list_projects 返回的是 `22c64537-de6b-4a09-9739-d4812eceb7f3`，两环境 project ID 不同，不应跨环境直接复用或猜测。新建操作应使用执行该操作的环境即时返回的项目ID，并核实结果。不得绕过为未绑定任务、不得修改内部数据，当前不归档。用户在项目手动创建新会话可作为接收入口，待父会话确认。

本次 lsof 已核实 127.0.0.1:5187 由 node PID11758 监听；未停止或重启服务。

## 正式项目规则已落档

按用户补充授权，只向正式项目 `/Users/junbaili/Documents/GitHub/ApolloGame/CLAUDE.md` 追加「项目 Session 归属与交接（owner 2026-10-09）」五条规则。此前未发现适用 AGENTS.md；CLAUDE.md 是现有每会话必读项目规则。原内容完整保留，新增9行，写后回读与 git diff 确认。未改源码、未提交或推送。PROJECT-SESSION-RULES.proposed.md 保留作为交接历史参考，现在不再是唯一落档。此文档写入不是 session 已绑定证明。

正式项目 Codex 入口补验：未发现 AGENTS.md 或 .agents 对 CLAUDE.md 的既有引用。已新建根目录 `/Users/junbaili/Documents/GitHub/ApolloGame/AGENTS.md`，仅引用现有 CLAUDE.md 并要求开工前阅读，包括项目 Session 归属一节；不复制规则，注明遵循当前用户/系统/开发者授权、不扩大分支/提交/发布权限、保护在途改动。写后回读与 git status 确认（AGENTS.md 未跟踪、CLAUDE.md 已修改），未提交推送。
