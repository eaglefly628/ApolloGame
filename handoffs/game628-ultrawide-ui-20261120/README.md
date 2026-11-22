# G628-UW-UI · 《小生活》超宽屏 UI 联验

本机入口 <http://127.0.0.1:18844/>。在 ApolloGame 根目录启动，保持终端开启。App 项目 ID 为 `22c64537-de6b-4a09-9739-d4812eceb7f3`。

```sh
./handoffs/game628-ultrawide-ui-20261120/start.command
```

联验时停止上一个 18844 实例，再用场景线给出的 **绝对路径** 启动同一个入口。路径指向含 `index.html` 的静态构建目录。

```sh
GAME628_PROTOTYPE_DIST="/绝对路径/场景线/dist" ./handoffs/game628-ultrawide-ui-20261120/start.command
```

默认指向 `handoffs/game628-life-controls-20261117/dist`。同源 `/prototype?scene=face-studio` 和 `/prototype?scene=reference-walk` 加载该目录的 index，`/art/`、`/assets/`、`/scenes/` 也指向该目录。兼容入口仍需现有场景查询参数和 `window.apolloPrototype` 就绪接口。可加 `--no-browser` 仅启动服务。

## 这次改动

- 2:1 及更宽、且宽度至少 1100 CSS px 的视口，将入口和登录卡放到中心。16:9 保留入口左侧，窄窗维持自然收缩。外层入口上限 470 px。超宽捏脸 iframe 内的标题和五官选项区居中，上限 760 px。确认栏与试玩 HUD 外壳上限 650 px。
- 菜单和设置居中，上限 370 px。页面使用安全区与基础边距，矮窗弹层可滚。场景 iframe 保持全宽，交给场景线决定世界取景。
- 模态层锁定背景焦点，Tab 与 Shift+Tab 循环，Esc、继续游戏及返回标题落到对应焦点。返回设置时，焦点回到打开它的设置按钮，分别覆盖底栏和菜单两个入口。
- 本目录以原 18841 Demo 为基线。18841、发布 RC1、场景源及共享引擎文件均未改动。无提交、推送或发布。

## 复跑与范围

```sh
./node_modules/.bin/vite build --config handoffs/game628-ultrawide-ui-20261120/vite.config.mjs
./node_modules/.bin/tsc -p handoffs/game628-ultrawide-ui-20261120/tsconfig.json --noEmit
G628_SKIP_FULLSCREEN=1 node handoffs/game628-ultrawide-ui-20261120/verify.mjs
node handoffs/game628-ultrawide-ui-20261120/probe-fullscreen.mjs
```

`evidence/verification*.json` 记录每档实际 `innerWidth/innerHeight`、截图 PNG 像素、面板矩形、实时缩放、全屏进入与退出结果和网络错误。截图为本机 macOS 的 Chrome 自动化视口，DPR 1。`evidence/fullscreen.json` 记录 Chrome 窗口状态进入全屏后返回 normal，自动化 CSS 视口保持 3440×1440。网页 Fullscreen API 在本机自动化环境返回 `TypeError: not granted`，因此网站全屏与物理窗口仍待人工验证。无物理超宽显示器、真实刘海或高 DPI 认定。Chrome 可用软件 WebGL，截图验证不构成独立 GPU 性能、帧率或 Mac 原生全屏验收。

现有试玩边界仍适用。捏脸选择随本轮入口读取，街道仍使用场景原型角色，菜单锁玩家输入，世界动画继续。场景线独立 dist 接入和 PM 联验待验。
