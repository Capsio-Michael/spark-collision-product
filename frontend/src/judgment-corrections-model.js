import { array, text, validateDetail } from './insight-detail-model.js';

export const CORRECTION_LABELS = {
  confirm_current: '确认当前判断', edit_current: '纠正判断',
  accept_candidate: '采用候选判断', reject_candidate: '保留当前判断',
};
const types = ['fact', 'opinion', 'inference', 'hypothesis'];
const count = value => Array.from(value).length;
const error = (message, code = 'FORM_INVALID') => Object.assign(new Error(message), { code });
const lines = value => [...new Set(text(value).split(/\r?\n/).map(item => item.trim()).filter(Boolean))];
const checkedString = (value, min, max, label) => {
  const trimmed = text(value).trim();
  if (count(trimmed) < min || count(trimmed) > max) throw error(`${label}需为 ${min}–${max} 个字符。`);
  return trimmed;
};

export function correctionActions(detail) {
  if (!detail?.judgment?.id || !Number.isInteger(detail.snapshot_version) || detail.snapshot_version < 1) return [];
  if (detail.dispute_status === 'open') return detail.candidate_judgment?.id ? ['accept_candidate', 'reject_candidate'] : [];
  if (detail.candidate_judgment) return [];
  return detail.judgment.review_status === 'confirmed' ? ['edit_current'] : ['confirm_current', 'edit_current'];
}

export function initialCorrectionValues(detail, actor = '') {
  const judgment = detail.judgment;
  return {
    actor_label: actor, reason: '', text: judgment.text, epistemic_type: judgment.epistemic_type,
    conditions: array(judgment.conditions).join('\n'), rationale: text(judgment.rationale),
    alternative_explanations: array(judgment.alternative_explanations).join('\n'),
    evidence_gaps: array(judgment.evidence_gaps).join('\n'),
    // Editing a corroborated fact requires re-stating its basis; never inherit verification for changed words.
    fact_basis: ['recorded_statement', 'provided_record'].includes(judgment.fact_basis) ? judgment.fact_basis : '',
    reviewed: false, fact_acknowledged: false,
  };
}

export function buildCorrection(detail, action, values) {
  if (!correctionActions(detail).includes(action)) throw error('当前判断状态不支持这项操作，请重新读取最新判断。', 'ACTION_UNAVAILABLE');
  if (!values.reviewed) throw error('请先核对判断、证据和适用条件，并勾选确认。');
  const body = {
    insight_id: detail.id, expected_version: detail.snapshot_version,
    expected_judgment_id: detail.judgment.id,
    actor_label: checkedString(values.actor_label, 1, 80, '操作人称呼'),
    action, reason: checkedString(values.reason, 1, 2000, '操作理由'),
    candidate_judgment_id: ['accept_candidate', 'reject_candidate'].includes(action) ? detail.candidate_judgment.id : null,
    replacement: null,
  };
  if (action === 'edit_current') {
    if (!types.includes(values.epistemic_type)) throw error('请选择有效的判断类型。');
    const ids = [...new Set(array(detail.judgment.evidence_ids))];
    if (ids.some(id => !array(detail.evidence).some(item => item.id === id))) throw error('当前引用缺失，请先让引擎修复出处，再修改判断。');
    if (['fact', 'opinion'].includes(values.epistemic_type) && !ids.length) throw error('事实或观点必须有原文依据。');
    if (values.epistemic_type === 'fact') {
      if (!['recorded_statement', 'provided_record'].includes(values.fact_basis)) throw error('请明确事实依据；本表单不将修改后的内容标为已交叉核实。');
      if (values.fact_basis === 'provided_record' && !array(detail.evidence).some(item => ids.includes(item.id) && item.claim_origin === 'provided_record')) throw error('现有引用没有标为原始记录的依据，请选择“材料中记录的说法”或先核查来源。');
      if (!values.fact_acknowledged) throw error('请确认该表述与所选材料依据一致，没有把未核实的外部说法写成事实。');
    }
    const alternatives = lines(values.alternative_explanations);
    const gaps = lines(values.evidence_gaps);
    if (['inference', 'hypothesis'].includes(values.epistemic_type) && !alternatives.length && !gaps.length) throw error('推断或假设需保留其他解释，或说明尚缺哪些验证证据。');
    body.replacement = {
      text: checkedString(values.text, 1, 4000, '判断内容'), epistemic_type: values.epistemic_type,
      fact_basis: values.epistemic_type === 'fact' ? values.fact_basis : null,
      conditions: lines(values.conditions), evidence_ids: ids,
      rationale: checkedString(values.rationale, 1, 4000, '判断依据'),
      alternative_explanations: alternatives, evidence_gaps: gaps,
    };
    if (JSON.stringify(body.replacement) === JSON.stringify(Object.fromEntries(Object.keys(body.replacement).map(key => [key, detail.judgment[key]])))) throw error('判断内容与条件没有变化；如需确认，请使用确认判断。');
  }
  return body;
}

export function validateCorrectionReceipt(receipt, body) {
  if (!receipt || !text(receipt.id) || receipt.insight_id !== body.insight_id || receipt.action !== body.action
    || receipt.previous_version !== body.expected_version || receipt.result_version !== body.expected_version + 1
    || receipt.actor_label !== body.actor_label || receipt.reason !== body.reason
    || !text(receipt.created_at) || Number.isNaN(Date.parse(receipt.created_at))) throw error('服务返回的保存记录不符合契约，结果尚待核查。请保留原请求恢复，勿重新提交。', 'RECEIPT_INVALID');
  return receipt;
}

export function validateAppliedCorrection(detail, receipt, body) {
  if (detail.snapshot_version !== receipt.result_version) return;
  const judgment = detail.judgment;
  const resolved = detail.dispute_status === 'none' && !detail.candidate_judgment;
  let valid = true;
  if (body.action === 'confirm_current') valid = judgment.id === body.expected_judgment_id && judgment.review_status === 'confirmed';
  if (body.action === 'accept_candidate') valid = resolved && judgment.id === body.candidate_judgment_id && judgment.review_status === 'confirmed';
  if (body.action === 'reject_candidate') valid = resolved && judgment.id === body.expected_judgment_id;
  if (body.action === 'edit_current') valid = judgment.id !== body.expected_judgment_id && judgment.review_status === 'confirmed'
    && Object.keys(body.replacement).every(key => JSON.stringify(judgment[key]) === JSON.stringify(body.replacement[key]));
  if (!valid) throw error('保存记录与该版本的判断状态不一致，请核查引擎并恢复同步。', 'RESPONSE_INVALID');
}

// The journal stores request/draft recovery, not project history. History remains server-owned.
export class CorrectionJournal {
  constructor(storage, namespace) { this.storage = storage; this.key = `spark-collision:corrections:v1:${namespace}`; }
  read() {
    try {
      const value = JSON.parse(this.storage.getItem(this.key) || '{"schema_version":1,"pending":null,"drafts":{},"actor_label":""}');
      if (value.schema_version !== 1 || !value.drafts || Array.isArray(value.drafts) || typeof value.drafts !== 'object'
        || typeof value.actor_label !== 'string' || (value.pending !== null && (!value.pending || !text(value.pending.key) || !value.pending.body?.insight_id || !Number.isInteger(value.pending.body.expected_version)))) throw new Error('Invalid journal');
      if (value.pending?.receipt) validateCorrectionReceipt(value.pending.receipt, value.pending.body);
      return value;
    } catch { throw error('无法读取操作恢复记录，原数据未覆盖。请保留输入并检查浏览器存储。', 'STORAGE_ERROR'); }
  }
  write(update) {
    const next = update(this.read());
    try { this.storage.setItem(this.key, JSON.stringify(next)); }
    catch { throw error('浏览器无法保存操作恢复记录。请复制输入并释放存储空间，当前未发起新的提交。', 'STORAGE_ERROR'); }
    return next;
  }
  saveDraft(id, draft) { return this.write(value => ({ ...value, drafts: { ...value.drafts, [id]: draft } })); }
  begin(pending) {
    return this.write(value => {
      if (value.pending) throw error('这个项目还有结果待确认的提交，请先恢复原操作。', 'PENDING_OPERATION');
      return { ...value, pending };
    });
  }
  markReceipt(key, receipt) {
    return this.write(value => {
      if (value.pending?.key !== key) throw error('操作恢复记录发生变化，请先核查原提交。', 'PENDING_OPERATION');
      return { ...value, pending: { ...value.pending, receipt } };
    });
  }
  clearPending(key, { clearDraft = false, actor = '' } = {}) {
    return this.write(value => {
      if (value.pending?.key !== key) throw error('操作恢复记录发生变化，请先核查原提交。', 'PENDING_OPERATION');
      const drafts = { ...value.drafts };
      if (clearDraft) delete drafts[value.pending.body.insight_id];
      return { ...value, drafts, pending: null, actor_label: actor || value.actor_label };
    });
  }
}

const definitive = new Set(['VERSION_CONFLICT', 'CANDIDATE_CONFLICT', 'UNRESOLVED_CONFLICT', 'ALREADY_CONFIRMED', 'PROJECT_BUSY', 'VALIDATION_ERROR', 'PAYLOAD_TOO_LARGE', 'ACTION_UNAVAILABLE', 'NOT_IMPLEMENTED']);
const staleCodes = new Set(['VERSION_CONFLICT', 'CANDIDATE_CONFLICT', 'UNRESOLVED_CONFLICT', 'ALREADY_CONFIRMED']);

export class CorrectionController {
  constructor({ insightId, journal, send, refreshLatest, onSynced = () => {}, onChange = () => {}, isReadOnly = () => false, isBusy = () => false, getCurrentVersion, makeKey = () => crypto.randomUUID() }) {
    Object.assign(this, { insightId, journal, send, refreshLatest, onSynced, onChange, isReadOnly, isBusy, getCurrentVersion, makeKey });
    this.busy = false; this.disposed = false; this.receipt = null;
    this.state = { status: 'idle', message: '', receipt: null };
    try {
      const pending = journal.read().pending;
      if (pending) this.state = { status: pending.body.insight_id === insightId ? pending.receipt ? 'sync_error' : 'uncertain' : 'other_pending', message: pending.body.insight_id === insightId ? '项目有上次提交需要恢复，请先核查原操作。' : `项目的“${pending.title || pending.body.insight_id}”有待恢复提交，请回到该详情处理。`, receipt: pending.receipt || null, pendingRequest: pending.body };
    } catch (failure) { this.state = { status: 'blocked', message: failure.message, receipt: null }; }
  }
  update(patch) { this.state = { ...this.state, ...patch }; if (!this.disposed) this.onChange(this.state); }
  saveDraft(draft) { return this.journal.saveDraft(this.insightId, draft); }
  getDraft() { const saved = this.journal.read(); return { draft: saved.drafts[this.insightId] || null, actor: saved.actor_label, pending: saved.pending }; }
  checkAccess(detail, { resuming = false } = {}) {
    if (this.isReadOnly() || !this.send) throw error('当前为只读详情，请返回最新项目总览后操作。', 'READ_ONLY');
    if (this.busy) throw error('正在保存，请勿重复提交。', 'REQUEST_IN_PROGRESS');
    if (!resuming && this.isBusy()) throw error('项目正在分析或处理其他请求，请等待完成后再操作。', 'PROJECT_BUSY');
    if (!resuming && this.getCurrentVersion?.() !== detail.snapshot_version) throw error('当前不是最新版本，请读取最新判断并重新核对。', 'VERSION_CONFLICT');
  }
  async submit(detail, action, values) {
    try {
      this.checkAccess(detail);
      const body = buildCorrection(detail, action, values);
      const pending = { key: this.makeKey(), title: detail.title, body, receipt: null };
      this.journal.begin(pending); // Must succeed before the first network write.
      this.receipt = null;
      return await this.perform(pending);
    } catch (failure) {
      if (!this.busy && !['uncertain', 'sync_error', 'other_pending', 'blocked'].includes(this.state.status)) this.update({ status: staleCodes.has(failure.code) ? 'stale' : 'error', receipt: null, message: failure.message });
      throw failure;
    }
  }
  async resume() {
    this.checkAccess(null, { resuming: true });
    const pending = this.journal.read().pending;
    if (!pending || pending.body.insight_id !== this.insightId) throw error('没有属于当前判断的待恢复提交。');
    return this.perform({ ...pending, receipt: pending.receipt || this.receipt });
  }
  async perform(pending) {
    this.busy = true;
    this.update({ status: pending.receipt ? 'syncing' : 'saving', receipt: pending.receipt || null, pendingRequest: pending.body, message: pending.receipt ? '服务端已保存，正在同步新版本。' : '正在提交；保存成功前保持原判断。' });
    let receipt = null;
    try {
      if (pending.receipt) receipt = validateCorrectionReceipt(pending.receipt, pending.body);
      if (!receipt) {
        receipt = validateCorrectionReceipt(await this.send(pending.body, pending.key), pending.body);
        this.receipt = receipt;
        this.journal.markReceipt(pending.key, receipt);
      }
      this.update({ status: 'syncing', receipt, message: `服务端已保存为 v${receipt.result_version}，正在读取最新判断。` });
      const result = await this.refreshLatest(receipt);
      validateDetail(result.detail, { insightId: this.insightId, version: result.currentVersion });
      if (result.currentVersion < receipt.result_version) throw error('刷新结果早于已保存版本，请重新同步。', 'RESPONSE_INVALID');
      validateAppliedCorrection(result.detail, receipt, pending.body);
      await this.onSynced(result, receipt);
      this.journal.clearPending(pending.key, { clearDraft: true, actor: pending.body.actor_label });
      this.update({ status: 'saved', receipt, pendingRequest: null, message: `已保存：${CORRECTION_LABELS[receipt.action]} · v${receipt.result_version}${result.currentVersion > receipt.result_version ? `，当前已到 v${result.currentVersion}` : ''}` });
      return result;
    } catch (failure) {
      if (receipt || this.receipt) {
        // A valid receipt is an acknowledged write even if local persistence or GET fails.
        this.receipt = receipt || this.receipt;
        this.update({ status: 'sync_error', receipt: this.receipt, message: `服务端已保存，页面尚未同步：${failure.message}。请恢复同步，不要重复创建操作。` });
      } else if (definitive.has(failure.code) || [400, 401, 403, 404, 413, 422].includes(failure.status)) {
        try { this.journal.clearPending(pending.key); }
        catch (storageFailure) { this.update({ status: 'uncertain', message: storageFailure.message }); throw failure; }
        this.update({ status: staleCodes.has(failure.code) ? 'stale' : 'error', message: `${failure.message} 输入草稿仍保留。` });
      } else {
        this.update({ status: 'uncertain', message: `提交结果尚未确认：${failure.message}。请使用原请求恢复，输入暂时锁定。` });
      }
      throw failure;
    } finally { this.busy = false; if (!this.disposed) this.onChange(this.state); }
  }
  async reloadLatest() {
    if (this.busy) throw error('请等待当前保存完成。');
    if (this.journal.read().pending) throw error('请先恢复上次提交，再读取最新判断。');
    this.busy = true; this.update({ status: 'loading_latest', receipt: null, message: '正在读取最新判断，原输入草稿会保留。' });
    try {
      const result = await this.refreshLatest(null);
      validateDetail(result.detail, { insightId: this.insightId, version: result.currentVersion });
      await this.onSynced(result, null);
      this.update({ status: 'reloaded', message: '已读取最新判断。原草稿仍保留，请重新核对并勾选确认后提交。' });
    } catch (failure) { this.update({ status: 'stale', message: failure.message }); throw failure; }
    finally { this.busy = false; if (!this.disposed) this.onChange(this.state); }
  }
  dispose() { this.disposed = true; }
}
