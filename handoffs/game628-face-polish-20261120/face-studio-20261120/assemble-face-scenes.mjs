import assert from 'node:assert/strict';
import fs from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..'),c=JSON.parse(await fs.readFile(path.join(here,'face-contract.json'),'utf8')),scenes=path.join(root,'public/scenes');
const familyLabels = { eyes: '眼睛', brows: '眉毛', nose: '鼻子', mouth: '嘴巴' };
const uiConditions = {};
const button = (id, label, action, kind = 'ghost', layout = { minHeight: 36 }) => ({
  id, type: 'Button', props: { label, action, kind },
  layout,
});
const label = (id, text, size = 14) => ({ id, type: 'Label', props: { text, size, color: 'text' } });
const group = (id, layout, children) => ({ id, type: 'Panel', props: { bare: true }, layout, children });

function featureRow(family, names, {
  namespace = 'face', conditions = uiConditions, title = familyLabels[family], minHeight = 36,
} = {}) {
  const options = names.map((name, index) => {
    const fsmId = `${namespace}.${family}`;
    const action = `${fsmId}.${index}`;
    const id = `${family}-${index}`;
    conditions[action] = { kind: 'state', fsmId, equals: String(index) };
    const target = { minHeight };
    return group(id, { flex: 1, minWidth: 0 }, [
      {
        id: `${id}-selection-frame`, type: 'Panel', props: { edge: 'gold' },
        layout: { padding: 0, radius: 8 }, visibleWhen: action,
        children: [button(`${id}-selected`, `✓ ${name}`, action, 'quiet', {
          ...target, fx: [{ kind: 'ripple' }],
        })],
      },
      {
        id: `${id}-option-frame`, type: 'Panel', props: {},
        layout: { padding: 0, radius: 8 }, visibleWhen: `!${action}`,
        children: [button(`${id}-available`, name, action, 'quiet', target)],
      },
    ]);
  });
  return group(`row-${family}`, { direction: 'row', align: 'center', gap: 8 }, [
    { ...label(`label-${family}`, title), layout: { width: 42 } },
    ...options,
  ]);
}

function layout(gallery = false) {
  const title = gallery ? '五位店员' : '居民捏脸';
  const tab = gallery ? button('studio', '返回捏脸', 'host.faceStudio') : button('gallery', '五位店员', 'host.faceGallery');
  const footer = gallery
    ? [label('instructions', '看看五位店员各自的眼神和笑容。')]
    : [group('face-controls', { maxWidth: 560, gap: 8 }, [
      ...Object.entries(c.families).map(([family, names]) => featureRow(family, names)),
      group('actions', { direction: 'row', justify: 'center', gap: 8 }, [
        button('random', '随机一张', 'face.random', 'ghost', { minHeight: 40, fx: [{ kind: 'ripple' }] }),
        button('reset', '恢复初始脸', 'host.faceReset', 'ghost', { minHeight: 40 }),
        button('wave', '打个招呼', 'face.wave', 'ghost', { minHeight: 40 }),
      ]),
    ])];
  return {
    id: 'prototype', type: 'Screen', props: { fill: true },
    children: [
      {
        id: 'header', type: 'Panel', props: {},
        layout: { direction: 'row', align: 'center', padding: 12, gap: 12 },
        children: [
          { ...label('title', title, 21), layout: { flex: 1 } },
          ...(!gallery ? [button('avatar-studio', '全身编辑', 'host.avatarStudio')] : []),
          tab,
        ],
      },
      { id: 'scene-stage', type: 'Panel', props: { bare: true }, layout: { flex: 1 } },
      { id: 'footer', type: 'Panel', props: {}, layout: { align: 'center', padding: 12 }, children: footer },
    ],
  };
}
const common={sky:{Sky3D:{top:0x91bdd9,bottom:0xe0e6d9,env:.04,clouds:false}},sun:{Light3D:{kind:'directional',color:0xffe3bc,intensity:2,dirX:.5,dirY:-1,dirZ:-.8,castShadow:true}},ambient:{Light3D:{kind:'ambient',color:0xb9d0db,intensity:1.1}},floor:{Transform3D:{x:0,y:-.08,z:0},Mesh3D:{shape:'box',width:14,height:.16,depth:7,frontTint:0xc3bea9},Material3D:{color:0xc3bea9,roughness:.95}},camera:{Camera3D:{yaw:0,pitch:.025,distance:7,projection:'ortho',orthoSize:.48,near:.1,far:5000,pivotX:0,pivotY:1.32,pivotZ:.05}}};
const e=structuredClone(common),keys={KeyR:{action:'face.random'},Space:{action:'face.wave'}},assets=c.variants.map(v=>({kind:'model',key:v.key,src:v.src}));
for(const family of Object.keys(c.families))e['state-'+family]={State:{fsmId:'face.'+family,current:'0',previous:'0'}};
e.seed={RandomSeed:{seed:c.seed,sequence:0}};
const characters=[];
for(const v of c.variants){const id='face-'+v.id;e[id]={Transform:{x:0,y:0,rotation:0,scaleX:1,scaleY:1},Velocity:{vx:0,vy:0,angular:0},Model3D:{modelKey:v.key,scale:1},AnimState3D:{clip:'idle',loop:true,speed:1},Tag:{flags:1},Visibility:{visible:v.id==='0000'}};characters.push({entity:id,idle:'idle',walk:'walk',nominalSpeedPerTick:.9221460884538626/60,gesture:{action:'face.wave',clip:'wave',durationMs:4733.333333}});
 const signal='show.'+v.id;e['choose-'+v.id]={EventWhen:{signal,mode:'edge',armed:false,when:{kind:'and',of:Object.entries(v.dna).map(([family,index])=>({kind:'state',fsmId:'face.'+family,equals:String(index)}))}}};e['hide-'+v.id]={Effect:{onSignal:signal,kind:'set-visible-tagged',tagMask:1,value:false,order:0}};e['show-'+v.id]={Effect:{onSignal:signal,kind:'set-visible',targetEntity:id,value:true,order:1}};}
function effect(id,onSignal,family,value,order=0,chance){e[id]={Effect:{onSignal,kind:'set-state',targetId:'face.'+family,value:String(value),order,...(chance?{chance}:{})}};}
for(const family of Object.keys(c.families))for(let index=0;index<3;index++){const action='face.'+family+'.'+index;e['input-'+family+'-'+index]={KeyBinding:{key:action,signal:action}};effect('select-'+family+'-'+index,action,family,index);}
e['input-random']={KeyBinding:{key:'face.random',signal:'face.random'}};
for(const[fi,family]of Object.keys(c.families).entries()){effect('random-'+family+'-0','face.random',family,0,fi*3);effect('random-'+family+'-1','face.random',family,1,fi*3+1,{num:1,den:2});effect('random-'+family+'-2','face.random',family,2,fi*3+2,{num:1,den:3});}
const links={'host.faceStudio':'face-studio','host.faceGallery':'face-gallery','host.faceReset':'face-studio','host.avatarStudio':'avatar-studio'},studio={assets,links,prefetchLinks:['host.faceGallery'],keys,characters,manifest:{capabilities:['j1-state','w1-random','t2-keybind','t2-event-when','t2-effect-apply'],entities:e},layout:layout(false),uiConditions,framing:{minHalfWidth:.37,minHalfHeight:.48},faceSystem:{version:1,seed:c.seed,finiteCombinations:81,stateIds:Object.keys(c.families).map(k=>'face.'+k),randomRule:'default0; P(set1)=1/2; P(override2)=1/3 => uniform three-way; 8 engine PRNG draws/click'}};
await fs.writeFile(path.join(scenes,'face-studio.json'),JSON.stringify(studio,null,2));
const ge=structuredClone(common);ge.camera.Camera3D={yaw:.04,pitch:.04,distance:10,projection:'ortho',orthoSize:1.20,near:.1,far:5000,pivotX:0,pivotY:.95,pivotZ:.05};
for(let i=0;i<c.npcs.length;i++){const n=c.npcs[i],x=(i-2)*1.6;ge['npc-'+n.shop]={Transform3D:{x,y:0,z:0},Model3D:{modelKey:n.modelKey,scale:1},AnimState3D:n.AnimState3D};ge['label-'+n.shop]={Transform3D:{x,y:0,z:.3},WorldUI3D:{offsetY:0,text:{grocery:'果蔬铺',bakery:'面包房',noodles:'面馆',catcafe:'猫咖',bikeshop:'修车铺'}[n.shop],size:13,color:'#2c3d40'}};}
const gallery={assets:c.npcs.map(n=>({kind:'model',key:n.modelKey,src:n.src})),links:{'host.faceStudio':'face-studio'},keys:{},framing:{minHalfWidth:4.1,minHalfHeight:1.2},manifest:{capabilities:[],entities:ge},layout:layout(true)};await fs.writeFile(path.join(scenes,'face-gallery.json'),JSON.stringify(gallery,null,2));console.log('[face-scenes:commit]',{studioVariants:c.variants.length,galleryNPCs:c.npcs.length,seed:c.seed});

// Local silhouette study using explicit torso, apron and seat nodes from the same authored resident.
const bodyPresets = [
  { id: 'slim', label: '纤瘦', width: 0.78, depth: 0.74 },
  { id: 'regular', label: '匀称', width: 1, depth: 1 },
  { id: 'full', label: '圆润', width: 1.28, depth: 1.43 },
];
const bodyEntities = structuredClone(common);
bodyEntities.camera.Camera3D = {
  yaw: 0, pitch: 0.05, distance: 7, projection: 'ortho',
  orthoSize: 1.05, near: 0.1, far: 5000, pivotX: 0, pivotY: 0.84, pivotZ: 0,
};
const original = c.variants.find(variant => variant.id === '0000');
const baseFace = JSON.parse(await fs.readFile(path.join(root, 'public', original.src), 'utf8'));
function applyBodyPreset(model, preset) {
  for (const name of ['shirt-body', 'apron-front', 'apron-pocket', 'trouser-seat']) {
    const node = model.nodes.find(node => node.name === name);
    node.scale[0] *= preset.width;
    node.scale[2] *= preset.depth;
    node.translation[2] *= preset.depth;
  }
  const shoulderOffset = Math.max(-0.8, (preset.width - 1) * 22);
  for (const [shoulder, side] of [['LeftShoulder', 1], ['RightShoulder', -1]]) {
    model.nodes.find(node => node.name === shoulder).translation[0] += side * shoulderOffset;
  }
}

async function writeAvatarModel(key, model) {
  const src = original.src.replace('face-0000.gltf', `${key}.gltf`);
  await fs.writeFile(path.join(root, 'public', src), JSON.stringify(model));
  return { kind: 'model', key, src };
}

const bodyAssets = [];
for (const [index, preset] of bodyPresets.entries()) {
  const key = `body-${preset.id}`;
  const model = structuredClone(baseFace);
  applyBodyPreset(model, preset);
  bodyAssets.push(await writeAvatarModel(key, model));

  const x = (index - 1) * 1.05;
  bodyEntities[key] = {
    Transform3D: { x, y: 0, z: 0, rotY: 0.36 },
    Model3D: { modelKey: key, scale: 1 },
    AnimState3D: { clip: 'idle', loop: true, speed: 1 },
  };
  bodyEntities[`label-${preset.id}`] = {
    Transform3D: { x, y: -0.11, z: 0.42 },
    WorldUI3D: { offsetY: 0, text: preset.label, size: 14, color: '#233239' },
  };
}

const bodyLayout = layout(true);
bodyLayout.children[0].children[0].props.text = '居民体型';
bodyLayout.children[0].children[1] = button('avatar-studio', '全身编辑', 'host.avatarStudio', 'ghost', { minHeight: 44 });
bodyLayout.children[2].children[0].props.text = '同身高下比较躯干的宽度和厚度';
const bodyStudy = {
  assets: bodyAssets, links: { 'host.avatarStudio': 'avatar-studio' }, prefetchLinks: [], keys: {},
  framing: { minHalfWidth: 1.68, minHalfHeight: 1.05 },
  manifest: { capabilities: [], entities: bodyEntities },
  layout: bodyLayout, bodyPresets,
};
await fs.writeFile(path.join(scenes, 'body-study.json'), JSON.stringify(bodyStudy, null, 2));

// A small, separately authored library of compatible whole-body recipes.
const avatarFields = {
  expression: { title: '脸部', initial: 0, options: [
    { label: '微笑', face: '0000' }, { label: '笑眼', face: '1100' }, { label: '俏皮', face: '2022' },
  ] },
  build: { title: '体型', initial: 1, options: bodyPresets },
  hat: { title: '帽子', initial: 0, options: [
    { label: '短檐帽', id: 'cap' }, { label: '不戴帽', id: 'none' },
  ] },
  hand: { title: '手形', initial: 0, options: [
    { label: '圆手', id: 'round', scale: [1, 1, 1] },
    { label: '宽掌', id: 'broad', scale: [1.28, 1.06, 1.23] },
  ] },
};
const fieldEntries = Object.entries(avatarFields);
const avatarConditions = {};
const avatarLayout = layout(true);
avatarLayout.children[0].children = [
  { ...label('title', '全身编辑', 21), layout: { flex: 1 } },
  button('studio', '捏脸页', 'host.faceStudio', 'ghost', { minHeight: 44 }),
  button('body-study', '体型对照', 'host.bodyStudy', 'ghost', { minHeight: 44 }),
];
avatarLayout.children[2].children = [
  group('avatar-controls', { maxWidth: 560, gap: 6 }, [
    ...fieldEntries.map(([field, spec]) => featureRow(field, spec.options.map(option => option.label), {
      namespace: 'avatar', conditions: avatarConditions, title: spec.title, minHeight: 44,
    })),
    group('avatar-actions', { direction: 'row', justify: 'center', gap: 8 }, [
      button('avatar-wave', '挥手看看', 'avatar.wave', 'ghost', { minHeight: 44, fx: [{ kind: 'ripple' }] }),
      button('avatar-reset', '恢复默认', 'avatar.reset', 'ghost', { minHeight: 44 }),
    ]),
  ]),
];

const avatarEntities = structuredClone(common);
avatarEntities.camera.Camera3D = {
  ...avatarEntities.camera.Camera3D, orthoSize: 0.99, pivotY: 0.84, pivotZ: 0,
};
const defaults = fieldEntries.map(([, spec]) => spec.initial).join('');
for (const [field, spec] of fieldEntries) {
  const fsmId = `avatar.${field}`;
  const initial = String(spec.initial);
  avatarEntities[`state-${field}`] = { State: { fsmId, current: initial, previous: initial } };
  for (const index of spec.options.keys()) {
    const signal = `${fsmId}.${index}`;
    avatarEntities[`input-${field}-${index}`] = { KeyBinding: { key: signal, signal } };
    avatarEntities[`select-${field}-${index}`] = {
      Effect: { onSignal: signal, kind: 'set-state', targetId: fsmId, value: String(index) },
    };
  }
  avatarEntities[`reset-${field}`] = {
    Effect: { onSignal: 'avatar.reset', kind: 'set-state', targetId: fsmId, value: initial },
  };
}
avatarEntities['input-reset'] = { KeyBinding: { key: 'avatar.reset', signal: 'avatar.reset' } };

const appearanceModels = new Map();
for (const option of avatarFields.expression.options) {
  const variant = c.variants.find(variant => variant.id === option.face);
  assert.ok(variant, `missing facial recipe ${option.face}`);
  appearanceModels.set(option.face, JSON.parse(await fs.readFile(path.join(root, 'public', variant.src), 'utf8')));
}

function applyHeadwear(model, preset) {
  if (preset.id === 'cap') return;
  const head = model.nodes.find(node => node.name === 'Head');
  head.children = head.children.filter(index => !['cap-crown', 'cap-visor'].includes(model.nodes[index].name));
  const crown = model.nodes.find(node => node.name === 'hair-crown');
  crown.scale[1] *= 1.2;
  crown.translation[1] += 2.2;
}

function applyHandShape(model, preset) {
  for (const side of ['Left', 'Right']) {
    const hand = model.nodes.find(node => node.name === `${side}-hand`);
    hand.scale = hand.scale.map((value, axis) => value * preset.scale[axis]);
  }
}

let combinations = [[]];
for (const [, spec] of fieldEntries) {
  combinations = combinations.flatMap(previous => spec.options.map((_, index) => [...previous, index]));
}
const avatarAssets = [];
const avatarCharacters = [];
for (const indices of combinations) {
  const [expression, build, hat, hand] = indices;
  const key = `avatar-${indices.join('')}`;
  const face = avatarFields.expression.options[expression];
  const model = structuredClone(appearanceModels.get(face.face));
  applyBodyPreset(model, avatarFields.build.options[build]);
  applyHeadwear(model, avatarFields.hat.options[hat]);
  applyHandShape(model, avatarFields.hand.options[hand]);
  avatarAssets.push(await writeAvatarModel(key, model));

  avatarEntities[key] = {
    Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    Transform3D: { x: 0, y: 0, z: 0, rotY: 0.18 },
    Velocity: { vx: 0, vy: 0, angular: 0 },
    Model3D: { modelKey: key, scale: 1 },
    AnimState3D: { clip: 'idle', loop: true, speed: 1 },
    Tag: { flags: 1 }, Visibility: { visible: indices.join('') === defaults },
  };
  avatarCharacters.push({
    entity: key, idle: 'idle', walk: 'walk', nominalSpeedPerTick: 0.9221460884538626 / 60,
    gesture: { action: 'avatar.wave', clip: 'wave', durationMs: 4733.333333 },
  });
  const signal = `show.${key}`;
  avatarEntities[`choose-${key}`] = { EventWhen: {
    signal, mode: 'edge', armed: false,
    when: { kind: 'and', of: fieldEntries.map(([field], index) => ({
      kind: 'state', fsmId: `avatar.${field}`, equals: String(indices[index]),
    })) },
  } };
  avatarEntities[`hide-${key}`] = { Effect: { onSignal: signal, kind: 'set-visible-tagged', tagMask: 1, value: false, order: 0 } };
  avatarEntities[`show-${key}`] = { Effect: { onSignal: signal, kind: 'set-visible', targetEntity: key, value: true, order: 1 } };
}

const avatarStudio = {
  assets: avatarAssets, characters: avatarCharacters,
  links: { 'host.faceStudio': 'face-studio', 'host.bodyStudy': 'body-study' },
  prefetchLinks: ['host.bodyStudy'],
  keys: { Space: { action: 'avatar.wave' } }, uiConditions: avatarConditions,
  framing: { minHalfWidth: 0.53, minHalfHeight: 0.99 },
  layout: avatarLayout,
  manifest: { capabilities: ['j1-state', 't2-keybind', 't2-event-when', 't2-effect-apply'], entities: avatarEntities },
};
await fs.writeFile(path.join(scenes, 'avatar-studio.json'), JSON.stringify(avatarStudio, null, 2));
console.info('[avatar-scenes:commit]', { combinations: avatarAssets.length, defaults });
