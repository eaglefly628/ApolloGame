const $ = (id) => document.getElementById(id);
const PLATS = { win: 'Windows', mac: 'macOS', linux: 'Linux' };
let cfg = null;
let logOffset = 0, polling = false;

function toast(msg, err) {
  const d = document.createElement('div');
  d.className = 't' + (err ? ' err' : '');
  d.textContent = msg;
  $('toast').appendChild(d);
  setTimeout(() => d.remove(), 4000);
}

async function api(path, body) {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || ('HTTP ' + r.status));
  return j;
}

function readForm() {
  cfg.appId = $('appId').value.trim();
  cfg.description = $('description').value;
  cfg.setLive = $('setLive').value.trim();
  cfg.steamcmd = $('steamcmd').value.trim();
  cfg.builder = $('builder').value.trim();
  cfg.game = $('game').value;
  cfg.depots = [...document.querySelectorAll('#depotRows tr')].map((tr) => ({
    plat: tr.dataset.plat,
    depotId: tr.querySelector('.depotId').value.trim(),
    content: tr.querySelector('.content').value.trim(),
  }));
  return cfg;
}

function fillForm(state) {
  cfg = state.config;
  $('game').innerHTML = state.games.map((g) => `<option value="${g.id}">${g.title}</option>`).join('');
  $('game').value = cfg.game;
  $('appId').value = cfg.appId;
  $('description').value = cfg.description;
  $('setLive').value = cfg.setLive;
  $('steamcmd').value = cfg.steamcmd;
  $('builder').value = cfg.builder;
  $('depotRows').innerHTML = cfg.depots.map((d) => `
    <tr data-plat="${d.plat}">
      <td><b>${PLATS[d.plat] || d.plat}</b></td>
      <td><input class="depotId" value="${d.depotId || ''}" placeholder="DepotID"></td>
      <td><input class="content" value="${d.content || ''}" placeholder="release/${cfg.game}/bin/...-unpacked"></td>
    </tr>`).join('');
  const sc = state.steamcmd;
  $('statusBar').innerHTML =
    `<span class="${sc.found ? 'ok' : 'bad'}">steamcmd: ${sc.found ? '✓' : '✗ ' + sc.how}</span>` +
    `<span class="${state.builds.length ? 'ok' : 'bad'}">裸目录: ${state.builds.length ? state.builds.length + ' 个' : '未构建'}</span>` +
    `<span>AppID: ${cfg.appId}</span>`;
}

async function refresh() {
  try { fillForm(await api('/api/state')); } catch (e) { toast(e.message, true); }
}

function pollLog() {
  if (polling) return; polling = true;
  const tick = async () => {
    try {
      const j = await api('/api/log?offset=' + logOffset);
      if (j.text) { $('log').textContent += j.text; logOffset = j.offset; $('log').scrollTop = $('log').scrollHeight; }
      if (j.running) { setTimeout(tick, 700); } else { polling = false; refresh(); }
    } catch (e) { polling = false; }
  };
  tick();
}

async function run(action) {
  try {
    $('log').textContent = ''; logOffset = 0;
    await api('/api/run', { action, config: readForm() });
    toast('已启动：' + action);
    pollLog();
  } catch (e) { toast(e.message, true); }
}

$('btnSave').onclick = async () => { try { await api('/api/save-config', { config: readForm() }); toast('已保存'); } catch (e) { toast(e.message, true); } };
$('btnDetect').onclick = refresh;
$('btnGen').onclick = async () => {
  try {
    const j = await api('/api/gen-vdf', { config: readForm() });
    $('log').textContent = '生成于 ' + j.dir + '\n\n' + Object.entries(j.files).map(([k, v]) => `── ${k} ──\n${v}`).join('\n');
    toast('VDF 已生成');
  } catch (e) { toast(e.message, true); }
};
$('btnBuild').onclick = () => run('build');
$('btnLogin').onclick = () => run('login');
$('btnPublish').onclick = () => { if (confirm('生成 VDF 并上传到 Steam？')) run('gen-and-publish'); };

refresh();
