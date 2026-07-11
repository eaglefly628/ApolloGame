# Session 交接 · 薄指针版（2026-07-03 起）

> 旧版全文（2026-06-22 定格·含 Game G playtest 细节）→ `docs/workflow/archive/session-handoff-2026-06-22-full.md`。
> 本文件从此只放**指针和真活着的事**，不再手抄现状（口径漂移教训）。

## 现状去哪看（机读真相优先）

| 要什么 | 去哪 |
|---|---|
| 项目规则/铁律 | `CLAUDE.md`（自动注入） |
| 引擎/游戏现况·接入 | `docs/llm-onboarding.md`（唯一入口·分层阅读协议） |
| 最近发生了什么 | `git log --oneline -30` |
| 活跃/排队工单 | `docs/workflow/requests.md`（已完结条目在 `requests-archive.md`） |
| 各角色开工清单 | `docs/workflow/finish/`（P3D/PF/PG/PS 各自 handoff） |
| 生产线怎么做事 | `docs/playbooks/index.md` |

## 真活着的挂起事项（读时核日期）

- **P0·冲刺主线（压过一切非冲刺工单）**：7·29 审核 demo——纲领=`docs/design/demo-sprint-2026-07-29.md`；生产总线=八阶段流程板（`docs/playbooks/game-production.md`）；**Workshop 统一工作台 ✅ 完工（Lead 亲手施工·spec §八验证记录·待 owner 验收）——维护移交 PST（交接档=`docs/workflow/finish/PST-workshop-handoff.md`）**。残项归位：美术真 key=owner 采购（纲领 §六·LLM 通道改订阅 setup-token 不采购）；T3 吞吐=Opus 单；进度灯=PST 心跳队列；refImage=真 key 后验。
- **P0·掌机 cartridge 黑屏**：zoom 修法（`c5608bbc`·2026-06-22）**仍待 owner 真机烧版验证**；次候选排查项见归档版 §0。
- **排队指派**（owner 2026-07-03 拍板·冲刺期让位主线）：甲=REQ-G-修正栈迁移并虚胖清算；程序A=REQ-G-演出迁时间线；P3D=REQ-GAMED 接线单（详见 requests.md + P3D handoff 顶部指针）。
- 历史标签两枚待 owner 指认 commit（见归档版）。
