import type { LayoutNode } from '../../src/ui/components/types.js';
import { BROWSE_GROUPS, sourceSemantics } from '../../scripts/lib/motion-semantics.mjs';
export interface PreviewRow {
  id: string; descZh?: string; descEn?: string; category?: string; emotion?: string[]; tags?: string[];
  status: string; derivedFrom?: string | null; frames?: number; durationS?: number;
  source?: { mixamoName?: string; description?: string };
}
export interface PreviewState {
  skins: PreviewRow[]; clips: PreviewRow[]; query: string; category: string; emotion: string; page: number;
  paused: boolean; message: string; skinIds?: [string, string]; selectedId?: string; viewportWidth?: number;
}
const annotations = new WeakMap<PreviewRow, ReturnType<typeof sourceSemantics>>();
export function previewSemantics(row: PreviewRow): ReturnType<typeof sourceSemantics> {
  let value = annotations.get(row);
  if (!value) { value = sourceSemantics(row); annotations.set(row, value); }
  return value;
}
export function orderedClips(rows: PreviewRow[]): PreviewRow[] {
  return [...rows].sort((a,b)=>Number(Boolean(a.derivedFrom))-Number(Boolean(b.derivedFrom))||(a.id<b.id?-1:a.id>b.id?1:0));
}
export function previewClips(state: PreviewState): PreviewRow[] {
  const query = state.query.normalize('NFKC').toLowerCase().trim();
  return orderedClips(state.clips.filter(clip => {
    const semantic = previewSemantics(clip);
    const searchable = [clip.id, clip.source?.mixamoName, semantic.description, clip.descZh,
      ...(clip.tags || []), ...semantic.claims.flatMap(claim=>[claim.value,claim.label])].join(' ').normalize('NFKC').toLowerCase();
    return (!state.category || semantic.groups.includes(state.category)) && (!query || searchable.includes(query));
  }));
}
export function selectedPreviewClip(state: PreviewState): PreviewRow | undefined {
  const matching = previewClips(state);
  return matching.find(row=>row.id===state.selectedId) || matching[0];
}
export function previewSkins(state: PreviewState): PreviewRow[] {
  const ids=state.skinIds || [state.skins[0]?.id || '',state.skins[1]?.id || ''];
  return ids.flatMap(id=>{const skin=state.skins.find(row=>row.id===id);return skin?[skin]:[];});
}
const facetLabels:Record<string,string>={action:'动作',activity:'活动',role:'施受角色',posture:'姿态',bodyPart:'身体部位',direction:'移动/转向方向',gazeDirection:'视线方向',propMention:'道具',emotion:'情绪',style:'风格',poseContext:'姿势语境',contact:'接触',startPosture:'起始姿态',endPosture:'结束姿态',phases:'动作阶段'};
const label=(id:string,text:string):LayoutNode=>({id,type:'Label',props:{text,color:'text'}});
export function buildPreview(state: PreviewState): LayoutNode {
  const matching = previewClips(state), selected = selectedPreviewClip(state), wide = (state.viewportWidth || 1280)>=1100;
  const ordered = orderedClips(state.clips), ordinal = new Map(ordered.map((clip,index)=>[clip.id,index+1]));
  const skinIds=state.skinIds || [state.skins[0]?.id || '',state.skins[1]?.id || ''];
  const groupCounts=new Map(BROWSE_GROUPS.map(group=>[group.id,state.clips.filter(clip=>previewSemantics(clip).groups.includes(group.id)).length]));
  const skinDropdown=(index:0|1):LayoutNode=>({id:index===0?'skin-first':'skin-second',type:'Dropdown',props:{value:skinIds[index],options:[{value:'',label:`角色 ${index+1}：不显示`},...state.skins.map(skin=>({value:skin.id,label:`角色 ${index+1} · ${skin.source?.mixamoName || skin.id}`}))],action:index===0?'skin-first':'skin-second'}});
  const selectionIndex = selected ? matching.findIndex(row=>row.id===selected.id) : -1;
  const detail:LayoutNode = {id:'detail',type:'Panel',props:{bare:true},layout:{direction:'column',gap:14,...(wide?{flex:1}:{})},children:selected?[
    label('selected-name',`#${ordinal.get(selected.id)} · ${selected.source?.mixamoName || selected.id}`),
    label('selected-id',`动作 ID：${selected.id}`),
    {id:'skin-selectors',type:'Panel',props:{bare:true},layout:{direction:'grid',minCol:230,gap:12},children:[skinDropdown(0),skinDropdown(1)]},
    {id:'grid',type:'Panel',props:{bare:true},layout:{direction:'grid',minCol:250,gap:14},children:previewSkins(state).map((skin,s):LayoutNode=>({
      id:`cell-${s}-0`,type:'Panel',props:{bg:'panel',edge:'gold'},layout:{direction:'column',gap:10,padding:12},children:[
        label(`name-${s}-0`,skin.source?.mixamoName || skin.id),
        {id:`stage-${s}-0`,type:'Panel',props:{bare:true},layout:{height:300}},
        label(`status-${s}-0`,`角色 ${skin.status} · 动作 ${selected.status} · 待视觉复核`),
      ],
    }))},
    label('description',`来源 Description：${previewSemantics(selected).description || '未记录明确来源说明'}`),
    label('annotation-status',`${previewSemantics(selected).basis==='description'?'依据来源说明':'来源说明缺失，仅依据标题'} · 标签草稿，尚未人工确认；不代表逐动作视觉验收通过。`),
    {id:'evidence',type:'Panel',props:{bg:'panel',edge:'gold'},layout:{direction:'column',gap:10,padding:14},children:previewSemantics(selected).claims.length?previewSemantics(selected).claims.map((claim,index)=>label(`claim-${index}`,`${claim.label}${claim.intentOnly?'（仅意图，执行待核对）':''} · ${claim.source==='description'?'说明':'标题'}原文：${claim.quote}`)):[label('evidence-empty','没有足够文字依据，保持待分类。')]},
    label('unknown',`未明确的信息：${previewSemantics(selected).unknownFacets.map(facet=>facetLabels[facet] || facet).join('、') || '暂无'}。未说明的情绪不会填为中性。`),
  ]:[label('empty','没有匹配动作，请清除搜索或调整行为分组。')]};
  const directory:LayoutNode={id:'directory',type:'Panel',props:{bare:true},layout:{direction:'column',gap:10,...(wide?{width:480}:{})},children:[
    label('directory-title','全部动作目录 · 滚动浏览并点击任一动作'),
    label('group-note','行为分组为多标签投影，分组数量可能重叠。'),
    {id:'clip-list',type:'VirtualList',props:{height:wide?620:280,rowHeight:38,columns:[{key:'number',label:'序号',width:48},{key:'name',label:'动作'},{key:'description',label:'来源说明'}],rows:matching.map(clip=>({id:clip.id,cells:{number:String(ordinal.get(clip.id)),name:clip.source?.mixamoName || clip.id,description:previewSemantics(clip).description || '待补来源说明'}})),action:'select-clip'}},
  ]};
  return {id:'motion-preview',type:'Screen',props:{bg:'panel'},layout:{direction:'column',gap:14,padding:20,maxWidth:1600},children:[
    {id:'title',type:'Label',props:{text:'动作库 · 预览与标签核对',font:'epic',size:30,color:'text'}},
    label('subtitle','本机完整帧动作库 · 来源 Description 分类 · 引擎原生播放'),
    {id:'filters',type:'Panel',props:{bare:true},layout:{direction:'grid',minCol:175,gap:10},children:[
      {id:'query',type:'Input',props:{placeholder:'搜索名称 / Description / 标签 / ID',value:state.query,action:'query'}},
      {id:'category',type:'Dropdown',props:{value:state.category,options:[{value:'',label:`全部行为 · ${state.clips.length}`},...BROWSE_GROUPS.map(group=>({value:group.id,label:`${group.label} · ${groupCounts.get(group.id) || 0}`}))],action:'category'}},
      {id:'previous',type:'Button',props:{label:'上一个动作',kind:'primary',action:'previous',disabled:selectionIndex<=0}},
      {id:'next',type:'Button',props:{label:'下一个动作',kind:'primary',action:'next',disabled:selectionIndex<0 || selectionIndex>=matching.length-1}},
      {id:'pause',type:'Button',props:{label:state.paused?'继续播放':'暂停播放',action:'pause',kind:'primary'}},
    ]},
    label('message',`全库 ${state.clips.length} 个动作 · ${matching.length} 个匹配动作 · ${state.skins.length} 个角色${state.message?' · '+state.message:''}`),
    {id:'workspace',type:'Panel',props:{bare:true},layout:{direction:wide?'row':'column',gap:20,align:'stretch'},children:[directory,detail]},
  ]};
}
