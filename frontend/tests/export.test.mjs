import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarkdownExporter, markdownFilename } from '../src/api/export.js';
import { ApiError } from '../src/api/client.js';
import { ExportSession } from '../src/export-model.js';
import { buildSyntheticReport, demoExportSource } from './fixtures/export.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const file = (text = '# 中文报告\n', headers = {}) => new Response(text, { headers: { 'Content-Type': 'text/markdown; charset=utf-8', ...headers } });
const artifact = version => ({ text: `# v${version}\n`, filename: `spark-collision-v${version}.md`, version });

test('file transport pins the version, encodes identity and reads UTF-8 bytes without a JSON envelope', async () => {
  const calls = [];
  const download = createMarkdownExporter('http://127.0.0.1:8000/api/v1/', async (url, options) => {
    calls.push({ url, options });
    return file('# 中文与 emoji 🔥\n', { 'Content-Disposition': "attachment; filename*=UTF-8''%E5%88%86%E6%9E%90-v2.md" });
  });
  await assert.rejects(download('p', 0), /版本/); assert.equal(calls.length, 0);
  const result = await download('project/id', 2);
  assert.equal(calls[0].url.pathname, '/api/v1/projects/project%2Fid/export');
  assert.equal(calls[0].url.search, '?format=markdown&version=2');
  assert.equal(calls[0].options.method, 'GET'); assert.equal(calls[0].options.headers.Accept, 'text/markdown');
  assert.equal(result.text, '# 中文与 emoji 🔥\n'); assert.equal(result.filename, '分析-v2.md'); assert.equal(result.version, 2);
});

test('JSON error responses retain NO_ANALYSIS, HTTP status and request ID rather than becoming files', async () => {
  const download = createMarkdownExporter('http://localhost:8000/api/v1', async () => new Response(JSON.stringify({ request_id: 'req_export', error: { code: 'NO_ANALYSIS', message: '尚未分析', retryable: false } }), { status: 409, headers: { 'Content-Type': 'application/json' } }));
  await assert.rejects(download('p', 1), error => error instanceof ApiError && error.code === 'NO_ANALYSIS' && error.status === 409 && error.requestId === 'req_export');
  await assert.rejects(createMarkdownExporter('http://localhost/api/v1', async () => new Response('<html>Proxy failure</html>', { status: 502 }))('p', 1), error => error.status === 502 && error.code === 'EXPORT_FAILED');
});

test('successful HTTP status cannot download HTML, JSON, empty bodies, unsupported charset or broken UTF-8', async () => {
  for (const response of [
    new Response('{}', { headers: { 'Content-Type': 'application/json' } }),
    file('<!doctype html><html>login</html>'), file('{"error":"failed"}'), file('  \n'),
    file('# report', { 'Content-Type': 'text/markdown; charset="gbk"' }),
    file(new Uint8Array([0xff, 0xfe, 0x00])),
  ]) await assert.rejects(createMarkdownExporter('http://localhost/api/v1', async () => response)('p', 1), error => error.code === 'RESPONSE_INVALID');
  const result = await createMarkdownExporter('http://localhost/api/v1', async () => file('[中文标题](#报告)\n', { 'Content-Type': 'text/markdown; charset="UTF-8"' }))('p', 1);
  assert.match(result.text, /中文标题/);
});

test('network interruptions are retryable; explicit cancellation remains cancellation', async () => {
  await assert.rejects(createMarkdownExporter('http://localhost/api/v1', async () => { throw new Error('disconnected'); })('p', 1), error => error.code === 'NETWORK_ERROR' && error.retryable);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(createMarkdownExporter('http://localhost/api/v1', async (url, { signal }) => { signal.throwIfAborted(); })('p', 1, abort.signal), error => error.name === 'AbortError');
});

test('download names remain Markdown basenames even when disposition is absent, malformed or unsafe', () => {
  assert.equal(markdownFilename(null, 3), 'spark-collision-v3.md');
  assert.equal(markdownFilename('attachment; filename="report.html"', 3), 'spark-collision-v3.md');
  assert.equal(markdownFilename('attachment; filename="CON.md"', 3), 'spark-collision-v3.md');
  const name = markdownFilename('attachment; filename="../../evil\\name\u202e.md"', 3);
  assert.doesNotMatch(name, /[/\\\u202e]/); assert.match(name, /\.md$/);
  assert.equal(markdownFilename("attachment; filename*=UTF-8''%ZZ; filename=good.md", 3), 'good.md');
});

test('synthetic reports contain readable offline evidence and never borrow future information for v1', async () => {
  const options = { now: () => new Date('2026-10-17T06:00:00Z') };
  const old = await buildSyntheticReport(1, options), current = await buildSyntheticReport(2, options);
  assert.match(old.text, /快照版本：v1/); assert.match(old.text, /本版材料范围：1 份/);
  assert.match(old.text, /合成案例/); assert.match(old.text, /段落：1/); assert.match(old.text, /客服现场访谈/);
  assert.doesNotMatch(old.text, /E02|E03|报价流程走查|审批等待可能|val_risk|v2 ·/);
  assert.match(old.text, /没有提供完整认知碰撞卡/);
  for (const heading of ['关键事实', '认知突破', '隐藏约束', 'AI 运营空间', '复用机会', '下一步验证', 'A · 原有认知', 'B · 现场冲击', 'C · 新框架', 'D · 高阶判断', 'V · 验证动作', '最小验证建议', '未解决分歧', '原文引用与离线定位']) assert.ok(current.text.includes(heading), heading);
  assert.match(current.text, /待确认候选（未替换当前判断）/); assert.match(current.text, /负责人：待指定/); assert.match(current.text, /时间：待商定/);
  assert.match(current.text, /2026-10-17T06:00:00.000Z/); assert.match(current.text, /v1 ·/); assert.match(current.text, /E06/);
});

test('synthetic export refuses mismatched quotes and treats supplied HTML as quoted data', async () => {
  const badSource = { ...demoExportSource, async loadRecord(id) { const record = await demoExportSource.loadRecord(id); record.segments[0].text = 'different'; return record; } };
  await assert.rejects(buildSyntheticReport(1, { source: badSource }), /原文/);
  const textSource = { ...demoExportSource, async loadOverview(version) { const result = await demoExportSource.loadOverview(version); result.summary = '<img src=x onerror=alert(1)> **假标题**'; return result; } };
  const report = await buildSyntheticReport(1, { source: textSource });
  assert.doesNotMatch(report.text, /<img/); assert.match(report.text, /&lt;img/); assert.ok(report.text.includes('\\*\\*假标题\\*\\*'));
});

test('export starts at the version being viewed and uses only that snapshot material scope', async () => {
  const session = new ExportSession({ ...demoExportSource, preferredVersion: 1 }); await session.start();
  assert.equal(session.state.version, 1); assert.equal(session.state.status, 'ready');
  assert.deepEqual(session.state.records.map(item => item.id), ['rec_01']);
  assert.equal(session.state.records[0].content, undefined);
  await session.select(2); assert.equal(session.state.records.length, 4);
  const missing = new ExportSession({ ...demoExportSource, preferredVersion: 9 }); await missing.start();
  assert.equal(missing.state.status, 'error'); assert.equal(missing.state.snapshot, null);
});

test('empty histories do not offer v0 and inconsistent project, version or source scope cannot download', async () => {
  let exports = 0;
  const empty = new ExportSession({ ...demoExportSource, loadVersions: async () => ({ items: [] }), loadExport: async () => { exports++; } });
  await empty.start(); await empty.download(); assert.equal(empty.state.status, 'empty'); assert.equal(exports, 0);
  for (const mutate of [value => { value.project.id = 'wrong'; }, value => { value.snapshot_version = 1; }, value => { value.source_record_ids = ['future']; }]) {
    const session = new ExportSession({ ...demoExportSource, loadOverview: async version => { const value = await demoExportSource.loadOverview(version); mutate(value); return value; } });
    await session.start(); assert.equal(session.state.status, 'error'); assert.equal(await session.download(), null);
  }
});

test('failed downloads preserve the selected version and support an explicit identical GET retry', async () => {
  const requested = [];
  const session = new ExportSession({ ...demoExportSource, preferredVersion: 1, loadExport: async version => { requested.push(version); if (requested.length === 1) throw new Error('offline'); return artifact(version); } });
  await session.start(); assert.equal(await session.download(), null);
  assert.equal(session.state.version, 1); assert.equal(session.state.downloadStatus, 'error'); assert.equal(session.state.records.length, 1);
  assert.equal((await session.download()).version, 1); assert.deepEqual(requested, [1, 1]);
});

test('a newer version selection discards both slow metadata and a late old download', async () => {
  const slow = deferred(), oldFile = deferred(); let oldSignal;
  const session = new ExportSession({ ...demoExportSource, loadOverview: version => version === 1 ? slow.promise : demoExportSource.loadOverview(version), loadExport: (version, signal) => { oldSignal = signal; return oldFile.promise; } });
  await session.start();
  const oldSelection = session.select(1); await session.select(2); slow.resolve(await demoExportSource.loadOverview(1)); await oldSelection;
  assert.equal(session.state.version, 2); assert.equal(session.state.snapshot.snapshot_version, 2);
  const download = session.download(); await session.select(1);
  assert.equal(oldSignal.aborted, true); oldFile.resolve(artifact(2)); assert.equal(await download, null);
  assert.equal(session.state.version, 1); assert.equal(session.state.downloadStatus, 'idle');
});

test('closing cancels pending file requests and repeated clicks cannot trigger duplicate downloads', async () => {
  const pending = deferred(); let calls = 0, signal, changes = 0;
  const session = new ExportSession({ ...demoExportSource, onChange: () => changes++, loadExport: (version, currentSignal) => { calls++; signal = currentSignal; return pending.promise; } });
  await session.start(); const first = session.download(); assert.equal(await session.download(), null); assert.equal(calls, 1);
  session.close(); const count = changes; assert.equal(signal.aborted, true);
  pending.resolve(artifact(2)); assert.equal(await first, null); assert.equal(changes, count);
});
