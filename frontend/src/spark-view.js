import { escapeHtml as e } from './core.js';
import { icon } from './icons.js';
import { sparkView } from './spark-model.js';

const symbol = kind => kind === 'clue' || kind === 'unknown' ? '○' : kind === 'cross' ? '✦✦' : '✦';
const tag = view => `<span class="sp-tag sp-${view.kind}"><span aria-hidden="true">${symbol(view.kind)}</span>${e(view.label)}</span>`;
export function renderSparkLegend() {
  return '<div class="sp-legend" aria-label="火花颜色说明"><span class="sp-legend-single">✦ 单场碰撞</span><span class="sp-legend-cross">✦✦ 跨场碰撞</span><span>○ 待验证线索</span><small>颜色表示碰撞来源，是否证实请看证据与确认状态。</small></div>';
}
export function renderSparkCard(insight, evidence, version, live = false) {
  const view = sparkView(insight, evidence, version);
  if (view.kind === 'observation') return '';
  return `<div class="sp-card sp-${view.kind}">${tag(view)}<p>${e(view.reason)}</p>${view.collision ? `<div class="sp-card-foot"><span>${view.conversationCount} 场参与碰撞 · ${view.evidenceCount} 条引用${view.latest.kind === 'corroboration' ? ' · 新增印证' : ''}</span><button type="button" class="sp-open" data-spark-open ${live ? 'data-live-insight' : 'data-insight'}="${e(insight.id)}">查看碰撞路径 ${icon('arrow')}</button></div>` : ''}</div>`;
}
export function renderSparkPath(detail) {
  const view = sparkView(detail, detail.evidence, detail.snapshot_version);
  if (view.kind === 'observation') return '';
  if (!view.collision) return `<section class="sp-path sp-${view.kind}"><h3>${tag(view)}</h3><p>${e(view.reason)}</p></section>`;
  const conversations = new Map(view.conversations.map(item => [item.id, item]));
  const evidence = new Map(detail.evidence.map(item => [item.id, item]));
  return `<section class="sp-path sp-${view.kind}" id="cd-spark-path" aria-labelledby="sp-path-title"><div class="sp-path-heading"><div><span class="sp-eyebrow">SPARK ORIGINS</span><h3 id="sp-path-title">这颗火花，怎样碰撞而来？</h3></div>${tag(view)}</div><p class="sp-note">单场与跨场表示信息来源，确认状态另行标注。下面按事件保留最初的火花与后续变化。</p><ol class="sp-events">${view.events.map(event => {
    const kind = event.kind === 'corroboration' ? 'echo' : event.scope;
    return `<li class="sp-event sp-${kind}"><div class="sp-event-heading"><span class="sp-event-symbol" aria-hidden="true">${event.kind === 'corroboration' ? '↳' : symbol(kind)}</span><strong>${event.kind === 'corroboration' ? '新增印证 · 保留原有火花' : kind === 'single' ? '单场碰撞 · 对话内改变判断' : '跨场碰撞 · 不同对话共同改变判断'}</strong><span>v${event.version}</span></div><p class="sp-reason">${e(event.reason)}</p><div class="sp-transition"><div><small>变化前</small><p>${e(event.before)}</p></div><span aria-hidden="true">→</span><div><small>${event.kind === 'corroboration' ? '保持判断' : '变化后'}</small><p>${e(event.after)}</p></div></div><div class="sp-contributions">${event.contributions.map(contribution => {
      const conversation = conversations.get(contribution.conversation_id);
      return `<div class="sp-contribution"><div class="sp-conversation-title">${icon('quote')}<strong>${e(conversation.title)}</strong><span>${e(conversation.date || '日期未提供')} · ${conversation.record_ids.length} 份材料</span></div><p>${e(contribution.text)}</p><div class="sp-citations">${contribution.evidence_ids.map(id => `<button type="button" data-cd-evidence="${e(id)}" class="cd-citation">${icon('link')}${e(evidence.get(id).label || id)}<span>查看原话</span></button>`).join('')}</div></div>`;
    }).join('')}</div></li>`;
  }).join('')}</ol><p class="sp-note">重复说法只增加印证，不自动升级为跨场碰撞；参与场次数也不代表独立案例数。</p></section>`;
}
