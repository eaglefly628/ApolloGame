# game-b 语音包规范 · 命名 + 事件台账（owner 自备音源用）

> GD-B 2026-07-17 出。⚖ owner 拍板：语音音源**自备**（真人录音或自行生成的日语 wav）；引擎侧只做采样播放端口（缺口单·capability-plan §2.5-a）。端口未落地前所有语音事件以合成提示音+中文字幕占位——**事件键先行，音源随到随灌**。

## 1. 文件规范

- 路径与命名：`voice/<charId>/<event>_<序号2位>.wav`（例 `voice/aya/riichi_01.wav`；同事件多变体随机轮播·种子 PRNG 选取）。
- 格式：wav·44.1kHz·16bit·mono；响度基準 -16 LUFS（±2）；首尾静音 ≤80ms。
- charId v1：`aya`（大姨太·绫）/ `rise`（二姨太·莉世）/ `sayo`（三姨太·小夜）/ 主角=角色卡 voicePack 引用（可缺）。

## 2. 事件键闭集（v1·每键建议变体数）

| event | 时机 | 建议变体 |
|---|---|---|
| greet | 开局入席问候 | 2 |
| dice | 掷骰起亲 | 1 |
| draw_think | 摸牌思考（低频闲聊·冷却 ≥2 巡） | 3 |
| chi / pon / kan | 鸣牌宣言（吃/碰/杠） | 各 1-2 |
| riichi | 立直宣言 | 2 |
| ron / tsumo | 荣和/自摸宣言 | 各 2 |
| win_big | 满贯以上和了追加感叹 | 1 |
| deal_in | 自己放铳懊恼 | 2 |
| strip_lose | **被直击脱衣**（演出条主台词） | 3 |
| strip_taunt | 目睹他家脱衣（轻挑逗·可选） | 2 |
| bust | 被击飞 | 1 |
| lose_round / win_round | 单局小结（点数最低/最高·可选） | 各 1 |
| final_top / final_bottom | 终局顺位首/末 | 各 1 |
| idle | 长考催促（≥15s·冷却长） | 2 |

- 键闭集与立绘触发闭集（场景交接档 §三）同源；新增键=改本表+台账，不散写。

## 3. 台账（交付清单·GD 文案表随 copy.md 出中日对照台词）

- 台账文件：`docs/design/game-b/voice-manifest.jsonc`（施工期建）——行=charId×event×序号×日文台词×中文字幕×状态（missing/placeholder/filled）。
- 验收口径：S6 前 `strip_lose/riichi/ron/tsumo/deal_in` 五键必须 filled（核心体验键）；其余可 placeholder 渐进补。
- 版权口径：音源包由 owner 提供并保证授权链（真人声优合同或生成服务商用条款）；provenance 记来源与日期。
