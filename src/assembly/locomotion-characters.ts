import {validateDriverTree} from '@engine/protocol/components/animation-driver.js';
import {compileLocomotionDriver3D} from '@engine/animation/locomotion-driver.js';
import {validateLocomotionCharacter3D,characterModelSelection,normalizeModelSelection,canonicalCharacterData} from '@engine/animation/locomotion-character.js';
/** Structural declaration checks only; actual GLB/rest/profile SHA is a renderer
 * readiness gate. No status field is offline approval or contact quality evidence. */
export function validateLocomotionCharacters(entities:Record<string,unknown>):void {
 if(!entities||typeof entities!=='object'||Array.isArray(entities))throw Error('LocomotionCharacter3D: entities required');
 const descriptors=Object.getOwnPropertyDescriptors(entities),involved=Object.entries(descriptors).filter(([,d])=>'value'in d&&d.value&&typeof d.value==='object'&&Object.hasOwn(d.value,'LocomotionCharacter3D'));
 if(!involved.length)return;validateDriverTree(entities);
 for(const[id,d]of involved){const row=d.value as Record<string,unknown>;try{
  const normalize=(value:unknown,type:string)=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error(type+' required');const v=value as Record<string,unknown>;if(Object.hasOwn(v,'type')&&v.type!==type)throw Error('conflicting type');return{...v,type};};
  const binding=validateLocomotionCharacter3D(normalize(row.LocomotionCharacter3D,'LocomotionCharacter3D'));
  const config=compileLocomotionDriver3D(normalize(row.LocomotionDriver3D,'LocomotionDriver3D')).configuration;
  const model=normalizeModelSelection(characterModelSelection(normalize(row.Model3D,'Model3D')));
  if(canonicalCharacterData(model)!==canonicalCharacterData(binding.target.selector))throw Error('Model selector/scale mismatch');
  const assets=[...new Set(Object.values(config.clips).map(c=>c.asset))].sort();
  if(assets.length!==binding.retarget.sources.length||assets.some((a,i)=>a!==binding.retarget.sources[i].asset))throw Error('source assets mismatch');
  for(const spec of Object.values(config.clips))if(binding.retarget.sources.find(s=>s.asset===spec.asset)?.sourceSha256!==spec.sourceSha256)throw Error('source SHA mismatch');
 }catch(error){throw Error(`LocomotionCharacter3D: ${id}: ${error instanceof Error?error.message:String(error)}`);}}
}
