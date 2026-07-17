# 共享角色卡格式 · game-b 消费方字段需求清单

> GD-B 2026-07-17 出。⚖ owner：主角（及可能的其他角色）从**共享角色卡**传入，格式未定、大家共享、晚点给。
> 本文=game-b 作为**消费方**对该格式的字段需求——供 owner 定共享格式时合并；格式定稿前 game-b 按 §3 假设 schema 开发，落差在 adapter 层吸收（不改游戏核）。

## 1. 必需字段（缺了 game-b 没法用）

| 字段 | 形态需求 | game-b 用途 |
|---|---|---|
| id | 稳定唯一串 | 席位绑定/结果回传对账 |
| name | 显示名（中文或原名+读音） | 席位卡/台词称呼 |
| avatar | 方图 ≥256px·真 alpha 或不透明均可 | 席位卡头像 |
| portrait | 竖构图半身~七分身 ≥1024px 高·**真 alpha PNG**（假棋盘格透明拒收·可走引擎导入抠图线） | 演出立绘浮层 |

## 2. 可选字段（有则更好·无则优雅降级）

| 字段 | 形态需求 | 降级行为 |
|---|---|---|
| portraits[]（衣着多档） | 同角色 3 档立绘数组（整齐/微乱/最终档点到为止）+档位序号 | 缺→单张立绘·脱衣只走轻表示 |
| voicePack | 语音包引用（事件命名对齐 `voice-pack-spec.md`） | 缺→合成提示音+字幕 |
| personality | 牌风参数：攻/防/鸣牌率/立直倾向（0-100）+台词风格 tag | 缺→默认均衡牌风 |
| moneyIn | 带入金额（整数） | 缺→游戏默认起点 50000 |
| pronouns/称谓 | 称呼用词（台词模板替换） | 缺→中性称谓 |
| meta.adult | **成年确认位**（本游戏题材要求全员成年·建议共享格式带此声明位） | 缺→拒入局（安全默认） |
| passthrough | 局外自留字段（纹身图等）——game-b **只透传不消费**，随 SessionOut 原样带回 | 缺→无 |

## 3. game-b 开发期假设 schema（格式定稿后 adapter 对齐）

```jsonc
{
  "id": "card-xxx", "name": "绫",
  "avatar": "art:cards/xxx/avatar",          // 资产引用或路径，定稿时二选一
  "portrait": "art:cards/xxx/portrait",
  "portraits": [ { "stage": 0, "ref": "…" } ], // 可选·衣着档
  "voicePack": "voice/xxx",                    // 可选
  "personality": { "attack": 50, "defense": 50, "call": 30, "riichi": 50, "style": "cool" },
  "moneyIn": 50000,
  "meta": { "adult": true },
  "passthrough": { }
}
```

## 4. 回传需求（局外系统消费）

- game-b 终局回传（SessionOut·gdd §十一）按 **id** 键控：顺位/最终点数/金钱增减/**衣着状态（剩余件数+档位）**/事件摘要 + passthrough 原样。
- 请共享格式预留"接收回传"的对账口径（id 稳定性=唯一硬要求）。
