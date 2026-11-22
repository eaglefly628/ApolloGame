# G628-AVATAR-EDIT 本机候选

[全身编辑](http://127.0.0.1:18851/?scene=avatar-studio)支持三款原创脸部预设、纤瘦／匀称／圆润、戴帽与摘帽、圆手与宽掌，共 36 种组合。改动先进入草稿并即时预览。「应用」保存本次会话的外观并切到应用视图，「重置」只恢复草稿默认值。用「看已应用」和「回到预览」检查两份状态。离开或刷新场景后重新进入默认状态。

[五官编辑](http://127.0.0.1:18851/?scene=face-studio)仍可逐项搭配 81 种眼眉鼻嘴组合。它与全身草稿各自独立。三种体型的源模型和共享 BIN 与上一候选逐字节一致。[三种体型对照](http://127.0.0.1:18851/?scene=body-study)。

## 交互台

- [拿杯](http://127.0.0.1:18851/?scene=hands-lab)演示右手接近把手、提起和放回，最后离开把手。
- [按按钮](http://127.0.0.1:18851/?scene=hands-press)演示掌部接触按钮面、下压 22 毫米、回弹和离开。
- [递物](http://127.0.0.1:18851/?scene=hands-handoff)演示右手提杯、双手短暂共同接触、右手释放、左手放杯后释放。受递方是同一角色的另一只手。

各页都可选择三种体型和两种手形后播放。动作由离线两段手臂 IK 烘焙，在可播放模型内放入手部和道具的实际接触节点。详见[接触验证](hand-contact-validation.md)。尚待接入的项目为运行时持有权、碰撞触发、可移目标跟随和分指握持。

[Nintendo 官方功能对照](nintendo-feature-comparison.md)记录 Wii 和初代 Switch，表情只用 Game 628 原创搭配。[披风编辑器接口](cape-editor-contract.json)给布料线读取三档体型、双肩节点和试穿请求，开关由场景 Flag 与开关信号驱动。当前挂点是动态肩骨原点，披风局部偏移由布料样件拟合。

双击 [启动预览](start-face-preview.command) 可从隔离目录启动。已有 18830 候选、18848 LOCAL-FINAL 和 RC1 各自保留。本轮产物仅在本地验证。

## 复跑

从 ApolloGame 根目录执行。

```sh
node handoffs/game628-avatar-edit-20261120/face-studio-20261120/bake-hand-lab.mjs
node handoffs/game628-avatar-edit-20261120/face-studio-20261120/assemble-face-scenes.mjs
node_modules/.bin/vitest run -c handoffs/game628-avatar-edit-20261120/face-studio-20261120/vitest.config.mjs
node_modules/.bin/tsc -p handoffs/game628-avatar-edit-20261120/tsconfig.json --noEmit
node_modules/.bin/vite build -c handoffs/game628-avatar-edit-20261120/vite.config.mjs
node handoffs/game628-avatar-edit-20261120/face-studio-20261120/verify-browser.mjs
```

最后一项需要本机 Chrome 和 18851 预览运行。截图在 `evidence`。
