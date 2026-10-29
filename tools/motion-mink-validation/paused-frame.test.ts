import{describe,it,expect,vi}from'vitest';
import{primeEmbeddedPreview}from'./paused-frame.js';
describe('one-parse embedded paused model preparation',()=>{
 it('keeps painting until the complete model/embedded animation parse arrives',async()=>{let frames=0;const render=vi.fn();await expect(primeEmbeddedPreview({render,modelCount:()=>frames>=12?1:0,nextFrame:async()=>{frames++;},cancelled:()=>false})).resolves.toBe(true);expect(render).toHaveBeenCalledTimes(13);});
 it('cancels an obsolete selection before another render',async()=>{let stale=false;const render=vi.fn();await expect(primeEmbeddedPreview({render,modelCount:()=>0,nextFrame:async()=>{stale=true;},cancelled:()=>stale})).resolves.toBe(false);expect(render).toHaveBeenCalledOnce();});
 it('keeps errors and missing-model timeout explicit',async()=>{await expect(primeEmbeddedPreview({render:()=>{throw new Error('synthetic render failure');},modelCount:()=>0,nextFrame:async()=>{},cancelled:()=>false})).rejects.toThrow('synthetic render failure');await expect(primeEmbeddedPreview({render:vi.fn(),modelCount:()=>0,nextFrame:async()=>{},cancelled:()=>false,maxFrames:3})).rejects.toThrow('未能完成准备');});
});
