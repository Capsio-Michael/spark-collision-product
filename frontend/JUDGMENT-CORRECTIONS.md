# 判断确认、纠错与分歧处理 · 交付说明

日期：2026-10-17。功能集成在原网站的认知碰撞详情中，没有新建产品项目。引擎服务必须实现 [接口契约](../docs/api-contract.md) 第 7.5 节。

## 用户能做什么

| 当前状态 | 操作 | 保存效果 |
| --- | --- | --- |
| 无冲突、未确认 | 确认当前判断 | 保留类型、表述与条件，审核状态变为 confirmed |
| 无冲突 | 纠正判断 | 编辑文字、条件、内容类型和解释，保留原文引用；保存新判断版本 |
| 有候选分歧 | 采用候选判断 | 候选成为当前判断，并确认；旧判断保留在历史中 |
| 有候选分歧 | 保留当前判断 | 关闭当前分歧，保留原判断及原审核状态；反例和候选仍保留于旧快照 |

每次操作都需填写操作者称呼、理由，并明确勾选已核对当前判断／证据／条件。称呼只是本机操作记录，不是认证身份。确认判断不代表批准上线或执行任务。

编辑时可调整事实／观点／推断／假设。事实必须有现有引用和明确的“材料中记录的说法／提供的原始记录”依据，且显式确认没有将未核实的说法当成外部事实；本表单不继承或授予 corroborated 核实状态。推断／假设保留其他解释或证据缺口。引用来源、原文、身份和关系标注不在此编辑范围。

## 页面入口与职责边界

- 最新项目总览 → 关注点详情：连接服务且版本一致时显示可保存操作。
- 示例项目 → 关注点详情：可以预览相同表单，保存按钮明确禁用，不改变固定合成分析或合成历史。
- 历史对比 → 任一版本详情：显式 readOnly=true，不显示写入按钮；回到最新总览后再操作。
- 分析任务或其他未确认提交存在时禁止新的纠错。保存／同步期间阻止重复点击和 Escape 关闭；完成后可关闭。
- 不修改历史组件的实现；历史由服务端快照与 versions 接口读取，纠错模块不建立另一套项目历史。

## 数据与恢复

1. POST `/projects/{project_id}/corrections`，传 action、expected_version、expected_judgment_id、candidate_judgment_id、actor_label、reason 和 Replacement 或 null。
2. 写入前先在浏览器保存原请求体和 Idempotency-Key，存储失败时不发 POST。
3. 网络结果不确定时锁定原请求，“用原请求恢复提交结果”始终复用同一 key 与相同 body；刷新页面或重开详情后仍可恢复。
4. 已收到合法回执但 GET 刷新失败时显示“服务端已保存，页面尚未同步”。后续只恢复读取，不重新创建业务操作。
5. 只有回执匹配当前操作，且读取到对应或更晚的合法快照后，才更新详情并显示成功。对应版本的判断状态还须符合该操作的含义。
6. VERSION_CONFLICT／CANDIDATE_CONFLICT 等明确拒绝保留输入草稿，要求读取最新判断、重新核对并勾选；不自动改 expected_version 重发。
7. 保存成功后重新读取服务端最新总览与详情，刷新首页版本及状态。若其他人已继续更新，显示保存版本与当前版本，不将旧页面伪装成最新。

恢复记录按服务地址＋项目隔离，localStorage key 前缀为 `spark-collision:corrections:v1:`。它只保存表单与请求恢复信息，不是服务端数据备份；清理浏览器存储会丢失未提交草稿。项目有未确认提交时，其他智慧点不能覆盖该请求。

## 集成接口

真实详情通过 `openInsightDetail` 的 corrections 选项提供：

```js
{
  projectId, baseUrl, storage,
  getCurrentVersion: () => currentProjectVersion,
  isBusy: () => projectHasRunningAnalysisOrPendingRequest,
  send: (body, key) => api.correct(projectId, body, key),
  loadDetail: version => api.insight(projectId, insightId, version),
  refreshLatest: async () => ({ detail: latestInsightDetail, currentVersion: latestSnapshotVersion })
}
```

refreshLatest 还负责更新主站点的总览；当前 app.js 复用 MaterialWorkflow.connect 完成完整同步，没有更改材料工作流文件。详情组件自身接收新快照、重置过期证据查询，并更新版本标签。

新增文件：`src/judgment-corrections-model.js`、`src/judgment-corrections.js`、`src/judgment-corrections.css`、`tests/judgment-corrections.test.mjs`。

## 检查结果与联调限制

- 新增 18 项自动检查：四种操作、确认状态、分类边界、版本、幂等、断网恢复、保存后刷新失败、存储失败、重复点击、草稿保护、只读与不可信内容等。
- 浏览器使用隔离合成服务实际走通：确认保存 v3、文字与条件纠错保存 v4、保留当前判断保存 v5，以及总览同步和原文核查；历史 v1 详情已验证只读。
- `scripts/qa-corrections-service.mjs` 是手工启动的浏览器验收夹具：仅合成内存数据、engine_mode=mock、没有模型、进程退出数据即失效。它复用同一个 frontend 源码，默认端口 8073；不是生产引擎或新增产品。需要时运行 `node scripts/qa-corrections-service.mjs`，在隔离页面中连接其 `/api/v1`，终端输入 quit 停止。正式网站仍使用原有预览端口与伙伴的真实引擎。
- 真实引擎的鉴权、服务端权限与审计、持久化、原子快照、幂等及语义校验仍须对照契约联调。前端自动检查与合成服务通过，不代表这些服务端能力已完成。
