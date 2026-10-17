# 认知历史与详情模块的集成边界

历史负责：`frontend/src/history-model.js`、`history-view.js`、`history.css`、`fixtures/history.js`、`tests/history.test.mjs`。

详情由另一位 agent 开发，历史模块不改写 `insight-detail*` 或 `fixtures/insight-details.js`。共享 app.js 只增加历史入口、路由及模块挂载；不覆盖详情方的导入和打开函数。首页最新合成版本仍为 v2。

历史通过已有 `openInsightDetail({insightId, version, mode, example, loadDetail, loadRecord})` 打开所选版本完整详情。example=true 区分手工合成示例与模拟引擎响应。历史提供固定版本的读取函数，不能调用默认“最新”详情代替旧版。较早合成版本没有碰撞卡时如实展示，不拿 v2 的卡填充 v1。

真实数据读取：GET versions → 固定版本 overview → 固定版本 insight；引用读取使用所选版本的 evidence，再按其 record_id 和 segment_id 核查原文。历史全程只读，不调用 corrections 或 analyses。

history CSS 以 hh- 前缀隔离。模块上下文由 workspace、project_id、base_url 区分，切换项目关闭旧 session，迟到请求不能写入新页面。

第一版不增加接口字段，不改变 v0.1 契约；合成历史明确标识为手工构造的交互示例。真实引擎联调状态需单独记录。

## 本轮验证

- 历史模块新增 10 项测试：版本排序、集合比较、候选保护、未来证据隔离、多版本变化链、缺失与错误区分、串版拒绝、迟到请求、空历史、无变化和引文核查。
- 连同已有材料与详情测试，本轮共 40 项通过；不代表真实引擎或模型验收。
- 浏览器已检查：默认 v1→v2、变化／全部字段切换、较早不存在的关注点、独立候选、变化原因原文高亮、从 v1 打开 v1 完整详情、仅首次版本显示。真实历史服务待联调。
