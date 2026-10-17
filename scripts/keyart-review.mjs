#!/usr/bin/env node
// T6/U4/R5: collect evidence, never issue the independent review verdict.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inside, slugName } from './lib/aiflow-paths.mjs';
import { mockImage } from './ai-gen.mjs';
import { imageMetrics, sideBySide, uiDifferences } from './lib/keyart-metrics.mjs';
import { captureFrames } from './lib/keyart-capture.mjs';
import { measurePage } from './design-measure.mjs';
const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
const hash=b=>createHash('sha256').update(b).digest('hex');
const positive=n=>Number.isInteger(n)&&n>0&&n<=4096;
export function validateReviewConfig(config={}){
 const c=structuredClone(config);
 c.mode??='scene';c.viewport??={width:1000,height:640};c.presets??=[{id:'main',frame:60}];
 if(!['scene','ui'].includes(c.mode)||!positive(c.viewport.width)||!positive(c.viewport.height))throw new Error('无效 mode/viewport');
 if(c.entry&&(typeof c.entry!=='string'||!c.entry.endsWith('.html')))throw new Error('entry 需要本地 html');
 if(!Array.isArray(c.presets)||!c.presets.length)throw new Error('presets 需要非空数组');
 const ids=new Set();
 for(const p of c.presets){slugName(p.id);if(ids.has(p.id))throw new Error('重复 preset id');ids.add(p.id);if(!p.frames)p.frame??=60;const frames=p.frames??[p.frame];if(!Array.isArray(frames)||!frames.length||frames.length>120||frames.some((n,i)=>!Number.isInteger(n)||n<0||n>600||(i&&n<=frames[i-1])))throw new Error('frames 须为递增的0..600整数，最多120帧');
  if(p.reference&&(typeof p.reference!=='string'||!p.reference.endsWith('.png')))throw new Error('reference 需要PNG');
  if(p.actions&&(!Array.isArray(p.actions)||p.actions.length>20))throw new Error('actions 需要数组且最多20项');
  for(const a of p.actions??[])if(!a||Object.keys(a).length!==1||!['click','key'].includes(Object.keys(a)[0])||typeof Object.values(a)[0]!=='string'||!Object.values(a)[0])throw new Error('action 限 click/key 字符串');
  if(p.camera){const allowed=['entity','mode','yaw','pitch','distance','pivotX','pivotY','pivotZ','fov','projection','orthoSize'];for(const [k,v]of Object.entries(p.camera)){if(!allowed.includes(k))throw new Error('Camera3D 非法字段 '+k);if(k==='entity'){if(typeof v!=='string'||!v)throw new Error('camera.entity 缺失');}else if(k==='mode'){if(!['orbit','follow'].includes(v))throw new Error('camera.mode 非法');}else if(k==='projection'){if(!['perspective','orthographic'].includes(v))throw new Error('camera.projection 非法');}else if(!Number.isFinite(v))throw new Error('camera 数字非法');}}
 }
 if(c.mode==='ui'){
  if(!c.ui||typeof c.ui.reference!=='string'||!c.ui.reference.endsWith('.html'))throw new Error('UI 模式需要 ui.reference HTML');
  c.ui.canvas??={width:1920,height:1080};if(!positive(c.ui.canvas.width)||!positive(c.ui.canvas.height))throw new Error('UI canvas 非法');
  if(!Array.isArray(c.ui.items)||!c.ui.items.length)throw new Error('UI 模式需要逐件 items');const keys=new Set();
  for(const item of c.ui.items){if(!item.id||keys.has(item.id)||typeof item.selector!=='string'||!item.selector||item.actualSelector!==undefined&&typeof item.actualSelector!=='string')throw new Error('UI item id/selector 非法');keys.add(item.id);}
 }
 return c;
}
export async function keyartReview(root,slug,scene,{mock=false,mode,capture=captureFrames}={}){
 slugName(slug);slugName(scene);
 const dir=join(root,'docs/design',slug),configFile=inside(dir,`keyart/${scene}.review.json`);
 const config=validateReviewConfig({...existsSync(configFile)?JSON.parse(readFileSync(configFile,'utf8')):{},...(mode?{mode}:{})});
 if(config.entry)inside(root,config.entry);
 if(config.ui)inside(dir,config.ui.reference);
 const references=new Map();
 if(config.mode==='scene')for(const p of config.presets){const path=p.reference??`keyart/${scene}.png`,file=inside(dir,path);if(existsSync(file))references.set(path,readFileSync(file));else if(mock){console.warn(`[keyart-review] downgrade: 缺 ${path} → mock参考`);references.set(path,mockImage('reference:'+scene,32).buffer);}else throw new Error('关键图缺失: '+path);}
 let evidence;
 if(mock){console.warn('[keyart-review] downgrade: --mock，仅生成隔离证据，不落真实 R1 门工件');evidence={shots:config.presets.flatMap(p=>(p.frames??[p.frame]).map(frame=>({preset:p.id,frame,buffer:mockImage(`${slug}/${scene}/${p.id}/${frame}`,32).buffer,reference:p.reference??`keyart/${scene}.png`,boxes:[]}))),referenceBoxes:[],referenceImage:mockImage('reference-ui:'+scene,32).buffer};}
 else evidence=await capture(root,slug,scene,config,{measurePage});
 const base=mock?'self-check/mock':'self-check';
 const shotDir=inside(dir,`${base}/shots/${scene}`),pending=[];
 const metrics={version:1,mode:config.mode,mock,advisoryOnly:true,shots:[]};
 for(const shot of evidence.shots){const reference=config.mode==='ui'?evidence.referenceImage:references.get(shot.reference);if(!reference)throw new Error('截图缺对应参考图');const prefix=`${shot.preset}-${String(shot.frame).padStart(4,'0')}`;
  pending.push({path:join(shotDir,prefix+'.png'),buffer:shot.buffer},{path:join(shotDir,prefix+'-compare.png'),buffer:sideBySide(reference,shot.buffer)});
  metrics.shots.push({preset:shot.preset,frame:shot.frame,reference:config.mode==='ui'?config.ui.reference:shot.reference,referenceSha256:hash(reference),screenshot:prefix+'.png',comparison:prefix+'-compare.png',sha256:hash(shot.buffer),image:imageMetrics(reference,shot.buffer),...(config.mode==='ui'?{ui:uiDifferences(evidence.referenceBoxes,shot.boxes)}:{})});
 }
 if(!pending.length)throw new Error('零截图，拒绝生成复查工件');
 for(const output of pending){mkdirSync(dirname(output.path),{recursive:true});writeFileSync(output.path,output.buffer);}
 mkdirSync(shotDir,{recursive:true});writeFileSync(join(shotDir,'metrics.json'),JSON.stringify(metrics,null,2)+'\n');
 const reviewFile=inside(dir,`${base}/R1-keyart-review.md`),marker=`<!-- scene:${scene} -->`;
 const section=[marker,`## ${scene} · ${config.mode} · 待独立盲审`,'','施工主体：待填写；复查人：待填写（两者必须不同）。','先只读参考图与截图/动作帧，记录第一轮差异；之后才用客观指标定位。指标只作参考，不是通过阈值。','',...metrics.shots.map(s=>`- ${s.preset} / frame ${s.frame}：参考 \`${s.reference}\`；截图 [${s.screenshot}](shots/${scene}/${s.screenshot})；[并排图](shots/${scene}/${s.comparison})（左参考，右截图）`),'','| 项 | 差异位置与证据 | 需要修改/补帧 |','|---|---|---|',...['构图/层次','色调','光源','比例','动作（穿模/滑步/抖动/接触）',...(config.mode==='ui'?['UI 逐件位置/尺寸/颜色']:[])].map(k=>`| ${k} | 待复查人填写 | 待填写 |`),'','独立结论：待复查人填写。',''];
 if(!existsSync(reviewFile)){mkdirSync(dirname(reviewFile),{recursive:true});writeFileSync(reviewFile,['# R1 关键图复查（待独立审查）','',...section].join('\n'));}
 else if(!readFileSync(reviewFile,'utf8').includes(marker)){writeFileSync(reviewFile,readFileSync(reviewFile,'utf8')+'\n'+section.join('\n'));console.info('[keyart-review] transition: 追加新场景骨架，保留已有结论');}
 else console.info('[keyart-review] skip: 已有复查章节，不覆盖复查人文字');
 console.info(`[keyart-review] commit: ${metrics.shots.length} 帧与对比图；advisoryOnly=true${mock?'；MOCK':''}`);
 return {metrics,reviewFile,shotDir};
}
if(import.meta.url===`file://${process.argv[1]}`){const a=process.argv.slice(2),value=flag=>{const i=a.indexOf(flag);if(i<0)return undefined;if(!a[i+1]||a[i+1].startsWith('--'))throw new Error(flag+' 缺值');return a[i+1];};try{await keyartReview(value('--root')??ROOT,a[0],a[1],{mock:a.includes('--mock'),mode:value('--mode')});}catch(e){console.error('[keyart-review] reject: '+e.message);process.exitCode=1;}}
