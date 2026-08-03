# Session 交接 · 薄指针版（2026-07-03 起·2026-08-03 REQ-RETRO 复核刷新）

> 旧版全文（2026-06-22 定格·含 Game G playtest 细节）→ `docs/workflow/archive/session-handoff-2026-06-22-full.md`。
> 本文件从此只放**指针和真活着的事**，不再手抄现状（口径漂移教训——上一版曾手抄「活着的线头」5 条，
> 18 天内全部过期未同步，其中一条甚至误导性地把已 done 的工单标成待验证。**教训固化**：本文件只留指针表，
> 不再写"接手时活着的线头"这类会自然过期的具体清单——要看当前活跃事项，直接读 `requests.md`。）

## 现状去哪看（机读真相优先·唯一维护面）

| 要什么 | 去哪 |
|---|---|
| 项目规则/铁律 | `CLAUDE.md`（自动注入） |
| 引擎/游戏现况·接入 | `docs/llm-onboarding.md`（唯一入口·§0 机读真相·分层阅读协议） |
| 最近发生了什么 | `git log --oneline -30` |
| 活跃/排队工单 | `docs/workflow/requests.md`（**owner 10 硬槽·满了先清后加**）；游戏工作票=各游戏 `docs/design/<game>/requests.md`（工单随游戏走）；3D=`requests-3d.md`；已完结=`requests-archive.md`（按月分卷，主文件留索引） |
| 各角色开工清单 | `docs/workflow/finish/`（各角色 handoff·按需查目录） |
| 生产线怎么做事 | `docs/playbooks/index.md` |
| 引擎当前架构基线 | `@zerocraft/engine` 包名（`package.json` exports 十子路径）+ `scripts/zerocraft.mjs`（`run\|test\|build <game-dir>` 外部内容启动器，游戏可居仓外，file: 依赖接引擎）+ games/ 顶层目录（不在 src/ 下）——详见 `requests-archive.md` grep `REQ-PKG` |
| 门禁/验收怎么跑 | `node scripts/scoped-gate.mjs --run`（按改动面缩范围）；全量退出码见 `CLAUDE.md`「推送门禁」一节 |

## 交接纪律

- 新 session 接手：① 读 `CLAUDE.md`（分支铁律/推送门禁/角色启动协议）② `git log --oneline -30` 对时间线 ③ 读 `requests.md` 看当前活跃工单（不看本文件的历史堆栈——本文件不再记录具体线头）。
- 有真正"跨会话必须交代、别处找不到"的信息（如未提交的现场状态、口头未落笔的裁决）→ 写进 `requests.md` 对应工单或开一条新工单，不要堆在本文件（本文件只做路由表，堆内容=下一次 18 天陈旧的重演）。
- 历史归档层（旧版全文、更早的 session 交接快照）挂在 `docs/workflow/archive/`，仅供考古，不追溯更新。
