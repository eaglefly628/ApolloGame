import type {DraftHead} from './motion-semantic-drafts.mjs';
export const SEMANTIC_MIGRATION_STAGING:'.semantic-review.migration-staging';
export interface SemanticMigrationBinding {sourceCatalogSha256:string;sourceHead:DraftHead;targetCatalogSha256:string;dictionaryVersion:string;sourceHistorySha256?:string}
export interface SemanticMigrationManifest {
 schemaVersion:1;lineageVersion:1;status:'draft';mode:'dry-run'|'applied';kind:'semantic-draft-migration';binding:SemanticMigrationBinding;
 classification:{unchanged:string[];changed:string[];deleted:string[];added:string[]};
 counts:{sourceEvents:number;migratedEvents:number;needsReviewEvents:number};
 eventMap:{clipId:string;operation:'propose'|'flag';sourceEventId:string;sourceEventSha256:string;targetEventId:string;targetEventSha256:string;sourceTagId:string;targetTagId:string}[];
 needsReview:{eventId:string;eventSha256:string;clipId:string;operation:'propose'|'flag';reason:'clip-changed'|'clip-deleted'}[];
 archive:{directory:'migration-archive';files:Record<string,{sha256:string;bytes:number}>};
 target:{head:DraftHead;logSha256:string|null;headSha256:string|null};approval:'not-supported';receiptSha256:string;
}
/** Inherited migration archives/receipts are verified and preserved within bounded generations. Both libraries must exist and be disjoint. Default dry-run writes nothing. No recovery or overwrite of existing sidecar/staging. */
export function migrateSemanticDrafts(options:{sourceLib:string;targetLib:string;apply?:false;expected?:SemanticMigrationBinding}|{sourceLib:string;targetLib:string;apply:true;expected:SemanticMigrationBinding}):SemanticMigrationManifest;
