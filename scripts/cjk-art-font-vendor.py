#!/usr/bin/env python3
# CJK 艺术字体 vendoring（owner 2026-07-23「引入一套中文 + 日文艺术字体」）——把 OFL 中/日艺术字
# 子集化（只留 src 里用到的 CJK 字 + 全假名 + 标点）→ woff2 → public/ui-fonts/cjk/ + 生成 art-fonts-cjk.ts
# 的 @font-face（**url() 引用·非 base64 内嵌**）。浏览器对 url() @font-face **按需惰性下载**——某游戏只在
# 真渲染该字族时才拉那一个 woff2，主 bundle 零增（区别于拉丁 18 款 base64 内嵌·那批小/常驻）。
#
# 依赖（非 repo 常驻·vendoring 时临时装）：pip install fonttools brotli
# 跑法：python3 scripts/cjk-art-font-vendor.py    （幂等·重跑覆盖 woff2 + art-fonts-cjk.ts）
# 许可：4 款皆 SIL OFL 1.1（可自托管/子集化/再分发）——OFL.txt 随字落 public/ui-fonts/cjk/。
import glob, os, re, subprocess, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'public', 'ui-fonts', 'cjk')
TS_OUT = os.path.join(ROOT, 'src', 'ui', 'components', 'art-fonts-cjk.ts')
CACHE = os.path.join(ROOT, '.cache-fonts')  # 下载的 TTF 缓存（不入 git）

# 字体清单：slug（=Label.font 令牌）· family（CSS font-family）· 源（google/fonts OFL 路径）· 风格描述 · 语言。
FONTS = [
    ('cnbrush', 'Ma Shan Zheng',  'ofl/mashanzheng/MaShanZheng-Regular.ttf',   '中文·毛笔行楷', 'cn'),
    ('cnwen',   'ZCOOL XiaoWei',  'ofl/zcoolxiaowei/ZCOOLXiaoWei-Regular.ttf', '中文·文艺细宋', 'cn'),
    ('jpbrush', 'Yuji Syuku',     'ofl/yujisyuku/YujiSyuku-Regular.ttf',       '日文·毛筆明朝', 'jp'),
    ('jppen',   'Klee One',       'ofl/kleeone/KleeOne-Regular.ttf',           '日文·楷書ペン', 'jp'),
    ('cnround', 'ZCOOL KuaiLe',   'ofl/zcoolkuaile/ZCOOLKuaiLe-Regular.ttf',   '中文·卡通粗圆黑', 'cn'),  # 站酷快乐体·卡通标题/大字（owner 设计稿字体）
]
RAW = 'https://raw.githubusercontent.com/google/fonts/main/'


def char_set():
    """子集字符集 = src 里所有 CJK 字（含注释·≈开发者常用字·给新标题留余量）+ 全假名 + CJK 标点 + ASCII + 全角。"""
    chars = set()
    for pat in ('src/**/*.ts', 'src/**/*.tsx'):
        for fp in glob.glob(os.path.join(ROOT, pat), recursive=True):
            try:
                t = open(fp, encoding='utf-8').read()
            except Exception:
                continue
            for ch in t:
                o = ord(ch)
                if (0x4E00 <= o <= 0x9FFF) or (0x3400 <= o <= 0x4DBF) or (0x3040 <= o <= 0x30FF):
                    chars.add(ch)
    for o in (list(range(0x3040, 0x30FF + 1)) + list(range(0x3000, 0x303F + 1)) +
              list(range(0x20, 0x7E + 1)) + list(range(0xFF01, 0xFF5E + 1))):
        chars.add(chr(o))
    return ''.join(sorted(chars))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(CACHE, exist_ok=True)
    text = char_set()
    txt_path = os.path.join(CACHE, 'subset-chars.txt')
    open(txt_path, 'w', encoding='utf-8').write(text)
    print(f'subset chars: {len(text)}')

    # OFL 许可随字（OFL 要求·取 Ma Shan Zheng 的 OFL.txt 作代表·四款同 OFL 1.1）。
    try:
        ofl = urllib.request.urlopen(RAW + 'ofl/mashanzheng/OFL.txt', timeout=30).read()
        open(os.path.join(OUT_DIR, 'OFL.txt'), 'wb').write(ofl)
    except Exception as e:
        print('warn: OFL.txt fetch failed', e)

    faces = []
    for slug, family, src, desc, lang in FONTS:
        ttf = os.path.join(CACHE, os.path.basename(src))
        if not os.path.exists(ttf):
            print(f'download {family} …')
            urllib.request.urlretrieve(RAW + src, ttf)
        woff2 = os.path.join(OUT_DIR, f'{slug}.woff2')
        subprocess.run([sys.executable, '-m', 'fontTools.subset', ttf,
                        f'--text-file={txt_path}', '--flavor=woff2',
                        f'--output-file={woff2}', '--layout-features=', '--no-hinting',
                        '--desubroutinize', '--name-IDs=1,2,4,6', '--drop-tables+=GSUB,GPOS'],
                       check=True)
        kb = os.path.getsize(woff2) // 1024
        print(f'  {slug:8} {family:16} {kb:>5} KB  ({desc})')
        faces.append(f"@font-face{{font-family:'{family}';font-style:normal;font-weight:400;"
                     f"font-display:swap;src:url(/ui-fonts/cjk/{slug}.woff2) format('woff2')}}")

    css = ''.join(faces)
    hdr = (
        "// 内嵌 CJK 艺术字体（SIL OFL 1.1·中/日·子集化到 src 用到的字 + 全假名）——**url() 引用·非 base64**：\n"
        "// 浏览器按需惰性下载（只在真渲染该字族时拉那一个 woff2·主 bundle 零增）。woff2 在 public/ui-fonts/cjk/。\n"
        "// 由 scripts/cjk-art-font-vendor.py 生成·勿手改（改字体清单/子集重跑脚本）。slug→family 映射见 art-fonts.ts。\n"
        "/* eslint-disable */\n"
    )
    open(TS_OUT, 'w', encoding='utf-8').write(hdr + f'export const ART_FONT_CJK_CSS = {css!r};\n')
    print(f'wrote {TS_OUT} ({len(css)} chars CSS)')


if __name__ == '__main__':
    main()
