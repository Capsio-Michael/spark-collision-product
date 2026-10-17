import { demoOverview, demoRecords, demoEvidence } from './demo.js';
import { getDemoInsightDetail, getDemoDetailRecord } from './insight-details.js';

// Authored synthetic history, not an observed customer or model run. Latest v2 agrees
// with the homepage and detail agent's fixture. No production data is completed here.
const first = {
  ...structuredClone(demoOverview.insights[0]),
  spark: null, // v1 contains only the initial wish; v2 origin events must not leak backwards.
  judgment: {
    id: 'ins_01_judgment_1', text: '客服负责人最初希望 AI 直接回复所有问题。',
    epistemic_type: 'opinion', fact_basis: null, review_status: 'unreviewed',
    conditions: ['记录初步诉求，尚未确定实施边界'], evidence_ids: ['ev_01'],
    rationale: '保留访谈中表达的初步愿望，不将其当作实施决定或行动批准。',
    alternative_explanations: [], evidence_gaps: ['尚未结合业务风险确定自动化边界。'],
  },
  coverage: { unique_speakers: 1, spontaneous_speakers: 1, prompted_speakers: 0, supporting_record_count: 1, total_analyzed_record_count: 1, identity_incomplete: false, unknown_elicitation_count: 0, note: '仅记录合成历史中的初步诉求，未提及者不表示不关心。' },
  last_change: { insight_id: 'ins_01', type: 'new', reason: '首次记录客服负责人希望减少重复回复的诉求，实施条件仍待明确。', evidence_ids: ['ev_01'], previous_judgment_id: null, current_judgment_id: 'ins_01_judgment_1', candidate_judgment_id: null, is_breakthrough: false },
};
const v1 = {
  ...structuredClone(demoOverview), snapshot_version: 1, source_record_ids: ['rec_01'],
  summary: '先记录减少重复回复的初步诉求；风险边界与执行权限尚待进一步核查。',
  insights: [first], changes: [first.last_change], evidence: [structuredClone(demoEvidence[0])],
  pending_confirmation_count: 0,
  dimensions: demoOverview.dimensions.map(item => ({ key: item.key, status: 'insufficient_evidence', findings: [], gaps: ['首次记录仅覆盖初步诉求，尚未形成该视角的可靠分析。'] })),
};
const versions = [
  { version: 2, parent_version: 1, created_at: '2026-10-17T11:30:00+08:00', cause: 'analysis', job_id: 'synthetic_job_2', correction_id: null, source_record_ids: demoOverview.source_record_ids, outcome: 'updated', summary: demoOverview.summary, changes: demoOverview.changes, actor_label: null, correction_reason: null },
  { version: 1, parent_version: 0, created_at: '2026-10-17T11:10:00+08:00', cause: 'analysis', job_id: 'synthetic_job_1', correction_id: null, source_record_ids: ['rec_01'], outcome: 'updated', summary: v1.summary, changes: v1.changes, actor_label: null, correction_reason: null },
];
const missing = (message, code) => Object.assign(new Error(message), { code });
export const demoHistorySource = {
  projectId: 'prj_demo',
  async loadVersions() { return structuredClone({ items: versions }); },
  async loadOverview(version) {
    if (version === 1) return structuredClone(v1);
    if (version === 2) return structuredClone(demoOverview);
    throw missing('合成历史中没有该版本。', 'VERSION_NOT_FOUND');
  },
  async loadDetail(id, version) {
    if (version === 2) return getDemoInsightDetail(id);
    if (version === 1 && id === 'ins_01') return {
      ...structuredClone(first), snapshot_version: 1, candidate_judgment: null,
      evidence: [structuredClone(demoEvidence[0])], relations: [{ evidence_id: 'ev_01', relation: 'supports' }],
      collision_card: null, validations: [],
      priority: Object.fromEntries(['business_impact', 'evidence_strength', 'validation_feasibility'].map(key => [key, { level: 'unknown', reason: '合成首次记录尚未评估。' }])),
    };
    throw missing('这个版本尚未出现该关注点。', 'INSIGHT_NOT_FOUND_AT_VERSION');
  },
  async loadRecord(id) { return getDemoDetailRecord(id); },
};
