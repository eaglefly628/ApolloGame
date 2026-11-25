# Game 628 猫咖地板猫转身修订

[18855 试玩](http://127.0.0.1:18855/) · [同街景日夜回放](http://127.0.0.1:18855/qa/cat-review.html)

从游客入口确认角色。按 D 约 4 秒往猫咖走，在约 X 3.4、Z 2.6 停下等 11 秒。小猫先向右上踏板，原地抬脚换向，再朝左走回地面并转回起始朝向。两次换向期间平面根位保持原地。前后腿分别采用对应的屈曲方向，腿段改为收窄的锥形，脚掌保持水平。每帧由 Apollo 双骨求解离线烘焙，固定使用现有 6.5 厘米踏板。

18855 来自 18853 的静态包副本。正式试玩资源的唯一差异为 `cat-floor-cafe-visible.glb`，SHA-256 `582e39a8b97c2a06745dd0dabec48d033d2144136202b97ddc88f18664da2d63`。本轮不扩大到任意地形或其他两只猫的表情验收。

实机通过真实游客入口和 WASD 到猫咖。录像从原 `reference-walk` 街景入口以普通机位录制，两段使用相同站位和相机。白天 116 帧、夜景 103 帧，各约 13 秒，1920×678 完整画布。120 Hz 的独立 GLB 回放核对了出程与回程各 314 个移动帧、180° 掉头、两处转向四掌均有离地换脚，脚掌与台面或地面的误差及支撑滑移均小于 0.1 mm。结果见 `evidence/cafe-route-replay.json`。

从仓库根目录复跑：

```sh
node handoffs/game628-cat-turn-20261121/bake-cat.mjs
node handoffs/game628-cat-turn-20261121/expressions.mjs
node handoffs/game628-cat-turn-20261121/verify-cat-route.mjs
python3 handoffs/game628-cat-turn-20261121/check-recordings.py
python3 handoffs/game628-cat-turn-20261121/serve.py
```
