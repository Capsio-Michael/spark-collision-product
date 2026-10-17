import { designReviewData } from './fixtures/design-review-data.js';

export const DESIGN_NOTICE = '合成文字／预置标注演示 · 非实时 AI 分析';
const clone = value => structuredClone(value);
function versionNumber(version) {
  if (![1, 2].includes(version)) throw new Error('设计评审演示只有 v1、v2 两版。');
  return version;
}

// Editorial content stays separate from v0.1 transport responses and user storage.
export function getDesignSnapshot(version = 1) {
  versionNumber(version);
  const source = designReviewData.fixture;
  const records = designReviewData.records.filter(record => version === 2 || record.meeting_id === 'M1');
  const meetingIds = new Set(records.map(record => record.meeting_id));
  const annotations = source.annotations.filter(item => meetingIds.has(item.meeting_id));
  const insights = source.insights.filter(item => version === 2 || item.v1_after_M1).map(item => {
    const stage = item[version === 1 ? 'v1_after_M1' : 'v2_after_M2'];
    const current = stage ? { ...stage } : null;
    if (version === 2 && current && item.v1_after_M1?.scope && !current.scope) {
      current.scope = '品牌官网首页与展会专题；按页面任务区分，不泛化为永久审美偏好。';
    }
    const visible = { ...item, current, kind: item.status ? 'clue' : 'insight' };
    if (version === 1) {
      delete visible.v2_after_M2;
      if (visible.importance_basis) visible.importance_basis = 'M1 有多轮追问、具体例子、反例和条件认同。仅作阅读优先级说明，不把出现频次算成共识或已校准分数。';
    }
    return visible;
  });
  return clone({ version, project: source.project, notice: DESIGN_NOTICE, records, annotations, insights });
}

export function getDesignDetail(id, version = 1) {
  const snapshot = getDesignSnapshot(version);
  const insight = snapshot.insights.find(item => item.id === id);
  if (!insight) throw new Error('这版没有该洞察，不使用后来版本补齐。');
  const ids = new Set(snapshot.annotations.filter(item => item.insight_id === id).map(item => item.claim_id));
  for (const claimId of [...(insight.v1_after_M1?.forming_claim_ids || []), ...(version === 2 ? insight.v2_after_M2?.new_claim_ids || [] : []), ...(insight.claim_ids || [])]) ids.add(claimId);
  // Include the explicit subject of a response even when it belongs to another insight.
  let grew = true;
  while (grew) {
    grew = false;
    for (const item of snapshot.annotations) if (ids.has(item.claim_id) && item.relation && !ids.has(item.relation.target_claim_id)) {
      ids.add(item.relation.target_claim_id); grew = true;
    }
  }
  return { ...snapshot, insight, annotations: snapshot.annotations.filter(item => ids.has(item.claim_id)) };
}

export function locateDesignClaim(detail, claimId) {
  const claim = detail.annotations.find(item => item.claim_id === claimId);
  if (!claim) throw new Error('本版未提供该标注。');
  const record = detail.records.find(item => item.meeting_id === claim.meeting_id);
  const paragraph = record?.paragraphs.find(item => item.id === claim.paragraph_id);
  if (!paragraph || !claim.quote || !paragraph.text.includes(claim.quote)) throw new Error('引文与原文不匹配，停止展示定位。');
  const target = claim.relation ? detail.annotations.find(item => item.claim_id === claim.relation.target_claim_id) : null;
  if (claim.relation && !target) throw new Error('缺少被回应的主张，停止展示关系。');
  return { claim, record, paragraph, target };
}

export function designMarkdown(version) {
  const snapshot = getDesignSnapshot(version);
  const lines = [`# ${snapshot.project} · v${version}`, snapshot.notice, '材料日期未提供。P/Q 为人工段落标识，不是录音时间戳。',
    '## 材料范围', ...snapshot.records.map(item => `- ${item.meeting_id}：${item.filename}（合成）`), '## 当前理解'];
  for (const insight of snapshot.insights) {
    const detail = getDesignDetail(insight.id, version);
    lines.push(`### ${insight.title}`, insight.current?.understanding || insight.status,
      `范围与边界：${insight.current?.scope || insight.v1_after_M1?.scope || insight.gap || '以本次讨论为限，不推断行业共性。'}`,
      '预写分析理解，不代表真实 AI 输出或客户发布批准。');
    if (version === 2 && insight.v2_after_M2?.history_note) lines.push(insight.v2_after_M2.history_note);
    for (const claim of detail.annotations) {
      const { paragraph, target } = locateDesignClaim(detail, claim.claim_id);
      lines.push(`- ${claim.meeting_id} ${claim.paragraph_id}｜${paragraph.speaker}｜${claim.content_type}：${claim.quote}${target ? `（${claim.relation.type} → ${target.meeting_id} ${target.paragraph_id}「${target.quote}」）` : '（独立提出）'}`);
    }
    if (insight.current?.open_questions) lines.push('待验证：', ...insight.current.open_questions.map(item => `- ${item}`));
  }
  lines.push('## 判断边界', '认可当前设计理解不等于批准发布；未分析音频语气、情绪或人格；重复补证不等于新突破。');
  return `${lines.join('\n\n')}\n`;
}
