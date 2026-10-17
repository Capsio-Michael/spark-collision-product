// Authored synthetic origin events, not evidence of engine capability.
const conversation = (id, title, record) => ({ id, title, date: '2026-10-17', record_ids: [record] });
const customer = conversation('conv_customer', '客服现场访谈', 'rec_01');
const pricing = conversation('conv_pricing', '报价流程走查', 'rec_02');
const technical = conversation('conv_technical', '方案边界讨论', 'rec_03');
const review = conversation('conv_review', '试点方向复盘', 'rec_04');
const contribution = (conversation_id, text, evidence_ids) => ({ conversation_id, text, evidence_ids });
const initial = '希望所有问题都能由 AI 直接回复。';
const first = '标准问题可自动回复，报价需要人工确认。';
const next = '标准问题可尝试自动回复；涉及报价与例外时，先给人工草稿并保留确认。';
export const demoSparks = {
  ins_01: {
    status: 'collision', latest_event_id: 'spark_risk_echo', conversations: [customer, technical, review],
    events: [
      { id: 'spark_risk_single', version: 2, kind: 'collision', scope: 'single', previous_event_id: null,
        conversation_ids: [customer.id], before: initial, after: first,
        reason: '同一场访谈里的报价例外，让“全部自动回复”第一次出现明确边界。',
        contributions: [contribution(customer.id, '先表达全自动诉求，随后明确报价必须人工确认。', ['ev_01', 'ev_02'])] },
      { id: 'spark_risk_cross', version: 2, kind: 'collision', scope: 'cross', previous_event_id: 'spark_risk_single',
        conversation_ids: [customer.id, technical.id], before: first, after: next,
        reason: '客服提出报价确认要求，技术讨论补充非标准问题先给草稿，共同形成按风险分流的框架。',
        contributions: [contribution(customer.id, '提供报价必须人工确认的业务边界。', ['ev_02']), contribution(technical.id, '把非标准问题的处理方式细化为人工草稿。', ['ev_04'])] },
      { id: 'spark_risk_echo', version: 2, kind: 'corroboration', scope: null, previous_event_id: 'spark_risk_cross',
        conversation_ids: [review.id], before: next, after: next,
        reason: '复盘再次认可风险分流方向，没有增加新条件；本次只记印证，保留原有跨场火花。',
        contributions: [contribution(review.id, '重复认可现有方向，不代表批准上线，也没有形成新的认知突破。', ['ev_08'])] },
    ],
  },
  ins_02: { status: 'clue', reason: '走查提示等待可能影响总时长，但没有实测数据，首要约束仍待验证。', conversations: [], events: [] },
  ins_03: { status: 'observation', conversations: [], events: [] },
  ins_04: { status: 'clue', reason: '当前只有一组案例，尚不足以证明其他团队有同样需求。', conversations: [], events: [] },
  ins_05: {
    status: 'collision', latest_event_id: 'spark_baseline_single', conversations: [pricing],
    events: [{ id: 'spark_baseline_single', version: 2, kind: 'collision', scope: 'single', previous_event_id: null,
      conversation_ids: [pricing.id], before: '先优化报价生成速度。', after: '先拆分处理与等待时间建立基线，再决定优化哪一段。',
      reason: '一场走查中，优化生成速度的计划遇到“等待尚未统计”的反例，投入顺序转向先测量。',
      contributions: [contribution(pricing.id, '原有优化计划与未统计的等待并存，需要先分清时间消耗。', ['ev_07', 'ev_03'])] }],
  },
};
