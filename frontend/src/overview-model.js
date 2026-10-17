import { DIMENSIONS, TYPE_LABELS, filterInsights } from './core.js';
import { matchesSpark } from './spark-model.js';

export const array = value => Array.isArray(value) ? value : [];
export const displayCount = value => Number.isSafeInteger(value) && value >= 0 ? String(value) : '未知';
const string = value => typeof value === 'string';
const nonempty = value => string(value) && !!value.trim();
const count = value => Number.isSafeInteger(value) && value >= 0;
const strings = value => Array.isArray(value) && value.every(string);
const ids = value => strings(value) && value.every(nonempty) && new Set(value).size === value.length;
const invalid = message => { throw new Error(`分析总览数据不符合接口约定：${message}。已保留原数据，请核查引擎后重新读取。`); };

function block(value) {
  return value && string(value.text) && Object.hasOwn(TYPE_LABELS, value.epistemic_type) && strings(value.evidence_ids)
    && strings(value.conditions) && strings(value.alternative_explanations) && strings(value.gaps);
}
function change(value) {
  return value && nonempty(value.insight_id) && ['new', 'supported', 'qualified', 'challenged', 'revised', 'unchanged'].includes(value.type)
    && string(value.reason) && strings(value.evidence_ids) && typeof value.is_breakthrough === 'boolean';
}

export function validateOverview(overview, projectId) {
  if (!overview || overview.project?.id !== projectId || !nonempty(projectId) || !nonempty(overview.project.name)
    || !count(overview.snapshot_version) || !count(overview.project.current_version) || overview.snapshot_version > overview.project.current_version) invalid('项目或快照版本无效');
  if (!['mock', 'live'].includes(overview.engine_mode) || !string(overview.summary) || !count(overview.pending_confirmation_count)
    || !ids(overview.source_record_ids) || !ids(overview.unanalyzed_record_ids)
    || !['insights', 'dimensions', 'evidence', 'changes'].every(key => Array.isArray(overview[key]))) invalid('基础字段缺失或类型不正确');
  if (overview.snapshot_version === 0 ? overview.outcome !== null : !['updated', 'no_new_insight', 'insufficient_evidence'].includes(overview.outcome)) invalid('结果状态无效');
  if (!ids(overview.insights.map(item => item?.id))) invalid('关注点标识缺失或重复');
  for (const insight of overview.insights) {
    const judgment = insight.judgment, coverage = insight.coverage;
    if (!nonempty(insight.title) || !judgment || !nonempty(judgment.id) || !nonempty(judgment.text)
      || !Object.hasOwn(TYPE_LABELS, judgment.epistemic_type) || !['unreviewed', 'confirmed'].includes(judgment.review_status)
      || !['conditions', 'evidence_ids', 'alternative_explanations', 'evidence_gaps'].every(key => strings(judgment[key])) || !string(judgment.rationale)
      || !['none', 'open'].includes(insight.dispute_status) || !change(insight.last_change)) invalid('关注点或判断字段无效');
    if (!coverage || !['unique_speakers', 'spontaneous_speakers', 'prompted_speakers'].every(key => coverage[key] === null || count(coverage[key]))
      || !['supporting_record_count', 'total_analyzed_record_count', 'unknown_elicitation_count'].every(key => count(coverage[key]))
      || coverage.supporting_record_count > coverage.total_analyzed_record_count
      || typeof coverage.identity_incomplete !== 'boolean' || !string(coverage.note)) invalid('覆盖统计必须是有效的非负整数；未知发言人数使用 null');
  }
  if (!overview.changes.every(change)) invalid('变化记录无效');
  if (overview.outcome === 'no_new_insight' && overview.changes.some(item => item.is_breakthrough)) invalid('无新火花结果不能同时标记认知突破');
  if (!ids(overview.evidence.map(item => item?.id)) || overview.evidence.some(item => !nonempty(item.quote) || !nonempty(item.record_id) || !nonempty(item.segment_id))) invalid('证据目录无效');
  const dimensionKeys = new Set(DIMENSIONS.map(([key]) => key));
  if (!ids(overview.dimensions.map(item => item?.key)) || overview.dimensions.some(item => !dimensionKeys.has(item.key)
    || !['available', 'insufficient_evidence', 'not_applicable'].includes(item.status) || !strings(item.gaps) || !Array.isArray(item.findings)
    || item.findings.some(finding => !nonempty(finding.id) || !string(finding.title) || !block(finding.body) || !strings(finding.insight_ids)
      || !Array.isArray(finding.sections) || finding.sections.some(section => !string(section.label) || !block(section.body))))) invalid('六维分析字段无效');
  // Missing dimensions remain explicit UI gaps instead of fabricated findings.
  return overview;
}

export function filterProjectInsights(overview, query = '', filter = 'all') {
  const matches = filterInsights(array(overview.insights), query, 'all');
  const changed = new Set(array(overview.changes).filter(item => item.is_breakthrough && overview.outcome !== 'no_new_insight').map(item => item.insight_id));
  return matches.filter(item => ['single', 'cross'].includes(filter) ? matchesSpark(item, filter, overview.evidence, overview.snapshot_version) : filter === 'all' || filter === 'changed' && changed.has(item.id) || filter === 'disputed' && item.dispute_status === 'open');
}
