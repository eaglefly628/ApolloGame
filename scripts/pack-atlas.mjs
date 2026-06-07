#!/usr/bin/env node
// pack-atlas CLI —— AOT 离线资产打包工具（R9 增益 ③）。
// 把 Free Texture Packer / TexturePacker 的 JSON（hash 格式）收敛进 assets/index.json（唯一真理，
// 不造第二个 manifest）。一个 atlas = 一条 filled texture 条目 + spec.frames（命名子矩形）。
// 运行期由 registerAssetIndex 注册成 AtlasDescriptor，Sprite.textureKey 指帧名即出图。
//
// 逻辑镜像 src/assets/pack-atlas.ts —— **那份有单测、是权威**；本文件仅是无依赖的 fs 胶水
// （仓库无 tsx/ts-node，故 CLI 内联这几行而非 import .ts）。改转换规则请同步两处。
//
// 用法: node scripts/pack-atlas.mjs <ftp.json> <index.json> <atlasId> <packedImagePath>
import { readFileSync, writeFileSync } from 'node:fs';

const [, , ftpPath, indexPath, atlasId, imgPath] = process.argv;
if (!ftpPath || !indexPath || !atlasId || !imgPath) {
  console.error('用法: node scripts/pack-atlas.mjs <ftp.json> <index.json> <atlasId> <packedImagePath>');
  process.exit(1);
}

const stripExt = (n) => n.replace(/\.[a-z0-9]+$/i, ''); // 帧名去扩展名 → 全局唯一符号 key
const ftp = JSON.parse(readFileSync(ftpPath, 'utf8'));
const frames = {};
for (const [name, f] of Object.entries(ftp.frames)) {
  frames[stripExt(name)] = { x: f.frame.x, y: f.frame.y, w: f.frame.w, h: f.frame.h };
}

const index = JSON.parse(readFileSync(indexPath, 'utf8'));
const entry = { id: atlasId, type: 'texture', status: 'filled', path: imgPath, description: `图集 ${atlasId}`, spec: { frames } };
index.assets = (index.assets ?? []).filter((a) => a.id !== atlasId);
index.assets.push(entry);
writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
console.log(`✓ 已合并 ${Object.keys(frames).length} 帧到 ${indexPath} 的 atlas "${atlasId}"`);
