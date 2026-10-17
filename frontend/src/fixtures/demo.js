import { DIMENSIONS } from '../core.js';
import { demoSparks } from './sparks.js';

// Explicit synthetic read-only scenario. These are not generated analysis results.
const date = '2026-10-17T11:00:00+08:00';
const materials = [
  ['rec_01', '客服现场访谈', 'interview', 'person_01', '客服负责人', [
    '高峰期重复咨询很多，我最初希望所有问题都能由 AI 直接回复。',
    '标准问题可以自动回复，但报价需要人工确认。',
  ]],
  ['rec_02', '报价流程走查', 'research', 'person_02', '业务负责人', [
    '报价不是直接查一个价格，还需要确认客户等级和特殊折扣。',
    '有些报价的等待发生在授权审批环节，具体耗时还没有统计。',
    '我们原本计划先优化报价生成速度。',
  ]],
  ['rec_03', '方案边界讨论', 'meeting', 'person_03', '技术负责人', [
    '标准问答可以先试自动回复，非标准问题先给人工一份草稿。',
    '现在还不能确认系统能可靠识别所有报价例外。',
  ]],
  ['rec_04', '试点方向复盘', 'meeting', 'person_04', '项目负责人', [
    '这个方案可以继续验证，但我们还没有批准上线或对外承诺。',
    '目前只看过这一组案例，其他团队是否有同样需求还需要访谈。',
    '这次复盘仍认可按风险分流、报价人工确认的方向，没有提出新的适用条件。',
  ]],
];

export const demoRecords = materials.map(([id, title, source_type, person, label, paragraphs]) => ({
  id, title, source_type, source_date: '2026-10-17', source_name: `${id}-synthetic.txt`,
  material_basis: 'synthetic', authorization_note: null, created_at: date,
  covered_in_current_version: true, content: paragraphs.join('\n\n'),
  participants: [{ id: person, label }],
  segments: paragraphs.map((text, index) => ({ id: `${id}_seg_${index + 1}`, paragraph_index: index + 1, text })),
}));

const evidenceSpec = [
  [0, 0, 'spontaneous'], [0, 1, 'prompted'], [1, 1, 'prompted'],
  [2, 0, 'spontaneous'], [3, 0, 'spontaneous'], [3, 1, 'prompted'],
  [1, 2, 'spontaneous'], [3, 2, 'spontaneous'],
];
export const demoEvidence = evidenceSpec.map(([recordIndex, paragraphIndex, elicitation], index) => {
  const record = demoRecords[recordIndex];
  return {
    id: `ev_0${index + 1}`, label: `E0${index + 1}`, record_id: record.id,
    segment_id: record.segments[paragraphIndex].id, quote: record.segments[paragraphIndex].text,
    speaker_id: record.participants[0].id, elicitation, claim_origin: 'participant_statement',
  };
});

const judgment = (id, text, type, ids, conditions, rationale, gaps, alternatives = []) => ({
  id, text, epistemic_type: type, fact_basis: type === 'fact' ? 'recorded_statement' : null,
  review_status: 'unreviewed', conditions, evidence_ids: ids, rationale,
  alternative_explanations: alternatives, evidence_gaps: gaps,
});
const change = (id, type, reason, ids, is_breakthrough = false) => ({
  insight_id: id, type, reason, evidence_ids: ids,
  previous_judgment_id: type === 'new' ? null : `${id}_judgment_1`,
  current_judgment_id: `${id}_judgment_2`, candidate_judgment_id: null, is_breakthrough,
});
function coverage(evidenceIds) {
  const evidence = demoEvidence.filter(item => evidenceIds.includes(item.id));
  return {
    unique_speakers: new Set(evidence.map(item => item.speaker_id)).size,
    spontaneous_speakers: new Set(evidence.filter(item => item.elicitation === 'spontaneous').map(item => item.speaker_id)).size,
    prompted_speakers: new Set(evidence.filter(item => item.elicitation === 'prompted').map(item => item.speaker_id)).size,
    supporting_record_count: new Set(evidence.map(item => item.record_id)).size, total_analyzed_record_count: 4,
    identity_incomplete: false, unknown_elicitation_count: 0,
    note: '仅统计合成材料中明确的身份；主动提起与被问回应人数可能重叠，未提及不代表不关心。',
  };
}

export const demoInsights = [
  {
    id: 'ins_01', title: '自动化的边界，应该由业务风险决定',
    judgment: judgment('ins_01_judgment_2', '标准问题可尝试自动回复；涉及报价与例外时，先给人工草稿并保留确认。', 'inference', ['ev_01', 'ev_02', 'ev_04'], ['标准与非标准问题能够被识别', '报价权限与责任边界明确'], '从全量自动回复细化为按风险分流，避免把回复速度当成唯一目标。', ['尚未测试问题分类的误判情况。'], ['人工确认也可能源于现有授权制度，而非技术本身。']),
    dispute_status: 'none', coverage: coverage(['ev_01', 'ev_02', 'ev_04']),
    last_change: change('ins_01', 'qualified', '报价风险与人工草稿方案，为原先的全自动设想增加了条件。', ['ev_02', 'ev_04'], true),
  },
  {
    id: 'ins_02', title: '等待审批，可能比生成报价更值得先验证',
    judgment: judgment('ins_02_judgment_2', '报价生成速度是否是首要问题，现有证据还不足以确认。', 'hypothesis', ['ev_03'], ['需要拆分实际处理时间与等待时间'], '流程走查提示审批等待可能影响总时长，但缺少运行基线。', ['缺少真实订单的处理与等待时长。'], ['资料准备不完整也可能造成等待。']),
    dispute_status: 'open', coverage: coverage(['ev_03']),
    last_change: { ...change('ins_02', 'challenged', '新增走查提出审批等待这个替代解释，暂不采用新的首要约束判断。', ['ev_03']), candidate_judgment_id: 'ins_02_candidate_1' },
  },
  {
    id: 'ins_03', title: '认可试点方向，还不等于批准上线',
    judgment: judgment('ins_03_judgment_2', '项目负责人表达了继续验证的意愿，并明确尚未批准上线或对外承诺。', 'fact', ['ev_05'], ['仅确认合成材料中记录的说法'], '原话明确区分了认可方向与批准行动。', []),
    dispute_status: 'none', coverage: coverage(['ev_05']),
    last_change: change('ins_03', 'new', '记录授权边界，避免将认可升级为批准。', ['ev_05']),
  },
  {
    id: 'ins_04', title: '风险分流可以成为复用方向，但还不是共性结论',
    judgment: judgment('ins_04_judgment_2', '将理解、分流和人工确认拆开，可能形成可复用能力；行业共性仍待验证。', 'hypothesis', ['ev_04', 'ev_06'], ['其他团队也存在标准问题与高风险例外的区分'], '当前案例支持提出产品化方向，不能证明行业需求或付费意愿。', ['缺少第二个独立案例与付费意愿证据。'], ['客户可能只需要现有系统中的简单配置。']),
    dispute_status: 'none', coverage: coverage(['ev_04', 'ev_06']),
    last_change: change('ins_04', 'new', '形成产品化假设，暂不视为已验证机会。', ['ev_04', 'ev_06']),
  },
  {
    id: 'ins_05', title: '先量清等待，再决定优化投入',
    judgment: judgment('ins_05_judgment_2', '先拆分处理与等待时间建立基线，再决定优化哪一段。', 'inference', ['ev_07', 'ev_03'], ['可以获得同一笔业务的时间记录'], '生成速度的优化计划遇到了未被统计的等待，需要先测量再选择投入。', ['尚未获得真实业务的完整时间记录。'], ['少量走查未必代表日常业务，需覆盖正常与异常案例。']),
    dispute_status: 'none', coverage: coverage(['ev_07', 'ev_03']),
    last_change: change('ins_05', 'revised', '由优先优化生成速度，转为先区分处理和等待建立运行基线。', ['ev_07', 'ev_03'], true),
  },
];

for (const insight of demoInsights) insight.spark = structuredClone(demoSparks[insight.id]);

const block = (text, type, ids = []) => ({ text, epistemic_type: type, evidence_ids: ids, conditions: [], alternative_explanations: type === 'hypothesis' || type === 'inference' ? ['仍需用真实运行基线排除其他解释。'] : [], gaps: [] });
const facts = [
  ['fact_01', '认可与批准要分开记录', block(demoInsights[2].judgment.text, 'fact', ['ev_05']), ['ins_03']],
  ['breakthrough_01', '从追求全自动，到按风险分流', block(demoInsights[0].judgment.text, 'inference', ['ev_02', 'ev_04']), ['ins_01']],
  ['constraint_01', '审批等待是候选约束', block(demoInsights[1].judgment.text, 'hypothesis', ['ev_03']), ['ins_02']],
  ['ai_01', '先建立识别与确认的闭环', block('大模型辅助理解问题；程序按规则分流；人工保留报价确认。', 'inference', ['ev_02', 'ev_04']), ['ins_01']],
  ['reuse_01', '通用分流与客户授权配置分开', block(demoInsights[3].judgment.text, 'hypothesis', ['ev_04', 'ev_06']), ['ins_04']],
  ['validation_01', '先核查时间分布，再确定试点', block('用同一笔订单走查处理、等待与返工，不急于确定首要约束。', 'inference', ['ev_03']), ['ins_02']],
];
export const demoOverview = {
  project: { id: 'prj_demo', name: '客户服务 AI 试点研究', created_at: date, current_version: 2, record_count: 4 },
  snapshot_version: 2, active_job_id: null, source_record_ids: demoRecords.map(item => item.id), unanalyzed_record_ids: [],
  summary: '四份讨论把“让 AI 自动回复”细化成了按业务风险分流的方案。报价审批等待是新的候选约束，仍需真实订单数据验证。',
  insights: demoInsights,
  dimensions: DIMENSIONS.map(([key], index) => ({ key, status: 'available', findings: [{ id: facts[index][0], title: facts[index][1], body: facts[index][2], insight_ids: facts[index][3], sections: [] }], gaps: index > 1 ? ['合成案例仅展示结构，不能证明真实客户结论。'] : [] })),
  evidence: demoEvidence, changes: demoInsights.map(item => item.last_change), outcome: 'updated',
  pending_confirmation_count: 1, engine_mode: 'mock',
};

export const demoPrompts = [
  { insight_id: 'ins_02', title: '报价慢，主要慢在哪里？', description: '抽取真实订单，分别记录处理、审批等待与返工时间。', evidence_ids: ['ev_03'] },
  { insight_id: 'ins_01', title: '能否可靠识别高风险问题？', description: '用已标注的咨询样本，检验报价与例外问题的漏判。', evidence_ids: ['ev_02', 'ev_04'] },
];

export function getDemoOverview() { return structuredClone(demoOverview); }
