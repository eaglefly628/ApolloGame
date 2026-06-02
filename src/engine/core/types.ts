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
  execute(world: IWorld): void;
}

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
