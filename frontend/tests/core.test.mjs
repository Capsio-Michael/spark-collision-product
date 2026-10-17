import test from 'node:test';
import assert from 'node:assert/strict';
import { DIMENSIONS, characterCount, escapeHtml, filterInsights, validateDrafts, readDrafts, saveDrafts } from '../src/core.js';
import { demoOverview, demoRecords, getDemoOverview } from './fixtures/demo.js';
import { createApiClient, ApiError } from '../src/api/client.js';

const draft = overrides => ({
  client_record_id: 'draft_01', title: '合成访谈', content: '客服：报价需要人工确认。',
  source_type: 'interview', source_date: null, source_name: '粘贴记录', participants: [],
  material_basis: 'synthetic', authorization_note: null, ...overrides,
});

test('untrusted imported text is escaped instead of becoming HTML', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)"> & \'x\''), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;x&#39;');
});

test('import validation handles Unicode code points and material permission', () => {
  assert.equal(characterCount('中😀'), 2);
  assert.equal(validateDrafts([draft({ content: '😀'.repeat(20000) })]), null);
  assert.match(validateDrafts([draft({ content: '😀'.repeat(20001) })]), /20,000/);
  assert.match(validateDrafts([draft({ content: '  \n ' })]), /不能为空/);
  assert.match(validateDrafts([draft({ material_basis: '' })]), /请选择/);
  assert.match(validateDrafts([draft({ material_basis: 'authorized' })]), /授权说明/);
  assert.equal(validateDrafts([draft({ material_basis: 'authorized', authorization_note: '提供者授权本次演示' })]), null);
});

test('batch and project limits prevent losing partially accepted imports', () => {
  assert.match(validateDrafts([]), /1–5/);
  assert.match(validateDrafts(Array.from({ length: 6 }, () => draft())), /1–5/);
  assert.match(validateDrafts([draft()], Array.from({ length: 10 }, () => draft())), /10/);
  assert.match(validateDrafts([draft({ content: '中'.repeat(20000) })], Array.from({ length: 3 }, () => draft({ content: '中'.repeat(20000) }))), /60,000/);
});

test('a corrupted or unavailable store is surfaced rather than overwritten', () => {
  const invalid = { getItem: () => '{invalid json' };
  assert.ok(readDrafts(invalid).error);
  assert.ok(readDrafts({ getItem: () => '[{"title":"missing content"}]' }).error);
  assert.match(saveDrafts({ setItem() { throw new Error('Quota exceeded'); } }, [draft()]), /无法保存/);
  let saved;
  assert.equal(saveDrafts({ setItem(key, value) { saved = value; } }, [draft()]), null);
  assert.equal(readDrafts({ getItem: () => saved }).records[0].content, draft().content);
});

test('all synthetic evidence points to exact unmodified record text', () => {
  for (const evidence of demoOverview.evidence) {
    const record = demoRecords.find(item => item.id === evidence.record_id);
    assert.ok(record, evidence.id);
    const segment = record.segments.find(item => item.id === evidence.segment_id);
    assert.ok(segment && segment.text.includes(evidence.quote), evidence.id);
    assert.ok(record.content.includes(evidence.quote), evidence.id);
    assert.ok(record.participants.some(person => person.id === evidence.speaker_id));
  }
  for (const insight of demoOverview.insights) {
    assert.ok(insight.judgment.evidence_ids.every(id => demoOverview.evidence.some(item => item.id === id)));
    const evidence = demoOverview.evidence.filter(item => insight.judgment.evidence_ids.includes(item.id));
    assert.equal(insight.coverage.unique_speakers, new Set(evidence.map(item => item.speaker_id)).size);
    assert.equal(insight.coverage.supporting_record_count, new Set(evidence.map(item => item.record_id)).size);
  }
  assert.deepEqual(demoOverview.dimensions.map(item => item.key), DIMENSIONS.map(([key]) => key));
  assert.equal(demoOverview.engine_mode, 'mock');
  assert.equal(demoOverview.pending_confirmation_count, demoOverview.insights.filter(item => item.dispute_status === 'open').length);
});

test('demo state cannot be changed by a caller and filters use explicit classifications', () => {
  const overview = getDemoOverview(); overview.project.name = 'edited';
  assert.notEqual(demoOverview.project.name, 'edited');
  assert.deepEqual(filterInsights(demoOverview.insights, '', 'changed').map(item => item.id), ['ins_01', 'ins_05']);
  assert.equal(filterInsights(demoOverview.insights, '', 'disputed').length, 1);
  assert.equal(filterInsights(demoOverview.insights, '审批').length, 1);
  assert.equal(filterInsights(demoOverview.insights, 'nothing matches').length, 0);
});

test('HTTP adapter preserves explicit retry key, version and encoded resource IDs', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ data: { id: 'job_1' }, request_id: 'req_1' }) };
  };
  try {
    const api = createApiClient();
    await assert.rejects(api.analyze('prj', { record_ids: ['rec_1'], expected_version: 0 }), /幂等/);
    assert.equal(calls.length, 0);
    const body = { record_ids: ['rec_1'], expected_version: 0 };
    await api.analyze('prj', body, 'stable-key');
    await api.analyze('prj', body, 'stable-key');
    assert.equal(calls[0].options.headers['Idempotency-Key'], calls[1].options.headers['Idempotency-Key']);
    assert.deepEqual(JSON.parse(calls[0].options.body), body);
    await api.insight('project/id', 'ins id', 2);
    assert.equal(calls[2].url.pathname, '/api/v1/projects/project%2Fid/insights/ins%20id');
    assert.equal(calls[2].url.searchParams.get('version'), '2');
  } finally { globalThis.fetch = originalFetch; }
});

test('HTTP adapter exposes version conflict instead of treating it as success', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 409, json: async () => ({ error: { code: 'VERSION_CONFLICT', message: '请刷新后重试', retryable: false, details: { current_version: 3 } }, request_id: 'req_conflict' }) });
  try {
    await assert.rejects(createApiClient().overview('prj'), error => error instanceof ApiError && error.code === 'VERSION_CONFLICT' && error.requestId === 'req_conflict' && error.status === 409 && error.details.current_version === 3 && error.retryable === false);
  } finally { globalThis.fetch = originalFetch; }
});
