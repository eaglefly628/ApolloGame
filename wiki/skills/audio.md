# 音频模块知识

> 覆盖：Web Audio API、音效管理、BGM、Sound 组件集成

## 核心原则

- 浏览器要求用户交互后才能播放音频（autoplay policy）— 第一次点击/触屏时初始化 AudioContext。
- 音效（SFX）和背景音乐（BGM）分开管理：SFX 短促可叠加，BGM 长循环单轨道。
- Sound 组件是 ECS 的渲染层输出 — 和 Sprite 一样，System 写 Sound，音频后端消费并播放。

## Web Audio API 基础

```
AudioContext
  ├── GainNode (master volume)
  │     ├── GainNode (sfx bus)
  │     │     ├── AudioBufferSourceNode (跳跃音效)
  │     │     └── AudioBufferSourceNode (爆炸音效)
  │     └── GainNode (bgm bus)
  │           └── AudioBufferSourceNode (背景音乐)
  └── AnalyserNode (可视化，可选)
```

- AudioBufferSourceNode 是一次性的 — 播完就废弃，下次播新建一个。
- GainNode 做分轨音量控制：总音量、SFX 音量、BGM 音量独立调。

## 音效池化（SFX Pool）

- 预加载：启动时 fetch + decodeAudioData 把所有音效解码到 AudioBuffer。
- 播放：从 AudioBuffer 创建 source → connect → start。
- 并发控制：同一音效最多同时播 N 个（避免 100 颗子弹同时播碰撞音）。
- 优先级：重要音效（死亡、过关）抢占低优先级音效的通道。

## BGM 管理

- 同一时间只播一首 BGM。
- 切换时淡入淡出（crossfade）：旧曲 gain 0.5s 降到 0，新曲 gain 0.5s 升到 1。
- loop 无缝衔接：设置 `source.loop = true`，精确指定 `loopStart`/`loopEnd` 避免间隙。
- 暂停恢复：`AudioContext.suspend()` / `AudioContext.resume()`。

## 音频格式

| 格式 | 大小 | 质量 | 浏览器支持 |
|------|------|------|-----------|
| **OGG Vorbis** | 小 | 好 | Chrome/Firefox/Edge，Safari 17+ |
| **AAC/M4A** | 小 | 好 | 全平台 |
| **MP3** | 中 | 中 | 全平台（专利已过期） |
| **WAV** | 大 | 无损 | 全平台（仅用于开发） |
| **Opus** | 最小 | 最好 | 现代浏览器全支持 |

- 推荐：BGM 用 OGG/Opus，SFX 用 OGG/AAC。准备两种格式做 fallback。

## 与 ECS 集成

- Sound 组件：`{ clipId: 'jump', volume: 0.8, loop: false }`。
- 音频 System 每帧扫描新的 Sound 组件 → 播放 → 标记已播放或移除。
- 循环音效（脚步声）：loop=true 时只在首次触发播放，Sound 组件存在期间持续。
- 停止：移除 Sound 组件 → 音频 System 停止对应 source。

## 空间音频（2D 声像）

- 用 StereoPannerNode 根据实体 x 坐标做左右声像。
- pan = (entity.x - camera.centerX) / (viewportW / 2)，clamp 到 [-1, 1]。
- 距离衰减：音量 × (1 - distance / maxDistance)，超出范围静音。

## 常见陷阱

- 第一次 AudioContext 创建后可能是 suspended 状态 — 用户交互时调用 `context.resume()`。
- 移动端切后台：AudioContext 会被系统暂停。监听 visibilitychange 恢复。
- 音效文件太大：SFX 不超过 500KB，BGM 不超过 5MB（OGG）。大了要压缩。
- 不要用 `<audio>` 标签做 SFX — 延迟高、不能精确控制。仅 BGM 可考虑。

## 前沿技术

- **AudioWorklet**：在独立线程做音频处理，不阻塞主线程。适合实时音效合成。
- **Web Codecs API**：底层音视频编解码，适合自定义音频格式或流式音频。
- **Tone.js**：Web Audio 的高级封装，内置合成器/效果器，适合音乐类游戏。

## 参考来源

- Web Audio API (MDN) — 完整的节点类型和用法文档
- Apollo src/engine/protocol/components.ts Sound 组件 — 当前数据结构
- Howler.js — 流行的 Web 音频库，可作为 Apollo 音频后端的参考
