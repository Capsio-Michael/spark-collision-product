import { icon } from './icons.js';
import { escapeHtml as e, TYPE_LABELS, SOURCE_LABELS } from './core.js';
import { DetailSession, RELATION_LABELS, CHANGE_LABELS, CATEGORY_LABELS, array, text, evidenceFor } from './insight-detail-model.js';
import { createJudgmentCorrections } from './judgment-corrections.js';
import { renderSparkPath } from './spark-view.js';

const typeLabel = value => TYPE_LABELS[value] || '类型待确认';
const badge = (label, tone = '') => `<span class="cd-badge ${tone ? `cd-badge-${tone}` : ''}">${e(label)}</span>`;
const typeBadge = block => badge(typeLabel(block?.epistemic_type), ['fact', 'opinion', 'inference', 'hypothesis'].includes(block?.epistemic_type) ? block.epistemic_type : '');
const paragraphs = value => `<p class="cd-prose">${e(text(value) || '该内容尚未提供。')}</p>`;
const list = (items, empty) => array(items).length ? `<ul class="cd-list">${array(items).map(item => `<li>${e(item)}</li>`).join('')}</ul>` : `<p class="cd-muted">${e(empty)}</p>`;
const evidenceId = detail => new Map(array(detail.evidence).map(item => [item.id, item]));

function citations(ids, detail) {
  const index = evidenceId(detail);
  return `<div class="cd-citations">${array(ids).map(id => {
    const evidence = index.get(id);
    return evidence
      ? `<button type="button" class="cd-citation" data-cd-evidence="${e(id)}" aria-label="核查证据 ${e(evidence.label || id)}">${icon('link')}${e(evidence.label || '引用')}<span>查看原话</span></button>`
      : `<span class="cd-missing-reference">${e(id)} · 引用缺失</span>`;
  }).join('')}</div>`;
}

function blockBody(block, detail) {
  if (!block || !text(block.text)) return '<p class="cd-muted">引擎尚未提供这一环节的分析。</p>';
  return `${typeBadge(block)}${paragraphs(block.text)}${citations(block.evidence_ids, detail)}
    ${array(block.conditions).length ? `<div class="cd-block-extra"><strong>适用条件</strong>${list(block.conditions, '')}</div>` : ''}
    ${array(block.alternative_explanations).length ? `<details class="cd-inline-details"><summary>其他可能的解释</summary>${list(block.alternative_explanations, '')}</details>` : ''}
    ${array(block.gaps).length ? `<div class="cd-block-extra cd-gap"><strong>仍缺的证据</strong>${list(block.gaps, '')}</div>` : ''}`;
}

function renderCollision(detail) {
  const card = detail.collision_card;
  if (!card) return `<section class="cd-section cd-no-collision"><div class="cd-section-title">${icon('bulb')}<h3>关键事实 / 待验证机会</h3></div><p>本项没有提供完整的认知碰撞卡。保留现有判断与证据，暂不将它标为认知突破。</p><p class="cd-muted">可继续核查原话、适用条件和下一步验证。</p></section>`;
  const steps = [
    ['A', '原来怎么想', card.prior, card.prior_origin === 'analysis_premise' ? '分析前提，非原话' : card.prior_origin === 'recorded' ? '材料中记录的旧判断' : '旧判断来源待确认'],
    ['B', '什么改变了判断', card.shock, '追问、反例或事实冲击'],
    ['C', '现在怎样理解', card.new_frame, '重新解释问题的机制'],
    ['D', '对业务意味着什么', card.implication, '分析推断，需结合条件验证'],
  ];
  return `<section class="cd-section cd-collision-section" aria-labelledby="cd-collision-title"><div class="cd-section-title">${icon('spark')}<h3 id="cd-collision-title">认知如何发生变化</h3>${badge(CATEGORY_LABELS[card.category] || '类型待确认')}</div><div class="cd-timeline">${steps.map(([letter, title, block, caption]) => `<section class="cd-step cd-step-${letter.toLowerCase()}"><span class="cd-step-marker" aria-hidden="true">${letter}</span><div class="cd-step-content"><div class="cd-step-heading"><h4>${title}</h4><span>${caption}</span></div>${blockBody(block, detail)}${letter === 'B' && !array(block?.evidence_ids).length ? '<p class="cd-warning">冲击证据尚未提供，不能据此确认认知突破。</p>' : ''}</div></section>`).join('')}<section class="cd-step cd-step-v"><span class="cd-step-marker" aria-hidden="true">V</span><div class="cd-step-content"><div class="cd-step-heading"><h4>下一步怎么验证</h4><span>把判断变成可检验的问题</span></div><p class="cd-prose">${array(card.validation_ids).length ? '具体实验、支持与推翻判据见下方验证清单。' : '尚未提供与本卡关联的验证动作。'}</p><button type="button" class="cd-text-button" data-cd-jump="validations">查看验证清单 ${icon('arrow')}</button></div></section></div></section>`;
}

function renderConflict(detail) {
  if (detail.dispute_status !== 'open' && !detail.candidate_judgment) return '';
  const candidate = detail.candidate_judgment;
  return `<section class="cd-section cd-conflict" aria-labelledby="cd-conflict-title"><div class="cd-section-title">${icon('branch')}<h3 id="cd-conflict-title">存在分歧，保留两种判断</h3>${badge('待确认', 'amber')}</div><p class="cd-muted">候选判断尚未取代当前判断。此处展示比较，未提交任何确认或执行操作。</p><div class="cd-conflict-grid"><div><span class="cd-overline">当前保留</span>${typeBadge(detail.judgment)}${paragraphs(detail.judgment.text)}${citations(detail.judgment.evidence_ids, detail)}</div><div><span class="cd-overline">候选解释</span>${candidate ? `${typeBadge(candidate)}${paragraphs(candidate.text)}${citations(candidate.evidence_ids, detail)}${array(candidate.conditions).length ? `<strong class="cd-mini-heading">候选适用条件</strong>${list(candidate.conditions, '')}` : ''}${array(candidate.evidence_gaps).length ? `<strong class="cd-mini-heading">候选证据缺口</strong>${list(candidate.evidence_gaps, '')}` : ''}` : '<p class="cd-muted">引擎尚未提供候选详情，请补齐后核对。</p>'}</div></div>${candidate?.rationale ? `<details class="cd-inline-details"><summary>查看候选依据与其他解释</summary>${paragraphs(candidate.rationale)}${list(candidate.alternative_explanations, '尚未提供其他解释。')}</details>` : ''}</section>`;
}

function renderValidation(detail) {
  const validations = array(detail.validations);
  const linked = new Set(array(detail.collision_card?.validation_ids));
  const missing = [...linked].filter(id => !validations.some(item => item.id === id));
  return `<section class="cd-section" id="cd-validations"><div class="cd-section-title"><span class="cd-v-symbol">V</span><h3>下一步，验证什么？</h3><span class="cd-count">${validations.length} 项建议</span></div><p class="cd-muted">验证建议尚未成为已批准行动；负责人和时间以实际商定为准。</p>${missing.length ? '<p class="cd-warning">碰撞卡引用了尚未提供详情的验证项，需引擎补齐。</p>' : ''}
    ${validations.length ? validations.map((item, index) => `<article class="cd-validation"><div class="cd-validation-heading"><span class="cd-validation-number">${String(index + 1).padStart(2, '0')}</span><div><h4>${e(item.question || '问题待补充')}</h4><div class="cd-validation-meta">${badge('待验证')}${linked.has(item.id) ? badge('本卡验证动作', 'orange') : ''}<span>${e(item.owner || '负责人待指定')}</span><span>${e(item.due_at || '时间待商定')}</span></div></div></div><p class="cd-prose">${e(item.decision_impact || '对决策的影响尚未说明。')}</p>${citations(item.evidence_ids, detail)}<details class="cd-validation-details"><summary>展开最小验证方案 ${icon('down')}</summary><dl class="cd-definition-list"><div><dt>最小实验</dt><dd>${e(item.experiment || '待补充')}</dd></div><div><dt>什么结果支持</dt><dd>${e(item.success_criteria || '判据待商定')}</dd></div><div><dt>什么结果推翻</dt><dd>${e(item.failure_criteria || '判据待商定')}</dd></div><div><dt>需要的材料</dt><dd>${list(item.required_materials, '待补充')}</dd></div><div><dt>找谁核对</dt><dd>${list(item.interview_roles, '访谈角色待确认')}</dd></div><div><dt>准备方式</dt><dd>${e({ customer_preparation: '客户提前准备', joint_walkthrough: '现场共同走查', internal_research: '内部研究' }[item.workstream] || '待确认')}</dd></div><div><dt>后续决定</dt><dd>${e(item.next_decision || '待商定')}</dd></div></dl></details></article>`).join('') : '<div class="cd-soft-empty">尚未提供验证动作。请补充能够支持或推翻当前判断的最小实验。</div>'}</section>`;
}

function renderCoverage(detail) {
  const coverage = detail.coverage || {};
  const level = { high: '高', medium: '中', low: '低', unknown: '待评估' };
  return `<section class="cd-section"><div class="cd-section-title">${icon('grid')}<h3>证据覆盖与判断边界</h3></div><div class="cd-coverage">${[['去重发言者', coverage.unique_speakers], ['主动提起', coverage.spontaneous_speakers], ['被问回应', coverage.prompted_speakers]].map(([label, count]) => `<div><strong>${Number.isInteger(count) ? count : '未知'}</strong><span>${label}</span></div>`).join('')}</div><p class="cd-muted">${e(coverage.note || '主动提起与被问回应人数可能重叠，未提及不代表不关心。')}${coverage.identity_incomplete ? ' 部分身份未知，统计覆盖不完整。' : ''}</p><div class="cd-priority">${[['business_impact', '经营影响'], ['evidence_strength', '证据充分度'], ['validation_feasibility', '验证可行性']].map(([key, label]) => `<details><summary><span>${label}</span><strong>${e(level[detail.priority?.[key]?.level] || '待评估')}</strong></summary><p>${e(detail.priority?.[key]?.reason || '尚未提供评估依据。')}</p></details>`).join('')}</div></section>`;
}

export function renderDetailAnalysis(detail) {
  const judgment = detail.judgment;
  const correctionSlot = '<div class="cd-correction-host"></div>';
  return `<div class="cd-analysis-inner"><section class="cd-judgment"><div class="cd-judgment-label">${icon('bulb')}当前判断 ${typeBadge(judgment)}${badge(judgment.review_status === 'confirmed' ? '已确认' : '待核查')}</div><h3>${e(judgment.text)}</h3>${judgment.epistemic_type === 'fact' ? '<p class="cd-fact-note">材料自述只证明“这样说过”；外部事实是否核实，请结合原文与核实依据判断。</p>' : ''}${citations(judgment.evidence_ids, detail)}<p class="cd-rationale">${e(judgment.rationale || '判断依据尚未提供。')}</p></section>
    ${detail.dispute_status === 'open' ? '' : correctionSlot}
    ${detail.last_change ? `<div class="cd-change-note">${icon('history')}<div><strong>${e(CHANGE_LABELS[detail.last_change.type] || '变化类型待确认')}</strong><span>${e(detail.last_change.reason || '变化原因尚未提供。')}</span></div></div>` : ''}
    ${renderConflict(detail)}${detail.dispute_status === 'open' ? correctionSlot : ''}${renderSparkPath(detail)}${renderCollision(detail)}
    <section class="cd-section"><div class="cd-section-title">${icon('branch')}<h3>哪些条件下成立？还有什么解释？</h3></div><div class="cd-boundaries"><div><h4>适用条件</h4>${list(judgment.conditions, '适用条件尚未提供，不能理解为无条件成立。')}</div><div><h4>其他可能的解释</h4>${list(judgment.alternative_explanations, '尚未提供其他解释；这不代表已经排除其他可能。')}</div><div class="cd-gap"><h4>仍缺什么证据</h4>${list(judgment.evidence_gaps, '未列出证据缺口，不代表已经得到充分验证。')}</div></div></section>
    ${renderValidation(detail)}${renderCoverage(detail)}<p class="cd-bottom-note">${icon('info')}确认或纠正判断不会自动批准上线或执行任务。原始材料与既有历史按版本保留。</p></div>`;
}

function sourceContent(state) {
  const evidence = array(state.detail?.evidence).find(item => item.id === state.selectedEvidenceId);
  if (state.sourceStatus === 'loading') return '<div class="cd-source-empty" role="status"><span class="cd-loader"></span><strong>正在读取原始材料</strong><p>保留左侧判断，核查对应出处。</p></div>';
  if (state.sourceStatus === 'error') return `<div class="cd-source-empty cd-source-error" role="alert">${icon('info')}<strong>暂时无法核查原文</strong><p>${e(state.sourceError)}</p>${evidence ? '<button type="button" class="cd-button" data-cd-retry-source>重试读取原文</button>' : ''}</div>`;
  if (state.sourceStatus !== 'ready' || !state.record || !evidence) return '<div class="cd-source-empty">' + icon('quote') + '<strong>让判断回到原话</strong><p>点击左侧引用或上方证据，<br>在这里查看来源与上下文。</p></div>';
  const record = state.record;
  const speaker = array(record.participants).find(person => person.id === evidence.speaker_id);
  return `<div class="cd-source-document"><div class="cd-source-document-heading"><div>${badge(record.material_basis === 'synthetic' ? '合成材料' : record.material_basis === 'authorized' ? '已获授权' : '材料来源待确认')}<span>${e(record.source_date || '日期未提供')}</span></div><h4>${e(record.title || '未命名材料')}</h4><p>${e(record.source_name || '来源名称未提供')} · ${e(SOURCE_LABELS[record.source_type] || '材料')}</p><p>${e(speaker?.label || '发言者身份未知')} · ${e({ participant_statement: '材料中的自述', provided_record: '提供的原始记录', unknown: '证据来源类型未知' }[evidence.claim_origin] || '证据来源类型未知')}</p></div>${array(record.segments).map(segment => `<section class="cd-source-paragraph ${segment.id === evidence.segment_id ? 'cd-highlight' : ''}" ${segment.id === evidence.segment_id ? 'data-cd-highlight tabindex="-1"' : ''}><div class="cd-paragraph-label">段落 ${e(segment.paragraph_index ?? '未知')}${segment.id === evidence.segment_id ? `<span>${e(evidence.label || '当前引用')} · 引用所在段落</span>` : ''}</div><p>${e(segment.text)}</p></section>`).join('')}<p class="cd-source-footnote">原文按服务端段落展示，整段高亮；未改写原始材料。</p></div>`;
}

export function renderDetailEvidence(state) {
  const detail = state.detail;
  const items = evidenceFor(detail, state.filter);
  const links = array(detail?.relations);
  return `<div class="cd-evidence-heading"><div>${icon('quote')}<h3>证据核查</h3><span>${array(detail?.evidence).length} 条原话</span></div><p>先看出处，再判断是否支持这个结论。</p></div>
    <div class="cd-evidence-filters" role="group" aria-label="按证据关系筛选">${Object.entries(RELATION_LABELS).filter(([key]) => key !== 'unknown' || evidenceFor(detail, 'unknown').length).map(([key, label]) => `<button type="button" data-cd-filter="${key}" aria-pressed="${state.filter === key}">${label}<span>${evidenceFor(detail, key).length}</span></button>`).join('')}</div>
    <div class="cd-evidence-list" aria-label="原话证据列表">${items.length ? items.map(item => `<button type="button" class="cd-evidence-item ${state.selectedEvidenceId === item.id ? 'cd-evidence-selected' : ''}" data-cd-evidence="${e(item.id)}" aria-pressed="${state.selectedEvidenceId === item.id}"><span class="cd-evidence-item-top"><strong>${e(item.label || '引用')}</strong><span>${links.filter(link => link.evidence_id === item.id).map(link => e(RELATION_LABELS[link.relation] || '关系待确认')).join(' · ') || '关系未标注'}</span>${icon('arrow')}</span><span class="cd-evidence-quote">${e(item.quote || '原话尚未提供')}</span><span class="cd-evidence-method">${e({ spontaneous: '主动提起', prompted: '被问回应', unknown: '提问方式未知' }[item.elicitation] || '提问方式未知')}</span></button>`).join('') : '<p class="cd-filter-empty">这个分类下没有提供证据。可切换其他分类。</p>'}</div>
    <section class="cd-source-pane" aria-label="原始材料与上下文">${sourceContent(state)}</section>`;
}

let activeDetail = null;
export function openInsightDetail(options) {
  activeDetail?.close();
  if (!document.querySelector('#cd-detail-styles')) {
    const stylesheet = document.createElement('link'); stylesheet.id = 'cd-detail-styles'; stylesheet.rel = 'stylesheet'; stylesheet.href = new URL('./insight-detail.css', import.meta.url).href; document.head.append(stylesheet);
  }
  if (!document.querySelector('#jc-correction-styles')) {
    const stylesheet = document.createElement('link'); stylesheet.id = 'jc-correction-styles'; stylesheet.rel = 'stylesheet'; stylesheet.href = new URL('./judgment-corrections.css', import.meta.url).href; document.head.append(stylesheet);
  }
  const returnFocus = document.activeElement;
  const dialog = document.createElement('dialog'); dialog.className = 'cd-dialog'; dialog.setAttribute('aria-labelledby', 'cd-dialog-title');
  dialog.innerHTML = `<header class="cd-header"><div><span class="cd-eyebrow">INSIGHT EXPLORER · ${options.example ? '合成案例' : options.mode === 'mock' ? '模拟引擎结果' : '引擎分析'}</span><h2 id="cd-dialog-title">认知碰撞详情</h2></div><div class="cd-header-actions"><span class="cd-version">版本 ${e(options.version ?? '待确认')}</span><button type="button" class="cd-close" data-cd-close aria-label="关闭详情并返回">${icon('close')}</button></div></header><nav class="cd-section-nav" aria-label="详情章节"><button type="button" data-cd-jump="top">当前判断</button><button type="button" data-cd-jump="spark">碰撞路径</button><button type="button" data-cd-jump="collision">认知变化</button><button type="button" data-cd-jump="validations">验证计划</button><button type="button" data-cd-jump="evidence">原话证据 ${icon('arrow')}</button></nav><div class="cd-body"><main class="cd-analysis" aria-label="完整认知分析"></main><aside class="cd-evidence" aria-label="证据与原文核查"></aside></div><div class="cd-live sr-only" role="status" aria-live="polite"></div>`;
  document.body.append(dialog); document.body.classList.add('cd-modal-open');
  const analysis = dialog.querySelector('.cd-analysis'); const evidencePane = dialog.querySelector('.cd-evidence');
  let lastDetail = null, lastStatus = null, lastSource = null, correctionView = null, initialSparkShown = false;
  const session = new DetailSession({ ...options, onChange(state) {
    if (!dialog.isConnected) return;
    if (state.status !== lastStatus || state.detail !== lastDetail) {
      analysis.innerHTML = state.status === 'loading' ? '<div class="cd-load-state" role="status"><span class="cd-loader"></span><h3>正在打开认知详情</h3><p>读取当前版本的判断、证据与验证问题。</p></div>' : state.status === 'error' ? `<div class="cd-load-state" role="alert">${icon('info')}<h3>详情暂时无法打开</h3><p>${e(state.error)}</p><button type="button" class="cd-button" data-cd-retry>重新加载详情</button></div>` : renderDetailAnalysis(state.detail);
      dialog.querySelector('#cd-dialog-title').textContent = state.detail?.title || '认知碰撞详情';
      dialog.querySelector('.cd-version').textContent = `版本 ${state.detail?.snapshot_version ?? options.version ?? '待确认'}`;
      lastDetail = state.detail; lastStatus = state.status;
      if (state.status === 'ready') correctionView?.attach(analysis.querySelector('.cd-correction-host'));
      if (state.status === 'ready' && options.showSpark && !initialSparkShown) {
        initialSparkShown = true;
        const showPath = () => requestAnimationFrame(() => { if (!session.closed) analysis.querySelector('.sp-path')?.scrollIntoView({ block: 'start', behavior: 'instant' }); });
        const stylesheet = document.querySelector('#cd-detail-styles');
        if (stylesheet?.sheet) showPath();
        else stylesheet?.addEventListener('load', showPath, { once: true });
      }
    }
    const sourceScroll = evidencePane.querySelector('.cd-source-pane')?.scrollTop || 0;
    const listScroll = evidencePane.querySelector('.cd-evidence-list')?.scrollTop || 0;
    const focused = evidencePane.contains(document.activeElement) ? document.activeElement : null;
    const focusedEvidence = focused?.dataset.cdEvidence;
    const focusedFilter = focused?.dataset.cdFilter;
    evidencePane.innerHTML = state.status === 'ready' ? renderDetailEvidence(state) : '<div class="cd-source-empty">' + icon('quote') + '<strong>原文核查区</strong><p>详情读取完成后，可点击引用查看原话。</p></div>';
    if (focusedEvidence) [...evidencePane.querySelectorAll('[data-cd-evidence]')].find(item => item.dataset.cdEvidence === focusedEvidence)?.focus({ preventScroll: true });
    else if (focusedFilter) [...evidencePane.querySelectorAll('[data-cd-filter]')].find(item => item.dataset.cdFilter === focusedFilter)?.focus({ preventScroll: true });
    if (state.sourceStatus === 'ready' && state.record !== lastSource) {
      lastSource = state.record;
      requestAnimationFrame(() => dialog.querySelector('[data-cd-highlight]')?.scrollIntoView({ block: 'nearest', behavior: 'instant' }));
    } else if (evidencePane.querySelector('.cd-source-pane')) evidencePane.querySelector('.cd-source-pane').scrollTop = sourceScroll;
    if (evidencePane.querySelector('.cd-evidence-list')) evidencePane.querySelector('.cd-evidence-list').scrollTop = listScroll;
    dialog.querySelector('.cd-live').textContent = state.sourceStatus === 'loading' ? '正在读取原话' : state.sourceStatus === 'ready' ? '原话已定位，对应段落已高亮' : state.sourceStatus === 'error' ? state.sourceError : state.status === 'ready' ? '完整认知详情已打开' : '';
  } });
  let correctionStorage;
  try { correctionStorage = options.corrections?.storage || options.storage || window.localStorage; }
  catch { correctionStorage = { getItem() { throw new Error('Storage unavailable'); }, setItem() { throw new Error('Storage unavailable'); } }; }
  correctionView = createJudgmentCorrections({
    getDetail: () => session.state.detail,
    context: { ...options.corrections, storage: correctionStorage, insightId: options.insightId,
      preview: !!options.example && !options.readOnly,
      readOnly: !!options.readOnly || (!options.example && !options.corrections) },
    onSynced(result) {
      if (session.closed) return;
      session.generation++; session.sourceGeneration++; session.version = result.currentVersion;
      if (options.corrections?.loadDetail) session.loadDetail = () => options.corrections.loadDetail(session.version);
      session.update({ status: 'ready', detail: result.detail, error: null, filter: 'all', selectedEvidenceId: null,
        sourceStatus: 'idle', record: null, sourceError: null });
    },
    onBusy(busy) { dialog.querySelector('[data-cd-close]').disabled = busy; dialog.setAttribute('aria-busy', String(busy)); },
  });
  dialog.addEventListener('cancel', event => { if (correctionView?.isBusy()) event.preventDefault(); });
  dialog.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-cd-close') && !correctionView?.isBusy()) dialog.close();
    if (button.hasAttribute('data-cd-retry')) session.load();
    if (button.hasAttribute('data-cd-retry-source')) session.selectEvidence(session.state.selectedEvidenceId);
    if (button.dataset.cdEvidence) {
      session.selectEvidence(button.dataset.cdEvidence);
      if (window.matchMedia('(max-width: 800px)').matches) evidencePane.scrollIntoView({ block: 'start' });
    }
    if (button.dataset.cdFilter) {
      const filter = button.dataset.cdFilter;
      session.setFilter(filter);
      evidencePane.querySelector(`[data-cd-filter="${filter}"]`)?.focus({ preventScroll: true });
    }
    if (button.dataset.cdJump) {
      const target = button.dataset.cdJump;
      if (target === 'top') analysis.querySelector('.cd-judgment')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      else (target === 'evidence' ? evidencePane : analysis.querySelector(target === 'spark' ? '.sp-path, .cd-no-collision' : target === 'collision' ? '.cd-collision-section, .cd-no-collision' : '#cd-validations'))?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  });
  dialog.addEventListener('close', () => {
    session.close(); correctionView?.dispose(); dialog.remove();
    if (activeDetail?.dialog !== dialog) return;
    activeDetail = null; document.body.classList.remove('cd-modal-open');
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    else document.querySelector('#main-content')?.focus({ preventScroll: true });
  }, { once: true });
  dialog.showModal();
  dialog.querySelector('[data-cd-close]').focus();
  activeDetail = { dialog, close: () => dialog.close(), session };
  session.load();
  return activeDetail;
}
