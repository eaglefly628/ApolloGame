# E1 本地压缩模型加载契约

复用three.js原生GLTFLoader，ModelPool增量接DRACOLoader、MeshoptDecoder、KTX2Loader；不重写压缩算法、不改sim或游戏逻辑。未压缩GLB及既有ModelPool(assets?)调用保持兼容；ThreeRenderer把实际WebGLRenderer传给ModelPool供KTX2检测GPU支持。

当前依赖three r184，解码器随项目分发：`public/__vendor/three-r184/draco/`中的glTF Draco WASM/wrapper/JS fallback，以及`public/__vendor/three-r184/basis/`的Basis transcoder WASM/wrapper；meshopt由已安装three模块本地打包。路径使用构建BASE_URL，不硬编码CDN；不使用远程运行时代码或API key。版本/哈希/原始许可记录随vendor目录保存。

ModelPool按需创建加载器、只在模型需要时启动解码器，资源释放时dispose Draco/KTX2 worker；异步parse在dispose后完成不能把模型缓存复活。失败应具名console诊断且不逐帧重复刷屏，未压缩模型仍可加载。无WebGLRenderer的原有无模型/无纹理调用继续安全；KTX2缺少GPU能力检测时明确失败，不伪造成功。

验收使用离线小夹具分别覆盖uncompressed / Draco / meshopt / KTX2：真实浏览器加载并比较几何/画面，网路记录确保解码器全从本地路径且build分发包含文件。普通无key/无网络单测用替身验证接线、失败/释放与旧行为；真实解码另跑独立浏览器integration，不能以mock代替实际压缩文件读回。固定浏览器/同环境记录像素比较容差，不以主观差异阈值签任何人门。

源码边界固定three r184：Draco初始化/worker私有接缝仅为阻止dispose后异步复活；版本升级须同步vendor并跑完整真实回归。KTX2纹理失败不得被GLTFLoader吞为缺贴图模型成功；每个parser独立跟踪资源，A失败不影响并发B。嵌入图片Blob URL由每parser的资源scope明确拥有，成功/失败/取消均回收，不依赖Three只在成功时revoke的路径，不修改全局URL实现。

测试夹具是本仓自产立方体和四色PNG，经固定官方开源编码器离线压缩，来源/哈希及生成方式在`scripts/fixtures/compressed-models/provenance.json`和`generate.mjs`；测试运行本身不下载工具。极小测试文件的编码容器开销不代表实际模型压缩率，E1只验证兼容与显示，不声称所有资产压缩后必定更小。
