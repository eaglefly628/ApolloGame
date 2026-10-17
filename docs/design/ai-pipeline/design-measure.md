# 通用设计量稿（U2）

`scripts/design-measure.mjs` 与 R1 UI 对照使用同一把浏览器尺子，不给测量结果加通过阈值。

```sh
node scripts/design-measure.mjs <slug>
node scripts/design-measure.mjs <slug> --root /absolute/repo --mock
```

默认读取 `docs/design/<slug>/ui-refs/index.html`，输出 `docs/design/<slug>/design-ref/measure.json` 和 `dc-<state.id>.png`。无配置时只量一个 `default` 态，画布为 1920×1080。配置文件为 `docs/design/<slug>/design-measure.json`：

```json
{
  "source": "docs/design/demo/ui-refs",
  "entry": "menu.dc.html",
  "canvas": { "width": 1920, "height": 1080, "selector": "#stage" },
  "states": [{ "id": "menu", "label": "主菜单" }],
  "items": [
    { "id": "start", "selector": "[data-item=start]" },
    { "id": "title", "selector": "h1" }
  ]
}
```

- `source` 是仓根下的相对目录；`entry` 是 source 内的相对 HTML 路径。禁止绝对路径、路径越界和指向目录外的符号链接。静态服务器只提供 GET / HEAD，不执行源码文件。
- `canvas.selector` 可省略；省略时寻找内联尺寸等于 width/height 的舞台。显式 selector 必须只命中一个舞台。测量值扣除舞台位置，再分别消除 X / Y 实际缩放；适用于舞台平移和缩放，不声称支持旋转或透视舞台。
- `states[].id` 唯一，作为截图文件名；有 `label` 时精确点击同文案的唯一 button，再测该态。无 label 时直接测当前页面。配置应只声明页面实际存在的按钮。
- `items` 可省略，省略时按原 game108 行为遍历舞台后代、忽略屏幕尺寸小于 2px 的元素。指定 items 时，按 id 配对；每个 selector 必须在舞台中恰好命中一个可见元素，否则拒收，避免缺件被当成零差异。
- `measure.json` 的真实测量格式为 `{ "<state.label 或 id>": [box, ...] }`。box 字段为 `tag,text,x,y,w,h,bg,color,font,border,radius`；配置 items 时额外带 `id`。`bg` 保留 computed background image（截前 60 字）或 background color；`color` 为 computed 文本颜色，不是视觉像素平均值。

浏览器沿用公共 `detectBrowserRuntime`；可通过 `RENDER_PROBE_CHROMIUM=/absolute/chrome` 指定本机 Chromium。缺浏览器退出码为 3，输入或测量失败为 1。`DC_VENDOR` 可提供本地 `react.js` / `react-dom.js` / `babel.js`，对接现有 Design 稿的 `window.__resources` 逃生口。设计稿还可能依赖字体或远程资源；失败会记录日志，真实画面需要截图查看。

`--mock` 不启动浏览器、不联网、不写真实基准，而在 `design-ref/mock/measure.json` 写 `mock:true`、说明与各态空数组。不生成模拟截图，不把空数组冒充真实量稿。mock 可用于离线贯通工作区与命令行协议，不能验证视觉。

## game108 兼容

`node scripts/game108-design-measure.mjs` 是相同 runner 的兼容入口。未放配置时：

- source = `games/game108/design_handoff_rule_of_three_battle`；entry = `design/battle-screen.dc.html`。
- OUT = `docs/design/game108/design-ref`；viewport = 1960×1400；保留初始化等待与点击后的等待。
- 五个页签及 JSON 键为 `T1 蓄力`、`T2 出招`、`T3 对决`、`T4 结算`、`终局`。
- 截图名按原脚本实际行为：`dc-T1.png` 至 `dc-T4.png`，以及 `dc-终局.png`。
- 未配置 items 时 box 不新增 id，measure.json 顶层也不新增元数据。旧稿找不到页签时仍告警跳过。

## 公共接口与施工验证

`measureDocument(opts)` 是自包含的浏览器函数，可通过 VM DOM 夹具验证；`measurePage(page, opts)` 将同一函数传给 Playwright。opts 为 `{ width=1920, height=1080, stageSelector?, items? }`，返回 `{scale,count,boxes}`，scale 保持原脚本的横向缩放值。`runDesignMeasure(slug, options)` 支持 `{root,mock,env,vendor}`；生产根目录默认按脚本位置解析，不依赖命令执行目录。

```sh
npx vitest run scripts/design-measure.test.mjs
```

用例覆盖变换后的坐标/大小/颜色真值、旧 JSON 字段协议、缺失和重复元素、路径与符号链接拒收、只读静态请求、mock 隔离和原命令入口。测试不需要浏览器或监听网络端口；它们是施工自证，正式交叉复查仍由另一人执行。

撤修验红施工记录（2026-10-17）：在临时副本中断言 `x: Math.round((r.left - sr.left) / kx)` 恰好出现一次，将其改为除以 `1`；只跑 `measures real position` 用例。退出码 1，断言明确显示 `x` 期望 200、实际 100；原施工文件未动。红灯日志 `/private/tmp/aiflow-u2-retraction-red.log`。恢复后的 28 项定向用例退出码 0；其中浏览器 driver 与监听器采用桩，真实浏览器画面未以此宣称验证。
