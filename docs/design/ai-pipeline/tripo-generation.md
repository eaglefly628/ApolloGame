# Tripo 单图 / 四视图生成（T3）

继续使用现有`ai-gen.mjs`和M2.5待审门；不自动登记、不自动approve。文本生成保留原V2路线，新增图片路线使用官方V3，固定几何模型`v3.1-20260211`。

```sh
node scripts/ai-gen.mjs tripo "brass kettle asset description" --ref keyart/kettle.png --mock
node scripts/ai-gen.mjs tripo "T-pose character description" --mode multiview_to_model --front front.png --left left.png --back back.png --right right.png --mock
node scripts/ai-gen.mjs tripo "whole-model variant" --edit keyart/kettle.png --mock
```

提示词放在`--ref`之前。`--game`、`--id`、`--json`沿用原工具。真实调用的key仅从`TRIPO_API_KEY`环境变量取得；没有key或显式`--mock`均走模拟，缺视图等无效输入仍先拒收。CLI的JSON报告保留原ai-gen日志行为，取末行JSON。

输入只接受本地PNG，每张不超过20MiB；读取为不可变字节快照，SHA256与上传消费同一份字节。支持`--mode text_to_model|image_to_model|multiview_to_model`；不指定时按有无单图/命名视图推导。`--ref`单张走image，多个未命名ref拒收，不能猜前后左右。四视图必须各一张，不接受未知/重复/缺失标签，也不与ref/edit混用；无key和mock同样检查。

规范顺序为**front、left、back、right**，请求使用命名view-key以免错序。官方API容许少于四张，本仓按路线图要求更严格。视图应是同一物体、一致光照；人物四视图用T-Pose。工具不能自动证明视图的造型质量，需要独立看图确认。

`--edit`不表示局部改网格：当前新增接口不提供局部编辑，明确降级整体image_to_model，并在溯源标记`whole_model_regeneration`，由人选优。图片模式的文字prompt只作资产说明与溯源，不发送给provider，不声称它参与几何生成。

真实流程：PNG快照上传到V3文件接口，提交单图/命名多视图生成任务，轮询具名状态，下载自包含GLB。下载请求不附API key；HTTP/业务错误、缺token/taskId、失败或未知终态、超时、非GLB均明确失败，不落假成功资产。暂存token和临时下载URL不进入provenance。

mock不访问网络，产出带mesh的合法GLB；不同输入改变mock字节，同输入可复跑。mock结果带`mock:true`和mock模型名，不伪造真实taskId，也不代表真实Tripo服务、模型质量或商用授权已经核证。owner 2026-10-18授权无API时先用显式mock/离线方法继续推进；真实服务验证另记，不能把mock说成真调。

`provenance.references`保存path/role/sha256，命名视图另保存view；`provenance.generation`保存operation/apiVersion/modelVersion/parameters及真实taskId（mock不造）。这两层贯通generate→writePending→buildEntry；唯一登记门仍是人审。字段真相见`docs/design/m2.5-registration-contract.md`。

协议以[官方文件上传](https://developers.tripo3d.ai/en/docs/files)、[单图生成](https://developers.tripo3d.ai/en/docs/generation-image-to-model/standard)、[多视图生成](https://developers.tripo3d.ai/en/docs/generation-multiview-to-model/standard)、[任务查询](https://developers.tripo3d.ai/en/docs/task-query)为准。常规门禁使用fetch替身覆盖真实协议，不发送付费请求；凭据或已生成样本就绪后再补真实服务验收。
