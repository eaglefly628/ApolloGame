# game-b 需求单（游戏级工作票·不占主池槽·工单随游戏走）

> 规矩同主池：done 迁 `docs/workflow/requests-archive.md`；引擎级缺口不写这里、走主池（满槽由 Lead 裁）。

## 待处理

### B-001 · 共享角色卡格式定稿 · [2026-07-17] · GD-B → **owner** · status: open · P1
> ⚖ 格式 owner 晚点给。game-b 消费方字段需求已交：`character-card-format-needs.md`——请定稿时合并；定稿后 PE-B 对齐 adapter（假设 schema 落差在 adapter 吸收）。

### B-002 · 语音：TTS 先行·真配音后备 · [2026-07-17·同日改口] · GD-B → GD-B（台词表）+ owner（将来可选配音） · status: open · P2
> ⚖ owner 同日更新：**音源包没有——先用语音合成发个音**。v1=TTS 档（speechSynthesis·ja-JP 朗读日文台词·参数见 voice-pack-spec §0）；GD-B 交台词表（B-005 并轨·日文列=朗读文本兼录音台本）。将来真人/AI 配音=可选升级，按 §1 规范灌入即换档。核心五键（strip_lose/riichi/ron/tsumo/deal_in）台词优先写。

### B-003 · 引擎缺口盘点与提单 · [2026-07-17] · GD-B → LEAD · status: **✅ done（2026-07-17·当日结·全文迁 requests-archive）** · P1
> 结论：a 语音端口=真缺口→已提主池 **REQ-VOICE-语音输出端口**（P1·腾槽=自撤 REQ-VN-退役入档）；b BT=游戏层 TS 记债不占池；c 机位/拾取=回驳已覆盖（Camera3D 运镜过渡+Pickable3D·capability-plan §2/§2.5 已记实名出处）。

### B-004 · S2 计划过审 + S1 卡代填 · [2026-07-17] · GD-B → **LEAD**（审）+ PE-B（落卡） · status: open · P1
> `capability-plan.md` 送审（⚖ TS 授权已记 §6）；过审后 S3 骨架开工（PE-B 领）。
> S1 立项卡：pipeline CLI 判"未知游戏"（library/public/src 三处均无·骨架前落不了卡）——PE-B 建骨架后**第一动作**原样执行：
> `node scripts/game-pipeline.mjs concept game-b --name "雀宴（工作名）" --pitch "俯视3D和风日麻陪打局：角色卡带主角与金钱入局，与三位姨太打一圈东风战，直击脱衣轻演出，结果带回局外" --refs "雀魂(规则完整度参照)·脱衣麻将品类(表现克制版)" --style "女性向二次元·和风夜宴·樱色暖灯·sakura-otome主题"`
> 落卡后 owner/Lead 补 S1 人门签。

### B-005 · 三姨太文案表+语音台词（copy.md） · [2026-07-17] · GD-B 自领 · status: open · P2
> 人设三轴已定（gdd §五）；S4 前交付：台词风格表+voice-manifest 中日对照+衣物件名终稿。

### B-006 · 麻将 AI 参考代码调研 · [2026-07-17] · GD-B → 施工期 PE-B · status: open · P3
> ⚖ owner：后面可能参考外部麻将 AI 代码。红线：只参考思路；落地=BT 数据+确定性解释器；外部代码许可证先审、不抄。
