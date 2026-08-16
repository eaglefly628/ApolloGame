# `dokiworld/shared` · 出包线的跨 app 共享接线层

> 手册：`docs/playbooks/dokiworld-pack.md` · 规范快照：`docs/design/dokiworld/app-sdk-app-development.zh-CN.md`
> 接口面清单：`docs/design/dokiworld/sdk-surface-2.1.0.md` · 抄实现看 `dokiworld/game108/`

## 这里放什么

**两个以上 app 都要用、且与具体玩法无关的 SDK 接线件。** 判据只有一条：
「第二个 app 出包时会不会把它抄一遍？」会 → 放这里；不会 → 留在那个 app 自己目录里。

反过来也是硬边界：**本层不替任何 app 声明 extension**。
封装 ≠ 声明——谁消费谁按自己**真用到的**写进自己的 `manifest.runtime.extensions`
（规范 §7 五步一致；多声明会被拒、少声明消息被拒，两头都是错）。

## 现在有什么

| 件 | 干什么 | 谁在用 |
|---|---|---|
| `src/apps-gateway.mjs` | 「**获取卡带**」——列出宿主能拉起的 App（`list`）、拉起一个并等它交回结果（`launch`），带超时分档 / 三态降级 / 幂等 dispose | 尚无消费者（能力先就位·见下） |

### `apps-gateway` 的三条纪律

1. **没声明就一个字节都不发**。规范 §7「未声明的扩展消息会被拒绝」，而 SDK 侧的拒绝形态是
   **静默等到超时**（`capability.js` 里宿主不回时唯一的出路就是 `setTimeout`）。
   于是"忘了声明"的表症是卡满超时再失败，最难查的那一类。`declared:false` ⇒ 连通道都不建。
2. **降级不抛**。`list` 恒返回数组，`launch` 恒返回 `completed` / `cancelled` / `unavailable` 三态之一。
   「获取卡带」对任何 app 都是可选增强，一个可选能力把对局打崩是缺陷。
   `cancelled`（玩家退出那个 App）与 `unavailable`（通道没成事）**分开报**——合成一态，
   「玩家不想玩」和「宿主坏了」在调用方眼里就长得一样了。
3. **`launch` 的超时是一小时不是三十秒**（`DEFAULT_APP_LAUNCH_TIMEOUT_MS`）。拉起一个 App
   意味着玩家跑去玩那个 App 了，拿 30 秒套它 = 玩家还在玩、我方已判失败。SDK 自己就是这么分的，
   封装时不许把这条差别磨平。

## 跑测试

```bash
cd dokiworld/shared && npm install && npm test     # node --test · 9 条
```

测试**不 mock SDK**：每条都把 SDK 自己的 `createAppsHostExtension` 接在一条内存双工通道的另一端，
走的是真正的 `dokiworld-app-apps-request/response` 报文和真正的入参出参校验器。
mock 掉宿主的话只能证明"我调了我以为存在的方法"，而本层要防的恰恰是
「我以为的形状和它真正的形状不一样」。

⚠ **本目录的测试不在仓库门禁里**（`scoped-gate` 不跑 `dokiworld/**`，出包 job 也只 build 不 test）——
同 `dokiworld/game108/`。已作为 `REQ-DOKI-APPS` 的「后续①」在案（主程面·池子 10 槽满故不另占槽）。在它落地之前，**改本目录必须手跑上面那行**。
