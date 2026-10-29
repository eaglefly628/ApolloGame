export interface SemanticInput { id:string; frames?:number; descEn?:string; source?:{mixamoName?:string;description?:string}; }
export interface SemanticClaim { facet:string;value:string;label:string;quote:string;start:number;end:number;source:'description'|'title';status:'source-derived'; }
export interface SourceSemantics {version:1;basis:'description'|'title'|'missing';description:string|null;groups:string[];claims:SemanticClaim[];unknownFacets:string[];warnings:string[];status:'draft';}
export const DICTIONARY_VERSION:string;
export const BROWSE_GROUPS:readonly {id:string;label:string}[];
export function sourceDescription(row:SemanticInput):string|null;
export function sourceSemantics(row:SemanticInput):SourceSemantics;
export function summarizeSemantics(rows:SemanticInput[]):{dictionaryVersion:string;total:number;descriptions:number;titleFallback:number;unclassified:number;groupCounts:Record<string,number>};

export interface SourceTagDefinition {readonly value:string;readonly defaultLabel:string;readonly defaultGroup:string|null;}
export interface SourceDictionary {readonly schemaVersion:1;readonly dictionaryVersion:string;readonly groups:readonly {readonly id:string;readonly label:string}[];readonly facets:readonly {readonly id:string;readonly values:readonly SourceTagDefinition[]}[];}
export interface SourceEvidence {source:'description'|'title';quote:string;start:number;end:number;}
export function getSourceDictionary():SourceDictionary;
export function getSourceTagDefinition(facet:string,value:string):SourceTagDefinition|null;
export function validateSourceEvidence(row:SemanticInput,evidence:SourceEvidence):SourceEvidence;
