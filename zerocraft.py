#!/usr/bin/env python3
"""ZeroCraft dev/workshop 服务入口（薄壳）。

实体代码已按功能拆进 main_entry/ 包；本文件只做两件事：
① 把 main_entry 各模块聚合成 `import zerocraft`（新名·唯一真身）与 `import apollo`（旧名·
   REQ-PKG-位置无关与正名·去 Apollo 化过渡期兼容，根 apollo.py 现只是转发本文件的一行 shim）
   两个导入名共用的同一个公共命名空间（读=聚合复制·写=按名路由到属主模块，保住 smoke 对
   xxx.API_PORT/_MOCK_*/_CONFIG_CACHE 的赋值语义，两个名字改哪个都生效）；
② `python3 zerocraft.py [命令]`（或 `python3 apollo.py [命令]` 经转发）时跑 main()。

原壳职责（保留说明）：ZeroCraft Preview Launcher —— Python 入口，同时启动 ① Vite 开发服务器（前端）
② API 服务器（工具命令后端）。用法：python3 zerocraft.py [命令]。
"""
import sys, types
from main_entry import (
    sysutil, paths, config, llm_log, blueprints, design_prompts, mock, templates,
    claude_code, llm_transport, generation, lowmodel, design_flow, generate_api,
    agent_prompts, workshop_store, agent_chat, protocols, ts_carts, settings_api,
    assets, games_list, jobs, packaging, groups, placeholder, workshop_state,
    art_review, art_replace, art_sync, t2_replace, pipeline_board, asset_annotate, library,
    library_api, design_drafts, artbrowser, server, cli,
)

_MODULES = [
    sysutil, paths, config, llm_log, blueprints, design_prompts, mock, templates,
    claude_code, llm_transport, generation, lowmodel, design_flow, generate_api,
    agent_prompts, workshop_store, agent_chat, protocols, ts_carts, settings_api,
    assets, games_list, jobs, packaging, groups, placeholder, workshop_state,
    art_review, art_replace, art_sync, t2_replace, pipeline_board, asset_annotate, library,
    library_api, design_drafts, artbrowser, server, cli,
]

# 外部（smoke）会 `apollo.NAME = v` 重新赋值这些可变态；写必须落到属主模块、读取回属主模块（保持活值）。
_WRITE_THROUGH = {
    'API_PORT': server,
    '_MOCK_BAD_REMAINING': mock,
    '_MOCK_BAD_MANIFEST_REMAINING': mock,
    '_CONFIG_CACHE': config,
}


class _ZeroCraftShim(types.ModuleType):
    def __getattr__(self, name):  # 仅在 __dict__ 未命中时触发
        tgt = _WRITE_THROUGH.get(name)
        if tgt is not None:
            return getattr(tgt, name)
        raise AttributeError(name)

    def __setattr__(self, name, value):
        tgt = _WRITE_THROUGH.get(name)
        if tgt is not None:
            setattr(tgt, name, value)
        else:
            super().__setattr__(name, value)


_shim = _ZeroCraftShim(__name__)
_shim.__dict__.update({'__file__': __file__, '__doc__': __doc__})
# 聚合读命名空间：复制各模块公共名（写穿透名除外——它们走 __getattr__ 取活值）。
for _m in _MODULES:
    for _k, _v in vars(_m).items():
        if not _k.startswith('__') and _k not in _WRITE_THROUGH:
            _shim.__dict__.setdefault(_k, _v)
main = cli.main
_shim.__dict__['main'] = main
sys.modules['zerocraft'] = _shim  # 新名·唯一真身
sys.modules['apollo'] = _shim  # 旧名兼容（REQ-PKG-位置无关与正名·去 Apollo 化过渡期）——同一个对象，
# 两个 import 名怎么改属性都互见，不会各改各的分叉出两份状态。

if __name__ == '__main__':
    main()
