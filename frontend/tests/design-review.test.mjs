import test from 'node:test';
import assert from 'node:assert/strict';
import { getDesignSnapshot, getDesignDetail, locateDesignClaim, designMarkdown } from '../src/design-review-model.js';
import { renderDesignOverview, renderDesignHistory } from '../src/design-review-view.js';

test('M1 snapshot never leaks M2 claims, materials or later clue', () => {
  const snapshot = getDesignSnapshot(1);
  assert.equal(snapshot.records.length, 1);
  assert.equal(snapshot.insights.length, 2);
  assert.ok(snapshot.annotations.every(c => c.meeting_id === 'M1'));
  assert.ok(snapshot.insights.every(i => !Object.hasOwn(i, 'v2_after_M2')));
  assert.doesNotMatch(renderDesignOverview(1), /M2 给出|展会专题可更鲜明热烈/);
  assert.doesNotMatch(snapshot.insights[0].importance_basis, /M2/);
  assert.throws(() => getDesignDetail('clue_exhibition_paths', 1));
  assert.doesNotMatch(designMarkdown(1), /Q023|Q003|M2-展会/);
});

test('every quoted claim and response endpoint resolves to exact synthetic source', () => {
  let count = 0;
  for (const insight of getDesignSnapshot(2).insights) {
    const detail = getDesignDetail(insight.id, 2);
    for (const claim of detail.annotations) {
      const located = locateDesignClaim(detail, claim.claim_id);
      assert.ok(located.paragraph.text.includes(claim.quote));
      if (located.target) assert.ok(locateDesignClaim(detail, located.target.claim_id).paragraph.text.includes(located.target.quote));
      count++;
    }
  }
  assert.ok(count >= 38);
});

test('missing or altered source stops citation rendering', () => {
  const detail = getDesignDetail('ins_brand_professionalism', 1);
  detail.records[0].paragraphs.find(p => p.id === 'P002').text = '不是原话';
  assert.throws(() => locateDesignClaim(detail, 'c001'), /不匹配/);
  assert.throws(() => locateDesignClaim(detail, 'c035'), /本版未提供/);
});

test('M2 preserves M1 and separates corroboration, scope and approval', () => {
  const snapshot = getDesignSnapshot(2);
  assert.equal(snapshot.records.length, 2);
  assert.equal(snapshot.insights.length, 3);
  assert.match(snapshot.insights[0].current.scope, /官网首页与展会专题/);
  assert.equal(snapshot.insights[1].current.change_type, 'supported_without_new_breakthrough');
  const text = designMarkdown(2);
  assert.match(text, /Q023/);
  assert.match(text, /P064/);
  assert.match(text, /不等于批准发布/);
  assert.match(text, /M1 的限定原话仍保留/);
  assert.match(renderDesignOverview(2), /本次补证，未形成独立新突破/);
  assert.match(renderDesignHistory(2), /预先编写/);
});

test('snapshots are isolated copies and reject nonexistent versions', () => {
  const snapshot = getDesignSnapshot(1); snapshot.records.length = 0;
  assert.equal(getDesignSnapshot(1).records.length, 1);
  assert.throws(() => getDesignSnapshot(3));
});
