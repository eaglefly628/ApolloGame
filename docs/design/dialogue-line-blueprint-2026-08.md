# 剧情基础线图纸（REQ-DIALOGUE · Lead 2026-08-03）

> owner 令：剧情向 Dialogue 能力按**基础设施级**建设，配齐 Sample 与 Template；服务「约会性单机超休闲」转型线
> （DokiWorld 角色卡为输入·伴侣小对局为主形态）。本图纸 = 派工唯一真相；数值双向契约段悬置等 owner 材料。

## 底账（2026-08-03 实证·不重复建设）

- **t3-dialogue v1.1.0 已完备，本线不改它**：DialogueScript 节点图（line/choice/check）+ State 游标 + Text 投影；
  requires 条件门、effects/setFlag、确定性骰检定全有。关键：输入接缝已为闭集 UI 预留——
  `dialogue.choose` 动作**兼收 arg 字符串**（`src/skills/tier3/dialogue.ts:137-146`），任何「按钮发 action+actionArg」
  的纯数据 UI 开箱即驱动对话，无需游戏 handler。
- **ui/vn 五件（React）= 禁区待退役**；但其 `VNBinding` 数据形状（dialogueEntityId/stats/flags/portrait，
  `src/ui/vn/types.ts:25-31`）设计正确，**继承进 M1 控件的数据契约**，代码不继承。
- 立绘现状：PortraitSlot 空占位；faceArt 系 PlayingCard 专属（不动）；character-card 桥（media/persona/tags）现成。

## 里程碑

### M1 · 闭集 VN 控件三件（PUI 域 · high · 本线第一步）

catalog 闭集新增三控件（沿 `panelTexture` 先例：guard + 点名测试 + `ui.md` 回填 + house 主题可皮）：

| 控件 | 投影（读世界） | 信号（写世界） |
|---|---|---|
| `dialog` 台词框 | 对话实体 Text/State→当前节点 speaker/text/emotion | 点击/按键 → `dialogue.advance` |
| `choiceList` 选项列表 | choice 节点 options + `optionAvailable` 可选性（灰显不可选项） | 选中 → `dialogue.choose` + arg=下标 |
| `portrait` 立绘槽 | art key（经资产索引）+ emotion 变体键 | 无（纯展示·表现层旁路） |

红线：控件 = 闭集纯数据；禁手写 React/DOM；typewriter 打字机等观感属控件渲染参数，不进 sim。
**退役令**：M1 验收过 → `ui/vn` 标 deprecated，PUI 出小单删除（防双轨并存）。

### M2 · 立绘/表情链（PUI+PA · medium）

emotion→资产 key 映射 = **纯数据表**（characterId × emotion → assetKey），接 character-card `media`；
缺图分级降级（指定情绪缺 → neutral → 剪影占位，绝不空白/报错）。资产生产走美术台账（等文生图真 key 只影响出图，不影响接线）。

### M3 · 伴侣在场件（PUI · medium）

`presence` = portrait + 表情 + 台词气泡的组合模板（进 `@ui/starters`，非新控件——用 M1 三件拼装）。
反应表 = 纯数据：gameEvent（win/lose/bigPlay/idle…）→ {emotion, 台词候选[]}（种子随机选行·persona 可加权）。
用途：给**非剧情小对局**（猜拳/抽牌/骰子）叠一层伴侣反应——转型线的差异化钩子。

### M4 · Sample + Template（M1-M3 后 · GD+PE 出样板 · PUI 出起手包）

- **Sample 示范游戏**（新 slug·owner 命名）：10 分钟微剧情（2 角色·1 次检定·2 结局）+ 1 个迷你对局（猜拳）串场
  ——「对话⇄小对局⇄数值」最小闭环实证；走八阶段板从 S1 起，验收剧本 GD 写。
- **Template 起手包**：`@ui/starters` 加「剧情起手屏」——dialog+choiceList+portrait+presence 已接线、
  advance/choose 信号全通、house 主题已挂，复制即跑（对标现有主菜单/结算起手包）。

### 悬置段 · DokiWorld 数值双向契约（等 owner 三样材料）

真角色卡 schema / 宿主运行时接口文档 / 「双人=玩家 vs 卡片伴侣」确认。材料到 → Lead 补此段（卡数值进玩法
resource 的映射 + 对局结果回写通道扩展，现状仅 `host.complete` 一锤子总分）。

## 纪律与验收

- 全程闭集数据；确定性（骰用世界 RandomSeed·录放一致）；表现层旁路不进 sim/hash；`ui/vn` 禁新增消费方。
- 顺序 M1 → (M2 ∥ M3) → M4；每步 Lead 对抗性验收（真浏览器截图必查）；游戏内容红线沿 game104 先例
  （全年龄缺省·内容温度等 owner 拍板后另记）。
