# Game112 · 高保真二维动态猫样机

日期：2026-09-30
状态：第一版已接入运行时

## 当前结论

本版实现的是 **Live2D 风格的高保真二维动态猫**，不是 Cubism `.moc3` 骨骼模型。它先验证最重要的产品感受：同一只猫能以透明角色层待在固定镜头房间里，按房间尺度行走、转身、回应玩家，并且不破坏 Apollo 的数据驱动边界。

## 已落地

- 雪团四帧透明行走条：`game112/cat/xuetuan-walk`。
- 通用 `Image.sprite`：输入 `{frames,fps,frameAspect}`，解释横向单行序列帧；游戏不写 CSS 或 DOM。
- 通用 `layout.anim:'patrol'`：复用 `animDist/animMs`，缓慢走出、端点翻面、走回猫位。
- 十个房间分别用 `RoomSpec.catSpot + catPatrol` 标定尺寸、起点、行程和周期。
- 玩家呼唤猫时，行走循环停下并切换到 `notice` 姿态；sim 仍只负责姿态状态，动画只做投影。

## 视觉回退

`walk` 序列条 → `notice/rest` 透明锚图 → 程序化 SVG。资源缺失时不影响游戏进入与交互。

## 与真正 Live2D 的差别

真正 Cubism 方案还需要一套分层源文件与绑定数据：头、耳、眼睑、瞳孔、嘴、躯干、前后腿、尾巴、毛发遮罩，以及呼吸/眨眼/耳动/尾摆参数。当前 AI 生成的扁平 PNG 不能无损地自动变成可信的骨骼模型。

下一阶段应先补 `idle` 微动作条（呼吸、眨眼、耳动、尾尖摆动）和 `turn/settle` 过渡，再决定是否把用户上传猫照片送进“分层重建 → 自动绑点 → Cubism 导出”的生成管线。房间巡游这条运行时接口不需要推倒重写。

## 资产生成说明

- 模式：OpenAI 内置图像生成。
- 参考：`public/games/game112/art/cat/xuetuan-rest-v1.png`，只锁定雪团身份、花色、比例与蓝眼特征。
- 最终提示词已随资产写入 `public/games/game112/art/index.json` 的 provenance。
