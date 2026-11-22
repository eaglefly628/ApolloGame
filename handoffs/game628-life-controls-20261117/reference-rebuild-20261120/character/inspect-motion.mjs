import fs from 'node:fs';
const lib='/Users/junbaili/ApolloAssets/motion-lib-full-frames';
for(const id of ['idle-breathing','walking-100460901','waving-106100901']){
 let b=fs.readFileSync(lib+'/clips/'+id+'.glb'),l=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+l)),bin=b.subarray(28+l);
 const a=i=>{let v=j.accessors[i],bv=j.bufferViews[v.bufferView],n={SCALAR:1,VEC3:3,VEC4:4}[v.type];return Array.from(new Float32Array(bin.buffer,bin.byteOffset+(bv.byteOffset??0)+(v.byteOffset??0),v.count*n));};
 const clip=j.animations[0];let tr=clip.channels.find(c=>j.nodes[c.target.node].name==='Hips'&&c.target.path==='translation'),s=clip.samplers[tr.sampler],vals=a(s.output);console.log(id,vals.slice(0,3),vals.slice(-3));
}
