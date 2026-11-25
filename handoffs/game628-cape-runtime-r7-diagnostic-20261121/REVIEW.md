# Game 628 披风 r7 诊断

2026-11-21，18854 隔离诊断构建已可打开，已复测，视觉验收未通过。入口保留供复现。

- 诊断入口 http://127.0.0.1:18854/cape-r7-diagnostic/?scene=avatar-studio
- 可玩基线 http://127.0.0.1:18854/?scene=avatar-studio
- 基线快照在本目录的 `baseline-dist-snapshot/`。根入口 HTML 已与快照逐字节核对。

| 构建文件 | SHA-256 |
| --- | --- |
| `index.html` | `861c507ea36c00b4f92a4110fc03102cf17d679aefc4121f465886dbe96323aa` |
| `assets/index-BbIO_Wbf.js` | `9a3ff79a46b1088790b12b1d433d31512faa3387948f024bab9a270b56d06bb3` |
| `scenes/avatar-studio.json` | `dca73b96fb108de84b1c102f801920eac371e56282d96454348e042da7e6a0ef` |


## 结论

纤瘦和圆润体型的披风顶角在侧面行走时都明显悬空。转身后停步的截图还捕捉到布面短时翻起并遮住部分头部的画面，挥手时后视布面可回落。r7 的密采样记录通过 10 mm 穿插阈值，肩部连接仍未达到试穿验收要求。更靠近袖肩的 r8 四组穿插最大值约 57.21、93.40、110.93、103.08 mm，未接入。本轮不替换默认预览。

| 动作 | 纤瘦 | 圆润 |
| --- | --- | --- |
| 侧面行走 | [肩部悬空](evidence/browser-r7/slim-side-walking.jpg) | [肩部悬空](evidence/browser-r7/full-side-walking.jpg) |
| 转身后停步 | [布面翻起](evidence/browser-r7/slim-normal.jpg) | [布面翻起](evidence/browser-r7/full-normal.jpg) |
| 挥手 | [背面](evidence/browser-r7/slim-wave.jpg) | [背面](evidence/browser-r7/full-wave.jpg) |

## 实测与身份

- 双体型走、停、反向转身、挥手、切低档、停用、脱下和重穿通过浏览器行为断言。标准和低档分别增加 96、48 个三角面，停用清掉布料及碰撞代理。纤瘦和圆润分别使用 r7 原始 42 和 58 个代理。
- 窄屏 Chrome 在 16 倍 CPU 限速下从标准自动到低档，原因是连续超出预览 CPU 预算。
- 诊断 TypeScript、Vite 构建和 14 项本地测试通过。Vite 仍提示 Jolt 的 Node 兼容导入已外置，且存在较大构建块。
- 实际 HTTP 返回的索引、入口 JavaScript 和场景的哈希由浏览器脚本在运行前后验证。根入口、基线快照和诊断中使用的两个角色 glTF 与共享二进制逐一核对，五个隔离引擎文件也匹配固定快照。
- [浏览器构建标识](evidence/browser-r7/build-identity.json)、[动作与运行时数据](evidence/browser-r7/joint-browser.json)、[数据与基线 SHA-256](evidence/verified-inputs-and-baseline.json)。

## 复现

打开诊断入口，选择「纤瘦」或「圆润」，点击「试披风」和「试穿披风」，用左右方向键行走，再松开或反向移动。地址路径必须为 `/cape-r7-diagnostic/`，页面标题含「r7 诊断（待验收）」，入口脚本为 `index-BbIO_Wbf.js`。18854 的根入口仍返回 `index-BkDUSc-8.js`。诊断路径通过一个独立符号链接挂载，删除该链接即可关闭诊断入口。
