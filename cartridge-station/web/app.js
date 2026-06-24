/* Cartridge Station — OS 编辑器前端 */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let LIB = [], OS = {loaded:false};
let curId = null;                 // 详情/移除焦点
const picks = new Set();          // 多选（移除/打包）
let kmCur = null;                 // keymap 视图选中的游戏

let stTimer;
function toast(msg, kind){ const el=$('#status'); el.textContent=msg; el.className='show '+(kind||'');
  clearTimeout(stTimer); stTimer=setTimeout(()=>el.className=(kind||''),3200); }
function fmtBytes(n){ if(!n)return'0'; const u=['B','KB','MB','GB']; let i=0; while(n>=1024&&i<3){n/=1024;i++;} return n.toFixed(i?1:0)+' '+u[i]; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* 视图切换 */
$$('.tab').forEach(t=>t.onclick=()=>{
  $$('.tab').forEach(x=>x.classList.remove('active')); t.classList.add('active');
  const v=t.dataset.view;
  $('#view-library').hidden=v!=='library'; $('#view-keymap').hidden=v!=='keymap';
  if(v==='keymap') renderKmList();
});

/* 拉状态 */
async function refresh(){
  const d = await (await fetch('/api/state')).json();
  LIB = d.cartridges||[]; OS = d.os||{loaded:false};
  const builtin = LIB.filter(c=>c.source==='os').length;
  const added = LIB.length - builtin;
  $('#osStat').innerHTML = OS.loaded
    ? `基座 OS ✓ <b>${builtin}</b> 内置 + <b>${added}</b> 添加 → 打包 ${added} 个`
    : '基座 OS：未加载';
  $('#osStat').classList.toggle('ok', OS.loaded);
  renderGrid();
}
function updateButtons(){
  const builds = LIB.filter(c=>c.source!=='os');
  // 按钮常亮，点击时各自校验给 toast
  ['#btnRemove','#btnReplace','#btnPack','#btnClear'].forEach(s=>$(s)&&($(s).disabled=false));
  // 打包 = 库里全部已添加游戏（所见即所打）
  $('#btnPack').textContent = builds.length ? `📦 打包新 OS (${builds.length} 游戏)` : '📦 打包新 OS';
}
function renderGrid(){
  const g=$('#grid');
  if(!LIB.length){ g.innerHTML='<div class="empty">还没有游戏 — 拖个 .tar.gz 进来</div>'; renderDetail(); updateButtons(); return; }
  g.innerHTML='';
  LIB.forEach((c,i)=>{
    const el=document.createElement('div');
    el.className='cart'+(c.id===curId?' cur':'')+(picks.has(c.id)?' sel':'');
    el.innerHTML=`<div class="scrim"></div><div class="pick">✓</div>
      <span class="n">${String(i+1).padStart(2,'0')}</span>
      <div class="body"><div class="t">${esc(c.title)}</div>
      <div class="meta">${c.source==='os'?'OS 内置 · '+esc(c.genre||''):c.files+' 文件 · '+fmtBytes(c.bytes)+(c.playable?'':' · ⚠无入口')}</div>
      ${c.source==='os'?'<span class="hw os">内置</span>':(c.hw?`<span class="hw">${esc(c.hw)}</span>`:'')}</div>`;
    el.onclick=e=>{ if(e.shiftKey||e.metaKey||e.ctrlKey) togglePick(c.id); else { curId=c.id; renderDetail(); renderGrid(); } };
    el.oncontextmenu=e=>{ e.preventDefault(); togglePick(c.id); };
    g.appendChild(el);
  });
  updateButtons();
}
function togglePick(id){ picks.has(id)?picks.delete(id):picks.add(id); renderGrid(); }

function renderDetail(){
  const c=LIB.find(x=>x.id===curId), d=$('#detail');
  if(!c){ d.innerHTML='<div class="ph">选一张卡带 → 预览启动 + 元数据</div>'; return; }
  d.innerHTML=`<div class="detail-in">
    <h2 class="dt-title">${esc(c.title)}</h2><div class="dt-sub">${esc(c.pkg)}</div>
    ${c.playable?`<div class="frame-bar"><button id="btnBoot" class="primary">▶ 启动</button>
      <button id="btnOpen">↗ 新标签</button></div>
      <div class="frame-wrap"><iframe id="frame" sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups"></iframe></div>`
      :`<div class="ph" style="padding:20px 0">⚠ 无 cartridge.html 入口</div>`}
    <table class="kv">
      <tr><td class="k">ID</td><td><code>${esc(c.id)}</code></td></tr>
      ${c.game?`<tr><td class="k">游戏</td><td>game-${esc(c.game)}</td></tr>`:''}
      ${c.hw?`<tr><td class="k">硬件</td><td><span class="pill">${esc(c.hw)}</span></td></tr>`:''}
      <tr><td class="k">文件数</td><td>${c.files}</td></tr>
      <tr><td class="k">体积</td><td>${fmtBytes(c.bytes)}</td></tr>
      <tr><td class="k">按键</td><td>${(c.keymap||[]).filter(b=>b.detected).length?'已探测':'默认'} · 共 ${(c.keymap||[]).length} 键</td></tr>
    </table></div>`;
  const boot=$('#btnBoot');
  if(boot){ const url=`/preview/${encodeURIComponent(c.id)}/cartridge.html`;
    boot.onclick=()=>$('#frame').src=url; $('#btnOpen').onclick=()=>window.open(url,'_blank'); }
}

/* 加载 OS */
$('#btnLoadOs').onclick=()=>$('#osInput').click();
$('#osInput').onchange=async e=>{
  const f=e.target.files[0]; e.target.value=''; if(!f) return;
  toast('加载基座 OS…');
  const r=await fetch('/api/load-os',{method:'POST',body:f}); const d=await r.json();
  if(d.ok){ toast('✓ 基座 OS 已加载 ('+fmtBytes(d.os.bytes)+')','ok'); refresh(); }
  else toast('✕ 加载失败','err');
};

/* 添加 / 替换 */
async function addFiles(files, replace){
  for(const f of files){
    if(!/\.(tar\.gz|tgz|gz|html?)$/i.test(f.name)){ toast('✕ 跳过：'+f.name+'（要 .tar.gz 或 .html）','err'); continue; }
    try{
      const q='/api/add?name='+encodeURIComponent(f.name)+(replace?'&replace=1':'');
      const d=await (await fetch(q,{method:'POST',body:f})).json();
      if(d.ok) toast((replace?'🔁 已替换：':'✓ 已添加：')+d.cartridge.title,'ok'); else throw new Error(d.error);
    }catch(e){ toast('✕ '+f.name+'：'+e.message,'err'); }
  }
  await refresh();
}
$('#btnAdd').onclick=()=>$('#fileInput').click();
$('#fileInput').onchange=e=>{ addFiles([...e.target.files],false); e.target.value=''; };
$('#btnReplace').onclick=()=>{ if(!curId){toast('先选一个游戏','err');return;} $('#replaceInput').click(); };
$('#replaceInput').onchange=e=>{ addFiles([...e.target.files],true); e.target.value=''; };

/* 移除：选中(多选) 优先，否则移除当前焦点卡。内置 demo 也可移除（打包时从 OS 剥掉）*/
$('#btnRemove').onclick=async()=>{
  let ids = picks.size ? [...picks] : (curId ? [curId] : []);
  if(!ids.length){ toast('先点/选要移除的游戏','err'); return; }
  if(!confirm(`移除 ${ids.length} 个游戏？（内置 demo 会从打包的 OS 里去掉）`)) return;
  for(const id of ids) await fetch('/api/remove',{method:'POST',body:JSON.stringify({id})});
  picks.clear(); curId=null; await refresh(); toast('已移除','ok');
};
/* 一键去掉基座所有内置 demo 游戏 */
$('#btnStripBuiltin')&&($('#btnStripBuiltin').onclick=async()=>{
  if(!confirm('去掉基座 OS 自带的全部内置 demo 游戏？（只保留你添加的；可重新加载 OS 恢复）')) return;
  await fetch('/api/strip-builtin',{method:'POST'}); picks.clear(); curId=null;
  await refresh(); toast('已去掉全部内置 demo','ok');
});

/* 清空已添加的游戏（不动基座 OS）*/
$('#btnClear').onclick=async()=>{
  const builds = LIB.filter(c=>c.source!=='os');
  if(!builds.length){ toast('库里没有已添加的游戏','err'); return; }
  if(!confirm(`清空全部 ${builds.length} 个已添加的游戏？（基座 OS 及其内置游戏不动）`)) return;
  await fetch('/api/clear',{method:'POST'}); picks.clear(); curId=null;
  await refresh(); toast('已清空添加的游戏','ok');
};

/* 打包新 OS = 基座 OS + 库里全部已添加游戏（所见即所打）*/
$('#btnPack').onclick=async()=>{
  if(!OS.loaded){ toast('先加载基座 OS（📂 加载 OS）','err'); return; }
  const ids = LIB.filter(c=>c.source!=='os').map(c=>c.id);
  if(!ids.length){ toast('先添加至少一个游戏再打包','err'); return; }
  const name=prompt('新 OS 包名（不含扩展名）：','apollo-os')||'apollo-os';
  toast('打包中…');
  try{
    const r=await fetch('/api/pack',{method:'POST',body:JSON.stringify({ids,name})});
    if(!r.ok){ throw new Error((await r.json()).error); }
    const warn=r.headers.get('X-Multifile-Warning');
    const blob=await r.blob(); const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download=name+'.html'; a.click(); URL.revokeObjectURL(a.href);
    if(warn){ toast('⚠ 单 HTML 已出，但这些是多文件构建、跑不起来（只内联了壳）：'+decodeURIComponent(warn)+' → 请用 build:cartridge:single 出单文件','err'); }
    else { toast(`📦 单 HTML 已生成：${name}.html（${ids.length} 游戏 + 基座内置）`,'ok'); }
  }catch(e){ toast('✕ 打包失败：'+e.message,'err'); }
};

/* ── 按键映射（逐游戏）── */
function renderKmList(){
  const l=$('#kmList');
  if(!LIB.length){ l.innerHTML='<div class="ph" style="padding:30px 10px">先在「游戏」里添加</div>'; $('#kmMain').innerHTML='<div class="ph">← 选游戏</div>'; $('#kmTools').style.display='none'; return; }
  l.innerHTML=LIB.map(c=>`<div class="km-item${c.id===kmCur?' cur':''}" data-id="${c.id}">
    <div class="t">${esc(c.title)}</div><div class="s">${esc(c.hw||'')}</div></div>`).join('');
  $$('#kmList .km-item').forEach(it=>it.onclick=()=>{ kmCur=it.dataset.id; renderKmList(); renderKmMain(); });
  if(kmCur) renderKmMain();
}
function renderKmMain(){
  const c=LIB.find(x=>x.id===kmCur); const m=$('#kmMain');
  if(!c){ m.innerHTML='<div class="ph">← 选一个游戏配置按键</div>'; $('#kmTools').style.display='none'; return; }
  $('#kmTools').style.display='flex'; $('#kmTitle').textContent='按键映射 · '+c.title;
  const km=c.keymap||[];
  m.innerHTML=`<table class="km-table"><thead><tr><th>按钮</th><th>键盘 (e.code)</th><th>手柄按钮</th><th></th></tr></thead>
    <tbody>${km.map((b,i)=>`<tr>
      <td class="blab">${esc(b.label)}</td>
      <td><input data-i="${i}" data-f="keys" value="${esc((b.keys||[]).join(', '))}"></td>
      <td><input data-i="${i}" data-f="gamepad" value="${esc((b.gamepad||[]).join(', '))}"></td>
      <td>${b.detected?'<span class="det">探测✓</span>':''}</td></tr>`).join('')}</tbody></table>`;
  $$('#kmMain input').forEach(inp=>inp.oninput=()=>{
    const i=+inp.dataset.i,f=inp.dataset.f;
    const parts=inp.value.split(',').map(s=>s.trim()).filter(Boolean);
    c.keymap[i][f]=f==='gamepad'?parts.map(Number).filter(n=>!isNaN(n)):parts;
  });
}
$('#kmAuto').onclick=async()=>{
  if(!kmCur)return; const d=await (await fetch('/api/keymap/auto',{method:'POST',body:JSON.stringify({id:kmCur})})).json();
  if(d.ok){ const c=LIB.find(x=>x.id===kmCur); c.keymap=d.keymap; renderKmMain();
    toast('🔍 探测到键：'+(d.detected.join(', ')||'无')+' → 已标注','ok'); }
};
$('#kmReset').onclick=()=>{ const c=LIB.find(x=>x.id===kmCur); if(!c)return;
  c.keymap=null; renderKmMain(); saveKm(true); };
$('#kmSave').onclick=()=>saveKm();
async function saveKm(silent){
  const c=LIB.find(x=>x.id===kmCur); if(!c)return;
  await fetch('/api/keymap/set',{method:'POST',body:JSON.stringify({id:kmCur,keymap:c.keymap})});
  await refresh(); kmCur=c.id; renderKmList();
  if(!silent) toast('💾 已保存 '+c.title+' 的按键映射','ok');
}

/* 拖放 */
const drop=$('#drop');
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('hot');}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('hot');}));
drop.addEventListener('drop',e=>addFiles([...e.dataTransfer.files],false));
document.addEventListener('dragover',e=>e.preventDefault());
document.addEventListener('drop',e=>{ if(e.dataTransfer.files.length){e.preventDefault();addFiles([...e.dataTransfer.files],false);} });

refresh();
