// Read-only detail state. It never creates judgments, evidence or approved actions.
export const RELATION_LABELS = {
  all: '全部', supports: '支持', challenges: '质疑', supplements: '补充',
  counterexample: '反例', qualifies: '条件限定', unknown: '未标注',
};
export const CHANGE_LABELS = { new: '新增关注点', supported: '支持增加', qualified: '条件细化', challenged: '出现质疑', revised: '判断修正', unchanged: '无实质变化' };
export const CATEGORY_LABELS = { fact_correction: '事实纠偏', business_reframe: '商业重构', technical_reframe: '技术重构', organization_reframe: '组织重构', implementation_barrier: '落地阻力', other: '其他发现' };
export const array = value => Array.isArray(value) ? value : [];
export const text = value => typeof value === 'string' ? value : '';

export function validateDetail(detail, { insightId, version } = {}) {
  if (!detail || typeof detail !== 'object' || !text(detail.id) || !text(detail.title) || !text(detail.judgment?.text)) throw new Error('详情缺少标题或当前判断，请检查引擎返回的数据。');
  if (insightId && detail.id !== insightId) throw new Error('返回的智慧点与当前选择不一致，未展示混合结果。');
  if (version !== undefined && detail.snapshot_version !== version) throw new Error('详情版本与当前项目版本不一致，请返回总览刷新后重试。');
  const ids = array(detail.evidence).map(item => item?.id);
  if (ids.some(id => !text(id)) || new Set(ids).size !== ids.length) throw new Error('证据标识缺失或重复，请检查引擎返回的数据。');
  return detail;
}

export function evidenceFor(detail, filter = 'all') {
  if (filter === 'all') return array(detail.evidence);
  return array(detail.evidence).filter(item => {
    const relations = array(detail.relations).filter(link => link.evidence_id === item.id && Object.hasOwn(RELATION_LABELS, link.relation) && !['all', 'unknown'].includes(link.relation));
    return filter === 'unknown' ? !relations.length : relations.some(link => link.relation === filter);
  });
}

export function validateSource(record, evidence) {
  if (!record || record.id !== evidence.record_id) throw new Error('原文材料与该证据不一致，无法确认引用位置。');
  const segment = array(record.segments).find(item => item.id === evidence.segment_id);
  if (!segment || !text(evidence.quote) || !text(segment.text).includes(evidence.quote)) throw new Error('引用与原文段落不匹配，未高亮未经核实的位置。');
  return record;
}

export class DetailSession {
  constructor({ insightId, version, loadDetail, loadRecord, onChange = () => {} }) {
    Object.assign(this, { insightId, version, loadDetail, loadRecord, onChange });
    this.state = { status: 'loading', detail: null, error: null, filter: 'all', selectedEvidenceId: null, sourceStatus: 'idle', record: null, sourceError: null };
    this.generation = 0; this.sourceGeneration = 0; this.closed = false;
  }
  update(patch) { if (!this.closed) { this.state = { ...this.state, ...patch }; this.onChange(this.state); } }
  async load() {
    const generation = ++this.generation;
    this.sourceGeneration++;
    this.update({ status: 'loading', error: null, detail: null, selectedEvidenceId: null, record: null, sourceStatus: 'idle', sourceError: null, filter: 'all' });
    try {
      const detail = validateDetail(await this.loadDetail(), { insightId: this.insightId, version: this.version });
      if (generation !== this.generation || this.closed) return;
      this.update({ status: 'ready', detail });
    } catch (error) {
      if (generation === this.generation) this.update({ status: 'error', error: error.message || '无法读取详情，请稍后重试。' });
    }
  }
  setFilter(filter) { if (Object.hasOwn(RELATION_LABELS, filter)) this.update({ filter }); }
  async selectEvidence(id) {
    const generation = ++this.sourceGeneration;
    const evidence = array(this.state.detail?.evidence).find(item => item.id === id);
    if (!evidence) { this.update({ selectedEvidenceId: null, record: null, sourceStatus: 'error', sourceError: '这项引用未提供可定位的证据，无法打开原文。' }); return; }
    this.update({ selectedEvidenceId: id, record: null, sourceStatus: 'loading', sourceError: null });
    try {
      const record = validateSource(await this.loadRecord(evidence.record_id), evidence);
      if (generation !== this.sourceGeneration || this.closed) return;
      this.update({ record, sourceStatus: 'ready' });
    } catch (error) {
      if (generation === this.sourceGeneration) this.update({ record: null, sourceStatus: 'error', sourceError: error.message || '原文读取失败，请重试。' });
    }
  }
  close() { this.closed = true; this.generation++; this.sourceGeneration++; }
}
