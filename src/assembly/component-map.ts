// 组件契约映射（Lead 维护）：全部组件【闭集】→ 组件数据形状（去 type）。
// EntityBlueprint 的组件名闭集牙：蓝图里写错/拼错组件名 → 编译期报错
// （数据驱动里最常见、最该拦的错：弱 LLM 容易拼错/编造组件名）。
// 闭集 = protocol/components 全部 + skill 内定义的组件（dialogue 的 3 个；该层级倒挂另案归位）。
// 放此 assembly 层：可同时 import protocol(低层) 与 skills，避免 protocol→skill 倒挂。
// 新增组件 = 在对应域文件/skill 加 interface(extends Component) + 在此登记一行。
import type {
  Acceleration,
  Action,
  AnimState,
  BoardCell,
  Bounds,
  Camera,
  Camera3D,
  CameraTarget,
  Card3D,
  CardPile,
  Caster,
  Clickable,
  Coachmark,
  Color,
  Controllable,
  CraftRecipe,
  DestroyRequest,
  Draggable,
  DropZone,
  Effect,
  EventWhen,
  Facing,
  Flag,
  Frame,
  GameFlow,
  Gauge,
  GridMover,
  Grounded,
  GroupCount,
  HeldHand,
  HexBoard,
  HexPos,
  Hierarchy,
  Hitbox,
  InputQueue,
  KeyBinding,
  Launch,
  Mass,
  MatchBoard,
  MergeRule,
  Mesh3D,
  Model3D,
  Mortal,
  OverTime,
  Overlap,
  PerCardRetrigger,
  PerCardRule,
  PerCardScore,
  Perception,
  PlayedHand,
  PokerHand,
  PrefabLibrary,
  PrefabOrigin,
  RandomSeed,
  RawInput,
  Relation,
  Resource,
  ResourceModify,
  ScoreTrace,
  SelfRule,
  Sensor,
  Shape,
  Signal,
  Sky3D,
  Sound,
  SpatialIndex,
  SpawnRequest,
  Sprite,
  State,
  StateChanged,
  Stats,
  Status,
  Steering,
  StringSet,
  StringVar,
  Tag,
  Text,
  TextBinding,
  Tilemap,
  Timer,
  TimerDone,
  Transform,
  Transform3D,
  Tray,
  TraySeat,
  Trigger,
  Tween,
  Velocity,
  Visibility,
  Zone,
} from '@engine/protocol/components.js';
import type { DialogueScript, DialogueAdvance, DialogueChoose } from '@skills/tier3/dialogue.js';

export interface ComponentDataMap {
  Acceleration: Omit<Acceleration, 'type'>;
  Action: Omit<Action, 'type'>;
  AnimState: Omit<AnimState, 'type'>;
  BoardCell: Omit<BoardCell, 'type'>;
  Bounds: Omit<Bounds, 'type'>;
  Camera: Omit<Camera, 'type'>;
  Camera3D: Omit<Camera3D, 'type'>;
  CameraTarget: Omit<CameraTarget, 'type'>;
  Card3D: Omit<Card3D, 'type'>;
  CardPile: Omit<CardPile, 'type'>;
  Caster: Omit<Caster, 'type'>;
  Clickable: Omit<Clickable, 'type'>;
  Coachmark: Omit<Coachmark, 'type'>;
  Color: Omit<Color, 'type'>;
  Controllable: Omit<Controllable, 'type'>;
  CraftRecipe: Omit<CraftRecipe, 'type'>;
  DestroyRequest: Omit<DestroyRequest, 'type'>;
  Draggable: Omit<Draggable, 'type'>;
  DropZone: Omit<DropZone, 'type'>;
  Effect: Omit<Effect, 'type'>;
  EventWhen: Omit<EventWhen, 'type'>;
  Facing: Omit<Facing, 'type'>;
  Flag: Omit<Flag, 'type'>;
  Frame: Omit<Frame, 'type'>;
  GameFlow: Omit<GameFlow, 'type'>;
  Gauge: Omit<Gauge, 'type'>;
  GridMover: Omit<GridMover, 'type'>;
  Grounded: Omit<Grounded, 'type'>;
  GroupCount: Omit<GroupCount, 'type'>;
  HeldHand: Omit<HeldHand, 'type'>;
  HexBoard: Omit<HexBoard, 'type'>;
  HexPos: Omit<HexPos, 'type'>;
  Hierarchy: Omit<Hierarchy, 'type'>;
  Hitbox: Omit<Hitbox, 'type'>;
  InputQueue: Omit<InputQueue, 'type'>;
  KeyBinding: Omit<KeyBinding, 'type'>;
  Launch: Omit<Launch, 'type'>;
  Mass: Omit<Mass, 'type'>;
  MatchBoard: Omit<MatchBoard, 'type'>;
  MergeRule: Omit<MergeRule, 'type'>;
  Mesh3D: Omit<Mesh3D, 'type'>;
  Model3D: Omit<Model3D, 'type'>;
  Mortal: Omit<Mortal, 'type'>;
  OverTime: Omit<OverTime, 'type'>;
  Overlap: Omit<Overlap, 'type'>;
  PerCardRetrigger: Omit<PerCardRetrigger, 'type'>;
  PerCardRule: Omit<PerCardRule, 'type'>;
  PerCardScore: Omit<PerCardScore, 'type'>;
  Perception: Omit<Perception, 'type'>;
  PlayedHand: Omit<PlayedHand, 'type'>;
  PokerHand: Omit<PokerHand, 'type'>;
  PrefabLibrary: Omit<PrefabLibrary, 'type'>;
  PrefabOrigin: Omit<PrefabOrigin, 'type'>;
  RandomSeed: Omit<RandomSeed, 'type'>;
  RawInput: Omit<RawInput, 'type'>;
  Relation: Omit<Relation, 'type'>;
  Resource: Omit<Resource, 'type'>;
  ResourceModify: Omit<ResourceModify, 'type'>;
  ScoreTrace: Omit<ScoreTrace, 'type'>;
  SelfRule: Omit<SelfRule, 'type'>;
  Sensor: Omit<Sensor, 'type'>;
  Shape: Omit<Shape, 'type'>;
  Signal: Omit<Signal, 'type'>;
  Sky3D: Omit<Sky3D, 'type'>;
  Sound: Omit<Sound, 'type'>;
  SpatialIndex: Omit<SpatialIndex, 'type'>;
  SpawnRequest: Omit<SpawnRequest, 'type'>;
  Sprite: Omit<Sprite, 'type'>;
  State: Omit<State, 'type'>;
  StateChanged: Omit<StateChanged, 'type'>;
  Stats: Omit<Stats, 'type'>;
  Status: Omit<Status, 'type'>;
  Steering: Omit<Steering, 'type'>;
  StringSet: Omit<StringSet, 'type'>;
  StringVar: Omit<StringVar, 'type'>;
  Tag: Omit<Tag, 'type'>;
  Text: Omit<Text, 'type'>;
  TextBinding: Omit<TextBinding, 'type'>;
  Tilemap: Omit<Tilemap, 'type'>;
  Timer: Omit<Timer, 'type'>;
  TimerDone: Omit<TimerDone, 'type'>;
  Transform: Omit<Transform, 'type'>;
  Transform3D: Omit<Transform3D, 'type'>;
  Tray: Omit<Tray, 'type'>;
  TraySeat: Omit<TraySeat, 'type'>;
  Trigger: Omit<Trigger, 'type'>;
  Tween: Omit<Tween, 'type'>;
  Velocity: Omit<Velocity, 'type'>;
  Visibility: Omit<Visibility, 'type'>;
  Zone: Omit<Zone, 'type'>;
  DialogueScript: Omit<DialogueScript, 'type'>;
  DialogueAdvance: Omit<DialogueAdvance, 'type'>;
  DialogueChoose: Omit<DialogueChoose, 'type'>;
}
