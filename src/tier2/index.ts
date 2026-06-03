// Tier 2 涌现层（规则与约束 / Resolution）。读取 Tier 1 与检测原子的结果，施加约束。
// 跑在 Resolve 阶段，避免与 Update 阶段的"读位置"系统在纯组件拓扑上成环。
export { collisionResolveCapability } from './collision-resolve.js';
