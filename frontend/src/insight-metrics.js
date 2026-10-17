import { escapeHtml as e } from './core.js';

const count = value => Number.isSafeInteger(value) && value >= 0;
const labels = {
  conditions_unresolved: ['条件待核实', '已记录共同话题，适用边界仍待核对。'],
  conditional_convergence: ['有条件趋同', '按条件分别理解；并不表示所有人无条件同意或结论已证实。'],
  insufficient_evidence: ['证据不足', '现有材料不足以判断趋同；低频问题仍可能值得验证。'],
};

// Optional metadata is checked independently. Never substitute file counts,
// spark participants, a score or a lack of objections for meeting consensus.
export function insightMetrics(insight = {}) {
  const coverage = insight?.meeting_coverage;
  const meetingsValid = coverage && count(coverage.distinct_meeting_count) && count(coverage.total_meeting_count)
    && coverage.distinct_meeting_count <= coverage.total_meeting_count
    && Array.isArray(coverage.meeting_ids) && coverage.meeting_ids.every(id => typeof id === 'string' && id.trim())
    && new Set(coverage.meeting_ids).size === coverage.meeting_ids.length
    && coverage.meeting_ids.length === coverage.distinct_meeting_count;
  const meetings = meetingsValid ? {
    value: `${coverage.distinct_meeting_count} / ${coverage.total_meeting_count} 场`,
    note: '本关注点有证据的独立场次 / 本版全部场次；多份材料同场只计一次。',
    ids: coverage.meeting_ids,
  } : { value: '场次待补齐', note: '未提供有效会议归属，不能用文件数或碰撞参与场次代替。', ids: [] };

  const importance = insight?.importance, parts = importance?.parts, raw = importance?.raw_counts;
  const scoreValid = importance?.rule_version === 'demo-0.1' && importance.max_score === 5
    && count(importance.score) && importance.score <= 5
    && count(raw?.distinct_meetings) && (raw?.independent_speakers === null || count(raw?.independent_speakers))
    && count(parts?.distinct_meetings) && parts.distinct_meetings === Math.min(raw.distinct_meetings, 3)
    && [0, 1].includes(parts?.independent_speakers) && parts.independent_speakers === (raw.independent_speakers >= 2 ? 1 : 0)
    && [0, 1].includes(parts?.documented_business_choice)
    && importance.score === parts.distinct_meetings + parts.independent_speakers + parts.documented_business_choice
    && (!meetingsValid || raw.distinct_meetings === coverage.distinct_meeting_count);
  const priority = scoreValid ? {
    value: `${importance.score} / 5`, label: '重要性 · 演示评分',
    note: '优先阅读提示；未用真实业务校准，不是概率、证据充分度或多数票。',
    rule: 'demo-0.1', parts: [
      { label: '有实质证据的独立场次（最多 3 分）', points: parts.distinct_meetings, basis: `${raw.distinct_meetings} 场` },
      { label: '至少两位独立发言者（最多 1 分）', points: parts.independent_speakers, basis: raw.independent_speakers === null ? '身份未知' : `${raw.independent_speakers} 位` },
      { label: '原话涉及业务取舍（最多 1 分）', points: parts.documented_business_choice, basis: parts.documented_business_choice ? '模拟规则标记为有' : '模拟规则未标记' },
    ],
  } : { value: '评分待解释', label: '重要性', note: '缺少已知规则或分项不一致，暂不显示不明分数；仍可按判断和原话核查。', rule: null, parts: [] };

  const status = insight?.convergence_status;
  const convergence = typeof status === 'string' && Object.hasOwn(labels, status) ? labels[status] : null;
  return {
    meetings, priority,
    convergence: { value: convergence?.[0] || '趋同待判断', note: convergence?.[1] || '未提供可识别的趋同状态，不从频次、分数或沉默推断共识。' },
    conditions: Array.isArray(insight?.judgment?.conditions) ? insight.judgment.conditions.filter(item => typeof item === 'string' && item.trim()) : [],
  };
}

export function renderInsightMetrics(insight) {
  const model = insightMetrics(insight);
  return `<section class="im-metrics" aria-label="会议覆盖、重要性与趋同程度"><dl class="im-grid">${[
    ['会议覆盖', model.meetings], [model.priority.label, model.priority], ['趋同程度', model.convergence],
  ].map(([label, item]) => `<div class="im-cell"><dt>${e(label)}</dt><dd class="im-value">${e(item.value)}</dd><dd class="im-note">${e(item.note)}</dd></div>`).join('')}</dl>
    <details class="im-explanation"><summary>查看指标说明与适用条件</summary><div class="im-explanation-body"><p>覆盖表示出现范围，重要性提示阅读顺序，趋同描述观点关系。三者分别理解；高分不等于已验证，认可方向不等于批准行动。</p>${model.meetings.ids.length ? `<p>覆盖场次：${model.meetings.ids.map(e).join('、')}</p>` : ''}${model.priority.rule ? `<p>演示规则 ${e(model.priority.rule)} · 总分 ${e(model.priority.value)}</p><ul>${model.priority.parts.map(part => `<li>${e(part.label)}：${part.points} 分（${e(part.basis)}）</li>`).join('')}</ul>` : `<p>${e(model.priority.note)}</p>`}<p>当前判断的适用条件：</p>${model.conditions.length ? `<ul>${model.conditions.map(item => `<li>${e(item)}</li>`).join('')}</ul>` : '<p>条件未提供，不能理解为无条件成立。</p>'}</div></details></section>`;
}
