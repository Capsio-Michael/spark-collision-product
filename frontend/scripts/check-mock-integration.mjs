// Real local HTTP + SQLite checks using the production frontend clients/state.
// Always creates its own DB and server; never resets an existing workspace.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { MaterialWorkflow } from '../src/material-workflow.js';
import { createApiClient } from '../src/api/client.js';
import { createMarkdownExporter } from '../src/api/export.js';
import { DetailSession } from '../src/insight-detail-model.js';
import { HistorySession } from '../src/history-model.js';
import { meetingEvidence } from '../src/meeting-evidence-model.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = path.join(root, 'frontend/.artifacts');
await mkdir(artifacts, { recursive: true });
const output = await mkdtemp(path.join(artifacts, 'mock-integration-'));
const reservation = createServer();
await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const base = `http://127.0.0.1:${port}/api/v1`, db = path.join(output, 'mock.db');
const memory = new Map(), storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
const api = createApiClient(base), imports = [], analyses = [], stages = [];
let child, spawnError, logs = '';

async function start() {
  spawnError = null;
  child = spawn(process.env.SPARK_PYTHON || 'python', ['-X', 'utf8', '-u', '-m', 'engine.server', '--port', String(port), '--db', db], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  child.once('error', error => { spawnError = error; });
  child.stdout.on('data', chunk => { logs = (logs + chunk).slice(-16000); });
  child.stderr.on('data', chunk => { logs = (logs + chunk).slice(-16000); });
  for (let attempt = 0; attempt < 80; attempt++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error(`Mock service exited: ${logs}`);
    try { if ((await api.health()).status === 'ok') return; } catch { /* Wait only for this new process to bind. */ }
    await delay(100);
  }
  throw new Error('Mock service did not become ready');
}
async function stop() {
  if (!child?.pid || child.exitCode !== null || child.signalCode) return;
  await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
}
const factory = () => ({ ...api,
  importRecords(...args) { imports.push(structuredClone(args)); return api.importRecords(...args); },
  analyze(...args) { analyses.push(structuredClone(args)); return api.analyze(...args); },
});

try {
  await start();
  assert.equal((await api.health()).engine_mode, 'mock');
  assert.deepEqual((await api.projects()).items, []);
  const preflight = await fetch(`${base}/projects`, { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:5201', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Content-Type,Idempotency-Key' } });
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'http://127.0.0.1:5201');
  const workflow = new MaterialWorkflow(storage, { apiFactory: factory });
  await workflow.connect(base);
  const roles = ['客服负责人', '销售负责人', '运营负责人', '项目负责人'];
  for (const [version, batch] of [[1, [1, 2]], [2, [3]], [3, [4]]]) {
    const records = await Promise.all(batch.map(async number => ({
      client_record_id: `integration-M${number}`, title: `M${number} ${roles[number - 1]}合成讨论`,
      meeting_id: `M${number}`, source_type: number <= 2 ? 'interview' : 'meeting', source_date: null,
      source_name: `M${number}.md`, material_basis: 'synthetic', authorization_note: null,
      participants: [{ id: `person_${number}`, label: roles[number - 1] }],
      content: await readFile(path.join(root, `examples/pricing-boundary/M${number}.md`), 'utf8'),
    })));
    workflow.save(records); const ids = records.map(record => record.client_record_id);
    await workflow.submit(ids);
    const repeatedImport = await api.importRecords(...imports.at(-1));
    assert.deepEqual(repeatedImport.items.map(item => item.id), ids.map(id => workflow.state.submissions[id]));
    await workflow.startAnalysis(ids.map(id => workflow.state.submissions[id]));
    const repeatedJob = await api.analyze(...analyses.at(-1));
    assert.equal(repeatedJob.id, workflow.state.active_job.id);
    await workflow.poll();
    assert.equal(workflow.state.overview.snapshot_version, version); assert.equal(workflow.state.active_job, null);
    const main = workflow.state.overview.insights.find(item => item.id === 'ins_quote_boundary');
    assert.equal(main.importance.score, version === 1 ? 4 : 5);
    assert.equal(main.meeting_coverage.distinct_meeting_count, version + 1);
    assert.equal(workflow.state.overview.outcome, version === 3 ? 'no_new_insight' : 'updated');
    stages.push({ version, outcome: workflow.state.overview.outcome, score: main.importance.score, meetings: main.meeting_coverage.distinct_meeting_count, convergence: main.convergence_status });
  }
  const projectId = workflow.state.project.id;
  const history = new HistorySession({ projectId, loadVersions: () => api.versions(projectId), loadOverview: version => api.overview(projectId, version), loadDetail: (id, version) => api.insight(projectId, id, version), loadRecord: id => api.record(projectId, id) });
  await history.start(); assert.equal(history.state.status, 'ready'); assert.equal(history.state.kind, 'evidence_only');
  await history.selectPair(1, 2); assert.equal(history.state.kind, 'changed'); history.close();
  const detail = await api.insight(projectId, 'ins_quote_boundary', 3);
  assert.deepEqual(meetingEvidence(detail).groups.map(item => item.meetingId), ['M1', 'M2', 'M3', 'M4']);
  const reader = new DetailSession({ insightId: detail.id, version: 3, loadDetail: () => detail, loadRecord: id => api.record(projectId, id) });
  await reader.load();
  for (const evidence of detail.evidence) {
    await reader.selectEvidence(evidence.id); assert.equal(reader.state.sourceStatus, 'ready');
    assert.equal(reader.state.record.meeting_id, evidence.meeting_id);
  }
  reader.close();
  const exportReport = createMarkdownExporter(base);
  for (const version of [1, 2, 3]) {
    const report = await exportReport(projectId, version);
    assert.ok(report.text.includes('模拟引擎结果'));
    assert.equal(report.text.includes('M3.md'), version >= 2); assert.equal(report.text.includes('M4.md'), version >= 3);
    await writeFile(path.join(output, report.filename), report.text, 'utf8');
  }
  await assert.rejects(api.correct(projectId, {}, crypto.randomUUID()), error => error.status === 501 && error.code === 'NOT_IMPLEMENTED');
  assert.equal((await api.overview(projectId)).snapshot_version, 3);
  const duplicate = { ...workflow.state.drafts[0], client_record_id: 'duplicate-meeting' };
  workflow.save([duplicate]); await assert.rejects(workflow.submit([duplicate.client_record_id]), error => error.code === 'MEETING_GROUPING_UNSUPPORTED');
  assert.equal(workflow.isEditable(duplicate.client_record_id), true); workflow.remove(duplicate.client_record_id);
  assert.equal((await api.records(projectId)).items.length, 4);
  await stop(); await start();
  const restored = new MaterialWorkflow(storage); await restored.connect(base);
  assert.equal(restored.state.project.id, projectId); assert.equal(restored.state.overview.snapshot_version, 3);
  assert.equal(restored.state.server_records.length, 4); assert.equal((await api.versions(projectId)).items.length, 3);
  const summary = { status: 'passed', engine_mode: 'mock', stages, checks: ['CORS', 'real HTTP import/analyze/poll', 'idempotent retry', 'exact sources', 'historical isolation', 'Markdown export', '501 no-write', 'same-meeting rejection recovery', 'browser-state restore', 'SQLite persistence after restart'], output };
  await writeFile(path.join(output, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
} finally { await stop(); }
