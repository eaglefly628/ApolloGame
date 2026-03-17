# ApolloGame - 微信小程序超休闲双人联机框架

## 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    Architecture                          │
│                                                          │
│  ┌──────────┐  WebSocket  ┌───────────────────────────┐ │
│  │  微信小程序 │◄──────────►│      Game Server          │ │
│  │  Client   │            │                           │ │
│  │           │            │  ConnectionManager        │ │
│  │ - 首页    │            │    ├─ heartbeat            │ │
│  │ - 房间    │            │    └─ session tracking     │ │
│  │ - 对战    │            │  RoomManager              │ │
│  │           │            │    ├─ create/join/match    │ │
│  └──────────┘            │    ├─ state machine        │ │
│  ┌──────────┐            │    └─ auto cleanup         │ │
│  │  微信小程序 │◄──────────►│  MessageRouter            │ │
│  │  Client   │            │    └─ type-based dispatch  │ │
│  └──────────┘            │  GamePlugin (可插拔)        │ │
│                           │    └─ e.g. TicTacToe      │ │
│                           └───────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 核心设计思路

### 并发与扩展性

| 关注点 | 方案 |
|--------|------|
| **连接管理** | WebSocket 长连接 + 心跳检测，自动清理僵尸连接 |
| **房间隔离** | 每个房间独立状态，Map 结构 O(1) 查找 |
| **并发上限** | 可配置 `MAX_ROOMS`，防止内存溢出 |
| **消息模型** | Relay 模式（服务器转发），适合超休闲游戏 |
| **水平扩展** | 无状态路由层 + 有状态房间层，可引入 Redis 做跨进程房间共享 |
| **游戏逻辑** | Plugin 模式，新游戏只需实现 `initState` + `applyAction` |
| **断线重连** | 客户端指数退避重连，服务端心跳 grace period |
| **资源回收** | 定时清理超时房间（默认 5 分钟无活动） |

### 消息协议

```json
// Client → Server
{ "type": "create_room", "data": {} }
{ "type": "join_room", "data": { "roomId": "ABC123" } }
{ "type": "quick_match", "data": {} }
{ "type": "start_game", "data": {} }
{ "type": "game_action", "data": { "action": { "position": 4 } } }
{ "type": "leave_room", "data": {} }

// Server → Client
{ "type": "connected", "data": { "playerId": "uuid" } }
{ "type": "room_created", "data": { "roomId": "ABC123" } }
{ "type": "room_joined", "data": { "roomId": "ABC123", "players": [...] } }
{ "type": "game_start", "data": { "roomId": "...", "gameState": {...}, "players": [...] } }
{ "type": "game_action", "data": { "playerId": "...", "action": {...} } }
{ "type": "game_end", "data": { "roomId": "...", "result": {...} } }
```

### 房间状态机

```
WAITING ──(2人+host开始)──► PLAYING ──(结束/离开)──► FINISHED
   ▲                                                    │
   └────────────────── (重新创建) ◄─────────────────────┘
```

## 项目结构

```
ApolloGame/
├── server/                     # Node.js 游戏服务器
│   ├── src/
│   │   ├── index.js            # 入口，WebSocket server
│   │   ├── core/
│   │   │   ├── ConnectionManager.js  # 连接 & 心跳管理
│   │   │   ├── RoomManager.js        # 房间生命周期
│   │   │   └── MessageRouter.js      # 消息路由分发
│   │   └── game/
│   │       └── TicTacToePlugin.js    # 示例游戏插件
│   ├── test/                   # Jest 单元测试
│   └── package.json
│
├── client/                     # 微信小程序客户端
│   ├── app.js / app.json / app.wxss
│   ├── utils/
│   │   └── socket.js           # WebSocket 管理（重连/心跳）
│   └── pages/
│       ├── index/              # 首页：匹配/创建/加入
│       ├── room/               # 房间等待页
│       └── game/               # 对战页（井字棋 demo）
```

## 快速开始

### 服务端

```bash
cd server
npm install
cp .env.example .env    # 按需修改配置
npm run dev             # 开发模式（nodemon 热重载）
```

### 客户端

1. 用微信开发者工具打开 `client/` 目录
2. 修改 `app.js` 中的 `serverUrl` 为你的服务器地址
3. 修改 `project.config.json` 中的 `appid` 为你的小程序 AppID

### 运行测试

```bash
cd server
npm test
```

## 扩展指南：添加新游戏

1. 在 `server/src/game/` 下创建新 Plugin，实现：
   - `initState(players)` — 初始化游戏状态
   - `applyAction(gameState, playerId, action)` — 处理玩家操作

2. 在 `RoomManager._initGameState` 中切换使用的 Plugin

3. 在 `client/pages/game/` 下修改对应的 UI 和交互逻辑

## 后续演进方向

- **Redis 适配器**：支持多进程/多服务器房间共享
- **微信登录集成**：`wx.login` → 服务端换 session
- **排行榜 & 战绩**：接入数据库持久化
- **帧同步模式**：对操作时序敏感的游戏，改用 lockstep
- **观战功能**：房间支持 spectator 角色
