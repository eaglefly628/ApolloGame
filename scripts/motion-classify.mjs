#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { sha256,validateCatalog } from './lib/motion-catalog.mjs';
import { DICTIONARY_VERSION,sourceSemantics,summarizeSemantics } from './lib/motion-semantics.mjs';
export async function main(args=process.argv.slice(2),io={out:s=>console.log(s),log:s=>console.error(s)}) {
  try {
    let lib=join(homedir(),'ApolloAssets/motion-lib-full-frames'),json=false,seen=false;
    for(let i=0;i<args.length;i++){
      if(args[i]==='--lib'&&!seen&&args[i+1]&&!args[i+1].startsWith('--')){lib=resolve(args[++i]);seen=true;}
      else if(args[i]==='--json'&&!json)json=true;
      else throw Error('usage: motion-classify.mjs [--lib directory] [--json]');
    }
    const bytes=await readFile(join(lib,'catalog.json')),catalog=validateCatalog(JSON.parse(bytes.toString('utf8')));
    const summary=summarizeSemantics(catalog.clips);
    const result=json?{version:1,dictionaryVersion:DICTIONARY_VERSION,catalogSha256:sha256(bytes),summary,
      clips:catalog.clips.map(row=>({id:row.id,clipSha256:row.sha256,sourceFbxSha256:row.source.fbxSha256,assetStatus:row.status,annotation:sourceSemantics(row)}))}:summary;
    io.log(`[motion-classify] decision ${JSON.stringify({basis:'source description first',total:summary.total,unclassified:summary.unclassified,approvalUnchanged:true,readOnly:true})}`);
    io.out(JSON.stringify(result,null,2));return 0;
  }catch(error){io.log(`[motion-classify] reject ${JSON.stringify({message:error.message})}`);return 1;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main();
