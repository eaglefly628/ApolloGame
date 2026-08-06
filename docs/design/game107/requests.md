# game107《逆位·深渊》· 需求 / 工单单一真相

> 本文件放 **game107 自己的工作票**（不占引擎 10 硬槽·CLAUDE.md「游戏级工单随游戏走」）。
> 引擎级缺口若确认必须下沉，再由 Lead 评审后升进 `docs/workflow/requests.md`。

---

## REQ-107-STATUSSET-资源见底置状态位 · 给 `t2-effect-apply` / `t2-self-rule` 的 do 闭集补 `set-status`/`clear-status` · [2026-08-05] · game107《逆位·深渊》属性防御系统带出 · status: **open（S2 卡口·未落地则属性破防只能退化为二元 combo）** · 优先级: P2 · 类型: 现有能力闭集补齐（非新能力）
> **要什么**：`t2-effect-apply` 的 `Effect.kind` 与 `t2-self-rule` 的 `SelfRule.do[].kind` 各补两项 —— `set-status{mask}` / `clear-status{mask}`（写目标 `Status.flags` 位）。二者现有闭集已是 `set-flag`/`set-state`/`modify-resource`/`destroy`，本项**同形状加两条**，不新增组件、不新增能力。
> **为什么需要**：`t2-hitbox` 的门控读的是 `Status.flags`（`requireMask`/`setMask`/`clearMask`），但**全库没有任何能力能把「某个 Resource 见底」变成 Status 位**——`effect-apply`/`self-rule` 只能写 `Flag`/`State`，与 `Status` 不互通。于是「**防御条被打空 → 后续伤害才落到 HP**」这一环断了。
> **为什么不能重组**（已按核心规则逐条核过）：① `Hitbox` 的资源门只有 hp 专用的 `requireHpFracBelow/Above`，不能门控任意 Resource；② `Status` 位目前只有 `hitbox`(setMask/clearMask) 与 `over-time` 会写，二者都由「命中/计时」驱动，无法由「资源阈值」驱动；③ 用 `Flag` 替代不行——`Hitbox` 不读 `Flag`。**链路缺的就是 Flag→Status 这一跳。**
> **通用性（非游戏专属）**：任何「破盾/破甲/破韧性后进入虚弱」的战斗设计同吃——魂系削韧、MOBA 护盾、塔防护甲层、Boss 阶段门。是 `Condition→Event→Effect` 三段式在 Status 维度上的补齐，属既有设计的对称缺口。
> **替代方案（若 Lead 更倾向改 hitbox 侧）**：给 `Hitbox` 加通用 `requireResourceAtOrBelow{id,value}`（泛化现有 hp 专用门）。二选一即可，GD 倾向前者（更通用、受益面更广）。
> **边界（防加宽）**：**不含**百分比抗性乘算（game107 明确不做隐形乘数，走可见的防御条）、**不含**新的伤害类型通道（属性用 `Resource` 一条一条表达即可）。允许触碰：`src/skills/tier2/effect-apply.ts` + `self-rule.ts` + registry describe + 点名测试 + `docs/playbooks/combat.md` 回填一行。
> **降级方案（未落地时）**：game107 退化为「二元状态叠加 combo」（`Hitbox.setMask`+`requireMask`，registry「冰霜新星→碎冰重锤」同款），可跑但失去「防御条数值可见 + 逐点剥防」的核心读面板体验。
> **⚖ Lead 下沉裁决（2026-08-05）：照准 A 案**——effect-apply/self-rule do 闭集同形补 set-status/clear-status 两条（对称缺口论证成立·Status 位现仅命中/计时可写=资源阈值驱动链确缺）；B 案（hitbox 泛化资源门）不采——A 受益面更广且零碰 hitbox 语义。**指派待排（high·战斗核邻接·随下一批施工窗）**。
> 消费方与验收语义：`docs/design/game107/{gdd.md §4.2 属性防御, capability-plan.md §5.5}`。
> **⚖ 状态（owner 2026-08-05 令）**：**从引擎池废除、降级存此**——理由=**game107 尚未开工**，
> 此单是 S2 送审阶段预判的缺口，无现役游戏被它阻塞，占引擎硬槽不合理（先清后加铁律）。
> **spec 原文完整保留在上**，等 107 真开工时：先按核心规则重核一遍「能不能用现有闭集重组」
> （半年内库可能已长出等价件），确认仍是真缺口再升回引擎池、由 Lead 评审派工。
