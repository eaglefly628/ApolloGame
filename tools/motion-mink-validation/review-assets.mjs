import {copyFileSync,constants,existsSync,lstatSync,readFileSync,realpathSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function copyReviewAsset(source,destination,expectedSha){
 const from=resolve(source),to=resolve(destination);if(realpathSync(dirname(to))!==dirname(to))throw new Error('review directory alias rejected');
 if(sha(readFileSync(from))!==expectedSha)throw new Error('source asset SHA mismatch');
 if(!existsSync(to))copyFileSync(from,to,constants.COPYFILE_EXCL);
 const info=lstatSync(to);if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||realpathSync(from)===realpathSync(to))throw new Error('review asset must be an independent regular copy');
 if(sha(readFileSync(to))!==expectedSha)throw new Error('review asset SHA differs');
}
