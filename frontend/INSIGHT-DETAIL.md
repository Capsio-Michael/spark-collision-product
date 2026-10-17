# 完整认知碰撞卡详情 · 本地交付说明

日期：2026-10-17。范围：完整详情、原话核查、合成示例，以及最新总览详情中的判断确认／纠错／分歧处理。真实分析和实际保存依赖引擎服务；历史模块由另一窗口实现，历史入口打开的详情保持只读。操作交付见 [判断纠错说明](JUDGMENT-CORRECTIONS.md)。

## 如何体验

沿用已有前端预览服务。在项目总览切换到“客户服务 AI 试点研究 · 示例”，点击首页“查看判断”或任意关注点标题。

- “自动化的边界，应该由业务风险决定”：完整 A→B→C→D→V 碰撞卡。
- “等待审批，可能比生成报价更值得先验证”：当前判断与候选解释对照，保留待确认状态。
- “认可试点方向，还不等于批准上线”：关键事实，没有强行生成认知突破。
- “风险分流可以成为复用方向，但还不是共性结论”：产品化假设与独立案例验证。

电脑端为宽版双栏详情，左侧阅读、右侧核查；小于等于 800px 时上下排列，可通过固定章节按钮跳转。点击引用后读取真实对应的合成原文，验证材料 ID、段落和引文匹配才高亮。分析文字始终保留，不被原文抽屉替换。

验证建议可展开实验、支持判据、推翻判据、所需材料、访谈角色与后续决定。缺失负责人／时间显示待指定／待商定；确认判断与执行行动是不同的概念，本模块不提交任何行动。

## 文件与接入

| 文件 | 用途 |
| --- | --- |
| src/insight-detail.js | 独立原生 dialog、分析展示、证据和原文交互 |
| src/insight-detail-model.js | 版本校验、关系筛选、引用校验、异步竞争与关闭保护 |
| src/insight-detail.css | cd 前缀的局部样式；首次打开时动态加载 |
| src/fixtures/insight-details.js | 仅用于示例项目的完整合成详情；不补全真实结果 |
| tests/insight-detail.test.mjs | 详情的边界、引用、并发与渲染测试 |

app.js 接入 openInsight 和 openLiveInsight 两处入口；真实详情通过 corrections 选项接收保存与刷新回调。历史入口显式传入 readOnly=true。不修改 material-editor、material-list、material-workflow 或全局样式。package.json 的测试脚本为 `node --test`，自动发现各模块测试。

```js
openInsightDetail({
  insightId,
  version, // 与用户正在查看的总览保持同一快照
  mode: 'live', // 或明确标记的 mock
  loadDetail: () => api.insight(projectId, insightId, version),
  loadRecord: recordId => api.record(projectId, recordId),
});
```

保持这两个入口即可与材料导入窗口继续集成；原文使用后端段落 ID，不依赖浏览器重新切分。详情缺失时显示缺口；collision_card=null 时展示关键事实／机会；不把合成数据套到用户真实材料上。

## 验证与限制

执行 `npm test` 或 `node --test`。引擎方尚需提供真实 InsightDetail 与 RecordDetail，按接口契约联调；通过合成用例不代表模型分析质量已验收。

本窗口已完成的浏览器检查与自动测试结果随实际检查记录在交付消息中。模块提供加载／失败重试、候选对照、引用缺失、未知字段占位、Escape 关闭与焦点恢复。桌面双栏与手机布局由 CSS 响应式规则切换。
