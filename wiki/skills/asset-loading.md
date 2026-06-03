# 资源加载模块知识

> 覆盖：纹理图集、预加载、异步加载、资源管理

## 核心原则

- 所有资源异步加载 — 游戏不能因为一张图没加载完就卡住。
- 加载状态要可查询：loading / loaded / failed，UI 可以显示进度条。
- 加载完的资源缓存复用 — 同一张图只 fetch/decode 一次。

## 资源类型与加载方式

| 类型 | API | 注意 |
|------|-----|------|
| 图片 | `new Image()` + onload / `fetch` + `createImageBitmap` | createImageBitmap 不阻塞主线程 |
| 音频 | `fetch` + `AudioContext.decodeAudioData` | 必须在用户交互后 |
| JSON | `fetch` + `response.json()` | 大 JSON 用 Worker 解析 |
| 瓦片地图 | `fetch` JSON + 关联图块集图片 | 有依赖链 |
| 字体 | CSS `@font-face` + `document.fonts.ready` | 必须等加载完再渲染文字 |
| Spine/Live2D | 专用 loader + 骨骼数据 + 纹理 | 多文件依赖 |

## 预加载队列

```typescript
interface AssetManifest {
  images: { key: string; url: string }[];
  audio: { key: string; url: string }[];
  data: { key: string; url: string }[];
}

class AssetLoader {
  private cache: Map<string, any>;
  async loadAll(manifest: AssetManifest, onProgress: (pct: number) => void): Promise<void>;
  get<T>(key: string): T;
}
```

- 场景切换前加载下一关的资源，加载完再切。
- 进度回调：已完成数 / 总数 → 进度条百分比。
- 并发控制：同时最多 4-6 个请求（避免浏览器限制和带宽争抢）。

## 纹理图集（Texture Atlas / Spritesheet）

- 把多张小图合并成一张大图 + 一份 JSON 描述（每张小图的位置和尺寸）。
- 优点：减少 HTTP 请求、WebGL 下减少纹理切换、提高 GPU 缓存命中。
- 工具：TexturePacker、ShoeBox、free-tex-packer。

```json
{
  "frames": {
    "player_idle_0": { "x": 0, "y": 0, "w": 32, "h": 32 },
    "player_idle_1": { "x": 32, "y": 0, "w": 32, "h": 32 },
    "enemy_walk_0": { "x": 64, "y": 0, "w": 32, "h": 32 }
  },
  "meta": { "image": "atlas.png", "size": { "w": 256, "h": 256 } }
}
```

- Sprite 组件的 textureKey 指向图集中的帧名（如 "player_idle_0"）。

## 资源缓存策略

| 策略 | 适合 | 实现 |
|------|------|------|
| 全量预加载 | 小游戏（< 10MB） | 启动时加载全部，一次加载 |
| 按场景加载 | 中型游戏 | 场景切换时加载该场景资源 |
| 按需懒加载 | 大型游戏 | 进入视野再加载，显示占位符 |
| LRU 淘汰 | 内存紧张 | 最久未用的资源释放 |

- 微信小游戏内存限制：iOS ~1GB, Android ~512MB。超限会被系统杀掉。
- 释放资源：`URL.revokeObjectURL`、`imageBitmap.close()`、`audioBuffer = null`。

## 热更新（Hot Reload）

- 开发阶段：Vite HMR 自动刷新代码，但资源（图片/音频）需要手动 reload。
- 生产阶段：资源 URL 带 hash（`atlas.abc123.png`），浏览器缓存不过期。
- 微信小游戏：用 `wx.downloadFile` + 本地缓存，版本号变化时重新下载。

## 加载屏设计

- 最小加载屏：Logo + 进度条。进度条要动 — 静止的进度条让玩家以为卡了。
- 假进度：前 90% 线性推进，最后 10% 等真正加载完。玩家感知更流畅。
- 加载提示：显示游戏小贴士（"按住跳跃键可以跳得更高"），利用等待时间。

## 常见陷阱

- 图片跨域：Canvas 使用跨域图片后 `getImageData` 报错。设 `img.crossOrigin = 'anonymous'`。
- 音频预加载触发 autoplay 限制 — 只 fetch + decode，不 play。
- 加载失败没有重试 — 网络波动时资源丢失。加 retry 逻辑（最多 3 次）。
- 内存泄漏：旧场景的资源没释放，新场景又加载新的 → 内存持续增长。

## 前沿技术

- **Import Maps + ES Modules**：浏览器原生模块加载，资源也可以用 `import` 管理。
- **Compression Streams API**：浏览器原生 gzip/deflate 解压，压缩资源包体积。
- **AVIF 图片格式**：比 PNG 小 50-90%，WebP 的下一代。Chrome/Firefox 已支持。
- **Cache API (Service Worker)**：精确控制资源缓存策略，支持离线游戏。

## 参考来源

- TexturePacker — 图集打包的行业标准工具
- Phaser AssetLoader — 游戏资源加载的成熟实现参考
- MDN createImageBitmap — 非阻塞图片解码 API
