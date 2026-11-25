import {mountUI,apolloOnyx,type LayoutNode} from '../../src/ui/components/index.js';
import type {ThreeRenderer} from '../../src/renderer/three-renderer.js';
import type {IWorld} from '../../src/engine/core/types.js';

const mean=(values:number[])=>values.reduce((sum,value)=>sum+value,0)/Math.max(1,values.length);
const rounded=(value:number)=>Math.round(value*100)/100;

export class LabMetrics {
 private records:Record<string,unknown>[]=[];
 private busy=false;
 private status='等待采样。固定机位后选择档位，等待效果稳定，再点采样当前档。';
 private ui:ReturnType<typeof mountUI>;
 constructor(root:HTMLElement){
  this.ui=mountUI(root,this.tree(),{},apolloOnyx);
 }
 private tree():LayoutNode{
  return {type:'Panel',id:'lab-metrics',props:{},layout:{direction:'column',padding:8,gap:4},children:[
   {type:'Label',id:'lab-status',props:{text:this.status,size:12,color:'text'}},
   {type:'Label',id:'lab-records',props:{text:JSON.stringify(this.records),size:11,color:'sub'}},
  ]};
 }
 async sample(renderer:ThreeRenderer,world:IWorld,mode:string){
  if(this.busy)return;
  this.busy=true;
  this.status='正在采样，保持窗口前台和人物静止。帧间隔与 CPU 同步耗时不代表 GPU 帧时。';
  this.ui.update(this.tree());
  const canvas=document.querySelector<HTMLCanvasElement>('#scene-stage canvas')!;
  const context=canvas.getContext('webgl2')!;
  const debug=context.getExtension('WEBGL_debug_renderer_info');
  const gpu=debug?context.getParameter(debug.UNMASKED_RENDERER_WEBGL):context.getParameter(context.RENDERER);
  const intervals:number[]=[],cpu:number[]=[],calls:number[]=[],triangles:number[]=[];
  let longFrames=0;
  const supportsLongFrames=PerformanceObserver.supportedEntryTypes.includes('long-animation-frame');
  const observer=supportsLongFrames?new PerformanceObserver(list=>{longFrames+=list.getEntries().length;}):undefined;
  // Exclude shader warm-up and the 1.4 second environment transition.
  await new Promise(resolve=>setTimeout(resolve,1800));
  observer?.observe({type:'long-animation-frame'});
  let previous=await new Promise<number>(resolve=>requestAnimationFrame(resolve));
  const start=previous;
  while(intervals.length<180&&previous-start<10000){
   const now=await new Promise<number>(resolve=>requestAnimationFrame(resolve));
   if(document.visibilityState!=='visible'){
    observer?.disconnect();this.status='采样已取消，窗口需要保持前台。';this.busy=false;this.ui.update(this.tree());return;
   }
   intervals.push(now-previous);previous=now;
   const stats=renderer.readStats();
   cpu.push(stats.cpuMs);calls.push(stats.drawCalls);triangles.push(stats.triangles);
  }
  observer?.disconnect();
  const sorted=[...intervals].sort((a,b)=>a-b),stats=renderer.readStats();
  let visibleSnow=0;
  for(const [id] of world.query('Visibility')){
   if(id.startsWith('weather-')&&world.getComponent<{type:'Visibility';visible:boolean}>(id,'Visibility')?.visible)visibleSnow++;
  }
  const record={
   mode,samples:intervals.length,rafMeanMs:rounded(mean(intervals)),rafP95Ms:rounded(sorted[Math.ceil(sorted.length*.95)-1]??0),
   rendererCpuSmoothedMeanMs:rounded(mean(cpu)),drawCalls:rounded(mean(calls)),triangles:rounded(mean(triangles)),
   visibleSnow,models:stats.models,batches:stats.batches,instances:stats.instances,
   cssViewport:[innerWidth,innerHeight],canvasCss:[canvas.clientWidth,canvas.clientHeight],canvasBuffer:[canvas.width,canvas.height],
   pixelRatio:devicePixelRatio,gpu:String(gpu),userAgent:navigator.userAgent,
   longAnimationFrames:supportsLongFrames?longFrames:'unsupported',
   camera:structuredClone(world.getComponent('camera','Camera3D')),player:structuredClone(world.getComponent('player','Transform')),
   measurement:'rAF scheduling intervals and renderer CPU synchronization only; GPU duration not measured',
  };
  this.records.push(record);
  this.status='采样完成，记录保存在此页下方。可切换档位再测，也可反切复测。';
  this.busy=false;this.ui.update(this.tree());
  console.info('[lab:measurement]',JSON.stringify(record));
 }
}
