# Third-party notices

## RVO2 Library（ORCA 避让）

- 上游：RVO2 Library，<https://gamma.cs.unc.edu/RVO2/>，源码 <https://github.com/snape/RVO2>。
- 版权所有：Copyright 2008 University of North Carolina at Chapel Hill。
- 原作者：Jur van den Berg、Stephen J. Guy、Jamie Snape、Ming C. Lin、Dinesh Manocha。
- 许可证：Apache License 2.0，完整正文见 `licenses/Apache-2.0.txt`。
- 移植文件：`src/skills/tier2/orca.ts`。

**修改说明：**此文件是修改过的移植版本。原实现的 C++ `Agent`/`Vector2` 部分被改写为 TypeScript 纯函数；静态障碍交给导航网格处理，邻居搜索交给引擎的空间索引；时间步固定为一个模拟步，并补充同位退化处理、非互惠单位处理和按质量/久卡优先级分配避让责任。逐项技术说明保留在 `src/skills/tier2/orca.ts` 文件头。
