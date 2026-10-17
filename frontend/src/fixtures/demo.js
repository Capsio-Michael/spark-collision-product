import { pricingData } from './pricing-data.js';

// A frozen synthetic mock, never a fallback for a connected project's results.
export const demoRecords = pricingData.records;
export const demoOverview = pricingData.snapshots['3'].overview;
export const demoInsights = demoOverview.insights;
export const demoEvidence = demoOverview.evidence;
export const demoPrompts = [
  { insight_id: 'ins_quote_boundary', title: '不同报价，确认边界在哪里？', description: '核对目录价、跨区与特殊折扣的正式授权规则及订单样本。' },
  { insight_id: 'ins_approval_wait', title: '审批等待究竟有多久？', description: '拆分同一笔订单的处理、等待和返工时间，先建立运行基线。' },
];

export function getDemoOverview(version = 3) {
  const snapshot = pricingData.snapshots[String(version)];
  if (!snapshot) throw new Error('合成案例没有这个版本。');
  return structuredClone(snapshot.overview);
}
