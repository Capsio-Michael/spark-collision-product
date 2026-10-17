// Read-only comparison. No correction, approval or task creation happens here.
export const HISTORY_CHANGE_LABELS = {
  new: '新增关注点', supported: '证据增强', qualified: '条件细化', challenged: '出现反例／质疑', revised: '判断修正', unchanged: '无实质变化',
};
const array = value => Array.isArray(value) ? value : [];
const sameSet = (left, right) => JSON.stringify([...new Set(array(left))].sort()) === JSON.stringify([...new Set(array(right))].sort());
export function sortVersions(items) {
  if (!Array.isArray(items) || items.some(item => !Number.isInteger(item.version) || item.version < 1 || !Number.isInteger(item.parent_version) || item.parent_version < 0 || item.parent_version >= item.version || !['analysis', 'correction'].includes(item.cause) || !Array.isArray(item.source_record_ids) || !Array.isArray(item.changes) || item.changes.some(change => !change || typeof change.insight_id !== 'string' || !Array.isArray(change.evidence_ids) || typeof change.is_breakthrough !== 'boolean')) || new Set(items.map(item => item.version)).size !== items.length) throw new Error('历史版本列表不符合接口约定，暂不展示不确定的顺序。');
  return [...items].sort((a, b) => b.version - a.version);
}
export function defaultPair(versions, target) {
  const ordered = sortVersions(versions);
  if (!ordered.length) return { from: null, to: null };
  const to = ordered.some(item => item.version === target) ? target : ordered[0].version;
  return { from: ordered.find(item => item.version < to)?.version ?? null, to };
}
export function historyFields(left, right) {
  const before = left?.judgment, after = right?.judgment;
  const field = (key, label, a, b, kind = 'text') => ({ key, label, before: a ?? null, after: b ?? null, kind, changed: kind === 'list' ? !sameSet(a, b) : JSON.stringify(a ?? null) !== JSON.stringify(b ?? null) });
  const fields = [
    field('statement', '判断内容', before?.text, after?.text),
    field('conditions', '适用条件', before?.conditions, after?.conditions, 'list'),
    field('epistemic_type', '内容类型', before?.epistemic_type, after?.epistemic_type, 'type'),
    field('fact_basis', '事实依据性质', before?.fact_basis, after?.fact_basis, 'basis'),
    field('review_status', '确认状态', before?.review_status, after?.review_status, 'review'),
    field('evidence', '当前判断引用', before?.evidence_ids, after?.evidence_ids, 'list'),
    field('rationale', '推理依据', before?.rationale, after?.rationale),
    field('alternatives', '其他可能解释', before?.alternative_explanations, after?.alternative_explanations, 'list'),
    field('gaps', '证据缺口', before?.evidence_gaps, after?.evidence_gaps, 'list'),
    field('dispute_status', '分歧状态', left?.dispute_status, right?.dispute_status, 'dispute'),
  ];
  // A candidate is compared separately. It is never substituted for the effective judgment.
  const candidate = detail => detail?.candidate_judgment ? JSON.stringify({ text: detail.candidate_judgment.text, epistemic_type: detail.candidate_judgment.epistemic_type, conditions: detail.candidate_judgment.conditions, evidence_ids: detail.candidate_judgment.evidence_ids, rationale: detail.candidate_judgment.rationale, alternative_explanations: detail.candidate_judgment.alternative_explanations, evidence_gaps: detail.candidate_judgment.evidence_gaps }) : null;
  fields.push(field('candidate', '待确认候选', candidate(left), candidate(right), 'candidate'));
  if (!left || !right) for (const item of fields) item.changed = true;
  return fields;
}
export function comparisonKind(left, right, fields = historyFields(left, right)) {
  if (!left && !right) return 'absent';
  if (!left) return 'new';
  if (!right) return 'absent_later';
  const changed = fields.filter(field => field.changed);
  if (!changed.length) return 'unchanged';
  if (changed.every(field => field.key === 'evidence')) return 'evidence_only';
  if (changed.every(field => ['candidate', 'dispute_status'].includes(field.key))) return 'candidate_only';
  return 'changed';
}

export class HistorySession {
  constructor({ projectId, loadVersions, loadOverview, loadDetail, loadRecord, onChange = () => {} }) {
    Object.assign(this, { projectId, loadVersions, loadOverview, loadDetail, loadRecord, onChange });
    this.state = { status: 'loading', versions: [], from: null, to: null, insightId: null, options: [], leftOverview: null, rightOverview: null, left: null, right: null, error: null, fields: [], events: [], kind: null };
    this.generation = 0; this.closed = false; this.overviews = new Map(); this.details = new Map();
  }
  update(patch) { if (!this.closed) { this.state = { ...this.state, ...patch }; this.onChange(this.state); } }
  async start() {
    const generation = ++this.generation;
    this.update({ status: 'loading', error: null });
    try {
      const versions = sortVersions((await this.loadVersions()).items);
      if (generation !== this.generation || this.closed) return;
      if (!versions.length) { this.update({ versions, status: 'empty', from: null, to: null, left: null, right: null }); return; }
      this.update({ versions }); const pair = defaultPair(versions);
      await this.selectPair(pair.from, pair.to);
    } catch (error) { if (generation === this.generation) this.update({ status: 'error', error: error.message || '无法加载历史版本。' }); }
  }
  async overview(version) {
    if (version === null) return null;
    if (!this.overviews.has(version)) {
      const promise = Promise.resolve().then(() => this.loadOverview(version)).then(result => {
        if (result?.snapshot_version !== version || result.project?.id !== this.projectId || !Array.isArray(result.insights) || !Array.isArray(result.source_record_ids) || result.insights.some(item => !item || typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.judgment?.text !== 'string')) throw new Error('历史总览版本或项目不匹配，未混用不同快照。');
        return structuredClone(result);
      }).catch(error => { this.overviews.delete(version); throw error; });
      this.overviews.set(version, promise);
    }
    return this.overviews.get(version);
  }
  async detail(id, version) {
    if (version === null) return null;
    const snapshot = await this.overview(version);
    if (!snapshot.insights.some(item => item.id === id)) return null;
    const key = JSON.stringify([id, version]);
    if (!this.details.has(key)) {
      const promise = Promise.resolve().then(() => this.loadDetail(id, version)).then(result => {
        if (result?.id !== id || result.snapshot_version !== version || typeof result.judgment?.text !== 'string' || !Array.isArray(result.evidence)) throw new Error('判断详情与所选历史版本不一致，未展示混合数据。');
        return structuredClone(result);
      }).catch(error => {
        this.details.delete(key);
        if (error.code === 'INSIGHT_NOT_FOUND_AT_VERSION') return null;
        throw error;
      });
      this.details.set(key, promise);
    }
    return this.details.get(key);
  }
  async selectTo(to) {
    const pair = defaultPair(this.state.versions, to);
    const from = this.state.from !== null && this.state.from < to ? this.state.from : pair.from;
    return this.selectPair(from, pair.to, this.state.insightId);
  }
  async selectPair(from, to, insightId = this.state.insightId) {
    const known = new Set(this.state.versions.map(item => item.version));
    if (!known.has(to) || from !== null && (!known.has(from) || from >= to)) { this.update({ status: 'error', error: '请选择较早版本和较晚版本，左侧版本必须更早。' }); return; }
    const generation = ++this.generation;
    this.update({ status: 'loading_comparison', from, to, insightId, error: null, left: null, right: null, fields: [], events: [] });
    try {
      const [leftOverview, rightOverview] = await Promise.all([this.overview(from), this.overview(to)]);
      if (generation !== this.generation || this.closed) return;
      const options = [...new Map([...array(leftOverview?.insights), ...rightOverview.insights].map(item => [item.id, { id: item.id, title: item.title }])).values()];
      let selected = insightId;
      if (selected !== '' && !options.some(item => item.id === selected)) selected = rightOverview.changes?.find(item => item.is_breakthrough)?.insight_id || options[0]?.id || '';
      this.update({ leftOverview, rightOverview, options, insightId: selected });
      await this.loadComparison(selected, generation);
    } catch (error) { if (generation === this.generation) this.update({ status: 'error', error: error.message || '历史对比读取失败。' }); }
  }
  async selectInsight(id) {
    if (id && !this.state.options.some(item => item.id === id)) return;
    const generation = ++this.generation;
    this.update({ status: 'loading_comparison', insightId: id, left: null, right: null, fields: [], events: [], error: null });
    await this.loadComparison(id, generation);
  }
  async loadComparison(id, generation) {
    try {
      if (!id) { if (generation === this.generation) this.update({ status: 'ready', left: null, right: null, kind: 'overview', fields: [], events: [] }); return; }
      const [left, right] = await Promise.all([this.detail(id, this.state.from), this.detail(id, this.state.to)]);
      if (generation !== this.generation || this.closed) return;
      const fields = historyFields(left, right);
      const events = this.state.versions.filter(item => item.version > (this.state.from ?? 0) && item.version <= this.state.to)
        .sort((a, b) => a.version - b.version).flatMap(version => version.changes.filter(change => change.insight_id === id).map(change => ({ ...change, version: version.version, parent_version: version.parent_version, cause: version.cause, correction_reason: version.correction_reason, actor_label: version.actor_label })));
      this.update({ status: 'ready', left, right, fields, events, kind: comparisonKind(left, right, fields) });
    } catch (error) { if (generation === this.generation) this.update({ status: 'error', error: error.message || '判断对比读取失败。' }); }
  }
  async evidence(id, version, insightId = this.state.insightId) {
    const detail = await this.detail(insightId, version);
    const evidence = detail?.evidence.find(item => item.id === id);
    if (!evidence) throw new Error('该版本未提供这项证据，不能用其他版本的引用代替。');
    const record = await this.loadRecord(evidence.record_id);
    const segment = array(record?.segments).find(item => item.id === evidence.segment_id);
    if (record?.id !== evidence.record_id || !segment || typeof segment.text !== 'string' || typeof evidence.quote !== 'string' || !evidence.quote || !segment.text.includes(evidence.quote)) throw new Error('引用与原文不匹配，暂不高亮未经核查的段落。');
    return { evidence, record, version };
  }
  close() { this.closed = true; this.generation++; }
}
