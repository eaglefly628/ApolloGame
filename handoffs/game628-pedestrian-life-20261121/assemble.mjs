import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const here = new URL('./', import.meta.url);
const baseline = new URL('../game628-cat-turn-20261121/site/', here);
const sourceHost = new URL('../game628-life-controls-20261117/host.ts', here);
const readJson = async (url) => JSON.parse(await readFile(url, 'utf8'));
const gaits = await readJson(new URL('gait-report.json', here));
const rules = await readJson(new URL('street-response.json', here));
const sourceScenes = {};
for (const name of ['crowd-street', 'crowd-navigation']) {
  const path = 'scenes/' + name + '.json';
  const base = await readFile(new URL(path, baseline));
  sourceScenes[name] = createHash('sha256').update(base).digest('hex');
  const scene = JSON.parse(base);
  for (const gait of gaits.residents) {
    const entity = scene.manifest.entities[gait.entity];
    const recipe = scene.characters.find(recipe => recipe.entity === gait.entity);
    const previousKey = entity.Model3D.modelKey;
    const key = 'life-' + gait.entity;
    scene.assets = scene.assets.filter(asset => asset.key !== previousKey);
    scene.assets.push({ kind: 'model', key, src: gait.src });
    entity.Model3D.modelKey = key;
    recipe.walk = gait.name;
    recipe.nominalSpeedPerTick = gait.nominalSpeedPerTick;
  }
  const sites = [[-3.0, 1.05], [5.35, 1.15]];
  for (const [index, id] of rules.interests.entries()) {
    const [x, y] = sites[index];
    scene.manifest.entities[id] = { Transform: { x, y, scaleX: 1, scaleY: 1, rotation: 0 } };
  }
  scene.streetResponse = {
    rules, seed: gaits.seed,
    residents: gaits.residents.map(({ entity }, index) => ({
      entity, curiosity: [0.55, 0.72, 0.38, 0.64][index],
      sociability: [0.34, 0.47, 0.27, 0.52][index], readyAt: 120 + index * 48,
    })),
  };
  await writeFile(new URL('site/' + path, here), JSON.stringify(scene) + '\n');
}

// Reuse the actual street host. Each integration point is checked against its source.
let host = await readFile(sourceHost, 'utf8');
const edits = [
  ["from './transition-layout.js'", "from '../game628-life-controls-20261117/transition-layout.js'"],
  ["from './environment.js'", "from '../game628-life-controls-20261117/environment.js'"],
  ["import {CharacterPresentation} from './character-presentation.js';", "import {CharacterPresentation,installStreetResponse} from './scene-adapter.js';"],
  ['if(!selectEnvironment(active,name,performance.now())', 'if(active.config.streetResponse && Object.hasOwn(active.config.streetResponse.rules.actions,name)){active.queue.enqueueAction(name,value);return;}if(!selectEnvironment(active,name,performance.now())'],
  ['engine.load(blueprint);', 'engine.load(blueprint);installStreetResponse(engine,config.streetResponse);'],
  ['new CharacterPresentation(engine.world,config.characters)', 'new CharacterPresentation(engine,config.characters)'],
];
for (const [from, to] of edits) {
  if (host.split(from).length !== 2) throw new Error('Host anchor changed: ' + from);
  host = host.replace(from, to);
}
await writeFile(new URL('host.ts', here), host);
const html = await readFile(new URL('../game628-life-controls-20261117/index.html', here), 'utf8');
await writeFile(new URL('index.html', here), html);
await writeFile(new URL('scene-provenance.json', here), JSON.stringify(sourceScenes, null, 2) + '\n');

let presentation = await readFile(new URL('../game628-life-controls-20261117/character-presentation.ts', here), 'utf8');
const presentationEdits = [
  ['private recipes: CharacterRecipe[])', 'private recipes: CharacterRecipe[], private socialPose?: (entity: string, tick: number) => { clip?: string; speed: number; loop: boolean } | undefined)'],
  ['const clip = moving ? recipe.walk : gesture?.clip ?? recipe.idle;', 'const social = this.socialPose?.(recipe.entity, version);\n   const clip = social ? social.clip ?? recipe.idle : moving ? recipe.walk : gesture?.clip ?? recipe.idle;'],
  ['anim.speed = moving ?', 'anim.speed = social ? social.speed : moving ?'],
  ['anim.loop = !gesture;', 'anim.loop = social ? social.loop : !gesture;'],
];
for (const [from, to] of presentationEdits) {
  if (presentation.split(from).length !== 2) throw new Error('Presentation anchor changed: ' + from);
  presentation = presentation.replace(from, to);
}
await writeFile(new URL('character-presentation.ts', here), presentation);
