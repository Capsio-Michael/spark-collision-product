import { escapeHtml as e, TYPE_LABELS } from './core.js';
import { array } from './insight-detail-model.js';
import { CORRECTION_LABELS, CorrectionController, CorrectionJournal, correctionActions, initialCorrectionValues } from './judgment-corrections-model.js';

const explanations = {
  confirm_current: '确认你认可当前判断及其适用条件。它的事实、观点或推断类型保持不变，不代表批准执行。',
  edit_current: '修改判断与条件，并保留原文引用。原判断留在服务端历史中，原始材料不会被改写。',
  accept_candidate: '将候选解释采用为当前判断。旧判断和冲突证据仍留在历史中。',
  reject_candidate: '本次保留当前判断，关闭当前待确认分歧。候选与反例不会从历史中消失；当前判断的审核状态保持原样。',
};
const unsafe = new Set(['uncertain', 'sync_error', 'other_pending', 'blocked', 'stale']);
const disabled = value => value ? 'disabled' : '';
const input = (name, label, value, max, extra = '') => `<label class="jc-field"><span>${label}</span><input name="${name}" value="${e(value)}" maxlength="${max}" ${extra}></label>`;
const textarea = (name, label, value, max = 4000, extra = '') => `<label class="jc-field"><span>${label}</span><textarea name="${name}" maxlength="${max}" rows="${name === 'text' ? 4 : 3}" ${name === 'rationale' ? '' : extra}>${e(value)}</textarea></label>`;

export function renderCorrectionPanel(detail, context = {}, state = {}, form = null) {
  if (context.readOnly) return `<div class="jc-readonly">历史详情只读。请返回最新项目总览，核对当前判断后再确认或修改。</div>`;
  if (!context.preview && !context.enabled) return '<div class="jc-readonly">当前为只读详情。连接引擎并从最新项目总览打开后，可确认或纠正判断。</div>';
  const current = context.currentVersion;
  const stale = !context.preview && (!Number.isInteger(current) || current !== detail.snapshot_version);
  const blocked = context.busy || state.busy || unsafe.has(state.status) || stale;
  const actions = correctionActions(detail);
  const status = state.message ? `<div class="jc-status jc-status-${e(state.status || 'idle')}" role="${['error', 'uncertain', 'sync_error', 'stale', 'blocked'].includes(state.status) ? 'alert' : 'status'}" tabindex="-1"><strong>${e(state.message)}</strong>${state.receipt ? `<span>记录 ${e(state.receipt.id)} · 操作人 ${e(state.receipt.actor_label)} · ${e(state.receipt.reason)}</span>` : ''}</div>` : '';
  const recovery = ['uncertain', 'sync_error'].includes(state.status) ? `${state.pendingRequest ? `<p class="jc-preview-note">原操作：${e(CORRECTION_LABELS[state.pendingRequest.action] || '待核查')} · 基于 v${e(state.pendingRequest.expected_version)} · ${e(state.pendingRequest.reason)}</p>` : ''}<button type="button" class="jc-button jc-primary" data-jc-resume ${disabled(state.busy)}>${state.receipt ? '恢复新版本同步' : '用原请求恢复提交结果'}</button>` : '';
  const reload = (stale || state.status === 'stale' || state.status === 'error') && !context.preview && !['uncertain', 'sync_error', 'other_pending', 'blocked'].includes(state.status) ? `<button type="button" class="jc-button" data-jc-reload ${disabled(state.busy)}>读取最新判断，保留输入草稿</button>` : '';
  let formHtml = '';
  if (form) {
    const values = form.values;
    const judgment = ['accept_candidate'].includes(form.action) ? detail.candidate_judgment : detail.judgment;
    const edit = form.action === 'edit_current';
    formHtml = `<form class="jc-form"><div class="jc-form-heading"><h4>${e(CORRECTION_LABELS[form.action])}</h4><span>基于当前 v${detail.snapshot_version}</span></div><p class="jc-explanation">${e(explanations[form.action])}</p>${form.baseVersion !== detail.snapshot_version ? `<p class="jc-review-note">保留了 v${e(form.baseVersion)} 的输入草稿。请与下方最新判断、原文和条件重新核对。</p>` : ''}<fieldset ${disabled(state.busy || unsafe.has(state.status) || stale)}><legend class="sr-only">操作内容和理由</legend><div class="jc-original"><span>${edit ? '修改前的当前判断' : '本次处理的判断'}</span><p>${e(judgment?.text || '候选尚未提供')}</p></div>
      ${edit ? `${textarea('text', '修正后的判断', values.text, 4000, 'required')}${textarea('conditions', '适用条件（每行一项）', values.conditions)}<label class="jc-field"><span>判断类型</span><select name="epistemic_type">${Object.entries(TYPE_LABELS).map(([value, label]) => `<option value="${value}" ${values.epistemic_type === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><div class="jc-fact-fields" ${values.epistemic_type !== 'fact' ? 'hidden' : ''}><label class="jc-field"><span>事实依据</span><select name="fact_basis"><option value="">请选择依据</option><option value="recorded_statement" ${values.fact_basis === 'recorded_statement' ? 'selected' : ''}>材料中记录的说法</option><option value="provided_record" ${values.fact_basis === 'provided_record' ? 'selected' : ''}>提供的原始记录</option></select></label><label class="jc-checkbox"><input type="checkbox" name="fact_acknowledged" ${values.fact_acknowledged ? 'checked' : ''}><span>我核对了引用，该表述与材料依据一致，没有把未核实的外部说法当作事实。</span></label></div><p class="jc-citation-note">保留 ${array(detail.judgment.evidence_ids).length} 项现有引用，可在详情右侧核查。本表单不修改原文或授予“已交叉核实”状态。</p><details class="jc-advanced"><summary>判断依据、其他解释与证据缺口</summary>${textarea('rationale', '判断依据', values.rationale, 4000, 'required')}${textarea('alternative_explanations', '其他可能的解释（每行一项）', values.alternative_explanations)}${textarea('evidence_gaps', '仍缺什么证据（每行一项）', values.evidence_gaps)}</details>` : ''}
      ${input('actor_label', '操作人称呼', values.actor_label, 80, 'required autocomplete="off" placeholder="用于记录本次操作，不是登录身份"')}${textarea('reason', '为什么这样处理？', values.reason, 2000, 'required placeholder="说明你核查到的依据，以及确认或修改的原因"')}
      <label class="jc-checkbox"><input type="checkbox" name="reviewed" ${values.reviewed ? 'checked' : ''} required><span>我已对照当前版本核查判断、原话与适用条件；本次操作不代表批准上线或执行任务。</span></label></fieldset><p class="jc-inline-error" role="alert" hidden></p><div class="jc-form-footer"><button type="button" class="jc-button" data-jc-cancel ${disabled(state.busy || ['uncertain', 'sync_error'].includes(state.status))}>收起，保留草稿</button><button type="submit" class="jc-button jc-primary" ${disabled(blocked || context.preview)}>${context.preview ? '示例预览，不提交保存' : state.busy ? '正在保存／同步…' : '确认并保存'}</button></div></form>`;
  }
  return `<section class="jc-panel" aria-label="判断确认与纠错"><div class="jc-heading"><span>核查之后，处理这个判断</span><span>${context.preview ? '合成示例 · 表单预览' : '保存到项目新版本'}</span></div>${context.preview ? '<p class="jc-preview-note">可以预览操作表单；固定合成案例不写入项目，也不伪造保存结果。实际保存需连接引擎。</p>' : ''}${stale ? '<p class="jc-review-note">当前详情不是已知的最新版本，请先读取最新判断。</p>' : ''}${context.busy ? '<p class="jc-review-note">项目正在分析或处理其他请求，请等待完成后再操作。</p>' : ''}${status}${recovery}${reload}${!form && !blocked ? `<div class="jc-actions">${actions.map(action => `<button type="button" class="jc-button ${['confirm_current', 'accept_candidate'].includes(action) ? 'jc-primary' : ''}" data-jc-action="${action}">${e(CORRECTION_LABELS[action])}</button>`).join('')}</div>${!actions.length ? '<p class="jc-readonly">当前状态或候选信息不完整，需补齐后再处理。</p>' : ''}` : ''}${formHtml}</section>`;
}

export function createJudgmentCorrections({ getDetail, context = {}, onSynced = () => {}, onBusy = () => {} }) {
  let host = null, form = null, controller = null, localMessage = '', disposed = false, previousStatus = null;
  let journal;
  const enabled = !context.readOnly && typeof context.send === 'function' && typeof context.refreshLatest === 'function';
  try {
    if (!context.readOnly && (enabled || context.preview)) {
      journal = new CorrectionJournal(context.storage, `${encodeURIComponent(context.baseUrl || 'synthetic-preview')}:${context.projectId || 'prj_demo'}`);
      if (enabled) controller = new CorrectionController({
        insightId: context.insightId, journal, send: context.send, refreshLatest: context.refreshLatest,
        getCurrentVersion: context.getCurrentVersion, isBusy: context.isBusy, isReadOnly: () => !!context.readOnly,
        onChange: () => { render(); onBusy(!!controller?.busy); },
        onSynced: async (result, receipt) => {
          if (receipt) form = null;
          else if (form) { form.values.reviewed = false; form.values.fact_acknowledged = false; }
          await onSynced(result, receipt);
        },
      });
      journal.read();
    }
  } catch (failure) { localMessage = failure.message; }

  function render() {
    if (disposed || !host?.isConnected || !getDetail()) return;
    const status = localMessage ? { status: 'blocked', message: localMessage } : { ...controller?.state, busy: controller?.busy || false };
    host.innerHTML = renderCorrectionPanel(getDetail(), {
      ...context, enabled, currentVersion: context.getCurrentVersion?.(), busy: context.isBusy?.() || false,
    }, status, form);
    if (status.status !== previousStatus && ['saved', 'stale', 'error', 'uncertain', 'sync_error', 'reloaded'].includes(status.status)) host.querySelector('.jc-status')?.focus({ preventScroll: true });
    previousStatus = status.status;
  }
  function attach(nextHost) {
    if (nextHost && host !== nextHost) {
      host = nextHost; host.addEventListener('click', click); host.addEventListener('submit', submit);
      host.addEventListener('input', capture); host.addEventListener('change', change);
    }
    render();
  }
  function showError(message) {
    const target = host?.querySelector('.jc-inline-error');
    if (target) { target.textContent = message; target.hidden = false; }
    else { localMessage = message; render(); }
  }
  function capture() {
    const element = host?.querySelector('form'); if (!element || !form) return;
    const data = new FormData(element);
    for (const name of Object.keys(form.values)) if (element.elements.namedItem(name)) form.values[name] = ['reviewed', 'fact_acknowledged'].includes(name) ? data.has(name) : String(data.get(name) || '');
    try { journal?.saveDraft(getDetail().id, { action: form.action, base_version: form.baseVersion, values: form.values }); }
    catch (failure) { showError(failure.message); }
  }
  function change(event) {
    capture();
    if (event.target.name === 'epistemic_type') {
      host.querySelector('.jc-fact-fields').hidden = event.target.value !== 'fact';
      form.values.fact_acknowledged = false;
      const checkbox = host.querySelector('[name="fact_acknowledged"]'); if (checkbox) checkbox.checked = false;
    }
  }
  async function click(event) {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.jcAction) {
      try {
        const detail = getDetail(); const saved = journal?.read(); const draft = saved?.drafts[detail.id];
        form = { action: button.dataset.jcAction, baseVersion: draft?.action === button.dataset.jcAction ? draft.base_version : detail.snapshot_version,
          values: draft?.action === button.dataset.jcAction ? { ...initialCorrectionValues(detail), ...draft.values, reviewed: false, fact_acknowledged: false } : initialCorrectionValues(detail, saved?.actor_label || '') };
        localMessage = ''; render(); host.querySelector('[name="text"], [name="actor_label"]')?.focus({ preventScroll: true });
      } catch (failure) { showError(failure.message); }
    }
    if (button.hasAttribute('data-jc-cancel')) { capture(); form = null; render(); }
    if (button.hasAttribute('data-jc-resume')) {
      try { await controller.resume(); } catch { /* Controller keeps the immutable pending request. */ }
    }
    if (button.hasAttribute('data-jc-reload')) {
      capture();
      try { await controller.reloadLatest(); } catch { /* Preserve original input and display state. */ }
    }
  }
  async function submit(event) {
    event.preventDefault();
    if (!controller || !form || controller.busy || context.preview) return;
    capture();
    try { await controller.submit(getDetail(), form.action, form.values); }
    catch (failure) { if (failure.code === 'FORM_INVALID' || failure.code === 'ACTION_UNAVAILABLE') showError(failure.message); }
  }
  return { attach, render, isBusy: () => !!controller?.busy, dispose() { disposed = true; controller?.dispose(); }, controller };
}
