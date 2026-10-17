import { demoInsights, demoEvidence, demoRecords } from './demo.js';

// Only synthetic example details use these authored interpretations. Live data is never completed with them.
const block = (value, epistemic_type, evidence_ids, conditions = [], alternatives = [], gaps = []) => ({ text: value, epistemic_type, evidence_ids, conditions, alternative_explanations: alternatives, gaps });
const validation = (id, question, evidence_ids, overrides = {}) => ({
  id, question, decision_impact: '决定试点应优先投入哪一段工作，避免只改善局部速度。', evidence_ids,
  required_materials: ['获准使用的实际咨询或订单记录'], interview_roles: ['业务负责人', '一线处理人员'],
  experiment: '选择一组真实案例，逐步记录触发、处理、等待、异常和结果，再与原判断对照。',
  success_criteria: '案例中的主要耗时或风险与候选机制一致，并能找到原始记录。',
  failure_criteria: '主要影响来自其他环节，或现有证据不足以排除其他解释。',
  next_decision: '有支持证据后缩小试点范围；反例占主导时修正判断并补充走查。',
  owner: null, due_at: null, workstream: 'joint_walkthrough', status: 'proposed', ...overrides,
});

export function getDemoInsightDetail(id) {
  const summary = demoInsights.find(item => item.id === id);
  if (!summary) throw new Error('合成示例中没有这个智慧点。');
  const sparkIds = (summary.spark?.events || []).flatMap(event => event.contributions.flatMap(item => item.evidence_ids));
  const evidence = demoEvidence.filter(item => summary.judgment.evidence_ids.includes(item.id) || sparkIds.includes(item.id));
  const detail = {
    ...structuredClone(summary), snapshot_version: 2,
    candidate_judgment: null, evidence: structuredClone(evidence),
    relations: evidence.map(item => ({ evidence_id: item.id, relation: 'supports' })),
    collision_card: null, validations: [],
    priority: {
      business_impact: { level: 'unknown', reason: '合成案例未提供经营数据，无法衡量实际影响。' },
      evidence_strength: { level: 'low', reason: '仅用于说明分析方法，不能证明真实业务结论。' },
      validation_feasibility: { level: 'medium', reason: '可设计小样本走查，但材料授权和参与者仍待确认。' },
    },
  };
  if (id === 'ins_01') {
    detail.relations = [{ evidence_id: 'ev_01', relation: 'supplements' }, { evidence_id: 'ev_02', relation: 'qualifies' }, { evidence_id: 'ev_04', relation: 'supports' }, { evidence_id: 'ev_08', relation: 'supplements' }];
    detail.validations = [validation('val_risk', '标准问题与高风险例外，能否被可靠区分？', ['ev_02', 'ev_04'], {
      decision_impact: '决定能否尝试自动回复，以及哪些情形必须先交给人工。',
      required_materials: ['已标注标准问题、报价和例外的获准咨询样本', '现有报价授权规则'],
      experiment: '由业务人员先标注问题风险，再让候选分流方案处理同一批样本，逐条核查高风险漏判。',
      success_criteria: '高风险问题的漏判符合业务负责人事先确认的容忍标准；标准问题能正确分流。数值门槛待商定。',
      failure_criteria: '高风险问题被直接放行，或业务人员无法就分类规则形成一致标注。',
      next_decision: '满足约定标准后讨论小范围试点；不满足时保留人工草稿与确认，并调整分流规则。',
    })];
    detail.collision_card = {
      category: 'technical_reframe', prior_origin: 'recorded',
      prior: block('希望所有问题都能由 AI 直接回复。', 'opinion', ['ev_01']),
      shock: block('同一次访谈明确提出：标准问题可自动回复，报价需要人工确认；后续讨论提出非标准问题先生成草稿。', 'inference', ['ev_02', 'ev_04']),
      new_frame: block('按业务风险和授权边界分流，而不是对所有咨询采用相同的自动化程度。', 'inference', ['ev_02', 'ev_04'], ['能够识别标准问题与高风险例外'], ['分流也可能由明确的业务规则完成，并不一定需要大模型决策。']),
      implication: block('先验证分流与人工确认闭环，再讨论扩大自动回复范围。大模型辅助理解与草拟，明确规则交给程序执行，报价授权保留给责任人。', 'inference', ['ev_02', 'ev_04'], ['业务负责人确认风险容忍标准', '人工确认有可追溯记录'], ['人工确认也可能主要源于授权制度，而非模型准确率。'], ['尚未获得分类误判率和处理时长基线。']),
      validation_ids: ['val_risk'],
    };
  } else if (id === 'ins_02') {
    detail.candidate_judgment = {
      ...structuredClone(summary.judgment), id: 'ins_02_candidate_1',
      text: '审批等待可能比报价生成更影响总时长，应先核查等待分布。',
      review_status: 'unreviewed', epistemic_type: 'hypothesis', fact_basis: null,
    };
    detail.relations = [{ evidence_id: 'ev_03', relation: 'challenges' }];
    detail.validations = [validation('val_wait', '报价总时长主要消耗在处理还是等待？', ['ev_03'], {
      required_materials: ['同一笔订单的提交、审批、生成报价与返工时间记录'],
      experiment: '现场沿同一笔订单回溯，分别列出实际处理、审批等待、资料补齐与返工时间。',
      success_criteria: '可追溯记录支持审批等待是主要耗时来源，并由业务负责人核对。',
      failure_criteria: '主要耗时来自资料缺失、计算或返工，或无法获得有效的时间记录。',
    })];
  } else if (id === 'ins_03') {
    // A key fact without a documented change is deliberately not a collision card.
    detail.validations = [validation('val_approval', '后续试点需要哪些明确的批准条件？', ['ev_05'], {
      decision_impact: '区分继续研究的意愿与上线授权，避免把建议误当决定。',
      required_materials: ['正式审批流程或授权说明'], interview_roles: ['有权批准试点的负责人'],
      experiment: '核对批准人、试点边界及所需验收材料，形成待审清单。',
      success_criteria: '能够明确批准条件、责任角色与所需证据；当前仍不代表已批准。',
      failure_criteria: '批准权限或试点边界仍不清楚。', workstream: 'customer_preparation',
    })];
  } else if (id === 'ins_05') {
    detail.validations = [validation('val_baseline', '能否完整记录同一笔业务的处理与等待？', ['ev_07', 'ev_03'])];
    detail.collision_card = {
      category: 'business_reframe', prior_origin: 'recorded',
      prior: block('先优化报价生成速度。', 'opinion', ['ev_07']),
      shock: block('走查指出等待发生在授权环节，但具体耗时尚未统计。', 'fact', ['ev_03']),
      new_frame: block('先拆分处理与等待时间建立基线，再决定优化哪一段。', 'inference', ['ev_07', 'ev_03'], ['能获得同一笔业务的时间记录']),
      implication: block('先用真实业务测量定位投入，而不是仅凭感受确定优化重点。', 'inference', ['ev_07', 'ev_03'], [], ['异常订单可能使少量样本失真。'], ['尚未获得完整时间记录。']),
      validation_ids: ['val_baseline'],
    };
  } else {
    detail.validations = [validation('val_reuse', '第二个独立团队是否存在同样的风险分流需求？', ['ev_04', 'ev_06'], {
      decision_impact: '决定是否继续验证产品化假设，避免把单个案例当成行业共性。',
      required_materials: ['第二个独立团队的获准访谈', '现有工具及配置方式'], interview_roles: ['独立团队的业务和系统负责人'],
      experiment: '沿真实咨询流程访谈第二个团队，记录相同机制、反例及现有系统能否解决。',
      success_criteria: '独立案例出现相同机制，并能够区分通用能力与客户配置；仍需单独验证付费意愿。',
      failure_criteria: '机制仅在当前团队成立，或简单配置现有系统即可满足需求。', workstream: 'internal_research',
    })];
  }
  return detail;
}

export function getDemoDetailRecord(id) {
  const record = demoRecords.find(item => item.id === id);
  if (!record) throw new Error('合成材料不存在。');
  return structuredClone(record);
}
