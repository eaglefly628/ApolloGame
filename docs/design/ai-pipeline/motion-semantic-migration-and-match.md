# M2 标签迁移与 M4 剧本匹配

施工主体：当前 Codex motion-semantics-next session。2026-10-31，owner 授权继续第 2 项。状态：施工中。

## 实查与范围

实查现有 motion-semantics / motion-semantic-drafts / motion-semantic-query、motion-match、motion-review-next-contract 与资产手册。复用共享来源词典和提取器、POSIX 固定目录事务、已复核查询；不增加游戏 system 或第二套分类器。Q1 由 owner 确认已复核。

- M2：显式从旧有效库迁移到已准备新 catalog 的独立新版库，默认只读预演。旧 catalog、日志、head 和原始资产不改不删。完整保留历史字节；只转移完全一致的动作行事件，变化/移除动作列待重审。propose/flag 仍不是批准，不实现伪造 human accept。新侧车原子发布；冲突、中断、残留暂存拒收并保留现场，不自动清锁。
- M4：显式 JSON 闭集约束消费共享来源标签和证据，查询纯只读。必需条件、禁止条件未知、疑问标签、明确冲突、组合不匹配各自返回原因；缺口不伪造成现成 clip。保留原 motion-match 兼容入口，新增显式语义/剧情入口供 AI 使用，不靠中文正则偷做分类。
- 真库验收：只读生成本地审计和剧本匹配报告；迁移写入只在合成临时库及隔离副本验证，真实数据和报告不上传。

代码/合成测试/文档可上传；真实 catalog、模型、标签侧车与生成报告不进 Git。完成需专项、独立复核、撤修验红与完整门禁。
