import {it,expect} from 'vitest';
import {allowLocalPreviewHost} from './local-preview-host.mjs';
it('allows only explicit local preview names and the actual listening port',()=>{
 for(const host of ['127.0.0.1:57123','localhost:57123','LOCALHOST:57123'])expect(allowLocalPreviewHost(host,57123)).toBe(true);
 for(const host of [undefined,'','attacker.example:57123','127.0.0.1.evil.test:57123','localhost.evil.test:57123','user@localhost:57123','127.0.0.1:57124','localhost','localhost:0','localhost:65536',' localhost:57123','localhost:57123/'])expect(allowLocalPreviewHost(host,57123)).toBe(false);
 expect(allowLocalPreviewHost('localhost',80)).toBe(true);expect(allowLocalPreviewHost('localhost:57123')).toBe(true);
});
