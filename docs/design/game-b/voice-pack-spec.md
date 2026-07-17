# game-b 语音规范 · 事件键 + TTS 先行 + 采样台账

> GD-B 2026-07-17 出·同日更新。⚖ owner：**音源包暂无——先用语音合成（TTS）发个音**。语音走**两档制**（capability-plan §2.5-a 语音输出端口）：
> - **档① TTS 即时（v1 默认）**：浏览器 speechSynthesis 选 ja-JP 音色朗读 §3 台账里的**日文台词列**——零资产零 key；无日语音色的环境降级为合成提示音+字幕。§2 事件键与 §3 台账**现在就为 TTS 服务**（日文列=朗读文本）。
> - **档② 采样 wav（将来升级）**：真人/AI 配音到位后按 §1 文件规范灌入，同事件键无缝替换；日文列摇身变录音台本，一表两用。

## 0. TTS 档参数（v1）

- 每角色一组 TTS 参数（数据）：`{ lang:'ja-JP', voiceHint?: 名称匹配串, rate, pitch }`——三姨太靠 rate/pitch 差异化（⚙ 绫=rate0.9/pitch0.95 沉稳·莉世=rate1.15/pitch1.1 泼辣·小夜=rate1.0/pitch1.25 娇憨·施工期试听调）。
- 主角卡 voicePack 缺省时同走 TTS（卡片 personality.style 映射一组参数）。
- 红线：TTS=表现层旁路（不进 sim/回放）；端口=引擎 services（LEAD 域），游戏层不直调 speechSynthesis。

## 1. 文件规范（档②·将来用）

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
