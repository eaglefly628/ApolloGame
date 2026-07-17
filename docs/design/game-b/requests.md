# game-b 需求单（游戏级工作票·不占主池槽·工单随游戏走）

> 规矩同主池：done 迁 `docs/workflow/requests-archive.md`；引擎级缺口不写这里、走主池（满槽由 Lead 裁）。

## 待处理

### B-001 · 共享角色卡格式定稿 · [2026-07-17] · GD-B → **owner** · status: open · P1
> ⚖ 格式 owner 晚点给。game-b 消费方字段需求已交：`character-card-format-needs.md`——请定稿时合并；定稿后 PE-B 对齐 adapter（假设 schema 落差在 adapter 吸收）。

### B-002 · 日语音源包 · [2026-07-17] · GD-B → **owner** · status: open · P2
> ⚖ owner 自备。规范与事件键=`voice-pack-spec.md`；核心五键（strip_lose/riichi/ron/tsumo/deal_in）优先。不阻塞开发（占位音+字幕先行）。

### B-003 · 引擎缺口三件提单跟踪 · [2026-07-17] · GD-B → **LEAD**（S2 审时裁槽） · status: open · P1
> capability-plan §2.5：a 采样音频播放端口（语音刚需）/ b BT 解释器（游戏层 TS 先行·记下沉债）/ c Camera3D 机位表切换语义（先查 registry 现有语义，缺再提 requests-3d）。主池 10/10 满——按"先清后加"由 Lead 排槽（GD-B 昨日 P3 去腐单可让位）。

### B-004 · S2 计划过审 + S1 卡代填 · [2026-07-17] · GD-B → **LEAD**（审）+ PE-B（落卡） · status: open · P1
> `capability-plan.md` 送审（⚖ TS 授权已记 §6）；过审后 S3 骨架开工（PE-B 领）。
> S1 立项卡：pipeline CLI 判"未知游戏"（library/public/src 三处均无·骨架前落不了卡）——PE-B 建骨架后**第一动作**原样执行：
> `node scripts/game-pipeline.mjs concept game-b --name "雀宴（工作名）" --pitch "俯视3D和风日麻陪打局：角色卡带主角与金钱入局，与三位姨太打一圈东风战，直击脱衣轻演出，结果带回局外" --refs "雀魂(规则完整度参照)·脱衣麻将品类(表现克制版)" --style "女性向二次元·和风夜宴·樱色暖灯·sakura-otome主题"`
> 落卡后 owner/Lead 补 S1 人门签。

### B-005 · 三姨太文案表+语音台词（copy.md） · [2026-07-17] · GD-B 自领 · status: open · P2
> 人设三轴已定（gdd §五）；S4 前交付：台词风格表+voice-manifest 中日对照+衣物件名终稿。

### B-006 · 麻将 AI 参考代码调研 · [2026-07-17] · GD-B → 施工期 PE-B · status: open · P3
> ⚖ owner：后面可能参考外部麻将 AI 代码。红线：只参考思路；落地=BT 数据+确定性解释器；外部代码许可证先审、不抄。
