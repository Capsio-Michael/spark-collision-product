import { readDrafts, validateDrafts } from './core.js';
import { createApiClient } from './api/client.js';
import { validateOverview } from './overview-model.js';

export const WORKSPACE_KEY = 'spark-collision:materials:v2';
const initial = () => ({
  schema_version: 2, base_url: 'http://127.0.0.1:8000/api/v1',
  drafts: [], removed_drafts: [], editor_buffers: {}, submissions: {},
  project: null, server_records: [], overview: null, active_job: null, last_job: null, pending: {},
});
const definitiveErrors = new Set(['VALIDATION_ERROR', 'TEXT_TOO_LONG', 'LIMIT_EXCEEDED', 'PAYLOAD_TOO_LARGE', 'VERSION_CONFLICT', 'RECORD_ALREADY_ANALYZED', 'PROJECT_BUSY', 'RECORD_CONFLICT', 'IDEMPOTENCY_CONFLICT']);
export function normalizeBaseUrl(value) {
  const url = new URL(value.trim());
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname.replace(/\/$/, '') !== '/api/v1') throw new Error('本机联调地址需为 http://127.0.0.1:端口/api/v1 或 http://localhost:端口/api/v1。');
  return url.href.replace(/\/$/, '');
}
export function materialPayload(record) {
  return Object.fromEntries(['client_record_id', 'title', 'source_type', 'source_date', 'source_name', 'material_basis', 'authorization_note', 'participants', 'content'].map(key => [key, record[key]]));
}
function checkServerSnapshot(overview, projectId) {
  validateOverview(overview, projectId);
}
export async function decodeMaterialFiles(files, makeId = () => crypto.randomUUID()) {
  if (!files.length || files.length > 5) throw new Error('每次请选择 1–5 份文件。');
  const records = [];
  for (const file of files) {
    if (!/\.(txt|md)$/i.test(file.name)) throw new Error(`${file.name}：暂时只支持 TXT 和 Markdown 文件。`);
    if (file.size > 1048576) throw new Error(`${file.name}：超过 1 MiB，请拆分后导入。`);
    let content;
    try { content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); }
    catch { throw new Error(`${file.name}：不是有效的 UTF-8 文本，请转换编码后重试。`); }
    if (!content.trim()) throw new Error(`${file.name}：内容为空。`);
    if (Array.from(content).length > 20000) throw new Error(`${file.name}：超过 20,000 个字符。`);
    records.push({ client_record_id: makeId(), title: file.name.replace(/\.(txt|md)$/i, ''), source_type: 'interview', source_date: null, source_name: file.name, material_basis: '', authorization_note: null, participants: [], content });
  }
  return records;
}

export class MaterialWorkflow {
  constructor(storage, { apiFactory = createApiClient, makeId = () => crypto.randomUUID(), onChange = () => {} } = {}) {
    this.storage = storage; this.apiFactory = apiFactory; this.makeId = makeId; this.onChange = onChange;
    this.state = initial(); this.connected = false; this.busy = false; this.health = null; this.error = null;
    try {
      const raw = storage.getItem(WORKSPACE_KEY);
      if (raw) {
        const value = JSON.parse(raw);
        if (value.schema_version !== 2 || !Array.isArray(value.drafts) || !Array.isArray(value.server_records) || !Array.isArray(value.removed_drafts) || !value.submissions || !value.pending || !value.editor_buffers || value.drafts.some(record => !record || typeof record.client_record_id !== 'string' || typeof record.content !== 'string' || typeof record.title !== 'string')) throw new Error('Invalid workspace');
        const restored = { ...initial(), ...value };
        normalizeBaseUrl(restored.base_url);
        if (restored.project && (typeof restored.project.id !== 'string' || !restored.project.id || typeof restored.project.name !== 'string' || !Number.isSafeInteger(restored.project.current_version) || restored.project.current_version < 0)) throw new Error('Invalid project binding');
        if (restored.overview) {
          try { checkServerSnapshot(restored.overview, restored.project?.id); }
          catch {
            restored.overview = null;
            this.cacheWarning = '分析总览缓存不完整，已停止展示。材料、项目绑定及待恢复请求仍保留；请连接引擎重新读取结果。原存储在读取时未改写。';
          }
        }
        this.state = restored;
      } else {
        const old = readDrafts(storage);
        if (old.error) throw new Error(old.error);
        this.state.drafts = old.records.map(record => ({ ...record, participants: record.participants || [] }));
      }
    } catch { this.storageError = '无法读取本地材料工作区，已保留原存储。请备份浏览器数据后排查，暂不覆盖保存。'; }
  }
  commit(patch) {
    if (this.storageError) throw new Error(this.storageError);
    const next = { ...this.state, ...patch };
    try { this.storage.setItem(WORKSPACE_KEY, JSON.stringify(next)); }
    catch { throw new Error('本地保存失败，原草稿仍保留。请备份输入内容并检查浏览器存储空间。'); }
    this.state = next; this.onChange();
  }
  get api() { return this.apiFactory(this.state.base_url); }
  get lockedIds() { return new Set([...(this.state.pending.import?.ids || []), ...(this.state.pending.project?.ids || [])]); }
  isEditable(id) { return !this.state.submissions[id] && !this.lockedIds.has(id); }
  get knownParticipants() {
    return [...new Map(this.state.drafts.flatMap(record => record.participants || []).map(person => [person.id, person])).values()];
  }
  saveBuffer(key, records) { this.commit({ editor_buffers: { ...this.state.editor_buffers, [key]: records } }); }
  save(records, editingIds = [], bufferKey = 'new') {
    if (editingIds.some(id => !this.isEditable(id))) throw new Error('已提交或等待确认提交结果的材料不能改写。');
    if (editingIds.some(id => !this.state.drafts.some(record => record.client_record_id === id))) throw new Error('原草稿已被移除，请先恢复后再编辑。');
    const existing = this.state.drafts.filter(record => !editingIds.includes(record.client_record_id));
    const invalid = validateDrafts(records, existing); if (invalid) throw new Error(invalid);
    if (new Set([...existing, ...records].map(record => record.client_record_id)).size !== existing.length + records.length) throw new Error('材料标识重复，请重新打开导入面板。');
    const extraRemote = this.state.server_records.filter(record => !Object.values(this.state.submissions).includes(record.id)).length;
    if (extraRemote + existing.length + records.length > 10) throw new Error('包含服务端记录在内，项目最多保存 10 份材料。');
    const buffers = { ...this.state.editor_buffers }; delete buffers[bufferKey];
    const replacements = new Map(records.map(record => [record.client_record_id, record]));
    const drafts = editingIds.length ? this.state.drafts.map(record => replacements.get(record.client_record_id) || record) : [...existing, ...records];
    this.commit({ drafts, editor_buffers: buffers });
  }
  remove(id) {
    if (!this.isEditable(id)) throw new Error('已提交或提交结果待确认的材料不能移除。');
    const record = this.state.drafts.find(item => item.client_record_id === id); if (!record) return;
    this.commit({ drafts: this.state.drafts.filter(item => item.client_record_id !== id), removed_drafts: [...this.state.removed_drafts, record] });
  }
  restoreLast() {
    const record = this.state.removed_drafts.at(-1); if (!record) return;
    const invalid = validateDrafts([record], this.state.drafts); if (invalid) throw new Error(invalid);
    const extraRemote = this.state.server_records.filter(item => !Object.values(this.state.submissions).includes(item.id)).length;
    if (extraRemote + this.state.drafts.length >= 10) throw new Error('请先为项目留出一个材料位置，再恢复。');
    this.commit({ drafts: [...this.state.drafts, record], removed_drafts: this.state.removed_drafts.slice(0, -1) });
  }
  async connect(value = this.state.base_url) {
    if (this.busy) throw new Error('正在处理请求，请稍后重试。');
    const base = normalizeBaseUrl(value);
    if (base !== this.state.base_url && (this.state.project || Object.keys(this.state.pending).length)) throw new Error('已有项目或未确认请求绑定当前地址，请先完成当前服务的同步。');
    this.busy = true; this.connected = false; this.error = null; this.onChange();
    try {
      const api = this.apiFactory(base);
      const health = await api.health();
      if (health.status !== 'ok' || health.api_version !== '0.1' || !['mock', 'live'].includes(health.engine_mode)) throw new Error('服务状态或接口版本不匹配，需要 v0.1 契约服务。');
      const { items: projects } = await api.projects();
      if (!Array.isArray(projects) || projects.length > 1) throw new Error('项目返回不符合单项目契约。');
      let project = projects[0] || null;
      if (this.state.project && project?.id !== this.state.project.id) throw new Error('服务端项目与本地记录不一致，已保留本地数据；请核对服务地址和数据库。');
      let server_records = [], overview = null;
      if (project) {
        const [records, result] = await Promise.all([api.records(project.id), api.overview(project.id)]);
        if (!Array.isArray(records.items)) throw new Error('材料列表返回格式不正确。');
        checkServerSnapshot(result, project.id);
        server_records = records.items; overview = result; project = result.project;
      }
      this.health = health; this.connected = true;
      const active_job = this.state.active_job || (overview?.active_job_id ? { id: overview.active_job_id, status: 'running', stage: 'queued' } : null);
      this.commit({ base_url: base, project, server_records, overview, active_job });
      this.cacheWarning = null;
    } catch (error) { this.connected = false; this.error = error.message; throw error; }
    finally { this.busy = false; this.onChange(); }
  }
  requireConnection() { if (!this.connected) throw new Error('请先连接引擎，材料草稿会保留在本地。'); }
  async execute(kind) {
    const pending = this.state.pending[kind]; if (!pending) throw new Error('没有可重试的请求。');
    try {
      let result;
      if (kind === 'project') result = await this.api.createProject(pending.body, pending.key);
      if (kind === 'import') result = await this.api.importRecords(pending.project_id, pending.body.records, pending.key);
      if (kind === 'analysis') result = await this.api.analyze(pending.project_id, pending.body, pending.key);
      const nextPending = { ...this.state.pending }; delete nextPending[kind];
      if (kind === 'project') this.commit({ project: result, pending: nextPending });
      if (kind === 'import') {
        if (!Array.isArray(result.items) || result.items.length !== pending.ids.length || result.items.some(record => typeof record.id !== 'string' || !record.id || typeof record.covered_in_current_version !== 'boolean') || new Set(result.items.map(record => record.id)).size !== result.items.length) throw new Error('导入响应不符合契约；保留原请求标识，请检查后重试。');
        const submissions = { ...this.state.submissions };
        result.items.forEach((record, index) => { submissions[pending.ids[index]] = record.id; });
        const server_records = [...new Map([...this.state.server_records, ...result.items].map(record => [record.id, record])).values()];
        this.commit({ submissions, server_records, pending: nextPending });
      }
      if (kind === 'analysis') {
        if (!result?.id || result.project_id !== pending.project_id || !['queued', 'running', 'succeeded', 'failed'].includes(result.status)) throw new Error('分析任务响应不符合契约，已保留请求标识。');
        this.commit({ active_job: result, pending: nextPending });
      }
      return result;
    } catch (error) {
      if (kind === 'project' && error.code === 'PROJECT_LIMIT_REACHED' && error.details?.existing_project_id) {
        const { items } = await this.api.projects();
        const project = items.find(item => item.id === error.details.existing_project_id);
        if (!project || this.state.project && this.state.project.id !== project.id) throw new Error('已有项目与本地记录不匹配，请核对服务地址。');
        const nextPending = { ...this.state.pending }; delete nextPending.project;
        this.commit({ project, pending: nextPending }); return project;
      }
      if (definitiveErrors.has(error.code)) {
        const nextPending = { ...this.state.pending }; delete nextPending[kind]; this.commit({ pending: nextPending });
      }
      this.error = error.message;
      throw error;
    }
  }
  async submit(ids) {
    this.requireConnection(); if (this.busy) throw new Error('正在提交，请勿重复操作。');
    this.busy = true; this.error = null; this.onChange();
    try {
      const pendingIds = this.state.pending.import?.ids || this.state.pending.project?.ids;
      if (pendingIds && [...ids].sort().join('|') !== [...pendingIds].sort().join('|')) throw new Error('请先重试上次提交，再提交其他草稿。');
      const initialSelected = this.state.drafts.filter(record => ids.includes(record.client_record_id));
      if (!ids.length || initialSelected.length !== new Set(ids).size || initialSelected.some(record => this.state.submissions[record.client_record_id])) throw new Error('请选择有效的未提交草稿。');
      const initialInvalid = validateDrafts(initialSelected); if (initialInvalid) throw new Error(initialInvalid);
      if (!this.state.project || this.state.pending.project) {
        if (!this.state.pending.project) this.commit({ pending: { ...this.state.pending, project: { key: this.makeId(), ids: [...ids], body: { name: '我的调研项目' } } } });
        await this.execute('project');
      }
      if (this.state.pending.import && ids.length && [...ids].sort().join('|') !== [...this.state.pending.import.ids].sort().join('|')) throw new Error('请先重试上次提交，再提交其他草稿。');
      if (!this.state.pending.import) {
        const selected = this.state.drafts.filter(record => ids.includes(record.client_record_id));
        if (selected.length !== new Set(ids).size || !selected.length || selected.some(record => !this.isEditable(record.client_record_id))) throw new Error('请选择有效的未提交草稿。');
        const invalid = validateDrafts(selected); if (invalid) throw new Error(invalid);
        this.commit({ pending: { ...this.state.pending, import: { key: this.makeId(), project_id: this.state.project.id, ids: selected.map(record => record.client_record_id), body: { records: selected.map(materialPayload) } } } });
      }
      await this.execute('import');
      // The saved response is sufficient to mark submission. A later refresh may fail independently.
    } finally { this.busy = false; this.onChange(); }
  }
  async startAnalysis(ids) {
    this.requireConnection(); if (this.busy || this.state.active_job && !this.state.pending.analysis) throw new Error('请等待当前任务完成或恢复任务查询。');
    this.busy = true; this.error = null; this.onChange();
    try {
      if (!this.state.project) throw new Error('请先提交材料。');
      if (this.state.pending.analysis && [...ids].sort().join('|') !== [...this.state.pending.analysis.body.record_ids].sort().join('|')) throw new Error('请先确认上次分析请求，再分析其他材料。');
      if (!this.state.pending.analysis) {
        const selected = this.state.server_records.filter(record => ids.includes(record.id) && !record.covered_in_current_version);
        if (!ids.length || selected.length !== new Set(ids).size) throw new Error('请选择已保存、尚未分析的材料。');
        this.commit({ pending: { ...this.state.pending, analysis: { key: this.makeId(), project_id: this.state.project.id, body: { record_ids: selected.map(record => record.id), expected_version: this.state.overview?.project.current_version ?? 0 } } } });
      }
      await this.execute('analysis');
    } finally { this.busy = false; this.onChange(); }
  }
  async poll() {
    this.requireConnection(); const active = this.state.active_job; if (!active || !this.state.project) return;
    try {
      const job = await this.api.job(this.state.project.id, active.id);
      if (!['queued', 'running', 'succeeded', 'failed'].includes(job.status)) throw new Error('任务状态不符合接口契约。');
      this.commit({ active_job: job });
      if (job.status === 'succeeded') {
        const [overview, records] = await Promise.all([this.api.overview(this.state.project.id, job.result_version), this.api.records(this.state.project.id)]);
        if (overview.snapshot_version !== job.result_version) throw new Error('结果版本与任务不一致，稍后重新同步，不发布混合版本。');
        checkServerSnapshot(overview, this.state.project.id);
        if (!Array.isArray(records.items)) throw new Error('材料列表返回格式不正确。');
        this.commit({ overview, server_records: records.items, project: overview.project, active_job: null, last_job: job });
      } else if (job.status === 'failed') this.commit({ active_job: null, last_job: job });
      this.error = null;
    } catch (error) { this.error = `任务查询暂未完成：${error.message}。已保留任务标识，不会重复创建。`; throw error; }
    finally { this.onChange(); }
  }
}
