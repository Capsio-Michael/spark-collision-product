# 智慧火花碰撞 · 产品定义工作区

状态：**定义阶段，附可运行的本机模拟引擎**。`work/engine-service` 已提供合成案例的确定性 mock API；它不调用模型，也不代表通用分析能力已经实现。其余文档中的能力和验收项仍为目标或建议。

## 一句话

把会议、访谈与聊天里对同一智慧点的补充、质疑、反例、认同和判断变化，整理成有原话依据、可追溯演变的项目记忆。AI 做深度分析与聚合，用户直接看结果，在使用时纠错；只有关键冲突才请求确认。

## 今天的边界

一个项目；导入 3–5 份合成或明确获准使用的短文本、Markdown 或粘贴记录；展示关键关注点和智慧变化；可从结果点回原话；新增一份讨论后更新认知且保留历史；本地持久化和可读导出。不得使用客户私密材料。无音频转写、OCR、多人权限、企业集成或外部任务自动执行。记忆更新指整理项目数据与判断版本，**不是模型训练**。

## 文档导航

- [产品定义](docs/product-definition.md)：对象、证据与判断规则、输出结构。
- [MVP 范围与验收](docs/mvp-acceptance.md)：今天做什么、怎样证明完成。
- [协作分工与任务池](docs/collaboration.md)：用户提议负责后端引擎与服务，同事负责交互与用户体验；其余职责待认领。
- [决策记录](docs/decisions.md)：已确定的边界与待裁定事项。
- [五小时计划](docs/hackathon-plan.md)：开发、验收和展示节奏。
- [冻结案例与最小联调接口](docs/demo-case-and-contract.md)：M1–M4 合成材料、预期版本和前后端交接点。

## 本机 mock 服务

在 `work/engine-service` 分支的仓库根目录运行：

```sh
python3 -m engine.server --port 8000 --db var/spark.db
```

服务只绑定 `127.0.0.1`，地址为 `http://127.0.0.1:8000/api/v1`。默认数据库 `var/spark.db` 在本地持久化并被 Git 忽略；首次演示请使用空数据库。需重演时传入另一个新的 `--db` 路径，避免覆盖现有项目。前端现有 API client 可连接该地址。没有额外 Python 依赖或模型密钥。

```sh
python3 -m unittest discover -s tests -v
python3 tests/http_smoke.py
```

第二条命令要求服务已启动且数据库为空，会导入四份合成材料。代码已经实现单项目、材料导入和原文段落定位、同步完成的分析任务、三版历史、按场次去重的演示重要性评分、Markdown 导出和 SQLite 恢复。`engine_mode` 始终为 `mock`；该引擎只识别冻结案例的精确原话，其余材料不足时明确返回 `insufficient_evidence`。首轮纠错接口返回 `501 NOT_IMPLEMENTED`，不会假装保存成功；真实 AI 分析、正式规则核验和同场多材料分组尚未实现。`meeting_id` 可选，缺省时服务为每份材料单独建场，当前仅适用一场一份材料。

## 工作约定

每个结果都能追到输入片段；材料中的事实、他人观点、AI 推断和已批准行动分开存放与显示。未提到某话题不等于不感兴趣，没有依据就可以没有新火花。所有任务须先在协作文档认领，今天优先完成可演示的纵向闭环。

## 两人并行开发

私有 GitHub 仓库：`https://github.com/Capsio-Michael/spark-collision-product`。获得仓库访问权限后，同事可执行 `git clone https://github.com/Capsio-Michael/spark-collision-product.git`。`main` 放已确认的共同基线；`work/product-definition` 保留定义阶段记录。建议用户在 `work/engine-service` 开发后端引擎与服务，同事在 `work/interaction-ux` 开发交互与用户体验；两人先按 [协作分工](docs/collaboration.md) 约定最小接口，再各自提交到自己的分支，通过 Pull Request 合入 `main`。分支只表示工作范围，不代表任务已经实现。

上一级目录的 `spark-collision-product-docs.zip` 适合离线阅读定义文档；`spark-collision-product.bundle` 是创建远程仓库之前的本地历史备份，后续协作请以 GitHub 为准。不要提交凭据或客户私密材料。
