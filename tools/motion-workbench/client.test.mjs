import {it,expect} from 'vitest';
import fs from 'node:fs';
import {transform} from 'esbuild';
let source=fs.readFileSync(new URL('./client.ts',import.meta.url),'utf8').replace(/^import .*$/gm,'');
const {code}=await transform(source,{loader:'ts',target:'es2022'});
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const cases=[
{key:'runtime-clip:orphan',id:'orphan',type:'runtime-clip',title:'orphan',status:'candidate',previewable:false,candidateSkinIds:[],applicableSkinIds:[]},
{key:'runtime-clip:mixed',id:'mixed',type:'runtime-clip',title:'mixed',status:'candidate',previewable:true,candidateSkinIds:['failed-role','passing-role'],applicableSkinIds:['passing-role']},
{key:'runtime-profile:unbound',id:'unbound',skinId:'unbound',type:'runtime-profile',title:'unbound',status:'candidate',previewable:false},
{key:'capability:press',id:'press',type:'capability',title:'press',status:'planned',previewable:false}
];
for(const entry of cases)it('honors preview identity and availability: '+entry.key,async()=>{
let handlers,tree;const nav=[];const find=(n,id)=>n.id===id?n:(n.children||[]).map(c=>find(c,id)).find(Boolean);
await new AsyncFunction('mountUI','validateLayoutNode','motionPreviewTheme','document','fetch','location',code)(
(_r,t,h)=>{handlers=h;tree=t;return {update(t){tree=t}}},()=>[],()=>({}),{getElementById:()=>({})},async p=>({ok:true,json:async()=>p==='/summary.json'?{counts:{}}:p==='/story.json'?{counts:{},requirements:[]}:{total:1,offset:0,limit:50,items:[entry]}}),{assign:p=>nav.push(p)});
const disabled=find(tree,'preview').props.disabled;handlers.preview();if(entry.previewable===false){expect(disabled).toBe(true);expect(nav).toEqual([]);}else{expect(disabled).toBe(false);expect(nav).toEqual(['/interaction/?skin=passing-role']);}
});
