#!/usr/bin/env python3
"""apollo.py → zerocraft.py 转发 shim（护 owner 肌肉记忆·REQ-PKG-位置无关与正名·去 Apollo 化，
2026-08-02）。引擎正名 ZeroCraft 后，本文件不再是实体入口——新脚本/文档一律直接用
`python3 zerocraft.py [命令]` 或 `import zerocraft`。`python3 apollo.py [命令]` 与 `import apollo`
仍然可用（下面这行 import 触发 zerocraft.py 的模块级注册，其中含 `sys.modules['apollo'] = _shim`
自赋值——两个导入名从此共享同一个聚合命名空间对象，改哪个属性都互见）。
"""
import zerocraft  # noqa: F401 — 触发模块级注册（含 sys.modules['apollo'] 自赋值）

if __name__ == '__main__':
    zerocraft.main()
