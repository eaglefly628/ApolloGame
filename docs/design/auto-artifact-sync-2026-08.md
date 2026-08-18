# 产物自动存档 · 落点可见（owner 2026-08-10 实撞「白跑」）

> owner 原话：「跑完的结果就没了，丢失了……我们的台账、台本什么时候上传？我希望它能主动地去上传，
> 跟我在这边窗口做这个事情感受是一致的。」

## 一句话

**任务一收工，产物先落成本地提交（丢不了）→ 跑门禁 → 绿了才推**；同时创作台弹「产物落点卡」，
逐处告诉你东西在哪、归哪个仓、存住没。

## 病根（不是产物没生成，是没提交）

一次「▶ 开工」的产出散在 2~4 处，其中**引擎仓那部分全躺在工作区未提交**——换台机器、
或重新 clone 一份，就真的没了。owner 看到的「白跑」是这个，不是会话没跑。

| 形态 | 落点 | 归属 |
|---|---|---|
| cart | `library/<slug>/` | **不入引擎仓**（自带 git 仓·每次保存自动提交） |
| builtin | `public/games/<slug>/` | 引擎仓 |
| compiled | `games/<slug>/`（+ `public/games/<slug>/`） | 引擎仓 |
| 三者皆可能 | `docs/design/<slug>/` | 引擎仓 |

形态判据与 `scripts/game-pipeline.mjs::detectForm` **同一套规则**（`artifacts.detect_form`·不造第二真相）。

## 三步顺序是刻意的（两条铁律各占一头）

```
① 先本地提交（不推）   ← owner 实撞「跑完就没了」：任何产出必须先落成提交
② scoped-gate --run   ← 退出码直核·绝不经管道（CLAUDE.md 铁律）
③ 绿了才推            ← 「门禁全绿才推」不可破；红了停在本地提交、如实报红
```

顺序反过来（先门禁后提交）= 门禁红时产物仍躺工作区 = 病根原样复发。
顺序里少了 ③ 的独立推送段 = 工作区此刻已干净、`sync_paths` 被 `clean` 短路而**根本不推**——
故从 `art_sync.sync_paths` 里抽出 `push_branch`（fetch → rebase --autostash → push·被拒重试）
给第三步单调。两条都在 `scripts/auto-sync-smoke.py` 有点名腿（③⑥），撤修即转红。

## 挂在哪两个「收工时刻」

- `art_jobs._run()` 尾（美术批量）——**放在 `lock.release()` 之后**：门禁要跑几分钟，
  占着单游戏串行锁会把排队中的下一个批量白白堵死。用后台线程，不拖 job 的 `finishedAt`。
- `pipeline_board._orch_reap()`（开工会话）——编排器子进程退出即「一次开工真正结束」
  （此时它已落台账、放锁），是唯一正确的挂点。

两处都**永不抛**：收尾动作失败绝不能反过来污染那个已经跑完的任务。

## 开关与看得见的回执

- `features.autoPush`（默认 **开**）：`config.json` 或 `ZEROCRAFT_FEATURE_AUTOPUSH=0` 可关，关掉退回手动按钮。
- `GET /api/pipeline/artifacts?slug=` —— 逐处列「路径 / 归哪个仓 / 几处未提交 / 人话说明」+ `lastAutoSync` 留痕。
- `POST /api/pipeline/artifacts/sync` —— 手动一键提交推送（复用 `sync_paths`·只 add 该 slug 的 pathspec）。
- 工坊「📦 产物落点」卡：开工一结束自动弹（20 秒后补拉一次，等后台自动存档落终态）；
  任务托盘点开工那条也会连带拉出来。

## 已知代价（接受·记在这儿别再重新发现）

- **共享工作树**：门禁跑的是整棵树的改动面，别人在途的红会挡下你的推送——保守但正确（不推没验过的东西）。
  提交本身仍只带该 slug 的 pathspec（2026-08-03 误提交事故律不破）。
- **推的是整个分支 HEAD**，可能捎带别人已提交但未推的 commit——与既有手动 `/api/art/sync` 同口径。
- 卡带屋（`library/`）不进引擎仓，自动存档不碰它；它由 `library.py` 每次保存自动提交到自己的仓。
