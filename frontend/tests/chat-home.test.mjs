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

function kimiSetup() {
  const setupValue = setup(), { workflow, calls } = setupValue;
  workflow.state.base_url = 'http://127.0.0.1:8000/api/v1'; workflow.state.project = { id: 'kimi-project' };
  workflow.health.agent_analysis_mode = 'kimi';
  const saved = [], keys = [];
  workflow.api = {
    async agentAnalyses() { return { items: [...saved] }; },
    async agentAnalysis(projectId, id, consent, key) {
      keys.push(key); calls.push('kimi');
      const item = { id: `analysis-${id}`, record_id: id, model: 'kimi-k2.5', result: { summary: '报价边界待核实', outcome: 'updated', changes: [{ title: '报价边界', type: 'new', reason: '条件不同', judgment: '模型推断', evidence: [{ record_id: id, segment_id: 'segment', quote: '需要核实的原话', meeting_id: 'M1' }] }] } };
      saved.push(item); return item;
    },
  };
  return { ...setupValue, saved, keys };
}

test('Kimi homepage uses independent analysis with clickable evidence, never mock snapshot or export', async () => {
  const { storage, workflow, calls } = kimiSetup(); let chat = new ChatComposer(storage);
  chat.text = '需要核实的原话'; chat.basis = 'synthetic'; await chat.send(workflow);
  assert.equal(chat.error, ''); assert.ok(calls.includes('kimi')); assert.ok(!calls.includes('analyze'));
  assert.equal(workflow.state.active_job, null); assert.equal(chat.result(workflow), null);
  assert.equal(chat.agentResult(workflow).cards.length, 1);
  const html = renderChatHome(chat, workflow);
  assert.match(html, /Kimi 引文分析/); assert.match(html, /data-kimi-card=/);
  assert.doesNotMatch(html, /data-action="export"|data-live-insight=|等待分析结果。/);
  chat = new ChatComposer(storage); assert.equal(chat.agentResult(workflow).cards.length, 1);
  await chat.send(workflow, true); assert.equal(calls.filter(call => call === 'kimi').length, 1);
  workflow.state.base_url = 'http://127.0.0.1:8001/api/v1'; assert.equal(chat.agentResult(workflow), null);
});

test('uncertain Kimi request reuses its key and partial multi-file results are recovered without another paid call', async () => {
  const { storage, workflow, keys } = kimiSetup(), chat = new ChatComposer(storage);
  await chat.addFiles([file('第一场.md'), file('第二场.md')]); chat.basis = 'synthetic';
  const original = workflow.api.agentAnalysis; let fail = true; const attempts = [];
  workflow.api.agentAnalysis = async (...args) => {
    attempts.push(args[3]);
    if (keys.length === 1 && fail) { fail = false; throw Error('网络中断'); }
    return original(...args);
  };
  await chat.send(workflow); assert.match(chat.error, /网络中断/); assert.equal(chat.agentResult(workflow), null);
  const restored = new ChatComposer(storage); await restored.send(workflow, true);
  assert.equal(restored.error, ''); assert.equal(keys.length, 2);
  assert.equal(attempts[1], attempts[2]); assert.equal(restored.agentResult(workflow).items.length, 2);
});

test('a Kimi batch cannot silently fall back to mock when provider configuration disappears', async () => {
  const { storage, workflow, calls } = kimiSetup(), chat = new ChatComposer(storage);
  chat.text = '合成记录'; chat.basis = 'synthetic'; await chat.send(workflow);
  workflow.health.agent_analysis_mode = 'unavailable'; await chat.send(workflow, true);
  assert.match(chat.error, /恢复 Kimi/); assert.ok(!calls.includes('analyze'));
});
