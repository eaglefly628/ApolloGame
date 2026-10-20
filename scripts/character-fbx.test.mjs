import { describe, expect, it } from 'vitest';
import { validateMotionFbx } from './lib/character-fbx.mjs';
import { makeMockMotionFbx } from './fixtures/character-pipeline/mock-fbx.mjs';

// Independent offset walker for mutating only the synthetic test encoder's valid
// records. The validator under test is never used to locate the mutation target.
function records(bytes) {
 const wide=bytes.readUInt32LE(23)>=7500,width=wide?25:13,out=[];
 function visit(start) {
  const end=wide?Number(bytes.readBigUInt64LE(start)):bytes.readUInt32LE(start);if(!end)return start+width;
  const count=wide?Number(bytes.readBigUInt64LE(start+8)):bytes.readUInt32LE(start+4),length=wide?Number(bytes.readBigUInt64LE(start+16)):bytes.readUInt32LE(start+8),size=bytes[start+width-1],name=bytes.toString('ascii',start+width,start+width+size),propStart=start+width+size;
  const item={start,end,count,length,name,propStart,width,wide};out.push(item);
  let cursor=propStart+length;while(cursor<end-width)cursor=visit(cursor);return end;
 }
 let cursor=27;while(cursor<bytes.length){if((wide?bytes.readBigUInt64LE(cursor):BigInt(bytes.readUInt32LE(cursor)))===0n)break;cursor=visit(cursor);}return out;
}
const find=(bytes,name)=>records(bytes).find(n=>n.name===name);
function field(bytes,record,index,value) {const offset=record.start+index*(record.wide?8:4);if(record.wide)bytes.writeBigUInt64LE(BigInt(value),offset);else bytes.writeUInt32LE(value,offset);}
function offsets(bytes,record) {
 let cursor=record.propStart;const result=[];
 for(let i=0;i<record.count;i++){result.push(cursor);const type=String.fromCharCode(bytes[cursor++]);if(type==='S'||type==='R'){const size=bytes.readUInt32LE(cursor);cursor+=4+size;}else if(type==='L'||type==='D')cursor+=8;else if(type==='I'||type==='F')cursor+=4;else if(type==='Y')cursor+=2;else if('bcifdl'.includes(type)){const length=bytes.readUInt32LE(cursor+8);cursor+=12+length;}else cursor++;}return result;
}
const mutate=(change,options={})=>{const bytes=makeMockMotionFbx(options);change(bytes);return bytes;};
function chain(depth) {
 const width=13;
 function encode(level,start) {const name=Buffer.from('Node'),children=level?encode(level-1,start+width+name.length):Buffer.alloc(0),end=start+width+name.length+children.length+(level?width:0),header=Buffer.alloc(width);header.writeUInt32LE(end);header[12]=name.length;return Buffer.concat([header,name,children,...(level?[Buffer.alloc(width)]:[])]);}
 const bytes=makeMockMotionFbx(),header=bytes.subarray(0,27);return Buffer.concat([header,encode(depth,27),Buffer.alloc(width)]);
}

describe('T5 bounded binary FBX motion structure',()=>{
 it.each([7100,7200,7300,7400,7500,7600,7700])('parses version %i with its 13/25-byte absolute records',version=>{
  const bytes=makeMockMotionFbx({version}),before=Buffer.from(bytes),info=validateMotionFbx(bytes);
  expect(info).toEqual({format:'binary-fbx',version,objects:5,connections:5,stacks:1,layers:1,curveNodes:1,curves:1,samples:2,durationSeconds:1,structureOnly:true});expect(bytes).toEqual(before);
 });
 it.each([7400,7500,7700])('supports bounded zlib arrays in version %i',version=>{expect(validateMotionFbx(makeMockMotionFbx({version,compressed:true})).samples).toBe(2);});
 it('accepts a sliced Uint8Array and standalone ArrayBuffer',()=>{const fixture=makeMockMotionFbx(),surrounded=Buffer.concat([Buffer.from('prefix'),fixture,Buffer.from('suffix')]),slice=surrounded.subarray(6,6+fixture.length);expect(validateMotionFbx(new Uint8Array(slice.buffer,slice.byteOffset,slice.length)).curves).toBe(1);expect(validateMotionFbx(Uint8Array.from(fixture).buffer).curves).toBe(1);});
 it.each([
  ['nonbyte value',()=>({})],
  ['plain text source',()=>Buffer.from('This is a manually supplied FBX source, trust the sidecar')],
  ['ASCII FBX',()=>Buffer.from('; FBX 7.4.0 project file\nObjects: {}\n'.repeat(2))],
  ['partial signature',()=>Buffer.from('Kaydara FBX Binary  ')],
  ['header plus null record',()=>makeMockMotionFbx().subarray(0,27)],
  ['zero-filled fake body',()=>Buffer.concat([makeMockMotionFbx().subarray(0,27),Buffer.alloc(13)])],
  ['unsupported version',()=>mutate(b=>b.writeUInt32LE(7800,23))],
  ['nonstandard version',()=>mutate(b=>b.writeUInt32LE(7450,23))],
 ])('rejects %s rather than treating a header as animation',(_label,make)=>{expect(()=>validateMotionFbx(make())).toThrow(/Motion FBX/);});
 it('requires a root terminator after valid animation records',()=>{const bytes=makeMockMotionFbx();expect(()=>validateMotionFbx(bytes.subarray(0,bytes.length-13))).toThrow(/root null terminator/);});
 it('gives an actionable binary-export message for ASCII input',()=>{expect(()=>validateMotionFbx(Buffer.from('; FBX 7.4.0 project file\nObjects: {}\n'))).toThrow(/export binary FBX.*ASCII/);});
 it.each([7400,7500])('rejects truncated records, offsets and list counts for version %i',version=>{
  const cases=[
   b=>b.subarray(0,b.length-1),
   b=>b.subarray(0,30),
   b=>{field(b,find(b,'Objects'),0,b.length+1);return b;},
   b=>{const item=find(b,'AnimationCurve');field(b,item,0,item.start);return b;},
   b=>{const item=find(b,'AnimationCurve'),parent=find(b,'Objects');field(b,item,0,parent.end);return b;},
   b=>{field(b,find(b,'Objects'),1,1);return b;},
   b=>{const item=find(b,'AnimationCurve');field(b,item,2,item.length+1);return b;},
   b=>{const item=find(b,'AnimationCurve');field(b,item,1,item.count-1);return b;},
   b=>{const item=find(b,'Objects');b[item.end-1]=1;return b;},
   b=>{b[b.length-1]=1;return b;},
   b=>{const item=find(b,'KeyTime');b[item.start+item.width-1]=0;return b;},
  ];
  for(const change of cases){const bytes=makeMockMotionFbx({version});expect(()=>validateMotionFbx(change(bytes))).toThrow(/Motion FBX/);}
 });
 it('rejects unsafe 64-bit record fields before coercing them to Number',()=>{const bytes=makeMockMotionFbx({version:7500});bytes.writeBigUInt64LE(2n**63n,27);expect(()=>validateMotionFbx(bytes)).toThrow(/safe\/bounded/);});
 it.each([
  ['raw array count differs from byte length',b=>{const item=find(b,'KeyTime');b.writeUInt32LE(3,item.propStart+1);} ,{}],
  ['array length beyond property scope',b=>{const item=find(b,'KeyTime');b.writeUInt32LE(0xffffffff,item.propStart+9);},{}],
  ['array count budget',b=>{const item=find(b,'KeyTime');b.writeUInt32LE(2000001,item.propStart+1);},{}],
  ['unknown array encoding',b=>{const item=find(b,'KeyTime');b.writeUInt32LE(2,item.propStart+5);},{}],
  ['corrupt zlib payload',b=>{const item=find(b,'KeyTime');b[item.propStart+13]^=255;},{compressed:true}],
  ['inflated length exceeds declared count',b=>{const item=find(b,'KeyTime');b.writeUInt32LE(1,item.propStart+1);},{compressed:true}],
  ['nonfinite scalar',b=>{const item=find(b,'Model'),start=offsets(b,item)[0];b[start]='D'.charCodeAt(0);b.writeDoubleLE(Infinity,start+1);},{}],
 ])('rejects %s',(_label,change,options)=>{expect(()=>validateMotionFbx(mutate(change,options))).toThrow(/Motion FBX/);});
 it.each([
  ['NaN sample',{values:[0,NaN]},/non-finite/],
  ['infinite sample',{values:[0,Infinity]},/non-finite/],
  ['mismatched samples',{values:[0]},/equal counts/],
  ['single-key header-like curve',{times:[0n],values:[0]},/at least two samples/],
  ['duplicate key time',{times:[0n,0n]},/strictly increasing/],
  ['decreasing key time',{times:[1n,0n]},/strictly increasing/],
  ['wrong key reference total',{referenceCounts:[1]},/RefCount sum/],
  ['negative key reference count',{referenceCounts:[-2]},/positive/],
  ['key reference group mismatch',{referenceCounts:[1,1]},/array counts/],
 ])('rejects %s',(_label,options,pattern)=>{expect(()=>validateMotionFbx(makeMockMotionFbx(options))).toThrow(pattern);});
 it('does not round distinct int64 times before checking monotonicity',()=>{const start=2n**60n;expect(validateMotionFbx(makeMockMotionFbx({times:[start,start+1n]})).durationSeconds).toBe(1/46186158000);});
 it('requires animation records and a nonempty connection graph',()=>{expect(()=>validateMotionFbx(makeMockMotionFbx({withAnimation:false}))).toThrow(/lacks AnimationStack/);const bytes=mutate(b=>{const item=find(b,'Connections');b.write('NoRelations',item.start+item.width,'ascii');});expect(()=>validateMotionFbx(bytes)).toThrow(/Connections/);});
 it.each([
  ['duplicate object ID',b=>{b.writeBigInt64LE(1n,find(b,'AnimationCurve').propStart+1);},/positive and unique/],
  ['missing referenced object',b=>{const c=records(b).filter(r=>r.name==='C').at(-1);b.writeBigInt64LE(999n,offsets(b,c)[1]+1);},/missing\/self/],
  ['self reference',b=>{const c=records(b).filter(r=>r.name==='C').at(-1);b.writeBigInt64LE(5n,offsets(b,c)[2]+1);},/missing\/self/],
  ['duplicate connection',b=>{const c=records(b).filter(r=>r.name==='C')[1],p=offsets(b,c);b.writeBigInt64LE(1n,p[1]+1);b.writeBigInt64LE(0n,p[2]+1);},/duplicate connection/],
  ['curve to unknown axis',b=>{const c=records(b).filter(r=>r.name==='C').at(-1);b.write('d|W',offsets(b,c)[3]+5,'ascii');},/XYZ property/],
  ['curve node to unsupported property',b=>{const c=records(b).filter(r=>r.name==='C').at(-2);b.write('Lcl Translatiox',offsets(b,c)[3]+5,'ascii');},/Model transform/],
  ['model into animation hierarchy',b=>{const c=records(b).filter(r=>r.name==='C')[0];b.writeBigInt64LE(2n,offsets(b,c)[2]+1);},/non-animation link/],
 ])('rejects %s',(_label,change,pattern)=>{expect(()=>validateMotionFbx(mutate(change))).toThrow(pattern);});
 it('enforces hierarchy/property budgets before allocating declared data',()=>{expect(()=>validateMotionFbx(chain(65))).toThrow(/depth budget/);expect(()=>validateMotionFbx(mutate(b=>{field(b,find(b,'Objects'),1,500001);}))).toThrow(/count budget/);});
 it('rejects a disconnected placeholder bone and a cyclic Model parent graph',()=>{
  expect(()=>validateMotionFbx(makeMockMotionFbx({detachedLimb:true}))).toThrow(/affect a LimbNode/);
  const bytes=mutate(b=>{const cs=records(b).filter(r=>r.name==='C');b.writeBigInt64LE(6n,offsets(b,cs[0])[2]+1);b.writeBigInt64LE(1n,offsets(b,cs[1])[2]+1);},{detachedLimb:true});expect(()=>validateMotionFbx(bytes)).toThrow(/hierarchy cycle/);
 });
 it('limits ignored exporter footer bytes explicitly',()=>{const bytes=makeMockMotionFbx();expect(validateMotionFbx(Buffer.concat([bytes,Buffer.alloc(512)])).curves).toBe(1);expect(()=>validateMotionFbx(Buffer.concat([bytes,Buffer.alloc(513)]))).toThrow(/footer/);});
});
