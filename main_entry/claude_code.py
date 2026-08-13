"""Claude Code 订阅通道（CLI headless 传输 + 实时活动注册表）。"""
import subprocess
import os
import time
import json
import shutil
import re
import uuid
import threading

from .sysutil import ROOT, _spawn, c

# ── Claude Code 订阅通道（owner 2026-07-10「不买 API·不花新钱」·spec=workshop-spec §2.1）──────
# 机制：spawn 本机 Claude Code CLI headless（`claude -p`·prompt 走 stdin 防 ARG_MAX·JSON 出）。
# 凭据：CLAUDE_CODE_OAUTH_TOKEN（`claude setup-token` 产出·config>env>.env）或 CLI 已登录（sentinel 'cli'）。
# 安全铁律（spec §四）：子进程只当**纯文本生成器**——内建工具全禁 + 单轮 + 空工作目录（三重闸：
# 即使某闸失效也无仓库可读可写）；token 只进子进程 env，绝不落日志/回显。
# 工具面全禁（安全红线）+ 计划/提问/技能类也禁（owner 07-11 实证：模型在 CLI 代理人格里试图调工具
# → stop_reason=tool_use 吃掉唯一回合 → error_max_turns 空 result）。未知名单项 CLI 会忽略，宁多勿漏。
_CLAUDE_CODE_TOOLS_OFF = ('Bash,Edit,Write,Read,Glob,Grep,WebFetch,WebSearch,Task,NotebookEdit,TodoWrite,'
                          'AskUserQuestion,EnterPlanMode,ExitPlanMode,SlashCommand,Skill,KillShell,BashOutput,'
                          'TaskOutput,TaskCreate,TaskUpdate,TaskList,TaskGet,TaskStop,Agent,ListMcpResourcesTool,ReadMcpResourceTool')
# 覆盖代理人格（同一实证的另一半根治）：-p 单发场景下把它钉成纯文本生成器。
_CLAUDE_CODE_SYSTEM_PIN = ('你在无工具的单发文本模式下工作：只输出最终文本回复本身；'
                           '绝不调用任何工具（本会话工具已全部禁用）；不要做计划、不要反问、不要输出前言后记。')
_CLAUDE_CODE_CWD = ROOT / '.zerocraft' / 'claude-code-cwd'  # 专用空目录（gitignore 的 .zerocraft 下·
# 只是隔离沙盒、无持久数据，不需要旧 .apollo/ fallback）

_CLAUDE_EFFORTS = ('low', 'medium', 'high', 'xhigh', 'max')

def _claude_code_args(model: str, effort: str = 'high', resume: str = None) -> list:
    """CLI 参数（纯函数·冒烟断言工具面全禁/单轮/流式出）。effort 默认 high（owner 07-11「默认 4.8 high」）。
    stream-json + 部分消息：思考/正文 delta 逐行吐出 → 实时活动注册表；resume=原生 session 续聊
    （owner 07-11「跟 Claude Code 一致」·方案 A）——上下文在 CC 侧完整延续，只发增量。"""
    if effort not in _CLAUDE_EFFORTS:
        effort = 'high'
    args = ['claude', '-p', '--output-format', 'stream-json', '--include-partial-messages', '--verbose',
            '--model', model, '--effort', effort, '--append-system-prompt', _CLAUDE_CODE_SYSTEM_PIN,
            '--max-turns', '1', '--disallowedTools', _CLAUDE_CODE_TOOLS_OFF]
    if resume and re.fullmatch(r'[0-9a-fA-F-]{8,64}', resume):
        args += ['--resume', resume]
    return args

def _claude_code_args_legacy(model: str, effort: str = 'high', resume: str = None) -> list:
    """旧版 CLI 兼容参数（不认 --include-partial-messages/--effort 的版本）：非流式 json 出——
    功能可用但无实况（owner 07-11 v2.1.87 auto-update failed 实证）。检测到即整进程降级并提示升级。"""
    args = ['claude', '-p', '--output-format', 'json', '--model', model,
            '--append-system-prompt', _CLAUDE_CODE_SYSTEM_PIN,
            '--max-turns', '1', '--disallowedTools', _CLAUDE_CODE_TOOLS_OFF]
    if resume and re.fullmatch(r'[0-9a-fA-F-]{8,64}', resume):
        args += ['--resume', resume]
    return args

_CLAUDE_CODE_LEGACY = {'on': False}  # 一旦检测旧 CLI 就记住（本进程内），后续直接走兼容路径

# 实时活动注册表：订阅通道请求进行中的流式度量（chars/tail）——生成看板与对话气泡的「在干什么」。
_LLM_LIVE: dict = {}
_LLM_LIVE_LOCK = threading.Lock()

def _llm_live_view() -> list:
    with _LLM_LIVE_LOCK:
        now = time.time()
        return [{'id': v['id'], 'provider': v['provider'], 'model': v['model'],
                 'elapsedSec': int(now - v['startedAt']), 'chars': v['chars'], 'tail': v['tail'],
                 'trace': v.get('trace', '')}
                for v in sorted(_LLM_LIVE.values(), key=lambda x: x['startedAt'])]

def handle_llm_live() -> dict:
    """GET /api/llm-live。进行中的 LLM 请求流式度量（空数组=此刻没有请求在跑）。
    legacy=True 表示已降级旧版 CLI 兼容模式（无实况可给·壳明示"升级 CLI 恢复实况"而不是干等）。"""
    return {'success': True, 'live': _llm_live_view(), 'legacy': _CLAUDE_CODE_LEGACY['on']}

def _claude_code_transcript(system: str, messages: list) -> str:
    """system + 多轮 messages → 单段 stdin 文本（v1 确定性拼接·好测；SDK session/resume 记 v2）。"""
    lines = [system or '', '', '--- 以下是对话记录（续写最后一个 [助手] 回合·直接输出回复内容） ---', '']
    for m in messages:
        lines.append('[用户]' if m.get('role') == 'user' else '[助手]')
        lines.append(str(m.get('content', '')))
        lines.append('')
    lines.append('[助手]')
    return '\n'.join(lines)

def _claude_code_request(api_key: str, model: str, system: str, messages: list, effort: str = 'high', session: dict = None) -> dict:
    """订阅通道·流式版：Popen + stream-json 逐行读——思考/正文 delta 实时进 _LLM_LIVE（前端可见「在干什么」），
    result 行收尾。存活判据=心跳非闹钟（owner 07-11「边生成边看到就不用超时杀」）：只要还在吐流就不杀，
    180s 无任何输出=停滞收割；1800s 绝对上限只作跑飞保险。"""
    if not shutil.which('claude'):
        return {'success': False, 'error': '未找到 claude CLI——装 Claude Code 后 `claude setup-token`（订阅通道·workshop-spec §2.1）'}
    env = dict(os.environ)
    if api_key and api_key != 'cli':
        env['CLAUDE_CODE_OAUTH_TOKEN'] = api_key
    _CLAUDE_CODE_CWD.mkdir(parents=True, exist_ok=True)
    resume_id = (session or {}).get('id')
    # resume=原生续聊：session 里已有系统词与全部历史——只发最新一条（增量）；首轮才发全量 transcript。
    payload = messages[-1]['content'] if resume_id else _claude_code_transcript(system, messages)

    def _legacy_run():  # 旧版 CLI 兼容路径：非流式一发（无实况·功能不断）
        try:
            lp = subprocess.run(**_spawn(_claude_code_args_legacy(model, effort, resume_id)),
                                input=payload, capture_output=True,
                                encoding='utf-8', errors='replace', timeout=1800, cwd=_CLAUDE_CODE_CWD, env=env)
        except subprocess.TimeoutExpired:
            return {'success': False, 'error': '订阅通道超时（30 分钟·旧版 CLI 兼容模式）'}
        except Exception as e:
            return {'success': False, 'error': f'Claude Code 启动失败: {e}'}
        lout = (lp.stdout or '').strip()
        if lp.returncode != 0:
            ltail = ((lp.stderr or '').strip() or lout)[-400:]
            return {'success': False, 'error': f'Claude Code 退出码 {lp.returncode}: {ltail[:300]}'}
        try:
            ldata = json.loads(lout)
        except Exception:
            try:
                ldata = json.loads(lout.splitlines()[-1])
            except Exception:
                return {'success': False, 'error': f'Claude Code 输出解析失败: {lout[:200]}'}
        ltext = ldata.get('result') if isinstance(ldata, dict) else None
        if not isinstance(ltext, str):
            return {'success': False, 'error': f'Claude Code 无 result 字段: {str(ldata)[:200]}'}
        if session is not None and isinstance(ldata.get('session_id'), str):
            session['id'] = ldata['session_id']
        return {'success': True, 'text': ltext, 'usage': ldata.get('usage') if isinstance(ldata.get('usage'), dict) else None}

    if _CLAUDE_CODE_LEGACY['on']:
        return _legacy_run()

    rid = uuid.uuid4().hex[:8]
    with _LLM_LIVE_LOCK:
        _LLM_LIVE[rid] = {'id': rid, 'provider': 'claude-code', 'model': model,
                          'startedAt': time.time(), 'chars': 0, 'tail': '', 'trace': ''}
    killed = {'v': None}  # None=正常 · 'stall'=停滞收割 · 'cap'=绝对上限
    proc = None
    try:
        try:
            proc = subprocess.Popen(**_spawn(_claude_code_args(model, effort, resume_id)),
                                    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                    encoding='utf-8', errors='replace', cwd=_CLAUDE_CODE_CWD, env=env)
        except Exception as e:
            return {'success': False, 'error': f'Claude Code 启动失败: {e}'}

        beat = {'last': time.time()}
        t0 = time.time()

        def _watch():  # 心跳看门狗：停滞（180s 零输出）或绝对上限（1800s）才杀——推进中的长思考不打断
            while proc.poll() is None:
                now = time.time()
                if now - beat['last'] > 180:
                    killed['v'] = 'stall'
                elif now - t0 > 1800:
                    killed['v'] = 'cap'
                else:
                    time.sleep(5)
                    continue
                try:
                    proc.kill()
                except Exception:
                    pass
                return
        threading.Thread(target=_watch, daemon=True).start()
        result_text, text_acc, usage, raw_lines = None, [], None, []
        captured_sid = None
        try:
            try:
                proc.stdin.write(payload)
                proc.stdin.close()
            except Exception:
                pass  # 进程可能已死——由退出码分支报错
            for line in proc.stdout:
                beat['last'] = time.time()  # 任何一行输出都是心跳（thinking/text/系统事件）
                raw_lines.append(line)
                try:
                    ev = json.loads(line)
                except Exception:
                    continue
                if isinstance(ev.get('session_id'), str):
                    captured_sid = ev['session_id']
                t = ev.get('type')
                if t == 'stream_event':  # 部分消息 delta：thinking/text 都算「活着的进度」
                    delta = ((ev.get('event') or {}).get('delta') or {})
                    piece = delta.get('text') or delta.get('thinking') or delta.get('partial_json') or ''
                    if piece:
                        if delta.get('text'):
                            text_acc.append(piece)
                        with _LLM_LIVE_LOCK:
                            if rid in _LLM_LIVE:
                                _LLM_LIVE[rid]['chars'] += len(piece)
                                _LLM_LIVE[rid]['tail'] = (piece.replace('\n', ' '))[-120:]
                                _LLM_LIVE[rid]['trace'] = (_LLM_LIVE[rid].get('trace', '') + piece)[-12000:]  # 滚动 trace 窗（owner 07-11）
                elif t == 'result':
                    if isinstance(ev.get('result'), str):
                        result_text = ev['result']
                    if isinstance(ev.get('usage'), dict):
                        usage = ev['usage']
            proc.wait()
        finally:
            beat['last'] = time.time()  # 收尾后停表（watch 线程随 proc 退出自然结束）
        if killed['v'] == 'stall':
            return {'success': False, 'error': '订阅通道停滞（180s 零输出）——多为网络/CLI 卡住，重试即可（推进中的长思考不会被杀）'}
        if killed['v'] == 'cap':
            return {'success': False, 'error': '订阅通道超过绝对上限（30 分钟）——简化描述或降思考档后重试'}
        if proc.returncode != 0:
            tail = ((proc.stderr.read() or '').strip() or ''.join(raw_lines).strip())[-400:]
            low = tail.lower()
            if 'unknown option' in low or 'unknown argument' in low or 'unrecognized' in low:
                _CLAUDE_CODE_LEGACY['on'] = True  # 旧版 CLI 不认流式旗标 → 本进程降级非流式（功能不断·无实况）
                print(c('  [LLM]', 'y'), '检测到旧版 claude CLI（不认流式旗标）——已降级兼容模式；升级 CLI 可获实况（claude doctor）', flush=True)
                return _legacy_run()
            if resume_id and 'limit' not in low and 'rate' not in low:
                # session 丢失/过期（CC 侧清理等）→ 清 id 回落全量重放一次（体验降一轮·不断链）
                print(c('  [LLM]', 'y'), f'resume 失败（{tail[:80]}）——回落全量重放并新开 session', flush=True)
                if session is not None:
                    session['id'] = None
                return _claude_code_request(api_key, model, system, messages, effort, session)
            # 额度判定必须认**真信号**，不能认裸词（owner 2026-08-07 撞出）：
            # 旧写法 `'usage' in low or 'rate' in low` 会被 Claude Code 流式输出里的 usage JSON 块
            # （"cache_read_input_tokens":0,"output_tokens":0…）无条件命中 —— 那玩意儿几乎每次都在输出末尾，
            # 于是**不论真实死因是什么都被贴成「额度满」**，把真因盖死（owner 明明没用过额度却收到此报错）。
            # 现在只认限流的确凿形态；认不出就落到下面的通用分支，**原样把 tail 摆出来**，绝不假装知道原因。
            RATE_SIGNS = ('rate limit', 'rate_limit', 'usage limit', 'quota', 'too many requests',
                          '429', 'insufficient_quota', 'overloaded_error')
            if any(k in low for k in RATE_SIGNS) or '额度' in tail:
                return {'success': False, 'error': f'订阅额度暂满或受限（额度窗恢复后重试）: {tail[:200]}'}
            return {'success': False, 'error': f'Claude Code 退出码 {proc.returncode}: {tail[:300]}'}
        text = result_text if isinstance(result_text, str) else (''.join(text_acc) or None)
        if not isinstance(text, str) or not text.strip():
            return {'success': False, 'error': f'Claude Code 无 result 字段: {"".join(raw_lines)[:200]}'}
        if session is not None and captured_sid:
            session['id'] = captured_sid
        return {'success': True, 'text': text, 'usage': usage}
    finally:
        with _LLM_LIVE_LOCK:
            _LLM_LIVE.pop(rid, None)
