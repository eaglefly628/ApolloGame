export interface SemanticInput { id:string; frames?:number; descEn?:string; source?:{mixamoName?:string;description?:string}; }
export interface SemanticClaim { facet:string;value:string;label:string;quote:string;start:number;end:number;source:'description'|'title';status:'source-derived'; }
export interface SourceSemantics {version:1;basis:'description'|'title'|'missing';description:string|null;groups:string[];claims:SemanticClaim[];unknownFacets:string[];warnings:string[];status:'draft';}
export const DICTIONARY_VERSION:string;
export const BROWSE_GROUPS:readonly {id:string;label:string}[];
export function sourceDescription(row:SemanticInput):string|null;
export function sourceSemantics(row:SemanticInput):SourceSemantics;
export function summarizeSemantics(rows:SemanticInput[]):{dictionaryVersion:string;total:number;descriptions:number;titleFallback:number;unclassified:number;groupCounts:Record<string,number>};
