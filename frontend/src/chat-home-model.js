import { decodeMaterialFiles } from './material-workflow.js';
import { validateDrafts } from './core.js';

const KEY = 'spark-collision:conversation-input:v1';
function validAgentItem(item) {
  const result = item?.result;
  return typeof item?.id === 'string' && typeof item.record_id === 'string' && typeof item.model === 'string'
    && typeof result?.summary === 'string' && ['updated', 'no_new_insight', 'insufficient_evidence'].includes(result.outcome)
    && Array.isArray(result.changes) && result.changes.every(change => change && ['title', 'reason', 'judgment', 'type'].every(key => typeof change[key] === 'string')
      && Array.isArray(change.evidence) && change.evidence.length && change.evidence.every(citation => citation && ['record_id', 'segment_id', 'quote'].every(key => typeof citation[key] === 'string')));
}
export class ChatComposer {
  constructor(storage, { onChange = () => {} } = {}) {
    this.storage = storage; this.onChange = onChange;
    this.files = []; this.text = ''; this.basis = ''; this.authorization = ''; this.runIds = []; this.dismissedRunIds = [];
    this.busy = false; this.reading = false; this.error = ''; this.phase = ''; this.exampleVersion = null;
    this.externalConsent = false; this.agentContext = ''; this.agentCache = null; this.agentRequests = {};
    try {
      const saved = JSON.parse(storage.getItem(KEY) || 'null');
      if (saved) {
        if (!Array.isArray(saved.files) || saved.files.some(f => typeof f.content !== 'string' || typeof f.title !== 'string' || typeof f.client_record_id !== 'string')
          || typeof saved.text !== 'string' || !Array.isArray(saved.runIds) || saved.runIds.some(id => typeof id !== 'string')) throw Error('invalid');
        this.files = saved.files; this.text = saved.text; this.runIds = saved.runIds;
        this.dismissedRunIds = Array.isArray(saved.dismissedRunIds) ? saved.dismissedRunIds.filter(id => typeof id === 'string') : [];
        this.basis = ['synthetic', 'authorized'].includes(saved.basis) ? saved.basis : '';
        this.authorization = typeof saved.authorization === 'string' ? saved.authorization : '';
        this.agentContext = typeof saved.agentContext === 'string' ? saved.agentContext : '';
        this.agentCache = saved.agentCache && typeof saved.agentCache.context === 'string' && Array.isArray(saved.agentCache.items) ? saved.agentCache : null;
        this.agentRequests = saved.agentRequests && typeof saved.agentRequests === 'object' && !Array.isArray(saved.agentRequests) ? saved.agentRequests : {};
      }
    } catch { this.error = '对话输入暂存无法读取，请到材料列表核查原草稿。'; this.storageBroken = true; }
  }
  persist() {
    if (this.storageBroken) return false;
    try { this.storage.setItem(KEY, JSON.stringify({ files: this.files, text: this.text, basis: this.basis, authorization: this.authorization, runIds: this.runIds, dismissedRunIds: this.dismissedRunIds, agentContext: this.agentContext, agentCache: this.agentCache, agentRequests: this.agentRequests })); return true; }
    catch { this.error = '输入暂未保存到浏览器，请保留原文后重试。'; return false; }
  }
  async addFiles(files) {
    if (this.reading || this.busy) return;
    this.reading = true; this.error = ''; this.onChange();
    try {
      const added = await decodeMaterialFiles(files);
      if (this.files.length + added.length + (this.text.trim() ? 1 : 0) > 5) throw Error('每批最多 5 份材料；粘贴原文也计为一份。');
      this.files = [...this.files, ...added]; this.persist();
    } catch (error) { this.error = error.message; }
    finally { this.reading = false; this.onChange(); }
  }
  removeFile(id) { if (this.busy || this.reading) return; this.files = this.files.filter(f => f.client_record_id !== id); this.persist(); this.onChange(); }
  dismissRun() {
    if (this.busy || !this.runIds.length) return;
    const previous = this.dismissedRunIds, ids = this.runIds;
    this.dismissedRunIds = ids; this.runIds = []; this.error = ''; this.phase = '';
    if (!this.persist()) { this.runIds = ids; this.dismissedRunIds = previous; }
    this.onChange();
  }
  restoreRun() {
    if (this.busy || this.runIds.length || !this.dismissedRunIds.length) return;
    const ids = this.dismissedRunIds; this.runIds = ids; this.dismissedRunIds = [];
    if (!this.persist()) { this.runIds = []; this.dismissedRunIds = ids; }
    this.onChange();
  }
  async send(workflow, resume = false) {
    if (this.busy || this.reading) return;
    this.busy = true; this.error = ''; this.exampleVersion = null;
    try {
      if (!resume) {
        if (workflow.state.active_job || Object.keys(workflow.state.pending).length) throw Error('已有任务或提交结果待核查，请先到材料列表恢复原任务。新输入仍保留。');
        const records = [...this.files];
        if (this.text.trim()) records.push({ client_record_id: crypto.randomUUID(), title: '粘贴的会议记录', source_type: 'other', source_date: null, source_name: '对话框粘贴记录', participants: [], content: this.text });
        const normalized = records.map(record => ({ ...record, material_basis: this.basis, authorization_note: this.basis === 'authorized' ? this.authorization.trim() || null : null }));
        const invalid = validateDrafts(normalized); if (invalid) throw Error(invalid);
        // Save atomically before clearing the composer or sending any request.
        workflow.save(normalized);
        this.runIds = normalized.map(r => r.client_record_id); this.dismissedRunIds = []; this.files = []; this.text = '';
        this.agentContext = '';
        this.basis = ''; this.authorization = ''; this.persist();
      }
      if (!this.runIds.length || this.runIds.some(id => !workflow.state.drafts.some(r => r.client_record_id === id))) throw Error('本次草稿不在材料列表中，请核查后重新添加。');
      this.phase = '连接分析引擎'; this.onChange();
      if (!workflow.connected) await workflow.connect();
      if (workflow.health?.agent_analysis_mode !== 'kimi' && this.agentContext === this.context(workflow)) {
        throw Error('本次使用的真实分析服务当前不可用，请恢复原服务后继续。');
      }
      const unsubmitted = this.runIds.filter(id => !workflow.state.submissions[id]);
      if (unsubmitted.length) { this.phase = '提交本次材料'; this.onChange(); await workflow.submit(unsubmitted); }
      const serverIds = this.runIds.map(id => workflow.state.submissions[id]);
      if (workflow.health?.agent_analysis_mode === 'kimi') {
        this.agentContext = this.context(workflow);
        if (!this.persist()) throw Error('无法保存分析恢复信息，请先备份材料并检查浏览器存储空间。');
        await this.analyzeWithKimi(workflow, serverIds);
        this.phase = '分析已完成';
        this.externalConsent = false;
        return;
      }
      const pending = serverIds.filter(id => !workflow.state.server_records.find(r => r.id === id)?.covered_in_current_version);
      if (pending.length) { this.phase = '创建分析任务'; this.onChange(); await workflow.startAnalysis(pending); }
      this.phase = workflow.state.active_job ? '任务已提交，等待引擎结果' : '已读取本次材料的结果';
    } catch (error) { this.error = `${error.message}${this.runIds.length ? ' 已保存的材料可在下方继续处理，无需重复添加。' : ''}`; }
    finally { this.busy = false; this.onChange(); }
  }
  result(workflow) {
    if (this.agentContext === this.context(workflow)) return null;
    const overview = workflow.state.overview;
    const ids = this.runIds.map(id => workflow.state.submissions[id]);
    if (!ids.length || ids.some(id => !id) || workflow.state.active_job || workflow.state.pending.analysis
      || !overview?.snapshot_version || ids.some(id => !overview.source_record_ids.includes(id))) return null;
    return overview;
  }
  context(workflow) { return JSON.stringify([workflow.state.base_url, workflow.state.project?.id]); }
  agentResult(workflow) {
    const context = this.context(workflow), ids = this.runIds.map(id => workflow.state.submissions[id]);
    if (!ids.length || ids.some(id => !id) || this.agentContext !== context || this.agentCache?.context !== context) return null;
    const items = ids.map(id => this.agentCache.items.find(item => item?.record_id === id));
    if (items.some(item => !validAgentItem(item))) return null;
    return { items, summary: items.map(item => item.result.summary).join('；'), outcome: items.some(item => item.result.changes.length) ? 'updated' : items.at(-1).result.outcome,
      cards: items.flatMap(item => item.result.changes.map((change, index) => ({ ...change, key: `${item.id}:${index}`, model: item.model }))) };
  }
  async analyzeWithKimi(workflow, ids) {
    const context = this.context(workflow), projectId = workflow.state.project?.id, api = workflow.api;
    if (!projectId) throw Error('项目尚未建立，请继续处理材料。');
    const current = () => { if (context !== this.context(workflow)) throw Error('项目连接已改变，请回到原项目重试。'); };
    this.phase = '读取已完成的分析结果'; this.onChange();
    const saved = await api.agentAnalyses(projectId); current();
    if (!Array.isArray(saved.items) || !saved.items.every(validAgentItem)) throw Error('分析结果列表格式不正确。');
    this.agentCache = { context, items: saved.items };
    for (const [index, id] of ids.entries()) {
      if (this.agentCache.items.some(item => item.record_id === id)) continue;
      this.phase = `正在分析第 ${index + 1} / ${ids.length} 份材料`; this.onChange();
      const requestId = JSON.stringify([context, id]);
      if (!this.agentRequests[requestId]) this.agentRequests[requestId] = crypto.randomUUID();
      if (!this.persist()) throw Error('无法保存重试标识，尚未调用分析服务。');
      // Reuse the same request after a timeout; a completed record is recovered above.
      const item = await api.agentAnalysis(projectId, id, this.externalConsent, this.agentRequests[requestId]); current();
      if (item?.record_id !== id || !validAgentItem(item)) throw Error('分析服务返回的材料或结果不一致。');
      this.agentCache.items.push(item);
      if (!this.persist()) throw Error('结果已在服务端保存，请恢复浏览器存储后继续读取。');
    }
    if (!this.persist()) throw Error('结果已在服务端保存，请恢复浏览器存储后继续读取。');
  }
}
