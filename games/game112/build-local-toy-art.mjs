// 本机专用：从 art-local 原图派生商店用缩图和本地 AssetIndex。产物由 .gitignore 排除。
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const gameDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(gameDir, '../..');
const masterDir = resolve(root, 'art-local/game112/cat-toys/masters');
const outputDir = resolve(root, 'public/games/game112/art/local-candidates');
const catalog = JSON.parse(await readFile(resolve(gameDir, 'shop-catalog.v1.json'), 'utf8'));
await mkdir(outputDir, { recursive: true });

const run = (command, args) => new Promise((done, fail) => {
  const child = spawn(command, args, { stdio: 'ignore' });
  child.on('error', fail);
  child.on('close', (code) => code === 0 ? done() : fail(new Error(`${command} exited ${code}`)));
});

for (const item of catalog.items) {
  if (!/^T\d{3}$/.test(item.id)) throw new Error(`Invalid toy ID: ${item.id}`);
  const number = item.id.slice(1);
  await run('/usr/bin/sips', [
    '--resampleHeightWidthMax', '512',
    resolve(masterDir, `game112-cat-toy-${number}.png`),
    '--out', resolve(outputDir, `${item.id}.png`),
  ]);
}

const index = {
  version: 1,
  assets: catalog.items.map((item) => ({
    id: `game112/prop/${item.id}`, type: 'texture', status: 'filled',
    path: `/games/game112/art/local-candidates/${item.id}.png`,
    description: item.name, category: `prop.cat-toy.${item.category}`,
    tags: ['game112', 'prop', 'skin', 'local-only'], source: 'gen:openai-imagegen',
    license: 'OpenAI image-generation output (subject to OpenAI terms)', style: 'storybook.painterly',
    spec: { format: 'png', usage: 'sprite', colorSpace: 'srgb', wrap: 'clamp', transparent: true },
  })),
};
await writeFile(resolve(outputDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
console.log(`Prepared ${index.assets.length} local shop thumbnails at ${outputDir}`);
