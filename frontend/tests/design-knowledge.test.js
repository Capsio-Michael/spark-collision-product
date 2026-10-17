import test from 'node:test';
import assert from 'node:assert/strict';
import { designReviewData } from '../src/fixtures/design-review-data.js';
import { designCards, designKnowledge, designRecord, designStageForContent } from '../src/design-knowledge.js';

test('only the two exact synthetic meeting texts activate the editorial demo', () => {
  const [first, second] = designReviewData.records;
  assert.equal(first.paragraphs.length + second.paragraphs.length, 106);
  assert.equal(designStageForContent(first.content), 1);
  assert.equal(designStageForContent(second.content), 2);
  assert.equal(designStageForContent(first.content + '\n新增一句话'), 0);
  assert.equal(designStageForContent('M1 品牌官网设计评审'), 0);
  assert.equal(designCards(1).length, 2);
  assert.equal(designCards(2).length, 1);
});

test('each displayed relation resolves to exact P or Q source text and known target', () => {
  const first = designKnowledge('design@1@ins_brand_professionalism');
  const second = designKnowledge('design@2@ins_brand_professionalism');
  assert.ok(first.key_citations.some(ref => ref.paragraph_id === 'P002'));
  assert.ok(second.key_citations.some(ref => ref.paragraph_id === 'Q023'));
  assert.ok(second.citations.length > first.citations.length);
  for (const detail of [first, second, designKnowledge('design@1@ins_case_context')]) {
    for (const ref of detail.citations) {
      const paragraph = designRecord(ref.meeting_id).paragraphs.find(part => part.id === ref.paragraph_id);
      assert.ok(paragraph.text.includes(ref.quote));
      if (ref.target_claim_id) assert.ok(ref.target_quote);
    }
  }
  assert.equal(designKnowledge('design@2@ins_case_context'), null);
});
