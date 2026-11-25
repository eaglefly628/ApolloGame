# Game628 面包房积水

梧桐街雨天接入包。替换前街面包房周围的旧雨线、水洼和涟漪。沿用场景已有的「下雨」按钮，晴天、雪、雾和日夜预设会关闭面包房雨效。水洼倒影为预烘焙贴图，按面包房固定观察角度制作；走动时倒影固定在地上。场景文件内的两张 256×128 贴图约 50 KB，每处水洼继续使用一张贴花。

在已有「双街近景」本机候选的独立副本上执行以下命令。候选目录应包含 `site/scenes/crowd-street.json` 和 `environment.ts`。

```sh
python3 handoffs/game628-bakery-weather/apply-street-rain.py /path/to/street-candidate
./node_modules/.bin/vite build --config /path/to/street-candidate/vite.config.mjs
```

应用脚本以 `street-rain-layer.json` 和本地贴图索引为输入，可重复执行。它将效果数据接入已有雨天预设，并让预设解释器支持贴花透明度。原有入场、行走、街区切换和角色数据由候选保留。该接入包需要候选已有的街景模型、场景数据和启动入口。
