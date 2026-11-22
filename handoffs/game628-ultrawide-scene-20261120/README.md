# Game 628 梧桐街超宽屏联验

工单 G628-UW-SCENE。以 `game628-life-controls-20261117` 的运行包为底，场景构建、资源和 QA 保存在本目录。独立预览运行在 `127.0.0.1:18845`。

## 本机启动和同源挂载

从 ApolloGame 根目录运行：

```sh
python3 handoffs/game628-ultrawide-scene-20261120/serve.py
```

- 梧桐街试玩 [reference-walk](http://127.0.0.1:18845/prototype?scene=reference-walk)
- 路人街景 [crowd-street](http://127.0.0.1:18845/prototype?scene=crowd-street)
- NPC 捏脸 [face-studio](http://127.0.0.1:18845/prototype?scene=face-studio)
- 同源测试页 [嵌入和全屏](http://127.0.0.1:18845/qa/embed.html)

`dist/` 是约 415 MB 的完整静态包。UI 宿主按原路径同源提供 `/assets/`、`/scenes/` 和 `/art/`。将 `/prototype` 映射到 `dist/index.html` 并保留 query。包中也提供 `dist/prototype/index.html`。现有 `reference-walk` 别名加载 `crowd-street`。启动器附带的 `/qa` 和日夜测试场景只用于本机验证，UI 挂载只需 `dist`。

## 取景和限界

- 梧桐街超宽采用居中透视侧视。相机 yaw 0，pitch 0.135 rad，distance 23，pivot (0, 3.2, 1.6)。垂直 FOV 随世界画布的真实比例计算，世界画布宽高与投影比例同步。
- 两端补齐铺地、路沿和立面，最外侧铺地 X 到 ±19.90。原实体、物理边界和其他场景数据经对比一致。四张现有场景清单各追加 79 个渲染实体和取景参数。主角中心允许范围 X ±8.95、Z 0.80–3.80，物理外界 X ±9.20、Z 0.55–4.05。
- 根画面上限为视口高度的 2.39 倍。5120×1440 时内容居中，左右各约 839 CSS px，边幅是低对比的暖灰渐变。同一侧视取景用于默认站位、两端、靠店面。窄于世界画布比例 1.7 时恢复原机位。

## 本轮验证

| CSS 视口 | 世界画布 CSS / 本轮 DPR 1 像素 | 方式 |
| --- | --- | --- |
| 2560×1440 | 2560×1200 | 顶层视口 |
| 3440×1440 | 3440×1200 | 顶层视口复核和精确尺寸同源 iframe |
| 5120×1440 | 3442×1200 | 精确尺寸同源 iframe |

- 每档覆盖日夜和四个站位，共 24 项。默认 (-1.6, 2.6)、西端 (-8.95, 2.6)、东端 (8.95, 2.6)、靠店面 (4.1, 0.9)，坐标单位为米。截图实际像素、画布尺寸和嵌入采样的主角坐标/FOV 见 `evidence/viewport-results.json`。
- 同源挂载保持 `/prototype?scene=reference-walk`。连续调整外层宽度 1600 → 2460 → 3440，画布均更新。点击全屏后 iframe 成为 Fullscreen API 元素，进入 3440×1440，画布 3440×1200。见 `evidence/resize-fullscreen.json`。
- 21:9 通过浏览器 QA 页向同一输入监听器按下 D、W，主角由 (-1.6, 2.6) 移至 (-0.48, 2.6)，再移至 (-0.48, 1.54)。边界站位由 QA 场景预置。捏脸入口完成模型预热，见 `evidence/face-studio.json`。
- TypeScript 检查、Vite 构建、清单差异、静态资源存在性和本机 HTTP 200 均已验证。共享引擎、端口 18829/18839 和冻结 RC1 未改动。

应用内 Chrome/Chromium 会话模拟了 CSS 视口。独立 Chrome 控制连接不可用，未验证物理超宽显示器和 GPU 性能。应用内浏览器顶层视口上限为 4096 CSS px，截图还有独立的裁切上限。带 `-full-` 的文件是等比缩放后的同源视图，原始证据截图尺寸以 JSON 为准。32:9 截图能看到完整游戏画布，部分外围边幅会被截图工具裁切。文件名 `4096-limit-*` 对应顶层上限诊断。此处为场景线自验，待 PM 和 UI 同源联验。

如需重建，在本目录运行：

```sh
npx tsc --noEmit -p tsconfig.json
npx vite build --config vite.config.mjs
mkdir -p dist/prototype
cp dist/index.html dist/prototype/index.html
```
