import test from 'node:test';
import assert from 'node:assert/strict';
import { sparkView } from '../src/spark-model.js';
import { renderSparkCard, renderSparkPath } from '../src/spark-view.js';
import { filterInsights } from '../src/core.js';
import { filterProjectInsights } from '../src/overview-model.js';
import { renderProjectOverview } from '../src/overview-view.js';
import { getDemoOverview, demoRecords } from '../src/fixtures/demo.js';
import { getDemoInsightDetail } from '../src/fixtures/insight-details.js';
import { demoHistorySource } from '../src/fixtures/history.js';

const single = () => getDemoInsightDetail('ins_05');
const cross = () => getDemoInsightDetail('ins_01');
const view = detail => sparkView(detail, detail.evidence, detail.snapshot_version);

test('synthetic origin events resolve to conversation materials and exact source evidence', () => {
  for (const id of ['ins_01', 'ins_05']) {
    const detail = getDemoInsightDetail(id), result = view(detail);
    assert.notEqual(result.kind, 'unknown');
    for (const event of result.events) for (const contribution of event.contributions) for (const id of contribution.evidence_ids) {
      const evidence = detail.evidence.find(item => item.id === id);
      const record = demoRecords.find(item => item.id === evidence.record_id);
      assert.ok(record.segments.some(segment => segment.id === evidence.segment_id && segment.text.includes(evidence.quote)));
      assert.ok(result.conversations.find(item => item.id === contribution.conversation_id).record_ids.includes(record.id));
    }
  }
});

test('one conversation with multiple material files remains orange', () => {
  const detail = single(); detail.spark.conversations[0].record_ids.push('rec_extra_whiteboard');
  detail.coverage.supporting_record_count = 9;
  assert.equal(view(detail).kind, 'single'); assert.equal(view(detail).conversationCount, 1);
  assert.match(renderSparkCard(detail, detail.evidence, 2), /sp-single/);
});

test('cross collision retains its single origin and corroboration does not add collision participants', () => {
  const detail = cross(), result = view(detail);
  assert.equal(result.kind, 'cross'); assert.equal(result.conversationCount, 2); assert.equal(result.evidenceCount, 2);
  assert.equal(result.conversations.length, 3); assert.equal(result.latest.kind, 'corroboration');
  const html = renderSparkPath(detail);
  assert.match(html, /sp-event sp-single/); assert.match(html, /sp-event sp-cross/); assert.match(html, /新增印证 · 保留原有火花/);
  assert.match(html, /data-cd-evidence="ev_08"/);
});

test('agreement in a second conversation never upgrades a single collision to purple', () => {
  const detail = cross(), [first, , echo] = detail.spark.events;
  echo.previous_event_id = first.id; echo.before = first.after; echo.after = first.after;
  detail.spark.events = [first, echo];
  const result = view(detail);
  assert.equal(result.kind, 'single'); assert.equal(result.conversationCount, 1); assert.equal(result.latest.kind, 'corroboration');
  assert.doesNotMatch(renderSparkPath(detail), /sp-event sp-cross/);
});

test('legacy results never infer spark scope from file coverage, review or breakthrough flags', () => {
  const detail = cross(); delete detail.spark;
  detail.judgment.review_status = 'confirmed'; detail.coverage.supporting_record_count = 100;
  assert.equal(view(detail).kind, 'unknown'); assert.match(renderSparkPath(detail), /碰撞来源待补充/);
  detail.spark = { status: 'clue', reason: '需要测量', events: [], conversations: [] };
  assert.equal(view(detail).kind, 'clue');
  const fact = getDemoInsightDetail('ins_03'); assert.equal(renderSparkPath(fact), '');
});

test('invalid scope, missing quotes and mismatched source grouping degrade without inventing links', () => {
  for (const corrupt of [
    detail => { detail.spark.events[0].scope = 'cross'; },
    detail => { detail.spark.events[0].contributions[0].evidence_ids = ['missing']; },
    detail => { detail.spark.conversations[0].record_ids = ['wrong-record']; },
    detail => { detail.spark.conversations.push({ ...detail.spark.conversations[0], id: 'duplicate-source' }); },
    detail => { detail.spark.events[0].contributions.push(detail.spark.events[0].contributions[0]); },
    detail => { detail.spark.events[0].after = detail.spark.events[0].before; },
  ]) {
    const detail = single(); corrupt(detail);
    assert.equal(view(detail).kind, 'unknown'); assert.doesNotMatch(renderSparkPath(detail), /data-cd-evidence=/);
  }
});

test('future, disconnected or inconsistent event chains cannot recolor the current snapshot', () => {
  for (const corrupt of [
    detail => { detail.spark.events[1].version = 3; },
    detail => { detail.spark.events[1].previous_event_id = 'unknown'; },
    detail => { detail.spark.events[1].before = 'unconnected judgment'; },
    detail => { detail.spark.latest_event_id = detail.spark.events[0].id; },
    detail => { detail.spark.events[2].after = 'changed by corroboration'; },
  ]) {
    const detail = cross(); corrupt(detail); assert.equal(view(detail).kind, 'unknown');
  }
});

test('historical v1 never borrows later origin events while v2 preserves the whole path', async () => {
  const first = await demoHistorySource.loadDetail('ins_01', 1);
  assert.equal(view(first).kind, 'unknown'); assert.doesNotMatch(renderSparkPath(first), /方案边界讨论|sp-event sp-cross/);
  assert.equal(view(await demoHistorySource.loadDetail('ins_01', 2)).kind, 'cross');
});

test('search and origin filters agree across demo and connected overview, including legacy results', () => {
  const overview = getDemoOverview();
  for (const [filter, expected] of [['single', ['ins_05']], ['cross', ['ins_01']]]) {
    assert.deepEqual(filterInsights(overview.insights, '', filter, overview.evidence, 2).map(item => item.id), expected);
    assert.deepEqual(filterProjectInsights(overview, '', filter).map(item => item.id), expected);
  }
  assert.equal(filterProjectInsights(overview, '不存在', 'cross').length, 0);
  delete overview.insights[0].spark;
  assert.equal(filterProjectInsights(overview, '', 'cross').length, 0);
  const html = renderProjectOverview(overview);
  assert.match(html, /data-filter="single"/); assert.match(html, /data-filter="cross"/); assert.match(html, /碰撞来源待补充/);
});

test('engine origin text and IDs cannot create HTML or click-handler attributes', () => {
  const detail = cross(), payload = '<img src=x onerror="attack()">';
  detail.id = payload; detail.spark.conversations[0].title = payload;
  detail.spark.events[0].reason = payload; detail.spark.events[0].contributions[0].text = payload;
  detail.spark.events[0].before = payload;
  const html = renderSparkPath(detail) + renderSparkCard(detail, detail.evidence, 2, true);
  assert.doesNotMatch(html, /<img|data-live-insight="<img/); assert.match(html, /&lt;img/);
});
