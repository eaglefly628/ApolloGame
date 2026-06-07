# FYI（给 Programmer D / 任何动生成 prompt 的人）—— 生成 Prompt 的能力目录自动派生

> Lead 留。**已落地（apollo.py 大家都可改，改前 fetch+merge 即可）**，此文档记录契约 + 扩展点。
> 背景：apollo.py 的 `GAME_GEN_SYSTEM_PROMPT` 原本**手维护**、只列平台跳跃十来个能力，
> hitbox/prefab/dialogue 全缺 → **ARPG 战斗无法 NL 生成**，且每加能力都得手改 prompt（漂移，违"引擎自描述"）。
> 修法：从引擎 `ALL_CAPABILITIES` 的 describe 自动派生能力目录，注入 prompt。

## 契约（已实现，见下"当前状态"）

1. **引擎侧（Lead 所有，已落 `src/assembly/capability-catalog.ts`，4 测试）**
   `buildCapabilityCatalog(ALL_CAPABILITIES): string` —— 从每个能力的 `describe`(name/summary/whenToUse/examples)
   + `components.provides` 字段签名（含 `assetKey` 类型）自动派生 LLM 可读目录。纯函数、零依赖、可测。
   **任何能力一登记进注册表即自动进目录，零 prompt 维护。** 这是单一真相，请勿在别处再手列能力。

2. **前端 → 后端（接线）**
   `launcher.tsx` 的 `GameCreator.generate()` 在 `/api/generate` 请求体加 `catalog: buildCapabilityCatalog(ALL_CAPABILITIES)`。

3. **apollo.py（接线）**
   - `GAME_GEN_SYSTEM_PROMPT` 的能力清单段 = 占位符 `{CAPABILITY_CATALOG}`（其余 intro/rules/example 不变）。
   - `_FALLBACK_CATALOG`：前端没送 catalog 时的回退（原平台列表），保证旧/外部调用不破。
   - `call_llm(prompt, provider, model, catalog=None)`：`system = GAME_GEN_SYSTEM_PROMPT.replace('{CAPABILITY_CATALOG}', catalog or _FALLBACK_CATALOG)`，把 `system` 串进 5 个 `_call_*`。
   - `do_POST /api/generate`：`catalog = body.get('catalog')` → `call_llm(prompt, provider, model, catalog)`。

## 当前状态
- **已实现 + 推送（commit `4703733`），tsc / 582 测试 / build / apollo.py py_compile 全绿。**
- **未做（你按需）**：本环境无 LLM key，端到端"打字→出 ARPG"活链路未实跑；资产 key 校验（R9①，已就绪）尚未接进 launcher 热载。

## 你可能想调的点（apollo.py 归你的活面）
- prompt 的 rules/example 段是否要按 ARPG 补一条 few-shot（如 frost_nova prefab + hitbox 的最小例）——能显著提升弱模型命中率。
- catalog 体量（~全部能力）若 token 偏大，`buildCapabilityCatalog(caps, {withExamples:false})` 可减；或按 prompt 里游戏类型筛能力子集。
- 若你要重写这块：引擎侧 `buildCapabilityCatalog` 请复用（别再手列能力）。
