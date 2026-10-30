import {lstatSync,realpathSync,readFileSync} from 'node:fs';
import {join,sep} from 'node:path';
const FONTS=new Set(['/ui-fonts/cjk/cnround.woff2','/ui-fonts/cjk/round.woff2']);
/** Fixed repository-owned font routes; never serve caller-supplied filesystem paths. */
export function readLocalPreviewFont(root,path){
 if(!FONTS.has(path))return undefined;
 const canonicalRoot=realpathSync(root),publicPath=join(canonicalRoot,'public');
 if(!lstatSync(publicPath).isDirectory()||realpathSync(publicPath)!==publicPath)throw new Error('preview font rejected');
 const base=publicPath,file=join(base,path.slice(1));
 const info=lstatSync(file);if(!info.isFile()||info.size>2*1024*1024||!realpathSync(file).startsWith(base+sep))throw new Error('preview font rejected');
 return readFileSync(file);
}
