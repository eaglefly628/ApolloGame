// T3 input semantics: local immutable PNG snapshots, never positional view guesses.
import { createHash } from 'node:crypto';
import { loadImageInputs, parseGenerationArgs } from './ai-gen-inputs.mjs';
export const TRIPO_VIEWS = Object.freeze(['front', 'left', 'back', 'right']);
const MODES = ['text_to_model', 'image_to_model', 'multiview_to_model'];
const sha = b => createHash('sha256').update(b).digest('hex');
function reject(message) { console.error(`[tripo] reject: ${message}`); throw new Error(`tripo: ${message}`); }
function pathText(value,label) { if(typeof value!=='string'||!value.trim()||value.includes('\0'))reject(`${label} 需要非空PNG路径`); }
function snapshot(input) {
  if(!input||typeof input!=='object'||Array.isArray(input))reject('inputs 每项需要PNG快照对象');
  pathText(input.path,'input.path');
  const role=input.role??'reference';
  if(!['reference','edit'].includes(role))reject(`未知图片role ${role}`);
  if(!(input.buffer instanceof Uint8Array))reject('input.buffer 需要PNG字节');
  const buffer=Buffer.from(input.buffer);
  if(buffer.length<33||buffer.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||buffer.toString('ascii',12,16)!=='IHDR')reject(`输入必须是PNG: ${input.path}`);
  if(buffer.length>20*1024*1024)reject(`PNG超过20MiB: ${input.path}`);
  if(input.view!==undefined&&!TRIPO_VIEWS.includes(input.view))reject(`未知view ${input.view}`);
  return {path:input.path,role,sha256:sha(buffer),buffer,...(input.view!==undefined?{view:input.view}:{})};
}
export function prepareTripoInputs(opts={}) {
  const refs=opts.refs===undefined?[]:opts.refs, edit=opts.edit??null;
  if(!Array.isArray(refs))reject('refs 必须是PNG路径数组');refs.forEach(p=>pathText(p,'ref'));
  if(edit!==null)pathText(edit,'edit');
  const views=opts.views??{};
  if(!views||typeof views!=='object'||Array.isArray(views)||Object.getPrototypeOf(views)!==Object.prototype)reject('views 必须是命名视图对象');
  const keys=Object.keys(views);
  for(const key of keys){if(!TRIPO_VIEWS.includes(key))reject(`未知view ${key}`);pathText(views[key],key);}
  const named=keys.length>0;
  if((edit!==null&&(refs.length||named))||(named&&refs.length))reject('不能混用edit、ref与命名views');
  if(opts.inputs!==undefined&&(refs.length||edit!==null||named))reject('不能混用预载inputs与文件输入');
  if(opts.mode!==undefined&&opts.mode!==null&&!MODES.includes(opts.mode))reject(`未知mode ${opts.mode}`);
  let inputs;
  if(opts.inputs!==undefined) {
    if(!Array.isArray(opts.inputs))reject('inputs 必须是快照数组');
    inputs=opts.inputs.map(snapshot);
  } else if(named) {
    const missing=TRIPO_VIEWS.filter(v=>!Object.hasOwn(views,v));
    if(missing.length)reject(`四视图缺少 ${missing.join(',')}`);
    inputs=loadImageInputs({refs:TRIPO_VIEWS.map(v=>views[v]),cwd:opts.cwd}).map((i,n)=>snapshot({...i,view:TRIPO_VIEWS[n]}));
  } else {
    inputs=loadImageInputs({refs,edit,cwd:opts.cwd}).map(snapshot);
  }
  const hasViews=inputs.some(i=>i.view!==undefined);
  const mode=opts.mode??(hasViews?'multiview_to_model':inputs.length?'image_to_model':'text_to_model');
  if(hasViews&&mode!=='multiview_to_model')reject('命名view必须走完整四视图multiview_to_model，不能降为单图');
  if(mode==='text_to_model'&&inputs.length)reject('text_to_model不能丢弃图片输入');
  if(mode==='image_to_model'&&inputs.length!==1)reject('image_to_model需要且只接受一张图；多图请标注完整四视图');
  if(mode==='multiview_to_model') {
    if(inputs.some(i=>i.role==='edit'))reject('四视图不能混入edit，局部修改只能整体单图重生');
    const counts=new Map();
    for(const input of inputs) {
      if(!TRIPO_VIEWS.includes(input.view))reject('多图必须命名front/left/back/right，不能猜未命名ref顺序');
      if(counts.has(input.view))reject(`重复view ${input.view}`);counts.set(input.view,input);
    }
    const missing=TRIPO_VIEWS.filter(v=>!counts.has(v));if(missing.length)reject(`四视图缺少 ${missing.join(',')}`);
    inputs=TRIPO_VIEWS.map(v=>counts.get(v));
  }
  const editFallback=inputs.some(i=>i.role==='edit');
  if(editFallback&&mode!=='image_to_model')reject('edit必须走整体image_to_model');
  return {mode,inputs,editFallback};
}
export const tripoReferences = inputs => inputs.map(({path,role,sha256,view})=>({path,role,sha256,...(view!==undefined?{view}:{})}));
export function parseTripoGenerationArgs(argv) {
  const rest=[],views={};let mode;
  for(let i=0;i<argv.length;i++) {
    const flag=argv[i];
    if(flag==='--mode'||TRIPO_VIEWS.some(v=>flag===`--${v}`)) {
      const value=argv[++i];if(!value||value.startsWith('--'))reject(`${flag} 缺值`);
      if(flag==='--mode'){if(mode!==undefined)reject('--mode不能重复');if(!MODES.includes(value))reject(`未知mode ${value}`);mode=value;}
      else {const view=flag.slice(2);if(Object.hasOwn(views,view))reject(`重复view ${view}`);views[view]=value;}
    } else rest.push(flag);
  }
  return {...parseGenerationArgs(rest),...(mode!==undefined?{mode}:{}),...(Object.keys(views).length?{views}:{})};
}
