# E5 场景 GLB 装载契约

作者只填 `SceneImport3D{modelKey,rules:"default"}`，最终GLB节点按`col_*`、`nav_*`、`pick_*`、`spawn_*`解释，其余显示。静态场景预处理与蓝图装载完成后才开始tick，不从渲染回调追加sim实体。

## 真实模型到数据

`scripts/scene-import.mjs <final.glb> --out <scene.json>`从最终、自包含GLB真实读取节点层级、变换、POSITION与三角；支持raw、Draco、meshopt，跳过材质/图片，不需要GPU、网络或API。产物是索引`spec.scene`候选数据，不自动修改index/批准资产；人审仍走原M2.5路线。最终GLB变更须重烘焙。不能用accessor min/max假冒几何。

机读形状：

```ts
interface SceneImportData {
  version: 1;
  sourceSha256: string; // 最终GLB的64位小写SHA256
  nodes: readonly {
    index: number; // 原glTF节点index
    path: readonly number[]; // 所选scene根至该节点的原节点index序列
    name: string;
    kind: 'collision' | 'navigation' | 'pick' | 'spawn' | 'display';
    worldMatrix: readonly number[]; // glTF列主序4×4，包含全部祖先变换
    positions?: readonly number[]; // 该语义子树真实世界坐标，扁平XYZ
    indices?: readonly number[]; // 对应三角索引
    bounds?: { min: readonly number[]; max: readonly number[] };
  }[];
}
type SceneImportCatalog = Readonly<Record<string, SceneImportData>>;
```

几何坐标以1e-4米量化；有限数值、索引与所有长度严格校验。语义子树包括本节点与普通display后代；嵌套另一语义前缀拒收，避免双重归属。spawn必须无几何；collision/navigation/pick必须有三角。默认scene必须明确（仅一个scene时可省scene索引）；只烘其可达节点。拒收环/多父节点、外部buffer、未知必需几何扩展、动态蒙皮/变形/动画语义节点；不伪造静态几何。重复名字可存在，寻址和实体id只用节点index/path。

索引解析验证spec.scene并携入ModelDescriptor；资产加载阶段对实际ArrayBuffer核SHA后，才可通过`sceneImportCatalog()`交出已验证条目。装载缺少已验证模型、旧SHA、mock占位或坏数据时明确拒收，不能沿美术fail-soft继续一个缺碰撞的世界。旧资产/无SceneImport蓝图不受影响。

## 装载和显示

纯函数`expandSceneImports(entities,catalog)`在模板展开后、能力推断/校验前展开。同步/异步manifest门面共用；Engine.load在创建任何实体和注册system前展开或拒收未满足的导入。生成id固定为导入实体id+节点index路径，冲突拒收，迭代顺序固定。导入初版使用GLB已烘世界坐标，不接受额外变换覆盖来偷偷改变sim几何。

- collision：复用Transform+Collider3D。默认只接静态凸碰撞网格，量化顶点与轴；凹体要求制作侧拆成多个col_*，不把任意凹形冒充凸体。
- navigation：由真实nav三角正向栅格化复用NavigationGrid/NavigationProfile与现有寻路；默认cellSize=0.5米、点智能体radius=0、占据高度1.8米。地板支撑面与挡路障碍须区分，不能因整幅col_floor使通路归零。E5装载端暂只接同一水平高度的nav三角，坡面及不同高度明确拒收，留给紧接的R2贴地阶段扩写；烘焙数据保留完整真实三角，不在工具侧丢弃地形。多层重叠导航不在平面NavGraph范围，明确拒收。
- pick：复用Pickable3D，默认signal=`scene.pick`、arg仍为实体id。渲染器须把选出模型的真实世界AABB接入现有拾取表，不能仅挂标记。背景排除独立pick子树，销毁拾取实体后物件不得残留。
- spawn：生成稳定id的Transform/Transform3D锚点，供现有prefab/Caster.originEntity消费；不新建出生点system。
- display：保留显示；nav/spawn辅助节点不画，col几何保留显示。

Model3D新增可选`nodeIndex:number`、`excludeNodes:readonly number[]`、`origin:readonly number[]`（XYZ）。缺省兼容整场原模型；按原glTF associations选择节点，保留祖先完整矩阵（不以Euler分解丢shear），按origin重定位。selector必须参与实例身份，换selector不得复用旧视图。GPU资源仍由同modelKey的模板scope拥有，分组卸载沿R4按key驱逐，实例不析构共享几何。

## 验收

真实Blender样例含四类节点，烘焙双跑字节一致；GLB变动后SHA拒收。同步/异步manifest与Engine直接蓝图走同一展开，装载前后输入不被修改，故障不创建半世界。碰撞真挡住动态体、导航真绕障、浏览器拾取命中与销毁不残影、出生点可供prefab消费，双跑hash相同。离线普通测试不需key/网络，真实浏览器检查另保留截图/日志；施工自证不替代独立四步复查。

几何读取依据[glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)、[Draco扩展](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_draco_mesh_compression)、[meshopt扩展](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_meshopt_compression)；CPU解码复用固定three依赖，不下载新付费软件。
