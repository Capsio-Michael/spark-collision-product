import { designReviewData } from './fixtures/design-review-data.js';

const fixture = designReviewData.fixture;
const records = designReviewData.records;

export function designStageForContent(content) {
  if (typeof content !== 'string') return 0;
  const found = records.find(record => record.content.trim() === content.trim());
  return found?.meeting_id === 'M1' ? 1 : found?.meeting_id === 'M2' ? 2 : 0;
}

export function designCards(stage) {
  const ids = stage === 1 ? ['ins_brand_professionalism', 'ins_case_context'] : stage === 2 ? ['ins_brand_professionalism'] : [];
  return ids.map(id => {
    const insight = fixture.insights.find(entry => entry.id === id);
    const version = stage === 1 ? insight?.v1_after_M1 : insight?.v2_after_M2;
    const text = stage === 2 ? '品牌官网首页保持克制，展会专题可以更鲜明' : insight?.title;
    return insight && version ? { id: `design@${stage}@${id}`, text, title: insight.title } : null;
  }).filter(Boolean);
}

export function designRecord(meetingId) {
  return records.find(record => record.meeting_id === meetingId) || null;
}

export function designKnowledge(id) {
  const match = /^design@(1|2)@(ins_brand_professionalism|ins_case_context)$/.exec(id || '');
  if (!match) return null;
  const stage = Number(match[1]), insightId = match[2];
  if (!designCards(stage).some(card => card.id === id)) return null;
  const insight = fixture.insights.find(entry => entry.id === insightId);
  const version = stage === 1 ? insight.v1_after_M1 : insight.v2_after_M2;
  const annotationById = new Map(fixture.annotations.map(entry => [entry.claim_id, entry]));
  const annotations = fixture.annotations.filter(entry => entry.insight_id === insightId && (stage === 2 || entry.meeting_id === 'M1'));
  const citations = annotations.map(entry => {
    const record = designRecord(entry.meeting_id);
    const paragraph = record?.paragraphs.find(part => part.id === entry.paragraph_id);
    if (!paragraph || !paragraph.text.includes(entry.quote)) throw new Error('预置标注无法逐字对应原文段落');
    const target = annotationById.get(entry.relation?.target_claim_id);
    return { claim_id: entry.claim_id, meeting_id: entry.meeting_id, paragraph_id: entry.paragraph_id,
      quote: entry.quote, speaker: paragraph.speaker, paragraph_text: paragraph.text,
      content_type: entry.content_type, relation: entry.relation?.type || '原始主张',
      target_claim_id: target?.claim_id || null, target_quote: target?.quote || null,
      source_title: record.title };
  });
  const keyIds = stage === 1 ? version.forming_claim_ids : version.new_claim_ids;
  const keyCitations = citations.filter(ref => keyIds.includes(ref.claim_id));
  return { item: { id, origin: 'design_fixture', title: insight.title, one_line: version.understanding,
      version: stage, version_kind: 'editorial_fixture',
      provenance: { provider: 'editorial_fixture', meeting_ids: stage === 1 ? ['M1'] : ['M1', 'M2'] } },
    judgment: version.understanding, scope: version.scope || insight.v1_after_M1.scope || '以原文标明的场景为准',
    approval_status: version.approval_status || insight.v1_after_M1.approval_status || '未见行动批准',
    history_note: version.history_note || '第一场形成的理解，仍待后续会议核对',
    importance_basis: insight.importance_basis || '没有可校准的重要性分数',
    open_questions: version.open_questions || insight.v1_after_M1.open_questions || [],
    citations, key_citations: keyCitations, full_detail: null };
}
