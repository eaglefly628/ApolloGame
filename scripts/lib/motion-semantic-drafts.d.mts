import type {SourceSemantics,SourceEvidence} from './motion-semantics.mjs';
export interface DraftIdentity {clipId:string;clipSha256:string;sourceFbxSha256:string;baseSnapshotSha256:string}
export interface SemanticDraftTag {tagId:string;facet:string;value:string;label:string|null;evidence:SourceEvidence;basis:'source-text'|'base-source-reference'|'proposal';vocabularyStatus:'known'|'pending-vocabulary';status:'draft';flagEventIds:string[];eventId?:string;intentOnly?:true}
export interface SemanticDraftClip extends DraftIdentity {assetStatus:'draft'|'confirmed';sourceScope:'clip-source'|'base-reference';source:SourceSemantics;tags:SemanticDraftTag[];pendingProposals:SemanticDraftTag[]}
export interface DraftHead {revision:number;eventSha256:string|null}
export interface DraftRequestBase extends DraftIdentity {eventId:string;expectedRevision:number;catalogSha256:string;dictionaryVersion:string;reason:string;actor:{kind:'ai'|'human'|'tool';id:string}}
export type SemanticDraftRequest=(DraftRequestBase&{operation:'propose';tag:{facet:string;value:string;evidence:SourceEvidence}})|(DraftRequestBase&{operation:'flag';targetTagId:string});
export interface SemanticDraftEvent {schemaVersion:1;revision:number;prevEventSha256:string|null;requestSha256:string;request:SemanticDraftRequest;eventSha256:string}
export interface SemanticDraftSnapshot {schemaVersion:1;status:'draft';catalogSha256:string;dictionaryVersion:string;head:DraftHead;clips:SemanticDraftClip[];events:SemanticDraftEvent[]}
export const SEMANTIC_DRAFT_LIMITS:Readonly<{catalogBytes:number;clips:number;logBytes:number;events:number;eventBytes:number;requestBytes:number}>;
/** Requires local POSIX Python 3 dir_fd/flock; Windows unsupported. Cooperating writers only; no authenticated anti-tampering claim. Exclusive directory-inode read lock; refuses invalid chains. Source tags alone are the default search draft. */
/** Optional version selects an unrecorded library or checks an existing head/receipt pin; it never upgrades recorded history. */
export function readSemanticDrafts(options:{lib:string;dictionaryVersion?:string}):SemanticDraftSnapshot;
/** Draft-only attribution. No approval operations or automatic source replacement. */
export function appendSemanticDraft(options:{lib:string;request:SemanticDraftRequest}):{status:'draft';idempotent:boolean;event:SemanticDraftEvent;head:DraftHead};
