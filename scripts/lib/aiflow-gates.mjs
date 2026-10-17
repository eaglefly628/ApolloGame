// AI production artifact gates. Human identities are data owned by owner, never auto-populated.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { validateSplit } from '../asset-split.mjs';
import { inside, slugName } from './aiflow-paths.mjs';
export const identity = name => typeof name==='string'?name.normalize('NFKC').trim().toLowerCase():'';
const AGENT_WORDS = ['codex','claude','gpt','openai','opus','astra','fable','gemini','agent','bot','copilot','lead'];
const AGENT = /(?:^|[^\p{L}\p{N}_])(codex|claude|gpt|openai|opus|astra|fable|gemini|agent|bot|copilot|lead)(?=$|[^\p{L}\p{N}_])|^(自动|代理|机器人|施工方|主程)$/iu;
// 历史签字只作提示，不用当前名单决定旧签字效力。
export const legacyAgentSignature = name => identity(name).split(/[\s-]+/u).some(word => AGENT_WORDS.includes(word))
 || ['自动','代理','机器人','施工方','主程'].includes(identity(name));
export function aiFlowEnabled(root, slug, pipeline) {
 slugName(slug);
 const dir=join(root,'docs/design',slug,'keyart');
 if(existsSync(dir)&&statSync(dir).isDirectory())return true;
 if(pipeline===undefined){const file=join(root,'public/games',slug,'pipeline.json');
  try{pipeline=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{};}
  catch(e){console.warn('[aiflow-gates] reject: 无法读取流程启用标志: '+e.message);return false;}
 }
 return pipeline?.aiflow===true;
}
const fill='请 owner 填 docs/roles/humans.json';
export function readHumans(root){
 try{const file=join(root,'docs/roles/humans.json');if(!existsSync(file))throw new Error(fill);const data=JSON.parse(readFileSync(file,'utf8'));
  if(!data||!Array.isArray(data.humans)||data.humans.some(n=>typeof n!=='string'||!n.trim())||new Set(data.humans.map(identity)).size!==data.humans.length)throw new Error('humans.json 格式错误；'+fill);
  if(!data.humans.length)throw new Error(fill);
  if(data.humans.some(n=>AGENT.test(identity(n))))throw new Error('humans.json 含 agent 名，拒收整个名单；'+fill);
  return {ok:true,humans:data.humans};
 }catch(e){console.warn('[aiflow-gates] reject: '+e.message);return{ok:false,humans:[],error:e.message.includes('humans.json')?e.message:'humans.json 无法解析；'+fill};}
}
export function validateHumanSigner(root,by){
 const list=readHumans(root);if(!list.ok)return{ok:false,error:list.error};
 const id=identity(by);let error;
 if(!id)error='人门需要显式 --by 真人白名单姓名';
 else if(!list.humans.some(n=>identity(n)===id))error='--by 不在 docs/roles/humans.json 真人白名单';
 if(error){console.warn('[aiflow-gates] reject: '+error);return{ok:false,error};}
 return{ok:true};
}
function keyartFiles(root,slug){const dir=join(root,'docs/design',slug,'keyart');if(!existsSync(dir)||!statSync(dir).isDirectory())return[];return readdirSync(dir).sort().filter(n=>/\.png$/i.test(n)&&!/-split\.png$/i.test(n)).map(n=>inside(dir,n)).filter(f=>statSync(f).isFile());}
export function aiFlowArtifacts(root,slug,stage){
 try{slugName(slug);const dir=join(root,'docs/design',slug);
  if(stage==='K2'){const files=keyartFiles(root,slug);if(!files.length)throw new Error('缺关键图 keyart/<scene>.png（mock/标注图不算）');for(const file of files){const b=readFileSync(file);if(b.length<33||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('关键图不是有效 PNG: '+relative(dir,file));}return{state:'ok',detail:`keyart/ 在档：${files.length} 张关键图；待真人画面定稿`};}
  if(stage==='D1'){const file=inside(dir,'asset-split.json');if(!existsSync(file))throw new Error('缺 asset-split.json');const rows=validateSplit(JSON.parse(readFileSync(file,'utf8')));if(rows.some(r=>r.state!=='approved'))throw new Error('asset-split.json 尚有 proposed，需全部 approved');return{state:'ok',detail:`asset-split.json ${rows.length} 行全 approved，均有 skinKey；待真人拆层确认`};}
  if(stage==='R1'){const file=inside(dir,'self-check/R1-keyart-review.md');if(!existsSync(file)||!readFileSync(file,'utf8').trim())throw new Error('缺 self-check/R1-keyart-review.md（mock 工件不算）');return{state:'ok',detail:'R1-keyart-review.md 在档；待非施工者独立复查'};}
  throw new Error('未知 AI 流程门: '+stage);
 }catch(e){console.warn(`[aiflow-gates] reject: ${stage}: ${e.message}`);return{state:'fail',detail:e.message};}
}
export function aiFlowHash(root,slug,stage){
 slugName(slug);const dir=join(root,'docs/design',slug),files=[];
 if(stage==='K2'||stage==='R1'){files.push(...keyartFiles(root,slug));const readme=inside(dir,'keyart/README.md');if(existsSync(readme))files.push(readme);}
 if(stage==='D1'||stage==='R1'){const split=inside(dir,'asset-split.json');if(existsSync(split))files.push(split);}
 if(stage==='R1'){
  const report=inside(dir,'self-check/R1-keyart-review.md');if(existsSync(report))files.push(report);
  const walk=path=>{if(!existsSync(path))return;for(const name of readdirSync(path).sort()){const f=inside(path,name);if(statSync(f).isDirectory())walk(f);else files.push(f);}};
  walk(inside(dir,'self-check/shots'));
 }
 const hash=createHash('sha256');hash.update(stage+'\0');for(const f of [...new Set(files)].sort()){hash.update(relative(root,f)+'\0');hash.update(readFileSync(f));hash.update('\0');}return hash.digest('hex').slice(0,16);
}
