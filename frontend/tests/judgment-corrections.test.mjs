import test from 'node:test';
import assert from 'node:assert/strict';
import { getDemoInsightDetail } from '../src/fixtures/insight-details.js';
import { CORRECTION_LABELS, CorrectionController, CorrectionJournal, correctionActions, initialCorrectionValues, buildCorrection } from '../src/judgment-corrections-model.js';
import { renderCorrectionPanel } from '../src/judgment-corrections.js';

function memoryStorage() {
  const items = new Map(); return { getItem: key => items.get(key) || null, setItem: (key, value) => items.set(key, value) };
}
const values = detail => ({ ...initialCorrectionValues(detail), actor_label: '演示操作者', reason: '已核查材料，保留当前适用条件。', reviewed: true });
const receipt = body => ({ id: 'correction_01', insight_id: body.insight_id, action: body.action, actor_label: body.actor_label, reason: body.reason,
  previous_version: body.expected_version, result_version: body.expected_version + 1, created_at: '2026-10-17T15:00:00+08:00' });
const serverError = (code, status = 409) => Object.assign(new Error(code), { code, status });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function setup(overrides = {}) {
  const storage = overrides.storage || memoryStorage(); const journal = new CorrectionJournal(storage, 'test-project');
  const detail = getDemoInsightDetail('ins_01'); const calls = []; const synced = [];
  const updated = structuredClone(detail); updated.snapshot_version = 3; updated.judgment.review_status = 'confirmed';
  const controller = new CorrectionController({ insightId: detail.id, journal, getCurrentVersion: () => 2, makeKey: () => 'original-key',
    send: async (body, key) => { calls.push({ body: structuredClone(body), key }); return receipt(body); },
    refreshLatest: async () => ({ detail: updated, currentVersion: 3 }), onSynced: result => synced.push(result), ...overrides });
  return { storage, journal, detail, updated, controller, calls, synced };
}

test('available operations follow confirmed state and unresolved candidate boundaries', () => {
  const detail = getDemoInsightDetail('ins_01');
  assert.deepEqual(correctionActions(detail), ['confirm_current', 'edit_current']);
  detail.judgment.review_status = 'confirmed'; assert.deepEqual(correctionActions(detail), ['edit_current']);
  const disputed = getDemoInsightDetail('ins_02');
  assert.deepEqual(correctionActions(disputed), ['accept_candidate', 'reject_candidate']);
  assert.throws(() => buildCorrection(disputed, 'confirm_current', values(disputed)), /状态不支持/);
  disputed.candidate_judgment = null; assert.deepEqual(correctionActions(disputed), []);
});

test('all correction bodies pin version and IDs without allowing arbitrary system fields', () => {
  for (const action of ['confirm_current', 'accept_candidate', 'reject_candidate']) {
    const detail = getDemoInsightDetail(action === 'confirm_current' ? 'ins_01' : 'ins_02');
    const body = buildCorrection(detail, action, values(detail));
    assert.equal(body.expected_version, 2); assert.equal(body.expected_judgment_id, detail.judgment.id);
    assert.equal(body.replacement, null); assert.equal(body.candidate_judgment_id, action === 'confirm_current' ? null : detail.candidate_judgment.id);
    assert.ok(!Object.hasOwn(body, 'approved') && !Object.hasOwn(body, 'review_status'));
  }
});

test('edited judgments preserve evidence, explicitly classify statements, and require explanations', () => {
  const detail = getDemoInsightDetail('ins_01');
  const fields = { ...values(detail), text: '标准问题先小范围验证，报价保留人工确认。', conditions: '先核查风险\n先核查风险', epistemic_type: 'hypothesis' };
  const body = buildCorrection(detail, 'edit_current', fields);
  assert.deepEqual(body.replacement.evidence_ids, detail.judgment.evidence_ids);
  assert.deepEqual(body.replacement.conditions, ['先核查风险']); assert.equal(body.replacement.fact_basis, null);
  assert.ok(!Object.hasOwn(body.replacement, 'id') && !Object.hasOwn(body.replacement, 'review_status'));
  assert.throws(() => buildCorrection(detail, 'edit_current', { ...fields, alternative_explanations: '', evidence_gaps: '' }), /其他解释/);
});

test('editing never inherits corroboration or silently promotes inference to verified fact', () => {
  const detail = getDemoInsightDetail('ins_01'); const fields = { ...values(detail), text: '材料明确提出报价需要人工确认。', epistemic_type: 'fact' };
  assert.throws(() => buildCorrection(detail, 'edit_current', fields), /事实依据/);
  assert.throws(() => buildCorrection(detail, 'edit_current', { ...fields, fact_basis: 'recorded_statement' }), /材料依据一致/);
  const body = buildCorrection(detail, 'edit_current', { ...fields, fact_basis: 'recorded_statement', fact_acknowledged: true });
  assert.equal(body.replacement.fact_basis, 'recorded_statement');
  assert.throws(() => buildCorrection(detail, 'edit_current', { ...fields, fact_basis: 'corroborated', fact_acknowledged: true }), /事实依据/);
});

test('successful saves apply only acknowledged server snapshots and clear the pending request', async () => {
  const app = setup(); const before = structuredClone(app.detail);
  await app.controller.submit(app.detail, 'confirm_current', values(app.detail));
  assert.equal(app.calls.length, 1); assert.equal(app.synced[0].detail.snapshot_version, 3);
  assert.equal(app.controller.state.status, 'saved'); assert.equal(app.journal.read().pending, null);
  assert.deepEqual(app.detail, before); // No optimistic mutation.
});

test('required reason, acknowledgement, stale versions and read-only views prevent writes', async () => {
  for (const overrides of [{ getCurrentVersion: () => 3 }, { isReadOnly: () => true }, { isBusy: () => true }]) {
    const app = setup(overrides);
    await assert.rejects(app.controller.submit(app.detail, 'confirm_current', values(app.detail)));
    assert.equal(app.calls.length, 0);
  }
  const app = setup();
  await assert.rejects(app.controller.submit(app.detail, 'confirm_current', { ...values(app.detail), reason: '' }), /操作理由/);
  await assert.rejects(app.controller.submit(app.detail, 'confirm_current', { ...values(app.detail), reviewed: false }), /勾选/);
  assert.equal(app.calls.length, 0);
});

test('saving recovery information must succeed before any network mutation', async () => {
  const app = setup({ storage: { getItem: () => null, setItem() { throw new Error('Quota'); } } });
  await assert.rejects(app.controller.submit(app.detail, 'confirm_current', values(app.detail)), /恢复记录/);
  assert.equal(app.calls.length, 0);
});

test('double clicks cannot create a second operation while the first is pending', async () => {
  const waiting = deferred(); let writes = 0;
  const app = setup({ send: async body => { writes++; await waiting.promise; return receipt(body); } });
  const first = app.controller.submit(app.detail, 'confirm_current', values(app.detail));
  await assert.rejects(app.controller.submit(app.detail, 'confirm_current', values(app.detail)), /勿重复/);
  assert.equal(writes, 1); waiting.resolve(); await first;
});

test('lost responses survive reload and resume using the identical body and idempotency key', async () => {
  let original;
  const app = setup({ send: async (body, key) => { original = { body: structuredClone(body), key }; throw serverError('NETWORK_ERROR', 0); } });
  await assert.rejects(app.controller.submit(app.detail, 'confirm_current', values(app.detail)));
  assert.equal(app.controller.state.status, 'uncertain'); assert.equal(app.synced.length, 0);
  const recovered = setup({ storage: app.storage });
  assert.equal(recovered.controller.state.status, 'uncertain'); await recovered.controller.resume();
  assert.deepEqual(recovered.calls[0], original); assert.equal(recovered.controller.state.status, 'saved');
});

test('an acknowledged save with failed refresh retries GET synchronization without another POST', async () => {
  let failRefresh = true;
  const app = setup({ refreshLatest: async () => { if (failRefresh) throw new Error('GET timeout'); return { detail: app.updated, currentVersion: 3 }; } });
  await assert.rejects(app.controller.submit(app.detail, 'confirm_current', values(app.detail)));
  assert.equal(app.controller.state.status, 'sync_error'); assert.equal(app.calls.length, 1);
  failRefresh = false; await app.controller.resume();
  assert.equal(app.calls.length, 1); assert.equal(app.controller.state.status, 'saved');
});

test('version conflicts preserve drafts, reject automatic rebasing and allow explicit latest-read', async () => {
  const app = setup({ send: async () => { throw serverError('VERSION_CONFLICT'); } });
  const draft = { action: 'edit_current', base_version: 2, values: values(app.detail) };
  app.controller.saveDraft(draft);
  await assert.rejects(app.controller.submit(app.detail, 'confirm_current', values(app.detail)));
  assert.equal(app.controller.state.status, 'stale'); assert.equal(app.journal.read().pending, null);
  assert.deepEqual(app.journal.read().drafts[app.detail.id], draft);
  await app.controller.reloadLatest();
  assert.equal(app.synced.length, 1); assert.equal(app.controller.state.status, 'reloaded');
  assert.deepEqual(app.journal.read().drafts[app.detail.id], draft);
});

test('invalid acknowledgement or stale refresh never displays a successful save', async () => {
  const badReceipt = setup({ send: async body => ({ ...receipt(body), result_version: 9 }) });
  await assert.rejects(badReceipt.controller.submit(badReceipt.detail, 'confirm_current', values(badReceipt.detail)));
  assert.equal(badReceipt.controller.state.status, 'uncertain'); assert.equal(badReceipt.synced.length, 0);
  const badRead = setup({ refreshLatest: async () => ({ detail: getDemoInsightDetail('ins_01'), currentVersion: 2 }) });
  await assert.rejects(badRead.controller.submit(badRead.detail, 'confirm_current', values(badRead.detail)));
  assert.equal(badRead.controller.state.status, 'sync_error'); assert.equal(badRead.synced.length, 0);
});

test('a second insight cannot replace a project pending operation', async () => {
  const app = setup({ send: async () => { throw new Error('Network disconnected'); } });
  await assert.rejects(app.controller.submit(app.detail, 'confirm_current', values(app.detail)));
  const another = setup({ storage: app.storage, insightId: 'ins_03' });
  assert.equal(another.controller.state.status, 'other_pending');
  const detail = getDemoInsightDetail('ins_03');
  await assert.rejects(another.controller.submit(detail, 'confirm_current', values(detail)));
  assert.equal(another.calls.length, 0); assert.equal(app.journal.read().pending.body.insight_id, 'ins_01');
});

test('history remains read-only and synthetic form preview cannot submit real saves', () => {
  const detail = getDemoInsightDetail('ins_01');
  const history = renderCorrectionPanel(detail, { readOnly: true, enabled: true, currentVersion: 2 });
  assert.ok(history.includes('历史详情只读')); assert.ok(!history.includes('data-jc-action'));
  const form = { action: 'confirm_current', baseVersion: 2, values: values(detail) };
  const preview = renderCorrectionPanel(detail, { preview: true }, {}, form);
  assert.ok(preview.includes('示例预览，不提交保存')); assert.match(preview, /type="submit"[^>]*disabled/);
});

test('forms escape imported judgments and user reasons and retain submitted request fields', () => {
  const detail = getDemoInsightDetail('ins_01'); const attack = '<img src=x onerror=alert(1)>';
  detail.judgment.text = attack;
  const form = { action: 'edit_current', baseVersion: 2, values: { ...values(detail), reason: attack } };
  const html = renderCorrectionPanel(detail, { enabled: true, currentVersion: 2 }, {}, form);
  assert.ok(!html.includes(attack)); assert.ok(html.includes('&lt;img'));
  assert.ok(Object.values(CORRECTION_LABELS).length === 4);
});

test('candidate acceptance and rejection use server state and retain their distinct review semantics', async () => {
  for (const action of ['accept_candidate', 'reject_candidate']) {
    const detail = getDemoInsightDetail('ins_02'); const updated = structuredClone(detail);
    updated.snapshot_version = 3; updated.dispute_status = 'none'; updated.candidate_judgment = null;
    if (action === 'accept_candidate') updated.judgment = { ...detail.candidate_judgment, review_status: 'confirmed' };
    const journal = new CorrectionJournal(memoryStorage(), action);
    const controller = new CorrectionController({ insightId: detail.id, journal, getCurrentVersion: () => 2,
      send: async body => receipt(body), refreshLatest: async () => ({ detail: updated, currentVersion: 3 }) });
    await controller.submit(detail, action, values(detail));
    assert.equal(controller.state.status, 'saved');
    assert.equal(updated.judgment.review_status, action === 'accept_candidate' ? 'confirmed' : 'unreviewed');
  }
});

test('a receipt without a matching applied judgment does not publish a successful UI state', async () => {
  const app = setup(); app.updated.judgment.review_status = 'unreviewed';
  await assert.rejects(app.controller.submit(app.detail, 'confirm_current', values(app.detail)), /状态不一致/);
  assert.equal(app.controller.state.status, 'sync_error'); assert.equal(app.synced.length, 0);
});

test('corrupt persisted acknowledgements are blocked before a recovery write', () => {
  const app = setup();
  const body = buildCorrection(app.detail, 'confirm_current', values(app.detail));
  app.storage.setItem(app.journal.key, JSON.stringify({ schema_version: 1, drafts: {}, actor_label: '', pending: { key: 'key', body, receipt: { ...receipt(body), result_version: 90 } } }));
  const controller = setup({ storage: app.storage }).controller;
  assert.equal(controller.state.status, 'blocked'); assert.equal(controller.state.receipt, null);
});
