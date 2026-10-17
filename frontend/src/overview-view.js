import { DIMENSIONS, TYPE_LABELS, escapeHtml as e } from './core.js';
import { icon } from './icons.js';
import { array, displayCount, filterProjectInsights } from './overview-model.js';
import { SPARK_FILTERS } from './spark-model.js';
import { renderSparkCard, renderSparkLegend } from './spark-view.js';
import { renderInsightMetrics } from './insight-metrics.js';

const badge = (label, color = 'neutral') => `<span class="badge badge-${color}">${e(label)}</span>`;
const typeBadge = judgment => badge(TYPE_LABELS[judgment?.epistemic_type] || '类型待确认', { fact: 'green', opinion: 'blue', inference: 'purple', hypothesis: 'amber' }[judgment?.epistemic_type] || 'neutral');
const changeLabel = { new: '新增关注点', supported: '证据增强', qualified: '条件细化', challenged: '新增质疑', revised: '判断修正', unchanged: '无实质变化' };
const dimensionStatus = { available: '已有分析', insufficient_evidence: '证据不足', not_applicable: '本次不适用' };
const list = (values, empty) => array(values).length ? `<ul class="ov-list">${values.map(value => `<li>${e(value)}</li>`).join('')}</ul>` : `<p class="ov-muted">${e(empty)}</p>`;

function citations(ids, overview) {
  return `<div class="evidence-chips ov-citations">${array(ids).map(id => {
    const evidence = array(overview.evidence).find(item => item.id === id);
    return evidence ? `<button class="evidence-chip" data-live-evidence="${e(id)}" aria-label="核查证据 ${e(evidence.label || id)}">${icon('link')}${e(evidence.label || '查看原话')}</button>` : '<span class="ov-muted">引用详情需在关联判断中核查</span>';
  }).join('')}</div>`;
}

export function renderProjectInsights(overview, query = '', filter = 'all') {
  const insights = filterProjectInsights(overview, query, filter);
  if (!insights.length) return `<div class="search-empty">${icon('search')}<strong>${array(overview.insights).length ? '没有匹配的关注点' : '本版尚未形成可靠关注点'}</strong><p>${array(overview.insights).length ? '试试其他关键词，或切换到“全部”。' : '保留材料与证据缺口，补充证据后再分析。'}</p>${array(overview.insights).length ? '<button class="button secondary" data-action="clear-filter">清除筛选</button>' : ''}</div>`;
  const changed = new Set(array(overview.changes).filter(item => item.is_breakthrough && overview.outcome !== 'no_new_insight').map(item => item.insight_id));
  return insights.map(insight => `<article class="insight-card"><div class="insight-top"><div class="insight-badges">${typeBadge(insight.judgment)}${insight.dispute_status === 'open' ? badge('存在分歧', 'amber') : changed.has(insight.id) ? badge('本次认知变化', 'orange') : ''}</div><span class="review-label">${insight.judgment.review_status === 'confirmed' ? '已确认判断' : '待核查'}</span></div><button class="card-title" data-live-insight="${e(insight.id)}"><h3>${e(insight.title)}</h3>${icon('arrow')}</button><p class="judgment-text">${e(insight.judgment.text)}</p><div class="conditions">${array(insight.judgment.conditions).map(value => `<span class="condition">${e(value)}</span>`).join('') || '<span class="ov-muted">适用条件待补充</span>'}</div>
    ${renderInsightMetrics(insight)}${insight.attention_flag ? `<p class="ov-coverage-note">${e(insight.attention_flag)}</p>` : ''}${renderSparkCard(insight, overview.evidence, overview.snapshot_version, true)}<div class="ov-coverage"><span>去重发言者 ${displayCount(insight.coverage?.unique_speakers)}</span><span>主动提起 ${displayCount(insight.coverage?.spontaneous_speakers)}</span><span>被问回应 ${displayCount(insight.coverage?.prompted_speakers)}</span></div><p class="ov-coverage-note">${e(insight.coverage?.note || '未提及不等于不关心；主动与被问人数可能重叠。')}${insight.coverage?.identity_incomplete ? ' 部分身份未知，统计不完整。' : ''}</p>
    <div class="insight-bottom"><span>查看完整判断与原话</span><span>${displayCount(insight.coverage?.supporting_record_count)} / ${displayCount(insight.coverage?.total_analyzed_record_count)} 份材料覆盖</span></div></article>`).join('');
}

export function renderProjectOverview(overview, { query = '', filter = 'all', connected = true } = {}) {
  const changes = array(overview.changes);
  const breakthroughs = overview.outcome === 'no_new_insight' ? 0 : changes.filter(item => item.is_breakthrough).length;
  const outcome = { updated: '分析结果已更新', no_new_insight: '本次无新火花', insufficient_evidence: '材料证据仍不足' }[overview.outcome] || '项目分析结果';
  const stats = [
    ['file', '材料已覆盖', array(overview.source_record_ids).length, '份进入本版', 'blue'],
    ['bulb', '关键关注点', array(overview.insights).length, '项待持续核查', 'purple'],
    ['spark', '本次认知变化', breakthroughs, '项分析记录标记', 'orange'],
    ['branch', '待确认分歧', overview.pending_confirmation_count, '项保留不同解释', 'amber'],
  ];
  const validation = array(overview.dimensions).find(item => item.key === 'validation_questions');
  return `<section class="panel own-result-summary ov-summary"><div class="section-heading"><div><span class="eyebrow">${overview.engine_mode === 'mock' ? '模拟引擎结果' : '引擎分析结果'} · VERSION ${displayCount(overview.snapshot_version)}</span><h2>${outcome}</h2></div><button class="button secondary" data-action="materials">管理材料</button></div><p>${e(overview.summary || '本版未提供分析简报，请结合证据与缺口核查。')}</p>${!connected ? '<p class="ov-offline">当前显示本地缓存的结果；连接恢复后可核查详情与原文。</p>' : ''}</section>
    <section class="stat-grid ov-stats" aria-label="项目概况">${stats.map(([symbol, label, value, note, color]) => `<div class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon tone-${color}">${icon(symbol)}</span></div><div class="stat-value">${displayCount(value)}<span>${note}</span></div></div>`).join('')}</section>
    <div class="content-grid"><div class="primary-column"><section class="panel ov-changes"><div class="section-heading"><div><span class="eyebrow">JUDGMENT UPDATES</span><h2>${overview.outcome === 'no_new_insight' ? '保留判断，记录本次材料覆盖' : '本次判断更新'}</h2></div><button class="text-button" data-action="history">历史对比 ${icon('arrow')}</button></div><p class="panel-description">变化原因以本次记录为准，未确认候选不会替换当前判断。</p>${changes.length ? changes.map(item => {
      const insight = array(overview.insights).find(value => value.id === item.insight_id);
      return `<article class="ov-change"><div>${badge(changeLabel[item.type] || '变化待核查', item.is_breakthrough && overview.outcome !== 'no_new_insight' ? 'orange' : 'neutral')}${item.is_breakthrough && overview.outcome !== 'no_new_insight' ? '<span class="ov-muted">分析记录标记的认知变化</span>' : ''}</div><h3>${e(insight?.title || '关注点详情未提供')}</h3><p>${e(item.reason || '本次未提供变化原因。')}</p>${insight ? `<p class="ov-current"><span>当前判断</span>${e(insight.judgment.text)}</p>` : ''}<div class="ov-change-footer">${citations(item.evidence_ids, overview)}${insight ? `<button class="text-button" data-live-insight="${e(insight.id)}">查看判断 ${icon('arrow')}</button>` : ''}</div></article>`;
    }).join('') : '<p class="ov-muted">本版未提供逐项变化记录；不补造旧判断或认知突破。可在认知历史中核查。</p>'}</section>
    <section class="insights-section"><div class="section-heading"><div><h2>关键关注点 <span class="heading-count">${array(overview.insights).length}</span></h2><p>按问题组织，保留条件、证据与分歧。</p></div></div><div class="insight-toolbar"><div class="filter-tabs" role="group" aria-label="筛选关注点">${SPARK_FILTERS.map(([key, label]) => `<button data-filter="${key}" class="filter-tab ${filter === key ? 'selected' : ''}" aria-pressed="${filter === key}">${label}</button>`).join('')}</div><label class="search-box">${icon('search')}<span class="sr-only">搜索关注点</span><input id="insight-search" type="search" placeholder="搜索关注点" value="${e(query)}" maxlength="100" autocomplete="off"></label></div>${renderSparkLegend()}<div id="insight-results" class="insight-list">${renderProjectInsights(overview, query, filter)}</div></section></div>
    <aside class="secondary-column"><section class="panel dimension-panel"><div class="panel-title"><span class="panel-symbol tone-purple">${icon('grid')}</span><h2>六个分析视角</h2></div><p class="panel-description">分析内容与缺口均来自当前快照。</p><div class="dimension-list">${DIMENSIONS.map(([key, label], index) => {
      const dimension = array(overview.dimensions).find(item => item.key === key);
      return `<button class="dimension-row" data-live-dimension="${key}"><span class="dimension-index">0${index + 1}</span><span>${label}</span>${badge(dimensionStatus[dimension?.status] || '未提供', dimension?.status === 'available' ? 'green' : 'neutral')}${icon('arrow')}</button>`;
    }).join('')}</div><p class="dimension-note">已有分析表示有内容可核查，不代表系统已实现或业务判断已验证。</p></section>
    <section class="panel validation-panel"><div class="panel-title"><span class="panel-symbol tone-orange">${icon('target')}</span><h2>下一步，验证什么？</h2></div><p class="panel-description">${e(validation?.gaps?.[0] || '查看关联判断中的最小实验与支持／推翻判据。')}</p>${array(validation?.findings).map((finding, index) => {
      const related = array(finding.insight_ids).find(id => array(overview.insights).some(item => item.id === id));
      return `<button class="validation-item" ${related ? `data-live-insight="${e(related)}"` : 'data-live-dimension="validation_questions"'}><span class="step-number">${String(index + 1).padStart(2, '0')}</span><span><strong>${e(finding.title)}</strong><span class="validation-description">${e(finding.body?.text)}</span><span class="validation-status">查看依据与验证方案</span></span>${icon('arrow')}</button>`;
    }).join('') || '<p class="ov-muted">本版尚未提供验证问题，需补齐能影响决策的最小实验。</p>'}<div class="panel-footnote">${icon('info')}验证建议不代表批准行动。</div></section></aside></div>`;
}

export function renderProjectDimension(overview, key) {
  const dimension = array(overview.dimensions).find(item => item.key === key);
  function block(value) {
    if (!value) return '<p class="ov-muted">尚未提供分析内容。</p>';
    return `${typeBadge(value)}<p>${e(value.text || '尚未提供表述。')}</p>${citations(value.evidence_ids, overview)}<h4>适用条件</h4>${list(value.conditions, '条件尚未提供，不能理解为无条件成立。')}<h4>其他可能解释</h4>${list(value.alternative_explanations, '未提供，不代表已经排除其他解释。')}<h4>证据缺口</h4>${list(value.gaps, '未列出，不代表已经充分验证。')}`;
  }
  return `<div class="drawer-body ov-dimension-detail"><div class="source-metadata">${badge(`快照 v${displayCount(overview.snapshot_version)}`, 'orange')}${badge(dimensionStatus[dimension?.status] || '本版未提供')}</div>${array(dimension?.findings).map(finding => `<section class="detail-section"><h3>${e(finding.title)}</h3>${block(finding.body)}${array(finding.sections).map(section => `<section class="ov-finding-section"><h3>${e(section.label)}</h3>${block(section.body)}</section>`).join('')}${array(finding.insight_ids).filter(id => array(overview.insights).some(insight => insight.id === id)).map(id => `<button class="button secondary related-button" data-live-insight="${e(id)}">查看关联判断 ${icon('arrow')}</button>`).join('')}</section>`).join('') || '<p class="ov-muted">服务未提供这个视角的具体发现，不能据此推导业务结论。</p>'}<section class="gap-section"><h3>本视角仍缺什么</h3>${list(dimension?.gaps, dimension ? '本版未列出具体缺口，不代表已完成验证。' : '当前快照未返回这个视角。请让引擎补齐内容或说明材料缺口。')}</section><p class="small-note">事实、观点、推断与假设分别理解；对系统的分析不表示已经完成系统建设。</p></div>`;
}
