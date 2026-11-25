# Game628 河口入海小样 · 供 PM 与视觉总监复查

本地入口为 http://127.0.0.1:18834/?scene=estuary 。左右方向键或 A/D 沿岸行走，空格招呼。起点 x=-10，河口 x=4，栈道安全端点 x=10.15。当前浏览器停在入海处岸边。截图为本目录 estuary-mouth.jpg、estuary-bank.jpg。

范围为独立场景 JSON、离线生成器、隔离预览/构建配置和专项测试。宿主、角色资产、输入、LayoutNode、Mesh3D、Anim3D 都复用现有 Game628 与引擎。既有天气、街区、人物生产文件未在本轮修改。移除本目录和 ../public/scenes/estuary.json 即可撤回此小样，其他入口不会引用它。

## 已实现

1. 侧视 2.5D 河岸，摄像机保持固定朝向并横向跟随，到河口时限制跟随范围以保留河海交界。
2. 1.8米宽步道连续接上1.8米宽栈道。人物横向限界 [-11,10.15]，纵向锁定 z=2.45，栈道末端留0.35米站立余量。
3. 青绿色河水与蓝色海面按 x=4 连续相接。河面短线沿 +X 平移，海面纹理缓慢沿 Z 往复并上下起伏，岸边泡沫和入海边缘轻微运动。
4. 沙岸、浅草坡、芦苇、栏杆和指向入海处的小路牌提供基本尺度与动线。

## 实测与验证

- 专项 Vitest 3项通过。独立加载 manifest 和资产可达，校验 LayoutNode，1400 tick 验证两方向行走、端点限界、纵轴锁定和步道脚底余量。水面动画用引擎 anim3dField 验证河面向海、海面往复，以及河海面和步道栈道几何接缝连续。
- TypeScript 项目检查退出码0。
- 隔离 Vite 构建退出码0，输出本目录 dist。最终 JSON 已同步至 dist/scenes/estuary.json。保留共享 Jolt 的 node:module 外部化和大包提示。
- UI audit 在1060×760下为0重叠、0对比警告、0硬失败、0皮肤前提错误。该小样仅标题和操作说明，未加入装饰UI。
- 实际浏览器从起点向右走到安全端点，再向左返回入海处岸边。截图已保存，浏览器 warn/error 为空。
- 195个场景实体，水面与泡沫为有限数量的基础几何和实例化材质。目标设备GPU帧时尚未实测。

## 表现边界

河流、海浪和泡沫是纯渲染动画。当前采用有限矩形水面和简化岸线，流速固定，河海交界清晰但几何轮廓较硬。水体不对人物施力，没有潮汐、侵蚀或水体碰撞。美术仍是配色和动线候选，需要视觉总监评判侧视程度、河口轮廓和泡沫密度。角色复用当前旅行者候选。

## 复现命令

从仓库根目录运行：

```sh
node handoffs/game628-life-controls-20261117/estuary-20261120/assemble.mjs
./node_modules/.bin/vitest run --config handoffs/game628-life-controls-20261117/estuary-20261120/vitest.config.mjs
./node_modules/.bin/tsc -p handoffs/game628-life-controls-20261117/estuary-20261120/tsconfig.json --noEmit
./node_modules/.bin/vite build --config handoffs/game628-life-controls-20261117/estuary-20261120/vite.config.mjs
./node_modules/.bin/vite --config handoffs/game628-life-controls-20261117/estuary-20261120/vite.config.mjs
```

本轮没有提交、推送或修改权限认证。此交接供既有 Game628 PM+视觉总监统筹，再由 Dot 汇报 Jun。
