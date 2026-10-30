import {it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {readLocalPreviewFont} from './local-preview-fonts.mjs';
it('serves only two local cartoon fonts and refuses aliases/escape',()=>{
 const root=mkdtempSync(join(tmpdir(),'preview-fonts-'));try{const dir=join(root,'public/ui-fonts/cjk');mkdirSync(dir,{recursive:true});writeFileSync(join(dir,'cnround.woff2'),'synthetic font');expect(readLocalPreviewFont(root,'/ui-fonts/cjk/cnround.woff2').toString()).toBe('synthetic font');for(const path of ['/etc/passwd','/ui-fonts/../../etc/passwd','/ui-fonts/cjk/other.woff2'])expect(readLocalPreviewFont(root,path)).toBeUndefined();rmSync(join(dir,'cnround.woff2'));writeFileSync(join(root,'outside'),'outside');symlinkSync(join(root,'outside'),join(dir,'cnround.woff2'));expect(()=>readLocalPreviewFont(root,'/ui-fonts/cjk/cnround.woff2')).toThrow(/font rejected/);}finally{rmSync(root,{recursive:true,force:true});}
});

it('rejects a public directory alias even when the requested font name is whitelisted',()=>{const root=mkdtempSync(join(tmpdir(),'preview-public-'));try{const outside=join(root,'outside'),app=join(root,'app');mkdirSync(join(outside,'ui-fonts/cjk'),{recursive:true});mkdirSync(app);writeFileSync(join(outside,'ui-fonts/cjk/cnround.woff2'),'outside source');symlinkSync(outside,join(app,'public'));expect(()=>readLocalPreviewFont(app,'/ui-fonts/cjk/cnround.woff2')).toThrow(/font rejected/);}finally{rmSync(root,{recursive:true,force:true});}});
