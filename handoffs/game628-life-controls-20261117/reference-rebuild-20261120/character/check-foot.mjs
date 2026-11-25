import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync(new URL('./traveler-foot-samples.json',import.meta.url)));
for(const d of data){
 const speed=d.clip==='walk'?d.nominalSpeed:0;
 for(const side of['Left','Right']){
  const f=d.frames.map(r=>({t:r.t,...r.feet.find(v=>v.side===side)}));
  const windows=[];
  for(let i=0;i<f.length-6;i++){
   const a=f[i],b=f[i+6];if(!f.slice(i,i+7).every(v=>v.toe[1]<.08))continue;
   let drift=Math.hypot(b.toe[0]-a.toe[0],b.toe[2]-a.toe[2]+speed*(b.t-a.t));windows.push({t:a.t,drift});
  }
  console.log(d.clip,side,'support windows',windows.length,'max200ms toe',Math.max(...windows.map(v=>v.drift)),'min',Math.min(...windows.map(v=>v.drift)));
 }
}
