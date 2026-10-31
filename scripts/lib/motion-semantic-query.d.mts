import type {SourceEvidence} from './motion-semantics.mjs';
export interface SemanticConstraint {facet:string;value:string;mode?:'required'|'forbidden';}
export interface SemanticQueryRequest {
 expectedCatalogSha256:string;expectedDictionaryVersion:string;expectedRevision:number;expectedHeadSha256:string|null;
 /** Strict (default): every required constraint needs evidence; forbidden unknowns remain unverified, not excluded. */
 constraints:SemanticConstraint[];strict?:boolean;top?:number;
}
export interface EvaluatedSemanticConstraint {
 facet:string;value:string;mode:'required'|'forbidden';vocabularyStatus:'known'|'pending-vocabulary';
 state:'supported'|'conflict'|'unknown';reason:string;
 evidence:{tagId:string;basis:string;evidence:SourceEvidence;status:'draft';flagEventIds:string[];intentOnly?:true}[];
}
export interface SemanticQueryCandidate {
 clipId:string;file:string;clipSha256:string;assetStatus:'draft'|'confirmed';labelStatus:'draft';requiresHumanConfirmation:true;
 sourceWarnings?:string[];
 score:number;constraints:EvaluatedSemanticConstraint[];eligible:boolean;exclusionReason:string|null;
}
export interface SemanticQueryResult {
 schemaVersion:1;status:'draft';catalogSha256:string;dictionaryVersion:string;head:{revision:number;eventSha256:string|null};
 totalMatches:number;candidates:SemanticQueryCandidate[];excluded:SemanticQueryCandidate[];
 missingRequirements:{facet:string;value:string;mode:'required'|'forbidden';vocabularyStatus:'known'|'pending-vocabulary';reason:string}[];
 pendingProposalCount:number;assetVerification:'selected-candidate-SHA-only';integration:'offline-draft-query';
}
export function querySemanticDrafts(options:{lib:string;request:SemanticQueryRequest}):Promise<SemanticQueryResult>;

/** Batched queries share one explicit dictionary version and an internally loaded catalog/revision; selected assets are verified once. */
export function querySemanticDraftBatch(options:{lib:string;requests:SemanticQueryRequest[]}):Promise<SemanticQueryResult[]>;
