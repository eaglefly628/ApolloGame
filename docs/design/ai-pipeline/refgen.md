# T1 / R1 参考图生成

命令：`node scripts/ai-gen.mjs gpt-image-2.5 "保持建筑轮廓，改为夜晚" --edit docs/design/example/keyart/street.png --ref docs/design/example/keyart/palette.png --mock --json`。
`--ref` 后可跟多张 PNG，也可重复；提示词放在选项前。Seedream 同样支持；现有 qwen / tripo / meshy 不支持这些图像输入，明确拒绝，不会丢图退回文生。

密钥仅用 env `OPENAI_API_KEY`；缺 key 或显式 `--mock` 均有降级日志。CLI 仍只写待审区，绝不自动批准或写回游戏。`provenance.references` 按输入顺序记录 `{path,role:"edit"|"reference",sha256}`；哈希针对读入的原始字节，参考图 Buffer 不入账。mock 同时使用 prompt 与图哈希播种。

provider ID 为 `gpt-image-2.5`，默认 API 模型 `gpt-image-2.5-sunburst-2026-09-08`，可用 `OPENAI_IMAGE_MODEL` 配置。无图走 Images generations JSON，有图走 edits multipart（编辑底图在前、参考图随后），输出固定 PNG。带图只承诺提示式编辑，不增加蒙版接口。

协议来源（2026-10-16 核对）：[OpenAI 生成接口](https://developers.openai.com/api/reference/resources/images/methods/generate)、[编辑接口](https://developers.openai.com/api/reference/resources/images/methods/edit)、[Seedream 参考图协议](https://docs.volcengine.com/docs/ark/image-generation-api?lang=en)。真实付费接口未调用；协议由本地 fetch 替身验证，mock 全程零网络。
