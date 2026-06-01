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

  addComponent(entityId: EntityId, component: Component): void;
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
