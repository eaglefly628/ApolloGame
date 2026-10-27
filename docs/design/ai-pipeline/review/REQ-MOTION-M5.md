# M5 本地变体独立复查

施工：motion_skeletons；独立复查：主聊天。范围仅本地 trim / mirror / loop-fix，不代表远端 Mixamo 滑杆协议已完成。

独立执行 `scripts/motion-variant.test.mjs`，启用实际安装的 Blender，23/23通过。读取真实作业接线记录，helper快照与源字节匹配，真实三类GLB均通过现有引擎测量。原素材不变，源骨架/rest/逆绑定/二进制前缀保持，派生状态为draft。

两处唯一锚点替换均先断言恰命中一次：删除 `assertPreservedSource(bytes,output)` 后测试退出1；把派生状态draft改confirmed后退出1。finally逐字恢复，复跑23/23通过。日志为本机 `/tmp/motion-m5-review-{baseline,rest,draft,restored}.log`。

结论：本地变体子项PASS。已读告警/跳过：启用真实Blender后该套无跳过。原始远端滑杆、其它供应商在线协议不在本次复查内；镜像/补循环不承诺脚接触或动作视觉质量。完整M5条目暂不出池。
