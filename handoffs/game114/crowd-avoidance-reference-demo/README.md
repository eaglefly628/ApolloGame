# game114 群体规避参考 Demo

这是一份可脱离 ApolloGame 仓库运行的源码快照，面向需要复用「方格地图寻路 + 流场引导 + ORCA/RVO2 局部规避 + 圆形硬碰撞」的小组。`demo/` 是当前 16 头牛与 1 辆大车的交错往返场景；面板可将牛群翻倍到 32 头，显示路线、期望/规避速度矢量及流场/占用格。`src/` 只包含这份演示与验证脚本实际导入的引擎源码及其依赖。每个复制文件的原路径和 SHA-256 在 `SOURCE-MANIFEST.json`。

## 运行

需要 Node.js 20 或更新版本。解压后在本目录执行：

```sh
npm install
npm run dev
```

打开终端显示的本地地址（默认 `http://127.0.0.1:5187/`）。依赖安装后还可执行：

```sh
npm run build
npm run typecheck
npm run verify
npm test
```

`verify` 会分别连续模拟默认 16 头和压力测试 32 头各 1200 步，并将结果写到 `demo/navigation-verification.json` 与 `demo/stress-verification.json`。`npm test` 运行演示控制和 ORCA、网格、重寻路、圆形碰撞等能力的点名测试。重新做参数搜索可使用：

```sh
npx vite-node --config vite.config.mjs demo/tune-navigation.ts demo/tuning-candidates-16.json 1200 16
npx vite-node --config vite.config.mjs demo/tune-navigation.ts demo/tuning-candidates-32.json 1200 32
```

完整历史搜索结果在 `demo/navigation-tuning-results.json`。候选列表是完整参数值，可在本独立目录中重放旧基线。

## 源码入口

| 用途 | 源码 |
| --- | --- |
| 场景实体、路线、体型与配置 | `demo/scene.ts`、`demo/navigation.json` |
| 压力数量与流场/占用格调试 | `demo/scenario-controls.ts`、`demo/flow-debug-view.ts`、`demo/controls-ui.ts` |
| ORCA/RVO2 速度求解 | `src/skills/tier2/orca.ts` |
| 同拍快照、质量/久卡优先级、零速修正、扰动、最后缩半径 | `src/skills/tier2/crowd-avoidance.ts` |
| 流场混合与离线重寻路 | `src/skills/tier2/crowd-flow-guide.ts`、`src/skills/tier2/crowd-route-repath.ts` |
| Grid 与不同半径净空 | `src/skills/tier2/navigation-grid.ts`、`src/engine/protocol/components/navigation-grid.ts` |
| 流场、A*、路线意图 | `src/skills/tier2/flow-field-core.ts`、`src/skills/tier2/pathfind.ts`、`src/skills/tier2/path-follow.ts` |
| 实际移动与圆形硬碰撞 | `src/skills/tier1/motion-apply.ts`、`src/skills/tier2/collision-resolve.ts`、`src/skills/atoms/overlap-detect/` |

每一拍由 `PathFollow` 给出原路线方向；偏离路线时，流场和带动态占用软代价的 A* 可规划回原路线；ORCA 根据周围单位、体型及优先级选取局部速度；之后才执行移动与硬碰撞。连续卡住时先用确定性侧向扰动，缩小圆形碰撞体仅是最后兜底。所有可调参数均在 `CrowdAvoidance` / `NavigationGrid` 组件数据中，不需要在演示层复制另一套寻路器。

当前牛群采用 `timeHorizon: 37`、`repathDistance: 2.5`、`occupancyPenalty: 0.45`，静态道路/场地 cost 为 1/2。压力场景 1200 步内 31/32 头完成首次穿越、11/32 头完成返程，大车完成往返。该配置只针对本地图与密度实测；改动半径、速度或路线后，应重跑两档验证。

`src/skills/tier2/orca.ts` 是修改过的 RVO2 移植，文件头保留原作者、修改说明及 Apache-2.0 标识；许可文本在 `licenses/Apache-2.0.txt`。这份参考包不包含 npm 依赖或 ApolloGame 仓库的其他游戏，`npm install` 会单独安装运行依赖。
