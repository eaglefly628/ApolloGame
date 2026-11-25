"""Compose the Game 628 reference and runtime screenshots without redrawing them."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
REFERENCE = REPO / 'generated_images' / 'exec-e200c4ec-58a4-40bd-a8e6-2c5cfc5b3c19.png'
FONT = Path('/System/Library/Fonts/Hiragino Sans GB.ttc')
PAPER, INK, MUTED, RED = '#f3e8d8', '#38281d', '#634d3c', '#873c28'
board = Image.new('RGB', (2392, 1432), PAPER)
draw = ImageDraw.Draw(board)

def title(x, y, content, size, color=INK, bold=False):
    draw.text((x, y), content, font=ImageFont.truetype(str(FONT), size, index=int(bold)), fill=color)

def picture(path, x, y, w, h):
    with Image.open(path) as source:
        fitted = ImageOps.contain(source.convert('RGB'), (w, h), Image.Resampling.LANCZOS)
    draw.rectangle((x - 1, y - 1, x + w, y + h), fill='#dac9b3')
    board.paste(fitted, (x + (w - fitted.width) // 2, y + (h - fitted.height) // 2))

title(52, 33, '小生活  /  梧桐街', 52, bold=True)
title(53, 105, 'Game 628  入口与试玩界面 · 实机对照', 25, MUTED)
draw.line((52, 151, 2338, 151), fill='#c0a181', width=2)

screens = [
    ('01  主入口', '左侧入口卡，背景取自实际街景的黄昏画面。', 'home'),
    ('02  模拟登录', '沿用入口布局，提供模拟登录、游客与返回。', 'login'),
    ('03  居民捏脸', '人物居中，眼、眉、鼻、嘴选项在下方。', 'face'),
    ('04  梧桐街试玩', '侧向跟随镜头，店面在后、人物和人行道在前。', 'street'),
    ('05  街坊菜单', '街景暗下，中央显示继续、设置和返回标题。', 'menu'),
    ('06  设置', '单项界面音量、提示音试听、操作提示开关。', 'settings'),
]
# Runtime panels maintain the original 1280×800 aspect ratio.
for index, (heading, caption, key) in enumerate(screens):
    x = 52 + (index % 3) * 622
    y = 183 + (index // 3) * 592
    title(x, y, heading, 31, bold=True)
    picture(HERE / 'evidence' / f'1280-{key}.png', x, y + 56, 600, 375)
    title(x, y + 456, caption, 23, MUTED)

x = 1920
draw.line((1893, 182, 1893, 1318), fill='#c0a181', width=2)
title(x, 187, '概念参考', 31, bold=True)
picture(REFERENCE, x, 242, 416, 234)
for y, content in [
    (507, '项目文档记录的已选参考图'),
    (565, '五间店面沿街横向展开'),
    (612, '宽窗、阳台与树影形成第二层'),
    (659, '人物和人行道留在画面前景'),
]:
    title(x, y, content, 23, MUTED)
draw.line((x, 722, 2337, 722), fill='#c0a181', width=2)
title(x, 758, '界面分区', 31, RED, True)
for y, content in [
    (827, '入口：左侧卡片'),
    (877, '捏脸：中央人物、下方选项'),
    (927, '试玩：街景主体、底部短栏'),
    (977, '菜单与设置：中央浮层'),
]:
    title(x, y, content, 23, MUTED)

draw.line((52, 1341, 2338, 1341), fill='#c0a181', width=2)
title(52, 1370, '左侧为本机 Chrome 截图   ·   右侧为项目选定概念图   ·   2026-11-20', 23, MUTED)
board.save(HERE / 'flow-preview-runtime.png', optimize=True)
