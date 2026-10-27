import type { LayoutNode } from '../../src/ui/components/types.js';
export interface PreviewRow { id: string; descZh?: string; category?: string; emotion?: string[]; tags?: string[]; status: string; derivedFrom?: string | null; source?: { mixamoName?: string }; }
export interface PreviewState { skins: PreviewRow[]; clips: PreviewRow[]; query: string; category: string; emotion: string; page: number; paused: boolean; message: string; skinIds?: [string, string]; }
export function previewClips(state: PreviewState): PreviewRow[] {
  const query = state.query.normalize('NFKC').toLowerCase().trim();
  return state.clips.filter(c => (!state.category || c.category === state.category) && (!state.emotion || c.emotion?.includes(state.emotion)) && (!query || [c.id,c.descZh,...c.tags || []].join(' ').normalize('NFKC').toLowerCase().includes(query))).sort((a,b)=>Number(Boolean(a.derivedFrom))-Number(Boolean(b.derivedFrom))||(a.id<b.id?-1:a.id>b.id?1:0));
}
export function previewSkins(state: PreviewState): PreviewRow[] {
  const ids=state.skinIds || [state.skins[0]?.id || '',state.skins[1]?.id || ''];
  return ids.flatMap(id=>{const skin=state.skins.find(row=>row.id===id);return skin?[skin]:[];});
}
export function buildPreview(state: PreviewState): LayoutNode {
  const matching = previewClips(state), clips = matching.slice(state.page * 3, state.page * 3 + 3);
  const dropdown = (id: string, values: string[], value: string, title: string): LayoutNode => ({id,type:'Dropdown',props:{value,options:[{value:'',label:title},...values.map(value=>({value,label:value}))],action:id},layout:{width:180}});
  const skinIds=state.skinIds || [state.skins[0]?.id || '',state.skins[1]?.id || ''];
  const skinDropdown=(index:0|1):LayoutNode=>({id:index===0?'skin-first':'skin-second',type:'Dropdown',props:{value:skinIds[index],options:[{value:'',label:`第${index+1}行角色`},...state.skins.map(skin=>({value:skin.id,label:`第${index+1}行 · ${skin.source?.mixamoName || skin.id}`}))],action:index===0?'skin-first':'skin-second'},layout:{width:260}});
  const cells = previewSkins(state).flatMap((skin,s) => clips.map((clip,c): LayoutNode => ({id:`cell-${s}-${c}`,type:'Panel',props:{bg:'panel',edge:'gold'},layout:{direction:'column',gap:10,padding:12,minWidth:280},children:[
    {id:`name-${s}-${c}`,type:'Label',props:{text:`${skin.source?.mixamoName || skin.id} × ${clip.source?.mixamoName || clip.id}`,color:'text'}},
    {id:`stage-${s}-${c}`,type:'Panel',props:{bare:true},layout:{height:260}},
    {id:`description-${s}-${c}`,type:'Label',props:{text:clip.descZh || clip.id,color:'text'}},
    {id:`status-${s}-${c}`,type:'Label',props:{text:`${skin.status} / ${clip.status} · 待视觉复核`,color:'text'}},
  ]})));
  return {id:'motion-preview',type:'Screen',props:{bg:'panel'},layout:{direction:'column',gap:16,padding:24},children:[
    {id:'title',type:'Label',props:{text:'动作预览台',font:'epic',size:32,color:'text'}},
    {id:'subtitle',type:'Label',props:{text:'本机动作库 · 引擎原生播放 · Skin × 动作',color:'text'}},
    {id:'filters',type:'Panel',props:{bare:true},layout:{direction:'row',gap:12},children:[
      {id:'query',type:'Input',props:{placeholder:'搜索动作 / 标签',value:state.query,action:'query'},layout:{width:260}},
      dropdown('category',[...new Set(state.clips.map(c=>c.category || '').filter(Boolean))].sort(),state.category,'全部类别'),
      dropdown('emotion',[...new Set(state.clips.flatMap(c=>c.emotion || []))].sort(),state.emotion,'全部情绪'),
      {id:'previous',type:'Button',props:{label:'上一组',kind:'ghost',action:'previous',disabled:state.page===0}},
      {id:'next',type:'Button',props:{label:'下一组',kind:'ghost',action:'next',disabled:(state.page+1)*3>=matching.length}},
      {id:'pause',type:'Panel',layout:{padding:10,fx:[{kind:'sheen-hover'}]},props:{bg:'panel',edge:'gold',action:'pause'},children:[{id:'pause-label',type:'Label',props:{text:state.paused?'继续播放':'暂停播放',color:'text'}}]},
    ]},
    {id:'skin-selectors',type:'Panel',props:{bare:true},layout:{direction:'row',gap:12},children:[skinDropdown(0),skinDropdown(1)]},
    {id:'message',type:'Label',props:{text:`${matching.length} 个匹配动作 · ${state.message || '未确认素材保持 draft'}`,color:'text'}},
    {id:'grid',type:'Panel',props:{bare:true},layout:{direction:'grid',cols:3,gap:16},children:cells},
    ...(!cells.length?[{id:'empty',type:'Label' as const,props:{text:'暂无可播放组合。请先完成 Skin 与动画入库，或调整筛选条件。',color:'text' as const}}]:[]),
  ]};
}
