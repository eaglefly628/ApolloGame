/** Read-only native readiness, never a simulation or artistic quality receipt. */
export interface AnimationDiagnostic {readonly entityId:string;readonly kind:'base'|'locomotion'|'performance'|'root'|'socket'|'ik'|'face';readonly status:'loading'|'ready'|'rejected';readonly reason?:string}
export function safeAnimationReason(value:unknown):string{return String(value instanceof Error?value.message:value).replace(/(?:https?:|blob:|data:|file:)\S+/gi,'[asset]').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,256);}
