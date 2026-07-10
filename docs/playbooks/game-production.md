# 游戏生产总线手册（八阶段流程板 · 接线图）

> owner 2026-07-10 拍板：**不许让一个 LLM 会话一口气跑完整条产游戏流程**——上下文会丢失/漂移
> （实证=game-k 事故：会话早于手册·把程序化占位当最终交付）。药方不是更厚的手册，而是
> **N 步拆分 + 每步双验（机器门+人门）+ 状态放在 LLM 之外**。本册就是那条总线的接线图。

## 一句话

**每款游戏一张生产流程板**（八阶段·状态从工件推导·证据带内容指纹）——新会话开工先看板，
只做第一个非绿阶段；做完过机器门+人门再往前走。台账=`public/games/<slug>/pipeline.json`。

## 入口

| 入口 | 用法 |
|---|---|
| UI：主屏「🏭 生产流程」（dev 模式） | 选游戏 → 八阶段看板 → 每行可「▶ 跑机器门」「☑ 人门通过（note 必填）」 |
| CLI：`node scripts/game-pipeline.mjs board <slug>` | 看板（会话开工第一命令） |
| CLI：`gate <slug> <S3\|S4\|S5\|S8>` | 真跑该阶段机器门 → 记证据（退出码+游戏内容指纹） |
| CLI：`signoff <slug> <SN> --note "…" [--by 名]` | 人门落账（review 内容必填·不许空签） |
| CLI：`concept <slug> --name --pitch [--plan-waiver 理由]` | 填立项卡 / 记免 plan 裁决 |

## 八阶段（每步唯一必读=手册列·每本 ≤80 行）

| 关 | 做什么 | 机器门 | 人门 | 手册 |
|---|---|---|---|---|
| S1 立项卡 | 名字+一句话玩法+参考+风格意向 | concept 字段非空 | owner/Lead 签 | `docs/llm-onboarding.md` |
| S2 能力计划 | capability-plan 过审（纯数据卡带可记免 plan 裁决） | plan 在档 或 裁决在案 | Lead 签 | `docs/design/capability-plan-template.md` |
| S3 骨架关 | manifest 立起来、引擎吃得下 | parseManifest 零 error（gate） | 挂载目击签 | `docs/playbooks/index.md`（找对应线） |
| S4 玩法关 | 胜负/重开/核心循环闭环 | 该游戏 walkthrough vitest 绿；卡带=bench 五轴（gate） | 试玩签 | `docs/playbooks/testing.md` |
| S5 UI 关 | HUD/菜单守 LayoutNode 纪律 | game-skill-audit 红旗零（gate）；卡带天然免 | /check-ui 结论签 | `docs/playbooks/ui.md` |
| S6 美术关 | 台账→风格锚→生成→写回→复核 | 台账推导（MOCK 不算完成） | **已内嵌**=平台逐行 ☑ 复核 | `docs/playbooks/art-pipeline.md` |
| S7 品质关 | 视觉评分卡打分 | —（以人门为主） | 得分记 note 签 | `docs/playbooks/visual-scorecard.md` |
| S8 终检关 | 全库门禁+复盘回填 | tsc+vitest+build 三绿（gate） | 手册缺口回填/提单记 note 签 | `docs/playbooks/testing.md` |

## 防漂移三律（为什么这样设计）

1. **状态不在会话里**：看板全部从工件推导（manifest/测试/台账/审计真跑）——模型说「做完了」不算，门过了才算。
2. **绿不是永久绿**：机器门证据带**游戏内容指纹**（S8 带 git HEAD+净树位）——游戏文件一动，证据自动标 ⚠过期，须重跑。
   陈旧基线的绿不算绿（与推送门禁同一条纪律）。
3. **每步小上下文**：一个会话/子代理只领一个阶段：`board` → 读该阶段手册那一本 → 干活 → `gate`/`signoff` → 停。
   跨阶段抢跑=漂移温床；发现手册接不住 → `requests.md` 提缺口（问责定性=手册缺陷，复盘只问手册哪里没接住）。

## 红线

- **不许代签**：signoff 是人门——LLM 只能把「待人审」摆上看板，不得自己 signoff 冒充 owner/Lead（gate 随便跑，签核必须真人指令）。
- **S6 的 MOCK 行不算完成**：mock 永不上画面（终态档 §六），流程板同口径。
- **S8 过期即重跑**：rebase/新提交后 S8 证据自动过期——推送前必须净树重跑（呼应 CLAUDE.md 推送门禁）。
- pipeline.json 是台账不是配置——只经 CLI/端点写，勿手改造假绿。

## 查不到怎么办

- 新阶段诉求 / 门要加严 / 阶段语义不合某形态 → `docs/workflow/requests.md` 提缺口等裁决，**绝不自造旁路**。
