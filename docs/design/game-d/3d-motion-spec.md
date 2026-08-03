# 骰途 · 3D 动效与参数规格（Cloud Design 交付 · owner 2026-07-01 上传）

> 这是所有 3D 表现动效的**权威落地准则**（数值取自可运行原型 v0.3）。渲染器 Three.js r128；Y 向上，单位=一地格≈1。
> 角速度按注释区分「@60fps 固定增量」vs「× dt(秒)」。缓动只有两个：cubic-out、eOutBack。颜色随 t(暗↔暖滑块)线性插值。
> P3D 按此驱动 game-d 的 3D 动画（title 骰自转 / 物件浮动 / 施法 / 掷骰 / 骰壳转场 / 战利品发牌）。

## A · Title 旋转命运骰
- camera: PerspectiveCamera(fov 38, 0.1, 100), pos (0, 0.2, 6.3)
- renderer: ACESFilmic, exposure 1.15, sRGB, alpha 透明
- die: BoxGeometry(1.95³), pos.y -0.45, 初始 rot (0.5, 0.7, 0)；6 面 MeshStandard roughness .42 metalness .18 emissive=元素色 emissiveIntensity .16；面序点数 [1,6,2,5,3,4]
- 光: Ambient 白 .5 · Key(Dir) #fff0d8 int 1.1 pos(3,4,5) · Rim(Point) #9b6cff int 1.2 dist30 pos(-4,1,-3) · Fill(Point) #3ba0ff int .7 dist30 pos(4,-2,2)
- 背光柔光 sprite tint #ffe5a8 scale 6.4 pos(0,-.45,-1.4)，每帧 material.rotation += .002
- 每帧(@60fps)：`die.rot.x += vx; die.rot.y += vy; vx += (.004-vx)*.03; vy += (.006-vy)*.03;`（基准角速度 x .004 / y .006 rad/帧·阻尼回弹）
- 氛围随 t∈[0,1]：`emissiveIntensity = .34-.20t; glow.opacity = .85-.42t; rim.int = 1.4-.6t`

## B · 塔内场景 相机/光/雾
- camera: Orthographic(±fr·aspect, ±fr), fr=7.0, pos(0,12,7.8), lookAt(0,0,0)
- renderer: PCFSoftShadowMap, ACESFilmic, exposure 1.12
- 光: Ambient 白 int .24+.42t · Hemi int .30+.40t · Key(Dir) lerp(lightD,lightW,t) int .5+.7t pos(6,11,5) castShadow map2048² cam±9 bias-.0004 radius4 · Fill(Dir) #6f7cff int .20+.30(1-t) pos(-5,4,-4)
- fog: 色=天空底色, near 15-3t, far 30
- 竞技场: 7×7 地格(1×1×0.45)；墙 h .85；门洞 gap 1.5；基座 y -1.0/-2.3；四角火盆 @ ±4.3

## C · 场景物件循环动画（tt=累计秒, phase=随机相位）
- 鸭子/火盆/灯笼上下浮: `y = baseY + sin(tt*1.6+phase)*.06`
- 散落元素方块 自转+浮: `rot.y += .012; y = baseY + sin(tt*2.0+phase)*.07`
- 祭坛宝石(八面体) 自转+大浮: `rot.y += .02; y = baseY + sin(tt*1.8)*.13`
- 守关者 BOSS 待机呼吸: `y = sin(tt*1.2)*.07`
- 柔光精灵 呼吸闪: `opacity = base*(.75+.25*sin(tt*2+x))`
- 熔岩地格自发光: `emissiveIntensity = base*(.7+.4*sin(tt*3+id))`

## D · 元素法阵施法光弹
- 起点 from (-9.5, 3.4-el*0.95, 2.2)（el 0-5）· 落点 to ((rand-.5)*1.6, .7, .3+(rand-.5)*1.2)
- 弹体 Sphere(.24) MeshBasic 元素色 + 同色柔光 sprite scale 1.9 · 飞行 dur .5s
- 飞行: `e=clamp(t/dur,0,1); pos=lerp(from,to,e); pos.y += sin(e*π)*1.4`
- 冲击: `scale=.4+it*16; opacity=1-it*2.6`（it>.45 销毁）

## E · 掷骰（出战骰组落场·els=元素数组）
- 骰 Box(.58³) 元素色 6 面(emissiveIntensity .2)
- spread=clamp(n*.9,1.2,4.4)；第 i 颗 x=(-spread/2 + spread*i/(n-1))*1.25
- from y5.6 z4 → to y.525 z 1.0+sin(i*1.9)*.55 · dur 1.0+rand*.28 · delay i*.1
- 落地: `e=1-(1-t)³; pos=lerp(from,to,e); pos.y += sin(t*π)*2.2*(1-t*.3); rotateOnAxis(randAxis, spin*dt*(1-t*.7))`（spin=13+rand*7）

## F · 通关骰壳转场（总时长 2.5s·p=t/2.5）
- `eOutBack(p) = 1 + 2.70158*(p-1)³ + 1.70158*(p-1)²`
- 骰壳 Box(8.6³) @ y.9 · 包裹柔光 scale 11
- p 0→.20: 壳 scale eOutBack(p/.2) 包住；旧场 scale 1-p/.2 缩进；壳 rot.y+=dt*1.2；柔光 opacity→.5
- .20→.46: 旧场 scale 0；pivot 自转 spin.x+=dt*7 spin.y+=dt*9；pivot scale 1-.62k；pivot.y 2.9k（螺旋升走）
- @.46: 换层 (layer+1)%4 重建换皮；新场 scale≈0 待命
- .46→.74: pivot 自转 spin.x+=dt*6 spin.y+=dt*7 随 k 衰减；pivot scale .38+.62k；pivot.y 2.9(1-k)（旋入）
- .74→1: pivot 归位；壳 scale 1-eOutBack(k*1.25) 收起；新场 scale eOutBack(k*1.15) 展开；柔光淡出
- @1: 新场脱离 pivot 归位；触发战利品发牌

## G · 3D 战利品卡（扇形发牌 + 选取）
- 卡 Box(2.0,2.8,0.1) 正/背贴图(420×588) 四侧 #3a2030
- 扇形位(i=0,1,2): x (i-1)*2.45, y 3.5, z 2.9-|i-1|*.25, rotZ -(i-1)*.16, tiltX -.92
- 出现: scale 0→1 eOutBack dur .5s delay i*.13
- 待机: rot.y sin(t*1.6+i)*.18; y by+sin(t*1.5+i*1.3)*.12
- 选中: target (0,3.0,5.6) dur 1.25s easeInOutCubic; yaw start*(1-e)+4π*e（两圈）; scale start+(1.9-start)*e；停稳 hold 1.7s 再淡出(scale→0 dur .45s)
- 未选中两张: scale→0 + 向外平移 + 自转(dur .4s) · 点击拾取: Raycaster 命中卡 mesh

落地提示：每帧动画乘 dt(秒)以帧率无关；标「@60fps 固定增量」的常量 ×60 = 每秒弧度。
