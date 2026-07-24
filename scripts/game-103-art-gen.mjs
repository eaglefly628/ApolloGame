// scripts/game-103-art-gen.mjs —— game-103《幸存者核心原型》4 个 sprite 皮肤槽的程序化卡通美术。
// 风格锚：docs/design/game-103/survivor-io-ui-kit-handoff.md —— bright chunky cartoon（Survivor.io 风）：
// 明亮、饱和、圆润、厚黑描边、glossy 高光（radial 高光 + linear 双色相底）。俯视 2D·透明底·矢量 SVG。
// 自产美术·无许可/网络依赖（source: apollo-procedural）。用法：node scripts/game-103-art-gen.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(ROOT, 'public', 'games', 'game-103', 'art');
mkdirSync(ART, { recursive: true });

const S = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${body}</svg>\n`;

// 复用的 glossy 高光（设计稿：radial-gradient(circle at 34% 28%, rgba(255,255,255,.55), transparent 45%)）。
const gloss = (cx, cy, rx, ry, op = 0.55) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${op}"/>`;

const made = [];
function emit(name, desc, body) {
  writeFileSync(join(ART, name), S(body));
  made.push({ name, desc });
}

// ── 103/player：明亮卡通俯视英雄（蓝色系·圆润·厚描边·glossy）──────────────
emit(
  'player.svg',
  '玩家英雄·bright cartoon 俯视·蓝色 glossy 圆盘 + 头部圆',
  `<defs><linearGradient id="pB" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#7fd0ff"/><stop offset="1" stop-color="#2f7fd0"/></linearGradient>
   <linearGradient id="pH" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffe6c8"/><stop offset="1" stop-color="#f2b98a"/></linearGradient></defs>
   <!-- 身体（俯视肩部圆盘） -->
   <circle cx="32" cy="36" r="21" fill="#16324f"/>
   <circle cx="32" cy="36" r="18" fill="url(#pB)"/>
   ${gloss(25, 27, 8, 5, 0.5)}
   <!-- 头（居中偏上·卡通大头） -->
   <circle cx="32" cy="26" r="13" fill="#16324f"/>
   <circle cx="32" cy="26" r="10.5" fill="url(#pH)"/>
   ${gloss(28, 21, 4.5, 3, 0.6)}`,
);

// ── 103/enemy-shambler：卡通丧尸/软泥群怪（红紫系·圆润·可辨识·成群）────────
emit(
  'enemy-shambler.svg',
  '敌人蹒跚者·bright cartoon 俯视·红紫 glossy 软泥怪 + 两只怒眼',
  `<defs><radialGradient id="eB" cx="38%" cy="30%" r="75%">
    <stop offset="0" stop-color="#ff8a9e"/><stop offset="55%" stop-color="#e0344f"/>
    <stop offset="1" stop-color="#8a1f6e"/></radialGradient></defs>
   <!-- 软泥团块轮廓（不规则圆润·厚描边） -->
   <path d="M32 8 C46 8 55 18 55 32 C55 47 45 57 32 57 C18 57 9 46 9 32 C9 17 19 8 32 8 Z"
     fill="#3a0e33"/>
   <path d="M32 12 C44 12 51 20 51 32 C51 45 43 53 32 53 C20 53 13 44 13 32 C13 19 21 12 32 12 Z"
     fill="url(#eB)"/>
   ${gloss(24, 22, 7, 4.5, 0.45)}
   <!-- 两只怒眼 -->
   <ellipse cx="25" cy="33" rx="4.2" ry="5" fill="#2a0820"/>
   <ellipse cx="39" cy="33" rx="4.2" ry="5" fill="#2a0820"/>
   <circle cx="26" cy="31.5" r="1.5" fill="#fff" opacity=".85"/>
   <circle cx="40" cy="31.5" r="1.5" fill="#fff" opacity=".85"/>`,
);

// ── 103/gem-blue：明亮蓝绿经验宝珠（glossy·发光感·小而醒目）────────────────
emit(
  'gem-blue.svg',
  '经验宝珠·bright cartoon·蓝绿 glossy 发光圆珠 + 外发光环',
  `<defs><radialGradient id="gB" cx="36%" cy="30%" r="75%">
    <stop offset="0" stop-color="#d8fff0"/><stop offset="45%" stop-color="#5ff0d0"/>
    <stop offset="1" stop-color="#1f8fb0"/></radialGradient>
   <radialGradient id="gGlow" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="#8affe0" stop-opacity=".55"/>
    <stop offset="1" stop-color="#8affe0" stop-opacity="0"/></radialGradient></defs>
   <circle cx="32" cy="32" r="30" fill="url(#gGlow)"/>
   <circle cx="32" cy="32" r="19" fill="#0e5a6e"/>
   <circle cx="32" cy="32" r="16" fill="url(#gB)"/>
   ${gloss(26, 25, 6, 4, 0.75)}
   <circle cx="38" cy="39" r="2.4" fill="#fff" opacity=".5"/>`,
);

// ── 103/proj-kunai：卡通飞镖/子弹（白亮·横向飞行·带高光）────────────────────
emit(
  'proj-kunai.svg',
  '飞镖/子弹·bright cartoon·横向飞行白亮弹体 + 亮蓝描边高光',
  `<defs><linearGradient id="kB" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#bfe4ff"/></linearGradient></defs>
   <!-- 拖尾（横向速度感） -->
   <path d="M6 32 L20 28 L20 36 Z" fill="#7fd0ff" opacity=".55"/>
   <!-- 弹体（尖头朝右的胶囊/飞镖） -->
   <path d="M20 24 L46 24 L58 32 L46 40 L20 40 Q15 32 20 24 Z" fill="#1f5f96"/>
   <path d="M22 26.5 L45 26.5 L54 32 L45 37.5 L22 37.5 Q18 32 22 26.5 Z" fill="url(#kB)"/>
   ${gloss(32, 29, 9, 2.2, 0.8)}`,
);

console.error('[game-103-art-gen] wrote', made.length, 'svg:', made.map((m) => m.name).join(', '));
