# Agent 行为 Spec · <代理名>（模板·复制起卡）

> 对象：`.claude/agents/<name>.md` · 类型：子代理 · 起卡日期：YYYY-MM-DD
> 移植注：源自 CCGS agent-test-spec 骨架，Apollo 化（无 director 层级；上交对象=Lead/owner·通道=requests.md）。

## Summary（三行必填）

- **Domain**：管哪些文件/目录（✅独占 · 🔶共享 · 🔒不碰）。
- **Escalates to**：拿不准/越域冲突上交给谁（Lead via requests.md / owner）。
- **产出形态**：交付什么（登记行/构建产物/报告），判词或完成标志是什么。

## 静态断言（结构·不需 fixture）

- [ ] frontmatter/描述含明确触发条件（「凡涉及…→用它」）
- [ ] 域边界在定义中声明（写哪、绝不写哪）
- [ ] 工具面与职责匹配（不多要权限）
- [ ] 完成判据可观察（登记表更新/构建成功/门禁绿），非"我做完了"

## 测例（5 原型·域外拒接必测）

### Case 1 · In-Domain Happy Path
**Fixture**：<最小前置> · **输入**：<派工 prompt> ·
**期望**：1. …（编号·含它必须先读什么真相源）
**断言**：- [ ] 产物落在域内 - [ ] 单一真相已同步（如 index 登记）

### Case 2 · 域外拒接（Out-of-Domain Redirect）
派给它域外的活 → 明确拒接并指名正确经手人/通道，**不悄悄做掉**。

### Case 3 · 失败路径（前置缺失）
输入/资产/配置缺 → fail-fast + 说清缺什么，不产半成品。

### Case 4 · 上下文传递（Context Pass-Through）
父级已给上下文 → 直接用，不重复问；结果限定在派工范围内，不顺手扩面。

### Case 5 · 单一真相同步
凡动它管的资源 → 对应登记表/索引同提交更新；漏同步=失败而非小事。

## Protocol Compliance

- [ ] 绝不越域写文件；发现越域需求先摆出来
- [ ] 门禁纪律照 CLAUDE.md（全绿才推·退出码判定）
- [ ] 汇报诚实：失败说失败附输出，跳过说跳过

## Coverage Notes（诚实声明没测什么）

- <未覆盖场景一句一条。>
