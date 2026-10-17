import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getDemoOverview, demoRecords } from '../src/fixtures/demo.js';
import { getDemoInsightDetail, getDemoDetailRecord } from '../src/fixtures/insight-details.js';
import { demoHistorySource } from '../src/fixtures/history.js';
import { buildSyntheticReport } from '../src/fixtures/export.js';
import { validateOverview } from '../src/overview-model.js';
import { validateDetail, validateSource } from '../src/insight-detail-model.js';
import { sparkView } from '../src/spark-model.js';
import { HistorySession } from '../src/history-model.js';
import { renderDemoStages, renderDemoSpotlight } from '../src/demo-view.js';

test('shared demo keeps M1–M4 full texts and every reference resolves at its own snapshot', async () => {
  for (const record of demoRecords) {
    const original = await readFile(new URL(`../../examples/pricing-boundary/${record.meeting_id}.md`, import.meta.url), 'utf8');
    assert.equal(record.content, original.replace(/\r\n/g, '\n'));
    assert.equal(record.source_name, `${record.meeting_id}.md`);
  }
  for (const version of [1, 2, 3]) {
    const overview = validateOverview(getDemoOverview(version), 'prj_demo');
    assert.equal(overview.source_record_ids.length, version + 1);
    assert.equal(overview.engine_mode, 'mock');
    for (const insight of overview.insights) {
      const detail = validateDetail(getDemoInsightDetail(insight.id, version), { insightId: insight.id, version });
      assert.deepEqual(detail.judgment, insight.judgment);
      for (const evidence of detail.evidence) {
        assert.ok(overview.source_record_ids.includes(evidence.record_id));
        validateSource(getDemoDetailRecord(evidence.record_id), evidence);
        assert.equal(evidence.elicitation, 'unknown');
      }
      for (const entry of Object.values(detail.collision_card || {}).filter(item => item?.evidence_ids)) {
        assert.ok(entry.evidence_ids.every(id => detail.evidence.some(item => item.id === id)));
      }
    }
  }
});

test('M3 qualifies the judgment while M4 adds coverage without a collision or action approval', () => {
  const [v1, v2, v3] = [1, 2, 3].map(getDemoOverview);
  const main = overview => overview.insights.find(item => item.id === 'ins_quote_boundary');
  assert.notEqual(main(v1).judgment.text, main(v2).judgment.text);
  assert.equal(main(v2).judgment.text, main(v3).judgment.text);
  assert.equal(v2.changes.filter(item => item.is_breakthrough).length, 1);
  assert.equal(v3.outcome, 'no_new_insight');
  assert.ok(v3.changes.every(item => !item.is_breakthrough));
  assert.deepEqual([main(v1).importance.score, main(v2).importance.score, main(v3).importance.score], [4, 5, 5]);
  assert.deepEqual([main(v1).meeting_coverage.distinct_meeting_count, main(v2).meeting_coverage.distinct_meeting_count, main(v3).meeting_coverage.distinct_meeting_count], [2, 3, 4]);
  const detail = getDemoInsightDetail(main(v3).id), path = sparkView(detail, detail.evidence, 3);
  assert.equal(path.kind, 'cross'); assert.equal(path.latest.kind, 'corroboration');
  assert.equal(path.collision.version, 2); assert.equal(path.conversationCount, 2);
  assert.equal(detail.collision_card.prior_origin, 'analysis_premise');
  const wait = v3.insights.find(item => item.id === 'ins_approval_wait');
  assert.equal(wait.meeting_coverage.distinct_meeting_count, 1);
  assert.equal(wait.judgment.epistemic_type, 'hypothesis');
  assert.ok(wait.attention_flag.includes('需关注'));
  assert.ok(detail.evidence.some(item => item.quote === '这不代表已经批准上线或对外承诺。'));
});

test('history compares v1/v2 conditions and v2/v3 evidence without leaking future meetings', async () => {
  const history = new HistorySession(demoHistorySource);
  await history.start(); assert.equal(history.state.status, 'ready');
  assert.equal(history.state.from, 2); assert.equal(history.state.to, 3);
  assert.equal(history.state.kind, 'evidence_only');
  await history.selectPair(1, 2); assert.equal(history.state.kind, 'changed');
  const future = getDemoOverview(3).evidence.find(item => item.meeting_id === 'M4');
  await assert.rejects(history.evidence(future.id, 1), /该版本未提供/);
  assert.equal(getDemoInsightDetail('ins_quote_boundary', 1).collision_card, null);
  assert.equal(getDemoInsightDetail('ins_quote_boundary', 1).spark, undefined);
  history.close();
});

test('all three reports pin sources and no-new-insight semantics to the selected snapshot', async () => {
  for (const version of [1, 2, 3]) {
    const artifact = await buildSyntheticReport(version);
    assert.equal(artifact.version, version); assert.ok(artifact.text.includes('报价授权边界调研'));
    assert.ok(artifact.text.includes('M1.md') && artifact.text.includes('M2.md'));
    assert.equal(artifact.text.includes('M3.md'), version >= 2);
    assert.equal(artifact.text.includes('M4.md'), version >= 3);
    assert.equal(artifact.text.includes('本次无新火花'), version === 3);
    assert.ok(artifact.text.includes('待指定') && artifact.text.includes('待商定'));
  }
});

test('stage controls and spotlight use snapshot-specific evidence and keep simulation labels', () => {
  for (const version of [1, 2, 3]) {
    const overview = getDemoOverview(version), html = renderDemoStages(overview) + renderDemoSpotlight(overview);
    assert.ok(html.includes(`data-demo-version="${version}" aria-pressed="true"`));
    assert.ok(html.includes('不会调用真实 AI'));
    for (const [, id] of html.matchAll(/data-evidence="([^"]+)"/g)) assert.ok(overview.evidence.some(item => item.id === id));
    assert.ok(!html.includes('全部自动回复'));
  }
});

test('website uses the same exact quotes, roles and M4 snapshot semantics', async () => {
  const site = await readFile(new URL('../../demo/site/app.js', import.meta.url), 'utf8');
  const entries = [...site.matchAll(/id: '(M[1-4])'.*?speaker: '([^']+)'.*?quote: '([^']+)'/g)];
  assert.equal(entries.length, 4);
  for (const [, id, role, quote] of entries) {
    const record = demoRecords.find(item => item.meeting_id === id);
    assert.equal(role, record.participants[0].label); assert.ok(record.content.includes(quote));
  }
  assert.ok(site.includes("version: '03'"));
  assert.ok(!site.includes("elicitation: '主动提起'") && !site.includes("elicitation: '被问回应'"));
});
