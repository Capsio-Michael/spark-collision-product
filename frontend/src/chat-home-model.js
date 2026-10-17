import { decodeMaterialFiles } from './material-workflow.js';
import { validateDrafts } from './core.js';

const KEY = 'spark-collision:conversation-input:v1';
export class ChatComposer {
  constructor(storage, { onChange = () => {} } = {}) {
    this.storage = storage; this.onChange = onChange;
    this.files = []; this.text = ''; this.basis = ''; this.authorization = ''; this.runIds = [];
    this.busy = false; this.reading = false; this.error = ''; this.phase = ''; this.exampleVersion = null;
    try {
      const saved = JSON.parse(storage.getItem(KEY) || 'null');
      if (saved) {
        if (!Array.isArray(saved.files) || saved.files.some(f => typeof f.content !== 'string' || typeof f.title !== 'string' || typeof f.client_record_id !== 'string')
          || typeof saved.text !== 'string' || !Array.isArray(saved.runIds) || saved.runIds.some(id => typeof id !== 'string')) throw Error('invalid');
        this.files = saved.files; this.text = saved.text; this.runIds = saved.runIds;
        this.basis = ['synthetic', 'authorized'].includes(saved.basis) ? saved.basis : '';
        this.authorization = typeof saved.authorization === 'string' ? saved.authorization : '';
      }
    } catch { this.error = '对话输入暂存无法读取，请到材料列表核查原草稿。'; this.storageBroken = true; }
  }
  persist() {
    if (this.storageBroken) return;
    try { this.storage.setItem(KEY, JSON.stringify({ files: this.files, text: this.text, basis: this.basis, authorization: this.authorization, runIds: this.runIds })); }
    catch { this.error = '输入暂未保存到浏览器，请保留原文后重试。'; }
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
        this.runIds = normalized.map(r => r.client_record_id); this.files = []; this.text = '';
        this.basis = ''; this.authorization = ''; this.persist();
      }
      if (!this.runIds.length || this.runIds.some(id => !workflow.state.drafts.some(r => r.client_record_id === id))) throw Error('本次草稿不在材料列表中，请核查后重新添加。');
      this.phase = '连接分析引擎'; this.onChange();
      if (!workflow.connected) await workflow.connect();
      const unsubmitted = this.runIds.filter(id => !workflow.state.submissions[id]);
      if (unsubmitted.length) { this.phase = '提交本次材料'; this.onChange(); await workflow.submit(unsubmitted); }
      const serverIds = this.runIds.map(id => workflow.state.submissions[id]);
      const pending = serverIds.filter(id => !workflow.state.server_records.find(r => r.id === id)?.covered_in_current_version);
      if (pending.length) { this.phase = '创建分析任务'; this.onChange(); await workflow.startAnalysis(pending); }
      this.phase = workflow.state.active_job ? '任务已提交，等待引擎结果' : '已读取本次材料的结果';
    } catch (error) { this.error = `${error.message}${this.runIds.length ? ' 已保存的材料可在下方继续处理，无需重复添加。' : ''}`; }
    finally { this.busy = false; this.onChange(); }
  }
  result(workflow) {
    const overview = workflow.state.overview;
    const ids = this.runIds.map(id => workflow.state.submissions[id]);
    if (!ids.length || ids.some(id => !id) || workflow.state.active_job || workflow.state.pending.analysis
      || !overview?.snapshot_version || ids.some(id => !overview.source_record_ids.includes(id))) return null;
    return overview;
  }
}
