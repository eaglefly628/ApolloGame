import type {LayoutNode} from '../../src/ui/components/types.js';
import {validateLayoutNode} from '../../src/ui/components/validate.js';
export interface DriverActorRow {id:string;base:string;native?:string;slots:string;weights:string;cues:string;root:string;rejections:string}
export interface DriverLayoutState {profiles:readonly {id:string;label:string;description:string}[];selectedId:string;description:string;loading:boolean;playing:boolean;frame:number;durationFrames:number;tickRate:number;seekValue:string;message:string;diagnostics:readonly string[];actors:readonly DriverActorRow[];models:number;nativeSummary?:string}
const label=(id:string,text:string,color:'text'|'sub'|'danger'|'gold'='text'):LayoutNode=>({id,type:'Label',props:{text,size:15,color}});
const button=(id:string,text:string,action:string,disabled=false,hero=false):LayoutNode=>({id,type:'Button',props:{label:text,action,disabled,kind:hero?'hero':'primary'}});
export function driverLayout(s:DriverLayoutState):LayoutNode {
 const tree:LayoutNode={id:'driver-screen',type:'Screen',props:{},layout:{direction:'column'},children:[
  {id:'driver-title',type:'Label',props:{text:'影视动画 · 导演台',font:'cnround',size:36,bold:true,color:'gold'}},
  label('driver-subtitle','同一场景时钟 · 切换角色重新装载 · 数值候选，尚未视觉验收','gold'),
  {id:'driver-controls-card',type:'Panel',props:{bg:'raised',edge:'gold',shadow:{y:5,color:'ink'}},layout:{direction:'column',gap:12,padding:18},children:[
   {id:'driver-profile',type:'Dropdown',props:{value:s.selectedId,options:s.profiles.map(p=>({value:p.id,label:p.label})),action:'profile'}},
   label('driver-description',s.description||'选择本机角色场景'),
   {id:'driver-controls',type:'Panel',props:{bare:true},layout:{direction:'grid',minCol:190,gap:12},children:[button('driver-play','全场景播放','play',s.loading||!s.selectedId||s.playing,true),button('driver-pause','全场景暂停','pause',s.loading||!s.selectedId),button('driver-step','单帧前进','step',s.loading||!s.selectedId),button('driver-reset','回到起点','reset',s.loading||!s.selectedId),button('driver-profiles-json','查看场景模板','profiles-json'),button('driver-home','返回工作台','home')]},
   label('driver-native-status',s.nativeSummary||'动作未就绪：等待原生绑定状态','sub'),
   label('driver-time',s.loading?'正在装载角色与动作…':`第 ${Math.max(0,s.frame)} / ${s.durationFrames} 帧 · ${s.tickRate}Hz · ${s.playing?'全场景播放中':'全场景已暂停'} · 已装载模型 ${s.models}`),
   {id:'driver-seek-row',type:'Panel',props:{bare:true},layout:{direction:'grid',minCol:170,gap:12},children:[{id:'driver-frame-input',type:'Input',props:{type:'number',value:s.seekValue,placeholder:'输入目标帧',action:'frame-input'}},button('driver-seek','定位到这一帧','seek',s.loading||!s.selectedId)]},
   {id:'driver-frame-slider',type:'Slider',props:{min:0,max:Math.max(1,s.durationFrames),step:1,value:Math.max(0,s.frame),label:'场景帧',action:'scrub'}},
   label('driver-error',s.message,s.message?'danger':'sub'),
  ]},
  {id:'driver-stage-card',type:'Panel',props:{bg:'ink',edge:'gold',shadow:{y:6,color:'ink'}},layout:{direction:'column',gap:10,padding:12},children:[{id:'driver-stage',type:'Panel',props:{bare:true},layout:{height:480}},label('driver-stage-caption','暂停与定位均读取已提交姿态；不推进音效或外部服务。','gold')]},
  {id:'driver-observer',type:'Panel',props:{bg:'raised',edge:'gold',scroll:true},layout:{direction:'column',gap:12,padding:18},children:[
   {id:'driver-observer-title',type:'Label',props:{text:'场景状态 · 只读观察',font:'cnround',size:25,bold:true,color:'text'}},
   {id:'driver-observer-table',type:'Table',props:{columns:[{key:'id',label:'角色',width:100},{key:'base',label:'基础动作',width:120},{key:'native',label:'原生状态',width:250},{key:'slots',label:'表演槽',width:170},{key:'weights',label:'混合权重',width:150},{key:'cues',label:'本帧提示',width:160},{key:'root',label:'位移请求 → 接受',width:230},{key:'rejections',label:'拒收 / 阻挡'}],rows:s.actors.map(row=>({id:row.id,cells:{...row,native:row.native||'动作未就绪'}}))}},
   {id:'driver-debug-details',type:'Accordion',props:{title:'装载与拒收详情'},children:s.diagnostics.slice(-6).map((text,i)=>label('driver-diagnostic-'+i,text,/不兼容|Rejected|error/i.test(text)?'danger':'sub'))},
  ]},
 ]};tree.children=[{id:'driver-content',type:'Panel',props:{bare:true},layout:{direction:'column',padding:20,gap:18,minWidth:0},children:tree.children}];const issues=validateLayoutNode(tree);if(issues.length)throw Error('driver layout: '+JSON.stringify(issues));return tree;
}
