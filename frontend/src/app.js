import { icon } from './icons.js';
import { SPARK_FILTERS } from './spark-model.js';
import { renderSparkCard, renderSparkLegend } from './spark-view.js';
import { DIMENSIONS, TYPE_LABELS, SOURCE_LABELS, escapeHtml as e, filterInsights, characterCount } from './core.js';
import { getDemoOverview, demoRecords, demoPrompts } from './fixtures/demo.js';
import { renderDemoStages, renderDemoSpotlight, renderDemoAttention } from './demo-view.js';
import { renderInsightMetrics } from './insight-metrics.js';
import { MaterialWorkflow } from './material-workflow.js';
import { openMaterialEditor } from './material-editor.js';
import { renderOwnMaterials, materialRows } from './material-list.js';
import { openInsightDetail } from './insight-detail.js';
import { getDemoInsightDetail, getDemoDetailRecord } from './fixtures/insight-details.js';
import { createHistoryView } from './history-view.js';
import { openExportDialog } from './export-view.js';
import { createMarkdownExporter } from './api/export.js';
import { demoExportSource } from './fixtures/export.js';
import { renderProjectOverview, renderProjectInsights, renderProjectDimension } from './overview-view.js';
import { filterProjectInsights, displayCount } from './overview-model.js';
import { validateSource } from './insight-detail-model.js';
import { getDesignSnapshot, designMarkdown } from './design-review-model.js';
import { renderDesignOverview, renderDesignMaterials, renderDesignHistory, openDesignInsight } from './design-review-view.js';
import { createFrogAssistant } from './frog-assistant.js';
import { createAgentConversation } from './agent-conversation.js';

let storage;
try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error('Storage unavailable'); }, setItem() { throw new Error('Storage unavailable'); } }; }
const workflow = new MaterialWorkflow(storage, { onChange: () => shell() });
let preferredWorkspace;
try { preferredWorkspace = storage.getItem('spark-collision:workspace'); } catch { /* Draft storage warning is surfaced below. */ }
const state = {
  workspace: ['design', 'demo', 'own'].includes(preferredWorkspace) ? preferredWorkspace : 'own',
  designVersion: 1,
  view: workspaceView(), filter: 'all', query: '',
  overview: getDemoOverview(), drafts: workflow.state.drafts, storageError: workflow.storageError,
  selectedMaterials: new Set(), liveEvidence: [],
  knowledgeDetail: null, knowledgeLoading: false, knowledgeError: '',
};
const app = document.querySelector('#app');
const overlay = document.querySelector('#overlay-root');
const agent = createAgentConversation({ storage, workflow, onRender: () => { if (state.view === 'chat') shell(); }, onPoll: delay => schedulePolling(delay), onInsight: id => { state.workspace = 'own'; openLiveInsight(id); }, onEvidence: citation => { state.workspace = 'own'; openServerRecord(citation.record_id, citation); }, onKnowledge: id => { state.workspace = 'own'; location.hash = `knowledge/${encodeURIComponent(id)}`; }, onOverview: () => { state.view = 'overview'; setWorkspace('own'); location.hash = 'overview'; }, onConnect: () => openConnection() });
const assistant = createFrogAssistant({ storage, getContext: () => ({ workspace: state.workspace, connected: workflow.connected, activeJob: workflow.state.active_job, lastJob: workflow.state.last_job, overview: workflow.state.overview, error: workflow.error, hasMaterials: materialRows(workflow).length > 0, engineMode: workflow.health?.engine_mode || workflow.state.overview?.engine_mode, projectId: workflow.state.project?.id }) });
const historyView = createHistoryView({
  getContext: () => ({ workspace: state.workspace, projectId: state.workspace === 'demo' ? 'prj_demo' : workflow.state.project?.id, baseUrl: state.workspace === 'demo' ? 'synthetic' : workflow.state.base_url, connected: state.workspace === 'demo' || workflow.connected, api: workflow.api }),
  onOpenDetail: options => { closeDialog(); openInsightDetail({ ...options, readOnly: true }); },
  onConnect: () => openConnection(), onSample: () => setWorkspace('demo'),
});
let returnFocus = null;
let activeExport = null, activeExportContext = null;
function workspaceView() { return location.hash.startsWith('#knowledge/') ? 'knowledge' : location.hash === '#history' ? 'history' : location.hash === '#materials' ? 'materials' : location.hash === '#overview' ? 'overview' : 'chat'; }
function currentKnowledgeId() { try { return decodeURIComponent(location.hash.slice('#knowledge/'.length)); } catch { return ''; } }
async function loadKnowledge() {
  const id = currentKnowledgeId(), projectId = workflow.state.project?.id;
  if (!id || !projectId || !workflow.connected) { state.knowledgeError = '无法读取这条洞察，请先连接本机服务'; state.knowledgeLoading = false; shell(); return; }
  state.knowledgeDetail = null; state.knowledgeError = ''; state.knowledgeLoading = true; shell();
  try {
    const detail = await workflow.api.knowledgeItem(projectId, id);
    if (state.view !== 'knowledge' || currentKnowledgeId() !== id || workflow.state.project?.id !== projectId) return;
    if (detail?.item?.id !== id) throw new Error('返回的洞察与所选卡片不一致');
    if (detail.full_detail) {
      const { insight_id: insightId, snapshot_version: version } = detail.full_detail;
      const full = await workflow.api.insight(projectId, insightId, version);
      if (full?.id !== insightId || full.snapshot_version !== version) throw new Error('完整分析与所选洞察版本不一致');
      detail.full_analysis = full;
    }
    state.knowledgeDetail = detail;
  } catch (error) { state.knowledgeError = error.message; }
  finally { state.knowledgeLoading = false; if (state.view === 'knowledge' && currentKnowledgeId() === id) shell(); }
}
function renderKnowledgeShell() {
  const detail = state.knowledgeDetail, item = detail?.item;
  const kind = item?.origin === 'kimi' ? 'Kimi 引文分析' : '合成案例模拟结果';
  const refs = detail?.citations || [];
  const full = detail?.full_analysis;
  const relations = { supports: '支持', qualifies: '补充条件', challenges: '质疑', contradicts: '反例', agrees: '认同' };
  const detailed = full ? `<div class="knowledge-columns knowledge-extra"><section class="knowledge-section"><h2>会议内与跨会议标注</h2>${full.annotations?.length ? full.annotations.map(annotation => `<p>${e(annotation.meeting_id)} · ${e(relations[annotation.relation] || annotation.relation)}${annotation.condition ? ` · 条件：${e(annotation.condition)}` : ''}</p>`).join('') : '<p>暂无结构化标注</p>'}<h2>覆盖与重要性</h2><p>记录覆盖 ${e(full.coverage?.supporting_record_count ?? '未知')} / ${e(full.coverage?.total_analyzed_record_count ?? '未知')} · 会议 ${e(full.meeting_coverage?.distinct_meeting_count ?? '未知')} 场</p><p>${full.importance ? `示例优先阅读分数 ${e(full.importance.score)} / ${e(full.importance.max_score)} · ${e(full.importance.note)}` : '暂无有依据的重要性分数'}</p><p>趋同状态：${e({ conditions_unresolved: '条件仍待厘清', conditional_convergence: '有条件趋同', disputed: '仍有分歧' }[full.convergence_status] || '尚未判定')}</p></section><section class="knowledge-section"><h2>解释边界</h2><p>${e(full.judgment?.rationale || '暂无解释说明')}</p><h2>其他解释</h2>${full.judgment?.alternative_explanations?.length ? `<ul>${full.judgment.alternative_explanations.map(value => `<li>${e(value)}</li>`).join('')}</ul>` : '<p>暂无其他解释</p>'}<h2>下一步验证问题</h2>${full.validations?.length ? full.validations.map(value => `<p>${e(value.question)} · ${e(value.status === 'proposed' ? '建议待确认，非已批准行动' : value.status)}</p>`).join('') : '<p>暂无建议</p>'}</section></div>` : '';
  app.innerHTML = `${sidebar()}<div class="workspace knowledge-workspace"><header class="topbar"><a class="text-button" href="#chat">← 返回对话</a><span class="mode">${item ? e(kind) : '洞察详情'}</span></header><main id="main-content" tabindex="-1" class="knowledge-main">${state.knowledgeLoading ? '<p>正在读取完整分析…</p>' : state.knowledgeError ? `<div class="alert" role="alert">${e(state.knowledgeError)} <button class="button secondary" data-action="retry-knowledge">重试读取</button></div>` : item ? `<div class="eyebrow">INSIGHT DETAIL · ${e(item.version_kind === 'agent_round' ? '独立分析轮次' : '项目快照')} ${e(item.version)}</div><h1>${e(item.title)}</h1><p class="knowledge-lead">${e(detail.judgment)}</p><div class="knowledge-provenance"><span>${e(kind)}</span><span>结果 ID ${e(item.id)}</span><span>${e(item.provenance?.model || item.provenance?.provider || '')}</span></div><div class="knowledge-columns"><section class="knowledge-section"><h2>这次理解了什么</h2><p>${e(item.one_line)}</p><h2>成立条件</h2>${detail.conditions?.length ? `<ul>${detail.conditions.map(condition => `<li>${e(condition)}</li>`).join('')}</ul>` : '<p>暂无单独标注的条件，需结合原话核查</p>'}<h2>追问与回应</h2><p>${e(detail.question_response_status)}</p><h2>跨会议变化</h2><p>${item.origin === 'kimi' ? '独立分析结果，尚未接入跨会议版本关系；不能据此判定趋同或重要性分数' : '本条来自项目模拟快照，可到项目总览核查版本与变化'}</p>${item.origin === 'mock' ? '<a class="button secondary" href="#overview">查看项目总览</a>' : ''}</section><section class="knowledge-section"><h2>原话依据 · ${refs.length} 条</h2>${refs.length ? refs.map((ref, index) => `<button type="button" class="knowledge-citation" data-knowledge-citation="${index}"><span>证据 ${index + 1} · ${e(ref.source_title)} · ${e(ref.segment_id)}</span><strong>“${e(ref.quote)}”</strong><em>定位原文 ↗</em></button>`).join('') : '<p>当前没有可展示的引文</p>'}</section></div>${detailed}` : '<p>请选择一条洞察卡片查看详情</p>'}</main></div>`;
}

function exportContextKey() { return JSON.stringify([state.workspace, workflow.state.project?.id, workflow.state.base_url, workflow.connected]); }
function openExport() {
  if (state.workspace === 'design') {
    const blob = new Blob([designMarkdown(state.designVersion)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `design-review-synthetic-v${state.designVersion}.md`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); return;
  }
  activeExport?.close(); closeDialog();
  const isDemo = state.workspace === 'demo', projectId = workflow.state.project?.id, api = workflow.api;
  const preferredVersion = state.view === 'history' ? historyView.getSelectedVersion() : (isDemo ? state.overview.snapshot_version : workflow.state.overview?.snapshot_version) || null;
  const exporter = !isDemo && workflow.connected ? createMarkdownExporter(workflow.state.base_url) : null;
  const source = isDemo ? demoExportSource : projectId && workflow.connected ? {
    projectId, loadVersions: () => api.versions(projectId), loadOverview: version => api.overview(projectId, version),
    loadRecord: id => api.record(projectId, id), loadExport: (version, signal) => exporter(projectId, version, signal),
  } : null;
  activeExportContext = exportContextKey();
  const opened = openExportDialog({ source, preferredVersion, example: isDemo,
    projectName: isDemo ? state.overview.project.name : workflow.state.project?.name || '我的调研项目',
    onConnect: () => openConnection(), onSample: () => { setWorkspace('demo'); openExport(); },
    onClose: () => { if (activeExport === opened) activeExport = null; },
  });
  activeExport = opened;
}

const badge = (text, color = 'neutral') => `<span class="badge badge-${color}">${e(text)}</span>`;
const typeBadge = judgment => badge(TYPE_LABELS[judgment.epistemic_type] || '类型待确认', { fact: 'green', opinion: 'blue', inference: 'purple', hypothesis: 'amber' }[judgment.epistemic_type] || 'neutral');
const pill = text => `<span class="condition">${e(text)}</span>`;
function announce(text) { document.querySelector('#announcer').textContent = text; }
function notify(text) {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div'); toast.className = 'toast'; toast.setAttribute('role', 'status');
  toast.textContent = text; document.body.append(toast); setTimeout(() => toast.remove(), 5000);
}

function sidebar() {
  return `<aside class="sidebar" aria-label="项目导航">
    <a class="brand" href="#chat" aria-label="智慧火花碰撞首页"><span class="brand-icon">${icon('spark')}</span><span>智慧火花碰撞<small>SPARK COLLISION</small></span></a>
    <div class="project-switch"><label for="workspace-select">当前项目</label><div class="select-wrap"><select id="workspace-select"><option value="design" ${state.workspace === 'design' ? 'selected' : ''}>设计评审 · 预置演示</option><option value="demo" ${state.workspace === 'demo' ? 'selected' : ''}>报价授权边界调研 · 示例</option><option value="own" ${state.workspace === 'own' ? 'selected' : ''}>${e(workflow.state.project?.name || '我的调研项目')}</option></select>${icon('down')}</div></div>
    <div class="nav-label">工作空间</div>
    <nav>
      <a href="#chat" class="nav-item ${state.view === 'chat' ? 'active' : ''}" ${state.view === 'chat' ? 'aria-current="page"' : ''}>${icon('spark')}<span>与 Sparky 对话</span></a>
      <a href="#overview" class="nav-item ${state.view === 'overview' ? 'active' : ''}" ${state.view === 'overview' ? 'aria-current="page"' : ''}>${icon('grid')}<span>项目总览</span></a>
      <a href="#materials" class="nav-item ${state.view === 'materials' ? 'active' : ''}" ${state.view === 'materials' ? 'aria-current="page"' : ''}>${icon('file')}<span>材料列表</span><span class="nav-count">${state.workspace === 'demo' ? state.overview.source_record_ids.length : materialRows(workflow).length}</span></a>
      <a href="#history" class="nav-item ${state.view === 'history' ? 'active' : ''}" ${state.view === 'history' ? 'aria-current="page"' : ''}>${icon('history')}<span>认知历史</span></a>
    </nav>
    <div id="assistant-slot" aria-label="Sparky 小青蛙助手"></div>
    <div class="sidebar-bottom"><div class="principle-mark">${icon('quote')}</div><p>让每一次交流，<br>都有迹可循。</p><span>证据 · 认知 · 验证</span><div class="sidebar-note">${icon('info')}<span>${workflow.connected ? '引擎已连接，<br>草稿与已提交材料分开显示。' : '当前为交互预览，<br>可连接本机分析引擎。'}</span></div></div>
  </aside>`;
}

function shell() {
  if (state.view === 'chat') { historyView.deactivate(); app.innerHTML = agent.render(); const feed = app.querySelector('#agent-feed'); if (feed) feed.scrollTop = feed.scrollHeight; return; }
  if (state.view === 'knowledge') { historyView.deactivate(); renderKnowledgeShell(); return; }
  if (state.workspace === 'design') { renderDesignShell(); return; }
  if (activeExport && activeExportContext !== exportContextKey()) activeExport.close();
  state.drafts = workflow.state.drafts;
  const isDemo = state.workspace === 'demo';
  app.innerHTML = `${sidebar()}<div class="workspace"><header class="topbar"><div class="breadcrumb">工作空间<span>/</span><strong>${state.view === 'history' ? '认知历史' : state.view === 'overview' ? '项目总览' : '材料列表'}</strong></div><div class="topbar-right"><span class="mode"><i></i>${isDemo ? '合成案例' : workflow.state.overview?.snapshot_version ? (workflow.state.overview.engine_mode === 'mock' ? '模拟引擎结果' : '引擎结果') : workflow.state.server_records.length ? '项目材料' : '本地草稿'}</span><button class="text-button engine-top-button" data-action="connect">${icon(workflow.connected ? 'check' : 'link')}${workflow.connected ? '引擎已连接' : '连接引擎'}</button><span class="avatar" aria-label="个人工作空间">我</span></div></header>
    <main id="main-content" tabindex="-1"><div class="page-heading"><div><div class="eyebrow">PROJECT ${state.view === 'history' ? 'HISTORY' : state.view === 'overview' ? 'OVERVIEW' : 'MATERIALS'}</div><h1>${isDemo ? e(state.overview.project.name) : e(workflow.state.project?.name || '我的调研项目')}</h1><p>${state.view === 'history' ? '对照每次判断，核查变化的条件与依据。' : state.view === 'overview' ? '从每次交流中，看见判断如何改变。' : '保留完整上下文，让每一条判断都能回到原话。'}</p></div><div class="heading-actions"><button class="button secondary export-button" data-action="export">${icon('download')}导出结果</button><button class="button primary" data-action="import">${icon('plus')}上传资料</button></div></div>
    <div class="preview-note">${icon('info')}<span>${isDemo ? `当前展示 v${state.overview.snapshot_version} 的 ${state.overview.source_record_ids.length} 场合成讨论；预设快照用于演示，不是真实 AI 自动分析。` : workflow.state.server_records.length ? '已提交材料与引擎同步，未提交草稿仍保存在当前浏览器。' : '未提交材料只保存在当前浏览器，可以连接引擎后再提交分析。'}</span>${isDemo ? '<button data-action="own" class="text-button">打开我的项目 ' + icon('arrow') + '</button>' : '<button data-action="demo" class="text-button">查看示例 ' + icon('arrow') + '</button>'}</div>
    ${state.storageError ? `<div class="alert" role="alert">${e(state.storageError)}</div>` : ''}
    ${workflow.cacheWarning ? `<div class="alert" role="alert">${e(workflow.cacheWarning)}</div>` : ''}
    ${state.view === 'history' ? '<div id="history-root"></div>' : state.view === 'materials' ? renderMaterials() : isDemo ? renderOverview() : renderOwnOverview()}
    <footer class="page-footer"><span>${icon('spark')}智慧火花碰撞</span><span>保持事实、观点与推断的边界</span></footer>
    </main></div>`;
  if (state.view === 'history') historyView.renderInto(document.querySelector('#history-root'));
  else historyView.deactivate();
  assistant.sync();
}

function renderDesignShell() {
  if (activeExport) activeExport.close();
  historyView.deactivate();
  const snapshot = getDesignSnapshot(state.designVersion);
  const designSidebar = sidebar();
  app.innerHTML = `${designSidebar}<div class="workspace"><header class="topbar"><div class="breadcrumb">设计评审<span>/</span><strong>预置演示 · v${state.designVersion}</strong></div><span class="mode">合成文字／预置标注</span></header><main id="main-content" tabindex="-1"><div class="page-heading"><div><div class="eyebrow">DESIGN REVIEW</div><h1>${e(snapshot.project)}</h1><p>从一句“大气”，看见多轮讨论如何形成有条件的理解。</p></div><div class="heading-actions"><button class="button secondary" data-action="export">${icon('download')}导出本版示例</button><button class="button primary" data-action="import">${icon('plus')}上传资料</button></div></div><div class="preview-note">${icon('info')}<span>本页使用伙伴提供的预写标注，非实时 AI 分析。上传新资料进入“我的项目”；现有模拟引擎不会自动生成本案例洞察。</span></div>${state.view === 'materials' ? renderDesignMaterials(state.designVersion) : state.view === 'history' ? renderDesignHistory(state.designVersion) : renderDesignOverview(state.designVersion)}<footer class="page-footer"><span>智慧火花碰撞</span><span>原话 · 条件 · 理解的变化</span></footer></main></div>`;
  const count = app.querySelector('.nav-count'); if (count) count.textContent = snapshot.records.length;
  assistant.sync();
}

function renderOverview() {
  const overview = state.overview;
  const breakthroughs = overview.changes.filter(change => change.is_breakthrough).length;
  const stats = [
    ['file', '材料已覆盖', String(overview.source_record_ids.length).padStart(2, '0'), '份合成记录', 'blue'],
    ['bulb', '关键关注点', String(overview.insights.length).padStart(2, '0'), '项有据可查', 'purple'],
    ['spark', '本次认知变化', String(breakthroughs).padStart(2, '0'), '项判断被细化', 'orange'],
    ['branch', '待确认分歧', String(overview.pending_confirmation_count).padStart(2, '0'), '项保留不同解释', 'amber'],
  ];
  return `${renderDemoStages(overview)}<section class="stat-grid" aria-label="项目概况">${stats.map(([symbol, label, value, note, color]) => `<div class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon tone-${color}">${icon(symbol)}</span></div><div class="stat-value">${value}<span>${note}</span></div></div>`).join('')}</section>
    <div class="content-grid"><div class="primary-column">${renderDemoSpotlight(overview)}
    <section class="insights-section" aria-labelledby="insights-heading"><div class="section-heading"><div><h2 id="insights-heading">关键关注点 <span class="heading-count">${overview.insights.length}</span></h2><p>按问题组织，保留证据与不同解释。</p></div></div><div class="insight-toolbar"><div class="filter-tabs" role="group" aria-label="筛选关注点">${SPARK_FILTERS.map(([key, label]) => `<button data-filter="${key}" class="filter-tab ${state.filter === key ? 'selected' : ''}" aria-pressed="${state.filter === key}">${label}</button>`).join('')}</div><label class="search-box">${icon('search')}<span class="sr-only">搜索关注点</span><input id="insight-search" type="search" placeholder="搜索关注点" value="${e(state.query)}" maxlength="100" autocomplete="off"></label></div>${renderSparkLegend()}<div id="insight-results" class="insight-list">${renderInsightCards()}</div></section></div>
    <aside class="secondary-column"><section class="panel validation-panel" aria-labelledby="validation-heading"><div class="panel-title"><span class="panel-symbol tone-orange">${icon('target')}</span><h2 id="validation-heading">下一步，验证什么？</h2></div><p class="panel-description">优先补齐能改变决策的证据。</p>${demoPrompts.map((prompt, index) => `<button class="validation-item" data-insight="${prompt.insight_id}"><span class="step-number">0${index + 1}</span><span><strong>${e(prompt.title)}</strong><span class="validation-description">${e(prompt.description)}</span><span class="validation-status">负责人待指定 · 时间待商定</span></span>${icon('arrow')}</button>`).join('')}<div class="panel-footnote">${icon('info')}验证建议尚未成为已批准行动。</div></section>
    <section class="panel dimension-panel" aria-labelledby="dimension-heading"><div class="panel-title"><span class="panel-symbol tone-purple">${icon('grid')}</span><h2 id="dimension-heading">六个分析视角</h2></div><p class="panel-description">看见发现，也看见尚未知道的部分。</p><div class="dimension-list">${DIMENSIONS.map(([key, label], index) => `<button class="dimension-row" data-dimension="${key}"><span class="dimension-index">0${index + 1}</span><span>${label}</span>${badge(overview.dimensions.find(item => item.key === key)?.status === 'available' ? '有证据覆盖' : '证据不足', overview.dimensions.find(item => item.key === key)?.status === 'available' ? 'green' : 'neutral')}${icon('arrow')}</button>`).join('')}</div><p class="dimension-note">合成示例用于说明分析结构，不代表真实业务结论。</p></section>
    <section class="reading-note"><span class="note-icon">${icon('quote')}</span><h3>有依据，也有边界</h3><p>客户的自述，是已记录的说法。<br>AI 的解释，需要证据与验证。</p></section></aside></div>`;
}

function renderInsightCards() {
  const insights = filterInsights(state.overview.insights, state.query, state.filter, state.overview.evidence, state.overview.snapshot_version);
  if (!insights.length) return `<div class="search-empty">${icon('search')}<strong>没有匹配的关注点</strong><p>试试其他关键词，或切换到“全部”。</p><button class="button secondary" data-action="clear-filter">清除筛选</button></div>`;
  return insights.map((insight, index) => `<article class="insight-card"><div class="insight-top"><span class="insight-index">${String(state.overview.insights.indexOf(insight) + 1).padStart(2, '0')}</span><div class="insight-badges">${typeBadge(insight.judgment)}${insight.dispute_status === 'open' ? badge('存在分歧', 'amber') : insight.last_change.is_breakthrough ? badge('认知变化', 'orange') : ''}</div><span class="review-label">${insight.judgment.review_status === 'confirmed' ? '已确认' : '待核查'}</span></div><button class="card-title" data-insight="${insight.id}"><h3>${e(insight.title)}</h3>${icon('arrow')}</button>${renderDemoAttention(insight)}<p class="judgment-text">${e(insight.judgment.text)}</p><div class="conditions">${insight.judgment.conditions.map(pill).join('')}</div>${renderInsightMetrics(insight)}${renderSparkCard(insight, state.overview.evidence, state.overview.snapshot_version)}<div class="insight-bottom"><div class="evidence-chips">${insight.judgment.evidence_ids.map(id => `<button class="evidence-chip" data-evidence="${id}" aria-label="查看证据 ${state.overview.evidence.find(item => item.id === id)?.label}">${icon('link')}${e(state.overview.evidence.find(item => item.id === id)?.label)}</button>`).join('')}</div><span>${insight.coverage.supporting_record_count} / ${insight.coverage.total_analyzed_record_count} 份材料覆盖</span></div></article>`).join('');
}

function renderEmpty() {
  const count = materialRows(workflow).length;
  return `<section class="empty-workspace"><div class="empty-art" aria-hidden="true"><div class="empty-sheet">${icon('file')}<i></i><i></i><i></i></div><span class="empty-spark">${icon('spark')}</span></div><span class="eyebrow">${count ? 'MATERIALS READY' : 'START WITH A CONVERSATION'}</span><h2>${count ? `${count} 份材料草稿，等待开始研究` : '从一份真实的交流开始'}</h2><p>${count ? '草稿已保存在当前浏览器。接入引擎后，我们将从材料中提炼有证据的判断。' : '导入访谈、会议或调研记录。把分散的讨论，逐步沉淀为可核查的项目认知。'}</p><div class="empty-actions"><button class="button primary" data-action="${count ? 'materials' : 'import'}">${icon(count ? 'file' : 'plus')}${count ? '查看材料草稿' : '导入第一份材料'}</button><button class="button secondary" data-action="demo">先看看示例 ${icon('arrow')}</button></div><div class="empty-steps">${[['file', '保留原始材料'], ['bulb', '发现判断变化'], ['link', '回到原话核查']].map(([symbol, label], index) => `<span>${icon(symbol)}${label}</span>${index < 2 ? icon('arrow', 'step-arrow') : ''}`).join('')}</div></section>
    <section class="empty-explainer"><h3>每个结论，都应有依据。</h3><p>我们会区分事实、观点、推断与假设；没有证据的地方，明确标注尚待验证。</p>${count ? '<div class="draft-notice">' + icon('clock') + '尚未连接引擎 · 暂不生成分析结果</div>' : ''}</section>`;
}

function renderMaterials() {
  const isDemo = state.workspace === 'demo';
  if (!isDemo) return renderOwnMaterials(workflow, state.selectedMaterials);
  const records = isDemo ? demoRecords.filter(item => state.overview.source_record_ids.includes(item.id)) : state.drafts;
  if (!records.length) return renderEmpty();
  return `<section class="panel materials-panel"><div class="section-heading"><div><h2>项目材料 <span class="heading-count">${records.length}</span></h2><p>${isDemo ? `合成案例 · v${state.overview.snapshot_version} 范围 · 已关联原话证据` : '仅保存在当前浏览器 · 尚未提交引擎'}</p></div>${!isDemo ? '<button class="button secondary" disabled>开始分析 · 待接入引擎</button>' : ''}</div><div class="material-list">${records.map((record, index) => `<article class="material-row"><span class="material-symbol">${icon('file')}</span><div class="material-info"><button class="material-title" ${isDemo ? `data-record="${record.id}"` : `data-draft="${index}"`}>${e(record.title)}</button><p>${e(SOURCE_LABELS[record.source_type] || '材料')}<span>·</span>${e(record.source_date || '日期未提供')}<span>·</span>${characterCount(record.content).toLocaleString()} 字符</p></div>${badge(record.material_basis === 'synthetic' ? '合成材料' : '已获授权', 'neutral')}<span class="material-state">${icon(isDemo ? 'check' : 'clock')}${isDemo ? '示例已覆盖' : '本地待提交'}</span><button class="icon-button" ${isDemo ? `data-record="${record.id}"` : `data-draft="${index}"`} aria-label="查看${e(record.title)}">${icon('arrow')}</button></article>`).join('')}</div></section>`;
}

function setWorkspace(workspace) {
  state.workspace = workspace; state.filter = 'all'; state.query = '';
  try { storage.setItem('spark-collision:workspace', workspace); } catch { /* Preference only; never hides a draft save failure. */ }
  shell();
}

function openDialog(content, className = 'modal') {
  const previousDialog = overlay.querySelector('dialog[open]');
  const originalFocus = previousDialog ? returnFocus : document.activeElement;
  closeDialog(); returnFocus = originalFocus;
  overlay.innerHTML = `<dialog class="${className}" aria-labelledby="dialog-title">${content}</dialog>`;
  const dialog = overlay.querySelector('dialog');
  dialog.addEventListener('close', () => {
    if (overlay.contains(dialog)) {
      overlay.replaceChildren();
      if (originalFocus?.isConnected) originalFocus.focus();
      else document.querySelector('#main-content')?.focus();
    }
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  dialog.showModal();
  return dialog;
}
function closeDialog() { overlay.querySelector('dialog[open]')?.close(); }
const dialogHeader = (eyebrow, title) => `<div class="dialog-header"><div><span class="eyebrow">${eyebrow}</span><h2 id="dialog-title">${e(title)}</h2></div><button class="icon-button" data-action="close" aria-label="关闭面板">${icon('close')}</button></div>`;

function openInsight(id, showSpark = false) {
  if (!state.overview.insights.some(item => item.id === id)) return;
  closeDialog();
  openInsightDetail({ insightId: id, version: state.overview.snapshot_version, mode: 'mock', example: true, showSpark,
    loadDetail: () => getDemoInsightDetail(id, state.overview.snapshot_version), loadRecord: getDemoDetailRecord });
}

function openRecord(recordId, evidenceId) {
  const record = demoRecords.find(item => item.id === recordId); if (!record) return;
  const evidence = state.overview.evidence.find(item => item.id === evidenceId);
  const dialog = openDialog(`${dialogHeader('SOURCE · 原始材料', record.title)}<div class="drawer-body"><div class="source-metadata">${badge('合成材料', 'orange')}<span>${e(SOURCE_LABELS[record.source_type])} · ${e(record.source_date || '日期未提供')}</span></div><p class="source-filename">${e(record.source_name)}${evidence ? ' · 引用 ' + evidence.label : ''}</p><div class="source-paragraphs">${record.segments.map(segment => `<section id="${segment.id}" class="source-paragraph ${evidence?.segment_id === segment.id ? 'highlighted' : ''}"><span class="paragraph-number">段落 ${segment.paragraph_index}</span><p>${e(segment.text)}</p>${evidence?.segment_id === segment.id ? '<span class="highlight-label">' + icon('link') + '当前引用所在段落</span>' : ''}</section>`).join('')}</div><p class="small-note">按原文段落定位，整段高亮。材料未经改写。</p></div>`, 'drawer');
  if (evidence) requestAnimationFrame(() => dialog.querySelector('.highlighted')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
}

function openDraft(index) {
  const record = state.drafts[index]; if (!record) return;
  openDialog(`${dialogHeader('LOCAL DRAFT · 本地草稿', record.title)}<div class="drawer-body"><div class="source-metadata">${badge('尚未提交', 'amber')}${badge(record.material_basis === 'synthetic' ? '合成材料' : '已获授权')}</div><p class="small-note">原始内容仅存于当前浏览器，尚未分析。</p><pre class="draft-content">${e(record.content)}</pre></div>`, 'drawer');
}

function openDimension(key) {
  const dimension = state.overview.dimensions.find(item => item.key === key); if (!dimension) return;
  const label = DIMENSIONS.find(([name]) => name === key)[1];
  openDialog(`${dialogHeader('ANALYSIS VIEW · 合成案例', label)}<div class="drawer-body">${dimension.findings.map(finding => `<section class="detail-section"><h3>${e(finding.title)}</h3><div class="drawer-badges">${badge(TYPE_LABELS[finding.body.epistemic_type] || '类型待确认', 'purple')}</div><p>${e(finding.body.text)}</p><div class="evidence-chips">${finding.body.evidence_ids.map(id => `<button class="evidence-chip" data-evidence="${id}">${icon('link')}${e(state.overview.evidence.find(item => item.id === id)?.label)}</button>`).join('')}</div>${finding.insight_ids.map(id => `<button class="button secondary related-button" data-insight="${id}">查看关联判断 ${icon('arrow')}</button>`).join('')}</section>`).join('')}${dimension.gaps.length ? `<section class="gap-section"><h3>证据缺口</h3>${dimension.gaps.map(gap => `<p>${e(gap)}</p>`).join('')}</section>` : ''}<p class="small-note">六维是检查视角，材料不足时应明确缺口。</p></div>`, 'drawer');
}

function openLiveDimension(key) {
  const overview = workflow.state.overview;
  const label = DIMENSIONS.find(([name]) => name === key)?.[1];
  if (!overview?.snapshot_version || !label) return;
  openDialog(`${dialogHeader(`ANALYSIS VIEW · ${overview.engine_mode === 'mock' ? '模拟引擎结果' : '引擎分析'} · v${overview.snapshot_version}`, label)}${renderProjectDimension(overview, key)}`, 'drawer');
}

function openImport(editingId = null) {
  try {
    openMaterialEditor({ workflow, editingId, openDialog, closeDialog, dialogHeader,
      onSaved: async (ids, submit) => {
        state.view = 'materials'; state.selectedMaterials = new Set(ids);
        setWorkspace('own'); location.hash = 'materials';
        if (submit) await submitMaterials(ids);
        else notify('材料草稿已保存，可以继续编辑或连接引擎后提交。');
      },
    });
  } catch (error) { notify(error.message); }
}

function renderOwnOverview() {
  const result = workflow.state.overview;
  if (!result && workflow.cacheWarning) return `<section class="panel own-result-summary"><h2>材料已保留，等待重新读取分析</h2><p>已停止使用不完整的总览缓存。恢复连接后会重新读取服务端结果，无需重新上传资料。</p><button class="button secondary" data-action="connect">连接并读取结果</button></section>`;
  if (!result?.snapshot_version) return `${workflow.state.active_job ? '<div class="job-banner">' + icon('clock') + '<div><strong>分析任务正在处理或等待恢复查询</strong><p>材料已保留，不需要再次提交。</p></div><button class="button secondary" data-action="materials">查看任务状态</button></div>' : ''}${renderEmpty()}`;
  return renderProjectOverview(result, { query: state.query, filter: state.filter, connected: workflow.connected });
}

let pollTimer = null, polling = false, pollErrors = 0;
function schedulePolling(delay = 2000) {
  clearTimeout(pollTimer);
  if (!workflow.connected || !workflow.state.active_job) return;
  pollTimer = setTimeout(async () => {
    if (polling) { schedulePolling(); return; }
    polling = true;
    try {
      await workflow.poll(); pollErrors = 0;
      if (!workflow.state.active_job && workflow.state.last_job?.status === 'succeeded') notify('分析已完成，可以查看对应版本的结果。');
    } catch { pollErrors++; }
    finally { polling = false; schedulePolling(pollErrors ? Math.min(10000, pollErrors * 5000) : 2000); }
  }, delay);
}

function openConnection() {
  const dialog = openDialog(`${dialogHeader('ENGINE CONNECTION', '连接分析引擎')}<form id="connection-form"><div class="modal-body"><p class="import-intro">先检查服务连接。连接成功后，材料仍需由你点击提交。</p><label class="field-label" for="engine-address">本机服务地址</label><input class="form-input" id="engine-address" name="base_url" type="url" required value="${e(workflow.state.base_url)}"><p class="small-note">对应接口文档 v0.1。本机地址支持 localhost 或 127.0.0.1；请确认伙伴已启动 HTTP 服务，并允许当前前端地址跨域访问。</p><div id="connection-message" class="form-error" role="alert" hidden></div><div class="local-save-note">${icon('info')}连接只读取服务与项目状态，不会自动上传材料。</div></div><div class="modal-footer"><button class="button secondary" type="button" data-action="close">取消</button><button class="button primary" id="check-engine" type="submit">检查并连接</button></div></form>`);
  dialog.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = dialog.querySelector('#check-engine'); const message = dialog.querySelector('#connection-message');
    button.disabled = true; button.textContent = '正在检查连接…'; message.hidden = true;
    try {
      await workflow.connect(dialog.querySelector('#engine-address').value);
      closeDialog(); notify(`引擎连接成功${workflow.health.engine_mode === 'mock' ? '（模拟服务）' : ''}，材料尚未自动上传。`);
      schedulePolling(0);
    } catch (error) { message.textContent = error.message; message.hidden = false; }
    finally { button.disabled = false; button.textContent = '检查并连接'; }
  });
}

async function submitMaterials(ids) {
  try {
    await workflow.submit(ids); state.selectedMaterials.clear(); shell();
    notify('引擎已保存材料。请选择待分析材料，再点击开始分析。');
  } catch (error) { notify(error.message); shell(); }
}
async function analyzeMaterials(ids) {
  try { await workflow.startAnalysis(ids); state.selectedMaterials.clear(); shell(); schedulePolling(0); }
  catch (error) {
    notify(error.message);
    if (['VERSION_CONFLICT', 'PROJECT_BUSY', 'RECORD_ALREADY_ANALYZED'].includes(error.code)) {
      try { await workflow.connect(); schedulePolling(0); } catch { /* Connection banner preserves the error and drafts. */ }
    }
    shell();
  }
}
function openOwnDraft(id) {
  const draft = workflow.state.drafts.find(record => record.client_record_id === id); if (!draft) return;
  const serverId = workflow.state.submissions[id];
  openDialog(`${dialogHeader(serverId ? 'SUBMITTED MATERIAL · 已提交原文' : 'LOCAL DRAFT · 本地草稿', draft.title)}<div class="drawer-body"><div class="source-metadata">${badge(serverId ? '已提交，原文不可覆盖' : '尚未提交', serverId ? 'green' : 'amber')}${badge(draft.material_basis === 'synthetic' ? '合成材料' : '已获授权')}</div><section class="detail-section"><h3>材料信息</h3><p>${e(SOURCE_LABELS[draft.source_type])} · ${e(draft.source_date || '日期未提供')} · ${e(draft.source_name || '粘贴记录')}</p><p>参与者：${draft.participants?.length ? draft.participants.map(person => e(person.label)).join('、') : '未填写'}</p>${draft.authorization_note ? `<p>授权说明：${e(draft.authorization_note)}</p>` : ''}</section><pre class="draft-content">${e(draft.content)}</pre>${workflow.isEditable(id) ? `<button class="button secondary" data-edit-draft="${e(id)}">编辑这份草稿</button>` : ''}</div>`, 'drawer');
}
async function openServerRecord(id, evidence = null) {
  if (!workflow.connected) { notify('请先恢复引擎连接，再读取服务端原文。'); return; }
  try {
    const projectId = workflow.state.project.id;
    const record = await workflow.api.record(projectId, id);
    if (state.workspace !== 'own' || workflow.state.project?.id !== projectId) return;
    if (record?.id !== id || !Array.isArray(record.segments)) throw new Error('原文材料不符合接口约定，未展示不确定的引用。');
    if (evidence) validateSource(record, evidence);
    openDialog(`${dialogHeader('SOURCE · 服务端原文', record.title)}<div class="drawer-body"><div class="source-metadata">${badge(record.material_basis === 'synthetic' ? '合成材料' : '已获授权')}<span>${e(record.source_date || '日期未提供')}</span></div><p class="source-filename">${e(record.source_name || '来源未提供')}</p>${record.segments.map(segment => `<section class="source-paragraph ${evidence?.segment_id === segment.id ? 'highlighted' : ''}"><span class="paragraph-number">段落 ${displayCount(segment.paragraph_index)}</span><p>${e(segment.text)}</p></section>`).join('')}</div>`, 'drawer');
  } catch (error) { notify(error.message); }
}
async function openLiveInsight(id, showSpark = false) {
  if (!workflow.connected) { notify('请先恢复连接，再读取这个版本的详情。'); return; }
  const projectId = workflow.state.project.id;
  const version = workflow.state.overview.snapshot_version;
  const api = workflow.api;
  closeDialog();
  openInsightDetail({ insightId: id, version, mode: workflow.state.overview.engine_mode, showSpark,
    loadDetail: () => api.insight(projectId, id, version), loadRecord: recordId => api.record(projectId, recordId),
    corrections: {
      projectId, baseUrl: workflow.state.base_url, storage,
      getCurrentVersion: () => workflow.state.overview?.project.current_version,
      isBusy: () => workflow.busy || !!workflow.state.active_job || Object.keys(workflow.state.pending).length > 0,
      send: (body, key) => api.correct(projectId, body, key),
      loadDetail: selectedVersion => api.insight(projectId, id, selectedVersion),
      refreshLatest: async () => {
        if (workflow.state.project?.id !== projectId) throw new Error('项目已切换，请返回原项目核查保存结果。');
        await workflow.connect();
        const overview = workflow.state.overview;
        if (overview.project.id !== projectId || overview.snapshot_version !== overview.project.current_version) throw new Error('最新项目版本尚未同步，请重试读取。');
        return { detail: await api.insight(projectId, id, overview.snapshot_version), currentVersion: overview.snapshot_version };
      },
    } });
}

document.addEventListener('click', event => {
  const element = event.target.closest('button'); if (!element || element.disabled) return;
  if (element.dataset.agentAction) { agent.handleAction(element.dataset.agentAction); return; }
  if (element.dataset.agentMode) { agent.handleMode(element.dataset.agentMode); return; }
  if (element.dataset.agentInsight) { agent.handleInsight(element.dataset.agentInsight); return; }
  if (element.dataset.agentKnowledgeId) { agent.handleKnowledge(element.dataset.agentKnowledgeId); return; }
  if (element.dataset.agentEvidence) { agent.handleEvidence(element.dataset.agentEvidence); return; }
  if (element.dataset.knowledgeCitation) { const ref = state.knowledgeDetail?.citations?.[Number(element.dataset.knowledgeCitation)]; if (ref) { state.workspace = 'own'; openServerRecord(ref.record_id, ref); } return; }
  if (element.dataset.designVersion && state.workspace === 'design') {
    const version = Number(element.dataset.designVersion); if (![1, 2].includes(version)) return;
    closeDialog(); state.designVersion = version; shell();
    document.querySelector(`[data-design-version="${version}"]`)?.focus();
    announce(`已查看设计评审预置 v${version}，未调用 AI。`); return;
  }
  if (element.dataset.designInsight && state.workspace === 'design') {
    openDesignInsight(element.dataset.designInsight, state.designVersion, { openDialog, dialogHeader }); return;
  }
  if (element.dataset.editDraft) { openImport(element.dataset.editDraft); return; }
  if (element.dataset.removeDraft) {
    try { workflow.remove(element.dataset.removeDraft); state.selectedMaterials.delete(element.dataset.removeDraft); shell(); notify('草稿已移除，可以在列表底部恢复。'); } catch (error) { notify(error.message); }
    return;
  }
  if (element.dataset.draftId) { openOwnDraft(element.dataset.draftId); return; }
  if (element.dataset.serverRecord) { openServerRecord(element.dataset.serverRecord); return; }
  if (element.dataset.liveInsight) { openLiveInsight(element.dataset.liveInsight, element.hasAttribute('data-spark-open')); return; }
  if (element.dataset.liveDimension) { openLiveDimension(element.dataset.liveDimension); return; }
  if (element.dataset.liveEvidence) {
    const evidence = workflow.state.overview?.evidence.find(item => item.id === element.dataset.liveEvidence);
    if (evidence) openServerRecord(evidence.record_id, evidence); return;
  }
  if (element.dataset.evidence) {
    const evidence = state.overview.evidence.find(item => item.id === element.dataset.evidence);
    if (evidence) openRecord(evidence.record_id, evidence.id); return;
  }
  if (element.dataset.insight) { openInsight(element.dataset.insight, element.hasAttribute('data-spark-open')); return; }
  if (element.dataset.record) { openRecord(element.dataset.record); return; }
  if (element.dataset.draft !== undefined) { openDraft(Number(element.dataset.draft)); return; }
  if (element.dataset.dimension) { openDimension(element.dataset.dimension); return; }
  if (element.dataset.demoVersion && state.workspace === 'demo') {
    const version = Number(element.dataset.demoVersion);
    if (![1, 2, 3].includes(version)) return;
    state.overview = getDemoOverview(version); state.filter = 'all'; state.query = '';
    shell(); document.querySelector(`[data-demo-version="${version}"]`)?.focus();
    announce(`已切换到合成快照 v${version}，未调用真实 AI。`); return;
  }
  if (element.dataset.filter) { state.filter = element.dataset.filter; shell(); document.querySelector(`[data-filter="${state.filter}"]`)?.focus(); announce('关注点筛选已更新'); return; }
  switch (element.dataset.action) {
    case 'import': openImport(); break;
    case 'export': openExport(); break;
    case 'close': closeDialog(); break;
    case 'own': setWorkspace('own'); break;
    case 'demo': setWorkspace('demo'); break;
    case 'materials': state.view = 'materials'; location.hash = 'materials'; shell(); break;
    case 'history': state.view = 'history'; location.hash = 'history'; shell(); break;
    case 'connect': openConnection(); break;
    case 'retry-knowledge': loadKnowledge(); break;
    case 'undo-remove': try { workflow.restoreLast(); notify('最近移除的草稿已恢复。'); } catch (error) { notify(error.message); } break;
    case 'submit-selected': submitMaterials(materialRows(workflow).filter(row => row.status === 'draft' && state.selectedMaterials.has(row.id)).map(row => row.id)); break;
    case 'retry-import': submitMaterials(workflow.state.pending.import?.ids || workflow.state.pending.project?.ids || []); break;
    case 'analyze-selected': analyzeMaterials(materialRows(workflow).filter(row => row.status === 'saved' && state.selectedMaterials.has(row.id)).map(row => row.server.id)); break;
    case 'retry-analysis': analyzeMaterials(workflow.state.pending.analysis?.body.record_ids || []); break;
    case 'refresh-job': schedulePolling(0); break;
    case 'show-results': state.view = 'overview'; setWorkspace('own'); location.hash = 'overview'; break;
    case 'clear-filter': state.query = ''; state.filter = 'all'; shell(); document.querySelector('#insight-search')?.focus(); break;
  }
});
document.addEventListener('change', event => {
  if (event.target.id === 'agent-file') { agent.handleFile(event.target.files?.[0]); return; }
  if (event.target.id === 'agent-basis') { agent.handleBasis(event.target.value); return; }
  if (event.target.id === 'agent-consent') { agent.handleConsent(event.target.checked); return; }
  if (event.target.id === 'workspace-select') setWorkspace(event.target.value);
  if (event.target.dataset.materialSelect) {
    if (event.target.checked) state.selectedMaterials.add(event.target.dataset.materialSelect);
    else state.selectedMaterials.delete(event.target.dataset.materialSelect);
    shell();
  }
  if (event.target.id === 'select-all-materials') {
    state.selectedMaterials = event.target.checked ? new Set(materialRows(workflow).filter(row => ['draft', 'saved'].includes(row.status)).map(row => row.id)) : new Set(); shell();
  }
});
document.addEventListener('input', event => {
  if (event.target.id === 'agent-input') { agent.handleInput(event.target.value); return; }
  if (event.target.id !== 'insight-search') return;
  state.query = event.target.value;
  const own = state.workspace === 'own', overview = workflow.state.overview;
  document.querySelector('#insight-results').innerHTML = own ? renderProjectInsights(overview, state.query, state.filter) : renderInsightCards();
  announce(`${own ? filterProjectInsights(overview, state.query, state.filter).length : filterInsights(state.overview.insights, state.query, state.filter, state.overview.evidence, state.overview.snapshot_version).length} 个匹配的关注点`);
});
document.addEventListener('submit', event => { if (event.target.id === 'agent-form') agent.handleSubmit(event); });
document.addEventListener('keydown', event => { if (event.target.id === 'agent-input' && event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); document.querySelector('#agent-form')?.requestSubmit(); } });
window.addEventListener('hashchange', () => { state.view = workspaceView(); state.query = ''; shell(); if (state.view === 'knowledge') loadKnowledge(); });
shell();
workflow.connect().then(() => { schedulePolling(0); if (state.view === 'knowledge') loadKnowledge(); }).catch(() => shell());
