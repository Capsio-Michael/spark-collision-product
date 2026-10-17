import test from 'node:test';
import assert from 'node:assert/strict';
import { insightMetrics, renderInsightMetrics } from '../src/insight-metrics.js';
import { getDemoOverview } from '../src/fixtures/demo.js';
import { getDemoInsightDetail } from '../src/fixtures/insight-details.js';
import { renderProjectInsights } from '../src/overview-view.js';
import { renderDetailAnalysis } from '../src/insight-detail.js';
import { buildSyntheticReport } from '../src/fixtures/export.js';

const main = (version = 3) => getDemoOverview(version).insights.find(item => item.id === 'ins_quote_boundary');

test('meeting coverage grows after M4 while capped score, conditions and no-new-insight stay separate', () => {
  const models = [1, 2, 3].map(version => insightMetrics(main(version)));
  assert.deepEqual(models.map(item => item.meetings.value), ['2 / 2 场', '3 / 3 场', '4 / 4 场']);
  assert.deepEqual(models.map(item => item.priority.value), ['4 / 5', '5 / 5', '5 / 5']);
  assert.deepEqual(models.map(item => item.convergence.value), ['条件待核实', '有条件趋同', '有条件趋同']);
  assert.equal(getDemoOverview(3).outcome, 'no_new_insight');
  assert.deepEqual(models[2].conditions, ['无折扣目录价', '跨区或特殊折扣报价']);
  assert.deepEqual(models[2].priority.parts.map(item => item.points), [3, 1, 1]);
});

test('counts of files, speakers and collision participants never substitute for missing meeting metadata', () => {
  const item = main(); delete item.meeting_coverage; delete item.importance; delete item.convergence_status;
  item.coverage.supporting_record_count = 9; item.coverage.unique_speakers = 99;
  const model = insightMetrics(item);
  assert.equal(model.meetings.value, '场次待补齐'); assert.equal(model.priority.value, '评分待解释');
  assert.equal(model.convergence.value, '趋同待判断');
  item.meeting_coverage = { distinct_meeting_count: 1, total_meeting_count: 1, meeting_ids: ['one_meeting'] };
  assert.equal(insightMetrics(item).meetings.value, '1 / 1 场');
});

test('invalid meeting counters and duplicated identities are rejected independently of other metrics', () => {
  for (const mutate of [
    value => { value.distinct_meeting_count = 5; },
    value => { value.distinct_meeting_count = '4'; },
    value => { value.total_meeting_count = -1; },
    value => { value.meeting_ids[1] = value.meeting_ids[0]; },
    value => { value.meeting_ids.pop(); },
    value => { value.meeting_ids[0] = ''; },
  ]) {
    const item = main(); mutate(item.meeting_coverage);
    const model = insightMetrics(item); assert.equal(model.meetings.value, '场次待补齐');
    assert.equal(model.convergence.value, '有条件趋同');
  }
});

test('unknown rules, impossible scores and mismatched raw counts cannot create a misleading number', () => {
  for (const mutate of [
    value => { value.rule_version = 'future-rule'; },
    value => { value.score = 4; },
    value => { value.score = 6; },
    value => { value.max_score = 10; },
    value => { value.parts.distinct_meetings = 4; },
    value => { value.parts.documented_business_choice = -1; },
    value => { value.raw_counts.distinct_meetings = 3; },
    value => { value.raw_counts.independent_speakers = null; },
    value => { delete value.parts; },
  ]) {
    const item = main(); mutate(item.importance);
    const model = insightMetrics(item); assert.equal(model.priority.value, '评分待解释');
    assert.equal(model.meetings.value, '4 / 4 场'); assert.equal(model.convergence.value, '有条件趋同');
  }
});

test('zero scores and unknown identities do not turn into a missing score or invented consensus', () => {
  const item = main(); item.meeting_coverage = { distinct_meeting_count: 0, total_meeting_count: 4, meeting_ids: [] };
  item.importance = { rule_version: 'demo-0.1', score: 0, max_score: 5,
    parts: { distinct_meetings: 0, independent_speakers: 0, documented_business_choice: 0 },
    raw_counts: { distinct_meetings: 0, independent_speakers: null } };
  item.convergence_status = 'new_future_status';
  const model = insightMetrics(item);
  assert.equal(model.priority.value, '0 / 5'); assert.equal(model.meetings.value, '0 / 4 场');
  assert.equal(model.priority.parts[1].basis, '身份未知'); assert.equal(model.convergence.value, '趋同待判断');
  for (const value of [null, undefined, {}, { importance: 'bad', meeting_coverage: [], convergence_status: false }]) assert.doesNotThrow(() => insightMetrics(value));
  item.convergence_status = ['conditional_convergence'];
  assert.equal(insightMetrics(item).convergence.value, '趋同待判断');
});

test('low-frequency approval wait stays visible and is not labeled low business importance', () => {
  const item = getDemoOverview(3).insights.find(item => item.id === 'ins_approval_wait');
  const model = insightMetrics(item);
  assert.equal(model.meetings.value, '1 / 4 场'); assert.equal(model.priority.value, '1 / 5');
  assert.equal(model.convergence.value, '证据不足');
  const html = renderProjectInsights(getDemoOverview());
  assert.ok(html.includes(item.title) && html.includes(item.attention_flag));
  assert.ok(!renderInsightMetrics(item).includes('低重要性'));
});

test('overview and detail share metric interpretation, escaped conditions and expandable scoring reasons', () => {
  const detail = getDemoInsightDetail('ins_quote_boundary');
  for (const html of [renderProjectInsights(getDemoOverview()), renderDetailAnalysis(detail)]) {
    for (const value of ['会议覆盖', '重要性 · 演示评分', '趋同程度', '4 / 4 场', '5 / 5', '有条件趋同', '查看指标说明与适用条件']) assert.ok(html.includes(value));
  }
  detail.judgment.conditions = ['<img src=x onerror=alert(1)>'];
  detail.meeting_coverage.meeting_ids[0] = '<svg/onload=alert(1)>';
  const html = renderInsightMetrics(detail);
  assert.ok(!html.includes('<img') && !html.includes('<svg')); assert.ok(html.includes('&lt;img'));
});

test('synthetic export retains the selected snapshot metrics and uncertainty labels', async () => {
  for (const [version, coverage, score, status] of [[1, '2 / 2 场', '4 / 5', '条件待核实'], [2, '3 / 3 场', '5 / 5', '有条件趋同'], [3, '4 / 4 场', '5 / 5', '有条件趋同']]) {
    const { text } = await buildSyntheticReport(version);
    for (const value of [coverage, score, status, '演示规则 demo-0.1', '不是概率、证据充分度或多数票']) assert.ok(text.includes(value));
  }
});
