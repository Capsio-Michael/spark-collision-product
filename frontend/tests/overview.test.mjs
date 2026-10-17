import test from 'node:test';
import assert from 'node:assert/strict';
import { MaterialWorkflow, WORKSPACE_KEY } from '../src/material-workflow.js';
import { validateOverview, displayCount, filterProjectInsights } from '../src/overview-model.js';
import { renderProjectOverview, renderProjectInsights, renderProjectDimension } from '../src/overview-view.js';
import { getDemoOverview } from '../src/fixtures/demo.js';

function store(seed = {}) {
  const values = new Map(Object.entries(seed)); let writes = 0;
  return { get writes() { return writes; }, getItem: key => values.get(key) ?? null, setItem(key, value) { writes++; values.set(key, value); } };
}
const cachedDraft = { client_record_id: 'preserved_draft', title: '保留的合成材料', content: '原文不会被缓存修复清除。', source_type: 'interview', source_date: null, source_name: '粘贴记录', material_basis: 'synthetic', authorization_note: null, participants: [] };
function seed(overview) {
  return JSON.stringify({ schema_version: 2, base_url: 'http://127.0.0.1:8000/api/v1', project: getDemoOverview().project,
    drafts: [cachedDraft], removed_drafts: [], editor_buffers: { new: [{ ...cachedDraft, title: '未完成的编辑' }] }, submissions: {}, server_records: [], overview,
    active_job: { id: 'preserved_job', status: 'running', stage: 'comparing' }, last_job: null,
    pending: { import: { key: 'same-key', ids: ['preserved_draft'], body: { records: [cachedDraft] } } } });
}
function apiFor(overview) {
  return { health: async () => ({ status: 'ok', api_version: '0.1', engine_mode: 'mock' }),
    projects: async () => ({ items: [getDemoOverview().project] }), records: async () => ({ items: [] }), overview: async () => structuredClone(overview) };
}

test('damaged derived cache cannot crash startup and retains drafts, buffers, binding and pending requests without a write', () => {
  const raw = seed({ snapshot_version: 2 }); const storage = store({ [WORKSPACE_KEY]: raw });
  const workflow = new MaterialWorkflow(storage);
  assert.equal(workflow.storageError, undefined); assert.match(workflow.cacheWarning, /缓存不完整/);
  assert.equal(workflow.state.overview, null); assert.deepEqual(workflow.state.drafts, [cachedDraft]);
  assert.equal(workflow.state.project.id, 'prj_demo'); assert.equal(workflow.state.editor_buffers.new[0].title, '未完成的编辑');
  assert.equal(workflow.state.pending.import.key, 'same-key'); assert.deepEqual(workflow.state.pending.import.body.records, [cachedDraft]);
  assert.equal(workflow.state.active_job.id, 'preserved_job'); assert.equal(storage.getItem(WORKSPACE_KEY), raw); assert.equal(storage.writes, 0);
});

test('a valid reconnect repairs only cached analysis while a failed reconnect preserves the raw recovery data', async () => {
  const raw = seed({ snapshot_version: 2 }), storage = store({ [WORKSPACE_KEY]: raw });
  const api = apiFor(getDemoOverview()); let broken = true;
  api.overview = async () => { if (broken) throw new Error('offline'); return getDemoOverview(); };
  const workflow = new MaterialWorkflow(storage, { apiFactory: () => api });
  await assert.rejects(workflow.connect(), /offline/); assert.equal(storage.getItem(WORKSPACE_KEY), raw); assert.ok(workflow.cacheWarning);
  broken = false; await workflow.connect();
  assert.equal(workflow.cacheWarning, null); assert.equal(workflow.state.overview.snapshot_version, 2);
  assert.deepEqual(workflow.state.drafts, [cachedDraft]); assert.equal(workflow.state.pending.import.key, 'same-key');
  assert.equal(workflow.state.editor_buffers.new[0].title, '未完成的编辑');
});

test('invalid cached project binding is blocked rather than silently moved to a different project', () => {
  const value = JSON.parse(seed(getDemoOverview())); value.project.id = null;
  const raw = JSON.stringify(value), storage = store({ [WORKSPACE_KEY]: raw });
  const workflow = new MaterialWorkflow(storage);
  assert.ok(workflow.storageError); assert.equal(workflow.state.overview, null); assert.equal(workflow.state.project, null);
  assert.equal(storage.getItem(WORKSPACE_KEY), raw); assert.equal(storage.writes, 0);
});

test('malformed coverage counts are rejected before persisting a server response or replacing a valid snapshot', async () => {
  const valid = getDemoOverview(), api = apiFor(valid), storage = store();
  const workflow = new MaterialWorkflow(storage, { apiFactory: () => api }); await workflow.connect();
  const previous = storage.getItem(WORKSPACE_KEY);
  for (const field of ['supporting_record_count', 'total_analyzed_record_count', 'unique_speakers', 'spontaneous_speakers', 'prompted_speakers', 'unknown_elicitation_count']) {
    const bad = getDemoOverview(); bad.insights[0].coverage[field] = '<em>伪装的数量</em>'; api.overview = async () => bad;
    await assert.rejects(workflow.connect(), /覆盖统计/);
    assert.deepEqual(workflow.state.overview, valid); assert.equal(storage.getItem(WORKSPACE_KEY), previous);
  }
  for (const value of [-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1, '2']) {
    const bad = getDemoOverview(); bad.insights[0].coverage.supporting_record_count = value;
    assert.throws(() => validateOverview(bad, 'prj_demo'), /覆盖统计/);
  }
});

test('unknown speaker counts remain unknown rather than becoming zero and rendered counts cannot inject HTML', () => {
  const overview = getDemoOverview(), coverage = overview.insights[0].coverage;
  coverage.unique_speakers = null; coverage.spontaneous_speakers = null; coverage.prompted_speakers = null; coverage.identity_incomplete = true;
  assert.equal(validateOverview(overview, 'prj_demo'), overview);
  let html = renderProjectInsights(overview);
  assert.match(html, /去重发言者 未知/); assert.match(html, /统计不完整/); assert.equal(displayCount(0), '0');
  coverage.supporting_record_count = '<em>数字</em>'; html = renderProjectInsights(overview);
  assert.doesNotMatch(html, /<em>数字<\/em>/); assert.match(html, /未知 \/ 4/);
});

test('own homepage exposes all six dimensions, search, this-version changes and independent dispute entry', () => {
  const overview = getDemoOverview(); overview.project.name = '另一个业务';
  const html = renderProjectOverview(overview);
  for (const key of ['key_facts', 'cognitive_breakthroughs', 'hidden_constraints', 'ai_operations', 'reusable_opportunities', 'validation_questions']) assert.ok(html.includes(`data-live-dimension="${key}"`));
  assert.ok(html.includes('id="insight-search"')); assert.ok(html.includes('data-action="history"'));
  assert.ok(html.includes('data-live-insight="ins_02"')); assert.ok(html.includes(overview.changes[0].reason));
  assert.ok(html.includes('data-live-evidence="ev_02"')); assert.doesNotMatch(html, /data-insight=|data-evidence=/);
});

test('change filtering follows the current snapshot events rather than an older insight last_change', () => {
  const overview = getDemoOverview();
  assert.deepEqual(filterProjectInsights(overview, '风险', 'changed').map(item => item.id), ['ins_01']);
  assert.deepEqual(filterProjectInsights(overview, '', 'disputed').map(item => item.id), ['ins_02']);
  overview.changes = [{ ...overview.changes[2], is_breakthrough: false, type: 'unchanged' }];
  assert.equal(filterProjectInsights(overview, '', 'changed').length, 0);
  assert.doesNotMatch(renderProjectInsights(overview), /本次认知变化/);
  assert.equal(filterProjectInsights(overview, '找不到的词').length, 0);
});

test('no-new-insight and insufficient-evidence states do not manufacture a collision or fill absent dimensions', () => {
  const overview = getDemoOverview(); overview.outcome = 'no_new_insight'; overview.changes = [];
  assert.match(renderProjectOverview(overview), /本次无新火花/); assert.equal(filterProjectInsights(overview, '', 'changed').length, 0);
  overview.outcome = 'insufficient_evidence'; overview.insights = []; overview.dimensions = []; overview.evidence = []; overview.summary = '缺少订单运行时间。';
  const html = renderProjectOverview(overview);
  assert.match(html, /材料证据仍不足/); assert.match(html, /本版尚未形成可靠关注点/); assert.match(html, /未提供/);
  assert.doesNotMatch(html, /报价需要人工确认|先试自动回复/);
  assert.match(renderProjectDimension(overview, 'hidden_constraints'), /当前快照未返回这个视角/);
});

test('dimension drawers retain blocks, sections, conditions, alternative explanations and evidence gaps', () => {
  const overview = getDemoOverview(); const dimension = overview.dimensions.find(item => item.key === 'ai_operations');
  dimension.findings[0].sections = [{ label: '规则与程序分工', body: { text: '规则由程序校验', epistemic_type: 'inference', evidence_ids: ['ev_02'], conditions: ['明确授权规则'], alternative_explanations: ['也可能使用现有配置'], gaps: ['尚缺运行基线'] } }];
  const html = renderProjectDimension(overview, 'ai_operations');
  for (const text of ['规则与程序分工', '规则由程序校验', '明确授权规则', '也可能使用现有配置', '尚缺运行基线', '快照 v2']) assert.ok(html.includes(text));
  assert.ok(html.includes('data-live-evidence="ev_02"')); assert.ok(html.includes('data-live-insight="ins_01"'));
});

test('untrusted summaries, judgments, dimension sections, labels and IDs remain text and cannot create attributes', () => {
  const overview = getDemoOverview(), payload = '<img src=x onerror="bad()">';
  overview.summary = payload; overview.insights[0].title = payload; overview.insights[0].judgment.text = payload;
  overview.insights[0].coverage.note = payload;
  const finding = overview.dimensions[0].findings[0]; finding.title = payload; finding.body.text = payload;
  finding.insight_ids = []; finding.body.evidence_ids = ['evil" onclick="bad()'];
  overview.evidence.push({ id: 'evil" onclick="bad()', label: payload, quote: '源文本', record_id: 'r', segment_id: 's' });
  for (const html of [renderProjectOverview(overview), renderProjectDimension(overview, 'key_facts')]) {
    assert.doesNotMatch(html, /<img| onclick="bad\(\)"/); assert.ok(html.includes('&lt;img'));
  }
});

test('overview validation checks snapshot identity and malformed nested analysis without losing missing-dimension gaps', () => {
  const valid = getDemoOverview(); valid.dimensions = []; assert.equal(validateOverview(valid, 'prj_demo'), valid);
  for (const mutate of [value => value.project.id = 'wrong', value => value.pending_confirmation_count = '1', value => value.insights[0].judgment.conditions = {}, value => value.dimensions[0].findings[0].body = null, value => value.evidence[0].record_id = null]) {
    const value = getDemoOverview(); mutate(value); assert.throws(() => validateOverview(value, 'prj_demo'), /接口约定/);
  }
  const contradictory = getDemoOverview(); contradictory.outcome = 'no_new_insight';
  assert.throws(() => validateOverview(contradictory, 'prj_demo'), /不能同时标记认知突破/);
});
