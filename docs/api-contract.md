# 智慧火花碰撞 · 前端与引擎接口契约 v0.1

日期：2026-10-17（Asia/Shanghai）

状态：**交互方已采用 v0.1 作为开发基准；引擎方对接确认待完成；不是已实现接口。**
分工来源：当前协作用户明确“伙伴负责引擎，自己负责交互及接口文档”。本文用“交互方”“引擎方”称呼，避免历史文档中的“用户／同事”相对身份混淆。

## 1. 如何评审这份文档

先看第 2 节分工、第 4 节调用流程、第 5 节接口表，再按 [接口确认清单](api-review-checklist.md) 逐项填写决定。第 6–9 节是字段、接口与异常规则，供双方实现时查阅。

本文给出一套完整的**建议默认值**，让双方可以讨论同一个具体方案。除用户已明确的职责、仓库产品边界外，路径、字段、限额、部署和超时均待双方确认。后端内部语言、模型和数据库由引擎方选择，只需满足对外契约。

当前进展：用户已明确交互开发按本文规则推进，不再逐项阻塞前端开发；引擎方的联调确认仍通过清单记录。交互首页的数据样例见 [demo.js](../frontend/src/fixtures/demo.js)，材料模块已按本文接入真实 HTTP 调用代码，伙伴引擎尚未联调成功。字段变更须同步本文和前端。

依据：[产品定义](product-definition.md)、[MVP 验收](mvp-acceptance.md)，以及用户提供的 spark-collision 方法主体。方法引用的 `references/output-template.md`、`references/calibration.md` 尚未在当前仓库中提供；本稿字段由现有方法主体推导，不声称复刻这两个文件。

## 2. 范围与责任

| 事项 | 交互方 | 引擎方 | 共同确认 |
| --- | --- | --- | --- |
| 接口契约 | 起草、维护字段与页面对应关系 | 评审可实现性，按契约提供服务 | 路径、字段、状态、变更 |
| 页面 | 导入、总览、详情、原文侧栏、历史、纠错、下载 | 返回可直接展示的数据 | 展示顺序与异常文案 |
| 分析 | 展示类型、来源、条件与缺口 | 提示词、模型调用、证据抽取、认知比较与校验 | 合成样例与分析预期 |
| 数据 | 保存当前项目 ID 等界面偏好 | 持久化原文、定位、任务、快照、纠错 | 重启恢复与备份方式 |
| 联调 | 前端调用、交互检查 | 服务启动、配置、错误排查 | 验收与演示 |

MVP：单项目、3–5 份合成或获准短文本；TXT、Markdown、粘贴输入；原文可追溯；增量材料更新；历史、纠错和 Markdown 导出。

录音转写、OCR、多人权限、企业集成、模型训练和外部任务执行不在本版范围。语音、图片、PDF 输入与 ATC 执行接口不在本版承诺内。六个分析视角均须给出内容或缺口，材料不足时允许无碰撞卡。

## 3. 通用约定

### 3.1 地址、传输和联调

- 路径前缀：`/api/v1`。前端通过可配置的 API base URL 调用。
- 建议本机联调地址：前端 `http://localhost:5173`，引擎 `http://127.0.0.1:8000`；最终端口在确认清单填写。
- JSON 使用 UTF-8，`Content-Type: application/json`。Markdown 下载是例外。
- 提议先在同一台演示机器运行两个服务；若两台机器联调，填写真实可达的服务地址，不能把对方机器的 localhost 当远程地址。
- 本机版本可不设登录；引擎仅监听本机地址。若改为局域网／公网访问，先约定访问凭据与访问范围。前端不接收模型供应商密钥。
- CORS 仅允许实际前端 origin；若前端需要读取 `Content-Disposition`，后端显式暴露该响应头。
- 所有业务时间返回带时区的 RFC 3339 字符串；用户界面按 Asia/Shanghai 显示。材料只知道日期时使用 `source_date: YYYY-MM-DD | null`，不补造具体时间。
- ID 是服务端生成的不透明字符串；前端不解析 ID 含义。业务 ID 跨刷新、快照保持稳定。
- 字段采用 snake_case。必需但未知的值返回 `null`；列表无内容返回 `[]`；计数未知返回 `null`，不能当成 0。
- 初版列表一次返回全部，受 MVP 材料限额约束；不做分页。版本增长超出实测范围后再加分页。
- 前端渲染原文及模型文本时按纯文本处理；需要 Markdown 展示时禁用原始 HTML 并过滤危险链接。

### 3.2 成功与失败

除文件下载外，成功使用统一包装：

```json
{
  "data": { "project_id": "prj_demo", "current_version": 0 },
  "request_id": "req_001"
}
```

失败使用对应 HTTP 状态码与统一错误体：

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "项目已更新，请刷新后重试。",
    "retryable": false,
    "details": { "expected_version": 1, "current_version": 2 }
  },
  "request_id": "req_002"
}
```

`details` 为对象，无附加信息时 `{}`；`request_id` 用于双方定位日志。错误体不返回密钥、完整模型提示词或堆栈。

### 3.3 幂等、并发和版本

- 所有 POST 要求 `Idempotency-Key` 请求头，使用客户端生成的 UUID。
- 同一个逻辑请求因超时重发时沿用原 key；原请求已完成则返回原状态码和原结果；处理中返回 `409 REQUEST_IN_PROGRESS`，前端稍后以相同 key 重试。
- key 按“方法＋路径”限定范围，建议保留 24 小时且持久化；同 key、不同 JSON 内容返回 `409 IDEMPOTENCY_CONFLICT`。
- 任务已明确失败后再分析，属于新的业务请求：使用新 key，创建新 job。不能用旧 key 期待新任务。
- `current_version` 是项目**分析快照**版本，从 0 开始。导入原文不递增版本；成功分析（包括无新火花、证据不足）或成功纠错各加 1。
- 创建分析、提交纠错都传 `expected_version`。不匹配返回 `409 VERSION_CONFLICT`。
- 同项目同时只允许一个 queued/running 分析；运行中禁止再次分析或纠错，返回 `409 PROJECT_BUSY`。读和导入新材料仍可进行。
- 分析创建时冻结输入材料集合和基础版本；运行中导入的材料留待下次分析。前端不能把这些材料显示为已分析。
- 每个快照和它的证据、历史状态不可变。写入完整快照、更新项目版本、完成 job 必须原子提交；失败保留上一次快照。

### 3.4 建议限额（等待引擎方确认）

| 项目 | 建议默认值 | 超限处理 |
| --- | --- | --- |
| 单次导入 | 1–5 份材料 | 422 VALIDATION_ERROR |
| 项目累计材料数 | 最多 10 份，演示使用 3–5 份 | 422 LIMIT_EXCEEDED |
| 单份文本 | 最多 20,000 个 Unicode code point | 422 TEXT_TOO_LONG |
| 项目累计文本 | 最多 60,000 个 Unicode code point | 422 LIMIT_EXCEEDED |
| HTTP 请求体 | 最多 1 MiB | 413 PAYLOAD_TOO_LARGE |
| 普通 HTTP 请求等待 | 前端 15 秒；超时不等于服务器未处理 | 幂等查询／重发 |
| 后台分析执行期限 | 服务端 180 秒，含内部重试 | job failed / MODEL_TIMEOUT |
| 轮询 | 2 秒一次；查询网络失败后退避至 5、10 秒 | 不重复创建分析 |

以上不是已测性能承诺。前端字符计数建议使用 `Array.from(text).length`，后端实施最终校验；限额是否适合所选模型需要真实样例验证。

## 4. 页面与调用流程

1. 打开页面：`GET /health`，`GET /projects`；首次使用时 `POST /projects` 创建唯一项目。
2. 导入材料：前端读取 UTF-8 TXT／MD 或粘贴内容，`POST /projects/{project_id}/records`。
3. 点击分析：`POST /projects/{project_id}/analyses`，取得 job_id；轮询 `GET /projects/{project_id}/jobs/{job_id}`。
4. 分析成功：按 `result_version` 获取总览。无新火花、证据不足也走成功路径。
5. 打开详情：使用总览返回的 insight_id 和 snapshot_version 获取详情，避免新旧快照混用。
6. 点击证据：按 record_id、segment_id 获取原文并高亮整段。
7. 新增材料：重复导入与分析；后台将新增材料与上一快照覆盖材料一起比较。
8. 查看历史：先取版本列表，再选择两个版本读取同一智慧点详情；前端展示差异，引擎返回变化原因和依据。
9. 纠错／冲突处理：提交 correction；成功后重新获取返回版本的总览和详情。
10. 导出：下载指定快照的 Markdown 文件。

前端刷新恢复：按项目 ID 读取总览中的 active_job_id，继续轮询；GET /projects 让本地页面偏好丢失后仍能找回项目。

## 5. 接口一览

以下路径均接在 `/api/v1` 后。

| 方法 | 路径 | 成功码 | 返回 data |
| --- | --- | --- | --- |
| GET | /health | 200 | Health |
| GET | /projects | 200 | `{items: Project[]}` |
| POST | /projects | 201 | Project |
| POST | /projects/{project_id}/records | 201 | `{items: RecordSummary[]}` |
| GET | /projects/{project_id}/records | 200 | `{items: RecordSummary[]}` |
| GET | /projects/{project_id}/records/{record_id} | 200 | RecordDetail |
| POST | /projects/{project_id}/analyses | 202 | Job |
| GET | /projects/{project_id}/jobs/{job_id} | 200 | Job |
| GET | /projects/{project_id}/overview | 200 | Overview |
| GET | /projects/{project_id}/insights/{insight_id} | 200 | InsightDetail |
| GET | /projects/{project_id}/versions | 200 | `{items: VersionSummary[]}` |
| POST | /projects/{project_id}/corrections | 201 | CorrectionResult |
| GET | /projects/{project_id}/export | 200 | Markdown 文件 |

所有嵌套资源必须校验所属 project_id；不属于该项目时返回 404。不能仅凭内层 ID 返回其他项目数据。

## 6. 共享数据结构

本节是字段契约：除明确写“请求可省略”的字段外，响应字段均须出现；`| null` 表示允许为空。`string[]` 表示字符串数组。示例 ID、人物、内容均为合成。

火花来源是另行协商的可选响应扩展：`InsightSummary.spark` / `InsightDetail.spark`，允许缺省或 null；场次、单场/跨场事件、印证与兼容规则见 [火花来源对接增补](spark-origins-contract.md)。前端已支持展示，引擎与导入分组尚需确认，不改变本版现有请求的必填字段。

### 6.1 Project 与 Health

| 对象 | 字段 | 类型与含义 |
| --- | --- | --- |
| Project | id / name | string / string |
| Project | created_at | 带时区的时间字符串 |
| Project | current_version | 非负整数；0 表示尚未生成分析快照 |
| Project | record_count | 已保存材料数，含未分析材料 |
| Health | status | `ok`；存储不可用时 HTTP 503，使用统一错误体 |
| Health | api_version | `0.1`；契约版本，不是项目快照版本 |
| Health | engine_mode | `mock` / `live`；模拟数据必须明确标识 |
| Health | model_configured | boolean；只说明配置存在，不承诺模型已连通 |

### 6.2 材料、段落和证据

| 对象 | 字段 | 类型与含义 |
| --- | --- | --- |
| RecordSummary | id / title | string / string |
| RecordSummary | source_type | `interview` / `meeting` / `chat` / `research` / `other` |
| RecordSummary | source_date / source_name | `YYYY-MM-DD | null` / `string | null`；文件名或人工来源名 |
| RecordSummary | material_basis | `synthetic` / `authorized` |
| RecordSummary | authorization_note | `string | null`；authorized 必须有非空说明 |
| RecordSummary | created_at | 服务端导入时间 |
| RecordSummary | covered_in_current_version | boolean；是否被当前快照覆盖 |
| RecordDetail | 上述全部字段 | 同 RecordSummary |
| RecordDetail | content | 原始文本，保存后不可覆盖 |
| RecordDetail | participants | `{id: string, label: string}[]`；身份未知返回空数组 |
| RecordDetail | segments | `{id: string, paragraph_index: integer, text: string}[]` |
| Evidence | id / label | 稳定 string ID / `E01` 等展示编号；项目内分配，历史不重用 |
| Evidence | record_id / segment_id | 指向真实材料与段落 |
| Evidence | quote | 原文中的连续子串；服务端检查匹配 |
| Evidence | speaker_id | `string | null`；对应材料 participants.id |
| Evidence | elicitation | `spontaneous` / `prompted` / `unknown` |
| Evidence | claim_origin | `participant_statement` / `provided_record` / `unknown` |

定位规则：段落从 1 编号；引擎负责切分，segment_id 在材料存续期间稳定。前端按服务端 segments 渲染和跳转，不自行重新切分。第一版高亮整段，因此不依赖 Python／JavaScript 字符偏移一致性。同一段中重复出现同一句话时也高亮整段。跨段引用拆成多个 Evidence。缺少可定位原文的内容可写为缺口，不能生成假的 Evidence。

材料原文不会因纠错被改写；更正原始材料的替换／撤回流程不在本版接口中。若需该能力，须补充材料版本与历史引用规则。首次导入前请核对合成案例。

参与者 ID 是项目范围的稳定身份映射，由交互方明确提供已有 ID 或新 ID；引擎检查同 ID 不出现相冲突的标签。不能仅根据同名推断是同一人，未知人物不参与已知人数统计。

### 6.3 判断、覆盖与智慧点

| 对象 | 字段 | 类型与含义 |
| --- | --- | --- |
| Judgment | id | 判断版本的稳定 ID；文本／条件变动生成新 ID |
| Judgment | text | 当前表述 |
| Judgment | epistemic_type | `fact` / `opinion` / `inference` / `hypothesis` |
| Judgment | fact_basis | `recorded_statement` / `provided_record` / `corroborated` / null；非 fact 为 null |
| Judgment | review_status | `unreviewed` / `confirmed` |
| Judgment | conditions | string[]，未知时可为空并在 evidence_gaps 说明 |
| Judgment | evidence_ids | string[]；指向当前详情 evidence 中的真实 ID |
| Judgment | rationale | 推理依据／解释，string |
| Judgment | alternative_explanations | string[]；推断、假设必须提供替代解释或说明为何尚无法提出 |
| Judgment | evidence_gaps | string[] |
| Coverage | unique_speakers / spontaneous_speakers / prompted_speakers | 已明确身份者去重人数，integer；身份全不可知则 null |
| Coverage | supporting_record_count / total_analyzed_record_count | 覆盖该主题的记录数 / 快照全部记录数 |
| Coverage | identity_incomplete | boolean；是否有无法去重的发言者 |
| Coverage | unknown_elicitation_count | 无法判断提问方式的证据条数 |
| Coverage | note | string；解释统计限制，未提及不等于不感兴趣 |
| InsightSummary | id / title | 智慧点稳定 ID / 标题 |
| InsightSummary | judgment | Judgment；保留完整类型与审核状态，避免 UI 猜测 |
| InsightSummary | dispute_status | `none` / `open`；与候选判断、判断审核状态分开 |
| InsightSummary | coverage | Coverage |
| InsightSummary | last_change | Change |
| InsightDetail | 上述全部字段 | 同 InsightSummary |
| InsightDetail | snapshot_version | 当前读取的项目快照版本 |
| InsightDetail | candidate_judgment | Judgment 或 null；待确认的替代判断 |
| InsightDetail | evidence | Evidence[]，覆盖本详情所有被引用证据 |
| InsightDetail | relations | `{evidence_id: string, relation: enum}[]` |
| InsightDetail | collision_card | CollisionCard 或 null |
| InsightDetail | validations | Validation[] |
| InsightDetail | priority | 三项 `{level: high/medium/low/unknown, reason: string}`：business_impact、evidence_strength、validation_feasibility |

relation 枚举：`supports`、`challenges`、`supplements`、`counterexample`、`qualifies`。允许一条证据具有多个关系，必须分条返回。

Coverage 来自原始证据和身份映射的程序统计。主动提起者与被问回应者可能是同一人，二者不能相加当总人数；前端保留 note 与未知状态，不制作无依据的关注度评分。

fact_basis=recorded_statement 表示“确实说过”，不表示陈述的外部事实已验证。corroborated 需要 evidence_ids 与 rationale 说明核实依据。confirmed 只表示用户确认该判断的使用，不改变 epistemic_type，也不代表批准行动。

fact、opinion 的 evidence_ids 不可为空；没有证据的新看法只能作为明确标注的 inference／hypothesis，并在 evidence_gaps 说明。服务端对 Judgment、TextBlock 和用户 Replacement 应用相同的引用与类型规则。不得因为用户点了确认就放宽引文真实性校验。

### 6.4 认知碰撞卡与最小验证

TextBlock 字段：`text: string`、`epistemic_type: fact/opinion/inference/hypothesis`、`evidence_ids: string[]`、`conditions: string[]`、`alternative_explanations: string[]`、`gaps: string[]`。

| CollisionCard 字段 | 说明 |
| --- | --- |
| category | `fact_correction` / `business_reframe` / `technical_reframe` / `organization_reframe` / `implementation_barrier` / `other` |
| prior | TextBlock；原有认知 A |
| prior_origin | `recorded` / `analysis_premise`；后者须显示“分析前提，非原话” |
| shock | TextBlock；现场冲击 B，evidence_ids 不可为空 |
| new_frame | TextBlock；新框架 C |
| implication | TextBlock；高阶判断 D，epistemic_type 必须是 inference |
| validation_ids | string[]，指向详情 validations，至少一项 |

没有真实认知冲击时 collision_card=null，仍可有关键事实或机会；不强行填 A→B。

| Validation 字段 | 类型与含义 |
| --- | --- |
| id / question / decision_impact | string；稳定 ID、问题／假设、为什么影响决策 |
| evidence_ids | string[]；验证问题的材料依据，可为空但需解释缺口 |
| required_materials / interview_roles | string[]；所需材料／访谈角色，不能补造具体人名 |
| experiment / success_criteria / failure_criteria / next_decision | string；实验、支持判据、推翻判据、后续决定 |
| owner / due_at | string 或 null；未指定／未商定时由前端显示占位文案 |
| workstream | `customer_preparation` / `joint_walkthrough` / `internal_research` |
| status | `proposed`；本版仅记录验证建议 |

验证建议不产生任务执行或客户联系。MVP 不提供行动批准接口，也不从赞同推导 approved。需要展示既有明确批准记录时，应另行补充批准者与批准证据字段后再扩展契约。

### 6.5 六维分析与总览

Dimension 固定返回六项，key 依次为：

`key_facts`、`cognitive_breakthroughs`、`hidden_constraints`、`ai_operations`、`reusable_opportunities`、`validation_questions`。

每项包含：`key`、`status: available/insufficient_evidence/not_applicable`、`findings: Finding[]`、`gaps: string[]`。后两种状态必须写具体原因，不能空白占位。

Finding 包含 `id`、`title`、`body: TextBlock`、`insight_ids: string[]`、`sections: {label: string, body: TextBlock}[]`。这样前端可统一渲染，不需要为每个行业开发专属表单。

- 隐藏约束必须写候选机制、反例／替代解释和验证办法，不得把候选当已确认第一约束。
- ai_operations 的 sections 应分别交代运营对象与来源、岗位交接、决策执行闭环、AI 增量；AI 增量区分规则、程序、专业算法、自动化、大模型，并说明已知／缺口／如何补齐。
- reusable_opportunities 的 sections 应交代通用能力、行业规则、客户配置、适用条件、反例、复用证据与缺失证据。单案例仅能形成假设。
- validation_questions 通过 insight_ids 链接详情中的 Validation，避免另造一套任务状态。
- ATC 候选如需展示可暂作为明确标注的假设性 Finding；结构化 ATC 编辑与执行需要后续契约，不在本版验收中。

| Overview 字段 | 类型与含义 |
| --- | --- |
| project | Project；反映请求时的当前项目信息 |
| snapshot_version | 本次读取的快照版本；历史查看时可小于 project.current_version |
| active_job_id | string 或 null；运行中任务，与历史快照无关 |
| source_record_ids | string[]；该快照覆盖的材料 |
| unanalyzed_record_ids | string[]；当前项目中尚未进入最新快照的材料，即使查看历史也按最新快照计算 |
| summary | string；可读短简报，无材料时为空字符串 |
| insights | InsightSummary[] |
| dimensions | Dimension[] |
| evidence | Evidence[]；总览 Finding 的引用目录 |
| changes | Change[]；相对于上一项目快照的变更 |
| outcome | `updated` / `no_new_insight` / `insufficient_evidence` / null（版本 0） |
| pending_confirmation_count | integer；该快照 open 的智慧点数量 |
| engine_mode | `mock` / `live`；该快照来源，版本 0 沿用服务当前模式 |

版本 0 总览：source_record_ids、insights、changes、evidence 为空；六维均 insufficient_evidence 并说明“尚未分析”；summary 为空；outcome=null。不能用演示样例冒充用户项目结果。

### 6.6 变化、版本和任务

| 对象 | 字段 | 类型与含义 |
| --- | --- | --- |
| Change | insight_id | 稳定智慧点 ID |
| Change | type | `new` / `supported` / `qualified` / `challenged` / `revised` / `unchanged` |
| Change | reason | 变化原因或无变化说明 |
| Change | evidence_ids | string[]；变更所依据证据，在关联智慧点详情中可查 |
| Change | previous_judgment_id / current_judgment_id / candidate_judgment_id | string 或 null；新智慧点 previous 为 null；新候选不覆盖 current |
| Change | is_breakthrough | boolean；新增支持／证据覆盖不自动算突破 |
| VersionSummary | version / parent_version | 正整数 / 非负整数 |
| VersionSummary | created_at | 快照创建时间 |
| VersionSummary | cause | `analysis` / `correction` |
| VersionSummary | job_id / correction_id | string 或 null；按 cause 保留对应来源 |
| VersionSummary | source_record_ids | string[]；快照所覆盖材料 |
| VersionSummary | outcome / summary / changes | 业务结果枚举 / string / Change[] |
| VersionSummary | actor_label / correction_reason | string 或 null；cause=correction 时记录操作者标识与理由，analysis 时均 null |
| Job | id / project_id | string |
| Job | status | `queued` / `running` / `succeeded` / `failed` |
| Job | stage | `queued` / `extracting` / `comparing` / `validating` / `saving` / `done` / `failed` |
| Job | base_version | 创建任务时的项目版本 |
| Job | added_record_ids / source_record_ids | 本次新增材料 / 实际分析全部材料，string[] |
| Job | created_at / started_at / finished_at | 时间字符串；后两者未发生时 null |
| Job | result_version | 成功后的快照版本，否则 null |
| Job | outcome | 业务结果枚举，完成前与失败时 null |
| Job | error | `{code, message, retryable, details}` 或 null；只在 failed 时有值 |

业务结果 updated 包含新增主题、增加证据、条件变化或待确认冲突，不必包含认知突破；no_new_insight 表示未发生实质分析变化，仍保存已覆盖材料和本次运行快照；insufficient_evidence 表示材料整体不足以形成可靠判断。只有部分维度缺失时，可返回 updated 并逐维说明缺口。

关键冲突是“分析完成、存在待确认候选”，job 仍 succeeded。前端根据 dispute_status 显示确认入口，不能让任务一直 running 等人操作。

状态一致性：queued 对应 stage=queued；running 对应 extracting/comparing/validating/saving；succeeded 对应 done 且有 result_version、outcome、finished_at，error=null；failed 对应 failed 且有 error、finished_at，result_version 与 outcome 均 null。纠错产生的 VersionSummary.outcome 固定 updated。

## 7. 各接口请求与响应

### 7.1 服务与项目

GET /health 无业务参数，返回 Health。GET /projects 返回创建时间升序的 Project 列表；本版最多一个项目。

POST /projects 请求：

```json
{ "name": "客服流程调研" }
```

name 去掉首尾空白后 1–80 字符；成功返回 Project。已有项目且并非相同幂等请求时，返回 `409 PROJECT_LIMIT_REACHED`，details 带 existing_project_id，前端打开已有项目。本版不提供删除／重置接口。

### 7.2 批量导入材料

POST /projects/{project_id}/records 请求：

```json
{
  "records": [
    {
      "client_record_id": "upload-001",
      "title": "客服访谈一（合成）",
      "source_type": "interview",
      "source_date": null,
      "source_name": "synthetic-interview-01.txt",
      "material_basis": "synthetic",
      "authorization_note": null,
      "participants": [{ "id": "person_01", "label": "客服负责人" }],
      "content": "客服负责人：标准问题可以自动回复，但报价需要人工确认。"
    }
  ]
}
```

上例全部键必填，允许 null 的字段按表处理。title 为 1–120 字符，content 不可全空白；建议 source_name 最多 255 字符、参与者 label 最多 80 字符、authorization_note 最多 1,000 字符。text/html、录音、图片、PDF 不是此接口的输入。

整批校验与保存必须原子完成：一项非法则全部不写入，422 的 details 指出 `records[0].content` 等字段路径。

client_record_id 项目内唯一，作为独立于 Idempotency-Key 的材料去重标识。同 ID 同材料字段返回原记录，同 ID 不同内容或元数据返回 `409 RECORD_CONFLICT`。不同 ID 即使文本相同也允许保存，分析时须识别重复信息，不人为制造突破。

返回 data.items: RecordSummary[]，顺序与请求一致。导入成功不自动开始分析，也不表示材料已被快照覆盖。

GET /projects/{project_id}/records：无参数，按导入时间升序返回全部材料。

GET /projects/{project_id}/records/{record_id}：无参数，返回 RecordDetail，包括原文和服务端切分段落。不存在返回 404。

### 7.3 创建分析与查询任务

POST /projects/{project_id}/analyses 请求：

```json
{
  "record_ids": ["rec_001"],
  "expected_version": 0
}
```

- record_ids 是本次选择的、尚未被当前快照覆盖的材料，必填、非空、去重；不属于项目返回 404，已覆盖返回 `409 RECORD_ALREADY_ANALYZED`。
- 服务端实际 source_record_ids = 当前快照覆盖材料 ∪ 本次 record_ids，并带入已有用户纠错、确认状态与未解决冲突。
- 不要求用户每次重传全部材料。方法可采用全量比较或增量分析，但不能丢失既有条件、证据与确认状态。
- 不提供对已成功覆盖材料的强制重算；模型／提示词变化后的重算与人工纠错保护留待新版本契约。
- 先持久化 Job 再返回 202；同时返回 Location 指向对应 job 查询 URL。

返回示例（所有例子均为合成，时间仅演示格式）：

```json
{
  "data": {
    "id": "job_001",
    "project_id": "prj_demo",
    "status": "queued",
    "stage": "queued",
    "base_version": 0,
    "added_record_ids": ["rec_001"],
    "source_record_ids": ["rec_001"],
    "created_at": "2026-10-17T12:00:00+08:00",
    "started_at": null,
    "finished_at": null,
    "result_version": null,
    "outcome": null,
    "error": null
  },
  "request_id": "req_003"
}
```

GET /projects/{project_id}/jobs/{job_id} 返回完整 Job。任务失败时该 GET 本身仍是 200，Job.status=failed；job 不存在才是 404。

重启时将遗留 queued/running 任务标记 failed，error.code=SERVICE_RESTARTED，并释放项目锁。前端提示用户重试原来的 added_record_ids；新请求使用新的幂等 key，仍检查当前版本。模型超时、格式错误、引用不匹配不应发布部分结果。

### 7.4 总览、详情与历史

GET /projects/{project_id}/overview：可选 query `version`，非负整数。省略时读取最新快照，0 返回空白初始分析状态。指定不存在版本返回 `404 VERSION_NOT_FOUND`。

GET /projects/{project_id}/insights/{insight_id}：可选 query `version`，正整数；省略时读取最新快照。返回 InsightDetail。该智慧点在所选版本尚不存在时返回 `404 INSIGHT_NOT_FOUND_AT_VERSION`，前端显示“此版本尚无该智慧点”。

GET /projects/{project_id}/versions：可选 query `insight_id`。省略时返回全部 VersionSummary；指定时返回 changes 包含该智慧点的版本，包括明确记录的 unchanged。按 version 降序排列。尚无快照返回空列表。

变化规则：

- 仅支持证据增加时保留判断 ID，变化为 supported，通常 is_breakthrough=false。
- 表述或条件改变则生成新 Judgment ID；历史快照保留旧 Judgment。
- 与 confirmed 判断发生关键冲突时：judgment 保持原值，candidate_judgment 保存候选，dispute_status=open，Change.type=challenged。
- 后续新证据若再次影响候选，可以生成新候选版本，但旧候选仍保留在历史快照。
- 用户纠错创建的判断以 confirmed 状态保存，后续分析也遵守上述保护。
- 本版不合并／删除既有智慧点 ID；无法确定是否同一主题时保留并列与条件说明，避免历史链接失效。

### 7.5 纠错与冲突处理

POST /projects/{project_id}/corrections 通用必填字段：

| 字段 | 类型与约束 |
| --- | --- |
| insight_id | string；本次处理的智慧点 |
| expected_version | 当前项目快照版本，非负整数 |
| expected_judgment_id | 用户实际看到的当前 Judgment ID |
| actor_label | 1–80 字符；操作者自填标识，仅作为本机操作记录，不是已认证身份 |
| action | `confirm_current` / `edit_current` / `accept_candidate` / `reject_candidate` |
| reason | 1–2,000 字符；保存的理由 |
| candidate_judgment_id | string 或 null；accept/reject 必须匹配现有候选，其他操作必须为 null |
| replacement | Replacement 或 null；仅 edit_current 使用 |

Replacement 完整字段：`text`、`epistemic_type`、`fact_basis`、`conditions`、`evidence_ids`、`rationale`、`alternative_explanations`、`evidence_gaps`，规则与 Judgment 对应字段相同。text 为 1–4,000 字符。服务端生成新判断 ID，review_status=confirmed；不允许前端提交任意系统字段。

示例：

```json
{
  "insight_id": "ins_001",
  "expected_version": 2,
  "expected_judgment_id": "jdg_001",
  "actor_label": "演示操作者",
  "action": "accept_candidate",
  "reason": "补充材料明确了报价场景的人工确认条件。",
  "candidate_judgment_id": "jdg_002",
  "replacement": null
}
```

| 操作 | 行为 |
| --- | --- |
| confirm_current | 无 open 冲突时确认当前判断，保留 ID、类型和证据；已 confirmed 则 409 ALREADY_CONFIRMED |
| edit_current | 无 open 冲突时用完整 Replacement 生成新判断；审核为 confirmed，但不把假设自动升级为事实 |
| accept_candidate | 存在 open 冲突时采用该候选，设 confirmed，清空当前候选指针、关闭冲突；原判断仍在历史中 |
| reject_candidate | 存在 open 冲突时保留当前判断及其审核状态，关闭当前冲突，历史保留候选、反例及拒绝理由 |

open 冲突时 confirm/edit 返回 `409 UNRESOLVED_CONFLICT`，避免含糊地绕过候选。无匹配候选时 accept/reject 返回 `409 CANDIDATE_CONFLICT`。

成功同步保存新快照，返回 CorrectionResult：`id: string`、`insight_id: string`、`action: enum`、`actor_label: string`、`reason: string`、`created_at: timestamp`、`previous_version: integer`、`result_version: integer`。新快照 VersionSummary.cause=correction。纠错不调用外部执行工具。

本版只支持判断／条件纠错；误引、材料归属、参与者身份或关系标注的编辑需引擎方修复并重新验收，不伪装成前端已支持的操作。是否将这些编辑纳入本次范围见确认清单。

### 7.6 导出

GET /projects/{project_id}/export?format=markdown&version=2。

- format 请求可省略，默认 markdown；其他值返回 422。version 可省略，默认最新；必须大于 0，无分析时返回 `409 NO_ANALYSIS`。
- 成功直接返回 UTF-8 文本，`Content-Type: text/markdown; charset=utf-8`，`Content-Disposition: attachment; filename="spark-collision-v2.md"`，不包 JSON。
- 包含导出时间、快照版本、材料范围与日期、简报、六维分析／缺口、碰撞卡、事实／观点／推断／假设类型、引用原文与文件／段落定位、适用条件、该版本之前的判断历史、未解决冲突、验证建议。
- 历史版本导出只包含截至该版本的信息；不混入未来判断。离线导出中的引用必须有可读文本位置，不能仅有网页路由。
- 下载失败仍返回统一 JSON 错误；前端先检查状态码和 Content-Type。

## 8. 错误与界面反馈

| HTTP／任务错误 | code | 前端行为 |
| --- | --- | --- |
| 422 | VALIDATION_ERROR / TEXT_TOO_LONG / LIMIT_EXCEEDED | 展示字段问题，修改后重新提交 |
| 413 | PAYLOAD_TOO_LARGE | 提示缩小材料体积 |
| 404 | PROJECT_NOT_FOUND / RECORD_NOT_FOUND / JOB_NOT_FOUND / VERSION_NOT_FOUND | 提示资源不存在；不要无限重试 |
| 404 | INSIGHT_NOT_FOUND_AT_VERSION | 历史对比一侧显示“此时尚未出现” |
| 409 | VERSION_CONFLICT | 重新取最新结果，保留用户输入供重新核对 |
| 409 | PROJECT_BUSY | 显示进行中的任务，details.active_job_id 用于轮询 |
| 409 | REQUEST_IN_PROGRESS | 短暂等待，以相同幂等 key 重试 |
| 409 | IDEMPOTENCY_CONFLICT / RECORD_CONFLICT | 提示请求标识与内容冲突；检查客户端请求复用逻辑 |
| 409 | RECORD_ALREADY_ANALYZED | 刷新材料列表，只选择尚未覆盖记录 |
| 409 | CANDIDATE_CONFLICT / UNRESOLVED_CONFLICT / ALREADY_CONFIRMED | 刷新详情，提示确认状态已变化或需先处理冲突 |
| 409 | PROJECT_LIMIT_REACHED / NO_ANALYSIS | 打开已有项目／引导先分析 |
| 429 | RATE_LIMITED | 按 Retry-After 秒数退避 |
| 503 | SERVICE_UNAVAILABLE | 显示服务暂不可用，保留已有页面结果 |
| 500 | INTERNAL_ERROR | 显示失败及 request_id，保留输入，排查日志 |
| Job.failed | MODEL_TIMEOUT / MODEL_RATE_LIMITED / MODEL_UNAVAILABLE | 显示任务失败；retryable=true 时允许重新发起分析 |
| Job.failed | OUTPUT_INVALID / EVIDENCE_MISMATCH | 提示分析未通过校验；不展示半成品；允许重试并记录排查信息 |
| Job.failed | SERVICE_RESTARTED | 显示任务中断，可以重新分析 |

普通网络错误不自动等于 job failed。读取超时可以重试 GET；创建请求超时按相同幂等 key 重试；不要因轮询失败重复 POST 新任务。

## 9. 必须共同验证的场景

| 场景 | 引擎提供 | 前端检查 | 对应原验收 |
| --- | --- | --- | --- |
| 引用追溯 | 真实 evidence、record、segment | 点击后定位正确，原话一致 | A1 |
| 条件不同 | 保留条件分支与各自证据 | 并列显示，不合成无条件结论 | A2 |
| 只有赞同 | 返回观点／建议 | 不显示已批准行动 | A3 |
| 重复信息 | no_new_insight 或 supported 且非突破 | 无新火花文案，不做虚假突破动画 | A4 |
| 反例冲击已确认判断 | 当前判断＋候选＋open＋历史 | 用户能看懂冲突并作选择 | A5 |
| 刷新／服务重启 | 原文、快照持久化；中断任务明确失败 | 能恢复项目及任务状态 | A6 |
| 导出 | 可独立阅读的 Markdown | 下载可打开，引用与版本完整 | A7 |
| 主动／被问不同 | 去重与未知信息明确 | 不把两个计数相加，不把未提及当不关心 | A8 |
| 材料不足 | 维度缺口、假设标签 | 不渲染成已证实约束 | A9 |
| 重复提交 | 幂等请求只产生一次业务写入 | 连点／超时重试不生成重复项目或任务 | 新增 |
| 旧页面纠错 | 409 VERSION_CONFLICT | 用户输入保留，刷新后重新核对 | 新增 |
| 模型引用不存在 | job failed，不发布新快照 | 上一版仍可查看 | 新增 |
| 分析中新增材料 | 冻结输入，本次不纳入新记录 | 新记录保持未分析标记 | 新增 |
| 历史查看／导出 | 指定快照不可变 | 看旧版时不混入新版证据与判断 | 新增 |

测试材料建议覆盖：标准问题自动回复、报价人工确认、条件相反的团队、重复说法、证据不足。均标注合成。引擎 mock 模式和 live 模式要分开验收，mock 通过不代表 AI 分析通过。

## 10. 契约交付与变更

1. 交互方维护本文与确认清单；引擎方逐项写“接受／调整＋原因”。
2. 双方确认字段后补齐 OpenAPI 文件与可供前端使用的完整模拟响应，保持同一版本；当前仓库尚无这两个交付物，不把本文当作已生成代码。
3. 引擎方交付启动命令、环境变量名称（不含真实密钥）、服务地址、可调用接口及已知限制；交互方交付启动命令、页面路由与 API 地址配置。
4. 所有对接用的固定 ID 示例需保持引用一致，包含成功、空数据、无新火花、证据不足、关键冲突与失败。
5. 字段删除、重命名、类型变化、状态语义变化先更新文档并双方确认；新增可选字段兼容旧前端。前端遇到未知枚举显示中性占位，不能误标“已确认／已批准”。
6. 共享契约文件的维护人为交互方；引擎方通过 PR 提议修改。各自分支开发，合入 main 前按第 9 节联调。
7. 本稿冻结前标为 v0.1 draft；冻结记录中填写双方确认人、时间、文档 commit 和未决项。截止时间与实际负责人未确定时保持“待商定／待指定”。

## 11. 可选会议指标：前端已支持，正式冻结待双方确认

本节落实 `demo-case-and-contract.md` 中伙伴模拟服务已返回的字段，不改变 v0.1 的必填字段。用于 Overview 中每个 insight 和对应版本的 InsightDetail；三个指标分别展示，任何一个缺失或不合法不阻断其他判断与原文展示。前端不根据文件数、火花颜色、人数或重要性补算缺失字段。

| 字段 | 类型与约束 | 展示含义 |
| --- | --- | --- |
| `meeting_coverage.distinct_meeting_count` | 非负整数，不大于 total | 本关注点有证据的独立场次 |
| `meeting_coverage.total_meeting_count` | 非负整数 | 本快照全部独立场次，不能读最新版本的分母 |
| `meeting_coverage.meeting_ids` | 去重的非空字符串数组，长度等于 distinct | 明确的场次归属，同场多文件只计一次 |
| `importance.rule_version` | 当前支持 `demo-0.1` | 仅合成演示规则；其他规则显示“评分待解释” |
| `importance.score` / `max_score` | 非负整数；本规则 max=5，score=分项之和且不大于 5 | 优先阅读提示，不是概率、证据充分度、共识或付费意愿 |
| `importance.parts.distinct_meetings` | min(raw_counts.distinct_meetings, 3) | 场次分，上限 3 |
| `importance.parts.independent_speakers` | raw_counts.independent_speakers ≥ 2 时为 1，否则 0 | 发言者分，上限 1；未知身份不能得该分 |
| `importance.parts.documented_business_choice` | 0 或 1 | 业务取舍原话分，上限 1，由模拟服务给出；正式规则和引用映射待确认 |
| `importance.raw_counts.distinct_meetings` | 非负整数；有效 meeting_coverage 存在时应与 distinct 一致 | 原始场次，不因评分封顶而停止增加 |
| `importance.raw_counts.independent_speakers` | 非负整数或 null | 明确身份去重人数；null 为未知 |
| `convergence_status` | `conditions_unresolved` / `conditional_convergence` / `insufficient_evidence` | 条件待核实 / 有条件趋同 / 证据不足；未知枚举显示“趋同待判断” |

所有可选字段均跟随当前快照。M1+M2：2/2 场、4/5、条件待核实；加 M3：3/3 场、5/5、有条件趋同；加 M4：4/4 场、5/5、有条件趋同，但 outcome=`no_new_insight`。低频审批等待仍保留 attention_flag 和待验证假设，不按低分隐藏。

详情和卡片可展开核对演示规则及当前判断的 conditions。有条件趋同必须保留各条件分支；不推导成“所有人都同意”。确认判断、继续验证、认可方向均不等于批准上线。示例 Markdown 报告保留相同解释；用户项目下载服务端报告，前端不改写其正文。

待共同确认：正式评分规则及校准证据、业务取舍分的具体引用映射、更多趋同状态、同场多文件导入规则。此处记录现有支持，不表示上述能力或双方验收已经完成。

## 12. 按场次组织证据标注：当前前端支持

InsightDetail 的 `evidence[].meeting_id` 及 `annotations[]` 均为可选扩展，使用当前快照自己的证据目录，不跨版本补证据。已提供字段按下表处理：

| 字段 | 类型 | 处理规则 |
| --- | --- | --- |
| `evidence[].meeting_id` | 非空字符串 | 明确会议归属；不能从 record_id、文件名、发言者或 spark 的参与场次推导 |
| `annotations[].evidence_id` | 本版 evidence 中已存在的 id | 未关联本版证据的标注只提示缺口，不产生原话按钮 |
| `annotations[].meeting_id` | 非空字符串 | evidence 未给场次时，可采用唯一且无冲突的标注归属；与 evidence 或同记录其他证据冲突时列入“场次待补齐” |
| `annotations[].relation` | supports / challenges / supplements / counterexample / qualifies | 与原 relations 兼容，一项证据可有多种关系；未知枚举保持未标注 |
| `annotations[].condition` | 字符串或 null | 按该条标注展示，不把 null 理解为无条件；异常类型不展示成有效条件 |
| 原文 Record 的 `meeting_id` | 可选非空字符串 | 若返回，则必须与所选证据明确的会议归属一致，否则不高亮；若缺失，仍核对记录 id、segment_id 和原话，标记场次待核验 |

同一会议有多份记录时，证据显示在同组，材料数和引用数分别标注；不改变会议覆盖的服务端统计。界面支持快速跳转场次、按关系筛选和逐条查看原文。原文的记录、片段和引用文本必须匹配，连续点击的迟到响应不替换最新选择。归属缺口不擅自改写原始材料。

“重复印证”仅取有效 spark 路径中的 corroboration 事件，并且该贡献引用和场次必须对应；不从 supports、认可措辞或相同引用数量推导成认知突破。M2 的标注条件为“跨区报价”，M3 两条分别为“无折扣目录价”和“跨区或特殊折扣”；M4 认可不变成上线批准。

当前示例、用户项目详情及只读历史详情共用此展示；示例 Markdown 保留分组标注和截至该版的引用。当前导入表单已支持显式填写并提交 meeting_id，模拟服务同场多文件导入仍有限制；前端能够展示同组证据不表示导入和服务端能力已实现或验收。

## 13. 可选 Kimi 引文分析联调（独立于项目快照）

启用方法见 [本机配置](kimi-local-setup.md)。密钥只保存在后端进程环境，浏览器不传 API Key。`GET /health` 增加 `chat_provider: kimi|none`、`chat_model: string|null` 和 `agent_analysis_mode: kimi|unavailable`；这些字段说明服务配置，不能替代一次真实生成验证。标准 Kimi 启动会先查询官方 `/models` 并核对所选模型，失败则拒绝启动。`engine_mode` 仍为 `mock`，对应旧 `/analyses` 和项目总览，不能据此否认或冒充独立 Kimi 调用。

| 接口 | 请求和返回 |
| --- | --- |
| `POST /projects/{id}/agent-analysis` | 必须有 `Idempotency-Key`；JSON 为 `{record_id: string, allow_external_processing: boolean}`。单次添加一份已导入材料，以此前已分析材料为上下文；批量导入后前端逐份调用。成功为 201。 |
| `GET /projects/{id}/agent-analyses` | 返回 `{items: [...]}`，用于恢复已完成的独立结果，不会触发模型调用。 |
| `POST /chat/stream` | JSON 为 `{messages: [{role: "user"|"assistant", content: string}]}`，最多 12 条、总计 12,000 字符，最后一条为 user。不接受客户端 system 消息。返回 SSE `delta {text}`、`done {characters}`，失败为 `error {code,message}`；缺少完成事件不算成功。当前浅色首页的生成按钮不调用此接口。 |

分析成功项包含 `id, record_id, created_at, provider, model, result`。`result` 包含 `summary, outcome, changes, counts`；`outcome` 为 `updated|no_new_insight|insufficient_evidence`。每条 change 含 `title, type, reason, judgment, evidence`；type 为 `new|supported|qualified|revised|challenged`。每条 evidence 含 `record_id, segment_id, quote, meeting_id`，服务端逐字核验且每条变化必须引用本轮新材料。`counts` 由服务端计算，不采用模型给出的数量。

服务未配置为 503；本轮或历史上下文含获授权材料而未确认外部处理为 422 `EXTERNAL_PROCESSING_NOT_APPROVED`；同一材料已分析但用不同请求标识再调用为 409 `RECORD_ALREADY_ANALYZED`；上下文累计超过 16,000 字符为 413 `ANALYSIS_CONTEXT_LIMIT`。上游调用或结果校验失败为 502，不保存无效结果。前端独立分析等待上限 45 秒，其他普通请求仍为 15 秒；超时后先 GET 恢复已保存结果，未完成请求复用原幂等标识。

Kimi 引文分析是待人工核实的模型推断；引文逐字匹配仅证明引用存在。它不具备完整 A/B/C/D/V 碰撞卡字段，不进入旧的六维总览、项目版本历史、纠错和 Markdown 导出，不能把这些旧页面的模拟结果宣称为真实模型生成。
