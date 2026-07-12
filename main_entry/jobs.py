"""Workshop 生成任务（服务端异步）。"""
import time
import json
import uuid
import threading

from .claude_code import _llm_live_view
from .config import _load_config
from .games_list import handle_catalog
from .generate_api import handle_generate
from .library_api import library_create, library_put_manifest
from .llm_transport import LLM_PROVIDERS, get_api_key
from .paths import LIBRARY_DIR, _valid_slug
from .sysutil import c

# ── Workshop 生成任务（服务端异步·owner 07-11「切屏/刷新丢状态」+ 300s 超时实证）──────────
# 生成→建库→落盘整链搬到服务端线程：浏览器只是看板（轮询 /api/generate/job）。刷新/关页不丢，
# 完成自动入库；状态放在 LLM/会话之外（与八阶段板同一条防漂移纪律）。进程内注册表即可（重启即清，
# 已入库的成品在 library/ 不受影响）。
_GEN_JOBS: dict = {}
_GEN_JOBS_LOCK = threading.Lock()
_GEN_JOB_STEPS = ['读能力目录…', '生成 manifest（订阅通道深思考·数分钟正常）…', '建库（含 S1 立项卡）…', '落盘（引擎校验+版本化+台账推导）…']

def _gen_job_update(jid: str, **kw) -> None:
    with _GEN_JOBS_LOCK:
        if jid in _GEN_JOBS:
            _GEN_JOBS[jid].update(kw)

def _run_gen_job(jid: str, prompt: str, provider: str, model, mode: str = 'create', slug: str = None) -> None:
    """后台线程本体。mode='create'：生成→建库→落盘全链；mode='prototype'：按已对齐的设计稿出原型→落盘
    （设计先行流第四步·owner 07-11「先提纲再对齐再生成」）。"""
    try:
        cat = handle_catalog().get('catalog') or None
        _gen_job_update(jid, step=1)
        if mode == 'prototype':
            g = handle_generate({'mode': 'prototype', 'slug': slug, 'provider': provider, 'model': model, 'catalog': cat})
        else:
            g = handle_generate({'prompt': prompt, 'provider': provider, 'model': model, 'autofix': True, 'catalog': cat})
        _gen_job_update(jid, tokens=int(g.get('tokens') or 0))  # 落 token 数（虚拟金币经济按它扣费）
        mf = g.get('manifest') or g.get('blueprint')
        if not g.get('success') or not isinstance(mf, dict):
            _gen_job_update(jid, done=True, error=str(g.get('error') or '生成失败')[:300]); return
        if mode == 'prototype':
            try:
                name = json.loads((LIBRARY_DIR / slug / 'meta.json').read_text('utf-8')).get('name') or slug
            except Exception:
                name = slug
        else:
            name = str(mf.get('name') or '新游戏')[:40]
            _gen_job_update(jid, step=2)
            st, cd = library_create({'name': name, 'description': prompt[:300], 'provider': provider})
            if st != 200 or not cd.get('success'):
                _gen_job_update(jid, done=True, error=str(cd.get('error') or '建库失败')[:300]); return
            slug = cd['slug']
        _gen_job_update(jid, step=3, slug=slug, name=name)
        st, pd = library_put_manifest(slug, {'manifest': mf, 'note': '原型生成（workshop·后台任务）' if mode == 'prototype' else '初版生成（workshop·后台任务）'})
        if st != 200 or not pd.get('success'):
            _gen_job_update(jid, done=True, error=str(pd.get('error') or '落盘校验失败')[:300]); return
        _gen_job_update(jid, done=True)
        print(c('  [GEN]', 'g'), f'job {jid} → {slug}「{name}」已入库')
    except Exception as e:
        _gen_job_update(jid, done=True, error=str(e)[:300])

def _gen_job_view(j: dict) -> dict:
    out = {'id': j['id'], 'prompt': j['prompt'], 'provider': j['provider'], 'step': j['step'],
           'stepLabel': _GEN_JOB_STEPS[min(3, j['step'])], 'done': j['done'], 'error': j['error'],
           'slug': j['slug'], 'name': j['name'], 'tokens': j.get('tokens') or 0,
           'elapsedSec': int(time.time() - j['startedAt'])}
    if not j['done']:
        live = _llm_live_view()  # 生成步的实时流量（thinking/text delta 计数）——看板一处拿全
        if live:
            top = max(live, key=lambda x: x['chars'])
            out['liveChars'], out['liveTail'] = top['chars'], top['tail']
            out['liveTrace'] = top.get('trace', '')
    return out

def handle_generate_job_start(body: dict) -> dict:
    """POST /api/generate/job。两种链：{prompt}=快速直出；{mode:'prototype', slug}=按设计稿出原型
    （07-11 实证 bug：原型链曾被 prompt 必填卡死）。凭据前置校验（早失败早报）。"""
    mode = str(body.get('mode') or 'create')
    if mode not in ('create', 'prototype'):
        return {'success': False, 'error': f'未知任务模式: {mode}（create/prototype）'}
    prompt = str(body.get('prompt') or '').strip()
    slug = str(body.get('slug') or '').strip() or None
    if mode == 'create':
        if not prompt:
            return {'success': False, 'error': 'prompt 必填（一句话创意）'}
    else:
        if not slug or not _valid_slug(slug):
            return {'success': False, 'error': f'原型任务需要合法 slug（实得: {slug or "(空)"}）'}
        if not (LIBRARY_DIR / slug).is_dir():
            return {'success': False, 'error': f'游戏不存在: {slug}'}
        prompt = f'原型生成（按设计稿）: {slug}'
    provider = str(body.get('provider') or _load_config().get('default') or 'claude-code')
    if provider != 'mock' and provider not in LLM_PROVIDERS:
        return {'success': False, 'error': f'Unknown provider: {provider}'}
    if not get_api_key(provider):
        env_key = LLM_PROVIDERS.get(provider, {}).get('env_key', '?')
        return {'success': False, 'error': f'{provider} 无可用凭据（配置 {env_key} 或在设置里填）'}
    jid = uuid.uuid4().hex[:12]
    with _GEN_JOBS_LOCK:
        for old in sorted(_GEN_JOBS.values(), key=lambda x: x['startedAt'])[:-19]:  # 只留最近 20 条记录
            _GEN_JOBS.pop(old['id'], None)
        _GEN_JOBS[jid] = {'id': jid, 'prompt': prompt[:120], 'provider': provider, 'step': 0,
                          'done': False, 'error': None, 'slug': slug if mode == 'prototype' else None,
                          'name': None, 'startedAt': time.time()}
    threading.Thread(target=_run_gen_job, args=(jid, prompt, provider, body.get('model'), mode, slug), daemon=True).start()
    print(c('  [GEN]', 'b'), f'job {jid} start · {mode} · {provider} · {prompt[:40]}')
    return {'success': True, 'id': jid}

def handle_generate_job_get(jid: str) -> dict:
    with _GEN_JOBS_LOCK:
        j = _GEN_JOBS.get(jid)
        return {'success': True, 'job': _gen_job_view(j)} if j else {'success': False, 'error': f'任务不存在: {jid}'}

def handle_generate_jobs_list() -> dict:
    """GET /api/generate/jobs。最近任务（新在前·壳启动时用它恢复「生成中」看板）。"""
    with _GEN_JOBS_LOCK:
        js = sorted(_GEN_JOBS.values(), key=lambda x: -x['startedAt'])[:5]
        return {'success': True, 'jobs': [_gen_job_view(j) for j in js]}
