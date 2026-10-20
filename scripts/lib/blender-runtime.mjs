// On this macOS host, Codex's seatbelt launch crashes Blender in Metal before
// Python starts. Fail before spawning; permission handling stays with the host.
import { basename, delimiter, resolve } from 'node:path';
import { realpathSync, statSync, accessSync, constants } from 'node:fs';

export function blenderLaunchBlockReason(executable,{platform=process.platform,sandbox=process.env.CODEX_SANDBOX,path=process.env.PATH}={}) {
  if(platform!=='darwin'||sandbox!=='seatbelt')return null;
  let physical=executable;
  if(typeof executable==='string'&&!executable.includes('/')) {
    // Match POSIX execvp: a bare command resolves through PATH, not cwd first.
    for(const entry of (path??'').split(delimiter)) {
      const candidate=resolve(entry||'.',executable);
      try {if(!statSync(candidate).isFile())continue;accessSync(candidate,constants.X_OK);physical=realpathSync(candidate);break;}catch { /* Try the next PATH entry; do not launch a probe. */ }
    }
  } else {
    try {physical=realpathSync(executable);}catch { /* Missing binary remains the caller's error. */ }
  }
  if(![executable,physical].some(p=>typeof p==='string'&&(basename(p).toLowerCase()==='blender'||p.includes('/Blender.app/Contents/MacOS/'))))return null;
  return '检测到 macOS Codex seatbelt 沙箱：已在启动前拦截 Blender，避免已复现的 Metal 初始化崩溃。请通过宿主授权的正常执行环境运行真实验证，或显式 --mock；不要清除沙箱标识绕过权限。';
}
export function assertBlenderLaunchAllowed(executable,context) {
  const reason=blenderLaunchBlockReason(executable,context);
  if(reason){console.error(`[blender-runtime] reject: ${reason}`);throw new Error(`blender-runtime: ${reason}`);}
}
