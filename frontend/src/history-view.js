import { icon } from './icons.js';
import { escapeHtml as e, TYPE_LABELS, SOURCE_LABELS } from './core.js';
import { HistorySession, HISTORY_CHANGE_LABELS, comparisonKind } from './history-model.js';
import { demoHistorySource } from './fixtures/history.js';

const list = value => Array.isArray(value) ? value : [];
const outcomeLabel = { updated: '分析更新', no_new_insight: '无新火花', insufficient_evidence: '证据不足' };
const comparisonLabel = { new: '这个关注点在较晚版本中出现', absent_later: '较晚版本未提供这个关注点', unchanged: '判断无实质变化', evidence_only: '证据增强，判断未改写', candidate_only: '当前判断保留，新增待确认分歧', changed: '判断内容或边界有变化', absent: '两个版本中均无该关注点' };
const badge = (label, tone = 'neutral') => `<span class="hh-badge hh-badge-${tone}">${e(label)}</span>`;
function formatDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '时间未提供';
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

export function createHistoryView({ getContext, onOpenDetail, onConnect, onSample }) {
  let host = null, session = null, contextKey = null, source = null, onlyChanges = true, sourceDialog = null, sourceGeneration = 0;
  function ensureStyle() {
    if (document.querySelector('#hh-history-styles')) return;
    const link = document.createElement('link'); link.id = 'hh-history-styles'; link.rel = 'stylesheet';
    link.href = new URL('./history.css', import.meta.url).href; document.head.append(link);
  }
  function closeSource() { sourceGeneration++; sourceDialog?.close(); sourceDialog = null; }
  function renderInto(nextHost) {
    ensureStyle();
    if (host !== nextHost) { host = nextHost; host.addEventListener('click', handleClick); host.addEventListener('change', handleChange); }
    const context = getContext();
    const key = JSON.stringify([context.workspace, context.projectId, context.baseUrl, context.connected]);
    if (key !== contextKey) {
      session?.close(); closeSource(); contextKey = key; session = null; onlyChanges = true;
      if (context.workspace === 'demo') source = demoHistorySource;
      else if (context.connected && context.projectId) {
        const api = context.api, projectId = context.projectId;
        source = { projectId, loadVersions: () => api.versions(projectId), loadOverview: version => api.overview(projectId, version), loadDetail: (id, version) => api.insight(projectId, id, version), loadRecord: id => api.record(projectId, id) };
      } else source = null;
      if (source) {
        session = new HistorySession({ ...source, onChange: () => render() });
        render(); session.start(); return;
      }
    }
    render();
  }
  function render() {
    if (!host?.isConnected) return;
    const focused = host.contains(document.activeElement) ? document.activeElement.id : null;
    const context = getContext();
    if (!session) {
      host.innerHTML = `<section class="hh-empty"><span class="hh-empty-icon">${icon('history')}</span><span class="eyebrow">COGNITION HISTORY</span><h2>${context.projectId ? '连接引擎，读取项目的认知历史' : '还没有产生分析版本'}</h2><p>${context.projectId ? '当前没有读取完整历史。恢复连接后，可按固定版本查看判断、条件与依据。' : '材料导入并分析后，每次分析或纠错都会留下版本。原始草稿不会因此丢失。'}</p><div><button class="button primary" data-hh-connect>${context.connected ? '检查引擎连接' : '连接引擎'}</button><button class="button secondary" data-hh-sample>先体验合成历史 ${icon('arrow')}</button></div></section>`;
      return;
    }
    const state = session.state;
    if (state.status === 'loading') { host.innerHTML = loading('正在读取历史版本', '先确定版本，再读取对应的判断与证据。'); return; }
    if (state.status === 'empty') { host.innerHTML = `<section class="hh-empty">${icon('history')}<h2>还没有历史版本</h2><p>尚未生成分析快照。完成首次分析后，这里会保留它的判断与证据。</p></section>`; return; }
    if (!state.versions.length && state.status === 'error') { host.innerHTML = errorPanel(state.error, 'reload'); return; }
    const fromOptions = state.versions.filter(item => item.version < state.to);
    const busy = state.status === 'loading_comparison';
    host.innerHTML = `<div class="hh-header-note">${icon('info')}<span>${context.workspace === 'demo' ? '预设合成历史 · 按所选快照查看，不是实际模型运行记录。' : '历史只读 · 所有内容按所选快照读取，确认判断不等于批准行动。'}</span><button class="text-button" data-hh-reload>刷新历史 ${icon('history')}</button></div>
      <div class="hh-layout"><aside class="hh-timeline" aria-label="项目历史版本"><div class="hh-timeline-heading"><h2>历史版本</h2><span>${state.versions.length} 个</span></div>${state.versions.map((version, index) => `<button class="hh-version ${version.version === state.to ? 'is-selected' : ''}" data-hh-version="${version.version}" aria-pressed="${version.version === state.to}" ${busy ? 'disabled' : ''}><span class="hh-version-dot"></span><span class="hh-version-content"><span class="hh-version-title">v${version.version}${index === 0 ? badge('最新', 'orange') : ''}</span><span class="hh-version-date">${formatDate(version.created_at)}</span><span class="hh-version-type">${version.cause === 'correction' ? '用户纠错' : '材料分析'} · ${version.source_record_ids?.length ?? '未知'} 份材料</span><span class="hh-version-summary">${e(version.summary || '变化摘要未提供。')}</span>${badge(version.cause === 'correction' ? '判断确认／修改' : outcomeLabel[version.outcome] || '结果待核查', version.outcome === 'no_new_insight' ? 'green' : 'neutral')}</span></button>`).join('')}</aside>
      <section class="hh-workspace" aria-label="历史版本对比"><div class="hh-toolbar"><div><span class="eyebrow">COMPARE VERSIONS</span><h2>看见判断如何演变</h2></div><label class="hh-only-changes"><input id="hh-only-changes" type="checkbox" ${onlyChanges ? 'checked' : ''}>只突出变化</label></div>
      <div class="hh-selectors"><label for="hh-from-version">较早版本<select id="hh-from-version" ${busy || !fromOptions.length ? 'disabled' : ''}>${fromOptions.length ? fromOptions.map(item => `<option value="${item.version}" ${state.from === item.version ? 'selected' : ''}>v${item.version} · ${formatDate(item.created_at)}</option>`).join('') : '<option value="">没有更早版本</option>'}</select></label><span class="hh-selector-arrow">${icon('arrow')}</span><label for="hh-to-version">较晚版本<select id="hh-to-version" ${busy ? 'disabled' : ''}>${state.versions.map(item => `<option value="${item.version}" ${state.to === item.version ? 'selected' : ''}>v${item.version} · ${formatDate(item.created_at)}</option>`).join('')}</select></label><label class="hh-insight-select" for="hh-insight">关注点<select id="hh-insight" ${busy ? 'disabled' : ''}><option value="" ${state.insightId === '' ? 'selected' : ''}>全部关注点</option>${state.options.map(item => `<option value="${e(item.id)}" ${item.id === state.insightId ? 'selected' : ''}>${e(item.title)}</option>`).join('')}</select></label></div>
      ${state.versions.find(item => item.version === state.to)?.outcome === 'no_new_insight' ? `<div class="hh-stable-note">${icon('check')}本次分析记录为“无新火花”。材料覆盖有更新时，仍保留运行历史，不制造认知突破。</div>` : ''}
      <div class="hh-comparison-body">${busy ? loading('正在读取所选快照', '较早和较晚版本独立读取，不混入当前最新判断。') : state.status === 'error' ? errorPanel(state.error, 'comparison') : state.kind === 'overview' ? renderOverview(state) : renderComparison(state)}</div></section></div>`;
    if (focused) host.querySelector(`#${focused}`)?.focus({ preventScroll: true });
  }
  function loading(title, note) { return `<div class="hh-loading" role="status">${icon('clock')}<strong>${title}</strong><p>${note}</p></div>`; }
  function errorPanel(message, retry) { return `<section class="hh-error" role="alert">${icon('info')}<h3>暂时无法读取完整历史</h3><p>${e(message || '请检查服务与版本数据。')}</p><button class="button secondary" data-hh-retry="${retry}">重新读取</button></section>`; }
  function renderOverview(state) {
    return `<div class="hh-range-intro"><h3>${state.from === null ? '首次版本中的关注点' : `v${state.from} → v${state.to} 的关注点`}</h3><p>选择一项，查看判断、条件与证据的具体变化。</p></div><div class="hh-summary-cards">${state.options.map(option => {
      const left = state.leftOverview?.insights.find(item => item.id === option.id) || null;
      const right = state.rightOverview.insights.find(item => item.id === option.id) || null;
      // Summary rows do not contain candidate details. Avoid declaring "unchanged" from incomplete data.
      const kind = comparisonKind(left, right);
      const label = left?.dispute_status === 'open' || right?.dispute_status === 'open' ? '包含待确认分歧' : comparisonLabel[kind];
      return `<button class="hh-summary-card" data-hh-insight="${e(option.id)}"><span>${badge(label || '查看变化', kind === 'new' ? 'orange' : 'neutral')}<strong>${e(option.title)}</strong><span>${e(right?.judgment.text || left?.judgment.text || '该版本未提供判断。')}</span></span>${icon('arrow')}</button>`;
    }).join('') || '<div class="hh-stable-note">所选版本没有可比较的关注点。</div>'}</div>`;
  }
  function renderComparison(state) {
    const changed = state.fields.filter(field => field.changed), stable = state.fields.filter(field => !field.changed);
    const shown = onlyChanges ? changed : state.fields;
    const single = state.from === null;
    return `<div class="hh-comparison-heading"><div><h3>${e(state.right?.title || state.left?.title || '关注点')}</h3><span>${e(single ? '首次判断记录，不标为认知突破' : comparisonLabel[state.kind])}</span></div>${badge(single ? '首次记录' : !state.left ? '新增关注点' : !state.right ? '较晚版本未提供' : `${changed.length} 项不同`, changed.length ? 'orange' : 'green')}</div>
      <div class="hh-column-headings">${columnHeading('left', state.from, state.left, state.leftOverview)}${columnHeading('right', state.to, state.right, state.rightOverview)}</div>
      ${!single && state.kind === 'unchanged' ? `<div class="hh-stable-note">${icon('check')}这个关注点的判断与已提供的证据保持一致。版本增加不等于产生新的突破。</div>` : ''}
      ${state.right?.dispute_status === 'open' ? `<div class="hh-dispute-note">${icon('branch')}较晚版本仍有待确认分歧。下面分别展示当前判断与候选；候选没有被自动采纳。</div>` : ''}
      <div class="hh-fields">${shown.map(field => renderField(field, state)).join('') || '<p class="hh-no-diff">没有变化字段。可展开下方未变化内容核查完整判断。</p>'}</div>
      ${onlyChanges && stable.length ? `<details class="hh-unchanged"><summary>展开 ${stable.length} 项未变化内容 ${icon('down')}</summary><div class="hh-fields">${stable.map(field => renderField(field, state)).join('')}</div></details>` : ''}
      ${renderEvents(state)}<p class="hh-readonly-note">${icon('info')}这里只核查历史。更正与确认操作不在历史对比中执行，旧记录保持可追溯。</p>`;
  }
  function columnHeading(side, version, detail, overview) {
    return `<div class="hh-column-heading hh-column-${side}"><div><span>${side === 'left' ? '之前' : '后来'}</span><strong>${version === null ? '尚无更早版本' : `v${version}`}</strong></div><p>${version === null ? '这是项目的首次分析快照。' : `${overview?.source_record_ids.length ?? '未知'} 份材料覆盖 · 固定快照`}</p>${detail ? `<button class="text-button" data-hh-open-detail="${side}">打开该版本完整详情 ${icon('arrow')}</button>` : `<span class="hh-not-yet">${version === null ? '首次记录' : '此版本尚未出现该关注点'}</span>`}</div>`;
  }
  function renderField(field, state) {
    return `<section class="hh-field ${field.changed ? 'is-changed' : ''}"><div class="hh-field-label"><h4>${field.label}</h4>${!state.left ? '<span>本版提供</span>' : !state.right ? '<span>较晚版本未提供</span>' : field.changed ? '<span>有变化</span>' : '<span>保持一致</span>'}</div><div class="hh-field-values"><div class="hh-value hh-value-before">${value(field, 'before', state.left, state.from)}</div><div class="hh-value hh-value-after">${value(field, 'after', state.right, state.to)}</div></div></section>`;
  }
  function citation(id, detail, version) {
    const evidence = detail?.evidence.find(item => item.id === id);
    return evidence ? `<button class="hh-citation" data-hh-evidence="${e(id)}" data-hh-evidence-version="${version}">${icon('link')}${e(evidence.label || id)}<span>原话</span></button>` : `<span class="hh-missing-reference">${e(id)} · 该版本未提供引用详情</span>`;
  }
  function value(field, side, detail, version) {
    if (!detail) return `<p class="hh-absent">${version === null ? '尚无更早版本' : '此版本尚无该关注点'}</p>`;
    const content = field[side];
    if (field.key === 'evidence') return `<div class="hh-citations">${list(content).map(id => citation(id, detail, version)).join('') || '<span class="hh-muted">未提供引用；不能据此认定已核实。</span>'}</div>`;
    if (field.kind === 'candidate') {
      const candidate = detail.candidate_judgment;
      if (!candidate) return `<p class="hh-muted">${detail.dispute_status === 'open' ? '分歧尚未解决，候选详情未提供。' : '没有待确认候选。'}</p>`;
      return `<div class="hh-candidate">${badge('待确认，未替换当前判断', 'amber')}${badge(TYPE_LABELS[candidate.epistemic_type] || '类型待确认')}<p>${e(candidate.text)}</p>${list(candidate.conditions).length ? `<ul>${candidate.conditions.map(item => `<li>${e(item)}</li>`).join('')}</ul>` : ''}<div class="hh-citations">${list(candidate.evidence_ids).map(id => citation(id, detail, version)).join('')}</div></div>`;
    }
    if (field.kind === 'list') return list(content).length ? `<ul>${content.map(item => `<li>${e(item)}</li>`).join('')}</ul>` : '<p class="hh-muted">该版本未列出；不表示已经排除或核实。</p>';
    const labels = {
      type: TYPE_LABELS, review: { unreviewed: '待核查', confirmed: '已确认判断（不等于批准行动）' },
      basis: { recorded_statement: '材料中记录的说法，外部事实未必核实', provided_record: '材料记录', corroborated: '有交叉核实依据，仍可核查原文' },
      dispute: { none: '未记录未解决分歧', open: '存在待确认分歧' },
    };
    if (labels[field.kind]) return `<p>${e(content === null ? '不适用／未提供' : labels[field.kind][content] || '状态待确认')}</p>`;
    return `<p>${e(content || '该版本未提供说明。')}</p>`;
  }
  function renderEvents(state) {
    return `<section class="hh-reasons"><div class="hh-reasons-title">${icon('branch')}<h3>为什么发生变化</h3></div><p class="hh-muted">逐次保留所选区间的记录；跨多个版本时，不只看最后一次更新。</p>${state.events.map(event => `<article class="hh-reason"><div><strong>v${event.parent_version} → v${event.version}</strong>${badge(event.cause === 'correction' ? '用户纠错' : HISTORY_CHANGE_LABELS[event.type] || '变化待核查', event.is_breakthrough ? 'orange' : 'neutral')}${event.is_breakthrough ? badge('分析记录标记的认知变化', 'orange') : ''}</div><p>${e(event.reason || '该次更新未提供变化原因。')}</p>${event.cause === 'correction' ? `<p class="hh-correction">操作记录署名：${e(event.actor_label || '未提供')} · 理由：${e(event.correction_reason || '未提供')}</p>` : ''}<div class="hh-citations">${list(event.evidence_ids).map(id => `<button class="hh-citation" data-hh-evidence="${e(id)}" data-hh-evidence-version="${event.version}">${icon('link')}${e((event.version === state.to ? state.right : event.version === state.from ? state.left : null)?.evidence.find(item => item.id === id)?.label || '查看证据')}<span>在 v${event.version} 核查</span></button>`).join('')}</div></article>`).join('') || '<div class="hh-stable-note">所选区间未记录这个关注点的变化原因；不推造更新过程。</div>'}</section>`;
  }
  async function showSource(id, version) {
    closeSource();
    const generation = ++sourceGeneration, activeSession = session, insightId = session.state.insightId;
    const returnFocus = document.activeElement;
    const dialog = document.createElement('dialog'); sourceDialog = dialog;
    dialog.className = 'hh-source-dialog'; dialog.setAttribute('aria-labelledby', 'hh-source-title');
    dialog.innerHTML = `<header><div><span class="eyebrow">HISTORICAL EVIDENCE · v${version}</span><h2 id="hh-source-title">核查该版本原话</h2></div><button class="icon-button" data-hh-close-source aria-label="关闭历史证据">${icon('close')}</button></header><div class="hh-source-body">${loading('正在读取对应原文', '只使用这个版本提供的证据定位。')}</div>`;
    dialog.querySelector('[data-hh-close-source]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { if (sourceDialog === dialog) { sourceDialog = null; sourceGeneration++; } dialog.remove(); if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true }); }, { once: true });
    document.body.append(dialog); dialog.showModal();
    try {
      const { evidence, record } = await activeSession.evidence(id, version, insightId);
      if (generation !== sourceGeneration || !dialog.open || activeSession !== session) return;
      dialog.querySelector('#hh-source-title').textContent = record.title;
      dialog.querySelector('.hh-source-body').innerHTML = `<div class="hh-source-meta">${badge(evidence.label || evidence.id, 'orange')}${badge(`来自 v${version}`)}<span>${e(SOURCE_LABELS[record.source_type] || '来源类型待确认')} · ${e(record.source_date || '日期未提供')}</span></div><p class="hh-source-filename">${e(record.source_name || '来源名未提供')}</p>${record.segments.map(segment => `<section class="hh-source-segment ${segment.id === evidence.segment_id ? 'is-highlighted' : ''}"><span>段落 ${Number.isInteger(segment.paragraph_index) ? segment.paragraph_index : '未知'}</span><p>${e(segment.text)}</p>${segment.id === evidence.segment_id ? '<small>当前引用所在段落</small>' : ''}</section>`).join('')}<p class="hh-muted">引用与原文已做连续文本匹配；匹配只确认出处，不代表结论已充分成立。</p>`;
      dialog.querySelector('.is-highlighted')?.scrollIntoView({ block: 'nearest' });
    } catch (error) {
      if (generation === sourceGeneration && dialog.open) dialog.querySelector('.hh-source-body').innerHTML = `<div class="hh-error" role="alert"><h3>无法核查该版本引用</h3><p>${e(error.message)}</p><p>不会改用其他版本的证据替代。</p></div>`;
    }
  }
  function handleClick(event) {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.hasAttribute('data-hh-connect')) { onConnect(); return; }
    if (button.hasAttribute('data-hh-sample')) { onSample(); return; }
    if (!session) return;
    if (button.hasAttribute('data-hh-reload') || button.dataset.hhRetry === 'reload') { session.close(); contextKey = null; renderInto(host); return; }
    if (button.dataset.hhRetry === 'comparison') { session.selectPair(session.state.from, session.state.to, session.state.insightId); return; }
    if (button.dataset.hhVersion) session.selectTo(Number(button.dataset.hhVersion));
    if (button.dataset.hhInsight) session.selectInsight(button.dataset.hhInsight);
    if (button.dataset.hhEvidence) showSource(button.dataset.hhEvidence, Number(button.dataset.hhEvidenceVersion));
    if (button.dataset.hhOpenDetail) {
      const side = button.dataset.hhOpenDetail === 'left' ? 'left' : 'right';
      const version = side === 'left' ? session.state.from : session.state.to;
      const detail = session.state[side]; if (!detail || version === null) return;
      const activeSession = session, id = detail.id;
      const overview = side === 'left' ? session.state.leftOverview : session.state.rightOverview;
      onOpenDetail({ insightId: id, version, mode: overview?.engine_mode || 'live', example: getContext().workspace === 'demo', loadDetail: () => activeSession.detail(id, version), loadRecord: recordId => activeSession.loadRecord(recordId) });
    }
  }
  function handleChange(event) {
    if (event.target.id === 'hh-only-changes') { onlyChanges = event.target.checked; render(); }
    if (!session) return;
    if (event.target.id === 'hh-from-version') session.selectPair(Number(event.target.value), session.state.to);
    if (event.target.id === 'hh-to-version') session.selectTo(Number(event.target.value));
    if (event.target.id === 'hh-insight') session.selectInsight(event.target.value);
  }
  function deactivate() { session?.close(); session = null; source = null; contextKey = null; closeSource(); host = null; }
  return { renderInto, deactivate, getSelectedVersion: () => session?.state.to ?? null };
}
