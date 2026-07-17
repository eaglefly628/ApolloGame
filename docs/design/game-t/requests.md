# game-t《墨消》· 游戏级工单池（工单随游戏走·不占引擎池槽）

> 用法同主池（`docs/workflow/requests.md` 规则头）：GD-T/PE-T 的 bug/平衡/演出/内容单写这里；**引擎缺口不写这里**——提到主池给 Lead 裁决。已完结条目就地标 done 加 commit。
> **本池已随首轮清库重置（2026-07-16·owner 重跑令）**：首轮记录=`docs/workflow/archive/game-t-run1-2026-07-16.md`。
> 关联引擎单现状：`t2-match3-drag-swap` ✅ 已验收在库可直接消费；`REQ-M3-三期`（①LayerCell ②锦鲤 ③二次钤印 ④MatchBoardView ⑤settled Flag·挂起待 owner 拉起）；`REQ-M3-计分倍率`（open·spec 在池）。

## 待处理 / 进行中

### T-101 · PE-T run2 领工声明（边界栏·复查门范围核查用） · [2026-07-17] · PE-T · status: **施工记录**
> **启动词**：「角色=PE-T·任务=game-t《墨消》装配（capability-plan 已过审·从建壳立 S1 起照八阶段流程板走）」。
> **代码基线（透明记账）**：援引 run1 归档产物（git `6142237d`/`3e4b6d66`·本人产出·档案明许「可从 git 历史找回」）为起点，**增量四点**：①宿主重写=引擎 `mountHost` helper + `PointerInputSource`（零手写 DOM/监听·audit 零红旗·**不碰基线文件**）②接入已验收 `t2-match3-drag-swap`（拖拽+点选双路·走查测试补拖拽例）③BoardCell 加 Sprite 皮肤槽 + kindSkinEntities 六实体（art-pipeline 三行接入·未就绪回退色块）④S6 台账推导脚本（run1 NEEDS-WORK 主项）。
> **碰过的文件（边界）**：`src/games/game-t/**`（8 文件）；`src/launcher.tsx`+`src/launcher/game-runner.tsx` 各 1 行（注册即有板守卫：与 pipeline.json S1 同提交）；`tools/audits/game-t-*.audit.ts` ×3（/check-ui 入口）；`scripts/game-t-art-requirements.mjs`（S6·game-q 样板）；`docs/design/game-t/{capability-plan,requests}.md`；主池 1 条缺陷回报。**引擎域/audit 基线/棘轮守卫零触碰。**
> **顺序闸记账**：S1/S2 人门复查门未闭时跑 S3/S4/S5 机器门，一律带 `--out-of-order "PE-T 机器侧先行·人门/复查门待 owner/复查 session"` 显式落痕（owner 定则「跳关可以但记录在案」）。

### T-102 · 视图过渡态记账（等引擎三期·会随 ①④ 落地销账） · [2026-07-17] · PE-T · status: open（阻塞主池 REQ-M3-三期）
> 特殊棋子无专属外观（显本色珠）；墨渍=静态底衬不随洗净刷新、瓷 hp 无视觉（进度看 HUD 计数）；选中格无高亮（底栏文案提示）；消除瞬消无缓动。皮肤槽已留（Sprite+kindSkinEntities）——S6 真图落 index 即换装。
> 拖拽 onlyFlag 缺口：宿主已双保险（终局 dispose 输入源）·引擎修复单=主池 `REQ-INPUT-拖拽-onlyFlag`，修后撤宿主半。
> /check-ui 现状（入口 `tools/audits/game-t-{hud,select,result}.audit.ts`·440×780）：重叠 0·文字对比全过（实底纸面+text 令牌纪律沿 run1 整改）；残留硬失败=ghost 糖果皮按钮 ratio 1.21 ×5 = REQ-STYLESET M0.5 Lead 已定性的 ui-audit border-image 盲区假阳（真渲白字压深糖体可读·截图为证），PUI 修工具后归零。

### T-103 · 待新一轮 GD-T 接力位 · [2026-07-17] · PE-T · status: open
> 30 关正式表（占位 5 关整表替换·`levelIssues` 校验器已备）+ 文案表 + balance-sim 定标 + 教学关摆盘。**计分口径提醒**：主池 `REQ-M3-计分倍率` 未落地前引擎为平铺 60/珠——GD 定标若按 GDD §四 连锁 ×1.5，须等该单或按平铺口径先标（run1 教训：sim 与 runtime 口径漂移=阻断）。
