# 真实角色取景修复独立复查

施工：motion_release_review；独立复查：主聊天。仅改变预览工具，不改引擎、主资产库或活跃转换器。

## 真实复现与重组

Ty的脸部UV扩展兼容后，原固定distance=4/pivotY=1会裁掉头顶。删除显式取景依赖ThreeRenderer默认fit更坏；实查camera计算使用poseBounds3D(实体位置)，不包括实际模型网格。因此复用Camera3D现有显式pivot/distance/near/far字段，由已存在的静态Skin inspector给真实restmesh包围盒，再按实际卡片aspect计算包围球取景。不新造播放器或相机system。

## 独立实证

- 额外/private/tmp隔离快照独立复跑framing/client/layout/server 32项，exit0。原快照第一次解包因仓库既有绝对node_modules符号链接被Python安全过滤器拒绝；改为跳过归档符号链接并显式链接测试依赖后执行，不将该环境失败当产品证据。
- 两处替换均断言唯一锚点：取消横向FOV约束后窄卡片测试退出1；取消服务端SHA核验后资产变更测试退出1。finally逐字恢复后32项全绿。证据 /private/tmp/framing-independent-um4z0hhi/，汇总 /private/tmp/motion-framing-independent.log。
- 真实Ty仅在独立review库预览，原GLB SHA不变、主库仍未发布Ty。Chrome目视头顶和脚部全部入镜，脸部贴图正常；待机、伸手、行走均能播放。
- 同一新版镜头下，YBot基础待机与未发布右臂IK候选可并排播放；可见右臂差异，仍为draft，无人工回执或主库发布。

结论：restmesh取景修复PASS。此结论不保证动画根位移之后永远入镜，也不认证目标设备、接触或艺术质量；窗口resize后重取景尚未提供。
