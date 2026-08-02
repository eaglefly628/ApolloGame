# 发布管线契约（zerocraft.py 薄代理 + studio 向导页照此建）

> PS 维护·2026-07-04。Lead 裁决（REQ-PUBLISH）：接入形态=**zerocraft.py 薄代理 `/api/publish/*` → 本 `serve.py`（只透传不塞逻辑）**，studio player 模式接向导页 UI。
> **机读真相 = `serve.py` 本身**（常量/函数），本文件只描述契约意图与交接边界，不手抄字段表（防口径漂移）。

## 稳定判词 token（消费端只认这套·勿 scrape 日志）

见 `serve.py` 顶部「判词 token 收口」块（单一真相）：
- **三段命名** `PUBLISH_STAGES = ('package', 'genvdf', 'upload')`——顺序即执行序。
- **段判词** `ST_OK` / `ST_BLOCKED`（缺前置=未填 appId/depot/builder·带 `reason`·非错误·可预览可修）。
- **任务判词** `JOB_IDLE / JOB_RUNNING / JOB_DONE / JOB_ERROR`（`job_status()`·= 进度口径）。

## zerocraft.py 应透传的端点（薄代理·原样转发含日志流）

| 端点 | 用途 | 返回要点（形状见 serve.py） |
|---|---|---|
| `GET /api/state` | 配置 + 环境 + 进度 | `config`·`games`·`steamcmd`(探测)·`builds`(裸目录候选)·`job`(判词) |
| `POST /api/plan` | **dry-run 预览整条三段**（不 build/upload） | `steps`=`plan_pipeline()`：三段各 `{stage,status,argv|files|reason}` |
| `POST /api/save-config` | 存配置 | `config` |
| `POST /api/gen-vdf` | 真生成 VDF（= genvdf 段） | `files`·`dir` |
| `POST /api/run` | 真跑（`build`/`gen-and-publish`/`publish`/`login`） | `ok`·`action`；进度经 `/api/log` 轮询 |
| `GET /api/log?offset=` | 实时日志 + 进度 | `text`·`offset`·`job`(判词) |

> 单段也可独立调：`stage_package/stage_genvdf/stage_upload(cfg)`（zerocraft.py 按需组合）。

## studio 向导页必须做到（Lead 硬要求）

1. **「三步不能自动」做成显式向导页**，不许藏文档里（Valve 无 API）：① 用户自己的 $100 合作伙伴账号 + 真 AppID/DepotID；② 本机装 steamcmd + 首次缓存登录（Steam Guard 令牌终端手输一次）；③ 上传后后台 **Set Live**（防误推·故意手动）。全流程细节 `RELEASE-PROCESS.md`。
2. 按 `ST_BLOCKED` 的 `reason` 引导用户补前置（哪段缺什么），别让用户盲填。
3. 进度/日志读 `job` 判词 + `/api/log`，不解析日志字符串判成败。

## 无真账号验证

`python3 scripts/steam-publish-smoke.py`（480·退出码门禁）验编排契约确定性部分。UI/代理联调时同样用 480 跑通「预览→生成 VDF→模拟」，真上传三步留给拿到真账号的 owner。
