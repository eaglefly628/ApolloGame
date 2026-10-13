# game114 跨机器接续

2026-10-13 用户授权上传本轮改动，并明确另一台机器应从 `codex/mainbranch` 接续；本交接只收录 game114 演示、通用导航/避让能力、所需 3D 运动表现与相应文档/测试。共享工作树中 game112、game113 的未提交修改不属于本轮交接，也未被挪动。

## 在另一台机器运行

克隆仓库并切到 `codex/mainbranch`，在仓库根目录安装 `package-lock.json` 对应依赖：

```sh
npm ci
cd handoffs/game114/mechanism-sample
npm run dev
```

浏览器打开 `http://127.0.0.1:5187/`。启动是 64 头牛与一辆大车的高位俯视压力场景；按钮可翻倍到 128 头，或显示路线、规避矢量及流场。源码与重建方式见 [样例 README](mechanism-sample/README.md)。在样例目录运行 `npm run build`、`npm run verify:navigation`、`npm run verify:stress`、`npm run verify:battle` 可复验。

引擎入口为 `src/skills/tier2/crowd-avoidance.ts`、`navigation-grid.ts`、`crowd-flow-guide.ts`、`crowd-route-repath.ts`，组件/注册与渲染接线同提交；设计、独立复查及历史门禁记录在 `docs/design/game114/`。`crowd-avoidance-reference-demo/` 是较早 16/32 单位场景的独立参考包；当前 64/128 场景以 `mechanism-sample/` 为准。

原始交接中的 `engine-review/` 是旧引擎仓库快照，当前样例已直接引用本仓库引擎，故上传包不重复收录该 120 MB 快照；`transfer-manifest.json` 和 `TRANSFER-RESULT.md` 仍是 2026-10-09 本机原始交接的历史记录，不是本次远程文件清单。`node_modules` 与 `dist` 为可重建产物，也不收录。

本次提供的是移动、避让与密度演示；攻击、伤害及吞噬规则尚未实现。性能记录为无渲染模拟时间，不等同另一台机器的浏览器帧率。

## Codex 分支验证状态

本次 game114 接入在 `codex/mainbranch` 基线上通过 TypeScript 检查、根项目构建与 123 个导航/场景专项用例；交接 demo 的构建及导航、压力、64/128 单位验证也通过。全库测试为 5653 通过、1 失败、1 个空测试文件；失败来自该分支已有的 `games/game113/guide-art.ts` 相对路径跨界导入，空文件为 `tools/spritegen-export.test.mjs`。该跨界导入同时令 `scoped-gate --base origin/codex/mainbranch --run` 在 depcruise 步停止。两处均在本次 game114 提交前的 Codex 分支，未混入本轮 game113/spritegen 改动。此前同一份 game114 接入在 `claude/mainbranch` 基线上通过完整门禁（5586 个测试）。
