# Mixamo 本机 108 角色骨架定义

依据派工单补充 C；只读分析 `~/ApolloAssets/mixamo/characters_mesh/characters_manifest.json` 中全部 108 个 success 主文件。分析日期：2026-10-27。结构与数值抽取完成；真实 Blender 导入、网格朝向与完整 T-pose 验收尚未完成。

共抽取 **7298 根 LimbNode**；40 种改名后骨名集合。每个原始文件的 SHA-256 与字节数均和本机清单相符。JSON 为每个角色保留原骨名、父骨、默认局部 TRS、原始 FBX 预/后旋转与轴心属性、默认局部矩阵、观察到的 bind 局部旋转矩阵/平移/缩放和数据来源。没有导出网格、动画数组或贴图。

## 数值与静止姿态的含义

`defaultLocalTRS` 是 FBX Model 的 Lcl Translation / Rotation / Scaling；缺省值依次为零、零、单位缩放。Euler 角单位是度。它不是已经合并 PreRotation 的有效局部姿态。`rawFbx` 只列文件显式属性；`defaultLocalMatrixRows` 按 T × RotationOffset × RotationPivot × PreRotation × LclRotation × inverse(PostRotation) × inverse(RotationPivot) × ScalingOffset × ScalingPivot × S × inverse(ScalingPivot) 求得。各原始 RotationOrder / InheritType 保留；所有骨的默认缩放均为单位值。

`observedBindLocal` 使用 inverse(父骨 BindPose 世界矩阵) × 子骨 BindPose 世界矩阵，旋转表示为 3×3 行矩阵（列向量）；缩放是线性部分的列长度。与 Euler 局部旋转分开存储，避免把非零预旋转丢掉。原始 FBX Matrix 列序数组已转为行矩阵。BindPose 与默认姿态可能不同；第一份 bind 观察只用于描述，不能自动作为所有 mesh 共同的标准 rest。

17 个角色有部分终端骨缺 BindPose：这些骨通过完整默认局部变换接到已观察的 bind 父骨，JSON 的 source 明示回退。5 个文件存在同一节点多份不同 BindPose；JSON 保留冲突骨的全部世界矩阵。未对冲突强行选出“正确”绑定。`evaluatedDefaultVsBindMaxAbs` 是简单父子默认矩阵与第一份 bind 的最大分量差诊断；并非 Blender/FBX SDK 等价性证明，缩放继承补偿也未用 SDK 复核。

## Y Bot 基准

角色 ID `4f5d21e1-4ccc-41f1-b35b-fb2547bd8493`；SHA-256 `77ee683804e899d9c75ab924df6bc920958351acf3845dfca309e36205fc73cd`；65 根骨，52 根有直接 BindPose。默认世界髋高 0.997919388 m；观察 bind 髋高 0.997919388 m。无冲突 bind。以下树保留原骨名；完整数值见 JSON 对应角色。

```text
mixamorig:Hips
  mixamorig:Spine
    mixamorig:Spine1
      mixamorig:Spine2
        mixamorig:Neck
          mixamorig:Head
            mixamorig:HeadTop_End
        mixamorig:LeftShoulder
          mixamorig:LeftArm
            mixamorig:LeftForeArm
              mixamorig:LeftHand
                mixamorig:LeftHandThumb1
                  mixamorig:LeftHandThumb2
                    mixamorig:LeftHandThumb3
                      mixamorig:LeftHandThumb4
                mixamorig:LeftHandIndex1
                  mixamorig:LeftHandIndex2
                    mixamorig:LeftHandIndex3
                      mixamorig:LeftHandIndex4
                mixamorig:LeftHandMiddle1
                  mixamorig:LeftHandMiddle2
                    mixamorig:LeftHandMiddle3
                      mixamorig:LeftHandMiddle4
                mixamorig:LeftHandRing1
                  mixamorig:LeftHandRing2
                    mixamorig:LeftHandRing3
                      mixamorig:LeftHandRing4
                mixamorig:LeftHandPinky1
                  mixamorig:LeftHandPinky2
                    mixamorig:LeftHandPinky3
                      mixamorig:LeftHandPinky4
        mixamorig:RightShoulder
          mixamorig:RightArm
            mixamorig:RightForeArm
              mixamorig:RightHand
                mixamorig:RightHandThumb1
                  mixamorig:RightHandThumb2
                    mixamorig:RightHandThumb3
                      mixamorig:RightHandThumb4
                mixamorig:RightHandIndex1
                  mixamorig:RightHandIndex2
                    mixamorig:RightHandIndex3
                      mixamorig:RightHandIndex4
                mixamorig:RightHandMiddle1
                  mixamorig:RightHandMiddle2
                    mixamorig:RightHandMiddle3
                      mixamorig:RightHandMiddle4
                mixamorig:RightHandRing1
                  mixamorig:RightHandRing2
                    mixamorig:RightHandRing3
                      mixamorig:RightHandRing4
                mixamorig:RightHandPinky1
                  mixamorig:RightHandPinky2
                    mixamorig:RightHandPinky3
                      mixamorig:RightHandPinky4
  mixamorig:LeftUpLeg
    mixamorig:LeftLeg
      mixamorig:LeftFoot
        mixamorig:LeftToeBase
          mixamorig:LeftToe_End
  mixamorig:RightUpLeg
    mixamorig:RightLeg
      mixamorig:RightFoot
        mixamorig:RightToeBase
          mixamorig:RightToe_End
```

## 17 根标准骨逐项核对

标准集合：`Hips`, `Spine`, `Chest`, `Neck`, `Head`, `LeftUpperArm`, `LeftLowerArm`, `LeftHand`, `LeftUpperLeg`, `LeftLowerLeg`, `LeftFoot`, `RightUpperArm`, `RightLowerArm`, `RightHand`, `RightUpperLeg`, `RightLowerLeg`, `RightFoot`。

**规范化后 108/108 均齐全、无标准名碰撞，父子后代关系检查通过；缺失角色为零。** 改名保留 Shoulder、Spine1 等中间骨，不把非直接父子错误判成缺骨。

流程图表只写 `mixamorig:`。实际原始 FBX 中 81 个角色使用该前缀，另外 27 个使用 `mixamorig1:` 到 `mixamorig12:` 的编号命名空间。逐字执行原表会使这 27 个角色的全部 17 根必备骨失配；先剥离完整命名空间 `^mixamorig[0-9]*:`，再按表改 Spine2 / Arm / ForeArm / UpLeg / Leg 可全部通过。此次原始 FBX 中未发现无冒号的 Mixamo 骨名；有些加载器会消掉冒号，加载器产物另需验证。JSON 保留原名，不伪造为无冒号名字。

原表需前缀适配的 27 个角色：Romero、Louise、James、Mannequin、Megan、Crypto、Leonard、Racer、Doozy、Timmy、Adam、Jones、Brian、Joe、Dummy、Jackie、Elizabeth、Astra、Jennifer、Shannon、Jody、Martha、Zlorp、Suzie、David、Pete、Lewis。

## 轴、单位和髋高分布

108/108：UpAxis=1 / +1（+Y），CoordAxis=0 / +1（+X），FrontAxis=2 / +1（+Z），UnitScaleFactor=1，OriginalUnitScaleFactor=1。FBX 长度单位是厘米；转换成米为数值 × 0.01。不能把约 99.79 的 Y Bot 髋高当成 99.79 米。FrontAxis 元数据描述坐标约定，不足以独自证明皮肤视觉面朝 +Z。

默认姿态世界髋高（根 Hips、+Y 投影，不减地板）：min=0.100343 m，P25=0.955346，median=0.985824，P75=1.042381，max=9.675886 m；全部 >0。第一份 bind 同口径 min=0.100343、median=0.985824、max=9.675886 m。

最小 Medea By M. Arrebola ≈0.100343 m，最大 Dreyar By M.Aure ≈9.675886 m；Remy ≈2.091508 m。它们是实际源坐标，不擅自按“正常人身高”修数；入库时需确认预期尺寸。默认与 bind 髋高差超过 1 mm：Abe（default 0.917100 / bind 0.901557 m）、Racer（default 0.978239 / bind 0.966679 m）、Doozy（default 0.582634 / bind 0.586889 m）、Swat Guy（default 0.953460 / bind 0.939280 m）、Brady（default 1.106490 / bind 1.041140 m）。

## T-pose：请求、骨架筛查与验收分开

清单记录 108 次导出都请求 T-pose / animation:none。不能据此宣称所有角色已经几何验证为 T-pose。对观察 bind 关节位置作可复现的局部筛查：两侧 UpperArm→Hand 与水平 XZ 平面夹角 ≤10°，两肘折角 ≤10°，左右手位于 Chest 的 X 两侧；91 通过、17 未通过。只检查手臂，不证明腿、手指、掌心、肌肤或完整默认 rest 合规，也不把失败直接定为源模型缺陷。涉及 bind 冲突/异常的结果尤其需要 Blender 与人工复核。

未通过筛查：Remy、Louise、Ninja、Megan、Kate、Passive Marker Man、Olivia、Crypto、Alien Soldier、Timmy、Gas Mask、Jody、Maynard、Drake、Morak、Zlorp、Suzie。

两侧 Foot→ToeBase 的 +Z 分量也记录在 JSON；这是骨点方向信号，不是 mesh 面朝方向验收。没有执行逐角色视觉 T-pose、蒙皮或动画播放检查。

## 骨数、手指与眼骨变体

骨数分布：37 骨 × 1；43 骨 × 3；47 骨 × 1；49 骨 × 1；57 骨 × 2；59 骨 × 1；63 骨 × 1；64 骨 × 1；65 骨 × 57；66 骨 × 2；67 骨 × 9；68 骨 × 2；69 骨 × 8；70 骨 × 1；72 骨 × 3；73 骨 × 2；75 骨 × 1；76 骨 × 1；79 骨 × 1；81 骨 × 1；83 骨 × 1；86 骨 × 1；87 骨 × 1；88 骨 × 1；99 骨 × 3；112 骨 × 2。

“手指骨”按 Thumb / Index / Middle / Ring / Pinky 名称计数（包含末端）；“眼骨”按名称含 eye（忽略大小写）计数，具体名字在 JSON，可能包含眼部辅助骨。108 个角色均有手指骨，数量并不统一；眼骨并非必备。

|角色|骨数|手指骨|眼名匹配|命名空间|默认髋高 m|bind髋高 m|17骨|手臂筛查|bind缺骨 / 冲突骨|
|---|---:|---:|---:|---|---:|---:|---|---|---|
|X Bot|65|40|0|mixamorig:|1.042749|1.042749|全齐|通过|0 / 0|
|Warrok W Kurniawan|81|40|2|mixamorig:|0.968528|0.968528|全齐|通过|0 / 0|
|Mutant|37|12|0|mixamorig:|0.925549|0.925549|全齐|通过|0 / 0|
|Remy|67|40|2|mixamorig:|2.091508|2.091508|全齐|待复核|0 / 0|
|Vanguard By T. Choonyung|65|40|0|mixamorig:|1.061304|1.061304|全齐|通过|0 / 0|
|Ely By K.Atienza|67|40|2|mixamorig:,other|0.982553|0.982553|全齐|通过|0 / 0|
|Exo Gray|112|40|6|mixamorig:|0.963756|0.963756|全齐|通过|0 / 91|
|Erika Archer|67|40|2|mixamorig:|1.042259|1.042259|全齐|通过|0 / 67|
|Maria W/Prop J J Ong|65|40|0|mixamorig:|1.052463|1.052463|全齐|通过|0 / 52|
|The Boss|68|40|2|mixamorig:|0.963758|0.963758|全齐|通过|0 / 0|
|Maria J J Ong|65|40|0|mixamorig:|1.052463|1.052463|全齐|通过|0 / 0|
|Skeletonzombie T Avelange|73|40|0|mixamorig:|1.167377|1.167377|全齐|通过|0 / 0|
|Peasant Girl|69|40|2|mixamorig:|1.130321|1.130321|全齐|通过|0 / 0|
|Romero|65|40|0|mixamorig5:|1.051563|1.051563|全齐|通过|0 / 0|
|Louise|65|40|0|mixamorig8:|0.995459|0.995459|全齐|待复核|0 / 0|
|James|65|40|0|mixamorig9:|0.966308|0.966308|全齐|通过|0 / 0|
|Vampire A Lusth|99|40|2|mixamorig:,other|1.217542|1.217542|全齐|通过|0 / 0|
|Prisoner B Styperek|47|20|2|mixamorig:|1.087860|1.087860|全齐|通过|0 / 0|
|Amy|65|40|0|mixamorig:|0.697715|0.697715|全齐|通过|0 / 0|
|Abe|65|40|0|mixamorig:|0.917100|0.901557|全齐|通过|13 / 0|
|Mannequin|65|40|0|mixamorig1:|0.997540|0.997544|全齐|通过|13 / 0|
|Jolleen|65|40|0|mixamorig:|0.965441|0.965441|全齐|通过|0 / 0|
|Ninja|65|40|0|mixamorig:|0.934075|0.934075|全齐|待复核|13 / 0|
|Megan|65|40|0|mixamorig2:|1.000807|1.000807|全齐|待复核|0 / 0|
|Kate|65|40|0|mixamorig:|0.952298|0.952298|全齐|待复核|0 / 0|
|Mousey|57|32|0|mixamorig:|0.350699|0.350699|全齐|通过|11 / 0|
|Claire|87|40|0|mixamorig:|0.852304|0.852304|全齐|通过|0 / 0|
|Warzombie F Pedroso|72|40|2|mixamorig:|1.035534|1.035534|全齐|通过|0 / 0|
|Medea By M. Arrebola|69|40|2|mixamorig:|0.100343|0.100343|全齐|通过|0 / 0|
|Maw J Laygo|64|32|0|mixamorig:|0.974029|0.974029|全齐|通过|0 / 0|
|Passive Marker Man|65|40|0|mixamorig:|0.963756|0.963756|全齐|待复核|0 / 0|
|Aj|83|40|0|mixamorig:|0.832392|0.832392|全齐|通过|1 / 0|
|Erika Archer With Bow/Arrow|70|40|2|mixamorig:|1.042259|1.042259|全齐|通过|0 / 70|
|Kaya|88|40|0|mixamorig:|0.713983|0.713983|全齐|通过|0 / 0|
|Peasant Man|43|16|2|mixamorig:|0.888927|0.888927|全齐|通过|0 / 0|
|Paladin J Nordstrom|67|40|2|mixamorig:|0.955795|0.955795|全齐|通过|0 / 54|
|Demon T Wiezzorek|79|40|2|mixamorig:|1.233766|1.233766|全齐|通过|0 / 0|
|Eve By J.Gonzales|65|40|0|mixamorig:|0.810629|0.810629|全齐|通过|0 / 0|
|Pumpkinhulk L Shaw|66|40|1|mixamorig:|1.012930|1.012930|全齐|通过|0 / 0|
|Olivia|65|40|0|mixamorig:|0.942471|0.942471|全齐|待复核|13 / 0|
|Crypto|65|40|0|mixamorig1:|0.988801|0.988801|全齐|待复核|0 / 0|
|Alien Soldier|65|40|0|mixamorig:|1.032666|1.032666|全齐|待复核|0 / 0|
|Leonard|65|40|0|mixamorig9:|0.957042|0.957042|全齐|通过|0 / 0|
|Racer|65|40|0|mixamorig6:|0.978239|0.966679|全齐|通过|13 / 0|
|Doozy|57|32|0|mixamorig1:|0.582634|0.586889|全齐|通过|11 / 0|
|Swat Guy|65|40|0|mixamorig:|0.953460|0.939280|全齐|通过|0 / 0|
|Lola B Styperek|67|40|2|mixamorig:|1.145188|1.145188|全齐|通过|0 / 0|
|Akai E Espiritu|65|40|0|mixamorig:|1.125590|1.125590|全齐|通过|0 / 0|
|Girlscout T Masuyama|67|40|2|mixamorig:,other|1.022630|1.022630|全齐|通过|0 / 0|
|Whiteclown N Hallin|67|40|2|mixamorig:|1.144705|1.144705|全齐|通过|0 / 0|
|Uriel A Plotexia|72|40|2|mixamorig:|1.095356|1.095356|全齐|通过|0 / 0|
|Sporty Granny|99|40|0|mixamorig:|0.871622|0.871622|全齐|通过|2 / 0|
|Survivor A Lusth|69|40|2|mixamorig:|1.100729|1.100729|全齐|通过|0 / 0|
|Y Bot|65|40|0|mixamorig:|0.997919|0.997919|全齐|通过|13 / 0|
|Castle Guard 01|43|16|2|mixamorig:|1.000291|1.000291|全齐|通过|0 / 0|
|Heraklios By A. Dizon|65|40|0|mixamorig:|0.990004|0.990004|全齐|通过|0 / 0|
|Timmy|65|40|0|mixamorig6:,other|0.640306|0.640306|全齐|待复核|0 / 0|
|Adam|65|40|0|mixamorig7:|0.977503|0.977503|全齐|通过|0 / 0|
|Jones|65|40|0|mixamorig10:|1.022340|1.022340|全齐|通过|0 / 0|
|Michelle|65|40|0|mixamorig:|1.026253|1.026253|全齐|通过|13 / 0|
|Sophie|65|40|0|mixamorig:|0.982848|0.982848|全齐|通过|0 / 0|
|Brian|65|40|0|mixamorig12:|0.991631|0.991631|全齐|通过|0 / 0|
|Bryce|65|40|0|mixamorig:|0.963706|0.963706|全齐|通过|0 / 0|
|Brady|65|40|0|mixamorig:|1.106490|1.041140|全齐|通过|0 / 0|
|Gas Mask|65|40|0|mixamorig:|1.009327|1.009327|全齐|待复核|0 / 0|
|Joe|65|40|0|mixamorig7:|0.995695|0.995695|全齐|通过|0 / 0|
|Dummy|65|40|0|mixamorig8:|0.953999|0.953999|全齐|通过|13 / 0|
|Jackie|65|40|0|mixamorig1:|0.966539|0.966539|全齐|通过|13 / 0|
|Elizabeth|65|40|0|mixamorig1:|0.999684|0.999684|全齐|通过|0 / 0|
|Josh|65|40|0|mixamorig:|1.008953|1.008953|全齐|通过|0 / 0|
|Chad|65|40|0|mixamorig:|0.947094|0.947094|全齐|通过|0 / 0|
|Parasite L Starkie|69|40|2|mixamorig:|1.130908|1.130908|全齐|通过|0 / 0|
|Zombiegirl W Kurniawan|63|36|2|mixamorig:|1.075855|1.075855|全齐|通过|0 / 0|
|Mremireh O Desbiens|59|32|2|mixamorig:|1.032553|1.032553|全齐|通过|0 / 0|
|Exo Red|112|40|6|mixamorig:|0.963756|0.963756|全齐|通过|0 / 0|
|Dreyar By M.Aure|67|40|2|mixamorig:|9.675886|9.675886|全齐|通过|0 / 0|
|Nightshade J Friedrich|68|40|0|mixamorig:|1.241459|1.241459|全齐|通过|0 / 0|
|Kachujin G Rosales|75|40|2|mixamorig:|1.140494|1.140494|全齐|通过|0 / 0|
|Goblin D Shareyko|69|40|0|mixamorig:|1.003997|1.003997|全齐|通过|0 / 0|
|Swat|69|40|2|mixamorig:|0.963687|0.963687|全齐|通过|13 / 0|
|Ganfaul M Aure|99|40|2|mixamorig:,other|1.201439|1.201439|全齐|通过|0 / 0|
|Big Vegas|86|40|0|mixamorig:|0.962267|0.962267|全齐|通过|0 / 0|
|Astra|65|40|0|mixamorig1:|0.929340|0.929340|全齐|通过|0 / 0|
|Jennifer|65|40|0|mixamorig1:|1.025488|1.025488|全齐|通过|0 / 0|
|Shannon|65|40|0|mixamorig5:|0.928172|0.928172|全齐|通过|0 / 0|
|Jody|65|40|0|mixamorig6:|0.938281|0.938281|全齐|待复核|0 / 0|
|Maynard|65|40|0|mixamorig:|0.989627|0.989627|全齐|待复核|13 / 0|
|Martha|65|40|0|mixamorig11:|0.977588|0.977588|全齐|通过|0 / 0|
|Drake|65|40|0|mixamorig:|0.971464|0.971464|全齐|待复核|13 / 0|
|Alex|65|40|0|mixamorig:|0.937662|0.937662|全齐|通过|13 / 0|
|Roth|65|40|0|mixamorig:|0.989868|0.989868|全齐|通过|0 / 0|
|Castle Guard 02|43|16|2|mixamorig:|1.000291|1.000291|全齐|通过|0 / 0|
|Yaku J Ignite|65|40|0|mixamorig:|1.102649|1.102649|全齐|通过|0 / 0|
|Pirate By P. Konstantinov|76|40|0|mixamorig:|0.371283|0.371283|全齐|通过|0 / 0|
|Copzombie L Actisdato|67|40|2|mixamorig:|1.070640|1.070640|全齐|通过|0 / 0|
|Brute|72|40|2|mixamorig:|1.218620|1.218620|全齐|通过|0 / 0|
|Arissa|73|40|0|mixamorig:|0.963794|0.963794|全齐|通过|0 / 0|
|Paladin W/Prop J Nordstrom|69|40|2|mixamorig:|0.955795|0.955795|全齐|通过|0 / 0|
|Morak|65|40|0|mixamorig:|0.980496|0.980496|全齐|待复核|0 / 0|
|Zlorp|49|24|0|mixamorig1:|1.040238|1.040238|全齐|待复核|0 / 0|
|Steve|65|40|0|mixamorig:|0.971409|0.971409|全齐|通过|0 / 0|
|Ortiz|65|40|0|mixamorig:|0.776271|0.776271|全齐|通过|0 / 0|
|Suzie|65|40|0|mixamorig4:|0.964366|0.964366|全齐|待复核|0 / 0|
|David|65|40|0|mixamorig10:|0.960553|0.960553|全齐|通过|0 / 0|
|Pete|65|40|0|mixamorig1:|0.947510|0.947510|全齐|通过|0 / 0|
|Lewis|65|40|0|mixamorig4:|0.976537|0.976537|全齐|通过|0 / 0|
|Ty|69|40|0|mixamorig:|0.846522|0.846522|全齐|通过|0 / 0|
|Knight D Pelegrini|66|40|1|mixamorig:|1.187161|1.187161|全齐|通过|0 / 0|

## 标准化骨名集合差异（相对于 Y Bot）

每组对应完全相同的标准化骨名集合；父子与数值仍须读各角色独立记录。

1. X Bot、Vanguard By T. Choonyung、Maria W/Prop J J Ong、Maria J J Ong、Romero、Louise、James、Amy、Abe、Mannequin、Jolleen、Ninja、Megan、Kate、Passive Marker Man、Eve By J.Gonzales、Olivia、Crypto、Alien Soldier、Leonard、Racer、Swat Guy、Akai E Espiritu、Y Bot、Heraklios By A. Dizon、Timmy、Adam、Jones、Michelle、Sophie、Brian、Bryce、Brady、Gas Mask、Joe、Dummy、Jackie、Elizabeth、Josh、Chad、Astra、Jennifer、Shannon、Jody、Maynard、Martha、Drake、Alex、Roth、Yaku J Ignite、Morak、Steve、Ortiz、Suzie、David、Pete、Lewis（65 骨）
   新增：无；缺少 Y Bot 额外骨：无。
2. Warrok W Kurniawan（81 骨）
   新增：BackCloth1、BackCloth2、BackCloth3、BackCloth4、FrontCloth1、FrontCloth2、FrontCloth3、FrontCloth4、Jaw、LeftEye、RightArmour1、RightArmour2、RightArmour3、RightArmour4、RightArmour5、RightEye；缺少 Y Bot 额外骨：无。
3. Mutant（37 骨）
   新增：无；缺少 Y Bot 额外骨：LeftHandIndex1、LeftHandIndex2、LeftHandIndex3、LeftHandIndex4、LeftHandMiddle1、LeftHandMiddle2、LeftHandMiddle3、LeftHandMiddle4、LeftHandPinky1、LeftHandPinky2、LeftHandPinky3、LeftHandPinky4、LeftHandRing1、LeftHandRing2、LeftHandRing3、LeftHandRing4、LeftHandThumb1、LeftHandThumb2、LeftHandThumb3、LeftHandThumb4、RightHandMiddle1、RightHandMiddle2、RightHandMiddle3、RightHandMiddle4、RightHandRing1、RightHandRing2、RightHandRing3、RightHandRing4。
4. Remy、Ely By K.Atienza、Erika Archer、Paladin J Nordstrom、Lola B Styperek、Girlscout T Masuyama、Whiteclown N Hallin、Dreyar By M.Aure、Copzombie L Actisdato（67 骨）
   新增：LeftEye、RightEye；缺少 Y Bot 额外骨：无。
5. Exo Gray、Exo Red（112 骨）
   新增：Chin、Jaw、L_CheekFold、L_Ear、L_Eye、L_EyelidLower、L_EyelidUpper、L_IOuterBrow、L_InnerBrow、L_InnerCheek、L_LipCorner、L_LipCornerLowTweak、L_LipCornerUpTweak、L_LipLower、L_LipUpper、L_LowerCheek、L_MidBrow、L_Nostril、L_OuterCheek、L_Temple、LipMidLower、LipMidUpper、LowerChin、MidBrows、R_CheekFold、R_Ear、R_Eye、R_EyelidLower、R_EyelidUpper、R_IOuterBrow、R_InnerBrow、R_InnerCheek、R_LipLower、R_LipUpper、R_LowerCheek、R_MidBrow、R_OuterCheek、R_Temple、R_gLipCorner、R_gLipCornerLowTweak、R_gLipCornerUpTweak、RightNostril、Scalp、Throat、TongueBack、TongueMid、TongueTip；缺少 Y Bot 额外骨：无。
6. The Boss（68 骨）
   新增：LeftEye、Neck1、RightEye；缺少 Y Bot 额外骨：无。
7. Skeletonzombie T Avelange（73 骨）
   新增：BackCloth1、BackCloth2、BackCloth3、BackCloth4、FrontCloth1、FrontCloth2、FrontCloth3、FrontCloth4；缺少 Y Bot 额外骨：无。
8. Peasant Girl（69 骨）
   新增：LeftEye、LeftRibbon1、LeftRibbon2、RightEye；缺少 Y Bot 额外骨：无。
9. Vampire A Lusth（99 骨）
   新增：F_skirt1、F_skirt2、F_skirt3、F_skirt4、L_A_skirt1、L_A_skirt2、L_A_skirt3、L_A_skirt4、L_B_skirt1、L_B_skirt2、L_B_skirt3、L_B_skirt4、L_C_skirt1、L_C_skirt2、L_C_skirt3、L_C_skirt4、L_horn1、L_horn2、LeftEye、R_A_skirt1、R_A_skirt2、R_A_skirt3、R_A_skirt4、R_B_skirt1、R_B_skirt2、R_B_skirt3、R_B_skirt4、R_C_skirt1、R_C_skirt2、R_C_skirt3、R_C_skirt4、R_horn1、R_horn2、RightEye；缺少 Y Bot 额外骨：无。
10. Prisoner B Styperek（47 骨）
   新增：LeftEye、RightEye；缺少 Y Bot 额外骨：RightHandIndex1、RightHandIndex2、RightHandIndex3、RightHandIndex4、RightHandMiddle1、RightHandMiddle2、RightHandMiddle3、RightHandMiddle4、RightHandPinky1、RightHandPinky2、RightHandPinky3、RightHandPinky4、RightHandRing1、RightHandRing2、RightHandRing3、RightHandRing4、RightHandThumb1、RightHandThumb2、RightHandThumb3、RightHandThumb4。
11. Mousey、Doozy（57 骨）
   新增：无；缺少 Y Bot 额外骨：LeftHandPinky1、LeftHandPinky2、LeftHandPinky3、LeftHandPinky4、RightHandPinky1、RightHandPinky2、RightHandPinky3、RightHandPinky4。
12. Claire（87 骨）
   新增：Belly、Bow_Left、Bow_Right、HairA、HairB、HairC、HairC1、LeftUpArmTwist、LeftWristTwist、Left_Breast、Ponytail、Ponytail1、Ponytail2、RightUpArmTwist、RightWristTwist、Right_Breast、SkirtA、SkirtA1、SkirtB、SkirtB1、SkirtC、SkirtC1；缺少 Y Bot 额外骨：无。
13. Warzombie F Pedroso（72 骨）
   新增：BackRope1、BackRope2、BackRope3、FrontRope1、FrontRope2、LeftEye、RightEye；缺少 Y Bot 额外骨：无。
14. Medea By M. Arrebola（69 骨）
   新增：LeftEye、RightEye、Sleeve1、Sleeve2；缺少 Y Bot 额外骨：无。
15. Maw J Laygo（64 骨）
   新增：RightChain1、RightChain2、RightChain3、RightRope1、RightRope2、RightRope3、RightRope4；缺少 Y Bot 额外骨：LeftHandPinky1、LeftHandPinky2、LeftHandPinky3、LeftHandPinky4、RightHandPinky1、RightHandPinky2、RightHandPinky3、RightHandPinky4。
16. Aj（83 骨）
   新增：Backpack、HairA、HairB、Hat、Hood、Hood1、LBackpack_Strap、LFootTongue、LHoodieString、LHoodieString1、LHoodieString2、LSleeve、RBackpack_Strap、RFootTongue、RHoodieString、RHoodieString1、RHoodieString2、RSleeve；缺少 Y Bot 额外骨：无。
17. Erika Archer With Bow/Arrow（70 骨）
   新增：LeftEye、Left_arch1、Left_arch2、RightEye、arrow；缺少 Y Bot 额外骨：无。
18. Kaya（88 骨）
   新增：Bag、BindLeftJacketString1、BindLeftJacketString2、BindRightJacketString1、BindRightJacketString2、HairE1、HairE2、HairF1、HairF2、HairG1、HairG2、Hat、LeftHairA1、LeftHairA2、LeftHairC1、LeftHairC2、Left_Sleeve、Pouch、RightHairA1、RightHairA2、RightHairC1、RightHairC2、Right_Sleeve；缺少 Y Bot 额外骨：无。
19. Peasant Man（43 骨）
   新增：LeftEye、RightEye；缺少 Y Bot 额外骨：LeftHandMiddle1、LeftHandMiddle2、LeftHandMiddle3、LeftHandMiddle4、LeftHandPinky1、LeftHandPinky2、LeftHandPinky3、LeftHandPinky4、LeftHandRing1、LeftHandRing2、LeftHandRing3、LeftHandRing4、RightHandMiddle1、RightHandMiddle2、RightHandMiddle3、RightHandMiddle4、RightHandPinky1、RightHandPinky2、RightHandPinky3、RightHandPinky4、RightHandRing1、RightHandRing2、RightHandRing3、RightHandRing4。
20. Demon T Wiezzorek（79 骨）
   新增：F_skirt1、F_skirt2、F_skirt3、F_skirt4、F_skirt5、F_skirt6、LeftEye、M_skirt1、M_skirt2、M_skirt3、M_skirt4、M_skirt5、M_skirt6、RightEye；缺少 Y Bot 额外骨：无。
21. Pumpkinhulk L Shaw、Knight D Pelegrini（66 骨）
   新增：RightEye；缺少 Y Bot 额外骨：无。
22. Uriel A Plotexia（72 骨）
   新增：LeftEye、RightEye、Skirt1、Skirt2、Skirt3、Skirt4、Skirt5；缺少 Y Bot 额外骨：无。
23. Sporty Granny（99 骨）
   新增：Belly1、HairLeftA1、HairLeftB1、HairLeftC1、HairLeftD1、HairLeftE1、HairLeftF1、HairMidA1、HairMidB1、HairMidC1、HairMidD1、HairMidE1、HairMidF1、HairRightA1、HairRightB1、HairRightC1、HairRightD1、HairRightE1、HairRightF1、Hood0、Hood1、Hood2、Left_Breast1、Left_Butt1、Left_ShortSleeve、Left_Sleeve、Right_Breast1、Right_Butt1、Right_ShortSleeve、Right_Sleeve、Visor1、Whistle0、Whistle1、Whistle2；缺少 Y Bot 额外骨：无。
24. Survivor A Lusth（69 骨）
   新增：LeftEye、RightEye、RightHair1、RightHair2；缺少 Y Bot 额外骨：无。
25. Castle Guard 01、Castle Guard 02（43 骨）
   新增：Leye、Reye；缺少 Y Bot 额外骨：LeftHandMiddle1、LeftHandMiddle2、LeftHandMiddle3、LeftHandMiddle4、LeftHandPinky1、LeftHandPinky2、LeftHandPinky3、LeftHandPinky4、LeftHandRing1、LeftHandRing2、LeftHandRing3、LeftHandRing4、RightHandMiddle1、RightHandMiddle2、RightHandMiddle3、RightHandMiddle4、RightHandPinky1、RightHandPinky2、RightHandPinky3、RightHandPinky4、RightHandRing1、RightHandRing2、RightHandRing3、RightHandRing4。
26. Parasite L Starkie（69 骨）
   新增：JawDowm、JawUp、LeftEye、RightEye；缺少 Y Bot 额外骨：无。
27. Zombiegirl W Kurniawan（63 骨）
   新增：LeftEye、RightEye；缺少 Y Bot 额外骨：RightHandMiddle1、RightHandMiddle2、RightHandMiddle3、RightHandMiddle4。
28. Mremireh O Desbiens（59 骨）
   新增：LeftEye、RightEye；缺少 Y Bot 额外骨：LeftHandIndex4、LeftHandMiddle4、LeftHandPinky4、LeftHandRing4、RightHandIndex4、RightHandMiddle4、RightHandPinky4、RightHandRing4。
29. Nightshade J Friedrich（68 骨）
   新增：Ribbon1、Ribbon2、Ribbon3；缺少 Y Bot 额外骨：无。
30. Kachujin G Rosales（75 骨）
   新增：Bow1、Bow2、Bow3、Bow4、Bow5、Bow6、Bow7、Bow8、Leye、Reye；缺少 Y Bot 额外骨：无。
31. Goblin D Shareyko（69 骨）
   新增：Crotch1、Crotch2、Crotch3、Crotch4；缺少 Y Bot 额外骨：无。
32. Swat（69 骨）
   新增：Jaw、LeftEye、Neck1、RightEye；缺少 Y Bot 额外骨：无。
33. Ganfaul M Aure（99 骨）
   新增：F_skirt1、F_skirt2、F_skirt3、F_skirt_end、L_A_skirt1、L_A_skirt2、L_A_skirt3、L_A_skirt_end、L_B_skirt1、L_B_skirt2、L_B_skirt3、L_B_skirt_end、L_C_skirt1、L_C_skirt2、L_C_skirt3、L_C_skirt_end、L_horn1、L_horn_end、LeftEye、R_A_skirt1、R_A_skirt2、R_A_skirt3、R_A_skirt_end、R_B_skirt1、R_B_skirt2、R_B_skirt3、R_B_skirt_end、R_C_skirt1、R_C_skirt2、R_C_skirt3、R_C_skirt_end、R_bag1、R_bag_end、RightEye；缺少 Y Bot 额外骨：无。
34. Big Vegas（86 骨）
   新增：Belly、Hair_Back、HeadTop_End1、Left_CapeA、Left_CapeA1、Left_CapeB、Left_CapeB1、Left_CapeC、Left_CapeC1、Left_Collar、Left_Collar1、Left_Peck、Right_CapeA、Right_CapeA1、Right_CapeB、Right_CapeB1、Right_CapeC、Right_CapeC1、Right_Collar、Right_Collar1、Right_Peck；缺少 Y Bot 额外骨：无。
35. Pirate By P. Konstantinov（76 骨）
   新增：Cloak1、Cloak2、Cloak3、Cloak_End、Hair1、Hair2、Hair3、Hair4、Hair5、Hair6、Hair_End；缺少 Y Bot 额外骨：无。
36. Brute（72 骨）
   新增：Hair1、Hair2、Hair3、Hair4、LeftEye、RightEye、Weapon；缺少 Y Bot 额外骨：无。
37. Arissa（73 骨）
   新增：Cloak1、Cloak2、Cloak3、Cloak4、Cloak5、Cloak6、Cloak7、Neck1；缺少 Y Bot 额外骨：无。
38. Paladin W/Prop J Nordstrom（69 骨）
   新增：LeftEye、RightEye、Shield_joint、Sword_joint；缺少 Y Bot 额外骨：无。
39. Zlorp（49 骨）
   新增：无；缺少 Y Bot 额外骨：LeftHandPinky1、LeftHandPinky2、LeftHandPinky3、LeftHandPinky4、LeftHandRing1、LeftHandRing2、LeftHandRing3、LeftHandRing4、RightHandPinky1、RightHandPinky2、RightHandPinky3、RightHandPinky4、RightHandRing1、RightHandRing2、RightHandRing3、RightHandRing4。
40. Ty（69 骨）
   新增：Scart1、Scart2、Scart3、Scart4；缺少 Y Bot 额外骨：无。

## 验证证据与限制

- 原始清单 SHA-256：`511a52174cbf7a11156593f7499d89ff868253b204ae8f193b4cc84db7b4b728`。
- JSON SHA-256：`42a1b17e7fdbd1ba7141a757d90c3d8d4c20fb919f8898e8e45c2c9185fe3622`。
- 只读临时分析脚本 SHA-256：`6de0533f7d7f89573b7b01ad35101839f14b011af09ceae714a7cbe327a4dc1d`；脚本仅位于 `/tmp/apollo_skeleton_analysis.py`，未入仓。
- 二进制 FBX 头、节点结束偏移、属性字节长度、108 文件哈希/大小、骨名唯一性、父骨存在、无层级环、单根 Hips、全部17必备骨、预期后代关系、矩阵数值有限、旋转正交性与正缩放均通过。
- 未安装或调用软件、未加载网络或贴图、未修改本地素材/清单。输出只含骨架定义及数值与来源记录。
- 数据抽取无需撤修验红；没有修改生产工具或引擎。真实 Blender 导入/转换、完整 rest 与 BindPose 对齐、视觉 T-pose 与蒙皮质量、真实动作重定向仍未验。本文件不替 M1/M2/M3 签验收。
