import test from 'node:test';
import assert from 'node:assert/strict';
import { HistorySession, comparisonKind, historyFields, sortVersions, defaultPair } from '../src/history-model.js';
import { demoHistorySource } from '../src/fixtures/history.js';

const version = (number, changes = []) => ({ version: number, parent_version: number - 1, created_at: `2026-10-17T12:0${number}:00+08:00`, cause: 'analysis', job_id: `job_${number}`, correction_id: null, source_record_ids: ['record'], outcome: 'updated', summary: '', changes, actor_label: null, correction_reason: null });
const judgment = (text = '标准问题可尝试自动回复', overrides = {}) => ({ id: 'judgment_1', text, epistemic_type: 'inference', fact_basis: null, review_status: 'confirmed', conditions: ['识别风险'], evidence_ids: ['ev1'], rationale: '需要先明确业务风险', alternative_explanations: ['也可能由规则处理'], evidence_gaps: ['缺少误判数据'], ...overrides });
const evidence = { id: 'ev1', label: 'E01', record_id: 'record', segment_id: 'paragraph', quote: '报价需要人工确认。' };
const detail = (number, overrides = {}) => ({ id: 'insight', title: '客服自动化边界', judgment: judgment(), dispute_status: 'none', snapshot_version: number, evidence: [evidence], candidate_judgment: null, ...overrides });
const change = (id = 'insight', ids = ['ev1']) => ({ insight_id: id, type: 'qualified', reason: '合成记录中的条件变化', evidence_ids: ids, is_breakthrough: false });
const overview = (number, details = [detail(number)]) => ({ project: { id: 'project', current_version: 3 }, snapshot_version: number, insights: details, changes: [change()], source_record_ids: ['record'] });
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

test('default comparison selects the latest and previous numeric versions without mutating history', () => {
  const input = [version(1), version(3), version(2)];
  assert.deepEqual(sortVersions(input).map(item => item.version), [3, 2, 1]);
  assert.deepEqual(input.map(item => item.version), [1, 3, 2]);
  assert.deepEqual(defaultPair(input), { from: 2, to: 3 });
  assert.deepEqual(defaultPair(input, 1), { from: null, to: 1 });
  assert.deepEqual(defaultPair([]), { from: null, to: null });
  assert.throws(() => sortVersions([version(1), version(1)]), /版本列表/);
  assert.throws(() => sortVersions([{ ...version(1), parent_version: '<img src=x>' }]), /版本列表/);
});

test('evidence-only support is distinct from changed judgments; list order is immaterial', () => {
  const before = detail(1); const supported = detail(2, { judgment: judgment(undefined, { evidence_ids: ['ev1', 'ev2'] }) });
  assert.equal(comparisonKind(before, supported), 'evidence_only');
  const reordered = detail(2, { judgment: judgment(undefined, { conditions: ['B', 'A'] }) });
  const original = detail(1, { judgment: judgment(undefined, { conditions: ['A', 'B'] }) });
  assert.equal(comparisonKind(original, reordered), 'unchanged');
  assert.equal(comparisonKind(null, before), 'new');
  assert.equal(comparisonKind(before, null), 'absent_later');
});

test('unaccepted candidates do not replace a confirmed current judgment or change its type', () => {
  const before = detail(1);
  const candidate = judgment('报价审批等待可能是第一约束', { id: 'candidate', epistemic_type: 'hypothesis', review_status: 'unreviewed' });
  const after = detail(2, { dispute_status: 'open', candidate_judgment: candidate });
  const fields = historyFields(before, after);
  assert.equal(fields.find(item => item.key === 'statement').changed, false);
  assert.equal(fields.find(item => item.key === 'review_status').changed, false);
  assert.equal(fields.find(item => item.key === 'candidate').changed, true);
  assert.equal(comparisonKind(before, after), 'candidate_only');
  assert.equal(after.judgment.text, before.judgment.text);
  assert.equal(after.judgment.review_status, 'confirmed');
});

test('synthetic history matches homepage v2 and never lends future evidence to v1', async () => {
  const session = new HistorySession(demoHistorySource);
  await session.start();
  assert.equal(session.state.status, 'ready'); assert.equal(session.state.from, 1); assert.equal(session.state.to, 2);
  assert.equal(session.state.insightId, 'ins_01'); assert.equal(session.state.left.judgment.epistemic_type, 'opinion');
  assert.equal(session.state.right.judgment.epistemic_type, 'inference');
  await assert.rejects(session.evidence('ev_04', 1), /该版本未提供/);
  const source = await session.evidence('ev_01', 1);
  assert.equal(source.version, 1); assert.equal(source.record.id, 'rec_01');
  await session.selectInsight('ins_03');
  assert.equal(session.state.left, null); assert.equal(session.state.right.id, 'ins_03'); assert.equal(session.state.kind, 'new');
  await session.selectTo(1); assert.equal(session.state.from, null); assert.equal(session.state.to, 1);
});

test('comparison across nonadjacent versions preserves every intermediate change and correction reason', async () => {
  const versions = [version(3, [{ ...change(), type: 'revised' }]), version(2, [change()]), version(1, [change()])];
  versions[1].cause = 'correction'; versions[1].actor_label = '合成操作者'; versions[1].correction_reason = '修正业务条件';
  const session = new HistorySession({ projectId: 'project', loadVersions: async () => ({ items: versions }), loadOverview: async v => overview(v), loadDetail: async (id, v) => detail(v), loadRecord: async () => ({}) });
  await session.start(); await session.selectPair(1, 3);
  assert.deepEqual(session.state.events.map(item => item.version), [2, 3]);
  assert.equal(session.state.events[0].correction_reason, '修正业务条件');
  assert.equal(session.state.events[0].actor_label, '合成操作者');
});

test('a missing insight is an empty historical side, but unavailable services remain errors', async () => {
  let fail = true;
  const session = new HistorySession({ projectId: 'project', loadVersions: async () => ({ items: [version(2), version(1)] }), loadOverview: async v => overview(v), loadDetail: async (id, v) => { if (v === 1) throw Object.assign(new Error('unknown'), { code: fail ? 'NETWORK_ERROR' : 'INSIGHT_NOT_FOUND_AT_VERSION' }); return detail(v); }, loadRecord: async () => ({}) });
  await session.start(); assert.equal(session.state.status, 'error');
  fail = false; await session.selectPair(1, 2);
  assert.equal(session.state.status, 'ready'); assert.equal(session.state.left, null); assert.equal(session.state.kind, 'new');
});

test('wrong snapshot, detail version or project is rejected rather than mixed into comparison', async () => {
  const session = new HistorySession({ projectId: 'project', loadVersions: async () => ({ items: [version(2), version(1)] }), loadOverview: async v => overview(v === 1 ? 2 : v), loadDetail: async (id, v) => detail(v), loadRecord: async () => ({}) });
  await session.start(); assert.equal(session.state.status, 'error'); assert.match(session.state.error, /版本或项目不匹配/);
  const wrongDetail = new HistorySession({ projectId: 'project', loadVersions: async () => ({ items: [version(1)] }), loadOverview: async v => overview(v), loadDetail: async () => detail(99), loadRecord: async () => ({}) });
  await wrongDetail.start(); assert.equal(wrongDetail.state.status, 'error'); assert.match(wrongDetail.state.error, /详情与所选历史版本/);
});

test('out-of-order detail responses cannot overwrite a more recent selection', async () => {
  const wait = deferred(); let slow = false, signalStarted;
  const started = new Promise(resolve => { signalStarted = resolve; });
  const items = [detail(1), detail(1, { id: 'other', title: '另一个问题' })];
  const session = new HistorySession({ projectId: 'project', loadVersions: async () => ({ items: [version(1)] }), loadOverview: async v => overview(v, items), loadDetail: async (id, v) => { if (id === 'other' && slow) { signalStarted(); await wait.promise; } return detail(v, { id }); }, loadRecord: async () => ({}) });
  await session.start(); slow = true;
  const oldSelection = session.selectInsight('other'); await started;
  await session.selectInsight('insight'); wait.resolve(); await oldSelection;
  assert.equal(session.state.insightId, 'insight'); assert.equal(session.state.right.id, 'insight');
});

test('empty histories and closed sessions do not fabricate versions or publish late data', async () => {
  const empty = new HistorySession({ projectId: 'project', loadVersions: async () => ({ items: [] }) });
  await empty.start(); assert.equal(empty.state.status, 'empty'); assert.equal(empty.state.to, null);
  const waiting = deferred(); let updates = 0;
  const closed = new HistorySession({ projectId: 'project', loadVersions: async () => waiting.promise, onChange: () => updates++ });
  const pending = closed.start(); closed.close(); const count = updates;
  waiting.resolve({ items: [version(1)] }); await pending;
  assert.equal(updates, count);
});

test('unchanged snapshots remain unchanged and quote mismatches cannot produce a highlight', async () => {
  const versions = [version(2), version(1)]; versions[0].outcome = 'no_new_insight';
  const session = new HistorySession({ projectId: 'project', loadVersions: async () => ({ items: versions }), loadOverview: async v => overview(v), loadDetail: async (id, v) => detail(v), loadRecord: async () => ({ id: 'record', segments: [{ id: 'paragraph', text: '这段文字没有对应的引文。' }] }) });
  await session.start(); assert.equal(session.state.kind, 'unchanged');
  assert.ok(session.state.fields.every(item => !item.changed));
  await assert.rejects(session.evidence('ev1', 1), /引用与原文不匹配/);
});
