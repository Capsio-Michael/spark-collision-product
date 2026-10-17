import test from 'node:test';
import assert from 'node:assert/strict';
import { MaterialWorkflow, WORKSPACE_KEY, decodeMaterialFiles, normalizeBaseUrl, materialPayload } from '../src/material-workflow.js';
import { materialRows } from '../src/material-list.js';
import { validateDrafts } from '../src/core.js';

const draft = (id = 'draft_01', overrides = {}) => ({
  client_record_id: id, title: '合成访谈', content: '客服：报价需要人工确认。', source_type: 'interview',
  source_date: null, source_name: '粘贴记录', participants: [], material_basis: 'synthetic', authorization_note: null, ...overrides,
});

test('optional explicit meeting IDs survive draft recovery and reach the import payload', () => {
  const storage = memoryStorage(), { api } = backend();
  const workflow = makeWorkflow(storage, api);
  workflow.save([draft('meeting-draft', { meeting_id: ' M1 ' })]);
  const restored = makeWorkflow(storage, api);
  assert.equal(materialPayload(restored.state.drafts[0]).meeting_id, 'M1');
  assert.ok(!Object.hasOwn(materialPayload(draft()), 'meeting_id'));
  assert.ok(!Object.hasOwn(materialPayload(draft('blank', { meeting_id: ' ' })), 'meeting_id'));
  assert.match(validateDrafts([draft('bad', { meeting_id: 12 })]), /会议标识/);
  assert.match(validateDrafts([draft('long', { meeting_id: 'x'.repeat(121) })]), /会议标识/);
});

test('definitive service limitations unlock unsubmitted drafts while preserving their content', async () => {
  for (const code of ['MEETING_GROUPING_UNSUPPORTED', 'PARTICIPANT_CONFLICT']) {
    const { api } = backend(); api.importRecords = async () => { throw Object.assign(new Error(code), { code }); };
    const workflow = makeWorkflow(memoryStorage(), api);
    workflow.save([draft('rejected', { meeting_id: 'M1' })]); await workflow.connect();
    await assert.rejects(workflow.submit(['rejected']), error => error.code === code);
    assert.equal(workflow.state.pending.import, undefined); assert.equal(workflow.isEditable('rejected'), true);
    assert.equal(workflow.state.drafts[0].meeting_id, 'M1'); assert.equal(workflow.state.drafts[0].content, draft().content);
  }
});
function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return { values, blocked: false, getItem(key) { return values.get(key) ?? null; }, setItem(key, value) { if (this.blocked) throw new Error('Quota exceeded'); values.set(key, value); } };
}
function backend() {
  const remote = { project: null, records: [], version: 0, jobs: [], calls: [], imports: new Map(), projectsCreated: new Map(), analyses: new Map(), loseImport: false, loseAnalysis: false, pollFails: false, jobStatus: 'running', wrongVersion: false, overviewShowsJob: false };
  const summary = () => ({ project: { ...remote.project, current_version: remote.version, record_count: remote.records.length }, snapshot_version: remote.wrongVersion ? 99 : remote.version, active_job_id: remote.overviewShowsJob ? remote.jobs.at(-1)?.id || null : null, source_record_ids: [], unanalyzed_record_ids: [], insights: [], dimensions: [], evidence: [], changes: [], outcome: remote.version ? 'updated' : null, summary: '', pending_confirmation_count: 0, engine_mode: 'live' });
  const api = {
    health: async () => ({ status: 'ok', api_version: '0.1', engine_mode: 'live', model_configured: true }),
    projects: async () => ({ items: remote.project ? [remote.project] : [] }),
    records: async () => ({ items: structuredClone(remote.records) }),
    overview: async () => summary(),
    createProject: async (body, key) => {
      remote.calls.push({ kind: 'project', key, body: structuredClone(body) });
      if (!remote.projectsCreated.has(key)) { remote.project = { id: 'prj_1', name: body.name, current_version: 0, record_count: 0, created_at: '2026-10-17T12:00:00+08:00' }; remote.projectsCreated.set(key, remote.project); }
      return remote.projectsCreated.get(key);
    },
    importRecords: async (projectId, records, key) => {
      remote.calls.push({ kind: 'import', key, body: structuredClone(records), projectId });
      if (!remote.imports.has(key)) {
        const items = records.map((record, index) => ({ id: `rec_${remote.records.length + index + 1}`, title: record.title, source_type: record.source_type, source_date: record.source_date, source_name: record.source_name, material_basis: record.material_basis, authorization_note: record.authorization_note, created_at: '2026-10-17T12:00:00+08:00', covered_in_current_version: false }));
        remote.records.push(...items); remote.imports.set(key, { items });
      }
      if (remote.loseImport) { remote.loseImport = false; throw new Error('Connection lost after commit'); }
      return structuredClone(remote.imports.get(key));
    },
    analyze: async (projectId, body, key) => {
      remote.calls.push({ kind: 'analysis', key, body: structuredClone(body), projectId });
      if (!remote.analyses.has(key)) {
        const job = { id: `job_${remote.jobs.length + 1}`, project_id: projectId, status: 'queued', stage: 'queued', added_record_ids: body.record_ids, source_record_ids: body.record_ids, result_version: null, outcome: null, error: null };
        remote.jobs.push(job); remote.analyses.set(key, job);
      }
      if (remote.loseAnalysis) { remote.loseAnalysis = false; throw new Error('Response lost'); }
      return structuredClone(remote.analyses.get(key));
    },
    job: async (projectId, id) => {
      if (remote.pollFails) throw new Error('Temporary query error');
      const job = { ...remote.jobs.find(item => item.id === id), status: remote.jobStatus, stage: remote.jobStatus === 'succeeded' ? 'done' : remote.jobStatus === 'failed' ? 'failed' : 'comparing' };
      if (job.status === 'succeeded') { remote.version = 1; remote.records.forEach(record => { record.covered_in_current_version = true; }); job.result_version = 1; job.outcome = 'updated'; }
      if (job.status === 'failed') job.error = { code: 'MODEL_TIMEOUT', message: '模型超时', retryable: true, details: {} };
      return job;
    },
  };
  return { remote, api };
}
function makeWorkflow(storage, api) {
  let id = 0;
  return new MaterialWorkflow(storage, { apiFactory: () => api, makeId: () => `key_${++id}` });
}
function file(name, bytes) { return { name, size: bytes.byteLength, arrayBuffer: async () => Uint8Array.from(bytes).buffer }; }

test('UTF-8 imports preserve source, BOM handling, and per-file metadata', async () => {
  const bytes = new TextEncoder().encode('\uFEFF客服：保留原文。\r\n第二段');
  const files = await decodeMaterialFiles([file('访谈.txt', bytes), file('讨论.md', new TextEncoder().encode('# 合成材料\n内容'))], () => 'new-id');
  assert.equal(files[0].title, '访谈'); assert.equal(files[0].source_name, '访谈.txt');
  assert.equal(files[0].content, '客服：保留原文。\r\n第二段');
  assert.equal(files[0].material_basis, '');
  assert.equal(files[0].source_type, 'other', 'a filename does not establish that a record is an interview');
  await assert.rejects(decodeMaterialFiles([file('坏编码.txt', Uint8Array.from([0xff, 0xfe]))]), /UTF-8/);
  await assert.rejects(decodeMaterialFiles([file('不支持.pdf', bytes)]), /TXT/);
  await assert.rejects(decodeMaterialFiles([file('空文件.md', new Uint8Array())]), /内容为空/);
  await assert.rejects(decodeMaterialFiles(Array(6).fill(file('多.txt', bytes))), /1–5/);
});

test('date and participant validation avoid false identity merges', () => {
  assert.match(validateDrafts([draft('one', { source_date: '2026-02-30' })]), /日期/);
  assert.equal(validateDrafts([draft('one', { source_date: '2024-02-29' })]), null);
  const existing = [draft('a', { participants: [{ id: 'p1', label: '负责人' }] })];
  assert.match(validateDrafts([draft('b', { participants: [{ id: 'p1', label: '另一人' }] })], existing), /同一个参与者标识/);
  assert.equal(validateDrafts([draft('b', { participants: [{ id: 'p2', label: '负责人' }] })], existing), null);
});

test('v1 drafts migrate without modifying old data; edits, buffers and removals recover', () => {
  const old = JSON.stringify([draft()]); const storage = memoryStorage({ 'spark-collision:drafts:v1': old });
  const workflow = makeWorkflow(storage, {});
  workflow.saveBuffer('new', [draft('new', { title: '', material_basis: '' })]);
  workflow.save([draft('draft_01', { title: '修改后的标题' })], ['draft_01'], 'edit:draft_01');
  assert.equal(storage.getItem('spark-collision:drafts:v1'), old);
  workflow.remove('draft_01');
  const restored = makeWorkflow(storage, {}); assert.equal(restored.state.drafts.length, 0);
  restored.restoreLast(); assert.equal(restored.state.drafts[0].title, '修改后的标题');
  assert.equal(restored.state.editor_buffers.new[0].title, '');
});

test('failed atomic draft save leaves previous records intact', () => {
  const storage = memoryStorage(); const workflow = makeWorkflow(storage, {}); workflow.save([draft()]);
  assert.throws(() => workflow.save([draft('new'), draft('bad', { material_basis: '' })]), /请选择/);
  assert.equal(workflow.state.drafts.length, 1);
  storage.blocked = true;
  assert.throws(() => workflow.save([draft('draft_01', { title: '不能写入的修改' })], ['draft_01']), /保存失败/);
  assert.equal(workflow.state.drafts[0].title, '合成访谈');
});

test('lost import response recovers after reload using identical body and idempotency key', async () => {
  const storage = memoryStorage(); const { api, remote } = backend();
  let workflow = makeWorkflow(storage, api); workflow.save([draft()]); await workflow.connect();
  remote.loseImport = true; await assert.rejects(workflow.submit(['draft_01']), /Connection lost/);
  assert.equal(materialRows(workflow)[0].status, 'uncertain');
  assert.throws(() => workflow.save([draft('draft_01', { title: '不应覆盖' })], ['draft_01']), /不能改写/);
  assert.throws(() => workflow.remove('draft_01'), /不能移除/);
  workflow = makeWorkflow(storage, api); await workflow.connect(); await workflow.submit(['draft_01']);
  const calls = remote.calls.filter(call => call.kind === 'import');
  assert.equal(calls.length, 2); assert.equal(calls[0].key, calls[1].key); assert.deepEqual(calls[0].body, calls[1].body);
  assert.equal(remote.records.length, 1); assert.equal(materialRows(workflow).length, 1);
  assert.equal(materialRows(workflow)[0].status, 'saved'); assert.equal(workflow.state.pending.import, undefined);
});

test('a pending import cannot silently submit different selected drafts', async () => {
  const { api, remote } = backend(); const workflow = makeWorkflow(memoryStorage(), api);
  workflow.save([draft('one'), draft('two')]); await workflow.connect(); remote.loseImport = true;
  await assert.rejects(workflow.submit(['one']));
  await assert.rejects(workflow.submit(['two']), /先重试上次/);
  assert.equal(remote.calls.filter(call => call.kind === 'import').length, 1);
});

test('query failures do not fail jobs or create new analysis; completed snapshots match version', async () => {
  const { api, remote } = backend(); const workflow = makeWorkflow(memoryStorage(), api);
  workflow.save([draft()]); await workflow.connect(); await workflow.submit(['draft_01']);
  await workflow.startAnalysis(['rec_1']); remote.pollFails = true;
  await assert.rejects(workflow.poll()); assert.ok(workflow.state.active_job);
  assert.equal(remote.jobs.length, 1); assert.equal(materialRows(workflow)[0].status, 'analyzing');
  remote.pollFails = false; remote.jobStatus = 'succeeded'; remote.wrongVersion = true;
  await assert.rejects(workflow.poll(), /版本与任务不一致/);
  assert.equal(workflow.state.overview, null); assert.ok(workflow.state.active_job);
  remote.wrongVersion = false; await workflow.poll();
  assert.equal(workflow.state.active_job, null); assert.equal(workflow.state.overview.snapshot_version, 1);
  assert.equal(materialRows(workflow)[0].status, 'analyzed');
});

test('lost analysis response is retried with original request, failed job remains saved', async () => {
  const storage = memoryStorage(); const { api, remote } = backend();
  let workflow = makeWorkflow(storage, api); workflow.save([draft()]); await workflow.connect(); await workflow.submit(['draft_01']);
  remote.loseAnalysis = true; await assert.rejects(workflow.startAnalysis(['rec_1']));
  const key = workflow.state.pending.analysis.key;
  remote.overviewShowsJob = true;
  workflow = makeWorkflow(storage, api); await workflow.connect(); assert.ok(workflow.state.active_job); await workflow.startAnalysis(['rec_1']);
  assert.equal(remote.calls.filter(call => call.kind === 'analysis').at(-1).key, key); assert.equal(remote.jobs.length, 1);
  remote.jobStatus = 'failed'; await workflow.poll();
  assert.equal(workflow.state.active_job, null); assert.equal(workflow.state.last_job.status, 'failed');
  assert.equal(materialRows(workflow)[0].status, 'saved'); assert.equal(workflow.state.drafts.length, 1);
});

test('quota failure before a request prevents network writes, corrupt workspace is not overwritten', async () => {
  const storage = memoryStorage(); const { api, remote } = backend(); const workflow = makeWorkflow(storage, api);
  workflow.save([draft()]); await workflow.connect(); storage.blocked = true;
  await assert.rejects(workflow.submit(['draft_01']), /保存失败/); assert.equal(remote.calls.length, 0);
  const corrupt = memoryStorage({ [WORKSPACE_KEY]: '{broken' });
  const broken = makeWorkflow(corrupt, api); assert.ok(broken.storageError);
  assert.throws(() => broken.save([draft()]), /无法读取/); assert.equal(corrupt.getItem(WORKSPACE_KEY), '{broken');
});

test('connection address and project checks prevent binding stored records to another service', async () => {
  assert.equal(normalizeBaseUrl('http://localhost:8010/api/v1/'), 'http://localhost:8010/api/v1');
  assert.throws(() => normalizeBaseUrl('https://example.com/api/v1'));
  assert.throws(() => normalizeBaseUrl('http://secret@localhost:8000/api/v1'));
  const { api } = backend(); const workflow = makeWorkflow(memoryStorage(), api);
  workflow.save([draft()]); await workflow.connect(); await workflow.submit(['draft_01']);
  await assert.rejects(workflow.connect('http://localhost:8010/api/v1'), /绑定当前地址/);
});
