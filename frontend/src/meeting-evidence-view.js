import { escapeHtml as e } from './core.js';
import { RELATION_LABELS } from './insight-detail-model.js';
import { meetingEvidence } from './meeting-evidence-model.js';
import { icon } from './icons.js';

export function renderMeetingEvidence(detail, { filter = 'all', selectedEvidenceId = null } = {}) {
  const model = meetingEvidence(detail, filter);
  const warnings = model.issues.map(issue => `<p class="me-warning">${e(issue)}</p>`).join('');
  if (!model.groups.length) return `${warnings}<p class="cd-filter-empty">这个分类下没有提供证据。可切换其他分类。</p>`;
  return `${warnings}${model.groups.length > 1 ? `<nav class="me-jumps" aria-label="跳转会议标注">${model.groups.map((group, index) => `<button type="button" data-cd-meeting-index="${index}" aria-label="查看 ${e(group.meetingId || '场次待补齐')} 的证据标注">${e(group.meetingId || '场次待补齐')}</button>`).join('')}</nav>` : ''}${model.groups.map(group => `<section class="me-group" aria-label="${e(group.meetingId || '场次待补齐')}的证据标注"><header class="me-group-heading"><h4>${e(group.meetingId || '场次待补齐')}</h4><span>${group.entries.length} 条原话 · ${group.recordCount} 份材料</span></header>${group.entries.map(item => {
    const evidence = item.evidence, selected = selectedEvidenceId === evidence.id;
    return `<article class="me-entry ${selected ? 'me-selected' : ''}"><div class="me-annotations">${item.links.map(link => `<div class="me-annotation"><span class="me-relation">${e(RELATION_LABELS[link.relation] || '关系待确认')}</span><span>${link.condition ? `适用条件：${e(link.condition)}` : '该条标注的条件未注明'}</span></div>`).join('')}${item.repeated ? '<span class="me-repeat">重复印证 · 非新火花</span>' : ''}</div><button type="button" class="cd-evidence-item ${selected ? 'cd-evidence-selected' : ''}" ${item.canOpen ? `data-cd-evidence="${e(evidence.id)}"` : 'disabled'} aria-pressed="${selected}" aria-label="${e(group.meetingId || '场次待补齐')} · ${e(evidence.label || '引用')} · 查看原话"><span class="cd-evidence-item-top"><strong>${e(evidence.label || '引用')}</strong><span>查看原话与上下文</span>${icon('arrow')}</span><span class="cd-evidence-quote">${e(evidence.quote || '原话尚未提供')}</span><span class="cd-evidence-method">${e({ spontaneous: '主动提起', prompted: '被问回应' }[evidence.elicitation] || '提问方式未知')}</span></button>${item.notes.map(note => `<p class="me-warning">${e(note)}</p>`).join('')}${!item.canOpen ? '<p class="me-warning">定位信息不完整，需补齐材料、片段与原话后核查。</p>' : ''}</article>`;
  }).join('')}</section>`).join('')}`;
}
