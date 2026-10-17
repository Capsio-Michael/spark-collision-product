import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatComposer } from '../src/chat-home-model.js';
import { renderChatHome } from '../src/chat-home-view.js';

function setup() {
  const map = new Map(); const storage = { getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value) };
  const calls = [], workflow = { connected: false, health: { engine_mode: 'mock' }, state: { drafts: [], submissions: {}, server_records: [], pending: {}, overview: null, active_job: null },
    save(records) { calls.push('save'); this.state.drafts.push(...records); },
    async connect() { calls.push('connect'); this.connected = true; },
    async submit(ids) { calls.push('submit'); for (const id of ids) { this.state.submissions[id] = 'server-' + id; this.state.server_records.push({ id: 'server-' + id, covered_in_current_version: false }); } },
    async startAnalysis(ids) { calls.push('analyze'); this.state.active_job = { id: 'job1', status: 'queued', added_record_ids: ids }; },
  };
  return { storage, workflow, calls };
}
function file(name = '会议.md') { const bytes = new TextEncoder().encode('客户：这是合成讨论。'); return { name, size: bytes.length, arrayBuffer: async () => bytes.buffer }; }

test('conversation removal persists and can be undone without deleting materials or cancelling a job', async () => {
  const { storage, workflow } = setup(); let chat = new ChatComposer(storage);
  chat.text = '需要保留的原文'; chat.basis = 'synthetic'; await chat.send(workflow);
  const ids = [...chat.runIds], job = workflow.state.active_job;
  chat.dismissRun(); chat = new ChatComposer(storage);
  assert.deepEqual(chat.runIds, []); assert.deepEqual(chat.dismissedRunIds, ids);
  assert.equal(workflow.state.drafts[0].content, '需要保留的原文'); assert.equal(workflow.state.active_job, job);
  chat.restoreRun(); assert.deepEqual(new ChatComposer(storage).runIds, ids);
});
test('conversation removal is blocked while submitting and rolled back if saving fails', () => {
  const { storage } = setup(), chat = new ChatComposer(storage); chat.runIds = ['original'];
  chat.busy = true; chat.dismissRun(); assert.deepEqual(chat.runIds, ['original']);
  chat.busy = false; storage.setItem = () => { throw Error('quota'); };
  chat.dismissRun(); assert.deepEqual(chat.runIds, ['original']); assert.match(chat.error, /未保存/);
});

test('adding files only stages exact text; no network request until explicit send', async () => {
  const { storage, workflow, calls } = setup(), chat = new ChatComposer(storage);
  await chat.addFiles([file()]); assert.deepEqual(calls, []);
  assert.equal(chat.files[0].content, '客户：这是合成讨论。');
  await chat.send(workflow); assert.deepEqual(calls, []); assert.match(chat.error, /请选择/); assert.equal(chat.files.length, 1);
  chat.basis = 'synthetic'; await chat.send(workflow);
  assert.deepEqual(calls, ['save', 'connect', 'submit', 'analyze']);
  assert.equal(chat.files.length, 0); assert.equal(chat.runIds.length, 1);
  assert.equal(chat.basis, '', 'new material must not inherit the previous batch authorization');
});
test('connection failure retains saved batch and retry does not create duplicate drafts', async () => {
  const { storage, workflow, calls } = setup(); let chat = new ChatComposer(storage);
  chat.text = '客服：合成说明。'; chat.basis = 'synthetic';
  const connect = workflow.connect; workflow.connect = async () => { throw Error('离线'); };
  await chat.send(workflow); assert.match(chat.error, /离线/); assert.equal(workflow.state.drafts.length, 1);
  chat = new ChatComposer(storage); assert.equal(chat.runIds.length, 1); assert.equal(chat.text, '');
  workflow.connect = connect; await chat.send(workflow, true);
  assert.equal(calls.filter(c => c === 'save').length, 1); assert.equal(workflow.state.drafts.length, 1);
  assert.equal(workflow.state.active_job.id, 'job1');
});
test('failed local save retains pasted text and avoids network writes', async () => {
  const { storage, workflow, calls } = setup(), chat = new ChatComposer(storage);
  chat.text = '不可丢失的合成原文'; chat.basis = 'synthetic'; workflow.save = () => { throw Error('配额不足'); };
  await chat.send(workflow); assert.equal(chat.text, '不可丢失的合成原文'); assert.deepEqual(calls, []);
});
test('old snapshots never appear as results for newly submitted materials', async () => {
  const { storage, workflow } = setup(), chat = new ChatComposer(storage);
  chat.text = '合成案例'; chat.basis = 'synthetic'; await chat.send(workflow);
  workflow.state.overview = { snapshot_version: 1, source_record_ids: ['older'] };
  assert.equal(chat.result(workflow), null);
  workflow.state.overview.source_record_ids = Object.values(workflow.state.submissions);
  assert.equal(chat.result(workflow), null);
  workflow.state.active_job = null; assert.equal(chat.result(workflow).snapshot_version, 1);
});
test('unsupported files and excessive batch leave staged records unchanged', async () => {
  const { storage } = setup(), chat = new ChatComposer(storage);
  await chat.addFiles([file()]); await chat.addFiles([file('错误.pdf')]);
  assert.equal(chat.files.length, 1); assert.match(chat.error, /TXT/);
  chat.text = '另一次讨论'; await chat.addFiles([file(), file(), file(), file()]);
  assert.equal(chat.files.length, 1); assert.match(chat.error, /最多 5/);
});
test('homepage starts with a composer and only opens explicitly requested sample cards', () => {
  const { storage, workflow } = setup(), chat = new ChatComposer(storage);
  assert.doesNotMatch(renderChatHome(chat, workflow), /data-chat-insight=/);
  chat.text = '</textarea><script>bad()</script>'; chat.files = [{ source_name: '<img onerror=x>', client_record_id: 'safe' }];
  const html = renderChatHome(chat, workflow); assert.doesNotMatch(html, /<script>|<img onerror/);
  chat.exampleVersion = 1; const sample = renderChatHome(chat, workflow);
  assert.match(sample, /非实时 AI/); assert.match(sample, /data-chat-insight=/);
  assert.doesNotMatch(sample, /clue_exhibition_paths/);
});
test('authorization is still mandatory and an existing uncertain request prevents a new batch', async () => {
  const { storage, workflow, calls } = setup(), chat = new ChatComposer(storage);
  chat.text = '原文'; chat.basis = 'authorized'; await chat.send(workflow);
  assert.match(chat.error, /授权说明/); assert.deepEqual(calls, []);
  chat.authorization = '提供者允许本次分析'; workflow.state.pending.import = { key: 'prior' };
  await chat.send(workflow); assert.match(chat.error, /恢复原任务/); assert.deepEqual(calls, []);
});
