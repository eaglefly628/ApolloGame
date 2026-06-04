# Phase 1 — 游戏基础设施（Game Infrastructure）总清单

> 目标：**完成一个真实游戏所需的全部基础设施**（不只是逻辑/物理涌现层）。
> 这是 Phase 1 的权威范围与进度表，活文档，可增删。
> 分层原则（与闭合性论证一致）：**确定性 sim（涌现层）** ↔ **端口/表现/IO（确定性之外，故意隔离）** ↔ **运行时编排**。

图例：✅ 已有 ｜ 🟡 部分 ｜ ❌ 缺 ｜ ⭐ 本阶段要补

## 1. 运行时 / 主循环（Runtime）
| 能力 | 状态 | 说明 |
|---|---|---|
| 固定步长主循环 | ✅ | `runtime/engine.ts`：FixedStepClock 累加真实时间跑整数 tick，渲染每帧一次 |
| 输入按 tick 注入接缝 | ✅ | `step()` 先 applyCommands 再 world.tick（联机同一接缝） |
| 确定性指纹 hash | ✅ | `engine.hash()` = hashSnapshot |
| headless 纯逻辑步进 | ✅ | `net/fixed-step.ts` 可单测 |
| **暂停/恢复/单步** | ⭐❌ | 调试/演出需要（step once、pause） |
| **多端口统一装配**（audio/storage 一并挂） | ⭐🟡 | 现在只 attachRenderer；要扩成挂一组端口 |
| 渲染插值（可选） | ❌ | 高刷下平滑（非必须，先不做） |

## 2. 端口层（Ports，确定性之外的边缘）
| 端口 | 状态 | 说明 |
|---|---|---|
| RendererBackend | 🟡 | canvas/ascii ✅；**相机投影/多行文本 ❌** |
| InputSource | 🟡 | 键盘 ✅；**指针/点击 ❌（R3）** |
| **AudioPort（音乐/音效/语音）** | ⭐❌ | 消费 `Sound`，BGM 循环/音效/声道/淡入淡出（R8） |
| **StoragePort（存储/文件）** | ⭐❌ | snapshot POD → localStorage(web)/fs(node)/IndexedDB 适配器 |
| NetworkPort | 🟡 | lockstep BroadcastChannel ✅；真 WS/WebRTC ❌ |

## 3. 资源 / 句柄管理（Asset & Handle）
| 能力 | 状态 | 说明 |
|---|---|---|
| AssetManager（加载/缓存/解析/不透明句柄） | ✅ | `src/assets/` |
| 资产索引 + TBF 流程 | ✅ | `assets/index.json` + asset-index |
| **句柄生命周期管理** | ⭐❌ | acquire/release **引用计数**、unload/dispose、按场景批量释放（防泄漏） |
| 预加载编排 | 🟡 | 有 loadAll；缺按场景/优先级的分批预载 |

## 4. 序列化 / 持久化（Serialization & Persistence）
| 能力 | 状态 | 说明 |
|---|---|---|
| snapshot/restore（POD） | ✅ | `world.ts` |
| 确定性 hash | ✅ | `net/determinism` |
| record / replay | ✅ | `debug/recorder|replayer` |
| **存档系统（具名槽位/元数据/自动存档）** | ⭐❌ | StoragePort 之上：slots、时间戳、章节、缩略图 |

## 5. 消息 / 事件（Messaging）
| 能力 | 状态 | 说明 |
|---|---|---|
| sim 内 Signal/Event | ✅ | event-when/effect-apply |
| 输入命令队列（按 tick） | ✅ | `net/commands` |
| **跨层消息总线**（engine↔UI↔net 的 pub/sub） | ⭐❌ | 解耦"sim 产出 → UI/音频/网络消费"；out-of-sim、不进 hash |

## 6. 视图 / 相机（View）
| 能力 | 状态 | 说明 |
|---|---|---|
| **camera-follow（涌现系统）** | ⭐❌ | 读目标 Transform → 算 Camera（中点+缩放贴合，钳边界）(REQ-001) |
| **世界→屏幕投影（卷轴，渲染器）** | ⭐❌ | 渲染器施加 Camera 变换，世界可大于视口 |

## 7. 场景 / 流程（Scene / Flow）
| 能力 | 状态 | 说明 |
|---|---|---|
| **scene-transition（场景切换 + 批量实体生灭）** | ⭐❌ | 两游戏共需；天然吃 snapshot + storage + 句柄释放 |
| 游戏态机（menu/play/pause/结算） | 🟡 | 用现有 state/Condition 拼，游戏层 |

## 8. 调试 / 工具（已较全）
| 能力 | 状态 |
|---|---|
| recorder/replayer/tracer/snapshot | ✅ |
| debug overlay / dev-tools 面板 | ✅ |

---

## 执行排程（建议，每批 ~3，可调）
- **Batch I · 视图与存档**：camera-follow + 渲染器投影（卷轴）｜ StoragePort（web+node）+ 存档槽位。
- **Batch II · IO 端口**：AudioPort（音乐/音效）｜ 指针输入（点击 R3）｜ 渲染器多行文本（R2）。
- **Batch III · 资源与消息**：句柄生命周期管理（引用计数/批量释放）｜ 跨层消息总线。
- **Batch IV · 流程与循环**：scene-transition（场景切换+批量生灭）｜ 主循环 暂停/单步 + 多端口装配。

> 确定性纪律：端口（audio/storage/file/网络）、相机投影、消息总线**全部在确定性 sim 之外**，只消费/搬运数据，不进 snapshot/hash → lockstep 安全。真正算"涌现系统"的只有 camera-follow / scene-transition 这类"读组件→产组件"。
