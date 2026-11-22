import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RenderEnvironment} from '/Users/junbaili/Documents/GitHub/ApolloGame/handoffs/game628-life-controls-20261117/environment.ts';
const base='/Users/junbaili/Documents/GitHub/ApolloGame/handoffs/game628-life-controls-20261117/';
const config=JSON.parse(readFileSync(base+'public/scenes/art-street.json','utf8'));
const components=structuredClone(config.manifest.entities);
const world={getComponent:(id:string,type:string)=>components[id]?.[type]};
const env=new RenderEnvironment(world as any,config.environment);
for(const action of Object.keys(config.environment.presets)){
 assert.equal(env.select(action,0),true);
 for(const t of [0,450,900,1350,1800]){
  env.update(t);
  for(const p of config.environment.presets[action].patches)for(const field of Object.keys(p.values))assert.ok(Number.isFinite(components[p.entity][p.component][field]));
  assert.ok(components.sun.Light3D.dirY<0);
 }
 for(const p of config.environment.presets[action].patches)for(const [field,value]of Object.entries(p.values))assert.ok(Math.abs(components[p.entity][p.component][field]-(value as number))<1e-10);
}
assert.equal(env.select('host.streets',0),false);
const valid=structuredClone(config.environment);valid.presets[valid.initial].patches[0].values={constructor:1};
let accepted=true;try{new RenderEnvironment(world as any,valid);}catch{accepted=false;}
console.log('prototype-field-probe',JSON.stringify({accepted,constructorValue:String(components.sun.Light3D.constructor)}));
assert.equal(accepted,false,'inherited field must be rejected');
assert.equal(env.select('constructor',0),false);assert.equal(env.select('__proto__',0),false);
// Direct declared-bounds contact check for the second crate and potential supports.
const sources=JSON.parse(readFileSync(base+'art-production-20261118/k-sources.json','utf8'));
const bounds=Object.fromEntries(sources.assets.map((a:any)=>[a.key,a.bounds]));
const e=config.manifest.entities;
function bbox(id:string){const t=e[id].Transform3D,a=bounds[e[id].Model3D.modelKey];return {min:a.min.map((v:number,i:number)=>v*([t.scaleX??t.scale??1,t.scaleY??t.scale??1,t.scaleZ??t.scale??1][i])+[t.x,t.y,t.z][i]),max:a.max.map((v:number,i:number)=>v*([t.scaleX??t.scale??1,t.scaleY??t.scale??1,t.scaleZ??t.scale??1][i])+[t.x,t.y,t.z][i])};}
const low=bbox('grocery-box-0'),high=bbox('grocery-box-1');
console.log('crate-contact',JSON.stringify({low,high,verticalGap:high.min[1]-low.max[1],zGap:high.min[2]-low.max[2]}));
assert.equal(high.min[1],0);assert.ok(high.min[2]>low.max[2]);
console.log('review-probes: PASS');
