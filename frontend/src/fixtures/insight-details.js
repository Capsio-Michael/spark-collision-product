import { pricingData } from './pricing-data.js';

const block = (text, evidence_ids, conditions = []) => ({
  text, epistemic_type: 'inference', evidence_ids, conditions,
  alternative_explanations: ['差异也可能来自现行授权规则的适用范围，需核对正式制度。'],
  gaps: ['尚未核对正式报价授权规则与真实订单。'],
});

export function getDemoInsightDetail(id, version = 3) {
  const value = pricingData.snapshots[String(version)]?.details[id];
  if (!value) throw Object.assign(new Error('这个版本尚未出现该关注点。'), { code: 'INSIGHT_NOT_FOUND_AT_VERSION' });
  const detail = structuredClone(value);
  if (id === 'ins_approval_wait') detail.validations = [{
    id: 'val_approval_wait', question: '审批等待是否是报价总时长的主要来源？',
    decision_impact: '决定先优化生成速度、授权等待还是资料补齐；单次自述不能冻结第一约束。',
    evidence_ids: detail.judgment.evidence_ids,
    required_materials: ['同一笔订单的提交、处理、审批及返工时间记录'],
    interview_roles: ['销售负责人', '实际审批人员'],
    experiment: '沿一笔正常订单和一笔异常订单走查，分别记录处理、等待和返工时间。',
    success_criteria: '可追溯时间记录支持审批等待显著影响总时长，具体阈值待商定。',
    failure_criteria: '主要时间来自其他环节，或记录不足以定位等待。',
    next_decision: '支持时讨论等待环节试点；不支持时改查资料、计算或返工。',
    owner: null, due_at: null, workstream: 'joint_walkthrough', status: 'proposed',
  }];
  // Authored method illustration on the same evidence; not a service capability.
  if (id === 'ins_quote_boundary' && version >= 2) {
    const initial = detail.evidence.filter(item => ['M1', 'M2'].includes(item.meeting_id)).map(item => item.id);
    const shock = detail.evidence.filter(item => item.meeting_id === 'M3').map(item => item.id);
    detail.collision_card = {
      category: 'business_reframe', prior_origin: 'analysis_premise',
      prior: block('已讨论的报价均提到人工确认，适用范围待核实。分析前提，非受访者原话。', initial),
      shock: block('M3 提供条件反例：无折扣目录价可以直接发送；跨区或特殊折扣仍需销售确认。', shock),
      new_frame: block('按报价类型和授权条件判断，不把全部报价看成同一种处理方式。', [...initial, ...shock], ['无折扣目录价', '跨区或特殊折扣报价']),
      implication: block('先核对规则与订单，再确定自动发送范围及人工确认责任；认可验证方向不代表批准上线。', [...initial, ...shock]),
      validation_ids: detail.validations.map(item => item.id),
    };
  }
  return detail;
}

export function getDemoDetailRecord(id) {
  const record = pricingData.records.find(item => item.id === id);
  if (!record) throw new Error('合成材料不存在。');
  return structuredClone(record);
}
