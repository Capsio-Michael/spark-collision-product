import test from 'node:test';
import assert from 'node:assert/strict';
import { demoInsights } from '../src/fixtures/demo.js';
import { getDemoInsightDetail, getDemoDetailRecord } from '../src/fixtures/insight-details.js';
import { DetailSession, evidenceFor, validateDetail, validateSource } from '../src/insight-detail-model.js';
import { renderDetailAnalysis, renderDetailEvidence } from '../src/insight-detail.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const session = options => new DetailSession({ insightId: 'ins_01', version: 2, loadDetail: () => getDemoInsightDetail('ins_01'), loadRecord: getDemoDetailRecord, ...options });

test('all synthetic details and collision references point to actual source paragraphs', () => {
  for (const insight of demoInsights) {
    const detail = validateDetail(getDemoInsightDetail(insight.id), { insightId: insight.id, version: 2 });
    for (const evidence of detail.evidence) validateSource(getDemoDetailRecord(evidence.record_id), evidence);
    const known = new Set(detail.evidence.map(item => item.id));
    const references = [...detail.judgment.evidence_ids, ...detail.validations.flatMap(item => item.evidence_ids)];
    if (detail.collision_card) {
      for (const key of ['prior', 'shock', 'new_frame', 'implication']) references.push(...detail.collision_card[key].evidence_ids);
      assert.ok(detail.collision_card.shock.evidence_ids.length);
      assert.ok(detail.collision_card.validation_ids.every(id => detail.validations.some(item => item.id === id)));
    }
    assert.ok(references.every(id => known.has(id)), insight.id);
  }
});

test('detail version and insight identity are checked before presentation', async () => {
  assert.throws(() => validateDetail(getDemoInsightDetail('ins_01'), { version: 3 }), /版本/);
  assert.throws(() => validateDetail(getDemoInsightDetail('ins_02'), { insightId: 'ins_01' }), /不一致/);
  const detail = getDemoInsightDetail('ins_01'); detail.evidence.push(detail.evidence[0]);
  assert.throws(() => validateDetail(detail), /重复/);
  const state = session({ version: 3 }); await state.load();
  assert.equal(state.state.status, 'error'); assert.equal(state.state.detail, null);
});

test('relations support multiple memberships and distinguish unknown from no evidence', () => {
  const detail = getDemoInsightDetail('ins_01');
  detail.relations.push({ evidence_id: 'ev_02', relation: 'supports' });
  assert.equal(evidenceFor(detail, 'all').length, 4);
  assert.equal(evidenceFor(detail, 'supports').length, 2);
  assert.equal(evidenceFor(detail, 'counterexample').length, 0);
  detail.relations = [];
  assert.equal(evidenceFor(detail, 'unknown').length, 4);
});

test('full card renders all five stages while factual findings do not invent a collision', () => {
  const html = renderDetailAnalysis(getDemoInsightDetail('ins_01'));
  for (const label of ['原来怎么想', '什么改变了判断', '现在怎样理解', '对业务意味着什么', '下一步怎么验证', '什么结果支持', '什么结果推翻']) assert.ok(html.includes(label));
  const factHtml = renderDetailAnalysis(getDemoInsightDetail('ins_03'));
  assert.ok(factHtml.includes('关键事实 / 待验证机会'));
  assert.ok(factHtml.includes('只证明“这样说过”'));
  assert.ok(!factHtml.includes('cd-timeline'));
});

test('candidate is presented separately and does not replace the current judgment', () => {
  const detail = getDemoInsightDetail('ins_02');
  const before = structuredClone(detail);
  const html = renderDetailAnalysis(detail);
  assert.ok(html.includes('当前保留') && html.includes('候选解释'));
  assert.ok(html.includes(detail.judgment.text) && html.includes(detail.candidate_judgment.text));
  assert.deepEqual(detail, before);
  assert.ok(!html.includes('accept_candidate') && !html.includes('data-action="approve"'));
});

test('untrusted detail fields and source paragraphs are rendered as escaped text', () => {
  const detail = getDemoInsightDetail('ins_01');
  const attack = '<img src=x onerror=alert(1)>';
  detail.judgment.text = attack; detail.collision_card.prior.text = attack;
  detail.validations[0].owner = attack; detail.evidence[0].quote = attack;
  const html = renderDetailAnalysis(detail);
  assert.ok(!html.includes(attack) && html.includes('&lt;img'));
  const sourceHtml = renderDetailEvidence({ detail, filter: 'all', sourceStatus: 'idle' });
  assert.ok(!sourceHtml.includes(attack) && sourceHtml.includes('&lt;img'));
});

test('missing fields stay unknown and dangling references never become fake source links', () => {
  const detail = getDemoInsightDetail('ins_01');
  detail.judgment.conditions = []; detail.judgment.evidence_ids.push('ev_missing');
  detail.coverage.unique_speakers = null; detail.validations[0].owner = null; detail.validations[0].due_at = null;
  detail.collision_card.prior_origin = 'analysis_premise';
  const html = renderDetailAnalysis(detail);
  assert.ok(html.includes('ev_missing · 引用缺失'));
  assert.ok(!html.includes('data-cd-evidence="ev_missing"'));
  for (const label of ['不能理解为无条件成立', '负责人待指定', '时间待商定', '分析前提，非原话', '未知']) assert.ok(html.includes(label));
});

test('source identity, segment and exact quote must match before highlighting', () => {
  const evidence = getDemoInsightDetail('ins_01').evidence[0];
  assert.throws(() => validateSource(getDemoDetailRecord('rec_03'), evidence), /不一致/);
  assert.throws(() => validateSource(getDemoDetailRecord(evidence.record_id), { ...evidence, quote: '虚构引文' }), /不匹配/);
  assert.throws(() => validateSource(getDemoDetailRecord(evidence.record_id), { ...evidence, segment_id: 'missing' }), /不匹配/);
});

test('changing evidence quickly cannot let a slow response overwrite a newer selection', async () => {
  const first = deferred(); const second = deferred();
  const state = session({ loadRecord: id => id === 'rec_01' ? first.promise : second.promise });
  await state.load();
  const a = state.selectEvidence('ev_01'); const b = state.selectEvidence('ev_04');
  second.resolve(getDemoDetailRecord('rec_03')); await b;
  first.resolve(getDemoDetailRecord('rec_01')); await a;
  assert.equal(state.state.selectedEvidenceId, 'ev_04'); assert.equal(state.state.record.id, 'rec_03');
});

test('source failures retain the detail and retry successfully without rerunning analysis', async () => {
  let count = 0; let detailLoads = 0;
  const state = session({ loadDetail: () => { detailLoads++; return getDemoInsightDetail('ins_01'); }, loadRecord: id => { if (!count++) throw new Error('连接中断'); return getDemoDetailRecord(id); } });
  await state.load(); await state.selectEvidence('ev_02');
  assert.equal(state.state.status, 'ready'); assert.equal(state.state.sourceStatus, 'error');
  await state.selectEvidence('ev_02');
  assert.equal(state.state.sourceStatus, 'ready'); assert.equal(detailLoads, 1);
});

test('closing a detail ignores pending responses and no further state is emitted', async () => {
  const result = deferred(); let emits = 0;
  const state = session({ loadDetail: () => result.promise, onChange: () => emits++ });
  const pending = state.load(); state.close();
  result.resolve(getDemoInsightDetail('ins_01')); await pending;
  assert.equal(emits, 1); assert.equal(state.state.detail, null);
});

test('unknown evidence selection invalidates a previous request instead of showing stale source', async () => {
  const result = deferred(); const state = session({ loadRecord: () => result.promise });
  await state.load(); const pending = state.selectEvidence('ev_01');
  await state.selectEvidence('missing'); result.resolve(getDemoDetailRecord('rec_01')); await pending;
  assert.equal(state.state.sourceStatus, 'error'); assert.equal(state.state.record, null);
});
