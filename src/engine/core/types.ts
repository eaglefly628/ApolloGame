export type EntityId = string;
export type ComponentType = string;

export interface Component {
  readonly type: ComponentType;
}

export interface SystemDeclaration {
  readonly id: string;
  readonly reads: ComponentType[];
  readonly writes: ComponentType[];
  readonly consumes: ComponentType[];
  // 执行阶段。跨阶段按阶段号升序定序，阶段内仍按组件依赖拓扑排序。缺省 = Update(0)。
  // 用于表达纯组件拓扑无法表达的"读后改"管线（如 collision-resolve 写 Transform
  // 而 overlap-detect 读 Transform，在组件图上互为前驱会判成环）。
  readonly phase?: number;
  execute(world: IWorld): void;
}

// 系统执行阶段（数值越小越早）。绝大多数系统留缺省 Update，靠组件拓扑自动定序；
// 只有"读完本帧状态后再修正同一状态"的系统（碰撞解算、约束）才排到更后的阶段。
export const SystemPhase = {
  Update: 0,   // 默认：积分 / 检测 / 计时 / 生命周期……（组件拓扑自动定序）
  Resolve: 10, // 解算：读完位置后再修正位置/速度（碰撞推开、约束）
  Commit: 20,  // 提交：基于解算结果的最终写入
} as const;

export interface IWorld {
  createEntity(id: EntityId): void;
  destroyEntity(id: EntityId): void;
  getAllEntities(): EntityId[];

  addComponent<T extends Component>(entityId: EntityId, component: T): void;
  removeComponent(entityId: EntityId, type: ComponentType): void;
  getComponent<T extends Component>(entityId: EntityId, type: ComponentType): T | undefined;
  hasComponent(entityId: EntityId, type: ComponentType): boolean;

  query(...types: ComponentType[]): Array<[EntityId, Map<ComponentType, Component>]>;
  queryEntities(...types: ComponentType[]): EntityId[];

  getVersion(): number;
}

export interface RendererBackend {
  init(container: HTMLElement): void;
  sync(world: IWorld): void;
  destroy(): void;
}

// 完整世界状态快照（组件皆 POD，可 JSON 序列化）—— record/replay 与时间旅行调试用
export type WorldSnapshot = Record<EntityId, Record<ComponentType, Component>>;

// tick 期间的观测钩子 —— Debug 体系据此观察各系统(skill)之间的协作
export interface TickObserver {
  onTickStart?(tick: number): void;
  onSystemStart?(system: SystemDeclaration): void;
  onSystemEnd?(system: SystemDeclaration): void;
  onTickEnd?(tick: number): void;
}
