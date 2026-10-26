# 画面参数绑定（REQ-3D-RENDER-BIND）

owner 2026-10-26 判 A（GAP-628-04），施工锁 ddfb85bfc。复用现有 ThreeRenderer、Signal 被动观测、相机缓动和 dissolve shader；不加 sim system，不扩展 effect-apply，不改游戏规则。组件是纯表现数据，登记 NON_DETERMINISTIC；Resource、Flag、Signal 保持原有确定性与消费语义。

## 数据闭集

同实体挂 `RenderBinding3D{bindings:[{target,source,range:[off,on],transition?}]}`。最多四条，每个 target 唯一；不能写任意组件路径、目标实体、表达式、脚本或 DOM。由 ThreeRenderer 解释，不注册虚假的 sim capability/provider；组件字典登记与 CameraShot3D 相同。

target 只接受：

| target | 载体 | 输出范围 |
|---|---|---|
| `Light3D.intensity` | 同实体 Light3D | 0..1e6 |
| `Material3D.dissolve.progress` | 同实体 Material3D.dissolve + Mesh3D 或 Model3D | 0..1 |
| `Vfx3D.rate` | 同实体 Vfx3D | 0..1e6 |
| `Glow3D.opacity` | 同实体 Glow3D | 0..1 |

`range` 两个有限端点都在目标范围内；允许反向，如溶解 `[1,0]`。绑定不会自动创建组件、材质或溶解配置；绑定的 dissolve 不允许同时声明旧式 trigger 自播，以免两个驱动抢同一输出。

source 只接受：

| source | 值与寻址 |
|---|---|
| `{kind:'resource-ratio',id}` | 创建序首个同 Resource.id；`clamp01((current-min)/(max-min))` |
| `{kind:'flag',id}` | 创建序首个同 Flag.id，false=0、true=1 |
| `{kind:'signal',on,off,arg?}` | 观察真实发布，on 置1、off置0；初始为0；`arg:'self'` 时只接受 Signal.arg 等于载体实体 id |
| `{kind:'hover'}` | 当前指针经既有 pick 射线命中该载体=1，否则0；需同体 Pickable3D |

名字/信号须非空且≤256字符，on/off 不能相同。源对象、绑定、数组、端点、缓动均是严格 plain data；未知字段、访问器、Symbol、洞、非有限数、重复目标与闭集外值原子拒收。Resource/Flag 允许动态生成，因此缺引用在链接器给警告，不阻断合法运行时创建；运行时缺失/坏值（含 Resource 非有限或 max≤min）一次明确 reject 日志，本帧用作者原值，恢复后重新建立数值基线。不以0掩盖数据错误。

`transition:{duration,ease?}`：duration 为0..600秒，缺省无缓动；ease 为既有 linear/cubicOut/inOut，缺省 linear。首次读取直接取目标值；后续目标变化从当前绝对时间采样值重新缓动到新目标。相同目标不会每次重启，重复 render 不改变轨迹，大时间跳可直接收敛，时钟倒退时重建当前目标基线。表现时间不写世界；持续变化与最后帧都进入渲染脏签名，静止后停止绘制。

```json
{
  "Light3D": { "kind": "point", "color": 16755760, "intensity": 2 },
  "Vfx3D": { "rate": 24 },
  "RenderBinding3D": {
    "bindings": [
      { "target": "Light3D.intensity", "source": { "kind": "resource-ratio", "id": "fuel" }, "range": [0.1, 2], "transition": { "duration": 0.2 } },
      { "target": "Vfx3D.rate", "source": { "kind": "resource-ratio", "id": "fuel" }, "range": [0, 24] }
    ]
  }
}
```

## 信号与生命周期

复用 World.observeComponents，不轮询帧末残存 Signal，不调用 consume/remove，不占 Recorder/Tracer 单槽。订阅前残存信号与 restore 出来的信号只作基线，不重播。同一绘制间隔发生多次 on/off 按实际发布顺序归约到最终状态，发布后立即 consume/destroy 仍被观察；持续帧不再次触发。相同目标的重复发布是幂等置位，不是 pulse 动画。动态添加绑定再发布信号可在同次 catch-up 内捕获，前提是该渲染器已至少观察过该 World 一次（与 CameraShot3D 相同）。

配置内容变化、移除、销毁/同 id 重建、restore、World 切换清旧私态；等值配置替换保留进行中的缓动。卸载取消监听。没有观测接口的自定义 IWorld 对 Signal 来源明确一次 reject 并保作者值，不伪称不漏信号。

hover 只在存在有效 hover 绑定时为 canvas 挂表现监听：pointermove 调用既有 pick；pointerleave、pointercancel、window blur、document hidden、目标隐藏/销毁/去组件、restore/World切换清除。触摸不会生成 hover，也不拦截点击，不改变 pick 返回结构，不向 sim 写 Flag/Signal。静止指针在每次渲染中复查上一张已显示画面的拾取数据，因此不依赖新增 pointermove 才能检测场景变化；不承诺亚帧追踪。无 hover 绑定不挂监听。

## 材质与帧内接入

绑定先生成私有只读覆盖，灯、辉光、VFX、渲染项收集和 dissolve 读取同帧值；未被覆盖的字段仍读原世界。源组件对象、快照、完整/增量 hash、writeSequence、dirty 不被修改。无绑定返回原 World，保留旧渲染路径；没有绑定的 Model3D 不新开溶解路径。

Material3D 的 materialRef 仍按现有资源目录重组；保留全部 inline 选项（含 dissolve），不把绑定输出丢掉。Mesh3D 有 dissolve 时沿用原独立 mesh 路，不把逐实体 uniform 塞进实例批。GLB 对该实例的每个子 mesh/多材质槽创建独立效果材质，注入既有 shader；保留 glTF 原材质属性，ModelPool 仍管理原实例材质及 tint。shader program key 含既有 dissolve 变体，防不同纹理/图案串编译缓存。

移除效果、模型替换或销毁时还原原实例材质，只释放效果 clone；不释放共享 geometry/map/模板。溶解仍遵循原 shader 的屏幕空间图案与阴影表现，不新增另一套渲染算法。

## 验证入口

CPU：`src/assembly/render-bindings.test.ts`、`src/renderer/three/{render-bindings,model-dissolve,hover}.test.ts`；同时复跑原 dissolve/material/environment/determinism 回归。真实 Chrome/WebGL：`TMPDIR=/private/tmp node scripts/verify-render-bindings-browser.mjs`，输出独立临时目录的 report 与截图，含真实 GLB 解析、GPU uniform、像素差、悬停与快照隔离、材质释放。几何只用于测试夹具，不充当游戏主角资产。

施工记录与唯一锚点撤修证据见 [Review 导航](./review/REQ-3D-RENDER-BIND.md)；施工完成不等于独立复查 PASS。
