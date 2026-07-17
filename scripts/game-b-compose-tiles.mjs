// game-b 占位牌面合成（授权期工具·确定性·PE-B 域）——把 FluffyStuff 字形 PNG（透明底）
// 合到空白牌面 front.png（象牙底）上，产**不透明** 3D 贴面：Material3D.map 走不透明材质，
// 透明底字形会把透明像素渲黑（见 renderer three/material buildPbrMaterial·无 alpha 路）——
// 合成后才是「box 贴面」可用的 albedo。就地覆写本地 vendored 拷贝（public/games/game-b/art/mahjong/*.png·
// 同为 CC0 派生·索引条目 id/path/license 不变·本脚本即派生记录·可重跑）。front/back/blank 三张原样保留。
// 机制同 scripts/shoot-game.mjs：无头 Chromium canvas 画 → PNG 字节写回（gen-textures 无头自产先例）。
// 用法：node scripts/game-b-compose-tiles.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const groot = execSync('npm root -g').toString().trim();
const { chromium } = createRequire(`${groot}/x.js`)('playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(ROOT, 'public', 'games', 'game-b', 'art', 'mahjong');
const KEEP = new Set(['front.png', 'back.png', 'blank.png']); // 底面/牌背/空白原样保留

const files = readdirSync(ART).filter((f) => f.endsWith('.png') && !KEEP.has(f));
const b64 = (f) => readFileSync(join(ART, f)).toString('base64');
const IVORY = '#faf4e4'; // 兜底底色（front.png 圆角外透明区）

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const frontB64 = b64('front.png');
let n = 0;
for (const f of files) {
  const dataUrl = await page.evaluate(
    async ({ front, glyph, ivory }) => {
      const load = (src) => new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = src;
      });
      const [fi, gi] = await Promise.all([
        load(`data:image/png;base64,${front}`),
        load(`data:image/png;base64,${glyph}`),
      ]);
      const cv = document.createElement('canvas');
      cv.width = fi.width;
      cv.height = fi.height;
      const x = cv.getContext('2d');
      x.fillStyle = ivory; // 圆角外兜底 → 全图不透明
      x.fillRect(0, 0, cv.width, cv.height);
      x.drawImage(fi, 0, 0);
      // 字形按实牌雕面比例缩居中（周边留象牙边）
      const s = 0.78;
      const w = cv.width * s;
      const h = cv.height * s;
      x.drawImage(gi, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
      return cv.toDataURL('image/png');
    },
    { front: frontB64, glyph: b64(f), ivory: IVORY },
  );
  writeFileSync(join(ART, f), Buffer.from(dataUrl.split(',')[1], 'base64'));
  n++;
}
await browser.close();
console.log(`composed ${n} tile faces (opaque ivory base) in ${ART}`);
