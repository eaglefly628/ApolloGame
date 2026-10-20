import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const base=join(root,'public/__vendor/three-r184');
const manifest=JSON.parse(readFileSync(join(base,'manifest.json'),'utf8'));
describe('E1 vendored decoder integrity',()=>{
  it('pins decoder files to the installed Three version',()=>{
    const three=JSON.parse(readFileSync(join(root,'node_modules/three/package.json'),'utf8'));
    expect(manifest.threeVersion).toBe(three.version);
    expect(manifest.decoders.map(d=>d.path).sort()).toEqual(['basis/basis_transcoder.js','basis/basis_transcoder.wasm','draco/draco_decoder.js','draco/draco_decoder.wasm','draco/draco_wasm_wrapper.js']);
  });
  it.each(manifest.decoders)('retains exact local decoder bytes: $path',entry=>{
    const bytes=readFileSync(join(base,entry.path));
    expect(bytes.length).toBe(entry.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    expect(bytes).toEqual(readFileSync(join(root,entry.source)));
    if(entry.path.endsWith('.wasm'))expect(bytes.subarray(0,8).toString('hex')).toBe('0061736d01000000');
    expect(entry.license).toBe('Apache-2.0');
  });
  it('distributes the source notices and full decoder licenses',()=>{
    for(const license of ['LICENSE-DRACO.txt','LICENSE-BASIS.txt'])expect(readFileSync(join(base,license),'utf8')).toContain('Version 2.0, January 2004');
    for(const license of ['LICENSE-THREE.txt','LICENSE-MESHOPT.txt'])expect(readFileSync(join(base,license),'utf8')).toContain('Permission is hereby granted');
    const notice=readFileSync(join(base,'NOTICE.txt'),'utf8');
    expect(notice).toContain('Draco');expect(notice).toContain('Basis');expect(notice).toContain('Meshopt');
  });
});
