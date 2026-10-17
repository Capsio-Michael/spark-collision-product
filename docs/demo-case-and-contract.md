# 冻结案例与最小联调接口 v0.1-demo

状态：2026-10-17 上海 Hackathon 联调用合成案例与接口约定。用户侧定义，供一鸣前端执行。**案例、结果和下述规则均为合成演示，不是客户事实或真实 AI 能力声明。**

## 唯一主案例：跨区报价的确认边界

一个项目“报价授权边界调研”，每个文件明确代表一场独立讨论，文件名 M1–M4 即场次标识。本次仅一场一份材料；日后多份材料同场须显式传 `meeting_id`，不可按文件数自动推断。

| 场次 | 讨论贡献 | 核心智慧点关系 |
| --- | --- | --- |
| M1 客服访谈 | 标准问题可以自动回复；报价需要人工确认 | 提出报价风险边界 |
| M2 销售访谈 | 跨区报价要销售确认；审批等待尚未统计 | 跨场支持并提出低频关键约束 |
| M3 运营讨论 | 无折扣目录价可直接发送；跨区/折扣仍需确认 | 增加适用条件，修正“所有报价均人工确认” |
| M4 项目复盘 | 重申目录价/跨区边界；认可继续验证但未批准上线 | 增加覆盖，不产生新火花，也不产生已批准行动 |

原文见 `examples/pricing-boundary/M1.md` 至 `M4.md`。不允许改写引文。初始导入 M1+M2，产生版本 1；再导入 M3，版本 2 展示条件变化；最后导入 M4，版本 3 为 `no_new_insight`，但讨论覆盖从 3 场变为 4 场，旧版可查。

## 预期展示

主智慧点“报价的确认边界”：版本 1 的暂定判断为“已讨论的报价均提到人工确认，适用范围待核实”；版本 2 起区分“无折扣目录价可直接发送”与“跨区或折扣报价需人工确认”。M1/M2/M3 的原话及 M4 的重复印证都可逐条点开。重要性分数按定义阶段的**演示规则**计算：有实质证据的不同场次最多 3 分；至少两位独立发言者 1 分；有原话证明影响业务取舍 1 分。因此 v1 为 4/5（2+1+1），v2 为 5/5（3+1+1），v3 仍为 5/5（封顶），但覆盖变成 4/4。分数是优先阅读提示，不是发生概率或多数票。

趋同单独标识：v1 为“条件待核实”，v2/v3 为“有条件趋同”，并同时展示目录价与跨区/折扣分支。不能用 v3 的重复认可把 v2 的认知变化再算一次。单次出现的“审批等待尚未统计”列为“需关注、待验证”，不因低频消失。M4 的“继续验证”属于观点，不是上线批准。

## 冻结的最小接口

沿用一鸣 [接口契约 v0.1](https://github.com/Capsio-Michael/spark-collision-product/blob/work/interaction-ux/docs/api-contract.md) 的 JSON 包装、`/api/v1`、`Idempotency-Key`、本机 CORS 与所有已列路由。首轮联调必须走通：

1. `GET /health`、`GET/POST /projects`。
2. `POST/GET /projects/{id}/records`、`GET /projects/{id}/records/{record_id}`；原文按段切分并返回稳定 `segment_id`。
3. `POST /projects/{id}/analyses`、`GET /projects/{id}/jobs/{job_id}`；得到明确 `mock` 快照，失败不覆盖旧版。
4. `GET /projects/{id}/overview[?version=N]`、`GET /projects/{id}/insights/{insight_id}[?version=N]`、`GET /projects/{id}/versions`。
5. `GET /projects/{id}/export?format=markdown&version=N`；导出含可读原话与场次、分数、条件、历史。纠错 `POST /corrections` 在首轮可明确返回“尚未实现”错误，不可伪装保存成功。

本案例中客户端为每份材料显式填写一个稳定 `meeting_id`（M1–M4）；一鸣现有导入表单尚未传此字段，需要更新。为了允许旧前端立即联调，服务可对缺字段的单份材料建立独立场次，**但此兼容路径只能用于本次一份材料一场的合成案例**，不能宣称支持同场多文件。新字段经双方确认后加入请求和草稿。

总览与详情在 v0.1 基础上增加可选 `meeting_coverage`：`distinct_meeting_count`、`total_meeting_count`、`meeting_ids`；以及 `importance`：`rule_version`、`score`、`parts`、`raw_counts`；`convergence_status` 和 `annotations`（`meeting_id`、`evidence_id`、`relation`、`condition`）。当前前端仍可能忽略这些可选字段；一鸣按此文档展示后再冻结正式字段名。`spark` 来源路径只表示认知碰撞，**不能代替主题出现频次**。

## 交接验收

一鸣前端用同一套 M1–M4 合成材料替换现有不一致的故事；首页分别显示重要性与趋同，详情按场次展开标注并点回原文，历史保留 v1/v2/v3，M4 显示无新火花。服务端返回 `engine_mode=mock` 时界面明确标“模拟引擎结果”。只有未来接入真实模型且端到端验证后，才可改为 `live`。
