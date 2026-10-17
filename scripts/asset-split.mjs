#!/usr/bin/env node
// T2: one split list -> deterministic numbered PNG annotations + existing art ledger.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePngRGBA } from './asset-matte.mjs';
import { mockImage } from './ai-gen.mjs';
import { mergeLedger } from './art-replace.mjs';
import { artRoot } from './art-paths.mjs';
import { inside, slugName } from './lib/aiflow-paths.mjs';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIELDS = ['id', 'scene', 'bbox', 'route', 'skinKey', 'prompt', 'refs', 'state'];
const nonempty = s => typeof s === 'string' && !!s.trim();
function reject(message) { console.error(`[asset-split] reject: ${message}`); throw new Error(message); }
export function validateSplit(rows) {
  const ids = new Set();
  if (!Array.isArray(rows) || !rows.length) reject('asset-split.json 必须为非空数组');
  for (const [i, row] of rows.entries()) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) reject(`行 ${i}: 需要对象`);
    if (Object.keys(row).some(k => !FIELDS.includes(k)) || FIELDS.some(k => !(k in row))) reject(`行 ${i}: 字段必须为 ${FIELDS.join(',')}`);
    if (!nonempty(row.id) || ids.has(row.id)) reject(`行 ${i}: id 缺失或重复`);
    ids.add(row.id);
    try { slugName(row.scene); } catch (e) { reject(e.message); }
    if (!nonempty(row.skinKey)) reject(`行 ${row.id}: 缺 skinKey，禁止孤儿行入台账`);
    if (!nonempty(row.prompt)) reject(`行 ${row.id}: 缺 prompt`);
    if (!['generate', 'build', 'character'].includes(row.route)) reject(`行 ${row.id}: route 非闭集`);
    if (!['proposed', 'approved'].includes(row.state)) reject(`行 ${row.id}: state 非闭集`);
    if (!Array.isArray(row.bbox) || row.bbox.length !== 4 || row.bbox.some(v => !Number.isSafeInteger(v)) || row.bbox[0] < 0 || row.bbox[1] < 0 || row.bbox[2] <= 0 || row.bbox[3] <= 0) reject(`行 ${row.id}: bbox 必须为原图整数像素 [x,y,w,h]`);
    if (!Array.isArray(row.refs) || row.refs.some(r => !nonempty(r))) reject(`行 ${row.id}: refs 必须为路径数组`);
  }
  return rows;
}
const COLORS = { generate: [255, 187, 40], build: [20, 220, 255], character: [255, 90, 185] };
const DIGITS = ['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];
export function annotateSplit(image, rows) {
  const { w, h } = image, rgba = Buffer.from(image.rgba);
  const pixel = (x,y,c) => { if(x>=0&&y>=0&&x<w&&y<h){const o=(y*w+x)*4;rgba[o]=c[0];rgba[o+1]=c[1];rgba[o+2]=c[2];rgba[o+3]=255;} };
  rows.forEach((row, i) => {
    const [x,y,bw,bh] = row.bbox, c = COLORS[row.route];
    if (x + bw > w || y + bh > h) reject(`${row.id}: bbox 超出关键图 ${w}x${h}`);
    for(let xx=x;xx<x+bw;xx++){pixel(xx,y,c);pixel(xx,y+bh-1,c);}
    for(let yy=y;yy<y+bh;yy++){pixel(x,yy,c);pixel(x+bw-1,yy,c);}
    // Stable numeric labels; asset-split.md maps numbers to full ids, routes and slots.
    const label=String(i+1);
    for(let yy=y;yy<Math.min(h,y+7);yy++)for(let xx=x;xx<Math.min(w,x+label.length*4+2);xx++)pixel(xx,yy,[0,0,0]);
    [...label].forEach((d,n)=>{for(let yy=0;yy<5;yy++)for(let xx=0;xx<3;xx++)if(DIGITS[+d][yy*3+xx]==='1')pixel(x+1+n*4+xx,y+1+yy,c);});
  });
  return encodePngRGBA(w,h,rgba);
}
export function deriveSplitLedger(rows, slug, previous = null) {
  validateSplit(rows);
  const grouped = new Map();
  for (const row of rows) {
    if (row.state !== 'approved') { console.info(`[asset-split] skip: ${row.id} state=${row.state}`); continue; }
    const existing = grouped.get(row.skinKey);
    if (existing) { existing.splitIds.push(row.id); existing.refs = [...new Set([...existing.refs,...row.refs])]; continue; }
    grouped.set(row.skinKey, { no: `art-${String(grouped.size+1).padStart(2,'0')}`, skinKey: row.skinKey, kind: 'sprite', query: row.prompt, prompt: row.prompt, desc: row.id, context: `keyart:${row.scene} route:${row.route}`, spec: { w: row.bbox[2], h: row.bbox[3], transparent: true }, refs: [...row.refs], splitIds: [row.id], status: 'needs-art', gen: null, provenance: null });
  }
  const fresh={version:1,game:slug,mode:'requirements',count:grouped.size,rows:[...grouped.values()]};
  // A formerly imported row that is now only proposed must not survive as an active approved asset.
  const blocked=new Set(rows.filter(r=>r.state!=='approved'&&!grouped.has(r.skinKey)).map(r=>r.skinKey));
  const safePrevious=previous?{...previous,rows:previous.rows.map(r=>(blocked.has(r.skinKey)||(r.splitIds&&!grouped.has(r.skinKey)))?{...r,status:'retired'}:r)}:null;
  return mergeLedger(safePrevious,fresh);
}
export function splitWorkspace(root, slug, { mock = false } = {}) {
  slugName(slug);
  const dir=join(root,'docs','design',slug);
  const rows=validateSplit(JSON.parse(readFileSync(inside(dir,'asset-split.json'),'utf8')));
  const images=new Map(), outputs=[];
  for(const scene of [...new Set(rows.map(r=>r.scene))].sort()) {
    const file=inside(dir,`keyart/${scene}.png`);
    if(!existsSync(file)&&mock){console.warn(`[asset-split] downgrade: ${scene} 缺关键图 → mock 预览（不写真实工作区）`);const rs=rows.filter(r=>r.scene===scene);const n=Math.max(32,...rs.flatMap(r=>[r.bbox[0]+r.bbox[2],r.bbox[1]+r.bbox[3]]));if(n>4096)reject('mock 图超过4096');images.set(scene,decodePng(mockImage(scene,n).buffer));}
    else images.set(scene,decodePng(readFileSync(file)));
  }
  for(const row of rows)for(const ref of row.refs)if(!existsSync(inside(dir,ref)))reject(`${row.id}: 参考图不存在 ${ref}`);
  for(const [scene,image] of images){const subset=rows.filter(r=>r.scene===scene);outputs.push({file:inside(dir,`keyart/${mock?'mock/':''}${scene}-split.png`),buffer:annotateSplit(image,subset)});}
  const ledgerFile=inside(root,relative(root,join(artRoot(root,slug),'art-ledger.json')));
  const previous=existsSync(ledgerFile)?JSON.parse(readFileSync(ledgerFile,'utf8')):null;
  const ledger=deriveSplitLedger(rows,slug,previous);
  const markdown=['# 拆层单（机器推导；批准由真人确认）',''];
  for(const scene of images.keys()) { markdown.push(`## ${scene}`,'','| 标号 | id | bbox | route | skinKey | state |','|---|---|---|---|---|---|');rows.filter(r=>r.scene===scene).forEach((r,i)=>markdown.push(`| ${i+1} | ${r.id.replaceAll('|','\\|')} | ${r.bbox.join(',')} | ${r.route} | ${r.skinKey.replaceAll('|','\\|')} | ${r.state} |`));markdown.push(''); }
  if(mock){console.warn('[asset-split] skip: mock 不写台账、不改批准态');}
  else {mkdirSync(dirname(ledgerFile),{recursive:true});writeFileSync(ledgerFile,JSON.stringify(ledger,null,2)+'\n');writeFileSync(inside(dir,'asset-split.md'),markdown.join('\n'));}
  for(const out of outputs){mkdirSync(dirname(out.file),{recursive:true});writeFileSync(out.file,out.buffer);}
  console.info(`[asset-split] commit: ${outputs.length} 标注图 · ${ledger.rows.filter(r=>r.status!=='retired').length} 台账行${mock?'（仅预览）':''}`);
  return { ledger, outputs:outputs.map(o=>o.file), mock };
}
if(import.meta.url===`file://${process.argv[1]}`){try{const a=process.argv.slice(2);const ri=a.indexOf('--root');splitWorkspace(ri>=0?a[ri+1]:ROOT,a[0],{mock:a.includes('--mock')});}catch(e){console.error(`[asset-split] reject: ${e.message}`);process.exitCode=1;}}
