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

## ★ Lead 主程 session 移交（2026-07-15·owner 指示：原 session 压缩多轮·新 Fable session 从此接手）

> 新 Lead 开工三步：① 读 `CLAUDE.md`（分支铁律/推送门禁/角色启动协议）② 读本节 ③ `git log --oneline -30` 对时间线。
> 身份=LEAD（`docs/roles/index.md`）：引擎域 `src/{engine,skills,assembly,renderer,services,net}` 归你（P3D 例外域勿动）；
> 评审需求先回驳后施工；tsc+vitest+build 全绿才推；rebase 带进新提交必须重跑全套再推；直推 `claude/mainbranch` 不开 PR。

**接手时活着的线头（按热度）**：
1. **game-g/game-d 美术升级执行中（owner 正在出图）**：台账=机读真相（g=110 行 `public/games/game-g/art/art-ledger.json`·d=83 行同路径），行行带确定尺寸+英文提示词+统一风格锚（v2）；出图回填=工坊素材屏逐行 ⤵ 替换。批28-33 全链见 requests.md `REQ-G-ART-v2` 回执；**未台账化的诚实边界也在那条**（战斗屏 bespoke 牌面接立绘需 owner 点头设计、正文行内 emoji 长尾、天罡 38 张逐张牌面）。owner 若报「某规格不对」→ 改 `scripts/game-g-art-requirements.mjs` / `scripts/game-d-art-ledger.mjs` 的 spec 后重跑（mergeLedger 保号）。
2. **token 优化 P0/P1 刚落（2026-07-15·本批）**：①能力目录抽独立缓存段（transport `system` 收 str|list·anthropic 逐段 cache_control+末条消息断点·DeepSeek 靠稳定前缀自动命中）②HTTP 通道「开局冻结上下文」（`_ws_http_ctx_*`·工件变更走末端更新提示·CC 通道 mf_hash 同范式）。**真 key 上线后必验**：llm-logs 里 `usage.cache_read/prompt_cache_hit_tokens` 命中率；P2 未做=usage 花费聚合上壳（设置页显示当日花费）。
3. **会话侧派工纪律（owner 07-15 review 认可）**：owner 在线实时验收=主 session 亲手；**≥30 分钟机械活派子代理并显式降档**（档位表在 CLAUDE.md·诊断/搜索类默认 high 不继承 xhigh）。原 session 的自查偏差就是这两条没执行。
4. **P3D 线现况**：超休闲六连批已 Lead 验收放行（回执+边界提醒在 `requests-3d.md` REQ-3D-震屏首见基线条）；震屏/闪白/施力 nonce 首见基线修复已复核 ✅；展示台接入单在展示台程序手上（不归 Lead）。
5. **REQ-UI-标题图标槽已落地**（Panel.titleIcon/Tabs.tab.icon）——待 PST 接线 dizhi/craft（单内有一行写法）。
6. **背景挂起照旧**：REQ-AIGEN 运行时/设置 UI（等真 key）、PixVerse/Seedance adapter（等 key 验 API 形态）、游戏质量杠杆（owner 定调「下个议题」·方案记录在原 session 对话·要点=品类骨架库/生成质量环/juice 冲刺）。

## 真活着的挂起事项（读时核日期）

- **P0·冲刺主线（压过一切非冲刺工单）**：7·29 审核 demo——纲领=`docs/design/demo-sprint-2026-07-29.md`；生产总线=八阶段流程板（`docs/playbooks/game-production.md`）；**Workshop 统一工作台 ✅ 完工（Lead 亲手施工·spec §八验证记录·待 owner 验收）——维护移交 PST（交接档=`docs/workflow/finish/PST-workshop-handoff.md`）**。残项归位：美术真 key=owner 采购（纲领 §六·LLM 通道改订阅 setup-token 不采购）；T3 吞吐=Opus 单；进度灯=PST 心跳队列；refImage=真 key 后验。
- **P0·掌机 cartridge 黑屏**：zoom 修法（`c5608bbc`·2026-06-22）**仍待 owner 真机烧版验证**；次候选排查项见归档版 §0。
- **排队指派**（owner 2026-07-03 拍板·冲刺期让位主线）：甲=REQ-G-修正栈迁移并虚胖清算；程序A=REQ-G-演出迁时间线；P3D=REQ-GAMED 接线单（详见 requests.md + P3D handoff 顶部指针）。
- **⚠ apollo.py 已拆包（Lead 2026-07-12·owner 拍板「拆散主入口」）**：5060 行 → `main_entry/` 包 37 个按功能模块，根 `apollo.py` 只剩 67 行薄壳（写穿透代理·保住 `import apollo` 读写契约 + `python3 apollo.py` 入口）。**改 apollo 端点先按功能去 `main_entry/<域>.py`**（server.py=APIHandler 分派/generate_api/settings_api/library_api/assets/packaging/…）；纯移动零逻辑改（9 smoke 对齐基线）。**PST 在途 apollo.py 单需 rebase 到新结构**（会冲突·基线已变）。
- 历史标签两枚待 owner 指认 commit（见归档版）。
