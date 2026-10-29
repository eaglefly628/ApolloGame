/** Loopback-only previews must also reject foreign Host names (DNS rebinding).
 * Unbound nested handlers inherit the outer workbench's checked listening port.
 */
export function allowLocalPreviewHost(host, listeningPort) {
 if(typeof host!=='string')return false;
 const match=/^(127\.0\.0\.1|localhost)(?::([0-9]{1,5}))?$/i.exec(host);
 if(!match)return false;
 const port=match[2]===undefined?80:Number(match[2]);
 if(!Number.isInteger(port)||port<1||port>65535)return false;
 return listeningPort===undefined||port===listeningPort;
}
