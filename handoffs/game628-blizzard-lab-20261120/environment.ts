import type {IWorld,Component} from '../../src/engine/core/types.js';
type Patch={entity:string;component:string;values:Record<string,number|boolean>};
export type EnvironmentSpec={initial:string;durationMs:number;presets:Record<string,{label:string;patches:Patch[]}>};
const fields:Record<string,Record<string,'scalar'|'color'|'boolean'>>={
 Light3D:{intensity:'scalar',color:'color',dirX:'scalar',dirY:'scalar',dirZ:'scalar'},
 Sky3D:{top:'color',bottom:'color',cloudTint:'color',clouds:'scalar',scroll:'scalar',env:'scalar'},
 Model3D:{tint:'color'},
 Material3D:{emissive:'color',emissiveIntensity:'scalar',opacity:'scalar',roughness:'scalar',color:'color'},
 Fog3D:{color:'color',near:'scalar',far:'scalar'},
 Visibility:{visible:'boolean'},
};
const mixColor=(a:number,b:number,t:number)=>[16,8,0].reduce((out,shift)=>out|(Math.round(((a>>shift)&255)*(1-t)+((b>>shift)&255)*t)<<shift),0);
/** Closed render-only environment recipe; never changes simulation entities or asset materials. */
export class RenderEnvironment{
 private tween?:{start:number;end:number;action:string;values:{target:Record<string,unknown>;field:string;from:number;to:number;kind:'scalar'|'color'}[]};
 constructor(private readonly world:IWorld,private readonly spec:EnvironmentSpec){
  if(!Object.hasOwn(spec.presets,spec.initial)||!Number.isFinite(spec.durationMs)||spec.durationMs<0)throw Error('Invalid environment initial preset/duration');
  for(const preset of Object.values(spec.presets))for(const patch of preset.patches){
   if(!Object.hasOwn(fields,patch.component)||!world.getComponent(patch.entity,patch.component))throw Error('Invalid environment target: '+patch.entity+'/'+patch.component);
   if(patch.component==='Visibility'&&!patch.entity.startsWith('weather-'))throw Error('Visibility recipe requires a weather presentation entity');
   for(const [field,value] of Object.entries(patch.values)){
    const kind=fields[patch.component][field];
    if(!Object.hasOwn(fields[patch.component],field)||(kind==='boolean'?typeof value!=='boolean':typeof value!=='number'||!Number.isFinite(value)))throw Error('Invalid environment field: '+field);
   }
  }
  this.select(spec.initial,0,0);this.update(0);
 }
 select(action:string,now:number,duration=this.spec.durationMs):boolean{
  if(!Object.hasOwn(this.spec.presets,action))return false;const preset=this.spec.presets[action];
  const values=[];
  for(const patch of preset.patches){const target=this.world.getComponent<Component>(patch.entity,patch.component)! as unknown as Record<string,unknown>;
   for(const [field,to] of Object.entries(patch.values)){
    const kind=fields[patch.component][field];
    if(kind==='boolean'){target[field]=to;continue;}
    const from=Number(target[field]??0);values.push({target,field,from,to:to as number,kind});
   }
  }
  this.tween={start:now,end:now+duration,action,values};console.info('[environment:transition]',action);return true;
 }
 update(now:number){
  const tween=this.tween;if(!tween)return;
  const raw=tween.end===tween.start?1:Math.max(0,Math.min(1,(now-tween.start)/(tween.end-tween.start))),t=raw*raw*(3-2*raw);
  for(const value of tween.values)value.target[value.field]=value.kind==='color'?mixColor(value.from,value.to,t):value.from+(value.to-value.from)*t;
  if(raw===1){console.info('[environment:commit]',tween.action);this.tween=undefined;}
 }
}
