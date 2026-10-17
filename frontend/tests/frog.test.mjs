import test from 'node:test';
import assert from 'node:assert/strict';
import { frogPresentation, frogPreferences } from '../src/frog-model.js';
const context = { workspace: 'own', connected: true, engineMode: 'mock', projectId: 'p1', hasMaterials: true };
const success = { ...context, lastJob: { status: 'succeeded', project_id: 'p1', result_version: 2 }, overview: { project: { id: 'p1' }, snapshot_version: 2, outcome: 'updated', changes: [{ is_breakthrough: true }] } };

test('independent Kimi results show completion without a fabricated project job or breakthrough', () => {
  const model = frogPresentation({ ...context, agentResult: { outcome: 'updated' } });
  assert.equal(model.state, 'complete'); assert.match(model.label, /分析结果已读取/); assert.equal(model.animate, false);
  assert.doesNotMatch(model.label, /模拟服务/);
  assert.equal(frogPresentation({ ...context, agentAnalyzing: true }).state, 'reading');
  assert.equal(frogPresentation({ ...context, connected: false, agentResult: {} }).state, 'reading');
});

test('preset examples never claim a job is running or completed', () => {
  for (const workspace of ['design', 'demo']) {
    const model = frogPresentation({ ...success, workspace, activeJob: { status: 'running' } });
    assert.equal(model.state, 'reading'); assert.equal(model.animate, false);
    assert.match(model.label, /预置内容/);
  }
});
test('only acknowledged queued/running jobs show thinking; errors and offline caches stay quiet', () => {
  assert.equal(frogPresentation({ ...context }).state, 'reading');
  for (const status of ['queued', 'running']) assert.equal(frogPresentation({ ...context, activeJob: { status } }).state, 'thinking');
  assert.equal(frogPresentation({ ...success, connected: false }).animate, false);
  const model = frogPresentation({ ...context, activeJob: { status: 'running' }, error: '查询失败' });
  assert.equal(model.state, 'reading'); assert.match(model.label, /查询中断/);
});
test('spark requires completed job, matching project/version and actual breakthrough', () => {
  assert.equal(frogPresentation(success).state, 'spark');
  assert.match(frogPresentation(success).label, /模拟服务/);
  for (const patch of [{ lastJob: { ...success.lastJob, result_version: 1 } }, { projectId: 'p2' }, { lastJob: null }]) {
    assert.equal(frogPresentation({ ...success, ...patch }).state, 'reading');
  }
  assert.equal(frogPresentation({ ...success, activeJob: { status: 'succeeded' } }).state, 'reading');
});
test('no-new-insight never plays spark, even with a stale breakthrough flag', () => {
  const model = frogPresentation({ ...success, overview: { ...success.overview, outcome: 'no_new_insight' } });
  assert.equal(model.state, 'complete'); assert.equal(model.animate, false); assert.match(model.label, /无新火花/);
  assert.equal(frogPresentation({ ...success, overview: { ...success.overview, changes: [] } }).state, 'complete');
  assert.equal(frogPresentation({ ...success, lastJob: { status: 'failed' } }).state, 'reading');
});
test('appearance preferences tolerate corrupt or unavailable storage without executing values', () => {
  assert.deepEqual(frogPreferences({ getItem: () => '{broken' }), { style: 'round', palette: 'lime' });
  assert.deepEqual(frogPreferences({ getItem() { throw Error(); } }), { style: 'round', palette: 'lime' });
  assert.deepEqual(frogPreferences({ getItem: () => '{"style":"pixel","palette":"sky"}' }), { style: 'pixel', palette: 'sky' });
  assert.deepEqual(frogPreferences({ getItem: () => '{"style":"constructor","palette":"<script>"}' }), { style: 'round', palette: 'lime' });
});
